import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(20000);
});

test('Duplicate user registration should show error', async ({ page }) => {
  const uuid = randomUUID();
  const testUser = `duplicate_user_${uuid}`;
  const baseUrl = process.env.APP_BASE_URL;

  await test.step('Navigate to application', async () => {
    expect(baseUrl).toBeDefined();
    await page.goto(baseUrl!);
    await expect(page).toHaveTitle("Login - Matrix Chat");
  });

  await test.step('Register user first time (should succeed)', async () => {
    await page.getByLabel('Username').fill(testUser);
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: /register/i }).click();
    
    // Wait for successful registration (redirect to home)
    await expect(page.getByRole('heading', { name: /Matrix Chat/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /logout/i })).toBeVisible();
  });

  await test.step('Logout after first registration', async () => {
    await page.getByRole('link', { name: /logout/i }).click();
    await expect(page).toHaveTitle("Login - Matrix Chat");
  });

  await test.step('Try to register same user again (should fail)', async () => {
    await page.getByLabel('Username').fill(testUser);
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: /register/i }).click();
    
    // Should see accessible error message
    await expect(page.getByRole('alert')).toContainText(/User ID is not available/i);
  });
});