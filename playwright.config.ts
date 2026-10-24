import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',timeout:60000,fullyParallel:false,workers:1,retries:0,reporter:'list',use:{baseURL:process.env.BASE_URL||'http://127.0.0.1:3001',viewport:{width:1440,height:1000},headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH},screenshot:'only-on-failure',trace:'retain-on-failure'}});
