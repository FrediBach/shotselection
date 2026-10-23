import { expect, test, type Page } from '@playwright/test'
import { startLevel } from './helpers'
import type { PreparedRound, RoundAnalysis } from '../src/engine/types'

async function openPlantLesson(page: Page, level: number) {
  await page.addInitScript(({ level }) => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({
      scoringVersion: 2, courseVersion: 3, completedLessons: level - 1,
      level, score: 0, rounds: level - 1, perfect: 0, seed: 71431,
    }))
    const originalContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return originalContext.call(this, type as '2d', ...args)
    } as typeof originalContext
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.addEventListener('message', event => {
          if (event.data.result?.scenario) Object.assign(window, { plantPrepared: event.data.result })
          if (event.data.result?.candidates) Object.assign(window, { plantResult: event.data.result })
        })
      }
    }
    Object.assign(window, { Worker: ObservedWorker })
  }, { level })
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('Plant 1 → 2: hit ball 1 first to pot ball 2')
  await startLevel(page, level)
  await expect(page.getByRole('button', { name: 'Select plant 1 to 2', exact: true })).toBeEnabled({ timeout: 60_000 })
}

for (const level of [61, 70]) test(`plant lesson ${level} compares the combination with a free ball and scores the target ball`, async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  if (level === 70) await page.setViewportSize({ width: 390, height: 844 })
  await openPlantLesson(page, level)
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Plants')
  await expect(page.getByRole('button', { name: 'Plant target ball 2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Table ball 2', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('button', { name: 'Select free ball 3', exact: true })).toBeEnabled()
  const choicesPath = `/tmp/shot-selection-plant-${level}-choices.png`
  await page.screenshot({ path: choicesPath, fullPage: true })
  await testInfo.attach(`Plant lesson ${level} choices`, { path: choicesPath, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Select plant 1 to 2', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await expect(page.locator('.selected-ball-summary')).toContainText('Hit 1 first · Pot 2')
  await expect(page.locator('.stroke-pocket')).toHaveText(Array(3).fill(/Attempt ball 2 to .* pocket/))
  await expect(page.locator('.finish-assurance')).toContainText('A plant may work, miss, or offer very little margin')
  await expect(page.locator('.finish-assurance')).not.toContainText('All three are playable')
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await page.getByRole('button', { name: 'Select free ball 3', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toBeDisabled()
  await expect(page.locator('.selected-ball-summary')).toContainText('Free ball 3')
  await expect(page.locator('.stroke-pocket')).toHaveText(Array(3).fill(/Attempt ball 3 to .* pocket/))
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await page.getByRole('button', { name: 'Select plant 1 to 2', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 60_000 })
  const { result, prepared } = await page.evaluate(() => {
    const observed = window as Window & { plantPrepared: PreparedRound; plantResult: RoundAnalysis }
    return { result: observed.plantResult, prepared: observed.plantPrepared }
  })
  expect(result.candidates).toHaveLength(6)
  expect(result.selected.plan.ballId).toBe(1)
  expect(result.selected.plan.potBallId).toBe(2)
  expect(result.selected.nominal.objectPath[0]).toEqual(prepared.scenario.balls.find(ball => ball.id === 2)!.position)
  expect(result.candidates.filter(candidate => candidate.plan.ballId === 3)).toHaveLength(3)
  await expect(page.locator('.analysis-card')).toHaveCount(6)
  await expect(page.locator('.analysis-card-title').first()).toContainText('Your selection · Plant 1 → 2')
  await expect(page.locator('.analysis-metrics').first()).toContainText('Pot 2')
  await expect(page.getByRole('region', { name: 'Shot tolerance comparison' })).toContainText('Plant 1 → 2')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10_000 })
  const path = `/tmp/shot-selection-plant-${level}.png`
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(`Plant lesson ${level}`, { path, contentType: 'image/png' })
  if (level === 70) {
    await page.getByRole('button', { name: 'Next level', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Tournament table')
    await expect(page.getByRole('button', { name: 'Start level 71', exact: true })).toBeVisible()
  }
})

test('a failing plant stays selectable and is compared honestly with the hard free ball', async ({ page }) => {
  test.setTimeout(120_000)
  await openPlantLesson(page, 62)
  await page.getByRole('button', { name: 'Select plant 1 to 2', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await expect(page.getByRole('button', { name: /^Choose finish [ABC]$/ })).toHaveCount(3)
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 60_000 })
  const result = await page.evaluate(() => (window as Window & { plantResult: RoundAnalysis }).plantResult)
  const plants = result.candidates.filter(candidate => candidate.plan.ballId === 1)
  expect(plants).toHaveLength(3)
  for (const plant of plants) {
    expect(plant.nominal.potted).not.toContain(2)
    expect(plant.potRate).toBe(0)
    expect(plant.successRate).toBe(0)
  }
  expect(result.points).toBe(0)
  expect(result.best.plan.ballId).toBe(3)
  expect(result.best.successRate).toBeGreaterThan(0)
  await expect(page.locator('.result-comparison')).toContainText('Free ball 3')
  await expect(page.getByTestId('object-pot-path')).toHaveCount(0)
  expect(await page.getByTestId('object-miss-path').count()).toBeGreaterThan(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
