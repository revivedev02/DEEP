# DEEP

A self-hosted, invite-only real-time chat platform for your trusted crew. No passwords — just paste your Member ID and you're in.

## Stack
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Backend**: Fastify + Socket.IO + Prisma ORM
- **Auth**: JWT (HS256) + short IDs — no passwords ever
- **Realtime**: Socket.IO (text), WebRTC mesh (voice — coming soon)
- **DB**: SQLite (local dev) / PostgreSQL (production)
- **Desktop**: Electron (coming soon)

## Local Development

```bash
# 1. Install all dependencies
pnpm install

# 2. Set up the database
cd apps/server
node --env-file=.env --import tsx/esm node_modules/prisma/build/index.js db push

# 3. Seed the admin user
node --env-file=.env --import tsx/esm prisma/seed.ts

# 4. Start the backend (port 3000)
node --env-file=.env --import tsx/esm src/index.ts

# 5. In a new terminal — start the frontend (port 5173)
cd apps/web && pnpm dev
```

Login at `http://localhost:5173` using your `ADMIN_SHORTID` from `apps/server/.env`.

## Deployment (Railway)

1. Push this repo to GitHub
2. Create a new Railway project → **Deploy from GitHub repo**
3. Add a **PostgreSQL** plugin
4. Set environment variables (see below)
5. Railway auto-builds via `Dockerfile`

### Required Environment Variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Auto-injected by Railway PostgreSQL plugin |
| `JWT_SECRET` | Any 32+ char random string |
| `PORT` | `3000` |
| `ADMIN_SHORTID` | Your admin login ID (e.g. `admin_init`) |
| `NODE_ENV` | `production` |

## Project Structure

```
DEEP/
├── apps/
│   ├── web/        # Vite React frontend
│   └── server/     # Fastify backend + Socket.IO
└── packages/
    └── types/      # Shared TypeScript types
```
