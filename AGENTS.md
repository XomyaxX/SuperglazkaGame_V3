# Superglazka V3 — Agent Context

## Project Overview
Interactive educational comic about eye health for kids. Frontend is vanilla JS (no build step). Backend is Node.js + Express + SQLite. Deployed via Docker Compose.

## Server & Deployment
| | |
|---|---|
| **IP** | `83.217.203.41` |
| **Domain** | `vidial-media.ru` |
| **Project path on server** | `/opt/superglazka` |
| **Git repo** | `https://github.com/XomyaxX/SuperglazkaGame_V3.git` |
| **SSH key (local)** | `ssh root@83.217.203.41` 
| **SSH user** | `root` |
| **SSH host** | `83.217.203.41` |
| **SSH password** | `rA3US@@R5Kg4e6` |
| **Server setup script** | `wget https://st.timeweb.com/cloud-static/scripts/serial_tools.sh; bash ./serial_tools.sh` |

> **Security note:** Password auth is temporary. Set up SSH keys (`ssh-copy-id`) and disable password login for production safety.

### Deployment workflow
1. Commit & push locally: `git push origin main`
2. SSH into server (if key rejected, check `authorized_keys` on server)
3. `cd /opt/superglazka && git pull origin main`
4. Restart containers:
   - `docker restart superglazka-backend superglazka-nginx`
   - Or rebuild if `server/` changed: `docker compose up -d --build backend`

> **Note:** `docker-compose` command may not exist; use `docker compose` (with space).

### Container names
- `superglazka-backend` — Node.js API on port 3000
- `superglazka-nginx` — nginx static server on ports 80/443

## Media Path Rules (CRITICAL)
| Prefix | Served By | Example |
|--------|-----------|---------|
| `assets/...` | nginx static | `assets/shared/characters/superglazka.png` |
| `/uploads/...` | Express static middleware | `/uploads/episodes/1/frames/1/image.png` |
| `temp/...` | Express (CMS temp files) | `temp/upload_123.png` |
| `http(s)://` | external CDN | left as-is |

**Never prefix `/uploads/` to paths that already start with `assets/`.**

## Code Architecture

### Frontend (`js/app.js`)
- `AudioController` — queue-based narration player only. No dialogue/video audio tracks.
- `BackgroundMusic` — Web Audio API ambient player. Falls back to synthesized drones if MP3s missing.
- `loadBooks()` — fetches `/api/episodes`, populates `APP_BOOKS`. Falls back to hardcoded `BOOKS` on error.
- `resolveMediaPath(path)` — preserves `assets/` and `/uploads/` paths.
- Embed mode: `app.html?game=X&embed=1` hides header/menu.
- Music stops **only** on `backToMenu()`, persists across frames/games.

### Backend (`server/server.js`)
- Single JS codebase (TypeScript `server/src/` was removed).
- Docker build uses `Dockerfile.backend` → `node server.js`.
- Admin routes mounted at `/api/admin` (both `admin.js` and `admin-cms.js`).

### Database
- SQLite at `server/data/superglazka.db` (Docker volume `sqlite_data`).
- Tables: `users`, `guests`, `progress`, `coins`, `subscriptions`, `episodes`, `frames`, `media`.

## Common Post-Merge Bugs
- `APP_BOOKS` or `loadBooks()` missing → episodes menu breaks. Always verify after merges.
- `resolveMediaPath()` losing `assets/` prefix → images 404.
- Service Worker caching old files → bump `CACHE_NAME` version in `service-worker.js`.

## Checklist Before Release
- [ ] `service-worker.js` CACHE_NAME bumped?
- [ ] `server/.env` NOT committed (check `git status`)?
- [ ] `server/package.json` main points to `server.js`?
- [ ] No `server/src/` references left in Docker/build files?
