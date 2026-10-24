import { expect, test } from '@playwright/test'
import { startLevel } from './helpers'
import { expectIdealApproach, observePreparedRound } from './ideal-approach'
import type { RoundAnalysis } from '../src/engine/types'

for (const [level, cushions] of [[51, 1], [57, 2], [60, 3]]) test(`bank lesson ${level} restricts the target and completes a ${cushions}-cushion shot`, async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  if (level === 57) await page.setViewportSize({ width: 390, height: 844 })
  await observePreparedRound(page)
  await page.addInitScript(({ level }) => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({
      scoringVersion: 2, courseVersion: 5, completedLessons: level - 1,
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
          if (event.data.result?.candidates) Object.assign(window, { bankResult: event.data.result })
        })
      }
    }
    Object.assign(window, { Worker: ObservedWorker })
  }, { level })
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText(`Reach ball 1 after at least ${cushions} cushion`)
  await startLevel(page, level)
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Kick shots')
  const ball = page.getByRole('button', { name: 'Select ball 1', exact: true })
  await expect(ball).toBeEnabled({ timeout: 60_000 })
  const blockers = page.locator('.ball-choice')
  expect(await blockers.evaluateAll(buttons => buttons.slice(1).every(button => (button as HTMLButtonElement).disabled))).toBe(true)
  await expect(page.locator('.unavailable-note')).toContainText('Dimmed balls are blockers')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(ball).toHaveAttribute('aria-pressed', 'true')
  await expectIdealApproach(page, 'A')
  await ball.click()
  await expectIdealApproach(page, 'A')
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  const previewPath = `/tmp/shot-selection-bank-${level}-preview.png`
  await page.locator('.table-panel').screenshot({ path: previewPath, animations: 'disabled' })
  await testInfo.attach(`Bank lesson ${level}: ideal ${cushions}-cushion approach before choosing a finish`, { path: previewPath, contentType: 'image/png' })
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await expect(page.getByRole('button', { name: /^Choose finish [ABC]$/ })).toHaveCount(3)
  await expect(page.locator('.finish-assurance')).toContainText(`cue ball to at least ${cushions} cushion`)
  for (const label of ['B', 'C', 'A'] as const) {
    await page.getByRole('button', { name: `Choose finish ${label}`, exact: true }).click()
    await expectIdealApproach(page, label)
  }
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('ideal-approach-path')).toHaveCount(0)
  await expect(page.getByLabel('Table legend', { exact: true })).not.toContainText('Ideal path')
  const result = await page.evaluate(() => (window as Window & { bankResult: RoundAnalysis }).bankResult)
  expect(result.candidates).toHaveLength(3)
  for (const candidate of result.candidates) {
    expect(candidate.nominal.cueBanksBeforeContact).toBeGreaterThanOrEqual(cushions)
    expect(candidate.nominal.firstContact).toBe(1)
    expect(candidate.nominal.potted).toContain(1)
    expect(candidate.nominal.scratch).toBe(false)
  }
  expect(result.candidates.some(candidate => candidate.successRate > 0)).toBe(true)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10_000 })
  await page.screenshot({ path: `/tmp/shot-selection-bank-${level}.png`, fullPage: true })
  await testInfo.attach(`Bank lesson ${level}`, { path: `/tmp/shot-selection-bank-${level}.png`, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(level === 60 ? 'Plants' : 'Kick shots')
  await expect(page.getByRole('button', { name: `Start level ${level + 1}`, exact: true })).toBeVisible()
})
