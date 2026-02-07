// ========================================
// DYNAMIC TOURNAMENT RENDERING
// This script renders tournaments from the DB-backed /api/tournaments endpoint
// ========================================

let tournamentStore = {
    upcoming: [],
    results: []
};

let duprMatchHistoryState = {
    matches: [],
    eligiblePlayers: [],
    createOpen: false,
    editId: null
};

const LEGACY_RESULTS_DATA = {
    jan24: {
        matches: [
            { round: 'QUARTERFINAL 1', team1: 'Joey/Joe C', team1Score: '11', team2: 'Aaron/Connor', team2Score: '7' },
            { round: 'QUARTERFINAL 2', team1: 'Carl/Ralph', team1Score: '11', team2: 'Scott/Karolina', team2Score: '7' },
            { round: 'QUARTERFINAL 3', team1: 'Dan/Rob', team1Score: '6', team2: 'Charlie/Nolan', team2Score: '11' },
            { round: 'QUARTERFINAL 4', team1: 'Charlie/Britt', team1Score: '5', team2: 'Sonu/Josh', team2Score: '11' },
            { round: 'SEMIFINAL 1', team1: 'Joey/Joe C', team1Score: '9', team2: 'Carl/Ralph', team2Score: '11' },
            { round: 'SEMIFINAL 2', team1: 'Charlie/Nolan', team1Score: '7', team2: 'Sonu/Josh', team2Score: '11' },
            { round: 'GOLD', team1: 'Ralph/Carl', team1Score: '9', team2: 'Sonu/Josh', team2Score: '15' },
            { round: 'BRONZE', team1: 'Joey/Joe C', team1Score: '8', team2: 'Charlie/Nolan', team2Score: '15' }
        ]
    }
};

async function loadTournaments() {
    const response = await fetch('/api/tournaments');
    if (!response.ok) {
        throw new Error('Failed to load tournaments');
    }
    const data = await response.json();
    tournamentStore = {
        upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
        results: Array.isArray(data.results) ? data.results : []
    };
}

function getUpcomingTournaments() {
    return tournamentStore.upcoming || [];
}

function getResultsTournaments() {
    return tournamentStore.results || [];
}

function findUpcomingTournament(tournamentId) {
    return getUpcomingTournaments().find(tournament => tournament.id === tournamentId) || null;
}

function formatTimeLabel(timeEt) {
    if (!timeEt || !/^\d{2}:\d{2}$/.test(timeEt)) return null;
    const [hoursRaw, minutesRaw] = timeEt.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const h12 = (hours % 12) || 12;
    return `${h12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDateLabel(startDate) {
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
    const [yearRaw, monthRaw, dayRaw] = startDate.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(dt.getTime())) return null;
    const monthLabel = dt.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${monthLabel} ${day}`;
}

function formatLongDateLabel(startDate) {
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
    const [yearRaw, monthRaw, dayRaw] = startDate.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(dt.getTime())) return null;
    const monthLabel = dt.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    return `${monthLabel} ${day}, ${year}`;
}

function formatResultsDateLocation(startDate, location) {
    const dateText = formatLongDateLabel(startDate) || 'Date TBD';
    const locationText = (location || 'Location TBD').trim();
    return `${dateText} @ ${locationText}`;
}

function formatStartLine(startDate, startTimeEt, fallback) {
    const time = formatTimeLabel(startTimeEt);
    const date = formatDateLabel(startDate);
    if (time && date) return `${time} - ${date}`;
    if (time && !date) return `${time} - Date TBD`;
    return fallback || 'Date TBD';
}

function formatFormatType(formatType) {
    return formatType === 'mixed_doubles' ? 'Mixed Doubles' : 'Coed Doubles';
}

function formatSkillText(skillCap) {
    if (skillCap === null || skillCap === undefined || Number.isNaN(Number(skillCap))) {
        return 'DUPR ??.?? and below';
    }
    return `DUPR ${Number(skillCap).toFixed(2)} and below`;
}

function formatEntryFeeText(entryFeeAmount) {
    if (entryFeeAmount === null || entryFeeAmount === undefined || Number.isNaN(Number(entryFeeAmount))) {
        return '$0 per player';
    }
    const amount = Number(entryFeeAmount);
    const pretty = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    return `$${pretty} per player`;
}

function shouldShowResultsDuprBadge(tournament) {
    if (!tournament) return false;
    if (tournament.duprRequired === true) return true;
    if (tournament.id === 'jan10') return true;
    if (tournament.startDate === '2026-01-10' || tournament.startDate === '2026-01-24') return true;
    return false;
}

// ========================================
// RENDER UPCOMING TOURNAMENTS
// ========================================

