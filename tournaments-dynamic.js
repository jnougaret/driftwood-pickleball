// ========================================
// DYNAMIC TOURNAMENT RENDERING
// This script renders tournaments from the DB-backed /api/tournaments endpoint
// ========================================

let tournamentStore = {
    upcoming: [],
    results: []
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
        return;
    }

    tournaments.forEach(tournament => {
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
    
    const tournaments = getResultsTournaments();
    if (!tournaments.length) {
        container.innerHTML = '<p class="text-sm text-gray-500">No completed results yet.</p>';
        return;
    }

    tournaments.forEach(tournament => {
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
                <h3 id="${tournament.id}-title" class="text-2xl font-bold mb-2">${tournament.title}</h3>
                <p id="${tournament.id}-start-line" class="text-gray-200">${tournament.startTime} @ ${tournament.location}</p>
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
                        <span class="font-semibold">${tournament.prizeSplit}</span>
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
                        Copy Tournament
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
                            <h4 class="text-xl font-bold text-ocean-blue" id="${tournament.id}-tournament-title">Round Robin</h4>
                            <div id="${tournament.id}-tournament-actions" class="flex items-center gap-2"></div>
                        </div>
                        <div id="${tournament.id}-rounds-container" class="rounds-scroll flex gap-2 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"></div>
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
                <div id="${tournament.id}-results-admin-actions" class="hidden mt-3 flex items-center justify-end gap-2">
                    <button
                        onclick="archiveResultsCard('${tournament.id}')"
                        class="bg-white border border-ocean-blue text-ocean-blue hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        Archive
                    </button>
                    <button
                        onclick="deleteTournamentCard('${tournament.id}')"
                        class="bg-white border border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        Delete
                    </button>
                </div>
            </div>
            
            <!-- Expandable Results -->
            <div id="${tournament.id}-results" class="hidden border-t-2 border-gray-200">
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
    getUpcomingTournaments().forEach(tournament => {
        const actionRow = document.getElementById(`${tournament.id}-admin-edit-actions`);
        if (!actionRow) return;
        if (isAdmin) {
            actionRow.classList.remove('hidden');
            actionRow.classList.add('flex');
        } else {
            actionRow.classList.add('hidden');
            actionRow.classList.remove('flex');
            toggleTournamentDetailsEditor(tournament.id, false);
        }
    });

    getResultsTournaments().forEach(tournament => {
        const resultsActions = document.getElementById(`${tournament.id}-results-admin-actions`);
        if (!resultsActions) return;
        if (isAdmin) {
            resultsActions.classList.remove('hidden');
            resultsActions.classList.add('flex');
        } else {
            resultsActions.classList.add('hidden');
            resultsActions.classList.remove('flex');
        }
    });
}

function updateTournamentInStore(updatedTournament) {
    if (!updatedTournament || !updatedTournament.id) return;
    tournamentStore.upcoming = getUpcomingTournaments().map(tournament => (
        tournament.id === updatedTournament.id ? { ...tournament, ...updatedTournament } : tournament
    ));
}

function updateTournamentCardDisplay(tournament) {
    const titleEl = document.getElementById(`${tournament.id}-title`);
    const startLineEl = document.getElementById(`${tournament.id}-start-line`);
    const formatEl = document.getElementById(`${tournament.id}-format-line`);
    const skillEl = document.getElementById(`${tournament.id}-skill-line`);
    const feeEl = document.getElementById(`${tournament.id}-fee-line`);

    if (titleEl) titleEl.textContent = tournament.title;
    if (startLineEl) {
        const startLine = formatStartLine(tournament.startDate, tournament.startTimeEt, tournament.startTime);
        startLineEl.textContent = `${startLine} @ ${tournament.location}`;
    }
    if (formatEl) formatEl.textContent = formatFormatType(tournament.formatType);
    if (skillEl) skillEl.textContent = formatSkillText(tournament.skillLevelCap);
    if (feeEl) feeEl.textContent = formatEntryFeeText(tournament.entryFeeAmount);
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
        if (titleInput) titleInput.value = tournament.title || '';
        if (dateInput) dateInput.value = tournament.startDate || '';
        if (timeInput) timeInput.value = tournament.startTimeEt || '';
        if (locationInput) locationInput.value = tournament.location || '';
        if (formatInput) formatInput.value = tournament.formatType === 'mixed_doubles' ? 'mixed_doubles' : 'coed_doubles';
        if (skillInput) skillInput.value = Number.isFinite(tournament.skillLevelCap) ? tournament.skillLevelCap : '';
        if (feeInput) feeInput.value = Number.isFinite(tournament.entryFeeAmount) ? tournament.entryFeeAmount : '';
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
    if (!titleInput || !dateInput || !timeInput || !locationInput || !formatInput || !skillInput || !feeInput) {
        return;
    }

    const payload = {
        title: titleInput.value.trim(),
        startDate: dateInput.value || null,
        startTimeEt: timeInput.value || null,
        location: locationInput.value.trim(),
        formatType: formatInput.value === 'mixed_doubles' ? 'mixed_doubles' : 'coed_doubles',
        skillLevelCap: skillInput.value === '' ? null : Number(skillInput.value),
        entryFeeAmount: feeInput.value === '' ? null : Number(feeInput.value)
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
            copyButton.textContent = previousText || 'Copy Tournament';
        }
    }
}

async function manageTournament(tournamentId, action) {
    if (!(window.authProfile && window.authProfile.isAdmin)) return false;
    try {
        const token = await window.authUtils.getAuthToken();
        const response = await fetch(`/api/tournaments/manage/${tournamentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action })
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
            playoffBestOfThreeBronze: data.playoffBestOfThreeBronze
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
        <div class="space-y-1 text-sm text-gray-700">
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
    const useGold = index % 2 === 1;
    if (useGold) {
        return {
            bg: '#d9a03a',
            border: 'rgba(217,160,58,0.55)',
            titleClass: 'text-ocean-blue',
            mutedClass: 'text-ocean-blue/80',
            emptyClass: 'text-ocean-blue/80'
        };
    }
    return {
        bg: '#1a3a52',
        border: 'rgba(26,58,82,0.35)',
        titleClass: 'text-white',
        mutedClass: 'text-white/60',
        emptyClass: 'text-white/70'
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
        <div class="space-y-1 text-sm text-white">
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
        applySettingsToInputs(tournamentId, { maxTeams: 12, rounds: 6 }, 6);
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
        if (data.status !== 'tournament') {
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
        const isAdmin = Boolean((window.authProfile && window.authProfile.isAdmin) || hasAdminTournamentAction);
        const title = document.getElementById(`${tournamentId}-tournament-title`);
        if (playoff && playoff.status === 'playoff') {
            if (title) {
                title.textContent = 'Playoffs';
            }
            const resetScroll = Number.isInteger(options.scrollToRound) && options.scrollToRound === 0;
            const preserveScroll = options.preserveScroll === true && !resetScroll;
            const currentScrollLeft = preserveScroll ? roundsContainer.scrollLeft : null;
            renderPlayoffView(tournamentId, playoff, teamPlayers, currentUserId, isAdmin, resetScroll, currentScrollLeft);
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
                        <div class="bg-white rounded-lg p-3 flex items-center justify-between gap-3">
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
                    <div class="min-w-[calc(100%-0.5rem)] md:min-w-[290px] snap-start md:snap-center border rounded-xl p-3" style="background-color: ${theme.bg}; border-color: ${theme.border};">
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
                const canEdit = isAdmin || (currentUserId && (team1Players.includes(currentUserId) || team2Players.includes(currentUserId)));
                return `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${formatTeamNameLines(match.team1_name || 'Team 1')}
                            ${scoreInputHtml(tournamentId, match.match_id, 1, match.score1, canEdit, match.version)}
                        </div>
                        <div class="h-px bg-ocean-blue/50"></div>
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
                <div class="bg-gray-100 border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between gap-3 text-gray-600">
                    ${formatTeamNameLines(byeTeam.team_name || 'Team')}
                    <span class="text-xs uppercase tracking-wide text-gray-500">Bye</span>
                </div>
            ` : '';

            return `
                <div class="min-w-[calc(100%-0.5rem)] md:min-w-[290px] snap-start md:snap-center border rounded-xl p-3" style="background-color: ${theme.bg}; border-color: ${theme.border};">
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
    const disabled = canEdit ? '' : 'disabled';
    const disabledClass = '';
    return `<input
        type="number"
        inputmode="numeric"
        class="score-input px-1 py-0.5 border border-gray-300 rounded text-right self-center ${disabledClass}"
        value="${val}"
        id="${tournamentId}-${matchId}-score${slot}"
        data-version="${Number.isInteger(version) ? version : 0}"
        ${disabled}
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
    const disabled = canEdit ? '' : 'disabled';
    return `<input
        type="number"
        inputmode="numeric"
        class="score-input px-1 py-0.5 border border-gray-300 rounded text-right self-center"
        value="${val}"
        id="${tournamentId}-playoff-r${roundNumber}-m${matchNumber}-t${teamSlot}-g${gameIndex}"
        data-version="${Number.isInteger(version) ? version : 0}"
        ${disabled}
        oninput="updatePlayoffScore('${tournamentId}', ${roundNumber}, ${matchNumber})"
    >`;
}

function playoffRoundLabel(bracketSize, roundNumber) {
    if (bracketSize === 2) return 'Finals';
    if (bracketSize === 4) return roundNumber === 1 ? 'Semi-finals' : 'Finals';
    if (bracketSize === 8) return roundNumber === 1 ? 'Quarter-finals' : (roundNumber === 2 ? 'Semi-finals' : 'Finals');
    return `Round ${roundNumber}`;
}

async function renderPlayoffView(tournamentId, playoff, teamPlayers, currentUserId, isAdmin, resetScroll = false, preserveScrollLeft = null) {
    const roundsContainer = document.getElementById(`${tournamentId}-rounds-container`);
    if (!roundsContainer) return;

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
            const canEdit = isAdmin || (currentUserId && match.team1Id && match.team2Id && (team1Players.includes(currentUserId) || team2Players.includes(currentUserId)));
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
                        <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                            <div class="flex items-center justify-between gap-3 text-gray-600">
                                ${renderTeamName(team1Name, nameFormatter)}
                                ${renderInputs(1, [team1Score1, team1Score2, team1Score3], isFinal && bestOfThree, matchVersion)}
                            </div>
                            <div class="h-px bg-ocean-blue/50"></div>
                            <div class="flex items-center justify-between gap-3 text-gray-500">
                                ${formatTbdLine()}
                                ${renderInputs(2, [null, null, null], isFinal && bestOfThree, matchVersion)}
                            </div>
                        </div>
                    `;
                }
                return `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-3 text-gray-600">
                        ${renderTeamName(team1Name, nameFormatter)}
                        <span class="text-xs uppercase tracking-wide text-gray-500">Bye</span>
                    </div>
                `;
            }
            if (!match.team1Id && match.team2Id) {
                if (roundNumber > 1) {
                    return `
                        <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                            <div class="flex items-center justify-between gap-3 text-gray-500">
                                ${formatTbdLine()}
                                ${renderInputs(1, [null, null, null], isFinal && bestOfThree, matchVersion)}
                            </div>
                            <div class="h-px bg-ocean-blue/50"></div>
                            <div class="flex items-center justify-between gap-3 text-gray-600">
                                ${renderTeamName(team2Name, nameFormatter)}
                                ${renderInputs(2, [team2Score1, team2Score2, team2Score3], isFinal && bestOfThree, matchVersion)}
                            </div>
                        </div>
                    `;
                }
                return `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-3 text-gray-600">
                        ${renderTeamName(team2Name, nameFormatter)}
                        <span class="text-xs uppercase tracking-wide text-gray-500">Bye</span>
                    </div>
                `;
            }
            if (!match.team1Id && !match.team2Id) {
                return `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3 text-gray-500">
                            ${formatTbdLine()}
                        </div>
                        <div class="h-px bg-ocean-blue/50"></div>
                        <div class="flex items-center justify-between gap-3 text-gray-500">
                            ${formatTbdLine()}
                        </div>
                    </div>
                `;
            }
            return `
                <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${renderTeamName(team1Name, nameFormatter)}
                            ${renderInputs(1, [team1Score1, team1Score2, team1Score3], isFinal && bestOfThree, matchVersion)}
                        </div>
                        <div class="h-px bg-ocean-blue/50"></div>
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
            const bronzeCanEdit = isAdmin || (currentUserId && bronzeTeam1 && bronzeTeam2 && (bronzeTeam1Players.includes(currentUserId) || bronzeTeam2Players.includes(currentUserId)));
            const bronzeInputs = (teamSlot, values) => `
                <div class="flex items-center gap-2">
                    ${scoreInputHtmlPlayoff(tournamentId, roundNumber, 2, teamSlot, 1, values[0], bronzeCanEdit, bronzeVersion)}
                    ${bestOfThreeBronze ? scoreInputHtmlPlayoff(tournamentId, roundNumber, 2, teamSlot, 2, values[1], bronzeCanEdit, bronzeVersion) : ''}
                    ${bestOfThreeBronze ? scoreInputHtmlPlayoff(tournamentId, roundNumber, 2, teamSlot, 3, values[2], bronzeCanEdit, bronzeVersion) : ''}
                </div>
            `;

            if (bronzeTeam1 || bronzeTeam2) {
                bronzeHtml = `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3 text-gray-600">
                            ${renderTeamName(bronzeTeam1Name, bronzeNameFormatter)}
                            ${bronzeInputs(1, [
                                bronzeScore ? bronzeScore.game1_score1 : null,
                                bronzeScore ? bronzeScore.game2_score1 : null,
                                bronzeScore ? bronzeScore.game3_score1 : null
                            ])}
                        </div>
                        <div class="h-px bg-ocean-blue/50"></div>
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
                    <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3 text-gray-500">
                            ${formatTbdLine()}
                        </div>
                        <div class="h-px bg-ocean-blue/50"></div>
                        <div class="flex items-center justify-between gap-3 text-gray-500">
                            ${formatTbdLine()}
                        </div>
                    </div>
                `;
            }

        }

        const archiveButton = isFinal && isAdmin
            ? `
                <button
                    class="mt-4 w-full bg-ocean-blue text-white px-4 py-2 rounded-lg hover:bg-ocean-teal transition font-semibold"
                    onclick="archiveTournamentResults('${tournamentId}')"
                >
                    Archive Results
                </button>
            `
            : '';

        return `
            <div class="min-w-[calc(100%-0.5rem)] md:min-w-[290px] snap-start md:snap-center border rounded-xl p-3" style="background-color: ${theme.bg}; border-color: ${theme.border};">
                <h5 class="text-lg font-semibold ${theme.titleClass} mb-3">${playoffRoundLabel(bracketSize, roundNumber)}</h5>
                ${isFinal && bracketSize >= 4 ? `<div class="text-xs uppercase tracking-wide ${theme.mutedClass} mb-2">Gold Match</div>` : ''}
                <div class="space-y-4">${matchesHtml || `<div class="text-sm ${theme.emptyClass}">No matches scheduled.</div>`}</div>
                ${isFinal && bracketSize >= 4 ? `<div class="text-xs uppercase tracking-wide ${theme.mutedClass} mt-4 mb-2">Bronze Match</div>` : ''}
                ${bronzeHtml}
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
    const isAdmin = window.authProfile && window.authProfile.isAdmin;
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
                actionButton.textContent = 'Register Team';
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

    const parseRating = (label) => {
        const raw = window.prompt(`${label} (optional, 0-10):`, '');
        if (raw === null) return null;
        const text = String(raw).trim();
        if (!text) return null;
        const num = Number(text);
        if (!Number.isFinite(num) || num < 0 || num > 10) {
            alert(`${label} must be between 0 and 10.`);
            return undefined;
        }
        return Number(num.toFixed(2));
    };

    const doublesRating = parseRating('Doubles rating');
    if (doublesRating === undefined) return;
    const singlesRating = parseRating('Singles rating');
    if (singlesRating === undefined) return;

    try {
        await submitRegistration({
            action: 'add_guest',
            tournamentId,
            teamId,
            extra: { displayName, doublesRating, singlesRating }
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
    const tournament = getResultsTournaments().find(t => t.id === tournamentId);
    if (!tournament) return;

    const photoWrap = document.getElementById(`${tournamentId}-photo-wrap`);
    if (photoWrap && !tournament.photoUrl) {
        photoWrap.classList.add('hidden');
    }

    if (tournament.csvUrl) {
        try {
            const response = await fetch(tournament.csvUrl);
            const csvText = await response.text();
            const data = parseCSV(csvText);

            if (data.matches.length === 0) {
                document.getElementById(`${tournamentId}-bracket`).innerHTML =
                    '<p class="text-yellow-600">No match data found.</p>';
                return;
            }

            renderBracket(tournamentId, data);
            return;
        } catch (error) {
            console.error('Error loading bracket:', error);
            document.getElementById(`${tournamentId}-bracket`).innerHTML =
                '<p class="text-red-500">Error loading bracket data</p>';
            return;
        }
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

function formatSingleGameScore(score1, score2) {
    if (!Number.isInteger(score1) || !Number.isInteger(score2)) return 'TBD';
    return `${score1}-${score2}`;
}

function formatBestOfThreeScore(score, teamSlot) {
    const list = [];
    const games = [
        [score.game1_score1, score.game1_score2],
        [score.game2_score1, score.game2_score2],
        [score.game3_score1, score.game3_score2]
    ];
    games.forEach(([s1, s2]) => {
        if (!Number.isInteger(s1) || !Number.isInteger(s2)) return;
        list.push(teamSlot === 1 ? `${s1}-${s2}` : `${s2}-${s1}`);
    });
    return list.length ? list.join(', ') : 'TBD';
}

function playoffScoreLabel(score, teamSlot, bestOfThreeEnabled) {
    if (!score) return 'TBD';
    if (bestOfThreeEnabled) {
        return formatBestOfThreeScore(score, teamSlot);
    }
    if (teamSlot === 1) return formatSingleGameScore(score.game1_score1, score.game1_score2);
    return formatSingleGameScore(score.game1_score2, score.game1_score1);
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
            const team1 = teamsMap.get(match.team1Id) || (match.team1Id ? 'Team' : 'TBD');
            const team2 = teamsMap.get(match.team2Id) || (match.team2Id ? 'Team' : 'TBD');
            const score = match.score || null;
            return `
                <div class="bracket-match">
                    <div class="bracket-team"><span>${team1}</span><span>${playoffScoreLabel(score, 1, isFinal && bestOfThree)}</span></div>
                    <div class="bracket-team"><span>${team2}</span><span>${playoffScoreLabel(score, 2, isFinal && bestOfThree)}</span></div>
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
            const bronzeTeam1 = teamsMap.get(losers[0]) || 'TBD';
            const bronzeTeam2 = teamsMap.get(losers[1]) || 'TBD';
            bronzeHtml = `
                <div class="text-xs font-bold text-center mb-2" style="color: #cd7f32;">BRONZE MATCH</div>
                <div class="bracket-match bronze">
                    <div class="bracket-team"><span>${bronzeTeam1}</span><span>${playoffScoreLabel(bronzeScore, 1, bestOfThreeBronze)}</span></div>
                    <div class="bracket-team"><span>${bronzeTeam2}</span><span>${playoffScoreLabel(bronzeScore, 2, bestOfThreeBronze)}</span></div>
                </div>
            `;
        }

        return `
            <div class="bracket-round">
                <h5 class="text-lg font-semibold text-ocean-blue mb-3 text-center">${playoffRoundLabel(bracketSize, roundNumber)}</h5>
                ${matchesHtml}
                ${bronzeHtml}
            </div>
        `;
    }).join('');

    bracketDiv.innerHTML = `<div class="flex gap-4 overflow-x-auto pb-4" style="align-items:flex-start;">${columns}</div>`;
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
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadTournaments();
    } catch (error) {
        console.error('Failed to load tournaments:', error);
    }
    renderUpcomingTournaments();
    renderResults();
    refreshAdminDetailEditors();
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
});
