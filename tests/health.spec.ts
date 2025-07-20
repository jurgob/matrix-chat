import { test, expect } from '@playwright/test';
import { config } from '../app/config';

test('health check', async ({ page }) => {
    const baseUrl = config.APP_BASE_URL;
    await page.goto(`${baseUrl}/health`);
    await expect(page.locator('body')).toContainText('Service Healthy');
});