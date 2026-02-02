# Driftwood Pickleball Website

A clean, modern website for pickleball tournament hosting.

## Project Structure

```
driftwood-pickleball/
├── index.html                 # Main website (rarely needs updating)
├── functions/api/tournaments/ # Tournament data APIs (DB-backed source of truth)
├── tournaments-dynamic.js     # Tournament rendering logic (don't modify)
├── wrangler.jsonc            # Cloudflare Pages configuration
├── photos/                    # Tournament winner photos
│   ├── winners-jan10.jpg
│   ├── winners-jan24.jpg
│   └── ...
└── README.md
```

## Local Development Setup

### Prerequisites
- A code editor (VS Code recommended)
- Git installed
- A GitHub account (for deployment)
- Live Server extension for VS Code

### Setup Instructions

1. **Clone or download the repository**
   ```bash
   git clone https://github.com/jnougaret/driftwood-pickleball.git
   cd driftwood-pickleball
   ```

2. **Open in VS Code**
   ```bash
   code .
   ```

3. **Preview locally**
   - Right-click on `index.html` in VS Code
   - Select "Open with Live Server"
   - Site opens at `http://localhost:5500`

### Database Migrations

Schema migrations live in `migrations/`. For a clean local setup, run:

```bash
wrangler d1 execute driftwood-pickleball-db-v2 --local --file migrations/001_init.sql
```

### Local Pages + Functions (with auth)

If you want to run the Cloudflare Pages Functions locally (for `/api/auth/*`), add your Clerk secret to `.dev.vars` and use Wrangler:

1. **Set local secrets**
   - Open `.dev.vars`
   - Set `CLERK_SECRET_KEY=your_clerk_secret`

2. **Run Pages dev server**
   ```bash
   wrangler pages dev . --port 8788
   ```
   - Site opens at `http://localhost:8788`

## Deployment to Cloudflare Pages

### Initial Setup (One Time)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Update tournament data"
   git push
   ```

2. **Connect to Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Click "Workers & Pages" > "Create application" > "Pages"
   - Click "Connect to Git"
   - Select your GitHub repository
   - Build settings:
     - Framework preset: None
     - Build command: (leave empty)
     - Build output directory: `/`
   - Click "Save and Deploy"

3. **Configure custom domain**
   - In Cloudflare Pages project settings
   - Click "Custom domains"
   - Add `driftwoodpickleball.com` and `www.driftwoodpickleball.com`
   - Cloudflare automatically configures DNS

### Ongoing Updates

After initial setup, updates are automatic:
```bash
git add .
git commit -m "Add new tournament"
git push
```
Cloudflare automatically deploys changes in 1-2 minutes.

## Adding Tournaments

### Editing Upcoming Tournament Details

Upcoming tournament details are now stored in D1 and edited from the site UI by admins.

1. Sign in as an admin
2. Open the tournament card
3. Click **Edit Details**
4. Update title/date/time/location/format/skill cap/entry fee
5. Click **Save Details**

Fields are stored separately in DB (ET timezone) and rendered as:
`2:00 PM - Jan 24 @ The Picklr Westbrook`

### Adding an Upcoming Tournament (developer-only, current phase)

You can insert a new row into the `tournaments` table:

```sql
INSERT INTO tournaments (
  id, title, start_date, start_time_et, timezone, location,
  format_type, skill_level_cap, entry_fee_amount, prize_split,
  theme, status, display_order
) VALUES (
  'feb15-tournament', 'Saturday February 15 Open', '2026-02-15', '14:00', 'America/New_York',
  'The Picklr Westbrook', 'coed_doubles', 9.25, 20, '50% - 30% - 20%',
  'blue', 'upcoming', 40
);
```

3. Deploy. The new card appears automatically from `/api/tournaments`.

### Adding Tournament Results

1. **Create Google Sheet tab with results**
   - Use this exact format:
   
   | Round          | Team 1      | Team 1 Score | Team 2       | Team 2 Score |
   |----------------|-------------|--------------|--------------|--------------|
   | QUARTERFINAL 1 | Joey/Joe C  | 11           | Aaron/Connor | 7            |
   | QUARTERFINAL 2 | Carl/Ralph  | 11           | Scott/Karol  | 7            |
   | ...            | ...         | ...          | ...          | ...          |
   | SEMIFINAL 1    | Joey/Joe C  | 9            | Carl/Ralph   | 11           |
   | SEMIFINAL 2    | Charlie/Nol | 11           | Sonu/Josh    | 7            |
   | GOLD           | Sonu/Josh   | 15           | Ralph/Carl   | 9            |
   | BRONZE         | Charlie/Nol | 15           | Joey/Joe C   | 8            |

   **Note:** For best-of-3 finals, put all scores in one cell (e.g., "11, 0, 11")

2. **Get the sheet's GID**
   - Click on the sheet tab
   - Look at the URL: `...#gid=123456789`
   - Copy the number after `gid=`

