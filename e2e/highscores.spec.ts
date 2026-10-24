import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import type { HighscoreEntry } from '../src/lib/highscores'
import type { Session } from '../src/lib/session'
import { chooseDefaultCharacter, startLevel } from './helpers'

const blankSession: Session = {
  scoringVersion: 2, courseVersion: 5, mode: 'course', character: null,
  completedLessons: 0, level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431,
}

const savedEntries: HighscoreEntry[] = [
  { id: 'retired', playerName: 'Previous player', score: 600, rounds: 10, completedLessons: 10, totalLessons: 100, playedAt: '2026-10-19T12:00:00.000Z' },
  { id: 'zero', playerName: 'Zero score player', score: 0, rounds: 1, completedLessons: 1, totalLessons: 100, playedAt: null },
  { id: 'complete', playerName: 'Course finisher', score: 8900, rounds: 100, completedLessons: 100, totalLessons: 100, playedAt: '2026-10-20T12:00:00.000Z' },
]

const currentSession: Session = {
  ...blankSession, character: DEFAULT_CHARACTER, playthroughId: 'current',
  completedLessons: 10, level: 11, score: 800, rounds: 10,
  lastPlayedAt: '2026-10-21T12:00:00.000Z',
}

async function restore(page: Page, session = blankSession, entries: HighscoreEntry[] = []) {
  await page.addInitScript(({ session, entries }) => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    if (!localStorage.getItem('shot-selection-session')) {
      localStorage.setItem('shot-selection-session', JSON.stringify(session))
    }
    if (!localStorage.getItem('shot-selection-highscores')) {
      localStorage.setItem('shot-selection-highscores', JSON.stringify({ version: 1, entries }))
    }
    // Score persistence and dialog layout do not require a WebGL context.
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  }, { session, entries })
  await page.goto('/')
}

const readEntries = (page: Page): Promise<HighscoreEntry[]> => page.evaluate(() =>
  JSON.parse(localStorage.getItem('shot-selection-highscores') || '{"entries":[]}').entries)

