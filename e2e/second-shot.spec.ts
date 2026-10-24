import { expect, test } from '@playwright/test'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { secondShotSetup, secondShotPlan, secondShotPotted } from '../src/engine/second-shot'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'

for (const mobile of [true, false]) test(`second shot uses the settled opener on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 31, level: 32, score: 0, rounds: 31, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const prepared = prepareRound(generateScenario(32, 32 * 919), { regenerate: false })
  const options = prepared.balls.flatMap(ball => ball.options)
  const proofs = options.flatMap(option => {
    const setup = secondShotSetup(prepared.scenario, option.plan, simulateShot(prepared.scenario, option.plan))
    return setup.routes.flatMap(route => [.95, 1.2, 1.5].flatMap(pace => [0, -.7, 1].flatMap(spin => {
      const sim = simulateShot(setup.scenario, secondShotPlan(setup.scenario, setup.ballId, route, pace, spin), { record: false })
      return secondShotPotted(setup.ballId, sim) ? [{ option, setup, route, pace, spin }] : []
    })))
  })
  expect(proofs.length).toBeGreaterThan(0)
  const proof = proofs[0]
  await page.goto('/'); await startLevel(page, 32)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  await page.getByRole('button', { name: `Choose stroke ${proof.option.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  const practice = page.getByRole('region', { name: 'Play the second shot', exact: true })
  await expect(practice).toBeVisible({ timeout: 30000 })
  const scoreBefore = await page.evaluate(() => localStorage.getItem('shot-selection-session'))
  const cue = proof.setup.scenario.balls.find(ball => ball.id === 0)!
  await expect(practice.getByRole('img', { name: 'Cue ball', exact: true })).toHaveAttribute('transform', `translate(${cue.position.x * 100} ${cue.position.y * 100})`)
  await expect(practice.getByRole('button', { name: 'Table ball 1', exact: true })).toHaveCount(0)
  await practice.getByLabel('Second-shot pocket').selectOption(String(proof.route.pocketId))
  await practice.getByLabel('Second-shot pace').selectOption(String(proof.pace))
  await practice.getByLabel('Second-shot spin').selectOption(String(proof.spin))
  await practice.getByRole('button', { name: 'Play second shot', exact: true }).click()
  await expect(practice.getByLabel('Second-shot pocket')).toBeDisabled()
  await expect(practice.getByRole('status')).toContainText('Two pots connected', { timeout: 30000 })
  await expect(practice.getByRole('button', { name: 'Table ball 2', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('shot-selection-session'))).toBe(scoreBefore)
  await practice.screenshot({ path: `/tmp/second-shot-${mobile ? 'mobile' : 'desktop'}.png` })
  await practice.getByLabel('Second-shot pace').selectOption('1.5')
  await expect(practice.getByRole('status')).toHaveCount(0)
  await expect(practice.getByRole('img', { name: 'Cue ball', exact: true })).toHaveAttribute('transform', `translate(${cue.position.x * 100} ${cue.position.y * 100})`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 33', exact: true })).toBeVisible()
  await expect(practice).toHaveCount(0)
})
