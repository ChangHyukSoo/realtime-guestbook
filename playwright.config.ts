import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: 'guestbook.spec.ts', workers: 1, use: { baseURL: 'http://localhost:3001', headless: true, channel: 'chrome' }, webServer: { command: 'npm run dev -- --port 3001', url: 'http://localhost:3001/login', reuseExistingServer: false, timeout: 120000 } });
