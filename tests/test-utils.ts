import { expect, Page } from '@playwright/test';

/**
 * Shared test utility for user registration and login
 */
export async function registerAndLogin(page: Page, baseUrl: string, username: string, password: string = 'testpassword123') {
  await page.goto(baseUrl);
  await expect(page).toHaveTitle("Login - Matrix Chat");
  
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /register/i }).click();
  
  await expect(page.getByRole('heading', { name: /Matrix Chat/i })).toBeVisible();
}

/**
 * Shared test utility for user login (existing user)
 */
export async function loginExistingUser(page: Page, baseUrl: string, username: string, password: string = 'testpassword123') {
  await page.goto(baseUrl);
  await expect(page).toHaveTitle("Login - Matrix Chat");
  
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /login/i }).click();
  
  await expect(page.getByRole('heading', { name: /Matrix Chat/i })).toBeVisible();
}

/**
 * Shared test utility for logout
 */
export async function logout(page: Page) {
  await page.getByRole('link', { name: /logout/i }).click();
  await expect(page).toHaveTitle("Login - Matrix Chat");
}

/**
 * Shared test utility for creating a room
 */
export async function createRoom(page: Page, roomName: string) {
  await page.getByPlaceholder('Enter room name').fill(roomName);
  await page.getByRole('button', { name: /create room/i }).click();
  
  // Verify the room appears in the sidebar
  await expect(page.locator('.bg-gray-800').getByText(`# ${roomName}`)).toBeVisible({ timeout: 5000 });
}