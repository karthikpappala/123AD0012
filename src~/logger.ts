// src/logger.ts
// Reusable Logging Middleware for campus notification platform.
// Sends structured logs to the Affordmed evaluation test server.
//
// Usage:
//   import { Log } from './logger'
//   await Log("frontend", "INFO", "notifications", "Fetched 10 notifications")

import axios, { AxiosError } from "axios";

// ── Configuration ─────────────────────────────────────────────────────────────
const AUTH_API = "http://4.224.186.213/evaluation-service/auth";
const LOG_API  = "http://4.224.186.213/evaluation-service/logs";
const TIMEOUT_MS    = 8_000;
const TOKEN_TTL_MS  = 55 * 60 * 1_000; // 55 minutes (safe buffer below 60)

// Credentials loaded from environment variables (see .env.example)
const CREDENTIALS = {
  email:        process.env.LOG_EMAIL         ?? "",
  name:         process.env.LOG_NAME          ?? "",
  rollNo:       process.env.LOG_ROLL_NO       ?? "",
  accessCode:   process.env.LOG_ACCESS_CODE   ?? "",
  clientID:     process.env.LOG_CLIENT_ID     ?? "",
  clientSecret: process.env.LOG_CLIENT_SECRET ?? "",
};

// ── Types ─────────────────────────────────────────────────────────────────────
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export type LogStack = "frontend" | "backend";

interface LogPayload {
  stack:   LogStack;
  level:   LogLevel;
  package: string;
  message: string;
}

// ── Token cache ───────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry  = 0; // epoch ms

/**
 * Fetch (or return cached) JWT from the evaluation auth endpoint.
 * Automatically refreshes when the token is within expiry window.
 */
const getAuthToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const response = await axios.post<{ token?: string; accessToken?: string }>(
    AUTH_API,
    CREDENTIALS,
    { headers: { "Content-Type": "application/json" }, timeout: TIMEOUT_MS },
  );

  const token = response.data?.token ?? response.data?.accessToken;
  if (!token) throw new Error("Auth response did not contain a token");

  cachedToken = token;
  tokenExpiry = Date.now() + TOKEN_TTL_MS;
  return token;
};

// ── Retry queue ───────────────────────────────────────────────────────────────
// Logs that failed to send are queued here and flushed on the next
// successful call — so no entry is silently dropped.
const failedQueue: LogPayload[] = [];
const MAX_QUEUE_SIZE = 200; // safety cap to avoid unbounded memory growth

const flushQueue = async (token: string): Promise<void> => {
  while (failedQueue.length > 0) {
    const entry = failedQueue[0];
    await axios.post(LOG_API, entry, {
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${token}`,
      },
      timeout: TIMEOUT_MS,
    });
    failedQueue.shift();
  }
};

// ── Internal send helper ──────────────────────────────────────────────────────
const sendLog = async (payload: LogPayload): Promise<void> => {
  const token = await getAuthToken();
  await flushQueue(token);
  await axios.post(LOG_API, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
    },
    timeout: TIMEOUT_MS,
  });
};

// ── Console echo ──────────────────────────────────────────────────────────────
const echo = (payload: LogPayload): void => {
  const ts    = new Date().toISOString().replace("T", " ").slice(0, 23);
  const label = payload.level.padEnd(5);
  const line  = `[${ts}] [${label}] [${payload.stack}/${payload.package}] ${payload.message}`;

  switch (payload.level) {
    case "ERROR": console.error(line); break;
    case "WARN":  console.warn(line);  break;
    case "DEBUG": console.debug(line); break;
    default:      console.info(line);
  }
};

// ── Core Log function ─────────────────────────────────────────────────────────
/**
 * Log — sends a structured log entry to the Affordmed evaluation server.
 *
 * @param stack   - "frontend" | "backend"
 * @param level   - "DEBUG" | "INFO" | "WARN" | "ERROR"
 * @param pkg     - Package/module name (e.g. "notifications", "auth")
 * @param message - Human-readable log message
 *
 * @example
 *   await Log("frontend", "INFO",  "notifications", "Fetched 10 notifications")
 *   await Log("backend",  "ERROR", "auth",           "Token refresh failed: 401")
 */
export const Log = async (
  stack:   LogStack,
  level:   LogLevel,
  pkg:     string,
  message: string,
): Promise<void> => {
  const payload: LogPayload = { stack, level, package: pkg, message };

  echo(payload); // always print locally first

  try {
    await sendLog(payload);
  } catch (err: unknown) {
    if (failedQueue.length < MAX_QUEUE_SIZE) {
      failedQueue.push(payload);
    }
    const reason =
      err instanceof AxiosError
        ? `HTTP ${err.response?.status ?? "?"} — ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`[LogMiddleware] Queued for retry (${failedQueue.length} pending). Reason: ${reason}`);
  }
};

// ── Factory ───────────────────────────────────────────────────────────────────
/**
 * createLogger — returns a bound logger for a specific stack + package,
 * reducing repetition at the call site.
 *
 * @example
 *   const logger = createLogger("backend", "auth")
 *   await logger.info("User login successful")
 *   await logger.error("DB connection failed")
 */
export const createLogger = (stack: LogStack, pkg: string) => ({
  debug: (message: string) => Log(stack, "DEBUG", pkg, message),
  info:  (message: string) => Log(stack, "INFO",  pkg, message),
  warn:  (message: string) => Log(stack, "WARN",  pkg, message),
  error: (message: string) => Log(stack, "ERROR", pkg, message),
});

export type Logger = ReturnType<typeof createLogger>;
