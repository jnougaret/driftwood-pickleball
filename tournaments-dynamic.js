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
            <div id="${tournament.id}-registration" class="hidden border-t-2 border-gray-200 bg-gray-200">
                <div class="p-6 space-y-5">
                    <div id="${tournament.id}-admin-settings" class="hidden border border-gray-200 rounded-lg bg-white p-4">
                        <h4 class="text-lg font-semibold text-ocean-blue mb-3">Tournament Settings</h4>
                        <div class="space-y-4">
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-sm font-medium text-gray-700">Max Teams</span>
                                    <span class="text-sm text-gray-500" id="${tournament.id}-max-teams-value">12</span>
                                </div>
                                <input
                                    type="range"
                                    min="6"
                                    max="16"
                                    step="1"
                                    value="12"
                                    id="${tournament.id}-max-teams"
                                    class="w-full"
                                    oninput="updateMaxTeams('${tournament.id}', this.value)"
                                >
                            </div>
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-sm font-medium text-gray-700"># of Rounds</span>
                                    <span class="text-sm text-gray-500" id="${tournament.id}-rounds-value">6</span>
                                </div>
                                <input
                                    type="range"
                                    min="4"
                                    max="10"
                                    step="1"
                                    value="6"
                                    id="${tournament.id}-rounds"
                                    class="w-full"
                                    oninput="updateRounds('${tournament.id}', this.value)"
                                >
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-between mb-4" id="${tournament.id}-registration-header">
                        <h4 class="text-xl font-bold text-ocean-blue">Registered Teams</h4>
                        <span class="text-sm text-gray-500" id="${tournament.id}-registration-count">0 teams</span>
                    </div>
                    <div id="${tournament.id}-registration-list" class="space-y-3"></div>
                    <div class="mt-6" id="${tournament.id}-registration-actions">
                        <button
                            id="${tournament.id}-registration-action"
                            onclick="registerTeam('${tournament.id}')"
                            class="block w-full text-center font-semibold py-3 rounded-lg transition ${btnClass}"
                        >
                            Register Team
                        </button>
                        <p class="text-xs text-gray-500 mt-2 text-center" id="${tournament.id}-capacity-note">No capacity limit for now.</p>
                    </div>
                    <div id="${tournament.id}-tournament-view" class="hidden tournament-view-block">
                        <div class="flex items-center justify-between mb-4">
                            <h4 class="text-xl font-bold text-ocean-blue">Round Robin</h4>
                            <div id="${tournament.id}-tournament-actions" class="flex items-center gap-2"></div>
                        </div>
                        <div id="${tournament.id}-rounds-container" class="rounds-scroll flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"></div>
                        <div id="${tournament.id}-round-indicators" class="mt-1 flex items-center justify-center gap-2"></div>
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

async function fetchTournamentSettings(tournamentId) {
    const response = await fetch(`/api/tournaments/settings/${tournamentId}`);
    if (!response.ok) {
        throw new Error('Failed to load settings');
    }
    const data = await response.json();
    if (data) {
        localStorage.setItem(`tournament-settings-${tournamentId}`, JSON.stringify({
            maxTeams: data.maxTeams,
            rounds: data.rounds,
            status: data.status
        }));
    }
    return data;
}

