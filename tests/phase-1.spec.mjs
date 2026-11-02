import { test, expect } from '@playwright/test';

test('phase 1 acceptance flow', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-fragment="cart-count"]')).toHaveText('0');
  await page.getByLabel('List').check();
  await page.getByLabel('Tight').check();
  await page.getByLabel('Ink').check();
  await page.locator('[data-action="cart.add(01)"]').click();
  await page.locator('[data-action="cart.add(02)"]').click();
  await expect(page.locator('[data-fragment="cart-count"]')).toHaveText('2');
  await expect(page.locator('[data-fragment="cart-total"]')).toHaveText('42.00');
  await expect(page.locator('.trace-step')).toHaveCount(3);
  await expect(page.locator('[data-action="cart.add(02)"]')).toBeFocused();
  await page.getByRole('tab', { name: 'fragment' }).click();
  await expect(page.getByRole('tab', { name: 'fragment' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Reset playground' }).click();
  await expect(page.locator('[data-fragment="cart-count"]')).toHaveText('0');
  await expect(page.getByLabel('Cards')).toBeChecked();
  await expect(page.getByLabel('Roomy')).toBeChecked();
  await expect(page.getByLabel('Paper')).toBeChecked();
});
