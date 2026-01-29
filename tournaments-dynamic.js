// ========================================
// DYNAMIC TOURNAMENT RENDERING
// This script automatically generates tournament cards from tournaments-config.js
// ========================================

// ========================================
// RENDER UPCOMING TOURNAMENTS
// ========================================

function renderUpcomingTournaments() {
    const container = document.getElementById('tournaments-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear existing content
    
    TOURNAMENTS.upcoming.forEach(tournament => {
        const card = createTournamentCard(tournament, 'upcoming');
        container.appendChild(card);
    });
}

// ========================================
// RENDER RESULTS
// ========================================

function renderResults() {
    const container = document.getElementById('results-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear existing content
    
    TOURNAMENTS.results.forEach(tournament => {
        const card = createTournamentCard(tournament, 'results');
        container.appendChild(card);
    });
}

// ========================================
// CREATE TOURNAMENT CARD
// ========================================

function createTournamentCard(tournament, type) {
    const card = document.createElement('div');
    const themeClass = tournament.theme === 'gold' ? 'tournament-card-gold' : 'tournament-card-blue';
    const btnClass = tournament.theme === 'gold' ? 'btn-gold' : 'btn-blue';
    
    if (type === 'upcoming') {
        card.id = tournament.id;
        card.className = `tournament-card ${themeClass}`;
        card.innerHTML = `
            <div class="card-header">
                <h3 class="text-2xl font-bold mb-2">${tournament.title}</h3>
                <p class="text-gray-200">${tournament.startTime} @ ${tournament.location}</p>
            </div>
            <div class="card-body">
                <div class="space-y-3 mb-6">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Format:</span>
                        <span class="font-semibold">${tournament.format}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Skill Level:</span>
                        <span class="font-semibold">${tournament.skillLevel}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Entry Fee:</span>
                        <span class="font-semibold text-ocean-blue">${tournament.entryFee}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Prize Split:</span>
                        <span class="font-semibold">${tournament.prizeSplit}</span>
                    </div>
                </div>
                <button
                    onclick="toggleRegistration('${tournament.id}')"
                    class="tournament-action-button block w-full text-center font-semibold py-3 rounded-lg transition ${btnClass}"
                >
                    <span id="${tournament.id}-registration-button-text">View Registration</span>
                </button>
                <a
                    id="${tournament.id}-live-link"
                    href="https://www.youtube.com/@JoshuaNougaret/live"
                    class="hidden mt-3 block w-full text-center font-semibold py-3 rounded-lg transition btn-live"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Watch Live
                </a>
            </div>

            <!-- Expandable Registration -->
            <div id="${tournament.id}-registration" class="hidden border-t-2 border-gray-200 bg-gray-50">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="text-xl font-bold text-ocean-blue">Registered Teams</h4>
                        <span class="text-sm text-gray-500" id="${tournament.id}-registration-count">0 teams</span>
                    </div>
                    <div id="${tournament.id}-registration-list" class="space-y-3"></div>
                    <div class="mt-6">
                        <button
                            id="${tournament.id}-registration-action"
                            onclick="registerTeam('${tournament.id}')"
                            class="block w-full text-center font-semibold py-3 rounded-lg transition ${btnClass}"
                        >
                            Register Team
                        </button>
                        <p class="text-xs text-gray-500 mt-2 text-center">No capacity limit for now.</p>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'results') {
        card.className = `tournament-card ${themeClass}`;
        card.innerHTML = `
            <div class="card-header">
                <h3 class="text-2xl font-bold mb-2">${tournament.title}</h3>
                <p class="text-gray-200">${tournament.location}</p>
            </div>
            <div class="card-body">
                <div class="space-y-3 mb-6">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Format:</span>
                        <span class="font-semibold">${tournament.format}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Skill Level:</span>
                        <span class="font-semibold">${tournament.skillLevel}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Entry Fee:</span>
                        <span class="font-semibold text-ocean-blue">${tournament.entryFee}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Prize Split:</span>
                        <span class="font-semibold">${tournament.prizeSplit}</span>
                    </div>
                </div>
                <button 
                    onclick="toggleResults('${tournament.id}')"
                    class="block w-full text-center font-semibold py-3 rounded-lg transition ${btnClass}"
                >
                    <span id="${tournament.id}-button-text">View Results</span>
                </button>
            </div>
            
            <!-- Expandable Results -->
            <div id="${tournament.id}-results" class="hidden border-t-2 border-gray-200">
                <!-- Winner Photo -->
                <div class="p-6 pb-0 bg-gray-50">
                    <h4 class="text-xl font-bold text-ocean-blue mb-4 text-center">🏆 Champions</h4>
                    <div class="text-center mb-0">
                        <img 
                            id="${tournament.id}-photo" 
                            src="${tournament.photoUrl}" 
                            alt="Tournament Champions" 
                            class="mx-auto rounded-lg shadow-lg max-w-full h-auto"
                            style="max-height: 400px; display: block;"
                        >
                    </div>
                </div>
                
                <!-- Bracket -->
                <div class="p-6 pb-0">
                    <h4 class="text-xl font-bold text-ocean-blue mb-2">Tournament Bracket</h4>
                    <div id="${tournament.id}-bracket" class="bracket-container">
                        <!-- Bracket loads here -->
                    </div>
                </div>
            </div>
        `;
    }
    
    return card;
}

// ========================================
// TOURNAMENT TIME MANAGEMENT
// ========================================

function checkTournamentStatus() {
    const now = new Date();
    
    TOURNAMENTS.upcoming.forEach(tournament => {
        const card = document.getElementById(tournament.id);
        if (!card) return;
        
        const liveLink = document.getElementById(`${tournament.id}-live-link`);

        // Check if tournament is live
        if (now >= tournament.liveStart && now <= tournament.liveEnd) {
            if (liveLink) {
                liveLink.classList.remove('hidden');
            }
        } else if (now > tournament.liveEnd) {
            // Tournament is over - hide the card
            card.style.display = 'none';
        } else {
            if (liveLink) {
                liveLink.classList.add('hidden');
            }
        }
    });
}

// ========================================
// REGISTRATION MANAGEMENT
// ========================================

function isDoublesTournament(tournament) {
    return /doubles/i.test(tournament.format || '');
}

const OPEN_REGISTRATION_KEY = 'openRegistrationId';
const OPEN_REGISTRATION_SCROLL_KEY = 'openRegistrationScroll';

function setOpenRegistration(tournamentId) {
    localStorage.setItem(OPEN_REGISTRATION_KEY, tournamentId);
    localStorage.setItem(OPEN_REGISTRATION_SCROLL_KEY, String(window.scrollY || 0));
}

function getOpenRegistration() {
    return localStorage.getItem(OPEN_REGISTRATION_KEY);
}

function clearOpenRegistration() {
    localStorage.removeItem(OPEN_REGISTRATION_KEY);
    localStorage.removeItem(OPEN_REGISTRATION_SCROLL_KEY);
}

async function fetchRegistrations(tournamentId) {
    const response = await fetch(`/api/registrations/${tournamentId}`);
    if (!response.ok) {
        throw new Error('Failed to load registrations');
    }
    const data = await response.json();
    return data.teams || [];
}

async function toggleRegistration(tournamentId) {
    const registrationDiv = document.getElementById(`${tournamentId}-registration`);
    const buttonText = document.getElementById(`${tournamentId}-registration-button-text`);

    if (!registrationDiv || !buttonText) return;

    if (registrationDiv.classList.contains('hidden')) {
        registrationDiv.classList.remove('hidden');
        buttonText.textContent = 'Hide Registration';

        if (!registrationDiv.dataset.loaded) {
            await renderRegistrationList(tournamentId);
            registrationDiv.dataset.loaded = 'true';
        } else {
            await renderRegistrationList(tournamentId);
        }
    } else {
        registrationDiv.classList.add('hidden');
        buttonText.textContent = 'View Registration';
    }
}

async function requireAuth() {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (user) {
        return user;
    }
    if (auth && auth.signIn) {
        await auth.signIn();
    } else {
        alert('Please sign in to register.');
    }
    return null;
}

async function ensureDuprLinked() {
    try {
        const token = await window.authUtils.getAuthToken();
        const response = await fetch('/api/auth/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 404) {
            redirectToProfileForLink();
            return false;
        }

        if (!response.ok) {
            alert('Unable to verify profile status.');
            return false;
        }

        const profile = await response.json();
        if (!profile.duprId) {
            redirectToProfileForLink();
            return false;
        }
        return true;
    } catch (error) {
        console.error('Profile check failed:', error);
        alert('Unable to verify profile status.');
        return false;
    }
}

function redirectToProfileForLink() {
    window.location.href = 'profile.html';
}

function formatRating(player, preferDoubles) {
    const rating = preferDoubles ? player.doublesRating : player.singlesRating;
    if (rating === null || rating === undefined || Number.isNaN(rating)) {
        return '-';
    }
    return Number(rating).toFixed(2);
}

async function renderRegistrationList(tournamentId) {
    const list = document.getElementById(`${tournamentId}-registration-list`);
    const count = document.getElementById(`${tournamentId}-registration-count`);
    if (!list || !count) return;

    const tournament = TOURNAMENTS.upcoming.find(t => t.id === tournamentId);
    const doubles = tournament ? isDoublesTournament(tournament) : false;
    let teams = [];
    try {
        teams = await fetchRegistrations(tournamentId);
    } catch (error) {
        list.innerHTML = '<p class="text-sm text-red-500">Unable to load registrations.</p>';
        count.textContent = '0 teams';
        return;
    }
    const currentUser = window.authUtils && window.authUtils.getCurrentUser
        ? window.authUtils.getCurrentUser()
        : null;
    const currentUserId = currentUser ? (currentUser.id || currentUser.emailAddresses[0].emailAddress) : null;
    const isRegistered = currentUserId
        ? teams.some(team => (team.players || []).some(player => player.id === currentUserId))
        : false;

    count.textContent = `${teams.length} team${teams.length === 1 ? '' : 's'}`;

    if (!teams.length) {
        list.innerHTML = '<p class="text-sm text-gray-500">No teams registered yet.</p>';
    } else {
        const isAdmin = window.authProfile && window.authProfile.isAdmin;
        const rows = teams.map((team, index) => {
            const players = team.players || [];
            const playerLines = players.map(player => {
                const rating = formatRating(player, doubles);
                const display = rating !== '-' ? `${player.name} (${rating})` : player.name;
                const removeButton = isAdmin
                    ? `<button onclick="removePlayer('${tournamentId}', '${player.id}')" class="text-xs text-red-600 hover:text-red-800 ml-3">Remove</button>`
                    : '';
                return `<div class="text-sm text-gray-700 leading-5 flex items-center justify-between"><span>${display}</span>${removeButton}</div>`;
            }).join('');

            const needsPartner = doubles && players.length === 1;
            const joinButton = needsPartner
                ? `<button onclick="joinTeam('${tournamentId}', ${index})" class="text-xs font-semibold text-ocean-blue hover:text-ocean-teal">Join</button>`
                : '';

            return `
                <div class="flex items-start justify-between py-3 border-t border-gray-300 first:border-t-0">
                    <div class="space-y-1">${playerLines || '<div class=\"text-sm text-gray-500\">Open team</div>'}</div>
                    ${joinButton}
                </div>
            `;
        }).join('');

        list.innerHTML = `
            <div class="border border-gray-200 rounded-lg bg-white px-4">
                ${rows}
            </div>
        `;
    }

    const actionButton = document.getElementById(`${tournamentId}-registration-action`);
    if (actionButton) {
        if (isRegistered) {
            actionButton.textContent = 'Leave Team';
            actionButton.setAttribute('onclick', `leaveTeam('${tournamentId}')`);
        } else {
            actionButton.textContent = 'Register Team';
            actionButton.setAttribute('onclick', `registerTeam('${tournamentId}')`);
        }
    }
}

async function registerTeam(tournamentId) {
    setOpenRegistration(tournamentId);
    const user = await requireAuth();
    if (!user) return;
    const linked = await ensureDuprLinked();
    if (!linked) return;

    try {
        await submitRegistration({ action: 'create', tournamentId });
    } catch (error) {
        console.error('Register team error:', error);
        alert('Failed to register team.');
    }
}

async function joinTeam(tournamentId, teamIndex) {
    setOpenRegistration(tournamentId);
    const user = await requireAuth();
    if (!user) return;
    const linked = await ensureDuprLinked();
    if (!linked) return;

    const tournament = TOURNAMENTS.upcoming.find(t => t.id === tournamentId);
    if (!tournament || !isDoublesTournament(tournament)) {
        alert('This tournament is not a doubles event.');
        return;
    }

    try {
        const teams = await fetchRegistrations(tournamentId);
        const team = teams[teamIndex];
        if (!team) {
            alert('This team is no longer available to join.');
            return;
        }

        await submitRegistration({ action: 'join', tournamentId, teamId: team.id });
    } catch (error) {
        console.error('Join team error:', error);
        alert('Failed to join team.');
    }
}

async function submitRegistration({ action, tournamentId, teamId }) {
    const token = await window.authUtils.getAuthToken();
    const response = await fetch(`/api/registrations/${tournamentId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, teamId })
    });

    if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to update registration.');
        return false;
    }

    await renderRegistrationList(tournamentId);
    return true;
}

