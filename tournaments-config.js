// ========================================
// TOURNAMENT CONFIGURATION
// Update this file to add/remove tournaments
// ========================================

const TOURNAMENTS = {
    upcoming: [
        {
            id: 'feb28-tournament',
            title: 'Saturday Moneyball',
            startTime: '2:00 PM - Date TBD',
            location: 'The Picklr Westbrook',
            format: 'Coed Doubles',
            skillLevel: 'DUPR ?? or below',
            entryFee: '$15 per player',
            prizeSplit: '50% - 30% - 20%',
            registerUrl: '#',
            theme: 'blue', 
            liveStart: new Date('2026-02-07T14:00:00'),
            liveEnd: new Date('2026-02-07T18:00:00')
        }
        // Add more upcoming tournaments here
    ],
    
    results: [
        {
            id: 'jan24',
            title: 'Saturday January 24 Moneyball',
            location: 'The Picklr Westbrook',
            format: 'Coed Doubles',
            skillLevel: 'DUPR 9.25 or below',
            entryFee: '$15 per player',
            prizeSplit: '50% - 30% - 20%',
            theme: 'gold',
            photoUrl: 'photos/winners-jan24.jpg'
        },
        {
            id: 'jan10',
            title: 'Saturday January 10 Moneyball',
            location: 'The Picklr Westbrook',
            format: 'Coed Doubles',
            skillLevel: 'DUPR 9.5 or below',
            entryFee: '$15 per player',
            prizeSplit: '50% - 30% - 20%',
            theme: 'blue',
            photoUrl: 'photos/winners-jan10.jpeg'
        }
        // Add more completed tournaments here
    ]
};

// ========================================
// HOW TO ADD NEW TOURNAMENTS
// ========================================

/*

UPCOMING TOURNAMENT:
--------------------
1. Copy the template below
2. Update all fields
3. Add to TOURNAMENTS.upcoming array
4. Push to GitHub - that's it!

{
    id: 'unique-id',                    // lowercase, no spaces (e.g., 'feb15-tournament')
    title: 'Saturday February 15 Open', // Display name
    startTime: '2:00 PM',               // Start time text
    location: 'The Picklr Westbrook',   // Venue name
    format: 'Coed Doubles',             // Tournament format
    skillLevel: 'DUPR 9.5 or below',    // Skill restrictions
    entryFee: '$15 per player',         // Cost
    prizeSplit: '50% - 30% - 20%',      // Prize distribution
    registerUrl: 'https://link.swishsportsapp.com/XXXXX', // Registration link
    theme: 'blue',                      // 'blue' or 'gold'
    liveStart: new Date('2026-02-15T14:00:00'), // When "Watch Live" appears
    liveEnd: new Date('2026-02-15T18:00:00')    // When card disappears
}


RESULTS (COMPLETED TOURNAMENT):
-------------------------------
1. Upload winner photo to photos/ folder
2. Copy template below
3. Update all fields
4. Add to TOURNAMENTS.results array
5. Push to GitHub - done!

{
    id: 'unique-id',                    // lowercase, no spaces (e.g., 'feb15')
    title: 'Saturday February 15 Open', // Display name
    location: 'The Picklr Westbrook',   // Venue name
    format: 'Coed Doubles',             // Tournament format
    skillLevel: 'DUPR 9.5 or below',    // Skill restrictions
    entryFee: '$15 per player',         // Cost
    prizeSplit: '50% - 30% - 20%',      // Prize distribution
    theme: 'blue',                      // 'blue' or 'gold'
    photoUrl: 'photos/winners-feb15.jpg' // Path to winner photo
}

*/
