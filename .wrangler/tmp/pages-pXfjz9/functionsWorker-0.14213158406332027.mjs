var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/_auth.js
var JWKS_CACHE_TTL_MS = 60 * 60 * 1e3;
var jwksCache = /* @__PURE__ */ new Map();
function base64UrlToUint8Array(value) {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) {
    base64 += "=".repeat(4 - pad);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(base64UrlToUint8Array, "base64UrlToUint8Array");
function decodeJwtPart(part) {
  const bytes = base64UrlToUint8Array(part);
  return JSON.parse(new TextDecoder().decode(bytes));
}
__name(decodeJwtPart, "decodeJwtPart");
async function getJwks(issuer) {
  const cached = jwksCache.get(issuer);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }
  const jwksUrl = `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch JWKS");
  }
  const { keys } = await response.json();
  if (!Array.isArray(keys)) {
    throw new Error("Invalid JWKS response");
  }
  jwksCache.set(issuer, { keys, fetchedAt: now });
  return keys;
}
__name(getJwks, "getJwks");
async function verifyClerkToken(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing authorization token", status: 401 };
  }
  const token = authHeader.replace("Bearer ", "");
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { error: "Invalid token format", status: 401 };
  }
  try {
    const header = decodeJwtPart(parts[0]);
    const payload = decodeJwtPart(parts[1]);
    if (header.alg !== "RS256" || !header.kid) {
      return { error: "Unsupported token header", status: 401 };
    }
    if (!payload.iss || !payload.sub) {
      return { error: "Invalid token payload", status: 401 };
    }
    if (payload.exp && Date.now() >= payload.exp * 1e3) {
      return { error: "Token expired", status: 401 };
    }
    const jwks = await getJwks(payload.iss);
    const jwk = jwks.find((key) => key.kid === header.kid);
    if (!jwk) {
      return { error: "Signing key not found", status: 401 };
    }
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlToUint8Array(parts[2]);
    const verified = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      cryptoKey,
      signature,
      data
    );
    if (!verified) {
      return { error: "Invalid token signature", status: 401 };
    }
    return { userId: payload.sub, session: payload };
  } catch (error) {
    console.error("Token verification error:", error);
    return { error: "Token verification failed", status: 401 };
  }
}
__name(verifyClerkToken, "verifyClerkToken");

// api/auth/profile.js
async function getClerkUser(userId, env) {
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        "Authorization": `Bearer ${env.CLERK_SECRET_KEY}`
      }
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching Clerk user:", error);
    return null;
  }
}
__name(getClerkUser, "getClerkUser");
async function onRequestGet({ request, env }) {
  const auth = await verifyClerkToken(request, env);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userId = auth.userId;
  try {
    const result = await env.DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).bind(userId).first();
    if (!result) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      id: result.id,
      email: result.email,
      displayName: result.display_name,
      duprId: result.dupr_id,
      doublesRating: result.doubles_rating,
      singlesRating: result.singles_rating,
      isAdmin: Boolean(result.is_admin),
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Database error:", error);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestGet, "onRequestGet");
async function onRequestPost({ request, env }) {
  return handleProfileUpdate(request, env);
}
__name(onRequestPost, "onRequestPost");
async function onRequestPut({ request, env }) {
  return handleProfileUpdate(request, env);
}
__name(onRequestPut, "onRequestPut");
async function handleProfileUpdate(request, env) {
  const auth = await verifyClerkToken(request, env);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userId = auth.userId;
  const clerkUser = await getClerkUser(userId, env);
  if (!clerkUser) {
    return new Response(JSON.stringify({ error: "Unable to fetch user info" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  const email = clerkUser.email_addresses[0]?.email_address;
  if (!email) {
    return new Response(JSON.stringify({ error: "No email address found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { displayName, duprId, doublesRating, singlesRating } = body;
  if (!displayName || displayName.trim() === "") {
    return new Response(JSON.stringify({ error: "Display name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    await env.DB.prepare(`
            INSERT INTO users (id, email, display_name, dupr_id, doubles_rating, singles_rating)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                display_name = excluded.display_name,
                dupr_id = excluded.dupr_id,
                doubles_rating = excluded.doubles_rating,
                singles_rating = excluded.singles_rating,
                updated_at = CURRENT_TIMESTAMP
        `).bind(userId, email, displayName, duprId || null, doublesRating || null, singlesRating || null).run();
    if (duprId === null) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM team_members WHERE user_id = ?").bind(userId),
        env.DB.prepare("DELETE FROM teams WHERE id NOT IN (SELECT DISTINCT team_id FROM team_members)")
      ]);
    }
    const result = await env.DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).bind(userId).first();
    return new Response(JSON.stringify({
      success: true,
      profile: {
        id: result.id,
        email: result.email,
        displayName: result.display_name,
        duprId: result.dupr_id,
        doublesRating: result.doubles_rating,
        singlesRating: result.singles_rating,
        isAdmin: Boolean(result.is_admin),
        createdAt: result.created_at,
        updatedAt: result.updated_at
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Database error:", error);
    return new Response(JSON.stringify({ error: "Database error", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleProfileUpdate, "handleProfileUpdate");

// api/registrations/[tournamentId].js
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
async function listTeams(env, tournamentId) {
  const teams = await env.DB.prepare(
    `SELECT t.id AS team_id,
                u.id AS user_id,
                u.display_name AS display_name,
                u.doubles_rating AS doubles_rating,
                u.singles_rating AS singles_rating
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users u ON u.id = tm.user_id
         WHERE t.tournament_id = ?
         ORDER BY t.created_at ASC, tm.created_at ASC`
  ).bind(tournamentId).all();
  const teamMap = /* @__PURE__ */ new Map();
  for (const row of teams.results || []) {
    if (!teamMap.has(row.team_id)) {
      teamMap.set(row.team_id, { id: row.team_id, players: [] });
    }
    if (row.user_id) {
      teamMap.get(row.team_id).players.push({
        id: row.user_id,
        name: row.display_name || "Player",
        doublesRating: row.doubles_rating,
        singlesRating: row.singles_rating
      });
    }
  }
  return Array.from(teamMap.values());
}
__name(listTeams, "listTeams");
async function getUserProfile(env, userId) {
  return await env.DB.prepare(
    "SELECT id, dupr_id FROM users WHERE id = ?"
  ).bind(userId).first();
}
__name(getUserProfile, "getUserProfile");
async function findUserTeam(env, tournamentId, userId) {
  return await env.DB.prepare(
    `SELECT t.id AS team_id
         FROM teams t
         JOIN team_members tm ON tm.team_id = t.id
         WHERE t.tournament_id = ? AND tm.user_id = ?
         LIMIT 1`
  ).bind(tournamentId, userId).first();
}
__name(findUserTeam, "findUserTeam");
async function onRequestGet2({ env, params }) {
  const tournamentId = params.tournamentId;
  if (!tournamentId) {
    return jsonResponse({ error: "Missing tournamentId" }, 400);
  }
  try {
    const teams = await listTeams(env, tournamentId);
    return jsonResponse({ teams });
  } catch (error) {
    console.error("Registration list error:", error);
    return jsonResponse({ error: "Failed to load registrations" }, 500);
  }
}
__name(onRequestGet2, "onRequestGet");
async function onRequestPost2({ request, env, params }) {
  const tournamentId = params.tournamentId;
  if (!tournamentId) {
    return jsonResponse({ error: "Missing tournamentId" }, 400);
  }
  const auth = await verifyClerkToken(request);
  if (auth.error) {
    return jsonResponse({ error: auth.error }, auth.status);
  }
  let body = {};
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const action = body.action;
  if (!action || action !== "create" && action !== "join") {
    return jsonResponse({ error: "Invalid action" }, 400);
  }
  const userId = auth.userId;
  const profile = await getUserProfile(env, userId);
  if (!profile) {
    return jsonResponse({ error: "Profile required before registering" }, 400);
  }
  if (!profile.dupr_id) {
    return jsonResponse({ error: "DUPR account must be linked before registering" }, 400);
  }
  const existing = await findUserTeam(env, tournamentId, userId);
  if (existing) {
    return jsonResponse({ error: "Already registered" }, 400);
  }
  try {
    if (action === "create") {
      const teamId2 = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO teams (id, tournament_id, created_by) VALUES (?, ?, ?)"
        ).bind(teamId2, tournamentId, userId),
        env.DB.prepare(
          "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)"
        ).bind(teamId2, userId)
      ]);
      const teams2 = await listTeams(env, tournamentId);
      return jsonResponse({ teams: teams2 });
    }
    const teamId = body.teamId;
    if (!teamId) {
      return jsonResponse({ error: "Missing teamId" }, 400);
    }
    const team = await env.DB.prepare(
      "SELECT id FROM teams WHERE id = ? AND tournament_id = ?"
    ).bind(teamId, tournamentId).first();
    if (!team) {
      return jsonResponse({ error: "Team not found" }, 404);
    }
    const members = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?"
    ).bind(teamId).first();
    if (members && members.count >= 2) {
      return jsonResponse({ error: "Team is full" }, 400);
    }
    await env.DB.prepare(
      "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)"
    ).bind(teamId, userId).run();
    const teams = await listTeams(env, tournamentId);
    return jsonResponse({ teams });
  } catch (error) {
    console.error("Registration update error:", error);
    return jsonResponse({ error: "Failed to update registration" }, 500);
  }
}
__name(onRequestPost2, "onRequestPost");
async function onRequestDelete({ request, env, params }) {
  const tournamentId = params.tournamentId;
  if (!tournamentId) {
    return jsonResponse({ error: "Missing tournamentId" }, 400);
  }
  const auth = await verifyClerkToken(request);
  if (auth.error) {
    return jsonResponse({ error: auth.error }, auth.status);
  }
  try {
    const userId = auth.userId;
    const team = await findUserTeam(env, tournamentId, userId);
    if (!team) {
      return jsonResponse({ error: "Not registered" }, 400);
    }
    await env.DB.prepare(
      "DELETE FROM team_members WHERE team_id = ? AND user_id = ?"
    ).bind(team.team_id, userId).run();
    const remaining = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?"
    ).bind(team.team_id).first();
    if (!remaining || remaining.count === 0) {
      await env.DB.prepare("DELETE FROM teams WHERE id = ?").bind(team.team_id).run();
    }
    const teams = await listTeams(env, tournamentId);
    return jsonResponse({ teams });
  } catch (error) {
    console.error("Registration leave error:", error);
    return jsonResponse({ error: "Failed to leave registration" }, 500);
  }
}
__name(onRequestDelete, "onRequestDelete");

// ../.wrangler/tmp/pages-pXfjz9/functionsRoutes-0.9829944153915612.mjs
var routes = [
  {
    routePath: "/api/auth/profile",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/auth/profile",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/auth/profile",
    mountPath: "/api/auth",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/registrations/:tournamentId",
    mountPath: "/api/registrations",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/registrations/:tournamentId",
    mountPath: "/api/registrations",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/registrations/:tournamentId",
    mountPath: "/api/registrations",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  }
];

// ../../../../../opt/homebrew/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-XstyWQ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-XstyWQ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.14213158406332027.mjs.map