async function saveTournamentSettings(tournamentId, settings) {
    const token = await window.authUtils.getAuthToken();
    const response = await fetch(`/api/tournaments/settings/${tournamentId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
    }
}

async function toggleRegistration(tournamentId) {
    const registrationDiv = document.getElementById(`${tournamentId}-registration`);
    const buttonText = document.getElementById(`${tournamentId}-registration-button-text`);

    if (!registrationDiv || !buttonText) return;

    if (registrationDiv.classList.contains('hidden')) {
        registrationDiv.classList.remove('hidden');
        if (!registrationDiv.dataset.loaded) {
            await renderRegistrationList(tournamentId);
            await loadAdminSettings(tournamentId);
            registrationDiv.dataset.loaded = 'true';
        } else {
            await renderRegistrationList(tournamentId);
            await loadAdminSettings(tournamentId);
        }
        const tournamentView = document.getElementById(`${tournamentId}-tournament-view`);
        buttonText.textContent = tournamentView && !tournamentView.classList.contains('hidden')
            ? 'Hide Tournament'
            : 'Hide Registration';
        if (tournamentView && !tournamentView.classList.contains('hidden')) {
            startTournamentPolling(tournamentId);
        }
    } else {
        registrationDiv.classList.add('hidden');
        const tournamentView = document.getElementById(`${tournamentId}-tournament-view`);
        buttonText.textContent = tournamentView && !tournamentView.classList.contains('hidden')
            ? 'View Tournament'
            : 'View Registration';
        stopTournamentPolling(tournamentId);
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

function adminSettingsMarkup(tournamentId) {
    return `
        <div id="${tournamentId}-admin-settings" class="hidden border border-gray-200 rounded-lg bg-white p-4">
            <h4 class="text-lg font-semibold text-ocean-blue mb-3">Tournament Settings</h4>
            <div class="space-y-4">
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700">Max Teams</span>
                        <span class="text-sm text-gray-500" id="${tournamentId}-max-teams-value">12</span>
                    </div>
                    <input
                        type="range"
                        min="6"
                        max="16"
                        step="1"
                        value="12"
                        id="${tournamentId}-max-teams"
                        class="w-full"
                        oninput="updateMaxTeams('${tournamentId}', this.value)"
                    >
                </div>
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700"># of Rounds</span>
                        <span class="text-sm text-gray-500" id="${tournamentId}-rounds-value">6</span>
                    </div>
                    <input
                        type="range"
                        min="4"
                        max="10"
                        step="1"
                        value="6"
                        id="${tournamentId}-rounds"
                        class="w-full"
                        oninput="updateRounds('${tournamentId}', this.value)"
                    >
                </div>
            </div>
        </div>
    `;
}

function ensureAdminSettings(tournamentId) {
    if (!window.authProfile || !window.authProfile.isAdmin) return;
    const existing = document.getElementById(`${tournamentId}-admin-settings`);
    if (existing) return;
    const registration = document.getElementById(`${tournamentId}-registration`);
    if (!registration) return;
    const container = registration.querySelector('.p-6');
    if (!container) return;
    container.insertAdjacentHTML('afterbegin', adminSettingsMarkup(tournamentId));
}

function formatRating(player, preferDoubles) {
    const rating = preferDoubles ? player.doublesRating : player.singlesRating;
    if (rating === null || rating === undefined || Number.isNaN(rating)) {
        return '-';
    }
    return Number(rating).toFixed(2);
}

function formatTeamNameLines(name) {
    if (!name) {
        return '<div class="text-sm text-gray-700">Team</div>';
    }
    const parts = String(name).split(' / ').map(part => part.trim()).filter(Boolean);
    if (!parts.length) {
        return '<div class="text-sm text-gray-700">Team</div>';
    }
    return `
        <div class="space-y-1 text-sm text-gray-700">
            ${parts.map(part => `<div>${part}</div>`).join('')}
        </div>
    `;
}

async function loadAdminSettings(tournamentId) {
    const settingsContainer = document.getElementById(`${tournamentId}-admin-settings`);
    if (!settingsContainer) return;
    if (!window.authProfile || !window.authProfile.isAdmin) {
        settingsContainer.classList.add('hidden');
        return;
    }

    try {
        const teams = await fetchRegistrations(tournamentId);
        const currentTeamsCount = teams.length;
        const cached = localStorage.getItem(`tournament-settings-${tournamentId}`);
        const cachedSettings = cached ? JSON.parse(cached) : null;
        if (cachedSettings) {
            applySettingsToInputs(tournamentId, cachedSettings, currentTeamsCount);
        }
        const settings = await fetchTournamentSettings(tournamentId);
        settingsContainer.classList.remove('hidden');
        applySettingsToInputs(tournamentId, settings, currentTeamsCount);
    } catch (error) {
        console.error('Load settings error:', error);
        settingsContainer.classList.add('hidden');
    }
}

function applySettingsToInputs(tournamentId, settings, minTeams) {
    const maxTeamsInput = document.getElementById(`${tournamentId}-max-teams`);
    const roundsInput = document.getElementById(`${tournamentId}-rounds`);
    const maxTeamsValue = document.getElementById(`${tournamentId}-max-teams-value`);
    const roundsValue = document.getElementById(`${tournamentId}-rounds-value`);

    if (maxTeamsInput && maxTeamsValue && Number.isInteger(settings.maxTeams)) {
        const minValue = Math.max(6, Number.isInteger(minTeams) ? minTeams : 6);
        maxTeamsInput.min = minValue;
        const safeMaxTeams = Math.max(minValue, settings.maxTeams);
        maxTeamsInput.value = safeMaxTeams;
        maxTeamsValue.textContent = safeMaxTeams;
        const capacityNote = document.getElementById(`${tournamentId}-capacity-note`);
        if (capacityNote) {
            capacityNote.textContent = safeMaxTeams === 6
                ? '6 team maximum'
                : `${safeMaxTeams} team maximum`;
        }
    }

    if (roundsInput && roundsValue && Number.isInteger(settings.rounds)) {
        roundsInput.min = 4;
        roundsInput.max = 10;
        const safeRounds = Math.min(10, Math.max(4, settings.rounds));
        roundsInput.value = safeRounds;
        roundsValue.textContent = safeRounds;
    }
}

async function updateMaxTeams(tournamentId, value) {
    const maxTeams = Number(value);
    const maxTeamsValue = document.getElementById(`${tournamentId}-max-teams-value`);
    const roundsInput = document.getElementById(`${tournamentId}-rounds`);
    const capacityNote = document.getElementById(`${tournamentId}-capacity-note`);
    if (maxTeamsValue) {
        maxTeamsValue.textContent = maxTeams;
    }
    if (capacityNote) {
        capacityNote.textContent = maxTeams === 6
            ? '6 team maximum'
            : `${maxTeams} team maximum`;
    }
    if (roundsInput) {
        roundsInput.min = 4;
        roundsInput.max = 10;
        if (Number(roundsInput.value) > 10) {
            roundsInput.value = 10;
        }
        if (Number(roundsInput.value) < 4) {
            roundsInput.value = 4;
        }
        const roundsValue = document.getElementById(`${tournamentId}-rounds-value`);
        if (roundsValue) {
            roundsValue.textContent = roundsInput.value;
        }
    }

    await persistSettings(tournamentId);
}

async function updateRounds(tournamentId, value) {
    const roundsValue = document.getElementById(`${tournamentId}-rounds-value`);
    if (roundsValue) {
        roundsValue.textContent = value;
    }
    await persistSettings(tournamentId);
}

let settingsSaveTimeout;
const pendingSettings = new Set();

async function persistSettings(tournamentId) {
    pendingSettings.add(tournamentId);
    clearTimeout(settingsSaveTimeout);
    settingsSaveTimeout = setTimeout(() => {
        flushSettingsSaves();
    }, 300);
}

async function flushSettingsSaves() {
    const tournaments = Array.from(pendingSettings);
    pendingSettings.clear();
    await Promise.all(tournaments.map(async tournamentId => {
        const maxTeamsInput = document.getElementById(`${tournamentId}-max-teams`);
        const roundsInput = document.getElementById(`${tournamentId}-rounds`);
        if (!maxTeamsInput || !roundsInput) return;
        try {
            await saveTournamentSettings(tournamentId, {
                maxTeams: Number(maxTeamsInput.value),
                rounds: Number(roundsInput.value)
            });
            localStorage.setItem(`tournament-settings-${tournamentId}`, JSON.stringify({
                maxTeams: Number(maxTeamsInput.value),
                rounds: Number(roundsInput.value)
            }));
        } catch (error) {
            console.error('Save settings error:', error);
        }
    }));
}

async function startRoundRobin(tournamentId) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const token = await auth.getAuthToken();
        const response = await fetch(`/api/tournaments/round-robin/start/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Unable to start round robin.');
            return;
        }

        await renderRegistrationList(tournamentId);
        await renderTournamentView(tournamentId);
    } catch (error) {
        console.error('Start round robin error:', error);
        alert('Unable to start round robin.');
    }
}

