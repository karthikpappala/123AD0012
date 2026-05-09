// scripts/test-log.ts
// End-to-end smoke test — verifies auth, log posting, queue flush, and factory.
// Run after setting up your .env file:
//   npx ts-node scripts/test-log.ts

import * as dotenv from "dotenv";
dotenv.config();

import { Log, createLogger } from "../src/logger";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("🚀  Logging middleware smoke test starting …\n");

  // ── Test 1: direct Log() calls across all levels ──────────────────────────
  console.log("── Test 1: direct Log() ─────────────────────────────────────");
  await Log("frontend", "INFO",  "test-script", "Smoke test started — verifying Log() function");
  await Log("frontend", "DEBUG", "test-script", "Auth token obtained and cached successfully");
  await Log("frontend", "WARN",  "test-script", "Sample WARN entry — simulating slow API");
  await Log("frontend", "ERROR", "test-script", "Sample ERROR entry — not a real error");
  await sleep(300);

  // ── Test 2: backend stack ─────────────────────────────────────────────────
  console.log("\n── Test 2: backend stack ────────────────────────────────────");
  await Log("backend", "INFO",  "database", "Connection pool initialised (max=10)");
  await Log("backend", "DEBUG", "database", "Query executed in 42 ms: SELECT notifications");
  await Log("backend", "WARN",  "database", "Pool utilisation at 80% — consider scaling");
  await sleep(300);

  // ── Test 3: createLogger() factory ───────────────────────────────────────
  console.log("\n── Test 3: createLogger() factory ───────────────────────────");
  const feLogger  = createLogger("frontend", "notifications");
  const beLogger  = createLogger("backend",  "auth");

  await feLogger.info("Notification list rendered — 10 items");
  await feLogger.debug("Priority inbox built: top 10 of 50 selected");
  await feLogger.warn("API response time > 2000 ms — consider caching");

  await beLogger.info("JWT issued for user: student@college.edu");
  await beLogger.warn("Failed login attempt (attempt 2/5): student@college.edu");
  await beLogger.error("OAuth provider unreachable — falling back to local auth");
  await sleep(300);

  console.log("\n✅  All log entries dispatched. Check the evaluation server dashboard.\n");
})();
