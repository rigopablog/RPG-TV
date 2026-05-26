# CineStream Project Handoff

## Project Overview
CineStream is a Netflix-style streaming platform built with Next.js that aggregates movies and TV shows from TMDB (The Movie Database). The application features a responsive design with dedicated support for smart TV/D-pad navigation.

**Tech Stack:**
- Frontend: Next.js 14+, React, TypeScript
- Styling: Tailwind CSS
- Icons: Lucide React
- Data Source: TMDB API
- Storage: Browser localStorage for watchlist persistence

---

## Current Status

### ✅ Completed Features
- Hero carousel component with auto-rotate and manual controls
- Media cards with poster images and ratings
- Horizontal scrollable media rows
- Watchlist functionality (add/remove from localStorage)
- Smart TV mode detection (TVModeDetector.tsx)
  - Activates on first arrow key/D-pad/Enter press
  - Auto-scrolls focused elements into view
  - Handles focus management for TV remotes
- Movie/TV show filtering and categorization
- Responsive design (desktop, tablet, mobile)

### 🚨 Known Issues
1. **API Backend Error**: Getting "Not Found" errors on some content requests
   - Error: `The requested URL /api/ was not found on this server`
   - Server: apache 2.2.15 (CentOS) at localhost:80
   - **Status**: Investigation in progress - may be related to backend server configuration or API endpoint mismatch

2. **Inconsistent Content Loading**: Some pages/content show the error while others load fine
   - **Next Action**: Debug network requests to identify which API endpoints are failing

### 📦 Recently Added
- `agent-browser` package installed (for browser automation/agent-based browser control)
  - 5 vulnerabilities detected (1 moderate, 3 high, 1 critical)
  - Run `npm audit fix --force` if needed to address security issues

---

## Project Structure

```
CineStream/
├── web/                          # Next.js frontend app
│   ├── components/
│   │   ├── Hero.tsx             # Featured carousel component
│   │   ├── MediaRow.tsx         # Horizontal scrollable row container
│   │   ├── MediaCard.tsx        # Individual media item card
│   │   ├── Navbar.tsx           # Navigation header
│   │   ├── Footer.tsx           # Footer component
│   │   ├── TVModeDetector.tsx   # Smart TV detection & focus handling
│   │   └── PopupBlocker.tsx     # Ad/popup blocking logic
│   ├── app/
│   │   ├── layout.tsx           # Root layout with metadata
│   │   ├── page.tsx             # Home page
│   │   ├── watch/               # Video player routes
│   │   ├── [type]/[id]/         # Detail pages (movie/tv show)
│   │   └── globals.css          # Global styles
│   ├── lib/
│   │   ├── tmdb.ts             # TMDB API utilities (imgUrl, getMediaTitle, etc.)
│   │   ├── storage.ts          # Watchlist localStorage functions
│   │   └── [other utilities]
│   ├── types/
│   │   └── tmdb.ts             # TypeScript types for TMDB data
│   └── package.json
└── [other project directories]
```

---

## Key Components Explained

### **Hero.tsx** (Featured Carousel)
- Displays 8 featured items in a rotating carousel
- Auto-advances every 8 seconds (pauses on keyboard/D-pad focus)
- Controls: Previous/Next buttons + dot indicators
- Shows: Type badge, rating, year, title, overview, and action buttons
- Action buttons: Watch Now, More Info, Add to Watchlist

### **MediaRow.tsx** (Scrollable Container)
- Horizontal scrollable row of MediaCard components
- Left/Right scroll buttons that scroll 70% of container width
- Responsive sizing

### **MediaCard.tsx** (Individual Item)
- Poster image with fallback emoji (🎬)
- Hover overlay with play button and watchlist toggle
- Rating badge and type badge (Movie/TV)
- Title and year information
- Three sizes: sm, md, lg

### **TVModeDetector.tsx** (Smart TV Support)
- Listens for arrow keys, D-pad, Enter, and TV-specific key codes
- Auto-adds `tv-mode` class to `<body>` on first TV input
- Switches back to mouse mode if physical mouse detected
- Auto-scrolls focused items into center of horizontally scrollable rows
- Improves focus ring contrast in TV mode via CSS

---

## Important Functions

### **Storage (lib/storage.ts)**
```typescript
isInWatchlist(id: number, type: 'movie' | 'tv'): boolean
addToWatchlist(item: WatchlistItem): void
removeFromWatchlist(id: number, type: 'movie' | 'tv'): void
```

### **TMDB Utilities (lib/tmdb.ts)**
```typescript
imgUrl(path: string, size: 'original' | 'w342'): string
getMediaTitle(item: TMDBMediaItem): string
getMediaDate(item: TMDBMediaItem): string
getYear(dateString: string): string
```

---

## Setup & Running

### Install Dependencies
```bash
cd web
npm install
```

### Run Development Server
```bash
npm run dev
```
Runs on `http://localhost:3000`

### Build for Production
```bash
npm run build
npm start
```

---

## Debugging the API Issue

### Steps to Investigate:
1. **Check Browser Console** (F12 → Console tab)
   - Look for CORS errors, network failures, or JavaScript errors

2. **Check Network Tab** (F12 → Network tab)
   - Reload page and trigger the error
   - Look for failed API calls
   - Check response status codes and error messages
   - Identify which endpoints are failing (e.g., `/api/trending`, `/api/search`, etc.)

3. **Verify Backend**
   - Is the backend server running?
   - What port is it listening on?
   - Are the API endpoints correctly configured?
   - Check for CORS configuration issues

4. **Check API Configuration**
   - Review `lib/tmdb.ts` for API base URL
   - Verify environment variables are set correctly
   - Check API key is valid and hasn't expired

### Files to Review:
- `web/lib/tmdb.ts` - API request configuration
- `web/app/layout.tsx` - Metadata and layout structure
- `.env.local` or `.env` files - API configuration

---

## Next Steps / TODO

- [ ] **Debug API Errors**: Identify which endpoints are failing and why
  - Check network requests in browser DevTools
  - Verify backend server status and configuration
  - Review API error logs
  
- [ ] **Security**: Address the 5 npm vulnerabilities
  - Review which packages are vulnerable
  - Update dependencies or run `npm audit fix --force`
  
- [ ] **Agent Browser Integration**: Clarify use case for newly installed `agent-browser` package
  - Is this for automated testing?
  - Browser automation for content fetching?
  - Remove if not needed
  
- [ ] **Performance Optimization**: Consider lazy loading and image optimization
  - Implement virtualization for large media lists
  - Optimize TMDB API requests (pagination, caching)
  
- [ ] **TV Mode Testing**: Test on actual smart TV devices
  - Test with various remotes (Fire Stick, Roku, etc.)
  - Verify focus management and navigation
  
- [ ] **Watchlist Persistence**: Consider syncing with backend instead of just localStorage

---

## Useful Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint

# Check for vulnerabilities
npm audit

# Fix vulnerabilities (with breaking changes)
npm audit fix --force
```

---

## Notes for Future Sessions

- **Color Scheme**: Custom colors in Tailwind (`cs-red`, `cs-dark`, `cs-surface`) - check `tailwind.config.ts`
- **Metadata**: SEO metadata in `app/layout.tsx` - update as needed for different pages
- **Focus Management**: TVModeDetector handles smart TV navigation - don't override without testing on actual TV devices
- **Watchlist**: Stored in browser localStorage under key `watchlist` - consider data structure before migrations
- **TMDB API**: Free tier has rate limits - consider implementing request caching to avoid hitting limits

---

**Last Updated**: May 25, 2026  
**Created For**: Future Development Sessions
