import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", timeout: 90_000, expect: { timeout: 15_000 },
  use: { baseURL: "http://localhost:3000", trace: "off", video: "off", screenshot: "off" },
  projects: [{ name: "x", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 } } }],
});