function renderUpcomingTournaments() {
    const container = document.getElementById('tournaments-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear existing content
    
    const tournaments = getUpcomingTournaments();
    if (!tournaments.length) {
        container.innerHTML = '<p class="text-sm text-gray-500">No upcoming tournaments yet.</p>';
        requestAnimationFrame(updateTournamentsCarouselArrows);
        return;
    }

    tournaments.forEach(tournament => {
        const card = createTournamentCard(tournament, 'upcoming');
        container.appendChild(card);
    });
    requestAnimationFrame(updateTournamentsCarouselArrows);
}

function scrollTournamentsCarousel(direction) {
    const container = document.getElementById('tournaments-container');
    if (!container) return;
    const delta = Math.max(container.clientWidth * 0.82, 280);
    const left = direction === 'left' ? -delta : delta;
    container.scrollBy({ left, behavior: 'smooth' });
}

function updateTournamentsCarouselArrows() {
    const container = document.getElementById('tournaments-container');
    const leftButtons = [
        document.getElementById('tournaments-scroll-left'),
        document.getElementById('tournaments-scroll-left-mobile')
    ].filter(Boolean);
    const rightButtons = [
        document.getElementById('tournaments-scroll-right'),
        document.getElementById('tournaments-scroll-right-mobile')
    ].filter(Boolean);
    if (!container || leftButtons.length === 0 || rightButtons.length === 0) return;

    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const current = container.scrollLeft;
    const edgeTolerance = 2;
    const hasOverflow = maxLeft > edgeTolerance;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const cardCount = container.querySelectorAll('.tournament-card').length;
    const shouldCenter = isDesktop && cardCount > 0 && cardCount <= 2;

    const disableLeft = current <= edgeTolerance;
    const disableRight = current >= (maxLeft - edgeTolerance);

    container.classList.toggle('tournaments-centered', shouldCenter || (!hasOverflow && isDesktop));

    leftButtons.forEach(button => {
        button.disabled = disableLeft;
    });
    rightButtons.forEach(button => {
        button.disabled = disableRight;
    });
}

function ensureTournamentsCarouselBindings() {
    const container = document.getElementById('tournaments-container');
    if (!container || container.dataset.arrowBindings === 'true') return;

    container.dataset.arrowBindings = 'true';
    container.addEventListener('scroll', updateTournamentsCarouselArrows, { passive: true });
    window.addEventListener('resize', updateTournamentsCarouselArrows);
}

// ========================================
// RENDER RESULTS
// ========================================

function renderResults() {
    const container = document.getElementById('results-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear existing content
    
    const tournaments = [...getResultsTournaments()].sort((a, b) => {
        const timeA = Date.parse(`${a.startDate || ''}T00:00:00Z`);
        const timeB = Date.parse(`${b.startDate || ''}T00:00:00Z`);
        const hasA = Number.isFinite(timeA);
        const hasB = Number.isFinite(timeB);

        // Newest dated results first (left-most card).
        if (hasA && hasB && timeA !== timeB) return timeB - timeA;
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;

        // Stable fallback when dates are unavailable or identical.
        const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.id || '').localeCompare(String(b.id || ''));
    });
    cleanupResultsViewStateStorage(tournaments);
    if (!tournaments.length) {
        container.innerHTML = '<p class="text-sm text-gray-500">No completed results yet.</p>';
        requestAnimationFrame(updateResultsCarouselArrows);
        return;
    }

    tournaments.forEach(tournament => {
        const card = createTournamentCard(tournament, 'results');
        container.appendChild(card);
    });
    requestAnimationFrame(updateResultsCarouselArrows);
}

function scrollResultsCarousel(direction) {
    const container = document.getElementById('results-container');
    if (!container) return;
    const delta = Math.max(container.clientWidth * 0.82, 280);
    const left = direction === 'left' ? -delta : delta;
    container.scrollBy({ left, behavior: 'smooth' });
}

function updateResultsCarouselArrows() {
    const container = document.getElementById('results-container');
    const leftButtons = [
        document.getElementById('results-scroll-left'),
        document.getElementById('results-scroll-left-mobile')
    ].filter(Boolean);
    const rightButtons = [
        document.getElementById('results-scroll-right'),
        document.getElementById('results-scroll-right-mobile')
    ].filter(Boolean);
    if (!container || leftButtons.length === 0 || rightButtons.length === 0) return;

    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const current = container.scrollLeft;
    const edgeTolerance = 2;
    const hasOverflow = maxLeft > edgeTolerance;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const cardCount = container.querySelectorAll('.tournament-card').length;
    const shouldCenter = isDesktop && cardCount > 0 && cardCount <= 2;

    const disableLeft = current <= edgeTolerance;
    const disableRight = current >= (maxLeft - edgeTolerance);

    // Prefer predictable desktop centering for small result sets.
    container.classList.toggle('results-centered', shouldCenter || (!hasOverflow && isDesktop));

    leftButtons.forEach(button => {
        button.disabled = disableLeft;
    });
    rightButtons.forEach(button => {
        button.disabled = disableRight;
    });
}

function ensureResultsCarouselBindings() {
    const container = document.getElementById('results-container');
    if (!container || container.dataset.arrowBindings === 'true') return;

    container.dataset.arrowBindings = 'true';
    container.addEventListener('scroll', updateResultsCarouselArrows, { passive: true });
    window.addEventListener('resize', updateResultsCarouselArrows);
}

window.scrollResultsCarousel = scrollResultsCarousel;
window.scrollTournamentsCarousel = scrollTournamentsCarousel;

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
                <h3 id="${tournament.id}-title" class="text-2xl font-bold mb-2">${tournament.title}</h3>
                <p id="${tournament.id}-start-line" class="text-gray-200">${tournament.startTime} @ ${tournament.location}</p>
                <div id="${tournament.id}-dupr-badge" class="dupr-badge hidden">
                    <img src="/dupr-logo.png?v=20260206" alt="DUPR" loading="lazy" />
                </div>
            </div>
            <div class="card-body">
                <div id="${tournament.id}-details-display" class="space-y-3 mb-6">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Format:</span>
                        <span id="${tournament.id}-format-line" class="font-semibold">${tournament.format}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Skill Level:</span>
                        <span id="${tournament.id}-skill-line" class="font-semibold">${tournament.skillLevel}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Entry Fee:</span>
                        <span id="${tournament.id}-fee-line" class="font-semibold text-ocean-blue">${tournament.entryFee}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Prize Split:</span>
                        <span id="${tournament.id}-prize-line" class="font-semibold">${tournament.prizeSplit}</span>
                    </div>
                </div>
                <div id="${tournament.id}-details-editor" class="hidden border border-gray-200 rounded-lg bg-white p-4 space-y-3 mb-6">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Tournament title</label>
                        <input id="${tournament.id}-edit-title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.title}">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Date (ET)</label>
                            <input id="${tournament.id}-edit-date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.startDate || ''}">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Time (ET)</label>
                            <input id="${tournament.id}-edit-time" type="time" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.startTimeEt || ''}">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Location</label>
                        <input id="${tournament.id}-edit-location" type="text" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.location || ''}">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Format</label>
                            <select id="${tournament.id}-edit-format" class="w-full px-3 py-2 border border-gray-300 rounded">
                                <option value="coed_doubles" ${tournament.formatType !== 'mixed_doubles' ? 'selected' : ''}>Coed Doubles</option>
                                <option value="mixed_doubles" ${tournament.formatType === 'mixed_doubles' ? 'selected' : ''}>Mixed Doubles</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Skill cap</label>
                            <input id="${tournament.id}-edit-skill" type="number" min="0" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded" value="${Number.isFinite(tournament.skillLevelCap) ? tournament.skillLevelCap : ''}">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Entry fee (per player)</label>
                        <input id="${tournament.id}-edit-fee" type="number" min="0" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded" value="${Number.isFinite(tournament.entryFeeAmount) ? tournament.entryFeeAmount : ''}">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Prize split</label>
                        <input id="${tournament.id}-edit-prize" type="text" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.prizeSplit || ''}">
                    </div>
                    <div class="flex items-center gap-2 pt-1">
                        <button onclick="saveTournamentDetails('${tournament.id}')" class="bg-ocean-blue text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-ocean-teal transition">Save Details</button>
                        <button onclick="toggleTournamentDetailsEditor('${tournament.id}', false)" class="bg-white border border-gray-300 text-ocean-blue px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition">Cancel</button>
                    </div>
                </div>
                <div class="hidden mb-4 ml-auto w-fit items-center gap-2" id="${tournament.id}-admin-edit-actions">
                    <button
                        id="${tournament.id}-copy-details-button"
                        onclick="copyTournament('${tournament.id}')"
                        class="bg-white border border-ocean-blue text-ocean-blue hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        Copy
                    </button>
                    <button
                        id="${tournament.id}-delete-details-button"
                        onclick="deleteUpcomingTournament('${tournament.id}')"
                        class="bg-white border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        Delete
                    </button>
                    <button
                        id="${tournament.id}-edit-details-button"
                        onclick="toggleTournamentDetailsEditor('${tournament.id}')"
                        class="bg-white border border-ocean-blue text-ocean-blue hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        Edit Details
                    </button>
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
                            <div>
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-sm font-medium text-gray-700">DUPR reported</span>
                                        <span class="text-xs text-gray-500" id="${tournament.id}-dupr-required-value">On</span>
                                    </div>
                                    <button
                                        type="button"
                                        id="${tournament.id}-dupr-required"
                                        data-enabled="true"
                                        onclick="toggleDuprRequired('${tournament.id}')"
                                        class="w-full text-center font-semibold py-2 rounded-lg border border-ocean-blue bg-white text-ocean-blue hover:bg-ocean-blue hover:text-white transition"
                                    >
                                        DUPR reported (On)
                                    </button>
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
                            Register as Team
                        </button>
                        <p class="text-xs text-gray-500 mt-2 text-center" id="${tournament.id}-capacity-note">No capacity limit for now.</p>
                    </div>
                    <div id="${tournament.id}-tournament-view" class="hidden tournament-view-block">
                        <div class="flex items-center justify-between mb-4">
                            <h4 class="text-xl font-bold text-ocean-blue" id="${tournament.id}-tournament-title">Round Robin</h4>
                            <div id="${tournament.id}-tournament-actions" class="flex items-center gap-2"></div>
                        </div>
                        <div id="${tournament.id}-rounds-container" class="rounds-scroll flex gap-2 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"></div>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'results') {
        const showDuprBadge = shouldShowResultsDuprBadge(tournament);
        card.className = `tournament-card ${themeClass}`;
        card.innerHTML = `
            <div class="card-header">
                <h3 id="${tournament.id}-results-title" class="text-2xl font-bold mb-2">${tournament.title}</h3>
                <p id="${tournament.id}-results-location" class="text-gray-200">${formatResultsDateLocation(tournament.startDate, tournament.location)}</p>
                <div id="${tournament.id}-results-dupr-badge" class="dupr-badge ${showDuprBadge ? '' : 'hidden'}">
                    <img src="/dupr-logo.png?v=20260206" alt="DUPR" loading="lazy" />
                </div>
            </div>
            <div class="card-body">
                <div id="${tournament.id}-results-details-display" class="space-y-3 mb-6">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Format:</span>
                        <span id="${tournament.id}-results-format" class="font-semibold">${tournament.format}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Skill Level:</span>
                        <span id="${tournament.id}-results-skill" class="font-semibold">${tournament.skillLevel}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Entry Fee:</span>
                        <span id="${tournament.id}-results-fee" class="font-semibold text-ocean-blue">${tournament.entryFee}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Prize Split:</span>
                        <span id="${tournament.id}-results-prize" class="font-semibold">${tournament.prizeSplit}</span>
                    </div>
                </div>
                <div id="${tournament.id}-results-details-editor" class="hidden border border-gray-200 rounded-lg bg-white p-4 space-y-3 mb-4">
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Tournament title</label>
                        <input id="${tournament.id}-results-edit-title" type="text" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.title}">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Date (ET)</label>
                            <input id="${tournament.id}-results-edit-date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.startDate || ''}">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Time (ET)</label>
                            <input id="${tournament.id}-results-edit-time" type="time" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.startTimeEt || ''}">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Location</label>
                        <input id="${tournament.id}-results-edit-location" type="text" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.location || ''}">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Format</label>
                            <select id="${tournament.id}-results-edit-format" class="w-full px-3 py-2 border border-gray-300 rounded">
                                <option value="coed_doubles" ${tournament.formatType !== 'mixed_doubles' ? 'selected' : ''}>Coed Doubles</option>
                                <option value="mixed_doubles" ${tournament.formatType === 'mixed_doubles' ? 'selected' : ''}>Mixed Doubles</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Skill cap</label>
                            <input id="${tournament.id}-results-edit-skill" type="number" min="0" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded" value="${Number.isFinite(tournament.skillLevelCap) ? tournament.skillLevelCap : ''}">
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Entry fee (per player)</label>
                            <input id="${tournament.id}-results-edit-fee" type="number" min="0" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded" value="${Number.isFinite(tournament.entryFeeAmount) ? tournament.entryFeeAmount : ''}">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 mb-1">Prize split</label>
                            <input id="${tournament.id}-results-edit-prize" type="text" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.prizeSplit || ''}">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 mb-1">Photo path</label>
                        <input id="${tournament.id}-results-edit-photo" type="text" class="w-full px-3 py-2 border border-gray-300 rounded" value="${tournament.photoUrl || ''}" placeholder="photos/winners-xxxx.jpg">
                    </div>
                    <div class="flex items-center gap-2 pt-1">
                        <button onclick="saveResultsDetails('${tournament.id}')" class="bg-ocean-blue text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-ocean-teal transition">Save Details</button>
                        <button onclick="toggleResultsDetailsEditor('${tournament.id}', false)" class="bg-white border border-gray-300 text-ocean-blue px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition">Cancel</button>
                    </div>
                </div>
                <div id="${tournament.id}-results-admin-actions" class="hidden mb-3 flex items-center justify-end gap-2">
                    <button
                        onclick="archiveResultsCard('${tournament.id}')"
                        class="bg-white border border-ocean-blue text-ocean-blue hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        Archive
                    </button>
                    <button
                        onclick="deleteTournamentCard('${tournament.id}')"
                        id="${tournament.id}-results-delete-button"
                        class="bg-white border border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        Delete
                    </button>
                    <button
                        id="${tournament.id}-results-edit-details-button"
                        onclick="toggleResultsDetailsEditor('${tournament.id}')"
                        class="bg-white border border-ocean-blue text-ocean-blue hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        Edit Details
                    </button>
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
                <div id="${tournament.id}-results-summary">
                    <!-- Winner Photo -->
                    <div id="${tournament.id}-photo-wrap" class="p-6 pb-0 bg-gray-50 ${tournament.photoUrl ? '' : 'hidden'}">
                        <h4 class="text-xl font-bold text-ocean-blue mb-4 text-center">🏆 Champions</h4>
                        <div class="text-center mb-0">
                            <img 
                                id="${tournament.id}-photo" 
                                src="${tournament.photoUrl || ''}" 
                                alt="Tournament Champions" 
                                class="mx-auto rounded-lg shadow-lg max-w-full h-auto"
                                style="max-height: 400px; display: block;"
                            >
                        </div>
                    </div>
                    
                    <!-- Bracket -->
                    <div class="p-6 pb-0">
                        <h4 class="text-xl font-bold text-ocean-blue mb-2">Playoff Bracket</h4>
                        <div id="${tournament.id}-bracket" class="bracket-container">
                            <!-- Bracket loads here -->
                        </div>
                    </div>
                    <div id="${tournament.id}-full-results-action" class="p-6 pt-2">
                        <button
                            onclick="showFullResults('${tournament.id}', 'roundRobin')"
                            class="block w-full text-center font-semibold py-3 rounded-lg transition ${btnClass}"
                        >
                            View Full Results
                        </button>
                    </div>
                </div>

                <div id="${tournament.id}-results-full" class="hidden p-6 space-y-2">
                    <div class="flex items-center justify-center gap-2 mb-6">
                        <button
                            id="${tournament.id}-full-round-robin-button"
                            onclick="showFullResults('${tournament.id}', 'roundRobin')"
                            class="bg-ocean-blue text-white px-3 py-2 rounded-lg text-sm font-semibold transition"
                        >
                            Round Robin
                        </button>
                        <button
                            id="${tournament.id}-full-playoff-button"
                            onclick="showFullResults('${tournament.id}', 'playoff')"
                            class="bg-white border border-ocean-blue text-ocean-blue hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-semibold transition"
                        >
                            Playoff
                        </button>
                    </div>
                    <div id="${tournament.id}-tournament-view" class="tournament-view-block">
                        <div id="${tournament.id}-rounds-container" class="rounds-scroll flex gap-2 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"></div>
                    </div>
                    <button
                        onclick="showResultsSummary('${tournament.id}')"
                        class="block w-full text-center font-semibold py-3 rounded-lg transition ${btnClass}"
                    >
                        View Results Summary
                    </button>
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
    
    getUpcomingTournaments().forEach(tournament => {
        const card = document.getElementById(tournament.id);
        if (!card) return;
        
        const liveLink = document.getElementById(`${tournament.id}-live-link`);

        const liveStart = tournament.liveStart ? new Date(tournament.liveStart) : null;
        const liveEnd = tournament.liveEnd ? new Date(tournament.liveEnd) : null;
        const hasLiveWindow = liveStart instanceof Date && !Number.isNaN(liveStart.getTime())
            && liveEnd instanceof Date && !Number.isNaN(liveEnd.getTime());

        // Check if tournament is live
        if (hasLiveWindow && now >= liveStart && now <= liveEnd) {
            if (liveLink) {
                liveLink.classList.remove('hidden');
            }
        } else if (hasLiveWindow && now > liveEnd) {
            // Tournament is over - hide the card
            card.style.display = 'none';
        } else {
            if (liveLink) {
                liveLink.classList.add('hidden');
            }
        }
    });
}

function refreshAdminDetailEditors() {
    const isAdmin = Boolean(window.authProfile && window.authProfile.isAdmin);
    const isMasterAdmin = Boolean(window.authProfile && window.authProfile.isMasterAdmin);
    getUpcomingTournaments().forEach(tournament => {
        const actionRow = document.getElementById(`${tournament.id}-admin-edit-actions`);
        if (!actionRow) return;
        const deleteButton = document.getElementById(`${tournament.id}-delete-details-button`);
        if (isAdmin) {
            actionRow.classList.remove('hidden');
            actionRow.classList.add('flex');
            if (deleteButton) {
                deleteButton.classList.toggle('hidden', !isMasterAdmin);
            }
        } else {
            actionRow.classList.add('hidden');
            actionRow.classList.remove('flex');
            toggleTournamentDetailsEditor(tournament.id, false);
        }
    });

    getResultsTournaments().forEach(tournament => {
        const resultsActions = document.getElementById(`${tournament.id}-results-admin-actions`);
        if (!resultsActions) return;
        if (isMasterAdmin) {
            resultsActions.classList.remove('hidden');
            resultsActions.classList.add('flex');
        } else {
            resultsActions.classList.add('hidden');
            resultsActions.classList.remove('flex');
            toggleResultsDetailsEditor(tournament.id, false);
        }
    });
}

function updateTournamentInStore(updatedTournament) {
    if (!updatedTournament || !updatedTournament.id) return;
    tournamentStore.upcoming = getUpcomingTournaments().map(tournament => (
        tournament.id === updatedTournament.id ? { ...tournament, ...updatedTournament } : tournament
    ));
    tournamentStore.results = getResultsTournaments().map(tournament => (
        tournament.id === updatedTournament.id ? { ...tournament, ...updatedTournament } : tournament
    ));
}

function updateTournamentCardDisplay(tournament) {
    const titleEl = document.getElementById(`${tournament.id}-title`);
    const startLineEl = document.getElementById(`${tournament.id}-start-line`);
    const formatEl = document.getElementById(`${tournament.id}-format-line`);
    const skillEl = document.getElementById(`${tournament.id}-skill-line`);
    const feeEl = document.getElementById(`${tournament.id}-fee-line`);
    const prizeEl = document.getElementById(`${tournament.id}-prize-line`);

    if (titleEl) titleEl.textContent = tournament.title;
    if (startLineEl) {
        const startLine = formatStartLine(tournament.startDate, tournament.startTimeEt, tournament.startTime);
        startLineEl.textContent = `${startLine} @ ${tournament.location}`;
    }
    if (formatEl) formatEl.textContent = formatFormatType(tournament.formatType);
    if (skillEl) skillEl.textContent = formatSkillText(tournament.skillLevelCap);
    if (feeEl) feeEl.textContent = formatEntryFeeText(tournament.entryFeeAmount);
    if (prizeEl) prizeEl.textContent = tournament.prizeSplit || '50% - 30% - 20%';
}

function findResultsTournament(tournamentId) {
    return getResultsTournaments().find(tournament => tournament.id === tournamentId) || null;
}

function updateResultsCardDisplay(tournament) {
    const titleEl = document.getElementById(`${tournament.id}-results-title`);
    const locationEl = document.getElementById(`${tournament.id}-results-location`);
    const formatEl = document.getElementById(`${tournament.id}-results-format`);
    const skillEl = document.getElementById(`${tournament.id}-results-skill`);
    const feeEl = document.getElementById(`${tournament.id}-results-fee`);
    const prizeEl = document.getElementById(`${tournament.id}-results-prize`);
    const photoWrap = document.getElementById(`${tournament.id}-photo-wrap`);
    const photoEl = document.getElementById(`${tournament.id}-photo`);
    const duprBadge = document.getElementById(`${tournament.id}-results-dupr-badge`);

    if (titleEl) titleEl.textContent = tournament.title;
    if (locationEl) locationEl.textContent = formatResultsDateLocation(tournament.startDate, tournament.location);
    if (formatEl) formatEl.textContent = formatFormatType(tournament.formatType);
    if (skillEl) skillEl.textContent = formatSkillText(tournament.skillLevelCap);
    if (feeEl) feeEl.textContent = formatEntryFeeText(tournament.entryFeeAmount);
    if (prizeEl) prizeEl.textContent = tournament.prizeSplit || '50% - 30% - 20%';
    if (photoWrap) {
        if (tournament.photoUrl) photoWrap.classList.remove('hidden');
        else photoWrap.classList.add('hidden');
    }
    if (photoEl && tournament.photoUrl) {
        photoEl.src = tournament.photoUrl;
    }
    if (duprBadge) {
        duprBadge.classList.toggle('hidden', !shouldShowResultsDuprBadge(tournament));
    }
}

function toggleResultsDetailsEditor(tournamentId, forceOpen = null) {
    const display = document.getElementById(`${tournamentId}-results-details-display`);
    const editor = document.getElementById(`${tournamentId}-results-details-editor`);
    const button = document.getElementById(`${tournamentId}-results-edit-details-button`);
    const tournament = findResultsTournament(tournamentId);
    if (!display || !editor || !button || !tournament) return;
    if (!(window.authProfile && window.authProfile.isAdmin)) return;

    const shouldOpen = forceOpen === null ? editor.classList.contains('hidden') : Boolean(forceOpen);
    if (shouldOpen) {
        const titleInput = document.getElementById(`${tournamentId}-results-edit-title`);
        const dateInput = document.getElementById(`${tournamentId}-results-edit-date`);
        const timeInput = document.getElementById(`${tournamentId}-results-edit-time`);
        const locationInput = document.getElementById(`${tournamentId}-results-edit-location`);
        const formatInput = document.getElementById(`${tournamentId}-results-edit-format`);
        const skillInput = document.getElementById(`${tournamentId}-results-edit-skill`);
        const feeInput = document.getElementById(`${tournamentId}-results-edit-fee`);
        const prizeInput = document.getElementById(`${tournamentId}-results-edit-prize`);
        const photoInput = document.getElementById(`${tournamentId}-results-edit-photo`);
        if (titleInput) titleInput.value = tournament.title || '';
        if (dateInput) dateInput.value = tournament.startDate || '';
        if (timeInput) timeInput.value = tournament.startTimeEt || '';
        if (locationInput) locationInput.value = tournament.location || '';
        if (formatInput) formatInput.value = tournament.formatType === 'mixed_doubles' ? 'mixed_doubles' : 'coed_doubles';
        if (skillInput) skillInput.value = Number.isFinite(tournament.skillLevelCap) ? tournament.skillLevelCap : '';
        if (feeInput) feeInput.value = Number.isFinite(tournament.entryFeeAmount) ? tournament.entryFeeAmount : '';
        if (prizeInput) prizeInput.value = tournament.prizeSplit || '';
        if (photoInput) photoInput.value = tournament.photoUrl || '';
        editor.classList.remove('hidden');
        display.classList.add('hidden');
        button.textContent = 'Close Editor';
        return;
    }

    editor.classList.add('hidden');
    display.classList.remove('hidden');
    button.textContent = 'Edit Details';
}

async function saveResultsDetails(tournamentId) {
    if (!(window.authProfile && window.authProfile.isAdmin)) return;
    const tournament = findResultsTournament(tournamentId);
    if (!tournament) return;

    const titleInput = document.getElementById(`${tournamentId}-results-edit-title`);
    const dateInput = document.getElementById(`${tournamentId}-results-edit-date`);
    const timeInput = document.getElementById(`${tournamentId}-results-edit-time`);
    const locationInput = document.getElementById(`${tournamentId}-results-edit-location`);
    const formatInput = document.getElementById(`${tournamentId}-results-edit-format`);
    const skillInput = document.getElementById(`${tournamentId}-results-edit-skill`);
    const feeInput = document.getElementById(`${tournamentId}-results-edit-fee`);
    const prizeInput = document.getElementById(`${tournamentId}-results-edit-prize`);
    const photoInput = document.getElementById(`${tournamentId}-results-edit-photo`);
    if (!titleInput || !dateInput || !timeInput || !locationInput || !formatInput || !skillInput || !feeInput || !prizeInput || !photoInput) {
        return;
    }

    const payload = {
        title: titleInput.value.trim(),
        startDate: dateInput.value || null,
        startTimeEt: timeInput.value || null,
        location: locationInput.value.trim(),
        formatType: formatInput.value === 'mixed_doubles' ? 'mixed_doubles' : 'coed_doubles',
        skillLevelCap: skillInput.value === '' ? null : Number(skillInput.value),
        entryFeeAmount: feeInput.value === '' ? null : Number(feeInput.value),
        prizeSplit: prizeInput.value.trim(),
        photoUrl: photoInput.value.trim()
    };

    const button = document.getElementById(`${tournamentId}-results-edit-details-button`);
    if (button) {
        button.disabled = true;
        button.textContent = 'Saving...';
    }

    try {
        const token = await window.authUtils.getAuthToken();
        const response = await fetch(`/api/tournaments/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Failed to save details.');
            return;
        }
        if (data.tournament) {
            updateTournamentInStore(data.tournament);
            updateResultsCardDisplay(data.tournament);
        }
        toggleResultsDetailsEditor(tournamentId, false);
    } catch (error) {
        console.error('Save results details error:', error);
        alert('Failed to save details.');
    } finally {
        if (button) {
            button.disabled = false;
            const editor = document.getElementById(`${tournamentId}-results-details-editor`);
            button.textContent = editor && !editor.classList.contains('hidden')
                ? 'Close Editor'
                : 'Edit Details';
        }
    }
}

