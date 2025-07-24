import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { config } from '../app/env.server';

test('User registration and login flow', async ({ page }) => {
  const uuid = randomUUID();
  const testUser = `test_user_${uuid}`;
  const testPassword = 'testpassword123';
  const baseUrl = config.APP_BASE_URL;

  await test.step('Navigate to application', async () => {
    expect(baseUrl).toBeDefined();
    await page.goto(baseUrl!);
    await expect(page).toHaveTitle("Login - Matrix Chat");
  });

  await test.step('Register new user', async () => {
    await page.getByLabel('Username').fill(testUser);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /register/i }).click();
    
    // Should redirect to home page after successful registration
    await expect(page).toHaveTitle("Matrix Chat");
  });

  await test.step('Verify user is logged in', async () => {
    // Check that the user info appears in the header
    await expect(page.getByText(testUser, { exact: false })).toBeVisible();
    
    // Check that logout button is present
    await expect(page.getByRole('link', { name: /logout/i })).toBeVisible();
  });

  await test.step('Logout', async () => {
    await page.getByRole('link', { name: /logout/i }).click();
    
    // Should redirect back to login page
    await expect(page).toHaveTitle("Login - Matrix Chat");
    await expect(page.getByRole('button', { name: /register/i })).toBeVisible();
  });

  await test.step('Login with existing user', async () => {
    await page.getByLabel('Username').fill(testUser);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /login/i }).click();
    
    // Should redirect to home page after successful login
    await expect(page).toHaveTitle("Matrix Chat");
    
    // Verify user is logged in
    await expect(page.getByText(testUser, { exact: false })).toBeVisible();
  });

  await test.step('Final cleanup - logout', async () => {
    await page.getByRole('link', { name: /logout/i }).click();
  });
});