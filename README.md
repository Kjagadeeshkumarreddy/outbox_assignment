# ReachInbox — Full-Stack Email Job Scheduler

Production-grade email scheduler and monitoring dashboard built for the ReachInbox Software Development Intern assignment. The service accepts email-send requests via REST API, persists state in PostgreSQL as the durable source of truth, schedules delayed dispatch through BullMQ + Redis (zero cron), and delivers emails via Ethereal SMTP with idempotency and Redis-backed rate limiting.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       React / Next.js Dashboard       |
                      |   (Google OAuth, Compose, Tables)     |
                      +-------------------+-------------------+
                                          | REST / JSON
                                          v
                      +---------------------------------------+
                      |         Express.js API Layer          |
                      |   (Zod Validation, CSV lead parsing)  |
                      +---------+-------------------+---------+
                                |                   |
                 1. INSERT row  |                   | 2. Enqueue delayed job
                                v                   v
                     +--------------------+   +-------------------+
                     |  PostgreSQL DB     |   |   BullMQ / Redis  |
                     |  (Source of Truth) |   |  (Delayed Queue)  |
                     +---------+----------+   +---------+---------+
                               ^                        |
                               | 3. Read status         | 4. Delayed
                               |    (Idempotency check) |    job dispatch
                               |                        v
                      +--------+------------------------+-----+
                      |             BullMQ Worker             |
                      | - Idempotency guard (skip if 'sent')  |
                      | - Redis hourly rate limiter           |
                      | - Worker concurrency + delay throttle |
                      +-------------------+-------------------+
                                          |
                                          | 5. Dispatch via SMTP
                                          v
                              +-----------------------+
                              |     Ethereal Email    |
                              |   (Fake SMTP Service) |
                              +-----------------------+
