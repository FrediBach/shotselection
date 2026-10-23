import { expect, type Page } from '@playwright/test'

export async function startLevel(page: Page, level?: number) {
  const name = level === undefined ? /^Start level \d+$/ : `Start level ${level}`
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Choose your ball.', exact: true })).toBeFocused()
}
