# logging-middleware

Reusable structured logging middleware for the **Affordmed campus notification platform** evaluation.

Sends every log entry to the Affordmed test server in real-time, with automatic token caching, retry queueing, and a clean API that works in both **Node.js** (backend / scripts) and **Next.js** (browser-side frontend).

---

## Features

| | |
|---|---|
| ✅ Structured logs | `stack`, `level`, `package`, `message` fields on every entry |
| ✅ Auto-auth | JWT obtained once and cached for 55 min, refreshed transparently |
| ✅ Retry queue | Failed logs queued in-memory and flushed on the next successful call |
| ✅ Dual adapter | `src/logger.ts` (axios, Node) · `lib/logger.ts` (fetch, browser/Next.js) |
| ✅ Factory helper | `createLogger(stack, pkg)` reduces repetition at call sites |
| ✅ Local echo | Every log also printed to the console with timestamp + colour-coded level |
| ✅ Fully typed | Exported `LogLevel`, `LogStack`, `Logger` TypeScript types |

---

## Project structure

```
logging-middleware/
├── src/
│   ├── logger.ts          # Core logger — axios-based, for Node / backend
│   └── index.ts           # Package public API
├── lib/
│   └── logger.ts          # Browser adapter — fetch-based, for Next.js client components
├── scripts/
│   ├── register.ts        # One-time registration helper
│   └── test-log.ts        # End-to-end smoke test
├── .env.example           # Environment variable template (copy → .env)
├── .gitignore
├── package.json
├── tsconfig.json
└── tsconfig.scripts.json  # Extended config for ts-node scripts
```

---

## Quick start

### 1 — Install dependencies

```bash
npm install
```

### 2 — Register (run once)

Edit `scripts/register.ts` and fill in your details, then:

```bash
npm run register
```

Copy the printed `clientID` and `clientSecret` — **you cannot retrieve them again**.

### 3 — Configure environment variables

```bash
cp .env.example .env
# then edit .env with your real credentials
```

### 4 — Run the smoke test

```bash
npm run test:log
```

You should see all log levels echoed in the console and confirmed on the evaluation server dashboard.

### 5 — Build (for publishing / local linking)

```bash
npm run build
# outputs to dist/
```

---

## API

### `Log(stack, level, package, message)` → `Promise<void>`

Core logging function. Works in any async context.

```ts
import { Log } from './src/logger'   // Node
// or
import { Log } from './lib/logger'   // Next.js / browser

await Log("frontend", "INFO",  "notifications", "Fetched 10 notifications from API")
await Log("backend",  "ERROR", "auth",           "Token refresh failed: 401 Unauthorized")
```

| Parameter | Type | Values |
|-----------|------|--------|
| `stack`   | `LogStack` | `"frontend"` \| `"backend"` |
| `level`   | `LogLevel` | `"DEBUG"` \| `"INFO"` \| `"WARN"` \| `"ERROR"` |
| `package` | `string`   | Module / feature name, e.g. `"auth"`, `"notifications"` |
| `message` | `string`   | Human-readable description |

---

### `createLogger(stack, package)` → `Logger`

Factory that binds `stack` and `package` once, giving you a clean logger object.

```ts
import { createLogger } from './src/logger'

const logger = createLogger("backend", "auth")

await logger.info("User login successful")
await logger.warn("Suspicious login — IP flagged")
await logger.error("DB connection lost")
await logger.debug("Query took 5 ms")
```

---

## Environment variables

| Variable | Used in | Description |
|----------|---------|-------------|
| `LOG_EMAIL` | `src/logger.ts` | Your registered email |
| `LOG_NAME` | `src/logger.ts` | Your full name |
| `LOG_ROLL_NO` | `src/logger.ts` | Your roll number |
| `LOG_ACCESS_CODE` | `src/logger.ts` | Access code from invite |
| `LOG_CLIENT_ID` | `src/logger.ts` | Received after registration |
| `LOG_CLIENT_SECRET` | `src/logger.ts` | Received after registration |
| `NEXT_PUBLIC_LOG_*` | `lib/logger.ts` | Same values, prefixed for Next.js |

---

## Using in a Next.js project

### Backend / API routes

```ts
// pages/api/notifications.ts  (or app/api/.../route.ts)
import { createLogger } from 'logging-middleware'  // after npm link / publishing
// or use a relative path:
import { createLogger } from '../../logging-middleware/src/logger'

const logger = createLogger("backend", "notifications")

export default async function handler(req, res) {
  await logger.info("Fetching notifications from DB")
  // ...
  await logger.debug(`Returned ${data.length} items`)
  res.json(data)
}
```

### Client components

```ts
// components/NotificationList.tsx
"use client"
import { createLogger } from '../../logging-middleware/lib/logger'

const logger = createLogger("frontend", "notifications")

export function NotificationList() {
  useEffect(() => {
    logger.info("NotificationList mounted")
  }, [])
  // ...
}
```

---

## How it works

```
Your code
   │
   ▼
Log() / logger.info() ...
   │
   ├─► console.echo (immediate, always)
   │
   └─► getAuthToken()
           │  cached JWT  ──────────────────────┐
           │  expired  → POST /auth → new JWT   │
           ▼                                    │
       flushQueue()  ◄── retry queued logs ◄────┤
           │                                    │
           ▼                                    │
       POST /logs  ──── success ────────────────┘
           │
           └─── failure → push to failedQueue (retried next call)
```

---

## License

MIT
