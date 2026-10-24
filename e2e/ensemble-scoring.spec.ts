import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeRound } from '../src/engine/analysis'
import { startLevel } from './helpers'

for (const width of [1440, 390]) test(`level 7 explains pot and finish tradeoffs at ${width}px`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 6, level: 7, score: 0, rounds: 6, perfect: 0, seed: 71431 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(7, 71431 + 7 * 919))
  const result = analyzeRound(prepared, { ballId: 1, optionId: prepared.balls[0].options[1].id }, { samples: 64 })
  expect(result.selected.potRate).toBeGreaterThan(result.best.potRate)
  expect(result.selected.scratchRate).toBeLessThan(result.best.scratchRate)
  expect(result.selected.successRate).toBeLessThan(result.best.successRate)
  await page.goto('/')
  await startLevel(page, 7)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/ }).click()
  await page.getByRole('button', { name: 'Choose finish B', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  const ensemble = page.locator('.ensemble-section')
  await expect(ensemble.locator('.analysis-card')).toHaveCount(3)
  await expect(ensemble.locator('.analysis-card').first()).toContainText('In intended finish')
  await expect(ensemble.locator('.ensemble-scoring')).toContainText('Each option has its own finish target')
  await expect(ensemble.locator('.ensemble-scoring')).toContainText('Your route scratches less')
  await ensemble.getByText('How the score is calculated', { exact: true }).click()
  await expect(ensemble.getByRole('table')).toContainText(`${result.scoring.qualityPoints} + ${result.scoring.rankPoints} = ${result.points}`)
  await expect(ensemble.getByRole('table')).toContainText((result.selected.score * 100).toFixed(2))
  expect(await ensemble.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await ensemble.screenshot({ path: `/tmp/ensemble-scoring-${width}.png` })
})
