# Musicfree

A minimal, offline-first PWA music player inspired by Spotify.

## Features
- Offline-first PWA (service worker caches app shell and audio)
- Auto-detects tracks from `musics/`
- Local file import (Chrome File System Access API)
- URL import for direct audio files (not supported on Cloudflare Workers)
- Playlists and queue (saved in localStorage)
- Shuffle and loop
- Clean, responsive UI

## Run (Local)
```bash
bun server.ts
```
Then open:
```
http://localhost:3000/
```

## Deploy (Cloudflare Workers + Assets)
This project is configured for Cloudflare Workers with Assets.

1. Install Wrangler
2. From the project root:
```bash
wrangler deploy
```

This will publish the app and all static assets (including `musics/`).

## Notes
- LocalStorage is size-limited; large local files may be session-only.
- URL import accepts direct audio URLs only in local mode.

## Educational Use
This project is intended for educational purposes only.