async function resetRoundRobin(tournamentId) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const token = await auth.getAuthToken();
        const response = await fetch(`/api/tournaments/round-robin/reset/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Unable to reset tournament.');
            return;
        }

        await renderRegistrationList(tournamentId);
    } catch (error) {
        console.error('Reset round robin error:', error);
        alert('Unable to reset tournament.');
    }
}

async function fetchRoundRobin(tournamentId) {
    const response = await fetch(`/api/tournaments/round-robin/${tournamentId}`);
    if (!response.ok) {
        throw new Error('Failed to load tournament');
    }
    return await response.json();
}

async function renderTournamentView(tournamentId) {
    const view = document.getElementById(`${tournamentId}-tournament-view`);
    const roundsContainer = document.getElementById(`${tournamentId}-rounds-container`);
    const indicators = document.getElementById(`${tournamentId}-round-indicators`);
    if (!view || !roundsContainer) return;
    const activeEl = document.activeElement;
    if (activeEl && activeEl.classList && activeEl.classList.contains('score-input')) {
        if (activeEl.id && activeEl.id.startsWith(`${tournamentId}-`)) {
            return;
        }
    }

    try {
        const data = await fetchRoundRobin(tournamentId);
        if (data.status !== 'tournament') {
            view.classList.add('hidden');
            return;
        }

        view.classList.remove('hidden');
        const teams = await fetchRegistrations(tournamentId);
        const teamPlayers = new Map();
        teams.forEach(team => {
            teamPlayers.set(team.id, (team.players || []).map(player => player.id));
        });
        const currentUser = window.authUtils && window.authUtils.getCurrentUser
            ? window.authUtils.getCurrentUser()
            : null;
        const currentUserId = currentUser ? (currentUser.id || currentUser.emailAddresses[0].emailAddress) : null;
        const isAdmin = window.authProfile && window.authProfile.isAdmin;

        const matchesByRound = {};
        (data.matches || []).forEach(match => {
            const round = match.round_number;
            if (!matchesByRound[round]) {
                matchesByRound[round] = [];
            }
            matchesByRound[round].push(match);
        });

        const settings = await fetchTournamentSettings(tournamentId);
        const totalRounds = settings.rounds;
        const teamIds = (data.teams || []).map(team => team.team_id);

        const ids = [...teamIds];
        if (ids.length % 2 === 1) {
            ids.push(null);
        }
        const n = ids.length;
        const fixed = ids[0];
        let rotating = ids.slice(1);
        const byeMap = new Map();
        for (let round = 1; round <= Math.min(totalRounds, n - 1); round++) {
            const left = [fixed, ...rotating.slice(0, (n / 2) - 1)];
            const right = rotating.slice((n / 2) - 1).reverse();
            for (let i = 0; i < left.length; i++) {
                const team1 = left[i];
                const team2 = right[i];
                if (!team1 || !team2) {
                    const byeTeam = team1 || team2;
                    if (byeTeam) {
                        byeMap.set(round, byeTeam);
                    }
                }
            }
            rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
        }

        const rounds = Array.from({ length: totalRounds }, (_, index) => index + 1);
        roundsContainer.innerHTML = rounds.map(round => {
            const roundMatches = matchesByRound[round] || [];
            const cards = roundMatches.map(match => {
                const team1Players = teamPlayers.get(match.team1_id) || [];
                const team2Players = teamPlayers.get(match.team2_id) || [];
                const canEdit = isAdmin || (currentUserId && (team1Players.includes(currentUserId) || team2Players.includes(currentUserId)));
                return `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div class="flex items-start justify-between gap-3 text-gray-600">
                            ${formatTeamNameLines(match.team1_name || 'Team 1')}
                            ${scoreInputHtml(tournamentId, match.match_id, 1, match.score1, canEdit)}
                        </div>
                        <div class="flex items-start justify-between gap-3 text-gray-600">
                            ${formatTeamNameLines(match.team2_name || 'Team 2')}
                            ${scoreInputHtml(tournamentId, match.match_id, 2, match.score2, canEdit)}
                        </div>
                    </div>
                `;
            }).join('');

            const byeTeamId = byeMap.get(Number(round));
            const byeTeam = (data.teams || []).find(team => team.team_id === byeTeamId);
            const byeCard = byeTeam ? `
                <div class="bg-gray-100 border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between gap-3 text-gray-600">
                    ${formatTeamNameLines(byeTeam.team_name || 'Team')}
                    <span class="text-xs uppercase tracking-wide text-gray-500">Bye</span>
                </div>
            ` : '';

            return `
                <div class="min-w-[290px] snap-center border rounded-xl p-3" style="background-color: #1a3a52; border-color: rgba(26,58,82,0.35);">
                    <h5 class="text-lg font-semibold text-white mb-3">Round ${round} of ${totalRounds}</h5>
                    <div class="space-y-4">${cards}${byeCard || (roundMatches.length === 0 ? '<div class="text-sm text-gray-500">No matches scheduled.</div>' : '')}</div>
                </div>
            `;
        }).join('');

        if (indicators) {
            indicators.innerHTML = rounds.map((round, index) => `
                <button
                    type="button"
                    class="round-indicator ${index === 0 ? 'is-active' : ''}"
                    aria-label="Go to round ${round}"
                    onclick="scrollToRound('${tournamentId}', ${index})"
                ></button>
            `).join('');
        }

        if (!roundsContainer.dataset.scrollListener) {
            roundsContainer.dataset.scrollListener = 'true';
            let ticking = false;
            roundsContainer.addEventListener('scroll', () => {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(() => {
                    updateRoundIndicator(tournamentId);
                    ticking = false;
                });
            });
        }

        updateRoundIndicator(tournamentId);
    } catch (error) {
        console.error('Render tournament error:', error);
        view.classList.add('hidden');
    }
}

function scrollToRound(tournamentId, index) {
    const roundsContainer = document.getElementById(`${tournamentId}-rounds-container`);
    if (!roundsContainer) return;
    const card = roundsContainer.children[index];
    if (!card) return;
    roundsContainer.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
}

function updateRoundIndicator(tournamentId) {
    const roundsContainer = document.getElementById(`${tournamentId}-rounds-container`);
    const indicators = document.getElementById(`${tournamentId}-round-indicators`);
    if (!roundsContainer || !indicators) return;
    const cards = Array.from(roundsContainer.children);
    if (!cards.length) return;

    const scrollLeft = roundsContainer.scrollLeft;
    let activeIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - scrollLeft);
        if (distance < bestDistance) {
            bestDistance = distance;
            activeIndex = index;
        }
    });

    Array.from(indicators.children).forEach((dot, index) => {
        dot.classList.toggle('is-active', index === activeIndex);
    });
}

const tournamentPollers = new Map();

function startTournamentPolling(tournamentId) {
    if (tournamentPollers.has(tournamentId)) return;
    const interval = setInterval(() => {
        renderTournamentView(tournamentId);
    }, 5000);
    tournamentPollers.set(tournamentId, interval);
}

function stopTournamentPolling(tournamentId) {
    const interval = tournamentPollers.get(tournamentId);
    if (interval) {
        clearInterval(interval);
        tournamentPollers.delete(tournamentId);
    }
}

function scoreInputHtml(tournamentId, matchId, slot, value, canEdit) {
    const val = Number.isInteger(value) ? value : '';
    const disabled = canEdit ? '' : 'disabled';
    const disabledClass = '';
    return `<input
        type="number"
        inputmode="numeric"
        class="score-input px-1 py-0.5 border border-gray-300 rounded text-right self-center ${disabledClass}"
        value="${val}"
        id="${tournamentId}-${matchId}-score${slot}"
        ${disabled}
        oninput="updateScore('${tournamentId}', '${matchId}')"
    >`;
}

let scoreSaveTimeout;
function updateScore(tournamentId, matchId) {
    clearTimeout(scoreSaveTimeout);
    scoreSaveTimeout = setTimeout(() => {
        submitScore(tournamentId, matchId);
    }, 300);
}

async function submitScore(tournamentId, matchId) {
    const input1 = document.getElementById(`${tournamentId}-${matchId}-score1`);
    const input2 = document.getElementById(`${tournamentId}-${matchId}-score2`);
    if (!input1 || !input2) return;
    const raw1 = input1.value.trim();
    const raw2 = input2.value.trim();
    if (raw1 === '' && raw2 === '') return;
    const score1 = raw1 === '' ? null : Number(raw1);
    const score2 = raw2 === '' ? null : Number(raw2);
    if (score1 !== null && !Number.isInteger(score1)) return;
    if (score2 !== null && !Number.isInteger(score2)) return;

    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const token = await auth.getAuthToken();
        const response = await fetch(`/api/tournaments/round-robin/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ matchId, score1, score2 })
        });
        if (!response.ok) {
            const error = await response.json();
            console.error('Score update error:', error);
        }
    } catch (error) {
        console.error('Score update error:', error);
    }
}

