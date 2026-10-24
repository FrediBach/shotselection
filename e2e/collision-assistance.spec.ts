import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { analyzeRound } from '../src/engine/analysis'
import { collisionTrialSummary } from '../src/engine/collision-assistance'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`compare collision assistance on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 45, level: 46, score: 0, rounds: 45, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(46, 46 * 919), { regenerate: false }), c = p.collisionAssistance!
  const assisted = p.balls[0].options.find(o => o.id === c.assistedId)!, clean = p.balls[0].options.find(o => o.id === c.clearId)!
  const selected = mobile ? assisted : p.balls[0].options.find(o => ![c.assistedId, c.clearId].includes(o.id))!
  const result = analyzeRound(p, {ballId: 1, optionId: selected.id}, {samples: 64, talents: DEFAULT_CHARACTER.talents})
  await page.goto('/'); await startLevel(page, 46)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Collision assistance comparison', exact: true })
  const predictions = panel.getByRole('group', { name: 'Collision reliability prediction', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  if (mobile) await predictions.getByRole('button', { name: `Stroke ${assisted.label}`, exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${selected.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText(mobile ? 'The other stroke succeeds more often' : `Stroke ${clean.label} succeeds more often`, { timeout: 30000 })
  await expect(panel).toContainText(mobile ? 'is the collision-assisted reference' : 'is the third alternative')
  for (const button of await predictions.getByRole('button').all()) await expect(button).toBeDisabled()
  await expect(panel.getByRole('img')).toHaveCount(2)
  const rate = (n: number, total: number) => total ? `${n}/${total} · ${Math.round(n / total * 100)}%` : 'No trials'
  for (const option of [assisted, clean]) {
    const counts = collisionTrialSummary(result.candidates.find(s => s.plan.id === option.id)!)!
    await expect(panel.locator(`[aria-label="Stroke ${option.label} trial counts"] dd`)).toHaveText([
      rate(counts.withContact, counts.trials), rate(counts.successes, counts.trials), rate(counts.successfulContacts, counts.withContact), rate(counts.successfulClear, counts.withoutContact)
    ])
    await expect(panel.getByRole('meter', {name: `Stroke ${option.label} complete successes`, exact: true})).toHaveAttribute('value', String(counts.successes))
  }
  await expect(panel).toContainText('including trials that miss, scratch or fail to settle')
  await expect(panel).toContainText('These are the scoring trials, with no new ranking or extra trials')
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await panel.locator(`[aria-label="Stroke ${assisted.label} trial counts"]`).scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/collision-assistance-counts-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Repeat the assisted stroke without ball 3', exact: true }).click()
  const proof = panel.getByRole('img', { name: 'Fixed assisted stroke with only ball 3 removed misses the zone', exact: true })
  await expect(proof).toBeVisible()
  expect(await proof.locator('text').allTextContents()).not.toContain('3')
  for (const id of ['1','2','4','5']) expect(await proof.locator('text').allTextContents()).toContain(id)
  await expect(panel).toContainText('outside its 15.4 cm radius')
  await proof.scrollIntoViewIfNeeded()
  await page.locator('.shot-panel').screenshot({ path: `/tmp/collision-assistance-removal-${mobile ? 'mobile' : 'desktop'}.png` })
  await panel.getByRole('button', { name: 'Try the prediction again', exact: true }).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await predictions.getByRole('button', { name: `Stroke ${clean.label}`, exact: true }).click()
  await panel.getByRole('button', { name: 'Check prediction', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches the higher sampled success rate')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 47', exact: true })).toBeVisible()
  await expect(panel).toHaveCount(0)
})