function toggleTournamentDetailsEditor(tournamentId, forceOpen = null) {
    const display = document.getElementById(`${tournamentId}-details-display`);
    const editor = document.getElementById(`${tournamentId}-details-editor`);
    const button = document.getElementById(`${tournamentId}-edit-details-button`);
    const tournament = findUpcomingTournament(tournamentId);
    if (!display || !editor || !button || !tournament) return;
    if (!(window.authProfile && window.authProfile.isAdmin)) return;

    const shouldOpen = forceOpen === null ? editor.classList.contains('hidden') : Boolean(forceOpen);
    if (shouldOpen) {
        const titleInput = document.getElementById(`${tournamentId}-edit-title`);
        const dateInput = document.getElementById(`${tournamentId}-edit-date`);
        const timeInput = document.getElementById(`${tournamentId}-edit-time`);
        const locationInput = document.getElementById(`${tournamentId}-edit-location`);
        const formatInput = document.getElementById(`${tournamentId}-edit-format`);
        const skillInput = document.getElementById(`${tournamentId}-edit-skill`);
        const feeInput = document.getElementById(`${tournamentId}-edit-fee`);
        const prizeInput = document.getElementById(`${tournamentId}-edit-prize`);
        if (titleInput) titleInput.value = tournament.title || '';
        if (dateInput) dateInput.value = tournament.startDate || '';
        if (timeInput) timeInput.value = tournament.startTimeEt || '';
        if (locationInput) locationInput.value = tournament.location || '';
        if (formatInput) formatInput.value = tournament.formatType === 'mixed_doubles' ? 'mixed_doubles' : 'coed_doubles';
        if (skillInput) skillInput.value = Number.isFinite(tournament.skillLevelCap) ? tournament.skillLevelCap : '';
        if (feeInput) feeInput.value = Number.isFinite(tournament.entryFeeAmount) ? tournament.entryFeeAmount : '';
        if (prizeInput) prizeInput.value = tournament.prizeSplit || '';
        editor.classList.remove('hidden');
        display.classList.add('hidden');
        button.textContent = 'Close Editor';
        return;
    }

    editor.classList.add('hidden');
    display.classList.remove('hidden');
    button.textContent = 'Edit Details';
}

