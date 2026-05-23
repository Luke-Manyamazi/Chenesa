# Chenesa — AI Email Cleaner SaaS

Automatically cleans any email inbox using AI. Works with Gmail, Outlook, Yahoo, iCloud, AOL, Zoho, and any IMAP provider.

## Stack
| Layer | Tech | Host |
|---|---|---|
| Frontend | Next.js 14 + Tailwind | Vercel |
| Backend | FastAPI (Python) | Railway |
| Database | PostgreSQL + Auth | Supabase |
| Scheduler | GitHub Actions cron | GitHub |

## Monorepo structure
```
Chenesa/
├── frontend/        ← Next.js web app
├── backend/         ← FastAPI API server
├── supabase/        ← DB migrations
└── .github/         ← Scheduler cron job
```

## Setup

### 1. Supabase
1. Create project at supabase.com
2. Run migrations in order: SQL Editor → paste each file from `supabase/migrations/`
3. Copy your Project URL and anon key

### 2. Frontend (Vercel)
```bash
cd frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```
Deploy: connect GitHub repo to Vercel → auto-deploys on push.

### 3. Backend (Railway)
```bash
cd backend
cp .env.example .env
# Fill in all env vars
```
Deploy: connect GitHub repo to Railway → uses Dockerfile automatically.

Generate encryption key:
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

### 4. GitHub Actions Scheduler
Add these secrets to your GitHub repo (Settings → Secrets → Actions):
- `BACKEND_URL` — your Railway URL e.g. `https://chenesa-api.railway.app`
- `SCHEDULER_SECRET` — same value as `SCHEDULER_SECRET` in Railway env vars

## Plans
| Plan | Price | Runs | Emails/run | Accounts |
|---|---|---|---|---|
| Free | $0 | 3 lifetime | 50 | 1 |
| Basic | $7/mo | Unlimited | 500 | 2 |
| Pro | $15/mo | Unlimited | Unlimited | 4 |
