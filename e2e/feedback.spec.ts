import { expect, test } from '@playwright/test'
import { startLevel } from './helpers'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { analyzeRound } from '../src/engine/analysis'
import type { PreparedRound, RoundAnalysis } from '../src/engine/types'

let prepared: PreparedRound
let result: RoundAnalysis
test.beforeAll(() => {
  prepared = prepareRound(generateScenario(1, 71431 + 919))
  const first = prepared.balls[0].options[0]
  result = analyzeRound(prepared, { ballId: first.plan.ballId, optionId: first.id }, { samples: 64 })
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  }, DEFAULT_CHARACTER)
})

for (const width of [1440, 360]) test(`${width}px shot coaching explains the committed choice and supports comparison and replay`, async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width, height: width === 360 ? 844 : 1050 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const selected = width === 360 ? result.best : result.candidates.at(-1)!
  const option = prepared.balls.flatMap(ball => ball.options).find(option => option.id === selected.plan.id)!
  await page.goto('/')
  await startLevel(page, 1)
  await expect(page.getByRole('button', { name: 'Explain my shot', exact: true })).toHaveCount(0)
  const ball = page.getByRole('button', { name: `Select ball ${selected.plan.ballId}`, exact: true })
  await expect(ball).toBeEnabled({ timeout: 30_000 })
  await ball.click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  const finishPanel = page.locator('.shot-panel-body[data-step="finish"]')
  await expect(finishPanel.locator('.spin-diagram')).toHaveCount(3)
  await page.locator('.shot-panel').screenshot({ path: `/tmp/shot-finish-${width}.png` })
  expect(await finishPanel.evaluate(element => ({ heightOverflow: element.scrollHeight - element.clientHeight, widthOverflow: element.scrollWidth - element.clientWidth }))).toEqual({ heightOverflow: 0, widthOverflow: 0 })
  await page.getByRole('button', { name: `Choose finish ${option.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  const opener = page.getByRole('button', { name: 'Explain my shot', exact: true })
  await expect(opener).toBeVisible({ timeout: 30_000 })
  const resultPanel = page.locator('.shot-panel-body[data-step="result"]')
  const details = resultPanel.locator('details')
  await expect(details).not.toHaveAttribute('open')
  await expect(resultPanel.getByRole('region', { name: 'Shot success rates' })).toBeVisible()
  expect(await resultPanel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.locator('.shot-panel').screenshot({ path: `/tmp/shot-result-${width}.png` })
  expect(await resultPanel.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true)
  await details.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(details).toHaveAttribute('open')
  await expect(details).toContainText('Each part rounds to 10 points')
  await page.keyboard.press('Enter')
  await expect(details).not.toHaveAttribute('open')
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused()
  if (width === 360) await expect(dialog).toHaveAccessibleName('You picked the best shot.')
  else await expect(dialog).toHaveAccessibleName('An equally strong decision.')
  await expect(dialog.locator('.feedback-plans > div').first()).toContainText(`Ball ${selected.plan.ballId} · ${option.label}`)
  await expect(dialog.locator('.feedback-reasons')).toContainText(/trials/)
  const table = dialog.getByRole('table', { name: 'Your shot compared with the best shot' })
  for (const [label, key] of [['Full objective', 'successRate'], ['Legal pot', 'legalPotRate'], ['Scratch', 'scratchRate']] as const) {
    const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    await expect(row.getByRole('cell').nth(0)).toHaveText(`${Math.round(selected[key] * 100)}%`)
    await expect(row.getByRole('cell').nth(1)).toHaveText(`${Math.round(result.best[key] * 100)}%`)
  }
  await expect(table.getByRole('rowheader', { name: 'In intended finish', exact: true })).toHaveCount(0)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const bounds = (await dialog.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
  await dialog.evaluate(element => { element.scrollTop = 0 })
  const screenshot = `/tmp/shot-feedback-${width}.png`
  await page.screenshot({ path: screenshot })
  await testInfo.attach('Shot coaching dialog', { path: screenshot, contentType: 'image/png' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()

  // Inspecting another card must not rewrite the feedback about the player's decision.
  await page.locator('.analysis-card:not(.analysis-active)').first().click()
  await opener.click()
  await expect(dialog.locator('.feedback-plans > div').first()).toContainText(`Ball ${selected.plan.ballId} · ${option.label}`)
  await dialog.getByRole('button', { name: 'Back to comparison', exact: true }).click()
  await expect(opener).toBeFocused()
  await opener.click()
  await dialog.getByRole('button', { name: 'Watch the best shot', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.analysis-active .best-tag')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Shot in motion…', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play the best shot', exact: true })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await startLevel(page, 2)
  await expect(opener).toHaveCount(0)
  expect(errors).toEqual([])
})
