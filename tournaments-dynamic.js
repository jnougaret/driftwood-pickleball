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
                <a href="${tournament.registerUrl}" class="tournament-action-button block w-full text-center font-semibold py-3 rounded-lg transition ${btnClass}">
                    Register on Swish
                </a>
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
        
        const button = card.querySelector('.tournament-action-button');
        if (!button) return;
        
        // Check if tournament is live
        if (now >= tournament.liveStart && now <= tournament.liveEnd) {
            // Tournament is LIVE
            button.textContent = 'Watch Live';
            button.href = 'https://www.youtube.com/@JoshuaNougaret/live';
            button.className = 'tournament-action-button block w-full text-center font-semibold py-3 rounded-lg transition btn-live';
        } else if (now > tournament.liveEnd) {
            // Tournament is over - hide the card
            card.style.display = 'none';
        } else {
            // Tournament is upcoming - show register button
            button.textContent = 'Register on Swish';
            button.href = tournament.registerUrl;
            const btnClass = tournament.theme === 'gold' ? 'btn-gold' : 'btn-blue';
            button.className = `tournament-action-button block w-full text-center font-semibold py-3 rounded-lg transition ${btnClass}`;
        }
    });
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
    
    // Check status every minute
    setInterval(checkTournamentStatus, 60000);
});
