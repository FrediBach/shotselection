import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import type { LessonResult, Session } from '../src/lib/session'
import { chooseDefaultCharacter } from './helpers'

const history: LessonResult[] = Array.from({ length: 100 }, (_, index) => ({
  level: index + 1,
  points: Math.floor(index / 10) * 10,
  evidence: {
    selected: {
      quality: 0.5, successRate: 0.45, potRate: 0.65, scratchRate: 0.08,
      positionRate: index < 34 ? 0.5 : index < 67 ? 0.7 : 0.87,
      nextShotRate: 0.7,
    },
    best: {
      quality: 0.9, successRate: 0.9, potRate: 0.9, scratchRate: 0.02,
      positionRate: 0.9, nextShotRate: 0.9,
    },
  },
}))

async function restoreCompletedCourse(page: Page, recordedHistory?: LessonResult[]) {
  const session: Session = {
    scoringVersion: 2, courseVersion: 5, mode: 'course', character: DEFAULT_CHARACTER,
    completedLessons: 100, level: 101, score: 4500, rounds: 100, perfect: 0, seed: 71431,
    ...(recordedHistory ? { history: recordedHistory } : {}),
  }
  await page.addInitScript(saved => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    if (!localStorage.getItem('shot-selection-session')) {
      localStorage.setItem('shot-selection-session', JSON.stringify(saved))
    }
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  }, session)
  await page.goto('/')
  const summary = page.getByRole('region', { name: 'Course complete', exact: true })
  await expect(summary).toBeVisible()
  await expect(summary.getByRole('heading', { name: 'Even the broken table couldn’t stop you.', exact: true })).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  return summary
}

test('a completed course restores the score journey and separates persistent weaknesses from improvement', async ({ page }, testInfo) => {
  const summary = await restoreCompletedCourse(page, history)
  await expect(summary.getByRole('heading', { name: 'Your 100-level journey', exact: true })).toBeVisible()
  await expect(summary.getByRole('heading', { name: 'Chapter by chapter', exact: true })).toBeVisible()
  await expect(summary.getByRole('heading', { name: 'What still needs work', exact: true })).toBeVisible()
  const slider = summary.getByRole('slider', { name: 'Inspect a level', exact: true })
  await expect(slider).toHaveAttribute('min', '1')
  await expect(slider).toHaveAttribute('max', '100')
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(slider).toHaveValue('1')
  await expect(slider).toHaveAttribute('aria-valuetext', 'Level 1, 0 points')
  await expect(summary.locator('.journey-selected-score')).toContainText('0 / 100')
  await page.keyboard.press('End')
  await expect(slider).toHaveValue('100')
  await expect(slider).toHaveAttribute('aria-valuetext', 'Level 100, 90 points')
  await expect(summary.getByRole('img', { name: 'Scores across 100 levels', exact: true }).locator('.journey-score-dot')).toHaveCount(100)
  const chapters = summary.getByRole('group', { name: 'Chapter average scores', exact: true })
  await expect(chapters.getByRole('button')).toHaveCount(10)
  await expect(chapters.getByRole('button', { name: 'First strokes, 0 average points from 10 recorded levels', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await chapters.getByRole('button', { name: 'Broken table, 90 average points from 10 recorded levels', exact: true }).click()
  await expect(summary.locator('.chapter-score-detail')).toContainText('Levels 91–100 · 10/10 recorded')
  await expect(summary.locator('.chapter-score-detail')).toContainText('First half 90')
  await expect(summary.locator('.chapter-score-detail')).toContainText('Second half 90')
  const potting = summary.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Pot selection', exact: true }) })
  await expect(potting).toContainText('Still a focus')
  await expect(potting).toContainText('25 percentage points')
  await expect(potting).toContainText('Review levels 100, 99, 98, 97')
  const position = summary.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Cue-ball position', exact: true }) })
  await expect(position).toContainText('Gap reduced')
  await expect(position).not.toContainText('Still a focus')
  await expect(summary.locator('.report-history-note')).toHaveCount(0)

  const screenshot = testInfo.outputPath('course-completion-desktop.png')
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
  await testInfo.attach('Completed course on desktop', { path: screenshot, contentType: 'image/png' })
  await summary.getByText('View all level scores', { exact: true }).click()
  const table = summary.getByRole('region', { name: 'Recorded level scores', exact: true }).getByRole('table')
  await expect(table.getByRole('row')).toHaveCount(101)
  await expect(table.getByRole('row').nth(1).getByRole('cell').last()).toHaveText('0')
  await expect(table.getByRole('row').last().getByRole('cell').last()).toHaveText('90')

  const beforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(beforeReload.history).toEqual(history)
  await page.reload()
  await expect(summary).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(beforeReload)
})

test('partial history keeps missing levels distinct from zero scores and avoids unsupported weakness claims', async ({ page }) => {
  const recorded = history.slice(-3)
  const summary = await restoreCompletedCourse(page, recorded)
  await expect(summary.locator('.report-history-note')).toContainText('3 of 100 level scores were recorded')
  await expect(summary.locator('.report-stats')).toContainText('4,500')
  await expect(summary.getByRole('img', { name: 'Scores across 100 levels', exact: true }).locator('.journey-score-dot')).toHaveCount(3)
  const slider = summary.getByRole('slider', { name: 'Inspect a level', exact: true })
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(slider).toHaveAttribute('aria-valuetext', 'Level 1, no recorded score')
  await expect(summary.locator('.journey-selected-score')).toContainText('Not recorded')
  const chapters = summary.getByRole('group', { name: 'Chapter average scores', exact: true })
  await expect(chapters.getByRole('button', { name: /no recorded scores/ })).toHaveCount(9)
  await expect(chapters.getByRole('button', { name: 'Broken table, 90 average points from 3 recorded levels', exact: true })).toBeVisible()
  await expect(summary.getByRole('heading', { name: 'A little more history is needed.', exact: true })).toBeVisible()
  await expect(summary.getByRole('article')).toHaveCount(0)
  await summary.getByText('View all level scores', { exact: true }).click()
  const table = summary.getByRole('region', { name: 'Recorded level scores', exact: true }).getByRole('table')
  await expect(table.getByRole('row')).toHaveCount(4)
  await expect(table.getByRole('rowheader')).toHaveText(['98', '99', '100'])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).history)).toEqual(recorded)
})

