import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { config } from '../app/config';
test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(20000);
});

test('Complete user flow', async ({ page }) => {
  const uuid = randomUUID();
  const testUser = `test_user_${uuid}`;
  const testChat = `test_chat_${uuid}`;
  const testMessage = `Hello from ${testUser}!`;
  
  await test.step('Navigate to application', async () => {
    const baseUrl = config.APP_BASE_URL;
    expect(baseUrl).toBeDefined();
    await page.goto(baseUrl!);
    await expect(page).toHaveTitle("Login - Matrix Chat");
  });

  await test.step('Register new user, on success automatically be redirect to the home page', async () => {
    await page.getByLabel('Username').fill(testUser);
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: /register/i }).click();
  });

  await test.step('Check if user is redirected to home page', async () => {
    await expect(page).toHaveTitle("Login - Matrix Chat");
    await expect(page.getByRole('heading', { name: /Matrix Chat/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /logout/i })).toBeVisible();
  });

   await test.step('Exit chat and logout', async () => {
    await page.getByRole('link', { name: /logout/i }).click();
  });

  await test.step('Login with created user', async () => {
    await page.getByLabel('Username').fill(testUser);
    await page.getByLabel('Password').fill('testpassword123');
    await page.getByRole('button', { name: /login/i }).click();
  });

  await test.step('Create new chat', async () => {
    await page.getByLabel('Room Name').fill(testChat);
    await page.getByRole('button', { name: /create room/i }).click();
    await expect(page.getByText(testChat)).toBeVisible();
  });

  await test.step('Join the new chat', async () => {
    await page.getByText(testChat).click();
  });

   await test.step('Load the new chat and send message', async () => {
    await expect(page.getByText(`Room: ${testChat}`)).toBeVisible();
    // await page.getByRole('button', { name: 'Join', exact: true }).click();
    await page.getByLabel(/message/i).fill(testMessage);
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByText(testMessage)).toBeVisible();
  });

  await test.step('Exit chat and logout', async () => {
    await page.getByRole('button', { name: /leave.*room/i }).click();
    await page.getByRole('link', { name: /logout/i }).click();
  });
});