```

### Core Design Decisions

1. **No Cron, Zero Schedulers Polling Loops**:
   All scheduling is handled natively via BullMQ delayed jobs (`delay: scheduledAt - Date.now()`). Delayed jobs sit in Redis until their target timestamp, at which point Redis atomically promotes them to the waiting queue.
2. **Natural Deduplication via Job IDs**:
   When enqueuing jobs, we set `jobId: email.id` (using the PostgreSQL UUID primary key). BullMQ rejects duplicate job IDs if a job is already queued or delayed, preventing accidental double-enqueue.
3. **Strict Idempotency Guard**:
   Before dispatching an email through SMTP, the worker queries `SELECT * FROM emails WHERE id = $1`. If the status is already `'sent'`, the job returns immediately without sending. This guarantees that worker retries, crashes mid-flight, or multiple worker instances never send duplicate emails.
4. **Redis-Backed Distributed Rate Limiting**:
   Instead of unreliable in-memory counters that fail across worker processes or restarts, hourly limits are enforced with atomic Redis keys scoped to sender and hour window:
   `rate:${sender}:${Math.floor(Date.now() / 3600000)}`
   If the counter exceeds `MAX_EMAILS_PER_HOUR`, the job is **never dropped**; it is automatically deferred into the next hour window via `job.moveToDelayed()` and marked as `rate_limited` in the database.
5. **Surviving Restarts (Process Resilience)**:
   - Redis persists BullMQ's delayed and waiting sets across process restarts.
   - On server startup, a recovery sweep queries PostgreSQL for any orphaned records with status `pending` or `rate_limited` and reconciles them with the queue using their original `jobId`.
6. **Load Behavior (1000+ Emails Scheduled for the Same Timestamp)**:
   - The API bulk-inserts records into PostgreSQL in chunks of 100 and adds jobs to BullMQ via `addBulk()` in chunks of 250, responding to the client in milliseconds without blocking.
   - The BullMQ worker processes jobs in parallel up to `WORKER_CONCURRENCY` (default 5).
   - BullMQ's queue limiter enforces `SEND_DELAY_MS` between individual dispatches, and the hourly limiter caps throughput, spreading large batches safely over time without overwhelming SMTP.

---

## Project Structure

```
nxt_task/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth.routes.ts        # Google OAuth + session endpoints
│   │   │   ├── middleware.ts         # JWT authentication & session guard
│   │   │   └── schedule.routes.ts    # POST /schedule, GET /scheduled, GET /sent
│   │   ├── queue/
│   │   │   ├── queue.ts              # BullMQ queue instance & bulk enqueue
│   │   │   ├── worker.ts             # BullMQ worker with idempotency guard
│   │   │   └── recovery.ts           # Startup recovery sweep
│   │   ├── rateLimiter/
│   │   │   └── hourlyLimiter.ts      # Redis-backed atomic per-hour counter
│   │   ├── services/
│   │   │   ├── emailService.ts       # PostgreSQL CRUD & batch operations
│   │   │   └── mailer.ts             # Ethereal SMTP transport & auto-account
│   │   ├── db/
│   │   │   ├── client.ts             # PostgreSQL pool client
│   │   │   ├── schema.sql            # Table DDL & indices
│   │   │   └── init.ts               # Migration runner
│   │   ├── types/
│   │   │   └── index.ts              # Shared TypeScript interfaces
│   │   ├── config.ts                 # Validated environment configuration
│   │   └── index.ts                  # Express server entry point
│   ├── bridge.js                     # Windows/WSL TCP port bridge
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ComposeModal.tsx      # Modal with CSV parser & schedule options
│   │   │   ├── EmailTable.tsx        # Reusable table for scheduled & sent views
│   │   │   ├── Header.tsx            # Header with avatar, user info, logout
│   │   │   ├── LoginModal.tsx        # Google OAuth & 1-click demo login
│   │   │   ├── StatsCards.tsx        # Metric counters
│   │   │   └── TabSwitcher.tsx       # Scheduled / Sent tabs & live refresh
│   │   ├── lib/
│   │   │   └── api.ts                # Typed API client
│   │   ├── types/
│   │   │   └── index.ts              # Shared frontend interfaces
│   │   ├── App.tsx                   # Main dashboard view & polling state
│   │   └── main.tsx
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
├── docker-compose.yml                # Redis + PostgreSQL containers
└── README.md
```

---

## Setup & Running Locally

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (or local Redis + PostgreSQL)

### 1. Start Infrastructure (PostgreSQL & Redis)

Using Docker Compose:
```bash
docker compose up -d
```
This spins up PostgreSQL on port `5432` and Redis on port `6379`.

### 2. Configure Backend Environment

Copy `.env.example` to `.env` in the `backend` folder:
```bash
cd backend
cp .env.example .env
```

Default configuration in `.env`:
```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox
REDIS_HOST=localhost
REDIS_PORT=6379

WORKER_CONCURRENCY=5
SEND_DELAY_MS=500
MAX_EMAILS_PER_HOUR=100

# Ethereal Email (Leave blank to automatically generate a free test account on startup)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Google OAuth (Optional: 1-click test login is included for instant evaluator testing)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
JWT_SECRET=supersecret-dev-reachinbox-key-12345
FRONTEND_URL=http://localhost:3000
```

### 3. Initialize Database & Run Backend

```bash
cd backend
npm install
npm run build
npm start
```
The backend initializes the PostgreSQL schema, runs the restart recovery sweep, starts the BullMQ worker, and listens on `http://localhost:3001`.

*Note on Ethereal*: If `SMTP_USER` and `SMTP_PASS` are left blank, nodemailer creates an Ethereal test account on first run and logs the account address to console.

### 4. Start the Frontend Dashboard

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Feature Checklist

### Backend Requirements
- [x] **No Cron Anywhere**: Pure BullMQ delayed queue backed by Redis.
- [x] **Relational Schema**: PostgreSQL with indexed `emails` and `users` tables.
- [x] **Idempotency Guard**: Verification of database status before every send attempt; job ID equals email record ID.
- [x] **Restart Resilience**: Jobs persist in Redis across restarts; startup recovery reconciles any un-enqueued pending records.
- [x] **Worker Concurrency**: Configurable via `WORKER_CONCURRENCY` (default 5).
- [x] **Delay Between Sends**: Built-in queue rate limiter enforcing `SEND_DELAY_MS` spacing, plus per-batch recipient staggering.
- [x] **Hourly Rate Limiter**: Redis atomic counter (`rate:{sender}:{hourWindow}`) with automatic TTL and rescheduling via `job.moveToDelayed()` into the next window when cap is exceeded.
- [x] **Ethereal SMTP Integration**: Real SMTP delivery through Ethereal; captures message preview URLs.
- [x] **High Load Handling**: Bulk inserts and chunked queue dispatching for 1000+ recipient batches.

