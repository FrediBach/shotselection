import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { contactChainReplay } from '../src/engine/contact-chain'
import { followContactReplay } from '../src/engine/follow-contact'
import { verticalSpinDescription } from '../src/lib/shot-presentation'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`separate the follow catch-up contacts on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 84, level: 85, score: 0, rounds: 84, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p = prepareRound(generateScenario(85, 85 * 919))
  await page.goto('/'); await startLevel(page, 85)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Follow catch-up replay', exact: true })
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose stroke C', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Start:', { timeout: 30000 })
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10000 })
  await expect(panel.getByRole('button', { name: 'Stroke C', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const option of p.balls[0].options) {
    const sim = analyzeShot(p.scenario, option.plan, 8).nominal, replay = contactChainReplay(p.scenario, sim)
    await panel.getByRole('button', { name: `Stroke ${option.label}`, exact: true }).click()
    await expect(panel.getByRole('listitem')).toHaveCount(0)
    await expect(panel.getByTestId('follow-controls')).toContainText(`${option.plan.speed.toFixed(2)} m/s · ${verticalSpinDescription(option.plan)}`)
    await expect(panel.getByTestId('follow-catch-up')).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Previous step', exact: true })).toBeDisabled()
    for (const [i, step] of replay.steps.entries()) {
      await panel.getByRole('button', { name: 'Reveal next contact', exact: true }).click()
      await expect(panel.getByRole('status')).toContainText(`Contact ${i+1}:`)
      await expect(panel.getByRole('status')).toContainText(['first impact', 'plant transfer', 'catch-up impact'][i])
      await expect(panel.getByRole('status')).toContainText(`${step.event.time.toFixed(3)} s`)
      await expect(panel.getByRole('listitem')).toHaveCount(i+1)
      const viewport = (await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number)
      expect(viewport.slice(2)).toEqual([.7, .5])
      expect(viewport[0]).toBeCloseTo((step.event.positions[0].x + step.event.positions[1].x) / 2 - .35, 9)
      for (const ball of step.event.balls!) {
        if (ball.pocketed) { await expect(panel.getByTestId(`chain-ball-${ball.id}`)).toHaveCount(0); continue }
        const circles = panel.getByTestId(`chain-ball-${ball.id}`).locator('circle')
        expect(Number(await circles.first().getAttribute('cx'))).toBeCloseTo(ball.position.x, 9)
        expect(Number(await circles.first().getAttribute('cy'))).toBeCloseTo(ball.position.y, 9)
        await expect(circles).toHaveCount(step.pair.includes(ball.id) ? 2 : 1)
      }
    }
    const catchUp = followContactReplay(p.scenario, sim)!
    await expect(panel.getByTestId('follow-catch-up')).toContainText(`${catchUp.elapsed.toFixed(3)} s after the first`)
    await expect(panel.getByTestId('follow-catch-up')).toContainText(`${catchUp.closingSpeed.toFixed(2)} m/s`)
    await panel.getByRole('button', { name: 'Previous step', exact: true }).click()
    await expect(panel.getByTestId('follow-catch-up')).toHaveCount(0)
    await expect(panel.getByRole('listitem')).toHaveCount(2)
    await panel.getByRole('button', { name: 'Reveal next contact', exact: true }).click()
    if (option.label === 'C') {
      await panel.getByRole('img').scrollIntoViewIfNeeded()
      await page.locator('.shot-panel').screenshot({ path: `/tmp/follow-contact-${mobile ? 'mobile' : 'desktop'}.png` })
    }
    await panel.getByRole('button', { name: 'Show settled result', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('the full trick succeeds')
    await expect(panel.getByTestId('chain-ball-1')).toHaveCount(0)
    await expect(panel.getByTestId('chain-ball-2')).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Show settled result', exact: true })).toBeDisabled()
    await panel.getByRole('button', { name: 'Restart contacts', exact: true }).click()
    await expect(panel.getByRole('listitem')).toHaveCount(0)
    await expect(panel.getByTestId('follow-controls')).toContainText(`${option.plan.speed.toFixed(2)} m/s · ${verticalSpinDescription(option.plan)}`)
    await expect(panel.getByTestId('follow-catch-up')).toHaveCount(0)
    await expect(panel.getByRole('status')).toContainText('Start:')
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start level 86', exact: true })).toBeVisible()
})
