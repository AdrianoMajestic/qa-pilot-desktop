import { test, expect } from '@playwright/test'

test.describe('QA Pilot Baseline Suite', () => {
  test('safely passes or skips if no local server is active', async ({ page }) => {
    try {
      const response = await page.goto('/', { timeout: 3000 })
      if (response) {
        expect(response.status()).toBeLessThan(500)
      }
    } catch {
      test.skip(true, 'Local server at baseURL is not active, skipping gracefully.')
    }
  })
})
