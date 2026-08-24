# AI Website Auditor

A production-oriented SaaS web application that audits any public website across **SEO, performance, accessibility, security, mobile readiness, and technical health**, then produces a transparent score (0–100) and an **AI action plan** based only on real findings.

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Python + FastAPI + SQLAlchemy + Alembic migrations
- **Database**: PostgreSQL (SQLite for zero-setup local development)
- **Background jobs**: lightweight in-process thread queue (swap for Celery/Redis later)
- **AI**: provider abstraction supporting DeepSeek, OpenAI, Anthropic, plus a built-in rules engine that works with no API key

---

## Features

- Landing page with a URL input that starts a real audit immediately.
- Bounded crawler (default 5 pages, depth 1) with hard SSRF protection.
- 60+ real checks across six categories; every score is calculated from actual analysis.
- Every check explains *what was checked*, *actual result*, *why it matters*, and *how to fix it*.
- Transparent scoring: category cards expose the weighted formula and each check's contribution.
- Clear 4-level priority system (Critical / High / Medium / Low) on issues and AI actions.
- Passive security checks only — no penetration testing, no false "secure" claims.
- AI Action Plan (top 5 fixes) generated strictly from real failed/warning checks.
- Audit dashboard with overall score, category cards, filterable issue list (All / Critical / High / Medium / Low / Passed).
- Progress checklist while the audit runs, plus partial-audit notices and structured error messages.
- Print-friendly report page with a plain-language summary (save as PDF from the browser; server-side PDF can be added later).
- User accounts with PBKDF2 password hashing, httpOnly JWT cookies.
- Authenticated dashboard with real statistics (total audits, completed, average, best, recent).
- Audit history with score-change indicators (+/− points vs previous audit), partial/error badges, and report links.
- Private user-owned audits: users can never view or delete another user's audit. Anonymous audits remain shareable by UUID.
- Stripe test-mode subscriptions: Free plan (3 audits/month, 5 pages) and Pro plan (30 audits/month, 20 pages), server-side usage limits, webhooks, customer portal, Stripe-not-configured fallback.
- Multilingual UI: English, O'zbekcha, Русский with a persistent language switcher and localized AI/rules recommendations.
- Rate limiting, request timeouts, page-size caps, safe URL validation, and SSRF-resistant redirect handling.
- Dark mode by default, light mode supported.

## Project structure

```
.
├── frontend/                  # Next.js + Tailwind
│   ├── app/                   # App Router pages (landing, dashboard, report, auth, history)
│   ├── components/            # UI components
│   └── lib/                   # API client + TypeScript types
├── backend/                   # FastAPI service
│   ├── app/
│   │   ├── api/               # HTTP routers (auth, audits)
│   │   ├── core/              # config, database, security, rate limiting
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/
│   │   │   ├── crawler/       # URL validation (SSRF), fetcher, parser, crawler
│   │   │   ├── analyzers/     # SEO, security, performance, accessibility, mobile, technical
│   │   │   ├── scoring.py     # transparent scoring engine
│   │   │   ├── audit_runner.py# orchestration
│   │   │   └── ai/            # provider abstraction (DeepSeek/OpenAI/Anthropic/rules)
│   │   ├── workers/queue.py   # in-process audit queue
│   │   └── main.py
│   └── tests/                 # pytest suite
├── docker-compose.yml         # PostgreSQL + Redis
└── .env.example
```

## Local setup

Requirements: Python 3.8+, Node.js 18+, npm. PostgreSQL/Redis are optional for local development (SQLite + in-process queue are the defaults).

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env            # optional; defaults work out of the box

