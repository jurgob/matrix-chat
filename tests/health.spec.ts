import { test, expect } from '@playwright/test';

test('health check', async ({ page }) => {
    const baseUrl = process.env.APP_BASE_URL;
    await page.goto(`${baseUrl}/health`);
    await expect(page.locator('body')).toContainText('Service Healthy');
});