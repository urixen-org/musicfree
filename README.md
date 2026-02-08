# Musicfree

A minimal, offline-first PWA music player inspired by Spotify.

## Features
- Offline-first PWA (service worker caches app shell and audio)
- Auto-detects tracks from `E:\musicfree\musics`
- Local file import (Chrome File System Access API)
- URL import for direct audio files (non-YouTube)
- Playlists and queue (saved in localStorage)
- Shuffle and loop
- Clean, responsive UI

## Run
```bash
bun server.ts
```
Then open:
[http://localhost:3000/](http://localhost:3000/)

## Notes
- LocalStorage is size-limited; large local files may be session-only.
- URL import accepts direct audio URLs only. YouTube links are not supported, use ytdlp.online.

## Educational Use
This project is intended for educational purposes only.
