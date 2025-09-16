# Repository Guidelines
所有的对话必须使用中文

## Project Structure & Module Organization
- `frontend/` — Vite + React + TypeScript UI. Source in `frontend/src` (components, pages, stores, services, i18n); static assets in `frontend/public`.
- `backend/` — Node + Express + TypeScript API. Source in `backend/src` (routes, services, middleware, websocket, scripts); build output in `backend/dist`; Prisma schema in `backend/prisma/`; uploads in `backend/uploads/`.
- `shared/` — Cross‑package types (`shared/types.ts`).
- `server-scripts/` — Deployment helpers (`deploy.sh`, `setup-server.sh`).
- `nginx-templates/` — NGINX config templates for deployment.
- `docs/` — Design notes and operational docs. Smoke test scripts `test-*.js` live at repo root and in `backend/`.

## Build, Test, and Development Commands
- Install all: `npm run install:all` — install root, frontend, and backend deps.
- Develop: `npm run dev` — start backend (nodemon) and frontend (Vite) concurrently.
- Build: `npm run build` — build both packages; start backend with `cd backend && npm start`.
- Frontend: `cd frontend && npm run dev | npm run build | npm run preview | npm run lint`.
- Backend: `cd backend && npm run dev | npm run build | npm start`.
- DB ops: `cd backend && npm run db:migrate | db:generate | db:seed`.
- Utilities: `./kill-ports.sh`, `./quick-start.sh`, `./server-scripts/deploy.sh`.

## Coding Style & Naming Conventions
- TypeScript‑first, 2‑space indentation, semicolons enabled. Use ESLint in `frontend`.
- React components: `PascalCase.tsx` (e.g., `UserPanel.tsx`). Modules/utilities: `camelCase.ts` (e.g., `siteBuilder.ts`).
- Keep functions small and pure; update `shared/types.ts` when adding cross‑package contracts.

## Testing Guidelines
- Current tests are script‑based: run `node test-streaming.js`, `node test-ai-chat.js`, or backend helpers.
- Name new scripts `test-*.{js,ts}` and colocate near the target package.
- If introducing a runner, prefer Vitest/Jest with colocated `*.test.ts`.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat(scope): …`, `fix(scope): …`, `chore: …`. Example: `feat(frontend): add project gallery`.
- PRs include: clear summary, linked issues, UI screenshots (when applicable), Prisma migration notes, and proof that `npm run build` and `cd frontend && npm run lint` pass.

## Security & Configuration
- Do not commit secrets. Create `backend/.env` (e.g., `DATABASE_URL`, provider API keys) and `frontend/.env.local` for `VITE_` variables. Use `dotenv` locally; use `nginx-templates/` for deploy.

## Agent‑Specific Instructions
- Make minimal, focused changes; follow the above naming/style.
- Avoid broad refactors without an open issue and approval.
- Update docs and scripts when changing commands or paths.