3. **Upload winner photo**
   - Add photo to `photos/` folder
   - Name it: `winners-feb15.jpg`

4. **Save results fields in D1**
   - Update `csv_url` and `photo_url` on the completed tournament row

```sql
UPDATE tournaments
SET status = 'completed',
    csv_url = 'https://docs.google.com/spreadsheets/d/e/.../pub?gid=123456789&single=true&output=csv',
    photo_url = 'photos/winners-feb15.jpg'
WHERE id = 'feb15';
```

5. Save, commit, and push to GitHub
6. **Done!** Results appear automatically with expandable bracket.

## Google Sheets Setup

### One-Time Spreadsheet Publishing

1. **Publish entire workbook** (do this once):
   - File → Share → Publish to web
   - Select: "Entire Document"
   - Format: "Comma-separated values (.csv)"
   - Click "Publish"
   - Copy the URL

2. **Store the published CSV URL in D1 (`csv_url`)**

3. **Never republish again**
   - Just create new sheet tabs
   - Build CSV URLs with the tab GID (`.../pub?gid=<gid>&single=true&output=csv`)

## Email Subscription Setup

The site includes email subscription via Google Forms.

**Current setup:**
- Form: https://forms.gle/91oPtqF8qwkMsM8f9
- Responses go to linked Google Sheet
- Entry ID: `427056354`

**To send tournament announcements:**
1. Open the Google Sheet with subscriber emails
2. Copy all email addresses
3. Compose email in Gmail
4. BCC all addresses
5. Send from `info@driftwoodpickleball.com`

## Custom Email Setup

**Receiving emails:**
- Cloudflare Email Routing forwards `info@driftwoodpickleball.com` to your Gmail

**Sending emails:**
1. Gmail → Settings → Accounts and Import
2. "Send mail as" → Add `info@driftwoodpickleball.com`
3. SMTP: `smtp.gmail.com`, Port `587`, TLS
4. Use Gmail App Password (not regular password)

## Theme Colors

The site uses two color schemes:

**Blue Theme** (Standard tournaments):
- Header: Ocean blue gradient (`#1a3a52` → `#2d5a7b`)
- Button: Ocean blue
- Use: `theme: 'blue'`

**Gold Theme** (Mixed gender tournaments):
- Header: Gold gradient (`#e8b44f` → `#d9a03a`)
- Button: Gold
- Use: `theme: 'gold'`

**Live Stream Button** (During tournaments):
- Automatically appears during tournament hours
- YouTube red (`#FF0000`)
- Links to: https://www.youtube.com/@JoshuaNougaret/live

## File Maintenance Guide

### Files You'll Update Regularly:
- **D1 tournaments rows** - Add/remove/edit tournaments
- **photos/** - Upload winner photos
- **Google Sheets** - Add tournament results

### Files You'll Rarely Touch:
- **index.html** - Only for About/Contact/Hero section changes
- **wrangler.jsonc** - Cloudflare configuration (already set up)

### Files You Should Never Modify:
- **tournaments-dynamic.js** - Auto-generates tournament cards

## Troubleshooting

### Tournament card not appearing
- Check the tournament row in D1 (`status`, `display_order`, and required fields)
- Verify all required fields are filled
- Check browser console for errors (F12)

### Bracket not loading
- Verify Google Sheet is published (entire document)
- Check the `csv_url` value on the tournament row (must include the correct GID)
- Ensure sheet tab has exact format (5 columns: Round, Team 1, Team 1 Score, Team 2, Team 2 Score)

### Live button not switching
- Check `liveStart` and `liveEnd` dates are correct
- Ensure dates are in future (for upcoming tournaments)
- Verify tournament `id` matches in both config and card

### Changes not appearing on live site
- Confirm you pushed to GitHub: `git push`
- Check Cloudflare Pages deployment status
- Clear browser cache (Cmd+Shift+R)

## Learning Resources

- **Tailwind CSS**: https://tailwindcss.com/docs
- **JavaScript Basics**: https://developer.mozilla.org/en-US/docs/Web/JavaScript
- **Git Tutorial**: https://www.atlassian.com/git/tutorials
- **Google Sheets API**: https://developers.google.com/sheets

## Support

**Website Issues:** info@driftwoodpickleball.com

**Quick Reference:**
- Domain: driftwoodpickleball.com
- Hosting: Cloudflare Pages
- Email: Cloudflare Email Routing → Gmail
- Forms: Google Forms
- Data: Google Sheets
- Code: GitHub (jnougaret/driftwood-pickleball)