test('older completed saves preserve earned totals without inventing a score history', async ({ page }) => {
  const summary = await restoreCompletedCourse(page)
  await expect(summary.locator('.report-history-note')).toContainText('This save has no recorded level history.')
  await expect(summary.locator('.report-stats')).toContainText('4,500')
  await expect(summary.locator('.report-stats')).toContainText('not recorded')
  await expect(summary.getByRole('heading', { name: 'Your finish is saved.', exact: true })).toBeVisible()
  await expect(summary.getByRole('slider')).toHaveCount(0)
  await expect(summary.getByRole('img', { name: 'Scores across 100 levels', exact: true })).toHaveCount(0)
  await expect(summary.getByRole('group', { name: 'Chapter average scores', exact: true }).getByRole('button', { name: /no recorded scores/ })).toHaveCount(10)
  await expect(summary.getByRole('article')).toHaveCount(0)
  await page.reload()
  await expect(summary.locator('.report-history-note')).toContainText('This save has no recorded level history.')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).score)).toBe(4500)
})

test('the mobile completion report fits the viewport and restarting clears the old results', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 })
  const summary = await restoreCompletedCourse(page, history)
  const slider = summary.getByRole('slider', { name: 'Inspect a level', exact: true })
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(slider).toHaveValue('1')
  await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveValue('2')
  await page.keyboard.press('End')
  await expect(slider).toHaveValue('100')
  await expect(summary.getByRole('button', { name: 'Inspect next level', exact: true })).toBeDisabled()
  await summary.getByRole('button', { name: 'Inspect previous level', exact: true }).click()
  await expect(slider).toHaveValue('99')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect.poll(() => summary.getByRole('img', { name: 'Scores across 100 levels', exact: true })
    .locator('text').first().evaluate(element => element.getBoundingClientRect().height),
  { message: 'Mobile chart tick labels should remain readable without zooming' }).toBeGreaterThanOrEqual(10)
  await expect.poll(() => slider.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return bounds.left >= 0 && bounds.right <= innerWidth
  })).toBe(true)
  const screenshot = testInfo.outputPath('course-completion-mobile.png')
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
  await testInfo.attach('Completed course on mobile', { path: screenshot, contentType: 'image/png' })
  await summary.getByText('View all level scores', { exact: true }).click()
  await expect(summary.getByRole('region', { name: 'Recorded level scores', exact: true }).getByRole('table')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  await summary.getByRole('button', { name: 'Start a new course', exact: true }).click()
  await chooseDefaultCharacter(page)
  await expect(page.getByRole('dialog', { name: 'Your first pot', exact: true })).toBeVisible()
  const restarted = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(restarted).toMatchObject({ completedLessons: 0, rounds: 0, score: 0, perfect: 0, level: 1 })
  expect(restarted.history ?? []).toEqual([])
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Your first pot', exact: true })).toBeVisible()
  await expect(summary).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).history ?? [])).toEqual([])
})
