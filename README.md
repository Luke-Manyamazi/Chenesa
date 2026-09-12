# Chenesa

> AI-powered email cleanup for connected inboxes.

Chenesa is a SaaS application that uses AI-assisted processing to help users clean and organize email across multiple providers. The project combines a Next.js frontend, a Python API, PostgreSQL-backed data services, scheduled background processing, and encrypted provider credentials.

## Highlights

- Connects supported Gmail, Outlook, Yahoo, iCloud, AOL, Zoho, and IMAP accounts
- AI-assisted email cleanup workflows
- Secure account and provider configuration
- Scheduled background processing
- Subscription-oriented product model with free and paid plans
- Separate frontend and backend deployments

## Architecture

```text
Next.js frontend
      ↓
FastAPI backend
      ↓
PostgreSQL / Supabase
      ↓
Email providers + AI processing

GitHub Actions → scheduled backend jobs
```

## Repository structure

```text
Chenesa/
├── frontend/        # Next.js web application
├── backend/         # FastAPI API server
├── supabase/        # Database migrations
└── .github/         # Automation and scheduled jobs
```

## Technology

| Area | Technology |
|---|---|
| Web application | Next.js 14, React, Tailwind CSS |
| API | Python, FastAPI |
| Database | PostgreSQL, Supabase |
| Background jobs | GitHub Actions |
| Hosting | Vercel, Railway |
| Security | Encrypted provider credentials |

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure the required frontend environment values using the included example environment file.

### Backend

```bash
cd backend
```

Install the Python dependencies, configure the required server environment values, and start the FastAPI application using the project's backend configuration.

Database migrations are stored under `supabase/migrations/`.

## Deployment

The project is designed as a split frontend/API deployment:

- **Vercel** for the Next.js application
- **Railway** for the FastAPI service
- **Supabase** for PostgreSQL and database tooling
- **GitHub Actions** for scheduled processing

## Engineering focus

Chenesa demonstrates full-stack product development across TypeScript/React and Python, third-party email integrations, scheduled automation, database-backed SaaS workflows, and secure handling of external-service credentials.

> Configuration values and secrets should be supplied through the deployment environment rather than committed to the repository.
