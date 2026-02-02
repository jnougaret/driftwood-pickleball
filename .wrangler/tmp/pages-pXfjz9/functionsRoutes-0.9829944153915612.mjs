import { onRequestGet as __api_auth_profile_js_onRequestGet } from "/Users/joshua/Projects/driftwood-pickleball/functions/api/auth/profile.js"
import { onRequestPost as __api_auth_profile_js_onRequestPost } from "/Users/joshua/Projects/driftwood-pickleball/functions/api/auth/profile.js"
import { onRequestPut as __api_auth_profile_js_onRequestPut } from "/Users/joshua/Projects/driftwood-pickleball/functions/api/auth/profile.js"
import { onRequestDelete as __api_registrations__tournamentId__js_onRequestDelete } from "/Users/joshua/Projects/driftwood-pickleball/functions/api/registrations/[tournamentId].js"
import { onRequestGet as __api_registrations__tournamentId__js_onRequestGet } from "/Users/joshua/Projects/driftwood-pickleball/functions/api/registrations/[tournamentId].js"
import { onRequestPost as __api_registrations__tournamentId__js_onRequestPost } from "/Users/joshua/Projects/driftwood-pickleball/functions/api/registrations/[tournamentId].js"

export const routes = [
    {
      routePath: "/api/auth/profile",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_profile_js_onRequestGet],
    },
  {
      routePath: "/api/auth/profile",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_profile_js_onRequestPost],
    },
  {
      routePath: "/api/auth/profile",
      mountPath: "/api/auth",
      method: "PUT",
      middlewares: [],
      modules: [__api_auth_profile_js_onRequestPut],
    },
  {
      routePath: "/api/registrations/:tournamentId",
      mountPath: "/api/registrations",
      method: "DELETE",
      middlewares: [],
      modules: [__api_registrations__tournamentId__js_onRequestDelete],
    },
  {
      routePath: "/api/registrations/:tournamentId",
      mountPath: "/api/registrations",
      method: "GET",
      middlewares: [],
      modules: [__api_registrations__tournamentId__js_onRequestGet],
    },
  {
      routePath: "/api/registrations/:tournamentId",
      mountPath: "/api/registrations",
      method: "POST",
      middlewares: [],
      modules: [__api_registrations__tournamentId__js_onRequestPost],
    },
  ]