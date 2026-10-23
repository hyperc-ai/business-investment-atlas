import { defineConfig, devices } from "@playwright/test";

// `npm run test:e2e` builds the app and serves it with `vite preview` under its
// production base path. `npm run test:live` runs the same suite against the
// deployed page instead; set ATLAS_URL to test another deployment.
const LIVE_URL = "https://hyperc.com/research/business-investment-atlas/";
const live = process.env.npm_lifecycle_event === "test:live" || Boolean(process.env.ATLAS_URL);
const baseURL = process.env.ATLAS_URL || (live ? LIVE_URL : "http://127.0.0.1:4173/research/business-investment-atlas/");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: live ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    // An opt-in-consent timezone keeps the hyperc.com consent gate closed, so a
    // live run sends nothing to analytics. Third-party requests are also blocked
    // in the tests themselves.
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: live
    ? undefined
    : {
        command: "npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
        url: "http://127.0.0.1:4173/research/business-investment-atlas/",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