### Frontend Requirements
- [x] **Google OAuth Login**: Real Google OAuth authorization flow with callback handling, cookie session, and 1-click demo login option for instant testing.
- [x] **User Profile Header**: Displays user avatar, name, email, and logout action.
- [x] **Tab Navigation**: Clean tabs for "Scheduled Emails" and "Sent Emails" with live counter badges.
- [x] **Compose Modal**:
  - Subject and HTML body inputs.
  - CSV / TXT lead upload with drag-and-drop.
  - Defensive regex lead parser displaying real-time detected address count.
  - Start time selection: immediate vs future date/time.
  - Staggered delay input (seconds between individual leads).
  - Hourly rate limit input (configurable per batch/sender).
- [x] **Scheduled Emails Table**: Displays recipient, subject, scheduled time (relative + exact), status badge, and cancel action.
- [x] **Sent Emails Table**: Displays recipient, subject, sent timestamp, status badge, and direct clickable link to Ethereal Email web preview.
- [x] **UX States**: Shimmer loading skeletons and empty states for both views.
- [x] **Auto Refresh**: Live polling keeps table data and metric cards synchronized with background worker progress.

---

## API Reference

### Scheduling & Email Management
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/emails/schedule` | Schedule single or batch emails with optional delay, start time & hourly limit |
| `GET` | `/api/emails/scheduled` | List pending, queued, and rate-limited emails |
| `GET` | `/api/emails/sent` | List delivered and failed emails with Ethereal preview URLs |
| `GET` | `/api/emails/stats` | Aggregated metric counts (scheduled, sent, failed, rate-limited) |
| `DELETE` | `/api/emails/:id` | Cancel a scheduled email and remove it from queue |

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/google` | Redirect to Google OAuth consent screen |
| `GET` | `/api/auth/google/callback` | Exchange auth code, create session cookie, redirect to dashboard |
| `GET` | `/api/auth/me` | Fetch active authenticated user profile |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `POST` | `/api/auth/dev-login` | 1-Click test login for local evaluation without Google Cloud setup |

---

## Testing the Restart Scenario

To verify the process restart guarantee:
1. Open the dashboard at `http://localhost:3000` and click **Compose New Email**.
2. Select **Scheduled** start time 2 minutes into the future.
3. Submit the form. Notice the email appears in the **Scheduled Emails** table.
4. Stop the backend server process (`Ctrl+C` or kill process).
5. Notice that Redis retains the delayed job.
6. Start the backend server again (`npm start`).
7. Watch the console: the startup recovery runs, BullMQ reconnects, and when the target time is reached, the worker sends the email.
8. Switch to the **Sent Emails** tab: the email transitions to `Sent` with its Ethereal preview link, sent exactly once.

---

## Trade-offs & Engineering Decisions

1. **BullMQ vs Custom Redis Scheduler**:
   BullMQ was chosen because it implements delayed jobs using Redis sorted sets (`ZADD` with timestamp scores) evaluated with atomic Lua scripts. This eliminates polling race conditions and guarantees that only one worker picks up a given job even in clustered multi-node environments.
2. **PostgreSQL as Primary Source of Truth**:
   Job queues are designed for transient state. Storing all email records, retry counts, error messages, and Ethereal preview links in PostgreSQL ensures auditability and allows querying sent logs even after BullMQ removes completed jobs.
3. **Rescheduling Over Dropping on Rate Limit**:
   When a sender hits their hourly limit, throwing an error or failing the job would distort retry counts and lead to failed sends. Instead, calculating the millisecond gap until the next hour window and calling `job.moveToDelayed()` cleanly postpones delivery without marking the job as failed.
