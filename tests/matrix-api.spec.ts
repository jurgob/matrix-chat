import { test, expect } from '@playwright/test';
import { config } from '../app/config';

test.describe('Matrix API Tests', () => {
  test('should return 200 and valid JSON for Matrix client versions endpoint', async ({ request }) => {
    const matrixBaseUrl = config.MATRIX_BASE_URL;
    const response = await request.get(`${matrixBaseUrl}/_matrix/client/versions`);
    
    expect(response.status()).toBe(200);
    
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
    
    const responseBody = await response.json();
    expect(responseBody).toBeDefined();
    expect(responseBody).toHaveProperty('versions');
    expect(Array.isArray(responseBody.versions)).toBeTruthy();
  });

  test('should return valid Matrix server information', async ({ request }) => {
    const matrixBaseUrl = config.MATRIX_BASE_URL;
    const response = await request.get(`${matrixBaseUrl}/_matrix/client/versions`);
    
    const responseBody = await response.json();
    
    // Check that we have Matrix version information
    expect(responseBody.versions).toContain('r0.6.1');
    expect(responseBody.versions.length).toBeGreaterThan(0);
  });
});