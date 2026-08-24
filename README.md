# AI Website Auditor

A production-oriented SaaS web application that audits any public website across **SEO, performance, accessibility, security, mobile readiness, and technical health**, then produces a transparent score (0–100) and an **action plan** based only on real findings.

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Node.js + TypeScript + Express
- **Database**: MongoDB (Atlas)
- **Background jobs**: lightweight in-process queue (swap for a durable queue later)
- **Recommendations**: built-in rules engine — no external AI/API key required

---

## Features

- Landing page with a URL input that starts a real audit immediately.
- Bounded crawler (default 5 pages, depth 1) with hard SSRF protection.
- 60+ real checks across six categories; every score is calculated from actual analysis.
- Every check explains *what was checked*, *actual result*, *why it matters*, and *how to fix it*.
- Transparent scoring: category cards expose the weighted formula and each check's contribution.
- Clear 4-level priority system (Critical / High / Medium / Low) on issues and actions.
- Passive security checks only — no penetration testing, no false "secure" claims.
- Rules-engine Action Plan (top 5 fixes) generated strictly from real failed/warning checks.
- Audit dashboard with overall score, category cards, filterable issue list (All / Critical / High / Medium / Low / Passed).
- Progress checklist while the audit runs, plus partial-audit notices and structured error messages.
- Print-friendly report page with a plain-language summary (save as PDF from the browser).
- User accounts with PBKDF2 password hashing and **Bearer JWT authentication**.
- **Login is required to run audits.** New accounts get 2 free credits; every audit uses 1 credit.
- **Stripe credit packs**: when credits run out, users can buy packs (e.g. 10 audits) via Stripe checkout (optional — works without Stripe configured).
- Every completed audit gets a **unique public share link** (`/share/:shareId`) that anyone can open without logging in.
- Authenticated dashboard with real statistics (total audits, completed, average, best, recent).
- Audit history with score-change indicators (+/− points vs previous audit), partial/error badges, and report links.
- Private user-owned audits: users can never view or delete another user's audit; share links are the only public access.
- Multilingual UI: English, O'zbekcha, Русский with a persistent language switcher.
- Rate limiting, request timeouts, page-size caps, safe URL validation, and SSRF-resistant redirect handling.
- Dark mode by default, light mode supported.

## Project structure

```
.
├── frontend/                  # Next.js + Tailwind
│   ├── app/                   # App Router pages (landing, dashboard, report, auth, history)
│   ├── components/            # UI components
│   └── lib/                   # API client + TypeScript types
└── backend/                   # Node.js + TypeScript + Express
    ├── src/
    │   ├── routes/            # auth, audits
    │   ├── middleware/        # JWT auth helpers
    │   ├── services/
    │   │   ├── crawler/       # URL validation (SSRF), fetcher, parser, crawler
    │   │   ├── analyzers/     # SEO, security, performance, accessibility, mobile, technical
    │   │   ├── scoring.ts     # transparent scoring engine
    │   │   ├── rulesEngine.ts # rules-based action plan
    │   │   └── auditRunner.ts # orchestration
    │   ├── queue.ts           # in-process audit queue
    │   ├── db.ts              # MongoDB connection + collections
    │   ├── security.ts        # password hashing + JWT
    │   ├── app.ts             # Express app
    │   └── index.ts           # entrypoint
    └── tests/                 # Node test runner + supertest
```

## Local setup

Requirements: Node.js 18+, npm, and a MongoDB connection string (MongoDB Atlas recommended).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # set MONGODB_URL and JWT_SECRET

# Run the API (compiles TypeScript first)
npm run dev
```

Health check: `curl http://localhost:8000/api/health`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The Next.js dev server rewrites `/api/*` to `http://localhost:8000/api/*`, so no CORS setup is needed locally.

## Environment variables