async function renderRegistrationList(tournamentId) {
    const list = document.getElementById(`${tournamentId}-registration-list`);
    const count = document.getElementById(`${tournamentId}-registration-count`);
    if (!list || !count) return;

    const tournament = TOURNAMENTS.upcoming.find(t => t.id === tournamentId);
    const doubles = tournament ? isDoublesTournament(tournament) : false;
    let teams = [];
    let maxTeams = 12;
    let status = 'registration';
    try {
        teams = await fetchRegistrations(tournamentId);
        const settings = await fetchTournamentSettings(tournamentId);
        if (settings && Number.isInteger(settings.maxTeams)) {
            maxTeams = settings.maxTeams;
        }
        if (settings && settings.status) {
            status = settings.status;
        }
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
                return `<div class="text-sm text-gray-700 leading-5 flex items-center justify-between gap-3"><span class="flex-1">${display}</span>${removeButton}</div>`;
            }).join('');

            const needsPartner = doubles && players.length === 1;
        const joinButton = needsPartner
            ? `<button onclick="joinTeam('${tournamentId}', ${index})" class="text-xs font-semibold text-ocean-blue hover:text-ocean-teal">Join</button>`
            : '';

            return `
                <div class="flex items-start justify-between py-3 border-t border-gray-300 first:border-t-0">
                    <div class="flex-1 space-y-1">${playerLines || '<div class=\"text-sm text-gray-500\">Open team</div>'}</div>
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
    const actionButtonText = document.getElementById(`${tournamentId}-registration-button-text`);
    const capacityNote = document.getElementById(`${tournamentId}-capacity-note`);
    const registrationActions = document.getElementById(`${tournamentId}-registration-actions`);
    const isFull = teams.length >= maxTeams;
    const tournamentView = document.getElementById(`${tournamentId}-tournament-view`);
    if (status === 'tournament') {
        if (actionButton) {
            actionButton.setAttribute('onclick', `toggleTournamentView('${tournamentId}')`);
            actionButton.disabled = false;
        }
        if (actionButtonText) {
            actionButtonText.textContent = 'View Tournament';
        }
        if (registrationActions) {
            registrationActions.classList.add('hidden');
        }
        const registrationHeader = document.getElementById(`${tournamentId}-registration-header`);
        if (registrationHeader) {
            registrationHeader.classList.add('hidden');
        }
        list.classList.add('hidden');
        if (tournamentView) {
            tournamentView.classList.remove('hidden');
            renderTournamentView(tournamentId);
            startTournamentPolling(tournamentId);
        }
        const adminSettings = document.getElementById(`${tournamentId}-admin-settings`);
        if (adminSettings) {
            adminSettings.remove();
        }
        const tournamentActions = document.getElementById(`${tournamentId}-tournament-actions`);
        if (tournamentActions) {
            tournamentActions.innerHTML = '';
            if (window.authProfile && window.authProfile.isAdmin) {
                const resetButton = document.createElement('button');
                resetButton.className = 'text-xs font-semibold text-white bg-ocean-blue px-3 py-1 rounded-full hover:bg-ocean-teal transition';
                resetButton.textContent = 'Return to Registration';
                resetButton.onclick = () => resetRoundRobin(tournamentId);
                tournamentActions.appendChild(resetButton);
            }
        }
        return;
    } else {
        list.classList.remove('hidden');
        if (tournamentView) {
            tournamentView.classList.add('hidden');
        }
        if (registrationActions) {
            registrationActions.classList.remove('hidden');
        }
        const registrationHeader = document.getElementById(`${tournamentId}-registration-header`);
        if (registrationHeader) {
            registrationHeader.classList.remove('hidden');
        }
        ensureAdminSettings(tournamentId);
    }

    if (actionButton) {
        if (isRegistered) {
            actionButton.textContent = 'Leave Team';
            actionButton.setAttribute('onclick', `leaveTeam('${tournamentId}')`);
            actionButton.disabled = false;
        } else {
            if (isFull && !isAdmin) {
                actionButton.textContent = 'Registration Full';
                actionButton.removeAttribute('onclick');
                actionButton.disabled = true;
            } else {
                actionButton.textContent = 'Register Team';
                actionButton.setAttribute('onclick', `registerTeam('${tournamentId}')`);
                actionButton.disabled = false;
            }
        }
    }

    if (capacityNote) {
        capacityNote.textContent = maxTeams === 6
            ? '6 team maximum'
            : `${maxTeams} team maximum`;
    }

    const adminSettings = document.getElementById(`${tournamentId}-admin-settings`);
    if (adminSettings && window.authProfile && window.authProfile.isAdmin) {
        loadAdminSettings(tournamentId);
        const hasMinTeams = teams.length >= 4;
        const allFull = teams.every(team => (team.players || []).length >= 2);
        const existingButton = document.getElementById(`${tournamentId}-start-round-robin`);
        if (!existingButton) {
            const button = document.createElement('button');
            button.id = `${tournamentId}-start-round-robin`;
            button.className = 'mt-4 w-full bg-ocean-blue text-white px-4 py-2 rounded-lg hover:bg-ocean-teal transition font-semibold';
            button.textContent = 'Start Round Robin';
            button.onclick = () => startRoundRobin(tournamentId);
            adminSettings.appendChild(button);
        }
        const startButton = document.getElementById(`${tournamentId}-start-round-robin`);
        if (startButton) {
            startButton.disabled = !(hasMinTeams && allFull);
            startButton.classList.toggle('opacity-50', startButton.disabled);
            startButton.classList.toggle('cursor-not-allowed', startButton.disabled);
        }
    }
}

function toggleTournamentView(tournamentId) {
    const view = document.getElementById(`${tournamentId}-tournament-view`);
    const list = document.getElementById(`${tournamentId}-registration-list`);
    const buttonText = document.getElementById(`${tournamentId}-registration-button-text`);
    if (!view || !list || !buttonText) return;
    if (view.classList.contains('hidden')) {
        view.classList.remove('hidden');
        list.classList.add('hidden');
        buttonText.textContent = 'Hide Tournament';
        renderTournamentView(tournamentId);
        startTournamentPolling(tournamentId);
    } else {
        view.classList.add('hidden');
        list.classList.remove('hidden');
        buttonText.textContent = 'View Tournament';
        stopTournamentPolling(tournamentId);
    }
}

async function refreshTournamentButtons() {
    const tournaments = TOURNAMENTS.upcoming || [];
    for (const tournament of tournaments) {
        try {
            const settings = await fetchTournamentSettings(tournament.id);
            if (settings.status === 'tournament') {
                const buttonText = document.getElementById(`${tournament.id}-registration-button-text`);
                if (buttonText) {
                    buttonText.textContent = 'View Tournament';
                }
            }
        } catch (error) {
            // ignore
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
    refreshTournamentButtons();
    if (window.authUtils && window.authUtils.loadAuthProfile && window.authUtils.ready) {
        window.authUtils.ready().then(() => {
            return window.authUtils.loadAuthProfile();
        }).then(() => {
            const openPanels = document.querySelectorAll('[id$="-registration"]:not(.hidden)');
            openPanels.forEach(panel => {
                const tournamentId = panel.id.replace('-registration', '');
                renderRegistrationList(tournamentId);
            });
        }).catch(() => {});
    }
    
    // Check status every minute
    setInterval(checkTournamentStatus, 60000);
});

window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushSettingsSaves();
    }
});

window.addEventListener('beforeunload', () => {
    flushSettingsSaves();
});

window.addEventListener('auth:changed', () => {
    const openPanels = document.querySelectorAll('[id$="-registration"]:not(.hidden)');
    openPanels.forEach(panel => {
        const tournamentId = panel.id.replace('-registration', '');
        renderRegistrationList(tournamentId);
    });
});