# Run the API (creates SQLite tables automatically on startup)
uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/api/health`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The Next.js dev server rewrites `/api/*` to `http://localhost:8000/api/*`, so no CORS setup is needed locally.

### 3. Use PostgreSQL (optional)

```bash
docker compose up -d postgres redis
```

Then in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg://auditor:auditor@localhost:5432/auditor
RUN_MIGRATIONS_ON_STARTUP=true
```

### 4. Database migrations (Alembic)

The project ships with Alembic migrations. For a **fresh database**:

```bash
cd backend
alembic upgrade head
```

For an **existing database** that was created by the old `create_all` dev shortcut (e.g. the default `auditor.db`), stamp it once so Alembic knows the schema is already at the initial revision:

```bash
alembic stamp head
```

When you change the SQLAlchemy models, generate and review a new migration:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

In production set `RUN_MIGRATIONS_ON_STARTUP=true` so the API applies pending migrations automatically on startup. The app also refuses to start in production with the default `SECRET_KEY` or with a SQLite `DATABASE_URL`.

## Environment variables

See [`.env.example`](.env.example) for the full list. Important ones:

| Variable | Purpose | Default |
| --- | --- | --- |
| `ENVIRONMENT` | `development` \| `production` | `development` |
| `DATABASE_URL` | SQLAlchemy database URL. Render's `postgres://...` URL is auto-converted to `postgresql+psycopg://...` | `sqlite:///./auditor.db` |
| `RUN_MIGRATIONS_ON_STARTUP` | Run `alembic upgrade head` on startup | `false` |
| `SECRET_KEY` | JWT signing secret (change in production) | dev-only value |
| `REDIS_URL` | Reserved for future queue/cache use | `redis://localhost:6379/0` |
| `AI_PROVIDER` | `none` \| `deepseek` \| `openai` \| `anthropic` | `none` |
| `AI_API_KEY` | Provider API key (never exposed to the frontend) | empty |
| `AI_MODEL` | Optional model override | provider default |
| `AI_BASE_URL` | Optional custom base URL (DeepSeek compatible) | provider default |
| `MAX_PAGES` | Crawler page limit (Free plan default) | `5` |
| `REQUEST_TIMEOUT_SECONDS` | Per-request timeout | `15` |
| `MAX_RESPONSE_BYTES` | Max page size | `5242880` |
| `STRIPE_SECRET_KEY` | Stripe test-mode secret key (server-side only) | empty |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | empty |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for the Pro subscription | empty |
| `FREE_PLAN_MONTHLY_AUDITS` | Free plan monthly audit limit | `3` |
| `PRO_PLAN_MONTHLY_AUDITS` | Pro plan monthly audit limit | `30` |
| `BACKEND_URL` | Next.js rewrite target | `http://localhost:8000` |
| `NEXT_PUBLIC_API_URL` | Direct API base (leave empty to use the rewrite proxy) | empty |

## Stripe billing setup (test mode)

1. Create a [Stripe test account](https://dashboard.stripe.com/test/apikeys) and copy the test **secret key**.
2. Create a **Product** (e.g. "Pro") and a recurring **Price** (e.g. $19/month) in Stripe. Copy the Price ID (`price_...`).
3. Set in `.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRO_PRICE_ID=price_...
   ```
4. For local webhook testing, run `stripe listen --forward-to localhost:8000/api/billing/webhook` and copy the `whsec_...` secret.
5. If Stripe variables are empty, the app still works: every user stays on Free, the checkout/portal endpoints return a clear "payments are not configured" message, and usage limits still apply.

### Plans

| | Free | Pro |
| --- | --- | --- |
| Price | $0/month | Configurable (default $19/month) |
| Audits per month | 3 | 30 |
| Max pages per audit | 5 | 20 |
| Report | Basic | Advanced |
| Recommendations | Rules engine | AI Action Plan (when an AI provider is configured) |
| History | Audit history | Extended audit history |

## Languages

The UI is available in **English**, **O'zbekcha**, and **Русский**. Use the language selector in the navigation bar; the choice is stored in `localStorage` (`auditor_lang`) and persists across pages and refreshes.

- Translation dictionaries live in `frontend/i18n/` (`en.ts`, `uz.ts`, `ru.ts`) plus localized check titles in `checkTitles.ts`.
- The selected language is sent with new audits and passed to the AI provider, so AI-generated recommendations are requested in that language.
- The built-in rules engine marks each action with its source `check_id`, and the frontend displays localized check titles when available.
- Dynamic check descriptions (the actual measured result) remain in English in the rules-engine fallback; configure an AI provider to get fully localized recommendation text.

The AI layer receives only structured, real audit results and is explicitly instructed not to invent findings. Without a key, the **built-in rules engine** converts the failed/warning checks into a prioritized action plan, so the product works end-to-end with no external service.

Examples:

```bash
# DeepSeek
AI_PROVIDER=deepseek
AI_API_KEY=sk-...
AI_MODEL=deepseek-chat

# OpenAI
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini

# Anthropic
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-3-5-haiku-latest
```

## Running tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

The suite covers:

- URL validation and SSRF protection (localhost, private IPs, cloud metadata, encoded IPs, unsafe ports, DNS-to-private-IP)
- SEO/security/performance/accessibility/mobile analyzer behavior
- Scoring math (weighted averages, category rollups, transparency fields)
- AI recommendation parsing (JSON, code fences, garbage, sanitization, language context)
- API endpoints (health, register/login/logout/me, URL rejection, auth-gated history, cross-user protection)
- Stripe billing (free default, checkout auth, webhook signatures, lifecycle events, idempotency, usage limits, Stripe-not-configured)
- Localization dictionary parity (en/uz/ru keys, check titles)
- Alembic migrations (upgrade/downgrade, new columns/tables)

## Security considerations

- **SSRF protection**: only public http/https targets; ports restricted to 80/443; every redirect hop is re-validated; private/loopback/link-local/reserved IPs and cloud metadata endpoints are blocked; integer/hex/octal-encoded IP literals are rejected.
- **Rate limiting**: sliding-window limits for audit creation and auth attempts; concurrency caps for crawler/queue.
- **Safe crawling**: timeout, max response size, max pages, max depth, no destructive requests.
- **Secrets**: never committed; API keys are server-side only; CORS is explicit; Stripe secret/webhook keys are never exposed to the browser.
- **Auth**: PBKDF2-HMAC-SHA256 password hashing, httpOnly cookies, signed JWT, expired/invalid tokens rejected.
- **Billing**: Stripe webhook signatures are verified; subscription state is only updated by server-side webhooks, never by frontend redirects; payment status is never trusted from the browser.
- **Authorization**: user-owned audits are private — viewing, reporting, or deleting another user's audit returns 403. Anonymous audits are shareable by UUID only.
- **Input handling**: all user input validated by Pydantic; raw user HTML is never rendered dangerously; AI output is rendered as plain text.

## Known limitations (MVP)

- Audits are automated and limited to a small crawl (default 5 pages for Free, 20 for Pro). They are a health signal, not a full SEO audit or WCAG certification.
- Security checks are passive only and never claim a website is "completely secure".
- Rate limiting is in-memory; multi-instance deployments should move it to Redis.
- The in-process audit queue is not durable; use Celery/Redis when scaling beyond one instance.
- Report generation is browser-print based (server-side PDF can be added later).
- Stripe is implemented in test mode only; production billing requires switching to live keys and reviewing webhook endpoint security.
- Dynamic check descriptions in the built-in rules-engine fallback remain in English; AI providers generate fully localized recommendation text.

## Deployment

**Frontend (Vercel)**

1. Set the Vercel project root directory to `frontend`.
2. Set `BACKEND_URL` to the deployed backend origin, e.g. `https://your-backend.onrender.com`.
3. Leave `NEXT_PUBLIC_API_URL` empty so the rewrite proxy is used (this keeps auth cookies same-origin and avoids CORS/cross-site cookie issues).

**Backend (Render)**

This is a monorepo, so the Render service root must be the `backend/` folder.

1. In Render, create a **Web Service** connected to this GitHub repo.
2. Set **Root Directory** to `backend`.
   - Render then reads `backend/requirements.txt`, `backend/.python-version`, and `backend/Procfile` from the service root.
3. Set **Build Command** to:
   ```bash
   pip install -r requirements.txt
   ```
4. Set **Start Command** to (or rely on the checked-in `backend/Procfile`):
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
5. Add a managed **PostgreSQL** database and set these environment variables in Render:
   ```bash
   ENVIRONMENT=production
   SECRET_KEY=<strong-random-string>
   # You can paste Render's Internal Database URL (postgres://...) directly;
   # the app automatically converts it to use the installed psycopg v3 driver.
   DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:<port>/<database>
   RUN_MIGRATIONS_ON_STARTUP=true
   COOKIE_SECURE=true
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```
   The app applies Alembic migrations on startup and refuses to boot with the default `SECRET_KEY` or SQLite in production.

**Backend (any Python host)**

1. `cd backend`
2. Install `requirements.txt` and run `uvicorn app.main:app --host 0.0.0.0 --port 8000` behind TLS.
3. Set `ENVIRONMENT=production`, a strong `SECRET_KEY`, `DATABASE_URL` (managed PostgreSQL), `RUN_MIGRATIONS_ON_STARTUP=true`, and `COOKIE_SECURE=true`.
4. Add Redis and swap the in-process queue for Celery when scaling beyond one instance.

## License

Proprietary/private project — all rights reserved.