async function saveTournamentDetails(tournamentId) {
    if (!(window.authProfile && window.authProfile.isAdmin)) return;
    const tournament = findUpcomingTournament(tournamentId);
    if (!tournament) return;

    const titleInput = document.getElementById(`${tournamentId}-edit-title`);
    const dateInput = document.getElementById(`${tournamentId}-edit-date`);
    const timeInput = document.getElementById(`${tournamentId}-edit-time`);
    const locationInput = document.getElementById(`${tournamentId}-edit-location`);
    const formatInput = document.getElementById(`${tournamentId}-edit-format`);
    const skillInput = document.getElementById(`${tournamentId}-edit-skill`);
    const feeInput = document.getElementById(`${tournamentId}-edit-fee`);
    const prizeInput = document.getElementById(`${tournamentId}-edit-prize`);
    if (!titleInput || !dateInput || !timeInput || !locationInput || !formatInput || !skillInput || !feeInput || !prizeInput) {
        return;
    }

    const payload = {
        title: titleInput.value.trim(),
        startDate: dateInput.value || null,
        startTimeEt: timeInput.value || null,
        location: locationInput.value.trim(),
        formatType: formatInput.value === 'mixed_doubles' ? 'mixed_doubles' : 'coed_doubles',
        skillLevelCap: skillInput.value === '' ? null : Number(skillInput.value),
        entryFeeAmount: feeInput.value === '' ? null : Number(feeInput.value),
        prizeSplit: prizeInput.value.trim()
    };

    const button = document.getElementById(`${tournamentId}-edit-details-button`);
    if (button) {
        button.disabled = true;
        button.textContent = 'Saving...';
    }

    try {
        const token = await window.authUtils.getAuthToken();
        const response = await fetch(`/api/tournaments/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Failed to save tournament details.');
            return;
        }
        if (data.tournament) {
            updateTournamentInStore(data.tournament);
            updateTournamentCardDisplay(data.tournament);
        }
        toggleTournamentDetailsEditor(tournamentId, false);
    } catch (error) {
        console.error('Save tournament details error:', error);
        alert('Failed to save tournament details.');
    } finally {
        if (button) {
            button.disabled = false;
            const editor = document.getElementById(`${tournamentId}-details-editor`);
            button.textContent = editor && !editor.classList.contains('hidden')
                ? 'Close Editor'
                : 'Edit Details';
        }
    }
}

async function copyTournament(tournamentId) {
    if (!(window.authProfile && window.authProfile.isAdmin)) return;
    const copyButton = document.getElementById(`${tournamentId}-copy-details-button`);
    const previousText = copyButton ? copyButton.textContent : '';
    if (copyButton) {
        copyButton.disabled = true;
        copyButton.textContent = 'Copying...';
    }

    try {
        const token = await window.authUtils.getAuthToken();
        const response = await fetch(`/api/tournaments/copy/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const payload = await readJsonSafe(response);
        if (!response.ok) {
            alert((payload && payload.error) || 'Failed to copy tournament.');
            return;
        }

        await loadTournaments();
        renderUpcomingTournaments();
        renderResults();
        refreshAdminDetailEditors();
    } catch (error) {
        console.error('Copy tournament error:', error);
        alert('Failed to copy tournament.');
    } finally {
        if (copyButton) {
            copyButton.disabled = false;
            copyButton.textContent = previousText || 'Copy';
        }
    }
}

async function deleteUpcomingTournament(tournamentId) {
    const confirmed = window.confirm('Delete this tournament permanently? This cannot be undone.');
    if (!confirmed) return;
    await manageTournament(tournamentId, 'delete');
}

async function manageTournament(tournamentId, action, extra = {}) {
    if (!(window.authProfile && window.authProfile.isAdmin)) return false;
    try {
        const token = await window.authUtils.getAuthToken();
        const response = await fetch(`/api/tournaments/manage/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, ...extra })
        });
        const payload = await readJsonSafe(response);
        if (!response.ok) {
            alert((payload && payload.error) || 'Failed to update tournament.');
            return false;
        }
        await loadTournaments();
        renderUpcomingTournaments();
        renderResults();
        refreshAdminDetailEditors();
        return true;
    } catch (error) {
        console.error('Manage tournament error:', error);
        alert('Failed to update tournament.');
        return false;
    }
}

async function archiveResultsCard(tournamentId) {
    await manageTournament(tournamentId, 'archive');
}

async function deleteTournamentCard(tournamentId) {
    const confirmed = window.confirm('Delete this tournament permanently? This cannot be undone.');
    if (!confirmed) return;
    await manageTournament(tournamentId, 'delete');
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
            status: data.status,
            playoffTeams: data.playoffTeams,
            playoffBestOfThree: data.playoffBestOfThree,
            playoffBestOfThreeBronze: data.playoffBestOfThreeBronze,
            duprRequired: data.duprRequired
        }));
        if (typeof data.duprRequired === 'boolean') {
            updateDuprBadge(tournamentId, data.duprRequired);
        }
    }
    return data;
}

async function getDuprRequiredSetting(tournamentId) {
    const cached = localStorage.getItem(`tournament-settings-${tournamentId}`);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (typeof parsed.duprRequired === 'boolean') {
                return parsed.duprRequired;
            }
        } catch (error) {
            // ignore cache parse errors
        }
    }
    try {
        const settings = await fetchTournamentSettings(tournamentId);
        return settings?.duprRequired === true;
    } catch (error) {
        return false;
    }
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
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700">DUPR reported</span>
                        <span class="text-xs text-gray-500" id="${tournamentId}-dupr-required-value">On</span>
                    </div>
                    <button
                        type="button"
                        id="${tournamentId}-dupr-required"
                        data-enabled="true"
                        onclick="toggleDuprRequired('${tournamentId}')"
                        class="w-full text-center font-semibold py-2 rounded-lg border border-ocean-blue bg-white text-ocean-blue hover:bg-ocean-blue hover:text-white transition"
                    >
                        DUPR reported (On)
                    </button>
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

function updateDuprBadge(tournamentId, enabled) {
    const badge = document.getElementById(`${tournamentId}-dupr-badge`);
    if (!badge) return;
    if (enabled) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
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
        <div class="space-y-0.5 text-sm leading-tight text-gray-700">
            ${parts.map(part => `<div>${part}</div>`).join('')}
        </div>
    `;
}

function formatPlayerNameShort(fullName, maxLength) {
    const trimmed = String(fullName || '').trim();
    if (!trimmed) return '';
    if (trimmed.length <= maxLength) return trimmed;
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return trimmed.slice(0, maxLength);
    const first = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first} ${lastInitial}.`;
}

function formatTeamNameLinesShort(name, maxLength) {
    if (!name) {
        return '<div class="text-sm text-gray-700">Team</div>';
    }
    const parts = String(name).split(' / ').map(part => part.trim()).filter(Boolean);
    if (!parts.length) {
        return '<div class="text-sm text-gray-700">Team</div>';
    }
    return `
        <div class="space-y-0.5 text-sm leading-tight text-gray-700">
            ${parts.map(part => `<div>${formatPlayerNameShort(part, maxLength)}</div>`).join('')}
        </div>
    `;
}

function formatTbdLine() {
    return '<div class="text-sm text-gray-500">TBD</div>';
}

function renderTeamName(name, formatter) {
    if (name === 'TBD') {
        return formatTbdLine();
    }
    return formatter(name);
}

function getRoundCardTheme(index) {
    const useInverted = index % 2 === 1;
    if (useInverted) {
        return {
            bg: '#5f879a',
            border: 'rgba(95,135,154,0.5)',
            titleClass: 'text-white',
            mutedClass: 'text-white/80',
            emptyClass: 'text-white/80',
            cardClass: ''
        };
    }
    return {
        bg: '#1a3a52',
        border: 'rgba(26,58,82,0.35)',
        titleClass: 'text-white',
        mutedClass: 'text-white/60',
        emptyClass: 'text-white/70',
        cardClass: ''
    };
}

function formatTeamNameLinesLight(name) {
    if (!name) {
        return '<div class="text-sm text-white">Team</div>';
    }
    const parts = String(name).split(' / ').map(part => part.trim()).filter(Boolean);
    if (!parts.length) {
        return '<div class="text-sm text-white">Team</div>';
    }
    return `
        <div class="space-y-0.5 text-sm leading-tight text-white">
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
        // Keep admin tools visible even if settings fetch fails.
        settingsContainer.classList.remove('hidden');
        applySettingsToInputs(tournamentId, { maxTeams: 12, rounds: 6, duprRequired: true }, 6);
    }
}

function applySettingsToInputs(tournamentId, settings, minTeams) {
    const maxTeamsInput = document.getElementById(`${tournamentId}-max-teams`);
    const roundsInput = document.getElementById(`${tournamentId}-rounds`);
    const maxTeamsValue = document.getElementById(`${tournamentId}-max-teams-value`);
    const roundsValue = document.getElementById(`${tournamentId}-rounds-value`);
    const duprButton = document.getElementById(`${tournamentId}-dupr-required`);
    const duprValue = document.getElementById(`${tournamentId}-dupr-required-value`);

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
        const minRounds = 4;
        const maxRounds = Math.max(10, minRounds);
        roundsInput.min = minRounds;
        roundsInput.max = maxRounds;
        roundsInput.dataset.minRounds = String(minRounds);
        const safeRounds = Math.min(maxRounds, Math.max(minRounds, settings.rounds));
        roundsInput.value = safeRounds;
        roundsValue.textContent = safeRounds;
    }

    if (duprButton && duprValue) {
        const enabled = settings.duprRequired === true;
        duprButton.dataset.enabled = enabled ? 'true' : 'false';
        duprValue.textContent = enabled ? 'On' : 'Off';
        duprButton.textContent = `DUPR reported (${enabled ? 'On' : 'Off'})`;
        duprButton.classList.toggle('bg-ocean-blue', enabled);
        duprButton.classList.toggle('text-white', enabled);
        duprButton.classList.toggle('bg-white', !enabled);
        duprButton.classList.toggle('text-ocean-blue', !enabled);
        updateDuprBadge(tournamentId, enabled);
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
        const minRounds = Number(roundsInput.dataset.minRounds || roundsInput.min || 4);
        const maxRounds = Number(roundsInput.max || 10);
        roundsInput.min = minRounds;
        roundsInput.max = maxRounds;
        if (Number(roundsInput.value) > maxRounds) {
            roundsInput.value = maxRounds;
        }
        if (Number(roundsInput.value) < minRounds) {
            roundsInput.value = minRounds;
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

async function toggleDuprRequired(tournamentId) {
    const button = document.getElementById(`${tournamentId}-dupr-required`);
    const valueLabel = document.getElementById(`${tournamentId}-dupr-required-value`);
    if (!button || !valueLabel) return;
    const isOn = button.dataset.enabled === 'true';
    const next = !isOn;
    button.dataset.enabled = next ? 'true' : 'false';
    valueLabel.textContent = next ? 'On' : 'Off';
    button.textContent = `DUPR reported (${next ? 'On' : 'Off'})`;
    button.classList.toggle('bg-ocean-blue', next);
    button.classList.toggle('text-white', next);
    button.classList.toggle('bg-white', !next);
    button.classList.toggle('text-ocean-blue', !next);
    updateDuprBadge(tournamentId, next);
    await persistSettings(tournamentId);
}

async function updatePlayoffTeams(tournamentId, value) {
    const playoffValue = document.getElementById(`${tournamentId}-playoff-teams-value`);
    if (playoffValue) {
        playoffValue.textContent = value;
    }
    await persistPlayoffSettings(tournamentId);
}

async function togglePlayoffBestOfThree(tournamentId, mode) {
    const buttonId = mode === 'bronze'
        ? `${tournamentId}-playoff-best-of-three-bronze`
        : `${tournamentId}-playoff-best-of-three`;
    const button = document.getElementById(buttonId);
    if (!button) return;
    const isOn = button.dataset.enabled === 'true';
    const next = !isOn;
    button.dataset.enabled = next ? 'true' : 'false';
    if (mode === 'bronze') {
        button.textContent = `Bronze match: Best of 3 (${next ? 'On' : 'Off'})`;
    } else {
        button.textContent = `Gold match: Best of 3 (${next ? 'On' : 'Off'})`;
    }
    button.classList.toggle('bg-ocean-blue', next);
    button.classList.toggle('text-white', next);
    button.classList.toggle('bg-white', !next);
    button.classList.toggle('text-ocean-blue', !next);
    await persistPlayoffSettings(tournamentId);
}

let settingsSaveTimeout;
const pendingSettings = new Set();
let playoffSettingsSaveTimeout;
const pendingPlayoffSettings = new Set();

async function persistSettings(tournamentId) {
    pendingSettings.add(tournamentId);
    clearTimeout(settingsSaveTimeout);
    settingsSaveTimeout = setTimeout(() => {
        flushSettingsSaves();
    }, 300);
}

async function persistPlayoffSettings(tournamentId) {
    pendingPlayoffSettings.add(tournamentId);
    clearTimeout(playoffSettingsSaveTimeout);
    playoffSettingsSaveTimeout = setTimeout(() => {
        flushPlayoffSettingsSaves();
    }, 300);
}

async function flushSettingsSaves() {
    const tournaments = Array.from(pendingSettings);
    pendingSettings.clear();
    await Promise.all(tournaments.map(async tournamentId => {
        const maxTeamsInput = document.getElementById(`${tournamentId}-max-teams`);
        const roundsInput = document.getElementById(`${tournamentId}-rounds`);
        const duprButton = document.getElementById(`${tournamentId}-dupr-required`);
        if (!maxTeamsInput || !roundsInput) return;
        try {
            const duprRequired = duprButton ? duprButton.dataset.enabled === 'true' : false;
            await saveTournamentSettings(tournamentId, {
                maxTeams: Number(maxTeamsInput.value),
                rounds: Number(roundsInput.value),
                duprRequired
            });
            localStorage.setItem(`tournament-settings-${tournamentId}`, JSON.stringify({
                maxTeams: Number(maxTeamsInput.value),
                rounds: Number(roundsInput.value),
                duprRequired
            }));
        } catch (error) {
            console.error('Save settings error:', error);
        }
    }));
}

async function flushPlayoffSettingsSaves() {
    const tournaments = Array.from(pendingPlayoffSettings);
    pendingPlayoffSettings.clear();
    await Promise.all(tournaments.map(async tournamentId => {
        const playoffTeamsInput = document.getElementById(`${tournamentId}-playoff-teams`);
        const bestOfThreeButton = document.getElementById(`${tournamentId}-playoff-best-of-three`);
        const bestOfThreeBronzeButton = document.getElementById(`${tournamentId}-playoff-best-of-three-bronze`);
        if (!playoffTeamsInput || !bestOfThreeButton || !bestOfThreeBronzeButton) return;
        const bestOfThree = bestOfThreeButton.dataset.enabled === 'true';
        const bestOfThreeBronze = bestOfThreeBronzeButton.dataset.enabled === 'true';
        try {
            await saveTournamentSettings(tournamentId, {
                playoffTeams: Number(playoffTeamsInput.value),
                playoffBestOfThree: bestOfThree,
                playoffBestOfThreeBronze: bestOfThreeBronze
            });
            const cached = localStorage.getItem(`tournament-settings-${tournamentId}`);
            const cachedSettings = cached ? JSON.parse(cached) : {};
            localStorage.setItem(`tournament-settings-${tournamentId}`, JSON.stringify({
                ...cachedSettings,
                playoffTeams: Number(playoffTeamsInput.value),
                playoffBestOfThree: bestOfThree,
                playoffBestOfThreeBronze: bestOfThreeBronze
            }));
        } catch (error) {
            console.error('Save playoff settings error:', error);
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

async function startPlayoff(tournamentId) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const playoffTeamsInput = document.getElementById(`${tournamentId}-playoff-teams`);
        const bestOfThreeButton = document.getElementById(`${tournamentId}-playoff-best-of-three`);
        const bestOfThreeBronzeButton = document.getElementById(`${tournamentId}-playoff-best-of-three-bronze`);
        if (playoffTeamsInput && bestOfThreeButton && bestOfThreeBronzeButton) {
            const bestOfThree = bestOfThreeButton.dataset.enabled === 'true';
            const bestOfThreeBronze = bestOfThreeBronzeButton.dataset.enabled === 'true';
            await saveTournamentSettings(tournamentId, {
                playoffTeams: Number(playoffTeamsInput.value),
                playoffBestOfThree: bestOfThree,
                playoffBestOfThreeBronze: bestOfThreeBronze
            });
        }

        const token = await auth.getAuthToken();
        const response = await fetch(`/api/tournaments/playoff/start/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Unable to start playoff.');
            return;
        }

        await renderRegistrationList(tournamentId);
        await renderTournamentView(tournamentId, { force: true, scrollToRound: 0 });
    } catch (error) {
        console.error('Start playoff error:', error);
        alert('Unable to start playoff.');
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

async function resetPlayoff(tournamentId) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const token = await auth.getAuthToken();
        const response = await fetch(`/api/tournaments/playoff/reset/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Unable to reset playoff.');
            return;
        }

        await renderRegistrationList(tournamentId);
        await renderTournamentView(tournamentId, { force: true, scrollToResults: true });
    } catch (error) {
        console.error('Reset playoff error:', error);
        alert('Unable to reset playoff.');
    }
}

async function archiveTournamentResults(tournamentId) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const playoff = await fetchPlayoffState(tournamentId);
        if (!playoff || !playoff.isComplete) {
            alert('Enter all required finals scores before archiving results.');
            return;
        }
        const token = await auth.getAuthToken();
        const response = await fetch(`/api/tournaments/archive/${tournamentId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const payload = await readJsonSafe(response);
        if (!response.ok) {
            alert((payload && payload.error) || 'Unable to archive results.');
            return;
        }
        await loadTournaments();
        renderUpcomingTournaments();
        renderResults();
        refreshAdminDetailEditors();
        stopTournamentPolling(tournamentId);
    } catch (error) {
        console.error('Archive results error:', error);
        alert('Unable to archive results.');
    }
}

async function submitTournamentToDupr(tournamentId) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const playoff = await fetchPlayoffState(tournamentId);
        if (!playoff || !playoff.isComplete) {
            alert('Enter all required finals scores before submitting to DUPR.');
            return;
        }

        const token = await auth.getAuthToken();
        const response = await fetch(`/api/tournaments/submit-dupr/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const payload = await readJsonSafe(response);
        if (!response.ok) {
            alert((payload && payload.error) || 'Unable to submit matches to DUPR.');
            return;
        }

        alert(`Submitted ${payload.submitted || 0} matches to DUPR.`);
        await renderTournamentView(tournamentId, { force: true, preserveScroll: true });
    } catch (error) {
        console.error('Submit to DUPR error:', error);
        alert('Unable to submit matches to DUPR.');
    }
}

async function fetchRoundRobin(tournamentId) {
    const response = await fetch(`/api/tournaments/round-robin/${tournamentId}`);
    if (!response.ok) {
        throw new Error('Failed to load tournament');
    }
    return await response.json();
}

async function fetchPlayoffState(tournamentId) {
    const response = await fetch(`/api/tournaments/playoff/${tournamentId}`);
    if (!response.ok) {
        throw new Error('Failed to load playoff');
    }
    return await response.json();
}

async function renderTournamentView(tournamentId, options = {}) {
    const view = document.getElementById(`${tournamentId}-tournament-view`);
    const roundsContainer = document.getElementById(`${tournamentId}-rounds-container`);
    if (!view || !roundsContainer) return;
    const allowNonTournament = options.allowNonTournament === true;
    const forceSection = options.forceSection === 'playoff' ? 'playoff' : (options.forceSection === 'roundRobin' ? 'roundRobin' : null);
    const readOnly = options.readOnly === true;
    const scoreEditMode = options.scoreEditMode || 'default';
    if (!options.force) {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.id && activeEl.id.startsWith(`${tournamentId}-`)) {
            const tag = activeEl.tagName ? activeEl.tagName.toLowerCase() : '';
            const isInteractive = activeEl.classList.contains('score-input')
                || tag === 'button'
                || tag === 'select'
                || tag === 'textarea'
                || (tag === 'input');
            if (isInteractive) return;
        }
    }

    try {
        const data = await fetchRoundRobin(tournamentId);
        if (data.status !== 'tournament' && !allowNonTournament) {
            view.classList.add('hidden');
            return;
        }

        view.classList.remove('hidden');
        let playoff = null;
        try {
            playoff = await fetchPlayoffState(tournamentId);
        } catch (error) {
            playoff = null;
        }
        const teams = await fetchRegistrations(tournamentId);
        const teamPlayers = new Map();
        teams.forEach(team => {
            teamPlayers.set(team.id, (team.players || []).map(player => player.id));
        });
        const currentUser = window.authUtils && window.authUtils.getCurrentUser
            ? window.authUtils.getCurrentUser()
            : null;
        const currentUserId = currentUser ? (currentUser.id || currentUser.emailAddresses[0].emailAddress) : null;
        const hasAdminTournamentAction = Boolean(
            document.getElementById(`${tournamentId}-tournament-actions`)?.querySelector('button')
        );
        const isMasterAdmin = Boolean(window.authProfile && window.authProfile.isMasterAdmin);
        const isAdmin = readOnly
            ? false
            : Boolean((window.authProfile && window.authProfile.isAdmin) || hasAdminTournamentAction);
        const title = document.getElementById(`${tournamentId}-tournament-title`);
        if (playoff && playoff.status === 'playoff' && forceSection !== 'roundRobin') {
            if (title) {
                title.textContent = 'Playoffs';
            }
            const resetScroll = Number.isInteger(options.scrollToRound) && options.scrollToRound === 0;
            const preserveScroll = options.preserveScroll === true && !resetScroll;
            const currentScrollLeft = preserveScroll ? roundsContainer.scrollLeft : null;
            renderPlayoffView(
                tournamentId,
                playoff,
                teamPlayers,
                currentUserId,
                isAdmin,
                resetScroll,
                currentScrollLeft,
                scoreEditMode,
                isMasterAdmin
            );
            return;
        }
        if (forceSection === 'playoff') {
            roundsContainer.innerHTML = `
                <div class="min-w-[calc(100%-0.5rem)] md:min-w-[290px] snap-start border rounded-xl p-3 bg-white border-gray-200">
                    <div class="text-sm text-gray-600">No playoff data found for this tournament.</div>
                </div>
            `;
            applyRoundCardLayout(roundsContainer);
            return;
        }
        if (title) {
            title.textContent = 'Round Robin';
        }

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
        const roundsWithResults = [...rounds, 'results'];
        const resultsIndex = rounds.length;
        const stats = new Map();
        (data.teams || []).forEach(team => {
            stats.set(team.team_id, {
                teamId: team.team_id,
                name: team.team_name || 'Team',
                wins: 0,
                losses: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                games: 0
            });
        });

        (data.matches || []).forEach(match => {
            if (!Number.isInteger(match.score1) || !Number.isInteger(match.score2)) return;
            const team1 = stats.get(match.team1_id);
            const team2 = stats.get(match.team2_id);
            if (!team1 || !team2) return;
            team1.pointsFor += match.score1;
            team1.pointsAgainst += match.score2;
            team2.pointsFor += match.score2;
            team2.pointsAgainst += match.score1;
            team1.games += 1;
            team2.games += 1;
            if (match.score1 > match.score2) {
                team1.wins += 1;
                team2.losses += 1;
            } else if (match.score2 > match.score1) {
                team2.wins += 1;
                team1.losses += 1;
            }
        });

        const standings = Array.from(stats.values()).map(team => {
            const diffTotal = team.pointsFor - team.pointsAgainst;
            const avgDiff = team.games > 0 ? diffTotal / team.games : 0;
            return { ...team, avgDiff };
        }).sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (a.losses !== b.losses) return a.losses - b.losses;
            if (b.avgDiff !== a.avgDiff) return b.avgDiff - a.avgDiff;
            return a.name.localeCompare(b.name);
        });

        roundsContainer.innerHTML = roundsWithResults.map((round, roundIndex) => {
            const theme = getRoundCardTheme(roundIndex);
            if (round === 'results') {
                const rows = standings.map(team => {
                    const record = `(${team.wins}-${team.losses})`;
                    const avgDiff = `${team.avgDiff >= 0 ? '+' : ''}${team.avgDiff.toFixed(1)}`;
                    return `
                        <div class="round-inner-card bg-white rounded-lg p-3 flex items-center justify-between gap-3">
                            <div class="flex-1">
                                ${formatTeamNameLines(team.name)}
                            </div>
                            <div class="text-right text-sm text-gray-700 flex flex-col items-end justify-center">
                                <div class="font-semibold">${avgDiff}</div>
                                <div class="text-xs text-gray-500">${record}</div>
                            </div>
                        </div>
                    `;
                }).join('');

                const totalTeams = standings.length;
                const maxPlayoffTeams = Math.min(8, totalTeams);
                const effectiveMaxPlayoffTeams = Math.max(2, maxPlayoffTeams);
                const defaultPlayoffTeams = effectiveMaxPlayoffTeams;
                const savedPlayoffTeams = Number.isInteger(settings.playoffTeams) ? settings.playoffTeams : null;
                const playoffTeamsValue = savedPlayoffTeams && savedPlayoffTeams <= effectiveMaxPlayoffTeams
                    ? savedPlayoffTeams
                    : defaultPlayoffTeams;
                const bestOfThree = settings.playoffBestOfThree === true;
                const bestOfThreeBronze = settings.playoffBestOfThreeBronze === true;
                const playoffControls = isAdmin ? `
                    <div class="text-lg font-semibold text-white mb-3">Playoff Settings</div>
                    <div class="bg-white rounded-lg p-3 space-y-3">
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-sm font-medium text-gray-700"># of playoff teams</span>
                                <span class="text-sm text-gray-500" id="${tournamentId}-playoff-teams-value">${playoffTeamsValue}</span>
                            </div>
                            <input
                                type="range"
                                min="2"
                                max="${effectiveMaxPlayoffTeams}"
                                step="1"
                                value="${playoffTeamsValue}"
                                id="${tournamentId}-playoff-teams"
                                class="w-full"
                                oninput="updatePlayoffTeams('${tournamentId}', this.value)"
                            >
                        </div>
                        <button
                            id="${tournamentId}-playoff-best-of-three"
                            class="w-full border border-gray-200 text-sm font-semibold py-2 rounded-lg ${bestOfThree ? 'bg-ocean-blue text-white' : 'bg-white text-ocean-blue'}"
                            onclick="togglePlayoffBestOfThree('${tournamentId}', 'gold')"
                            data-enabled="${bestOfThree ? 'true' : 'false'}"
                        >
                            Gold match: Best of 3 (${bestOfThree ? 'On' : 'Off'})
                        </button>
                        <button
                            id="${tournamentId}-playoff-best-of-three-bronze"
                            class="w-full border border-gray-200 text-sm font-semibold py-2 rounded-lg ${bestOfThreeBronze ? 'bg-ocean-blue text-white' : 'bg-white text-ocean-blue'}"
                            onclick="togglePlayoffBestOfThree('${tournamentId}', 'bronze')"
                            data-enabled="${bestOfThreeBronze ? 'true' : 'false'}"
                        >
                            Bronze match: Best of 3 (${bestOfThreeBronze ? 'On' : 'Off'})
                        </button>
                        <button
                            class="w-full bg-ocean-blue text-white px-4 py-2 rounded-lg hover:bg-ocean-teal transition font-semibold"
                            onclick="startPlayoff('${tournamentId}')"
                        >
                            Start Playoff
                        </button>
                    </div>
                    <div class="h-4"></div>
                ` : '';

                return `
                    <div class="min-w-[calc(100%-0.5rem)] md:min-w-[290px] snap-start md:snap-center border rounded-xl p-3 ${theme.cardClass}" style="background-color: ${theme.bg}; border-color: ${theme.border};">
                        ${playoffControls}
                        <div class="text-lg font-semibold ${theme.titleClass} mb-3">Results</div>
                        <div class="space-y-2">${rows || `<div class="text-sm ${theme.emptyClass}">No results yet.</div>`}</div>
                    </div>
                `;
            }
            const roundMatches = matchesByRound[round] || [];
            const cards = roundMatches.map(match => {
                const team1Players = teamPlayers.get(match.team1_id) || [];
                const team2Players = teamPlayers.get(match.team2_id) || [];
                const isParticipant = Boolean(currentUserId && (team1Players.includes(currentUserId) || team2Players.includes(currentUserId)));
                let canEdit = false;
                if (scoreEditMode === 'master_only') {
                    canEdit = isMasterAdmin;
                } else if (scoreEditMode === 'none') {
                    canEdit = false;
                } else {
                    canEdit = isAdmin || isParticipant;
                }
                return `
                    <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${formatTeamNameLines(match.team1_name || 'Team 1')}
                            ${scoreInputHtml(tournamentId, match.match_id, 1, match.score1, canEdit, match.version)}
                        </div>
                        <div class="h-px round-inner-divider"></div>
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${formatTeamNameLines(match.team2_name || 'Team 2')}
                            ${scoreInputHtml(tournamentId, match.match_id, 2, match.score2, canEdit, match.version)}
                        </div>
                    </div>
                `;
            }).join('');

            const byeTeamId = byeMap.get(Number(round));
            const byeTeam = (data.teams || []).find(team => team.team_id === byeTeamId);
            const byeCard = byeTeam ? `
                <div class="round-inner-bye bg-gray-100 border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between gap-3 text-gray-600">
                    ${formatTeamNameLines(byeTeam.team_name || 'Team')}
                    <span class="text-xs uppercase tracking-wide text-gray-500">Bye</span>
                </div>
            ` : '';

            return `
                <div class="min-w-[calc(100%-0.5rem)] md:min-w-[290px] snap-start md:snap-center border rounded-xl p-3 ${theme.cardClass}" style="background-color: ${theme.bg}; border-color: ${theme.border};">
                    <h5 class="text-lg font-semibold ${theme.titleClass} mb-3">Round ${round} of ${totalRounds}</h5>
                    <div class="space-y-2">${cards}${byeCard || (roundMatches.length === 0 ? `<div class="text-sm ${theme.emptyClass}">No matches scheduled.</div>` : '')}</div>
                </div>
            `;
        }).join('');
        applyRoundCardLayout(roundsContainer);

        if (options.scrollToResults) {
            requestAnimationFrame(() => {
                scrollToRound(tournamentId, resultsIndex);
                setTimeout(() => {
                    scrollToRound(tournamentId, resultsIndex);
                }, 120);
            });
        }
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

function applyRoundCardLayout(roundsContainer) {
    if (!roundsContainer) return;
    const cards = Array.from(roundsContainer.children || []);
    if (!cards.length) return;

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
        const width = roundsContainer.clientWidth;
        roundsContainer.style.gap = '0px';
        cards.forEach(card => {
            card.style.minWidth = `${width}px`;
            card.style.width = `${width}px`;
            card.style.scrollSnapAlign = 'start';
        });
    } else {
        roundsContainer.style.gap = '';
        cards.forEach(card => {
            card.style.minWidth = '';
            card.style.width = '';
            card.style.scrollSnapAlign = '';
        });
    }
}

const tournamentPollers = new Map();
const TOURNAMENT_POLL_INTERVAL_MS = 2000;

function startTournamentPolling(tournamentId) {
    if (tournamentPollers.has(tournamentId)) return;
    const interval = setInterval(() => {
        if (document.hidden) return;
        const activeEl = document.activeElement;
        if (activeEl && activeEl.id && activeEl.id.startsWith(`${tournamentId}-`)) {
            const tag = activeEl.tagName ? activeEl.tagName.toLowerCase() : '';
            const isInteractive = activeEl.classList.contains('score-input')
                || tag === 'button'
                || tag === 'select'
                || tag === 'textarea'
                || (tag === 'input');
            if (isInteractive) return;
        }
        renderTournamentView(tournamentId);
    }, TOURNAMENT_POLL_INTERVAL_MS);
    tournamentPollers.set(tournamentId, interval);
}

function stopTournamentPolling(tournamentId) {
    const interval = tournamentPollers.get(tournamentId);
    if (interval) {
        clearInterval(interval);
        tournamentPollers.delete(tournamentId);
    }
}

function scoreInputHtml(tournamentId, matchId, slot, value, canEdit, version = 0) {
    const val = Number.isInteger(value) ? value : '';
    if (!canEdit) {
        return `<span class="inline-flex min-w-[2.25rem] justify-end px-1 py-0.5 text-sm font-semibold text-gray-700 self-center">${val === '' ? '&mdash;' : val}</span>`;
    }
    return `<input
        type="number"
        inputmode="numeric"
        class="score-input px-1 py-0.5 border border-gray-300 rounded text-right self-center"
        value="${val}"
        id="${tournamentId}-${matchId}-score${slot}"
        data-version="${Number.isInteger(version) ? version : 0}"
        oninput="updateScore('${tournamentId}', '${matchId}')"
    >`;
}

function playoffSeedOrderForSize(size) {
    if (size === 2) return [1, 2];
    if (size === 4) return [1, 4, 2, 3];
    return [1, 8, 4, 5, 2, 7, 3, 6];
}

function buildPlayoffScoreMap(scores) {
    const map = new Map();
    (scores || []).forEach(score => {
        const key = `${score.round_number}-${score.match_number}`;
        map.set(key, score);
    });
    return map;
}

function playoffMatchWinner(match, score, isFinal, bestOfThree, roundNumber) {
    if (!match.team1Id && !match.team2Id) return null;
    if (match.team1Id && !match.team2Id) return roundNumber === 1 ? match.team1Id : null;
    if (!match.team1Id && match.team2Id) return roundNumber === 1 ? match.team2Id : null;
    if (!score) return null;
    if (!isFinal || !bestOfThree) {
        if (!Number.isInteger(score.game1_score1) || !Number.isInteger(score.game1_score2)) return null;
        if (score.game1_score1 === score.game1_score2) return null;
        return score.game1_score1 > score.game1_score2 ? match.team1Id : match.team2Id;
    }
    let wins1 = 0;
    let wins2 = 0;
    const games = [
        [score.game1_score1, score.game1_score2],
        [score.game2_score1, score.game2_score2],
        [score.game3_score1, score.game3_score2]
    ];
    games.forEach(([s1, s2]) => {
        if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 === s2) return;
        if (s1 > s2) wins1 += 1;
        if (s2 > s1) wins2 += 1;
    });
    if (wins1 >= 2) return match.team1Id;
    if (wins2 >= 2) return match.team2Id;
    return null;
}

function playoffMatchLoser(match, score, isFinal, bestOfThree, roundNumber) {
    if (!match.team1Id && !match.team2Id) return null;
    if (match.team1Id && !match.team2Id) return null;
    if (!match.team1Id && match.team2Id) return null;
    const winner = playoffMatchWinner(match, score, isFinal, bestOfThree, roundNumber);
    if (!winner) return null;
    return winner === match.team1Id ? match.team2Id : match.team1Id;
}

function computePlayoffRounds(seedOrder, bracketSize, scores, bestOfThree) {
    const slots = playoffSeedOrderForSize(bracketSize).map(seed => seedOrder[seed - 1] || null);
    const scoreMap = buildPlayoffScoreMap(scores);
    const rounds = [];
    let current = [];

    for (let i = 0; i < slots.length; i += 2) {
        current.push({
            team1Id: slots[i],
            team2Id: slots[i + 1],
            matchNumber: (i / 2) + 1
        });
    }

    const totalRounds = Math.log2(bracketSize);
    for (let round = 1; round <= totalRounds; round++) {
        const isFinal = round === totalRounds;
        const roundMatches = current.map(match => {
            const score = scoreMap.get(`${round}-${match.matchNumber}`) || null;
            return {
                roundNumber: round,
                matchNumber: match.matchNumber,
                team1Id: match.team1Id,
                team2Id: match.team2Id,
                score
            };
        });
        rounds.push(roundMatches);

        const winners = roundMatches.map(match => playoffMatchWinner(match, match.score, isFinal, bestOfThree, round));
        if (round < totalRounds) {
            const next = [];
            for (let i = 0; i < winners.length; i += 2) {
                next.push({
                    team1Id: winners[i] || null,
                    team2Id: winners[i + 1] || null,
                    matchNumber: (i / 2) + 1
                });
            }
            current = next;
        }
    }

    return rounds;
}

function scoreInputHtmlPlayoff(tournamentId, roundNumber, matchNumber, teamSlot, gameIndex, value, canEdit, version = 0) {
    const val = Number.isInteger(value) ? value : '';
    if (!canEdit) {
        return `<span class="inline-flex min-w-[2.25rem] justify-end px-1 py-0.5 text-sm font-semibold text-gray-700 self-center">${val === '' ? '&mdash;' : val}</span>`;
    }
    return `<input
        type="number"
        inputmode="numeric"
        class="score-input px-1 py-0.5 border border-gray-300 rounded text-right self-center"
        value="${val}"
        id="${tournamentId}-playoff-r${roundNumber}-m${matchNumber}-t${teamSlot}-g${gameIndex}"
        data-version="${Number.isInteger(version) ? version : 0}"
        oninput="updatePlayoffScore('${tournamentId}', ${roundNumber}, ${matchNumber})"
    >`;
}

function playoffRoundLabel(bracketSize, roundNumber) {
    if (bracketSize === 2) return 'Finals';
    if (bracketSize === 4) return roundNumber === 1 ? 'Semi-finals' : 'Finals';
    if (bracketSize === 8) return roundNumber === 1 ? 'Quarter-finals' : (roundNumber === 2 ? 'Semi-finals' : 'Finals');
    return `Round ${roundNumber}`;
}

async function renderPlayoffView(
    tournamentId,
    playoff,
    teamPlayers,
    currentUserId,
    isAdmin,
    resetScroll = false,
    preserveScrollLeft = null,
    scoreEditMode = 'default',
    isMasterAdmin = false
) {
    const roundsContainer = document.getElementById(`${tournamentId}-rounds-container`);
    if (!roundsContainer) return;
    const duprRequired = await getDuprRequiredSetting(tournamentId);

    const seedOrder = playoff.seedOrder || [];
    const scores = playoff.scores || [];
    const bracketSize = playoff.bracketSize || 2;
        const bestOfThree = playoff.bestOfThree === true;
        const bestOfThreeBronze = playoff.bestOfThreeBronze === true;
    const teamsMap = new Map((playoff.teams || []).map(team => [team.team_id, team.team_name || 'Team']));
    const rounds = computePlayoffRounds(seedOrder, bracketSize, scores, bestOfThree);
    const totalRounds = Math.log2(bracketSize);
    const scoreMap = buildPlayoffScoreMap(scores);

    roundsContainer.innerHTML = rounds.map((roundMatches, roundIndex) => {
        const theme = getRoundCardTheme(roundIndex);
        const roundNumber = roundIndex + 1;
        const isFinal = roundNumber === totalRounds;
        const nameFormatter = isFinal && bestOfThree
            ? (value) => formatTeamNameLinesShort(value, 13)
            : formatTeamNameLines;
        const bronzeNameFormatter = isFinal && bestOfThreeBronze
            ? (value) => formatTeamNameLinesShort(value, 13)
            : formatTeamNameLines;
        const matchesHtml = roundMatches.map(match => {
            const team1Name = teamsMap.get(match.team1Id) || (match.team1Id ? 'Team' : 'TBD');
            const team2Name = teamsMap.get(match.team2Id) || (match.team2Id ? 'Team' : 'TBD');
            const team1Players = teamPlayers.get(match.team1Id) || [];
            const team2Players = teamPlayers.get(match.team2Id) || [];
            const isParticipant = Boolean(currentUserId && match.team1Id && match.team2Id && (team1Players.includes(currentUserId) || team2Players.includes(currentUserId)));
            let canEdit = false;
            if (scoreEditMode === 'master_only') {
                canEdit = isMasterAdmin;
            } else if (scoreEditMode === 'none') {
                canEdit = false;
            } else {
                canEdit = isAdmin || isParticipant;
            }
            const score = match.score || {};
            const matchVersion = Number.isInteger(score.version) ? score.version : 0;
            const team1Score1 = score.game1_score1;
            const team2Score1 = score.game1_score2;
            const team1Score2 = score.game2_score1;
            const team2Score2 = score.game2_score2;
            const team1Score3 = score.game3_score1;
            const team2Score3 = score.game3_score2;

            const renderInputs = (teamSlot, values, allowBestOfThree, version) => {
                return `
                    <div class="flex items-center gap-2">
                        ${scoreInputHtmlPlayoff(tournamentId, roundNumber, match.matchNumber, teamSlot, 1, values[0], canEdit, version)}
                        ${allowBestOfThree ? scoreInputHtmlPlayoff(tournamentId, roundNumber, match.matchNumber, teamSlot, 2, values[1], canEdit, version) : ''}
                        ${allowBestOfThree ? scoreInputHtmlPlayoff(tournamentId, roundNumber, match.matchNumber, teamSlot, 3, values[2], canEdit, version) : ''}
                    </div>
                `;
            };

            if (match.team1Id && !match.team2Id) {
                if (roundNumber > 1) {
                    return `
                        <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                            <div class="flex items-center justify-between gap-3 text-gray-600">
                                ${renderTeamName(team1Name, nameFormatter)}
                                ${renderInputs(1, [team1Score1, team1Score2, team1Score3], isFinal && bestOfThree, matchVersion)}
                            </div>
                            <div class="h-px round-inner-divider"></div>
                            <div class="flex items-center justify-between gap-3 text-gray-500">
                                ${formatTbdLine()}
                                ${renderInputs(2, [null, null, null], isFinal && bestOfThree, matchVersion)}
                            </div>
                        </div>
                    `;
                }
                return `
                    <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3 text-gray-600">
                        ${renderTeamName(team1Name, nameFormatter)}
                        <span class="text-xs uppercase tracking-wide text-gray-500">Bye</span>
                    </div>
                `;
            }
            if (!match.team1Id && match.team2Id) {
                if (roundNumber > 1) {
                    return `
                        <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                            <div class="flex items-center justify-between gap-3 text-gray-500">
                                ${formatTbdLine()}
                                ${renderInputs(1, [null, null, null], isFinal && bestOfThree, matchVersion)}
                            </div>
                            <div class="h-px round-inner-divider"></div>
                            <div class="flex items-center justify-between gap-3 text-gray-600">
                                ${renderTeamName(team2Name, nameFormatter)}
                                ${renderInputs(2, [team2Score1, team2Score2, team2Score3], isFinal && bestOfThree, matchVersion)}
                            </div>
                        </div>
                    `;
                }
                return `
                    <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3 text-gray-600">
                        ${renderTeamName(team2Name, nameFormatter)}
                        <span class="text-xs uppercase tracking-wide text-gray-500">Bye</span>
                    </div>
                `;
            }
            if (!match.team1Id && !match.team2Id) {
                return `
                    <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                        <div class="flex items-center justify-between gap-3 text-gray-500">
                            ${formatTbdLine()}
                        </div>
                        <div class="h-px round-inner-divider"></div>
                        <div class="flex items-center justify-between gap-3 text-gray-500">
                            ${formatTbdLine()}
                        </div>
                    </div>
                `;
            }
            return `
                <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${renderTeamName(team1Name, nameFormatter)}
                            ${renderInputs(1, [team1Score1, team1Score2, team1Score3], isFinal && bestOfThree, matchVersion)}
                        </div>
                        <div class="h-px round-inner-divider"></div>
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${renderTeamName(team2Name, nameFormatter)}
                            ${renderInputs(2, [team2Score1, team2Score2, team2Score3], isFinal && bestOfThree, matchVersion)}
                        </div>
                    </div>
                `;
        }).join('');

        let bronzeHtml = '';
        if (isFinal && bracketSize >= 4) {
            const semiRound = rounds[totalRounds - 2] || [];
            const semiMatches = semiRound.map((match, index) => ({
                ...match,
                score: scoreMap.get(`${totalRounds - 1}-${match.matchNumber}`) || match.score || null,
                matchIndex: index
            }));
            const losers = semiMatches.map(match => playoffMatchLoser(match, match.score, false, false, totalRounds - 1));
            const bronzeTeam1 = losers[0] || null;
            const bronzeTeam2 = losers[1] || null;
            const bronzeScore = scoreMap.get(`${totalRounds}-2`) || null;
            const bronzeTeam1Name = teamsMap.get(bronzeTeam1) || (bronzeTeam1 ? 'Team' : 'TBD');
            const bronzeTeam2Name = teamsMap.get(bronzeTeam2) || (bronzeTeam2 ? 'Team' : 'TBD');
            const bronzeTeam1Players = teamPlayers.get(bronzeTeam1) || [];
            const bronzeTeam2Players = teamPlayers.get(bronzeTeam2) || [];
            const bronzeVersion = bronzeScore && Number.isInteger(bronzeScore.version) ? bronzeScore.version : 0;
            const bronzeParticipant = Boolean(currentUserId && bronzeTeam1 && bronzeTeam2 && (bronzeTeam1Players.includes(currentUserId) || bronzeTeam2Players.includes(currentUserId)));
            let bronzeCanEdit = false;
            if (scoreEditMode === 'master_only') {
                bronzeCanEdit = isMasterAdmin;
            } else if (scoreEditMode === 'none') {
                bronzeCanEdit = false;
            } else {
                bronzeCanEdit = isAdmin || bronzeParticipant;
            }
            const bronzeInputs = (teamSlot, values) => `
                <div class="flex items-center gap-2">
                    ${scoreInputHtmlPlayoff(tournamentId, roundNumber, 2, teamSlot, 1, values[0], bronzeCanEdit, bronzeVersion)}
                    ${bestOfThreeBronze ? scoreInputHtmlPlayoff(tournamentId, roundNumber, 2, teamSlot, 2, values[1], bronzeCanEdit, bronzeVersion) : ''}
                    ${bestOfThreeBronze ? scoreInputHtmlPlayoff(tournamentId, roundNumber, 2, teamSlot, 3, values[2], bronzeCanEdit, bronzeVersion) : ''}
                </div>
            `;

            if (bronzeTeam1 || bronzeTeam2) {
                bronzeHtml = `
                    <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${renderTeamName(bronzeTeam1Name, bronzeNameFormatter)}
                            ${bronzeInputs(1, [
                                bronzeScore ? bronzeScore.game1_score1 : null,
                                bronzeScore ? bronzeScore.game2_score1 : null,
                                bronzeScore ? bronzeScore.game3_score1 : null
                            ])}
                        </div>
                        <div class="h-px round-inner-divider"></div>
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${renderTeamName(bronzeTeam2Name, bronzeNameFormatter)}
                            ${bronzeInputs(2, [
                                bronzeScore ? bronzeScore.game1_score2 : null,
                                bronzeScore ? bronzeScore.game2_score2 : null,
                                bronzeScore ? bronzeScore.game3_score2 : null
                            ])}
                        </div>
                    </div>
                `;
            } else {
                bronzeHtml = `
                    <div class="round-inner-card bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                        <div class="flex items-center justify-between gap-3 text-gray-500">
                            ${formatTbdLine()}
                        </div>
                        <div class="h-px round-inner-divider"></div>
                        <div class="flex items-center justify-between gap-3 text-gray-500">
                            ${formatTbdLine()}
                        </div>
                    </div>
                `;
            }

        }

        const canArchiveResults = Boolean(playoff && playoff.isComplete);
        const alreadySubmittedToDupr = Boolean(playoff && playoff.duprSubmission && playoff.duprSubmission.success);
        const submitToDuprButton = isFinal && isAdmin && duprRequired
            ? `
                <button
                    class="mt-4 w-full border border-sand-600 bg-sand-500 text-ocean-blue px-4 py-2 rounded-lg hover:bg-sand-600 transition font-semibold ${canArchiveResults && !alreadySubmittedToDupr ? '' : 'opacity-60 cursor-not-allowed'}"
                    onclick="submitTournamentToDupr('${tournamentId}')"
                    ${canArchiveResults && !alreadySubmittedToDupr ? '' : 'disabled'}
                >
                    ${alreadySubmittedToDupr ? 'Submitted to DUPR' : 'Submit to DUPR'}
                </button>
            `
            : '';
        const archiveButton = isFinal && isAdmin
            ? `
                <button
                    class="mt-4 w-full border border-ocean-blue bg-white text-ocean-blue px-4 py-2 rounded-lg hover:bg-sand-50 transition font-semibold ${canArchiveResults ? '' : 'opacity-60 cursor-not-allowed'}"
                    onclick="archiveTournamentResults('${tournamentId}')"
                    ${canArchiveResults ? '' : 'disabled'}
                >
                    Archive Results
                </button>
            `
            : '';

        return `
            <div class="min-w-[calc(100%-0.5rem)] md:min-w-[290px] snap-start md:snap-center border rounded-xl p-3 ${theme.cardClass}" style="background-color: ${theme.bg}; border-color: ${theme.border};">
                <h5 class="text-lg font-semibold ${theme.titleClass} mb-3">${playoffRoundLabel(bracketSize, roundNumber)}</h5>
                ${isFinal && bracketSize >= 4 ? `<div class="text-xs uppercase tracking-wide ${theme.mutedClass} mb-2">Gold Match</div>` : ''}
                <div class="space-y-3">${matchesHtml || `<div class="text-sm ${theme.emptyClass}">No matches scheduled.</div>`}</div>
                ${isFinal && bracketSize >= 4 ? `<div class="text-xs uppercase tracking-wide ${theme.mutedClass} mt-4 mb-2">Bronze Match</div>` : ''}
                ${bronzeHtml}
                ${submitToDuprButton}
                ${archiveButton}
            </div>
        `;
    }).join('');
    applyRoundCardLayout(roundsContainer);

    if (resetScroll) {
        roundsContainer.scrollLeft = 0;
    } else if (preserveScrollLeft !== null) {
        roundsContainer.scrollLeft = preserveScrollLeft;
    }
}

let scoreSaveTimeout;
function updateScore(tournamentId, matchId) {
    clearTimeout(scoreSaveTimeout);
    scoreSaveTimeout = setTimeout(() => {
        submitScore(tournamentId, matchId);
    }, 300);
}

let playoffScoreSaveTimeout;
function updatePlayoffScore(tournamentId, roundNumber, matchNumber) {
    clearTimeout(playoffScoreSaveTimeout);
    playoffScoreSaveTimeout = setTimeout(() => {
        submitPlayoffScore(tournamentId, roundNumber, matchNumber);
    }, 300);
}

function getInputVersion(input) {
    if (!input) return 0;
    const parsed = Number.parseInt(input.dataset.version || '0', 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function setRoundRobinVersion(tournamentId, matchId, version) {
    const normalized = Number.isInteger(version) && version >= 0 ? version : 0;
    const input1 = document.getElementById(`${tournamentId}-${matchId}-score1`);
    const input2 = document.getElementById(`${tournamentId}-${matchId}-score2`);
    if (input1) input1.dataset.version = String(normalized);
    if (input2) input2.dataset.version = String(normalized);
}

function setPlayoffVersion(tournamentId, roundNumber, matchNumber, version) {
    const normalized = Number.isInteger(version) && version >= 0 ? version : 0;
    for (let teamSlot = 1; teamSlot <= 2; teamSlot += 1) {
        for (let gameIndex = 1; gameIndex <= 3; gameIndex += 1) {
            const input = document.getElementById(`${tournamentId}-playoff-r${roundNumber}-m${matchNumber}-t${teamSlot}-g${gameIndex}`);
            if (input) {
                input.dataset.version = String(normalized);
            }
        }
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, init, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await fetch(url, init);
            if (response.status >= 500 && attempt < retries) {
                await delay(200 * (2 ** attempt));
                continue;
            }
            return response;
        } catch (error) {
            if (attempt >= retries) throw error;
            await delay(200 * (2 ** attempt));
        }
    }
    throw new Error('Request failed');
}

async function readJsonSafe(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function submitPlayoffScore(tournamentId, roundNumber, matchNumber) {
    const getValue = (teamSlot, gameIndex) => {
        const input = document.getElementById(`${tournamentId}-playoff-r${roundNumber}-m${matchNumber}-t${teamSlot}-g${gameIndex}`);
        if (!input) return null;
        const raw = input.value.trim();
        if (raw === '') return null;
        const num = Number(raw);
        return Number.isInteger(num) ? num : null;
    };

    const games = {
        game1: { score1: getValue(1, 1), score2: getValue(2, 1) },
        game2: { score1: getValue(1, 2), score2: getValue(2, 2) },
        game3: { score1: getValue(1, 3), score2: getValue(2, 3) }
    };

    const hasAnyScore = Object.values(games).some(game => Number.isInteger(game.score1) || Number.isInteger(game.score2));
    if (!hasAnyScore) {
        games.game1.score1 = null;
        games.game1.score2 = null;
        games.game2.score1 = null;
        games.game2.score2 = null;
        games.game3.score1 = null;
        games.game3.score2 = null;
    }

    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const token = await auth.getAuthToken();
        const versionInput = document.getElementById(`${tournamentId}-playoff-r${roundNumber}-m${matchNumber}-t1-g1`)
            || document.getElementById(`${tournamentId}-playoff-r${roundNumber}-m${matchNumber}-t2-g1`);
        const expectedVersion = getInputVersion(versionInput);
        const response = await fetchWithRetry(`/api/tournaments/playoff/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roundNumber, matchNumber, games, expectedVersion })
        });
        const payload = await readJsonSafe(response);
        if (response.status === 409) {
            console.warn('Playoff score conflict; refreshing view.');
            renderTournamentView(tournamentId, { force: true, preserveScroll: true });
            return;
        }
        if (!response.ok) {
            console.error('Playoff score update error:', payload || response.statusText);
            return;
        }
        setPlayoffVersion(tournamentId, roundNumber, matchNumber, payload && payload.version);
        // Keep focus stable while entering scores; polling will sync other users.
    } catch (error) {
        console.error('Playoff score update error:', error);
    }
}

async function submitScore(tournamentId, matchId) {
    const input1 = document.getElementById(`${tournamentId}-${matchId}-score1`);
    const input2 = document.getElementById(`${tournamentId}-${matchId}-score2`);
    if (!input1 || !input2) return;
    const raw1 = input1.value.trim();
    const raw2 = input2.value.trim();
    const score1 = raw1 === '' ? null : Number(raw1);
    const score2 = raw2 === '' ? null : Number(raw2);
    if (score1 !== null && !Number.isInteger(score1)) return;
    if (score2 !== null && !Number.isInteger(score2)) return;

    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return;

    try {
        const token = await auth.getAuthToken();
        const expectedVersion = getInputVersion(input1);
        const response = await fetchWithRetry(`/api/tournaments/round-robin/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ matchId, score1, score2, expectedVersion })
        });
        const payload = await readJsonSafe(response);
        if (response.status === 409) {
            console.warn('Round robin score conflict; refreshing view.');
            renderTournamentView(tournamentId, { force: true, preserveScroll: true });
            return;
        }
        if (!response.ok) {
            console.error('Score update error:', payload || response.statusText);
            return;
        }
        setRoundRobinVersion(tournamentId, matchId, payload && payload.version);
        // Keep focus stable while entering scores; polling will sync other users.
    } catch (error) {
        console.error('Score update error:', error);
    }
}

