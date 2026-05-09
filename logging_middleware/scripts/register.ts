// scripts/register.ts
// Run ONCE to register with the evaluation server and receive credentials.
// ⚠️  Save the printed clientID and clientSecret — you CANNOT retrieve them again.
//
// Usage:
//   npx ts-node scripts/register.ts

import axios, { AxiosError } from "axios";

const REGISTER_API = "http://4.224.186.213/evaluation-service/register";

// ── FILL IN YOUR DETAILS BEFORE RUNNING ──────────────────────────────────────
const REGISTRATION_BODY = {
  email:          "YOUR_COLLEGE_EMAIL@example.com", // must match the Google Form email
  name:           "Your Full Name",
  mobileNo:       "9999999999",
  githubUsername: "your-github-username",
  rollNo:         "your-roll-number",
  accessCode:     "YOUR_ACCESS_CODE",               // from invite email
};
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  console.log("⏳  Registering with the evaluation server …\n");

  try {
    const res = await axios.post(REGISTER_API, REGISTRATION_BODY, {
      headers: { "Content-Type": "application/json" },
      timeout: 10_000,
    });

    console.log("✅  Registration successful! Your credentials:\n");
    console.log(JSON.stringify(res.data, null, 2));
    console.log("\n⚠️   Copy clientID and clientSecret into your .env file NOW.");
    console.log("     They cannot be retrieved again.\n");
  } catch (err: unknown) {
    if (err instanceof AxiosError) {
      console.error("❌  Registration failed:", err.response?.data ?? err.message);
    } else {
      console.error("❌  Unexpected error:", err);
    }
    process.exit(1);
  }
})();
