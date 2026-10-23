import { expect, type Page } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'

export async function chooseDefaultCharacter(page: Page) {
  await expect(page.getByRole('heading', { name: 'Choose your player.', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: `Choose ${DEFAULT_CHARACTER.name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Start playthrough', exact: true }).click()
}

export async function startLevel(page: Page, level?: number) {
  const name = level === undefined ? /^Start level \d+$/ : `Start level ${level}`
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Choose your ball.', exact: true })).toBeFocused()
}
