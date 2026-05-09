// lib/logger.ts
// Frontend (browser) logging adapter — uses native fetch instead of axios
// so it works in Next.js client components without a server-side import.
//
// Environment variables (set in .env.local for Next.js):
//   NEXT_PUBLIC_LOG_EMAIL, NEXT_PUBLIC_LOG_NAME, NEXT_PUBLIC_LOG_ROLL_NO
//   NEXT_PUBLIC_LOG_ACCESS_CODE, NEXT_PUBLIC_LOG_CLIENT_ID, NEXT_PUBLIC_LOG_CLIENT_SECRET

const AUTH_API = "http://4.224.186.213/evaluation-service/auth";
const LOG_API  = "http://4.224.186.213/evaluation-service/logs";

const CREDS = {
  email:        process.env.NEXT_PUBLIC_LOG_EMAIL         ?? "",
  name:         process.env.NEXT_PUBLIC_LOG_NAME          ?? "",
  rollNo:       process.env.NEXT_PUBLIC_LOG_ROLL_NO       ?? "",
  accessCode:   process.env.NEXT_PUBLIC_LOG_ACCESS_CODE   ?? "",
  clientID:     process.env.NEXT_PUBLIC_LOG_CLIENT_ID     ?? "",
  clientSecret: process.env.NEXT_PUBLIC_LOG_CLIENT_SECRET ?? "",
};

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export type LogStack = "frontend" | "backend";

// ── Token cache (browser memory) ─────────────────────────────────────────────
let _token: string | null = null;
let _tokenExpiry = 0;

const getToken = async (): Promise<string> => {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await fetch(AUTH_API, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(CREDS),
  });

  if (!res.ok) throw new Error(`Auth failed: HTTP ${res.status}`);

  const data = await res.json();
  _token = data.token ?? data.accessToken;
  if (!_token) throw new Error("No token in auth response");
  _tokenExpiry = Date.now() + 55 * 60 * 1_000;
  return _token;
};

// ── Retry queue ───────────────────────────────────────────────────────────────
type Payload = { stack: string; level: string; package: string; message: string };
const _queue: Payload[] = [];

const postLog = async (token: string, payload: Payload): Promise<void> => {
  const res = await fetch(LOG_API, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Log POST failed: HTTP ${res.status}`);
};

// ── Core Log ──────────────────────────────────────────────────────────────────
/**
 * Log(stack, level, package, message)
 * Core reusable logging function — sends structured entry to evaluation server.
 *
 * @example
 *   await Log("frontend", "INFO", "notifications", "Rendered notification list")
 */
export const Log = async (
  stack:   LogStack,
  level:   LogLevel,
  pkg:     string,
  message: string,
): Promise<void> => {
  const payload: Payload = { stack, level, package: pkg, message };

  // Local echo
  const ts    = new Date().toISOString().slice(0, 23).replace("T", " ");
  const logFn = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.info;
  logFn(`[${ts}] [${level.padEnd(5)}] [${stack}/${pkg}] ${message}`);

  try {
    const token = await getToken();

    // Flush queued entries first
    while (_queue.length > 0) {
      await postLog(token, _queue[0]);
      _queue.shift();
    }

    await postLog(token, payload);
  } catch (err) {
    _queue.push(payload);
    console.error("[LogMiddleware] Queued for retry:", err instanceof Error ? err.message : err);
  }
};

// ── Factory ───────────────────────────────────────────────────────────────────
/**
 * createLogger(stack, package) — returns a bound logger, reduces call-site noise.
 *
 * @example
 *   const logger = createLogger("frontend", "auth")
 *   await logger.info("OAuth flow started")
 */
export const createLogger = (stack: LogStack, pkg: string) => ({
  debug: (msg: string) => Log(stack, "DEBUG", pkg, msg),
  info:  (msg: string) => Log(stack, "INFO",  pkg, msg),
  warn:  (msg: string) => Log(stack, "WARN",  pkg, msg),
  error: (msg: string) => Log(stack, "ERROR", pkg, msg),
});

export type Logger = ReturnType<typeof createLogger>;
