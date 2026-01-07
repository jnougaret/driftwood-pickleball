# Driftwood Pickleball Website

A clean, modern website for Maine's premier pickleball tournament series.

## Local Development Setup

### Prerequisites
- A code editor (VS Code recommended)
- Git installed
- A GitHub account (for deployment)

### Setup Instructions

1. **Download the files**
   - Download `index.html` to your Mac
   - Create a folder called `driftwood-pickleball`

2. **Open in VS Code**
   ```bash
   cd path/to/driftwood-pickleball
   code .
   ```

3. **Preview locally**
   - Right-click on `index.html` in VS Code
   - Select "Open with Live Server" (install Live Server extension if needed)
   - OR simply double-click `index.html` to open in your browser

## Deployment to Cloudflare Pages

### Option 1: Via GitHub (Recommended)

1. **Create a GitHub repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/driftwood-pickleball.git
   git push -u origin main
   ```

2. **Connect to Cloudflare Pages**
   - Go to Cloudflare Dashboard
   - Click "Workers & Pages" > "Create application" > "Pages"
   - Click "Connect to Git"
   - Select your GitHub repository
   - Click "Begin setup"
   - Set build settings:
     - Build command: (leave empty)
     - Build output directory: `/`
   - Click "Save and Deploy"

3. **Configure custom domain**
   - In Cloudflare Pages, go to your project
   - Click "Custom domains"
   - Add `driftwoodpickleball.com`
   - Cloudflare will automatically configure DNS

### Option 2: Direct Upload

1. Go to Cloudflare Dashboard
2. Click "Workers & Pages" > "Create application" > "Pages"
3. Click "Upload assets"
4. Drag and drop your `index.html` file
5. Click "Deploy site"

## Making Updates

### To update tournament information:

1. Edit the tournament cards in `index.html` around line 110
2. Update the details in each card:
   - Tournament name and date
   - Start time
   - Format, skill level, entry fee
   - Registration link

### To add more tournaments:

Copy a tournament card and paste it in the grid. Example:

```html
<div class="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-xl transition transform hover:-translate-y-1">
    <div class="bg-gradient-to-r from-ocean-blue to-ocean-teal p-6 text-white">
        <h3 class="text-2xl font-bold mb-2">Your Tournament Name</h3>
        <p class="text-gray-200">Start Time</p>
    </div>
    <div class="p-6">
        <div class="space-y-3 mb-6">
            <!-- Add details here -->
        </div>
        <a href="REGISTRATION_LINK" class="block w-full bg-ocean-blue hover:bg-ocean-teal text-white text-center font-semibold py-3 rounded-lg transition">
            Register on Swish
        </a>
    </div>
</div>
```

## Customization Tips

### Colors
The site uses these custom colors (defined in the Tailwind config):
- `ocean-blue`: #1a3a52
- `ocean-teal`: #2d5a7b
- `sand`: #d4a574
- `driftwood`: #8b7355

To change colors, edit the `tailwind.config` section in the `<head>`.

### Fonts
Currently using system fonts. To add Google Fonts:
1. Add in `<head>`: `<link href="https://fonts.googleapis.com/css2?family=Your+Font&display=swap" rel="stylesheet">`
2. Update the `font-family` in the `<style>` section

### Images
To add a hero background image:
```html
<section class="bg-gradient-to-br from-ocean-blue via-ocean-teal to-ocean-blue text-white py-20" 
         style="background-image: url('your-image.jpg'); background-size: cover; background-blend-mode: overlay;">
```

## Learning Resources

- **Tailwind CSS Documentation**: https://tailwindcss.com/docs
- **HTML/CSS Basics**: https://developer.mozilla.org/en-US/docs/Learn
- **Git Tutorial**: https://www.atlassian.com/git/tutorials

## Support

For questions or issues, contact: info@driftwoodpickleball.com

## Next Steps

1. ✅ Set up local development
2. ✅ Preview the site locally
3. ✅ Create GitHub repository
4. ✅ Deploy to Cloudflare Pages
5. ✅ Configure custom domain
6. 🔄 Add your tournament information
7. 🔄 Customize content and images
8. 🔄 Test on mobile devices