async function leaveTeam(tournamentId) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) {
        if (auth && auth.signIn) {
            await auth.signIn();
        } else {
            alert('Please sign in to manage registration.');
        }
        return;
    }

    try {
        const token = await auth.getAuthToken();
        const response = await fetch(`/api/registrations/${tournamentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to leave team.');
            return;
        }
        await renderRegistrationList(tournamentId);
    } catch (error) {
        console.error('Leave team error:', error);
        alert('Failed to leave team.');
    }
}

async function removePlayer(tournamentId, userId) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) {
        if (auth && auth.signIn) {
            await auth.signIn();
        } else {
            alert('Please sign in to manage registrations.');
        }
        return;
    }

    try {
        const token = await auth.getAuthToken();
        const response = await fetch('/api/admin/registrations/remove', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tournamentId, userId })
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to remove player.');
            return;
        }
        await renderRegistrationList(tournamentId);
    } catch (error) {
        console.error('Remove player error:', error);
        alert('Failed to remove player.');
    }
}

// ========================================
// RESULTS MANAGEMENT
// ========================================

function toggleResults(tournamentId) {
    const resultsDiv = document.getElementById(`${tournamentId}-results`);
    const buttonText = document.getElementById(`${tournamentId}-button-text`);
    
    if (!resultsDiv || !buttonText) return; // Safety check
    
    if (resultsDiv.classList.contains('hidden')) {
        resultsDiv.classList.remove('hidden');
        buttonText.textContent = 'Hide Results';
        
        // Load bracket if not already loaded
        if (!resultsDiv.dataset.loaded) {
            loadTournamentBracket(tournamentId);
            resultsDiv.dataset.loaded = 'true';
        }
    } else {
        resultsDiv.classList.add('hidden');
        buttonText.textContent = 'View Results';
    }
}

async function loadTournamentBracket(tournamentId) {
    const tournament = TOURNAMENTS.results.find(t => t.id === tournamentId);
    if (!tournament || !tournament.csvUrl) return;
    
    try {
        const response = await fetch(tournament.csvUrl);
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        if (data.matches.length === 0) {
            document.getElementById(`${tournamentId}-bracket`).innerHTML = 
                '<p class="text-yellow-600">No match data found in spreadsheet</p>';
            return;
        }
        
        renderBracket(tournamentId, data);
    } catch (error) {
        console.error('Error loading bracket:', error);
        document.getElementById(`${tournamentId}-bracket`).innerHTML = 
            '<p class="text-red-500">Error loading bracket data</p>';
    }
}

// ========================================
// CSV PARSING (SIMPLIFIED - NO METADATA)
// ========================================

function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    const matches = [];
    
    // Parse CSV with proper quote handling
    const parseLine = (line) => {
        const cells = [];
        let currentCell = '';
        let insideQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                cells.push(currentCell.trim());
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
        cells.push(currentCell.trim());
        return cells;
    };
    
    // Skip header row, parse match data only
    for (let i = 1; i < lines.length; i++) {
        const cells = parseLine(lines[i]);
        
        // Only parse rows with round data (skip empty rows)
        if (cells[0] && cells[0].length > 0) {
            matches.push({
                round: cells[0],           // Column A: Round
                team1: cells[1] || '',     // Column B: Team 1
                team1Score: cells[2] || '', // Column C: Team 1 Score
                team2: cells[3] || '',     // Column D: Team 2
                team2Score: cells[4] || ''  // Column E: Team 2 Score
            });
        }
    }
    
    return { matches };
}

// ========================================
// BRACKET RENDERING
// ========================================

function renderBracket(tournamentId, data) {
    const bracketDiv = document.getElementById(`${tournamentId}-bracket`);
    const championDiv = document.getElementById(`${tournamentId}-champion`);
    
    if (!bracketDiv) {
        console.error('Bracket div not found:', `${tournamentId}-bracket`);
        return;
    }
    
    const { matches } = data;
    
    // Find rounds
    const quarterfinals = matches.filter(m => m.round.includes('QUARTERFINAL'));
    const semifinals = matches.filter(m => m.round.includes('SEMIFINAL'));
    const goldMatch = matches.find(m => m.round.includes('GOLD'));
    const bronzeMatch = matches.find(m => m.round.includes('BRONZE'));
    
    // Determine winner from separate score columns
    const getWinner = (match) => {
        const score1 = parseFloat(match.team1Score);
        const score2 = parseFloat(match.team2Score);
        
        if (isNaN(score1) || isNaN(score2)) return null;
        return score1 > score2 ? match.team1 : match.team2;
    };
    
    // Format score display
    const formatScore = (match) => {
        return `${match.team1Score} - ${match.team2Score}`;
    };
    
    // Set champion
    if (championDiv && goldMatch) {
        const champion = getWinner(goldMatch);
        if (champion) {
            championDiv.textContent = champion;
        }
    }

    // Build bracket HTML
    let html = '<div class="flex gap-2 overflow-x-auto pb-4" style="align-items: flex-start;">';

    // Quarterfinals
    if (quarterfinals.length > 0) {
        html += '<div class="bracket-round quarterfinals">';
        quarterfinals.forEach(match => {
            const winner = getWinner(match);
            html += `
                <div class="bracket-match">
                    <div class="bracket-team ${winner === match.team1 ? 'winner' : ''}">
                        <span>${match.team1}</span>
                        <span>${match.team1Score}</span>
                    </div>
                    <div class="bracket-team ${winner === match.team2 ? 'winner' : ''}">
                        <span>${match.team2}</span>
                        <span>${match.team2Score}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    // Semifinals
    if (semifinals.length > 0) {
        html += '<div class="bracket-round semifinals">';
        semifinals.forEach(match => {
            const winner = getWinner(match);
            html += `
                <div class="bracket-match">
                    <div class="bracket-team ${winner === match.team1 ? 'winner' : ''}">
                        <span>${match.team1}</span>
                        <span>${match.team1Score}</span>
                    </div>
                    <div class="bracket-team ${winner === match.team2 ? 'winner' : ''}">
                        <span>${match.team2}</span>
                        <span>${match.team2Score}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    // Finals
    html += '<div class="bracket-round finals">';

    if (goldMatch) {
        const winner = getWinner(goldMatch);
        html += `
            <div class="bracket-match gold">
                <div class="text-xs font-bold text-center mb-2" style="color: #d4a574;">🥇 GOLD MATCH</div>
                <div class="bracket-team ${winner === goldMatch.team1 ? 'winner' : ''}">
                    <span>${goldMatch.team1}</span>
                    <span>${goldMatch.team1Score}</span>
                </div>
                <div class="bracket-team ${winner === goldMatch.team2 ? 'winner' : ''}">
                    <span>${goldMatch.team2}</span>
                    <span>${goldMatch.team2Score}</span>
                </div>
            </div>
        `;
    }

    if (bronzeMatch) {
        const winner = getWinner(bronzeMatch);
        html += `
            <div class="bracket-match bronze">
                <div class="text-xs font-bold text-center mb-2" style="color: #cd7f32;">🥉 BRONZE MATCH</div>
                <div class="bracket-team ${winner === bronzeMatch.team1 ? 'winner' : ''}">
                    <span>${bronzeMatch.team1}</span>
                    <span>${bronzeMatch.team1Score}</span>
                </div>
                <div class="bracket-team ${winner === bronzeMatch.team2 ? 'winner' : ''}">
                    <span>${bronzeMatch.team2}</span>
                    <span>${bronzeMatch.team2Score}</span>
                </div>
            </div>
        `;
    }

    html += '</div></div>';

    bracketDiv.innerHTML = html;
}

// ========================================
// INITIALIZATION
// ========================================

// Render tournaments when page loads
document.addEventListener('DOMContentLoaded', function() {
    renderUpcomingTournaments();
    renderResults();
    checkTournamentStatus();
    const openRegistrationId = getOpenRegistration();
    if (openRegistrationId) {
        toggleRegistration(openRegistrationId);
        const savedScroll = Number(localStorage.getItem(OPEN_REGISTRATION_SCROLL_KEY));
        if (Number.isFinite(savedScroll)) {
            requestAnimationFrame(() => {
                window.scrollTo({ top: savedScroll, behavior: 'auto' });
            });
        }
        clearOpenRegistration();
    }
    if (window.authUtils && window.authUtils.loadAuthProfile) {
        window.authUtils.loadAuthProfile().then(() => {
            const openPanels = document.querySelectorAll('[id$="-registration"]:not(.hidden)');
            openPanels.forEach(panel => {
                const tournamentId = panel.id.replace('-registration', '');
                renderRegistrationList(tournamentId);
            });
        });
    }
    
    // Check status every minute
    setInterval(checkTournamentStatus, 60000);
});

window.addEventListener('auth:changed', () => {
    const openPanels = document.querySelectorAll('[id$="-registration"]:not(.hidden)');
    openPanels.forEach(panel => {
        const tournamentId = panel.id.replace('-registration', '');
        renderRegistrationList(tournamentId);
    });
});