async function openHighscores(page: Page) {
  await page.getByRole('button', { name: 'Highscores', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Highscores', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

test('an empty highscore list opens from the top bar and restores keyboard focus', async ({ page }) => {
  await restore(page)
  const opener = page.getByRole('button', { name: 'Highscores', exact: true })
  await expect(opener).toHaveAttribute('aria-haspopup', 'dialog')
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Highscores', exact: true })
  await expect(dialog.getByRole('heading', { name: 'Highscores', exact: true })).toBeFocused()
  await expect(dialog.getByText('No scores yet.', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('table')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await page.keyboard.press('Enter')
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  expect(await readEntries(page)).toEqual([])
})

test('saved highscores rank total points and retain percentages, dates and unfinished progress after reload', async ({ page }) => {
  await restore(page, currentSession, savedEntries)
  await startLevel(page, 11)
  const dialog = await openHighscores(page)
  const table = dialog.getByRole('table', { name: 'Course highscores', exact: true })
  await expect(table.getByRole('columnheader')).toHaveText(['Rank', 'Played', 'Score', 'Percentage', 'Progress'])
  const rows = table.getByRole('row').filter({ has: page.getByRole('cell') })
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toContainText('Course finisher')
  await expect(rows.nth(0)).toContainText('8,900')
  await expect(rows.nth(0)).toContainText('89%')
  await expect(rows.nth(0)).toContainText('100 / 100 lessons')
  await expect(rows.nth(0)).toContainText('Complete')
  await expect(rows.nth(0).locator('time')).toHaveAttribute('datetime', savedEntries[2].playedAt!)
  await expect(rows.nth(0).locator('time')).toContainText('2026')
  await expect(rows.nth(1)).toContainText(DEFAULT_CHARACTER.name)
  await expect(rows.nth(1)).toContainText('800')
  await expect(rows.nth(1)).toContainText('80%')
  await expect(rows.nth(1)).toContainText('10 / 100 lessons')
  await expect(rows.nth(1)).toContainText('In progress')
  await expect(rows.nth(1).locator('time')).toHaveAttribute('datetime', currentSession.lastPlayedAt!)
  await expect(rows.nth(2)).toContainText('Previous player')
  await expect(rows.nth(2)).toContainText('600')
  await expect(rows.nth(2)).toContainText('60%')
  await expect(rows.nth(2)).toContainText('Unfinished')
  await expect(rows.nth(3)).toContainText('Zero score player')
  await expect(rows.nth(3)).toContainText('0%')
  await expect(rows.nth(3)).toContainText('1 / 100 lessons')
  await expect(rows.nth(3)).toContainText('Date unavailable')
  const saved = await readEntries(page)
  expect(saved.map(entry => entry.id)).toEqual(['complete', 'current', 'retired', 'zero'])
  const displayed = await rows.allTextContents()
  await page.reload()
  await startLevel(page, 11)
  await openHighscores(page)
  await expect(rows).toHaveText(displayed)
  expect(await readEntries(page)).toEqual(saved)
})

test('the highscore dialog and maximum-score header fit mobile and desktop breakpoints', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await restore(page, {
    ...currentSession, completedLessons: 100, level: 101, score: 10000, rounds: 100, perfect: 100,
  }, savedEntries)
  for (const width of [1440, 1151, 1000, 901, 900, 721, 720, 601, 390, 360]) {
    await page.setViewportSize({ width, height: 800 })
    const opener = page.getByRole('button', { name: 'Highscores', exact: true })
    const headerPath = testInfo.outputPath(`highscores-header-${width}px.png`)
    await page.screenshot({ path: headerPath, animations: 'disabled' })
    await testInfo.attach(`Header at ${width}px`, { path: headerPath, contentType: 'image/png' })
    await expect(opener).toBeVisible()
    expect.soft(await page.locator('.site-header').evaluate(header => {
      const headerBounds = header.getBoundingClientRect()
      const controls = Array.from(header.querySelectorAll<HTMLElement>(':scope > .brand, :scope > .session-score, :scope > .main-nav > button'))
        .map(element => ({ element, bounds: element.getBoundingClientRect(), name: element.getAttribute('aria-label') || element.textContent!.trim() }))
        .filter(({ bounds }) => bounds.width && bounds.height)
      return {
        outside: controls.filter(({ bounds }) => bounds.left < headerBounds.left - 1 || bounds.right > headerBounds.right + 1 ||
          bounds.top < headerBounds.top - 1 || bounds.bottom > headerBounds.bottom + 1).map(({ name }) => name),
        overflow: controls.filter(({ element }) => element.scrollWidth > element.clientWidth + 1).map(({ name }) => name),
        overlaps: controls.flatMap((control, index) => controls.slice(index + 1).filter(other =>
          Math.min(control.bounds.right, other.bounds.right) - Math.max(control.bounds.left, other.bounds.left) > 1 &&
          Math.min(control.bounds.bottom, other.bounds.bottom) - Math.max(control.bounds.top, other.bounds.top) > 1,
        ).map(other => [control.name, other.name])),
      }
    }), `Header controls should fit without overlapping at ${width}px`).toEqual({ outside: [], overflow: [], overlaps: [] })
    const dialog = await openHighscores(page)
    await expect(dialog.getByRole('table', { name: 'Course highscores', exact: true })).toBeVisible()
    await expect(dialog.getByText('Zero score player', { exact: true })).toBeVisible()
    expect.soft(await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return bounds.left >= 0 && bounds.right <= innerWidth && element.scrollWidth <= element.clientWidth + 1
    }), `Dialog should fit at ${width}px`).toBe(true)
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Document should fit at ${width}px`).toBe(true)
    const path = testInfo.outputPath(`highscores-${width}px.png`)
    await page.screenshot({ path, animations: 'disabled' })
    await testInfo.attach(`Highscores at ${width}px`, { path, contentType: 'image/png' })
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
  }
})

test('a scored lesson creates one dated attempt that survives reload and starting fresh', async ({ page }) => {
  test.setTimeout(90_000)
  await restore(page, { ...blankSession, character: DEFAULT_CHARACTER })
  await startLevel(page, 1)
  expect(await readEntries(page)).toEqual([])
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await page.getByRole('button', { name: /^Choose (?:finish|stroke) A$/, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  const awarded = Number.parseInt((await page.locator('.points-awarded strong').textContent())!, 10)
  await expect.poll(() => readEntries(page)).toHaveLength(1)
  const [earned] = await readEntries(page)
  expect(earned).toMatchObject({ playerName: DEFAULT_CHARACTER.name, score: awarded, rounds: 1, completedLessons: 1, totalLessons: 100 })
  expect(earned.id).toBeTruthy()
  expect(Number.isFinite(Date.parse(earned.playedAt!))).toBe(true)
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(session).toMatchObject({ playthroughId: earned.id, lastPlayedAt: earned.playedAt })
  await page.reload()
  await startLevel(page, 2)
  let dialog = await openHighscores(page)
  const row = dialog.getByRole('table', { name: 'Course highscores', exact: true }).getByRole('row').last()
  await expect(row).toContainText(`${awarded}%`)
  await expect(row).toContainText('1 / 100 lessons')
  await expect(row).toContainText('In progress')
  expect(await readEntries(page)).toEqual([earned])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Restart session', exact: true }).click()
  await page.getByRole('button', { name: 'Start fresh', exact: true }).click()
  await chooseDefaultCharacter(page)
  await startLevel(page, 1)
  dialog = await openHighscores(page)
  await expect(dialog.getByRole('table', { name: 'Course highscores', exact: true }).getByRole('row')).toHaveCount(2)
  await expect(row).toContainText('Unfinished')
  expect(await readEntries(page)).toEqual([earned])
})