async function renderRegistrationList(tournamentId) {
    const list = document.getElementById(`${tournamentId}-registration-list`);
    const count = document.getElementById(`${tournamentId}-registration-count`);
    if (!list || !count) return;

    const tournament = findUpcomingTournament(tournamentId);
    const doubles = tournament ? isDoublesTournament(tournament) : false;
    let teams = [];
    let maxTeams = 12;
    let status = 'registration';
    let duprRequired = false;
    try {
        teams = await fetchRegistrations(tournamentId);
        const settings = await fetchTournamentSettings(tournamentId);
        if (settings && Number.isInteger(settings.maxTeams)) {
            maxTeams = settings.maxTeams;
        }
        if (settings && settings.status) {
            status = settings.status;
        }
        if (settings && settings.duprRequired === true) {
            duprRequired = true;
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
    let authProfile = window.authProfile || null;
    if (!authProfile && currentUser && window.authUtils && window.authUtils.loadAuthProfile) {
        try {
            await window.authUtils.loadAuthProfile();
            authProfile = window.authProfile || null;
        } catch (error) {
            authProfile = null;
        }
    }
    const isAdmin = Boolean(authProfile && (authProfile.isAdmin || authProfile.isMasterAdmin));
    const isRegistered = currentUserId
        ? teams.some(team => (team.players || []).some(player => player.id === currentUserId))
        : false;

    count.textContent = `${teams.length} team${teams.length === 1 ? '' : 's'}`;

    if (!teams.length) {
        list.innerHTML = '<p class="text-sm text-gray-500">No teams registered yet.</p>';
    } else {
        const rows = teams.map((team, index) => {
            const players = team.players || [];
            const playerLines = players.map(player => {
                const rating = formatRating(player, doubles);
                const display = rating !== '-' ? `${player.name} (${rating})` : player.name;
                const removeButton = isAdmin
                    ? `<button onclick="removePlayer('${tournamentId}', '${player.id}')" class="text-xs text-red-600 hover:text-red-800 whitespace-nowrap ml-2">Remove</button>`
                    : '';
                return `<div class="text-sm text-gray-700 leading-5 flex items-center justify-between gap-3"><span class="flex-1">${display}</span>${removeButton}</div>`;
            }).join('');

            const needsPartner = doubles && players.length === 1;
            const joinControls = needsPartner
                ? `
                    <div class="flex items-center gap-2">
                        <button onclick="joinTeam('${tournamentId}', ${index})" class="text-xs font-semibold text-ocean-blue hover:text-ocean-teal whitespace-nowrap">Join</button>
                        ${isAdmin ? `<button onclick="addGuestPlayerQuick('${tournamentId}', '${team.id}')" class="text-xs font-semibold text-ocean-blue hover:text-ocean-teal whitespace-nowrap">Join as Guest</button>` : ''}
                    </div>
                `
                : '';

            return `
                <div class="flex items-center justify-between py-3 border-t border-gray-300 first:border-t-0">
                    <div class="flex-1 space-y-1">${playerLines || '<div class=\"text-sm text-gray-500\">Open team</div>'}</div>
                    ${joinControls ? `<div class="shrink-0 pl-2">${joinControls}</div>` : ''}
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
        let playoff = null;
        try {
            playoff = await fetchPlayoffState(tournamentId);
        } catch (error) {
            playoff = null;
        }
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
                if (playoff && playoff.status === 'playoff') {
                    resetButton.textContent = 'Return to Round Robin';
                    resetButton.onclick = () => resetPlayoff(tournamentId);
                } else {
                    resetButton.textContent = 'Return to Registration';
                    resetButton.onclick = () => resetRoundRobin(tournamentId);
                }
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
        await loadAdminSettings(tournamentId);
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
                actionButton.textContent = 'Register as Team';
                actionButton.setAttribute('onclick', `registerTeam('${tournamentId}')`);
                actionButton.disabled = false;
            }
        }
    }

    if (registrationActions) {
        const quickGuestButtonId = `${tournamentId}-add-guest-quick`;
        const existingQuickGuestButton = document.getElementById(quickGuestButtonId);
        if (isAdmin) {
            if (!existingQuickGuestButton) {
                const quickGuestButton = document.createElement('button');
                quickGuestButton.id = quickGuestButtonId;
                quickGuestButton.className = 'mt-2 block w-full text-center font-semibold py-2 rounded-lg border border-ocean-blue text-ocean-blue hover:bg-ocean-blue hover:text-white transition';
                quickGuestButton.textContent = 'Add Guest Team';
                quickGuestButton.onclick = () => addGuestPlayerQuick(tournamentId);
                registrationActions.appendChild(quickGuestButton);
            }
        } else if (existingQuickGuestButton) {
            existingQuickGuestButton.remove();
        }
    }

    if (capacityNote) {
        capacityNote.textContent = maxTeams === 6
            ? '6 team maximum'
            : `${maxTeams} team maximum`;
    }

    const adminSettings = document.getElementById(`${tournamentId}-admin-settings`);
    if (adminSettings && isAdmin) {
        loadAdminSettings(tournamentId);
        const hasMinTeams = teams.length >= 4;
        const allFull = teams.every(team => (team.players || []).length >= 2);
        const allDuprLinked = !duprRequired
            || teams.every(team => (team.players || []).every(player => Boolean(player.duprId)));
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
            startButton.disabled = !(hasMinTeams && allFull && allDuprLinked);
            startButton.classList.toggle('opacity-50', startButton.disabled);
            startButton.classList.toggle('cursor-not-allowed', startButton.disabled);
        }
    }
}

function toggleTournamentView(tournamentId) {
    const view = document.getElementById(`${tournamentId}-tournament-view`);
    const list = document.getElementById(`${tournamentId}-registration-list`);
    const buttonText = document.getElementById(`${tournamentId}-registration-button-text`);
    const modeLabel = 'Tournament';
    if (!view || !list || !buttonText) return;
    if (view.classList.contains('hidden')) {
        view.classList.remove('hidden');
        list.classList.add('hidden');
        buttonText.textContent = `Hide ${modeLabel}`;
        renderTournamentView(tournamentId);
        startTournamentPolling(tournamentId);
    } else {
        view.classList.add('hidden');
        list.classList.remove('hidden');
        buttonText.textContent = `View ${modeLabel}`;
        stopTournamentPolling(tournamentId);
    }
}

async function refreshTournamentButtons() {
    const tournaments = getUpcomingTournaments();
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
            const cached = localStorage.getItem(`tournament-settings-${tournament.id}`);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (typeof parsed.duprRequired === 'boolean') {
                        updateDuprBadge(tournament.id, parsed.duprRequired);
                    }
                } catch (parseError) {
                    // ignore
                }
            }
        }
    }
}

async function registerTeam(tournamentId) {
    setOpenRegistration(tournamentId);
    const user = await requireAuth();
    if (!user) return;
    const duprRequired = await getDuprRequiredSetting(tournamentId);
    if (duprRequired) {
        const linked = await ensureDuprLinked();
        if (!linked) return;
    }

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
    const duprRequired = await getDuprRequiredSetting(tournamentId);
    if (duprRequired) {
        const linked = await ensureDuprLinked();
        if (!linked) return;
    }

    const tournament = findUpcomingTournament(tournamentId);
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

async function addGuestPlayerQuick(tournamentId, teamId = null) {
    const auth = window.authUtils;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) {
        if (auth && auth.signIn) {
            await auth.signIn();
        }
        return;
    }

    const displayName = (window.prompt('Guest player name:') || '').trim();
    if (!displayName) return;

    try {
        await submitRegistration({
            action: 'add_guest',
            tournamentId,
            teamId,
            extra: { displayName }
        });
    } catch (error) {
        console.error('Add guest quick error:', error);
        alert('Failed to add guest player.');
    }
}

async function submitRegistration({ action, tournamentId, teamId, extra = {} }) {
    const token = await window.authUtils.getAuthToken();
    const response = await fetch(`/api/registrations/${tournamentId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, teamId, ...extra })
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

const RESULTS_VIEW_STATE_PREFIX = 'results-view-state-';

function resultsViewStateKey(tournamentId) {
    return `${RESULTS_VIEW_STATE_PREFIX}${tournamentId}`;
}

function getSavedResultsViewState(tournamentId) {
    const value = localStorage.getItem(resultsViewStateKey(tournamentId));
    if (value === 'roundRobin' || value === 'playoff' || value === 'summary') {
        return value;
    }
    return 'summary';
}

function saveResultsViewState(tournamentId, state) {
    localStorage.setItem(resultsViewStateKey(tournamentId), state);
}

function cleanupResultsViewStateStorage(resultsTournaments = []) {
    const validIds = new Set((resultsTournaments || []).map(t => t.id));
    const keysToDelete = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(RESULTS_VIEW_STATE_PREFIX)) continue;
        const tournamentId = key.slice(RESULTS_VIEW_STATE_PREFIX.length);
        const value = localStorage.getItem(key);
        if (!validIds.has(tournamentId)) {
            keysToDelete.push(key);
            continue;
        }
        if (value !== 'summary' && value !== 'roundRobin' && value !== 'playoff') {
            localStorage.setItem(key, 'summary');
        }
    }
    keysToDelete.forEach(key => localStorage.removeItem(key));
}

async function toggleResults(tournamentId) {
    const resultsDiv = document.getElementById(`${tournamentId}-results`);
    const buttonText = document.getElementById(`${tournamentId}-button-text`);
    
    if (!resultsDiv || !buttonText) return; // Safety check
    
    if (resultsDiv.classList.contains('hidden')) {
        resultsDiv.classList.remove('hidden');
        buttonText.textContent = 'Hide Results';
        
        // Load bracket if not already loaded
        if (!resultsDiv.dataset.loaded) {
            await loadTournamentBracket(tournamentId);
            resultsDiv.dataset.loaded = 'true';
        }
        const savedState = getSavedResultsViewState(tournamentId);
        const fullResultsAvailable = resultsDiv.dataset.fullResultsAvailable !== 'false';
        if (fullResultsAvailable && (savedState === 'roundRobin' || savedState === 'playoff')) {
            showFullResults(tournamentId, savedState);
        } else {
            showResultsSummary(tournamentId);
        }
    } else {
        resultsDiv.classList.add('hidden');
        buttonText.textContent = 'View Results';
    }
}

function setFullResultsTabState(tournamentId, section) {
    const roundRobinButton = document.getElementById(`${tournamentId}-full-round-robin-button`);
    const playoffButton = document.getElementById(`${tournamentId}-full-playoff-button`);
    if (!roundRobinButton || !playoffButton) return;
    const isRoundRobin = section === 'roundRobin';
    roundRobinButton.classList.toggle('bg-ocean-blue', isRoundRobin);
    roundRobinButton.classList.toggle('text-white', isRoundRobin);
    roundRobinButton.classList.toggle('bg-white', !isRoundRobin);
    roundRobinButton.classList.toggle('border', !isRoundRobin);
    roundRobinButton.classList.toggle('border-ocean-blue', !isRoundRobin);
    roundRobinButton.classList.toggle('text-ocean-blue', !isRoundRobin);
    roundRobinButton.classList.toggle('hover:bg-gray-100', !isRoundRobin);

    playoffButton.classList.toggle('bg-ocean-blue', !isRoundRobin);
    playoffButton.classList.toggle('text-white', !isRoundRobin);
    playoffButton.classList.toggle('bg-white', isRoundRobin);
    playoffButton.classList.toggle('border', isRoundRobin);
    playoffButton.classList.toggle('border-ocean-blue', isRoundRobin);
    playoffButton.classList.toggle('text-ocean-blue', isRoundRobin);
    playoffButton.classList.toggle('hover:bg-gray-100', isRoundRobin);
}

async function showFullResults(tournamentId, section = 'roundRobin') {
    const summary = document.getElementById(`${tournamentId}-results-summary`);
    const full = document.getElementById(`${tournamentId}-results-full`);
    const resultsRoot = document.getElementById(`${tournamentId}-results`);
    if (!summary || !full) return;
    summary.classList.add('hidden');
    full.classList.remove('hidden');
    const mode = section === 'playoff' ? 'playoff' : 'roundRobin';
    saveResultsViewState(tournamentId, mode);
    setFullResultsTabState(tournamentId, mode);
    await renderTournamentView(tournamentId, {
        force: true,
        allowNonTournament: true,
        readOnly: true,
        scoreEditMode: 'none',
        forceSection: mode,
        scrollToRound: 0
    });
    const roundsContainer = document.getElementById(`${tournamentId}-rounds-container`);
    if (roundsContainer) {
        roundsContainer.scrollLeft = 0;
    }
    if (resultsRoot) {
        requestAnimationFrame(() => {
            resultsRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}

function showResultsSummary(tournamentId) {
    const summary = document.getElementById(`${tournamentId}-results-summary`);
    const full = document.getElementById(`${tournamentId}-results-full`);
    if (!summary || !full) return;
    full.classList.add('hidden');
    summary.classList.remove('hidden');
    saveResultsViewState(tournamentId, 'summary');
}

async function loadTournamentBracket(tournamentId) {
    const tournament = getResultsTournaments().find(t => t.id === tournamentId);
    if (!tournament) return;
    const resultsDiv = document.getElementById(`${tournamentId}-results`);
    const fullView = document.getElementById(`${tournamentId}-results-full`);

    const photoWrap = document.getElementById(`${tournamentId}-photo-wrap`);
    if (photoWrap && !tournament.photoUrl) {
        photoWrap.classList.add('hidden');
    }

    const fullResultsAction = document.getElementById(`${tournamentId}-full-results-action`);
    const legacy = LEGACY_RESULTS_DATA[tournamentId];

    try {
        const rrData = await fetchRoundRobin(tournamentId);
        const hasRoundRobinData = Array.isArray(rrData.matches) && rrData.matches.length > 0;
        if (resultsDiv) {
            resultsDiv.dataset.fullResultsAvailable = hasRoundRobinData ? 'true' : 'false';
        }
        if (fullResultsAction) {
            fullResultsAction.classList.toggle('hidden', !hasRoundRobinData);
        }
        if (!hasRoundRobinData) {
            saveResultsViewState(tournamentId, 'summary');
            if (fullView && !fullView.classList.contains('hidden')) {
                showResultsSummary(tournamentId);
            }
        }
    } catch (error) {
        if (resultsDiv) {
            resultsDiv.dataset.fullResultsAvailable = 'false';
        }
        if (fullResultsAction) {
            fullResultsAction.classList.add('hidden');
        }
        saveResultsViewState(tournamentId, 'summary');
        if (fullView && !fullView.classList.contains('hidden')) {
            showResultsSummary(tournamentId);
        }
    }

    if (legacy && Array.isArray(legacy.matches) && legacy.matches.length) {
        renderBracket(tournamentId, legacy);
        return;
    }

    try {
        const response = await fetch(`/api/tournaments/playoff/${tournamentId}`);
        if (!response.ok) {
            throw new Error('Failed to load playoff data');
        }
        const data = await response.json();
        if (data.status !== 'playoff') {
            document.getElementById(`${tournamentId}-bracket`).innerHTML =
                '<p class="text-yellow-600">No playoff bracket data found.</p>';
            return;
        }
        renderPlayoffResultsBracket(tournamentId, data);
    } catch (error) {
        console.error('Error loading playoff results:', error);
        document.getElementById(`${tournamentId}-bracket`).innerHTML =
            '<p class="text-red-500">Error loading playoff results</p>';
    }
}

function parseLegacyScorePair(value) {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return null;
    return {
        team1: Number(match[1]),
        team2: Number(match[2])
    };
}

function normalizeDisplayScore(value, teamSlot) {
    if (Number.isInteger(value)) return value;
    const pair = parseLegacyScorePair(value);
    if (!pair) return null;
    return teamSlot === 1 ? pair.team1 : pair.team2;
}

function formatSingleGameScore(score1, score2) {
    let team1 = normalizeDisplayScore(score1, 1);
    let team2 = normalizeDisplayScore(score2, 2);

    // Backward compatibility: some legacy rows saved full "A-B" strings in one or both columns.
    if (team1 === null || team2 === null) {
        const pairFromScore1 = parseLegacyScorePair(score1);
        const pairFromScore2 = parseLegacyScorePair(score2);
        if (team1 === null) team1 = pairFromScore1?.team1 ?? pairFromScore2?.team1 ?? null;
        if (team2 === null) team2 = pairFromScore1?.team2 ?? pairFromScore2?.team2 ?? null;
    }

    if (!Number.isInteger(team1) || !Number.isInteger(team2)) return null;
    return { team1: String(team1), team2: String(team2) };
}

function formatBestOfThreeScore(score, teamSlot) {
    const list = [];
    const games = [
        [score.game1_score1, score.game1_score2],
        [score.game2_score1, score.game2_score2],
        [score.game3_score1, score.game3_score2]
    ];
    for (const [s1, s2] of games) {
        const formatted = formatSingleGameScore(s1, s2);
        // Only render consecutive completed games from the start.
        // This avoids showing sparse values that imply missing game slots.
        if (!formatted) break;
        list.push(teamSlot === 1 ? formatted.team1 : formatted.team2);
    }
    return list.length ? list.join(', ') : 'TBD';
}

function playoffScoreLabel(score, teamSlot, bestOfThreeEnabled) {
    if (!score) return 'TBD';
    if (bestOfThreeEnabled) {
        return formatBestOfThreeScore(score, teamSlot);
    }
    const single = formatSingleGameScore(score.game1_score1, score.game1_score2);
    if (!single) return 'TBD';
    return teamSlot === 1 ? single.team1 : single.team2;
}

function playoffResultsRoundClass(bracketSize, roundNumber) {
    if (bracketSize === 2) return 'finals';
    if (bracketSize === 4) return roundNumber === 1 ? 'semifinals' : 'finals';
    if (bracketSize >= 8) {
        if (roundNumber === 1) return 'quarterfinals';
        if (roundNumber === 2) return 'semifinals';
        return 'finals';
    }
    return '';
}

function formatTeamFirstNames(teamName) {
    const value = String(teamName || '').trim();
    if (!value || value.toUpperCase() === 'TBD') return 'TBD';
    const players = value.split('/').map(part => part.trim()).filter(Boolean);
    if (!players.length) return value;
    return players.map(player => {
        const first = player.split(/\s+/).filter(Boolean)[0];
        return first || player;
    }).join(' / ');
}

function renderPlayoffResultsBracket(tournamentId, playoff) {
    const bracketDiv = document.getElementById(`${tournamentId}-bracket`);
    if (!bracketDiv) return;

    const seedOrder = playoff.seedOrder || [];
    const scores = playoff.scores || [];
    const bracketSize = playoff.bracketSize || 2;
    const bestOfThree = playoff.bestOfThree === true;
    const bestOfThreeBronze = playoff.bestOfThreeBronze === true;
    const teamsMap = new Map((playoff.teams || []).map(team => [team.team_id, team.team_name || 'Team']));
    const rounds = computePlayoffRounds(seedOrder, bracketSize, scores, bestOfThree);
    const totalRounds = Math.log2(bracketSize);
    const scoreMap = buildPlayoffScoreMap(scores);

    const columns = rounds.map((roundMatches, roundIndex) => {
        const roundNumber = roundIndex + 1;
        const isFinal = roundNumber === totalRounds;
        const matchesHtml = roundMatches.map(match => {
            const team1 = formatTeamFirstNames(teamsMap.get(match.team1Id) || (match.team1Id ? 'Team' : 'TBD'));
            const team2 = formatTeamFirstNames(teamsMap.get(match.team2Id) || (match.team2Id ? 'Team' : 'TBD'));
            const score = match.score || null;
            const winnerId = playoffMatchWinner(
                { team1Id: match.team1Id, team2Id: match.team2Id },
                score,
                isFinal,
                bestOfThree,
                roundNumber
            );
            const matchClass = isFinal && match.matchNumber === 1 ? 'bracket-match gold' : 'bracket-match';
            const label = isFinal && match.matchNumber === 1
                ? '<div class="text-xs font-bold text-center mb-2" style="color: #d4a574;">🥇 GOLD MATCH</div>'
                : '';
            return `
                <div class="${matchClass}">
                    ${label}
                    <div class="bracket-team ${winnerId === match.team1Id ? 'winner' : ''}">
                        <span class="${winnerId === match.team1Id ? 'font-bold text-ocean-blue' : ''}">${team1}</span>
                        <span class="${winnerId === match.team1Id ? 'font-bold text-ocean-blue' : ''}">${playoffScoreLabel(score, 1, isFinal && bestOfThree)}</span>
                    </div>
                    <div class="bracket-team ${winnerId === match.team2Id ? 'winner' : ''}">
                        <span class="${winnerId === match.team2Id ? 'font-bold text-ocean-blue' : ''}">${team2}</span>
                        <span class="${winnerId === match.team2Id ? 'font-bold text-ocean-blue' : ''}">${playoffScoreLabel(score, 2, isFinal && bestOfThree)}</span>
                    </div>
                </div>
            `;
        }).join('');

        let bronzeHtml = '';
        if (isFinal && bracketSize >= 4) {
            const semiRound = rounds[totalRounds - 2] || [];
            const semiMatches = semiRound.map(match => ({
                ...match,
                score: scoreMap.get(`${totalRounds - 1}-${match.matchNumber}`) || match.score || null
            }));
            const losers = semiMatches.map(match => playoffMatchLoser(match, match.score, false, false, totalRounds - 1));
            const bronzeScore = scoreMap.get(`${totalRounds}-2`) || null;
            const bronzeTeam1 = formatTeamFirstNames(teamsMap.get(losers[0]) || 'TBD');
            const bronzeTeam2 = formatTeamFirstNames(teamsMap.get(losers[1]) || 'TBD');
            const bronzeWinnerId = playoffMatchWinner(
                { team1Id: losers[0] || null, team2Id: losers[1] || null },
                bronzeScore,
                true,
                bestOfThreeBronze,
                totalRounds
            );
            bronzeHtml = `
                <div class="bracket-match bronze">
                    <div class="text-xs font-bold text-center mb-2" style="color: #cd7f32;">🥉 BRONZE MATCH</div>
                    <div class="bracket-team ${bronzeWinnerId && bronzeWinnerId === losers[0] ? 'winner' : ''}">
                        <span class="${bronzeWinnerId && bronzeWinnerId === losers[0] ? 'font-bold text-ocean-blue' : ''}">${bronzeTeam1}</span>
                        <span class="${bronzeWinnerId && bronzeWinnerId === losers[0] ? 'font-bold text-ocean-blue' : ''}">${playoffScoreLabel(bronzeScore, 1, bestOfThreeBronze)}</span>
                    </div>
                    <div class="bracket-team ${bronzeWinnerId && bronzeWinnerId === losers[1] ? 'winner' : ''}">
                        <span class="${bronzeWinnerId && bronzeWinnerId === losers[1] ? 'font-bold text-ocean-blue' : ''}">${bronzeTeam2}</span>
                        <span class="${bronzeWinnerId && bronzeWinnerId === losers[1] ? 'font-bold text-ocean-blue' : ''}">${playoffScoreLabel(bronzeScore, 2, bestOfThreeBronze)}</span>
                    </div>
                </div>
            `;
        }

        const roundClass = playoffResultsRoundClass(bracketSize, roundNumber);

        return `
            <div class="bracket-round ${roundClass}">
                ${matchesHtml}
                ${bronzeHtml}
            </div>
        `;
    }).join('');

    bracketDiv.innerHTML = `<div class="playoff-results-bracket bracket-size-${bracketSize} flex gap-4 overflow-x-auto pb-4" style="align-items:center;">${columns}</div>`;
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
                        <span>${formatTeamFirstNames(match.team1)}</span>
                        <span>${match.team1Score}</span>
                    </div>
                    <div class="bracket-team ${winner === match.team2 ? 'winner' : ''}">
                        <span>${formatTeamFirstNames(match.team2)}</span>
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
                        <span>${formatTeamFirstNames(match.team1)}</span>
                        <span>${match.team1Score}</span>
                    </div>
                    <div class="bracket-team ${winner === match.team2 ? 'winner' : ''}">
                        <span>${formatTeamFirstNames(match.team2)}</span>
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
                    <span>${formatTeamFirstNames(goldMatch.team1)}</span>
                    <span>${goldMatch.team1Score}</span>
                </div>
                <div class="bracket-team ${winner === goldMatch.team2 ? 'winner' : ''}">
                    <span>${formatTeamFirstNames(goldMatch.team2)}</span>
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
                    <span>${formatTeamFirstNames(bronzeMatch.team1)}</span>
                    <span>${bronzeMatch.team1Score}</span>
                </div>
                <div class="bracket-team ${winner === bronzeMatch.team2 ? 'winner' : ''}">
                    <span>${formatTeamFirstNames(bronzeMatch.team2)}</span>
                    <span>${bronzeMatch.team2Score}</span>
                </div>
            </div>
        `;
    }

    html += '</div></div>';

    bracketDiv.innerHTML = html;
}

// ========================================
// DUPR SUBMITTED MATCH HISTORY (ADMIN ONLY)
// ========================================

function canManageDuprMatches() {
    return Boolean(window.authProfile && window.authProfile.isAdmin);
}

function pairText(player1, player2) {
    return player2 ? `${player1} / ${player2}` : player1;
}

function matchScoreSummary(match) {
    const parts = [];
    const games = [
        [match.teamA.game1, match.teamB.game1],
        [match.teamA.game2, match.teamB.game2],
        [match.teamA.game3, match.teamB.game3],
        [match.teamA.game4, match.teamB.game4],
        [match.teamA.game5, match.teamB.game5]
    ];
    games.forEach(([a, b]) => {
        if (Number.isInteger(a) && Number.isInteger(b)) {
            parts.push(`${a}-${b}`);
        }
    });
    return parts.join(', ');
}

function normalizeDateLabel(value) {
    const date = value ? new Date(`${value}T00:00:00`) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Date TBD';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function duprHistoryRequest(method, url, body = null) {
    const auth = window.authUtils;
    if (!auth || !auth.getAuthToken) {
        throw new Error('Sign in to manage DUPR matches');
    }
    const token = await auth.getAuthToken();
    if (!token) {
        throw new Error('Sign in to manage DUPR matches');
    }

    const response = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload;
}

function getDuprHistorySection() {
    return document.getElementById('dupr-match-history-section');
}

function closeCreateDuprMatchForm() {
    duprMatchHistoryState.createOpen = false;
    const formWrap = document.getElementById('dupr-match-form-wrap');
    if (formWrap) {
        formWrap.classList.add('hidden');
        formWrap.innerHTML = '';
    }
}

function buildCreatePlayerOptions() {
    return duprMatchHistoryState.eligiblePlayers.map(player => (
        `<option value="${player.id}">${player.displayName} (${player.duprId})</option>`
    )).join('');
}

function openCreateDuprMatchForm() {
    duprMatchHistoryState.createOpen = true;
    const formWrap = document.getElementById('dupr-match-form-wrap');
    if (!formWrap) return;
    const playerOptions = buildCreatePlayerOptions();
    if (!playerOptions) {
        formWrap.classList.remove('hidden');
        formWrap.innerHTML = '<p class="text-sm text-red-600">No eligible linked players found.</p>';
        return;
    }

    formWrap.classList.remove('hidden');
    formWrap.innerHTML = `
        <div class="space-y-3">
            <h3 class="text-lg font-semibold text-ocean-blue">Create DUPR Match</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input id="dupr-create-event" class="px-3 py-2 border border-gray-300 rounded" placeholder="Event name" />
                <input id="dupr-create-date" type="date" class="px-3 py-2 border border-gray-300 rounded" />
                <input id="dupr-create-bracket" class="px-3 py-2 border border-gray-300 rounded" placeholder="Bracket (optional)" />
                <input id="dupr-create-location" class="px-3 py-2 border border-gray-300 rounded" placeholder="Location (optional)" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="space-y-2">
                    <p class="text-xs font-semibold text-gray-600 uppercase">Team A</p>
                    <select id="dupr-create-team-a1" class="w-full px-3 py-2 border border-gray-300 rounded"><option value="">Player 1</option>${playerOptions}</select>
                    <select id="dupr-create-team-a2" class="w-full px-3 py-2 border border-gray-300 rounded"><option value="">Player 2 (optional)</option>${playerOptions}</select>
                </div>
                <div class="space-y-2">
                    <p class="text-xs font-semibold text-gray-600 uppercase">Team B</p>
                    <select id="dupr-create-team-b1" class="w-full px-3 py-2 border border-gray-300 rounded"><option value="">Player 1</option>${playerOptions}</select>
                    <select id="dupr-create-team-b2" class="w-full px-3 py-2 border border-gray-300 rounded"><option value="">Player 2 (optional)</option>${playerOptions}</select>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
                <input id="dupr-create-g1a" type="number" min="0" class="px-2 py-2 border border-gray-300 rounded" placeholder="A G1" />
                <input id="dupr-create-g1b" type="number" min="0" class="px-2 py-2 border border-gray-300 rounded" placeholder="B G1" />
                <span class="text-xs text-gray-500 self-center">Game 1 (required)</span>
                <input id="dupr-create-g2a" type="number" min="0" class="px-2 py-2 border border-gray-300 rounded" placeholder="A G2" />
                <input id="dupr-create-g2b" type="number" min="0" class="px-2 py-2 border border-gray-300 rounded" placeholder="B G2" />
                <span class="text-xs text-gray-500 self-center">Game 2 (optional)</span>
                <input id="dupr-create-g3a" type="number" min="0" class="px-2 py-2 border border-gray-300 rounded" placeholder="A G3" />
                <input id="dupr-create-g3b" type="number" min="0" class="px-2 py-2 border border-gray-300 rounded" placeholder="B G3" />
                <span class="text-xs text-gray-500 self-center">Game 3 (optional)</span>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="submitCreateDuprMatch()" class="bg-ocean-blue text-white px-4 py-2 rounded-lg font-semibold hover:bg-ocean-teal transition">Create</button>
                <button onclick="closeCreateDuprMatchForm()" class="bg-white border border-gray-300 text-ocean-blue px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition">Cancel</button>
            </div>
        </div>
    `;
}

function buildGamesFromForm(prefix) {
    const pairs = [
        [`${prefix}-g1a`, `${prefix}-g1b`],
        [`${prefix}-g2a`, `${prefix}-g2b`],
        [`${prefix}-g3a`, `${prefix}-g3b`]
    ];
    const games = [];
    pairs.forEach(([aId, bId]) => {
        const aRaw = document.getElementById(aId)?.value;
        const bRaw = document.getElementById(bId)?.value;
        const hasA = String(aRaw || '').trim() !== '';
        const hasB = String(bRaw || '').trim() !== '';
        if (!hasA && !hasB) return;
        if (!hasA || !hasB) {
            throw new Error('Both team scores are required for each entered game');
        }
        const teamA = Number.parseInt(aRaw, 10);
        const teamB = Number.parseInt(bRaw, 10);
        if (!Number.isInteger(teamA) || !Number.isInteger(teamB) || teamA === teamB) {
            throw new Error('Game scores must be integers and cannot be tied');
        }
        games.push({ teamA, teamB });
    });
    return games;
}

async function submitCreateDuprMatch() {
    try {
        const payload = {
            eventName: (document.getElementById('dupr-create-event')?.value || '').trim(),
            matchDate: (document.getElementById('dupr-create-date')?.value || '').trim(),
            bracketName: (document.getElementById('dupr-create-bracket')?.value || '').trim(),
            location: (document.getElementById('dupr-create-location')?.value || '').trim(),
            teamA: {
                player1Id: (document.getElementById('dupr-create-team-a1')?.value || '').trim(),
                player2Id: (document.getElementById('dupr-create-team-a2')?.value || '').trim()
            },
            teamB: {
                player1Id: (document.getElementById('dupr-create-team-b1')?.value || '').trim(),
                player2Id: (document.getElementById('dupr-create-team-b2')?.value || '').trim()
            },
            games: buildGamesFromForm('dupr-create')
        };
        await duprHistoryRequest('POST', '/api/dupr/submitted-matches', payload);
        closeCreateDuprMatchForm();
        await loadDuprMatchHistory();
    } catch (error) {
        alert(error.message || 'Unable to create DUPR match');
    }
}

function beginEditDuprMatch(matchId) {
    duprMatchHistoryState.editId = Number(matchId);
    renderDuprMatchHistory();
}

function cancelEditDuprMatch() {
    duprMatchHistoryState.editId = null;
    renderDuprMatchHistory();
}

async function saveEditDuprMatch(matchId) {
    try {
        const id = Number(matchId);
        const payload = {
            eventName: (document.getElementById(`dupr-edit-event-${id}`)?.value || '').trim(),
            matchDate: (document.getElementById(`dupr-edit-date-${id}`)?.value || '').trim(),
            bracketName: (document.getElementById(`dupr-edit-bracket-${id}`)?.value || '').trim(),
            location: (document.getElementById(`dupr-edit-location-${id}`)?.value || '').trim(),
            games: buildGamesFromForm(`dupr-edit-${id}`)
        };
        await duprHistoryRequest('PATCH', `/api/dupr/submitted-matches/${id}`, payload);
        duprMatchHistoryState.editId = null;
        await loadDuprMatchHistory();
    } catch (error) {
        alert(error.message || 'Unable to update DUPR match');
    }
}

async function deleteDuprMatch(matchId) {
    const id = Number(matchId);
    const confirmed = window.confirm('Delete this match from DUPR?');
    if (!confirmed) return;
    try {
        await duprHistoryRequest('DELETE', `/api/dupr/submitted-matches/${id}`);
        if (duprMatchHistoryState.editId === id) {
            duprMatchHistoryState.editId = null;
        }
        await loadDuprMatchHistory();
    } catch (error) {
        alert(error.message || 'Unable to delete DUPR match');
    }
}

function renderDuprMatchHistory() {
    const section = getDuprHistorySection();
    if (!section) return;
    const createButton = document.getElementById('dupr-match-create-button');
    const list = document.getElementById('dupr-match-history-list');
    if (!list) return;

    if (!canManageDuprMatches()) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    if (createButton && createButton.dataset.bound !== 'true') {
        createButton.dataset.bound = 'true';
        createButton.addEventListener('click', openCreateDuprMatchForm);
    }

    if (!duprMatchHistoryState.matches.length) {
        list.innerHTML = '<p class="text-sm text-gray-600">No submitted matches yet.</p>';
        return;
    }

    const rowsHtml = duprMatchHistoryState.matches.map(match => {
        const isEditing = duprMatchHistoryState.editId === match.id;
        const statusClass = match.status === 'deleted'
            ? 'text-red-600'
            : (match.status === 'updated' ? 'text-ocean-teal' : 'text-ocean-blue');
        const score = matchScoreSummary(match);
        const canEdit = match.status !== 'deleted' && Number.isInteger(match.duprMatchId);
        const canDelete = match.status !== 'deleted' && Boolean(match.duprMatchCode);

        if (!isEditing) {
            return `
                <div class="border border-gray-200 rounded-lg bg-white p-3">
                    <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 text-sm">
                        <span class="font-semibold text-ocean-blue whitespace-nowrap">${normalizeDateLabel(match.matchDate)}</span>
                        <span class="font-semibold">${match.eventName}</span>
                        <span class="text-gray-600">${pairText(match.teamA.player1, match.teamA.player2)} vs ${pairText(match.teamB.player1, match.teamB.player2)}</span>
                        <span class="font-mono text-xs text-gray-700">${score || 'No score'}</span>
                        <span class="font-semibold ${statusClass} uppercase text-xs">${match.status}</span>
                        <div class="md:ml-auto flex items-center gap-1">
                            <button onclick="beginEditDuprMatch(${match.id})" class="px-2 py-1 rounded border border-gray-300 text-ocean-blue ${canEdit ? 'hover:bg-gray-100' : 'opacity-40 cursor-not-allowed'}" ${canEdit ? '' : 'disabled'} title="Edit and resubmit">✎</button>
                            <button onclick="deleteDuprMatch(${match.id})" class="px-2 py-1 rounded border border-red-300 text-red-600 ${canDelete ? 'hover:bg-red-50' : 'opacity-40 cursor-not-allowed'}" ${canDelete ? '' : 'disabled'} title="Delete from DUPR">✕</button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="border border-ocean-blue rounded-lg bg-white p-3 space-y-2">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input id="dupr-edit-event-${match.id}" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${(match.eventName || '').replace(/"/g, '&quot;')}" />
                    <input id="dupr-edit-date-${match.id}" type="date" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${match.matchDate || ''}" />
                    <input id="dupr-edit-bracket-${match.id}" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${(match.bracketName || '').replace(/"/g, '&quot;')}" />
                    <input id="dupr-edit-location-${match.id}" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${(match.location || '').replace(/"/g, '&quot;')}" />
                </div>
                <div class="grid grid-cols-6 gap-2 items-center">
                    <span class="text-xs text-gray-600">G1</span>
                    <input id="dupr-edit-${match.id}-g1a" type="number" min="0" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${Number.isInteger(match.teamA.game1) ? match.teamA.game1 : ''}" />
                    <input id="dupr-edit-${match.id}-g1b" type="number" min="0" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${Number.isInteger(match.teamB.game1) ? match.teamB.game1 : ''}" />
                    <span class="text-xs text-gray-600">G2</span>
                    <input id="dupr-edit-${match.id}-g2a" type="number" min="0" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${Number.isInteger(match.teamA.game2) ? match.teamA.game2 : ''}" />
                    <input id="dupr-edit-${match.id}-g2b" type="number" min="0" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${Number.isInteger(match.teamB.game2) ? match.teamB.game2 : ''}" />
                    <span class="text-xs text-gray-600">G3</span>
                    <input id="dupr-edit-${match.id}-g3a" type="number" min="0" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${Number.isInteger(match.teamA.game3) ? match.teamA.game3 : ''}" />
                    <input id="dupr-edit-${match.id}-g3b" type="number" min="0" class="px-2 py-1 border border-gray-300 rounded text-sm" value="${Number.isInteger(match.teamB.game3) ? match.teamB.game3 : ''}" />
                </div>
                <div class="flex items-center justify-end gap-2">
                    <button onclick="cancelEditDuprMatch()" class="px-2 py-1 rounded border border-gray-300 text-ocean-blue hover:bg-gray-100">✕</button>
                    <button onclick="saveEditDuprMatch(${match.id})" class="px-2 py-1 rounded border border-ocean-blue text-ocean-blue hover:bg-gray-100">✓</button>
                </div>
            </div>
        `;
    }).join('');

    list.innerHTML = rowsHtml;
}

async function loadDuprMatchHistory() {
    const section = getDuprHistorySection();
    if (!section) return;
    if (!canManageDuprMatches()) {
        section.classList.add('hidden');
        return;
    }

    try {
        const payload = await duprHistoryRequest('GET', '/api/dupr/submitted-matches');
        duprMatchHistoryState.matches = Array.isArray(payload.matches) ? payload.matches : [];
        duprMatchHistoryState.eligiblePlayers = Array.isArray(payload.eligiblePlayers) ? payload.eligiblePlayers : [];
        renderDuprMatchHistory();
    } catch (error) {
        section.classList.remove('hidden');
        const list = document.getElementById('dupr-match-history-list');
        if (list) {
            list.innerHTML = `<p class="text-sm text-red-600">${error.message || 'Unable to load DUPR history.'}</p>`;
        }
    }
}

window.openCreateDuprMatchForm = openCreateDuprMatchForm;
window.closeCreateDuprMatchForm = closeCreateDuprMatchForm;
window.submitCreateDuprMatch = submitCreateDuprMatch;
window.beginEditDuprMatch = beginEditDuprMatch;
window.cancelEditDuprMatch = cancelEditDuprMatch;
window.saveEditDuprMatch = saveEditDuprMatch;
window.deleteDuprMatch = deleteDuprMatch;

// ========================================
// INITIALIZATION
// ========================================

// Render tournaments when page loads
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadTournaments();
    } catch (error) {
        console.error('Failed to load tournaments:', error);
    }
    renderUpcomingTournaments();
    renderResults();
    ensureTournamentsCarouselBindings();
    requestAnimationFrame(updateTournamentsCarouselArrows);
    ensureResultsCarouselBindings();
    requestAnimationFrame(updateResultsCarouselArrows);
    refreshAdminDetailEditors();
    renderDuprMatchHistory();
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
            refreshAdminDetailEditors();
            const openPanels = document.querySelectorAll('[id$="-registration"]:not(.hidden)');
            openPanels.forEach(panel => {
                const tournamentId = panel.id.replace('-registration', '');
                renderRegistrationList(tournamentId);
            });
            return loadDuprMatchHistory();
        }).catch(() => {});
    }
    
    // Check status every minute
    setInterval(checkTournamentStatus, 60000);
});

window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushSettingsSaves();
        flushPlayoffSettingsSaves();
    }
});

window.addEventListener('beforeunload', () => {
    flushSettingsSaves();
    flushPlayoffSettingsSaves();
});

window.addEventListener('resize', () => {
    document.querySelectorAll('[id$="-rounds-container"]').forEach(container => {
        applyRoundCardLayout(container);
    });
});

window.addEventListener('auth:changed', () => {
    refreshAdminDetailEditors();
    const openPanels = document.querySelectorAll('[id$="-registration"]:not(.hidden)');
    openPanels.forEach(panel => {
        const tournamentId = panel.id.replace('-registration', '');
        renderRegistrationList(tournamentId);
    });
    loadDuprMatchHistory().catch(() => {});
});
