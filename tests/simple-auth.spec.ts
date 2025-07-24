import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { config } from '../app/env.server';

test('Simple user registration', async ({ page }) => {
  const uuid = randomUUID();
  const testUser = `simple_user_${uuid}`;
  const baseUrl = config.APP_BASE_URL;

  await page.goto(baseUrl!);
  
  // Register user
  await page.getByLabel('Username').fill(testUser);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /register/i }).click();
  
  // Should be logged in and see home page
  await expect(page).toHaveTitle("Matrix Chat");
  await expect(page.getByText(testUser)).toBeVisible();
});

test('Simple user login', async ({ page }) => {
  const uuid = randomUUID();
  const testUser = `login_user_${uuid}`;
  const baseUrl = config.APP_BASE_URL;

  await page.goto(baseUrl!);
  
  // First register
  await page.getByLabel('Username').fill(testUser);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /register/i }).click();
  await expect(page).toHaveTitle("Matrix Chat");
  
  // Logout
  await page.getByRole('link', { name: /logout/i }).click();
  await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  
  // Login again
  await page.getByLabel('Username').fill(testUser);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /login/i }).click();
  
  // Should be logged in
  await expect(page).toHaveTitle("Matrix Chat");
});