Core app — three variables (plus an optional `PORT`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `MONGODB_URL` | MongoDB Atlas connection string | `mongodb://localhost:27017/auditor` |
| `JWT_SECRET` | JWT signing secret (use a long random string in production) | dev-only value |
| `CORS_ORIGINS` | Comma-separated allowed browser origins | `http://localhost:3000,http://127.0.0.1:3000` |
| `PORT` | API port (optional) | `8000` |

Optional Stripe credit packs (leave empty to disable payments — the app still works, checkout just returns "not configured"):

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_CREDIT_PACK_PRICE_ID` | Stripe Price ID for one credit pack (10 audits) |
| `STRIPE_SUCCESS_URL` | Redirect after successful payment |
| `STRIPE_CANCEL_URL` | Redirect after cancelled payment |

## API auth

The backend uses **Bearer tokens** only:

1. `POST /api/auth/register` returns `{ user, token }` — new users get 2 free credits.
2. `POST /api/auth/login` returns `{ user, token }`.
3. Store the token in the frontend and send `Authorization: Bearer <token>` on every request.

The frontend stores the token in `localStorage` under `auditor_token`.

## Credits & payments

- Every audit consumes **1 credit**.
- New accounts start with **2 free credits**.
- When credits reach 0, `POST /api/audits` returns `403 { code: "credits_exhausted" }`.
- Users buy more credits on `/credits` via Stripe checkout (`POST /api/billing/checkout`).
- Stripe webhook (`POST /api/billing/webhook`) grants credits after a successful payment.

## Public share links

Every audit has a unique `share_id`. Anyone can open `/share/:shareId` and see the result **without logging in**. The dashboard URL (`/audit/:publicId`) remains private to the owner.

## Running tests

```bash
cd backend
npm test
```

The suite connects to the `MONGODB_URL` from `.env` (the same Atlas URL you use locally). It creates and cleans up its own test users/audits.

Covered:

- Health endpoint
- Register / login / me / logout with Bearer JWT
- URL validation and SSRF rejection
- Auth-gated audit history and cross-user protection
- Audit creation and access rules

## Security considerations

- **SSRF protection**: only public http/https targets; ports restricted to 80/443; every redirect hop is re-validated; private/loopback/link-local/reserved IPs and cloud metadata endpoints are blocked; integer/hex/octal-encoded IP literals are rejected.
- **Rate limiting**: in-memory sliding-window limits for audit creation and auth attempts; concurrency caps for crawler/queue.
- **Safe crawling**: timeout, max response size, max pages, max depth, no destructive requests.
- **Auth**: PBKDF2-HMAC-SHA256 password hashing, signed HS256 JWTs, expired/invalid tokens rejected.
- **Authorization**: user-owned audits are private — viewing, reporting, or deleting another user's audit returns 403. Anonymous audits are shareable by UUID only.
- **Secrets**: never committed; `.env` is gitignored.

## Known limitations (MVP)

- Audits are automated and limited to a small crawl (5 pages). They are a health signal, not a full SEO audit or WCAG certification.
- Security checks are passive only and never claim a website is "completely secure".
- Rate limiting is in-memory; multi-instance deployments should move it to Redis or another shared store.
- The in-process audit queue is not durable; use a proper job queue when scaling beyond one instance.
- Report generation is browser-print based (server-side PDF can be added later).

## Deployment

**Frontend (Vercel)**

1. Set the Vercel project root directory to `frontend`.
2. Set `BACKEND_URL` to the deployed backend origin.
3. Leave `NEXT_PUBLIC_API_URL` empty so the rewrite proxy is used.

**Backend (Render)**

1. Create a Web Service connected to this repo.
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to:
   ```bash
   npm install && npm run build
   ```
4. Set **Start Command** to (or rely on the checked-in `backend/Procfile`):
   ```bash
   node dist/index.js
   ```
5. Set environment variables:
   ```bash
   MONGODB_URL=mongodb+srv://...
   JWT_SECRET=<strong-random-string>
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```

## License

Proprietary/private project — all rights reserved.
