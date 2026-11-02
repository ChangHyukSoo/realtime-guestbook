import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'member-ui.spec.ts',workers:1,use:{baseURL:'http://localhost:3002',channel:'chrome',headless:true},webServer:{command:'node tests/member-server.mjs',url:'http://localhost:3002/login',reuseExistingServer:false,timeout:120000}});
