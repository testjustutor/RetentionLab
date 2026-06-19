# AGENTS.md

## Purpose
This repository is a Node.js/Express meeting intelligence application with a backend dashboard, calendar integration, bot automation, and transcript storage.

## Key commands
- `npm install`
- `npm start` — run the main server (`server.js`)
- `npm run dev` — run with `nodemon`
- `npm run db:init` — initialize/reset SQLite database
- `npm run db:seed` — seed database data
- `npm run build` — initializes database and seeds data

## Important files
- `server.js` — main Express server entry point
- `index.js` — development startup helper that initializes DB
- `package.json` — Node dependencies and scripts
- `README.md` — project usage notes and environment setup

## Key directories
- `routes/` — Express route handlers and API endpoints
- `models/` — database model modules
- `database/` — SQLite setup, migrations, and seeders
- `services/` — application and bot logic, including calendar and engine integration
- `public/` — static UI assets and HTML pages
- `storage/` — generated transcripts, audio, logs, screenshots, and exported assets
- `utils/` — shared helpers and logger

## Development guidance
- This repo expects `node >= 18`
- Environment configuration is loaded via `dotenv`
- Database operations use SQLite through `database/db.js`
- Static assets are served from `public/` and `storage/`
- Route composition is centralized via `routes/index.js`

## Notes for AI agents
- Keep changes focused on the Express app, route handlers, bot services, and database seed/model logic
- Do not assume a separate frontend build step; the dashboard is served as static HTML/CSS/JS
- Use `README.md` for additional context around setup, dashboard usage, and troubleshooting
