import { defineConfig, devices } from "@playwright/test";

/** E2E untuk konsol peta (index /id). Memakai dev server yang sudah jalan
 *  (reuseExistingServer) supaya data dev ikut terpakai. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Peta MapLibre + tile satelit + Zarr asap membuat puluhan request terbuka
  // lama; trace + video bawaan menahan teardown context sampai keduanya
  // selesai ("Tearing down context exceeded...", zip trace korup).
  // Screenshot + trace hanya saat gagal, tanpa video.
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", video: "off", screenshot: "only-on-failure" },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://localhost:3000/id",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
