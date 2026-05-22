# CineStream Web — Deployment Guide

## Free Services Used
| Service | Purpose | Cost |
|---------|---------|------|
| **Vercel** | Hosting & CDN | Free |
| **TMDB API** | Movie/show data, images | Free |
| **VidSrc.to / VidSrc.me** | Video streaming embeds | Free |
| **localStorage** | Watchlist, favorites, history | Free (browser) |

---

## Step 1: Get a Free TMDB API Key

1. Go to [https://www.themoviedb.org/signup](https://www.themoviedb.org/signup) and create a free account
2. Visit [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
3. Click **"Create"** → Choose **"Developer"**
4. Fill in the form (website: your Vercel URL or a placeholder)
5. Copy your **API Read Access Token** (the long one)

---

## Step 2: Deploy to Vercel

### Option A: Via Vercel CLI (Fastest)
```bash
cd CineStream/web
npm i -g vercel
vercel login
vercel --prod
```
When prompted for environment variables, add:
- `NEXT_PUBLIC_TMDB_ACCESS_TOKEN` → paste your TMDB Read Access Token

### Option B: Via Vercel Dashboard
1. Push this `web/` folder to a GitHub repo
2. Go to [https://vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repo
4. Set **Root Directory** to `web` (if the whole CineStream repo is pushed)
5. Add **Environment Variable**:
   - Name: `NEXT_PUBLIC_TMDB_ACCESS_TOKEN`
   - Value: your TMDB Read Access Token
6. Click **Deploy**

---

## Local Development

```bash
cd CineStream/web

# Create .env.local
echo "NEXT_PUBLIC_TMDB_ACCESS_TOKEN=your_token_here" > .env.local

# Install & run
npm install
npm run dev
# Open http://localhost:3000
```

---

## Features

- **Home** — Hero carousel + trending/popular/top-rated rows
- **Movies** — Browse popular, now playing, top rated, upcoming
- **TV Shows** — Browse popular, on air, top rated series
- **Movie Detail** — Full info, cast, trailer link, similar
- **TV Detail** — Seasons, episodes, cast, similar shows
- **Watch** — Multi-server iframe player (4 sources)
- **Search** — Real-time search with movie/TV filter
- **Watchlist** — Save to watch later (localStorage)
- **Favorites** — Heart your favorites (localStorage)
- **Continue Watching** — Resume where you left off

## Player Sources (all free)
1. VidSrc.to
2. VidSrc.me
3. MultiEmbed
4. 2Embed

If one server fails → switch to another in the player UI.
