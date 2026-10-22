import { expect, test, type Page } from '@playwright/test'
import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { analyzeRound } from '../src/engine/analysis'
import { scoreSelection } from '../src/engine/scoring'

let perfect: { ballId: number; label: string }
let ordinary: { ballId: number; label: string }

test.beforeAll(() => {
  const prepared = prepareRound(generateScenario(1, 71431 + 919))
  const first = prepared.balls[0].options[0]
  const result = analyzeRound(prepared, { ballId: first.plan.ballId, optionId: first.id }, { samples: 64 })
  const lesser = result.candidates.find(shot => {
    const { points } = scoreSelection(shot, result.candidates)
    return points > 0 && points < 100
  })!
  expect(lesser).toBeDefined()
  const options = prepared.balls.flatMap(ball => ball.options)
  perfect = { ballId: result.best.plan.ballId, label: options.find(option => option.id === result.best.plan.id)!.label }
  ordinary = { ballId: lesser.plan.ballId, label: options.find(option => option.id === lesser.plan.id)!.label }
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    if (!localStorage.getItem('shot-selection-session')) localStorage.setItem('shot-selection-session', JSON.stringify({ scoringVersion: 2, level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
    // Count real Web Audio starts without replacing browser audio behavior.
    const log = { starts: 0, states: [] as string[] }
    Object.assign(window, { soundLog: log })
    const original = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function() {
      const oscillator = original.call(this)
      const start = oscillator.start.bind(oscillator)
      oscillator.start = (when?: number) => {
        log.starts += 1
        log.states.push(this.state)
        start(when)
      }
      return oscillator
    }
  })
})

async function soundStarts(page: Page) {
  return page.evaluate(() => (window as unknown as { soundLog: { starts: number } }).soundLog.starts)
}

async function scoreRound(page: Page, choice: { ballId: number; label: string }) {
  const ball = page.getByRole('button', { name: `Select ball ${choice.ballId}`, exact: true })
  await expect(ball).toBeEnabled({ timeout: 30_000 })
  await ball.click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await page.getByRole('button', { name: `Choose finish ${choice.label}`, exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 30_000 })
}

test('100 points celebrates once; real audio plays for selections and moving balls and respects mute', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  expect(await soundStarts(page)).toBe(0)
  await scoreRound(page, perfect)
  await expect(page.locator('.points-awarded strong')).toHaveText('100 / 100')
  const celebration = page.getByRole('status').filter({ hasText: 'Perfect choice! You earned 100 points.' })
  await expect(celebration).toBeVisible()
  await expect(celebration).toHaveCSS('pointer-events', 'none')
  await expect.poll(() => soundStarts(page)).toBeGreaterThan(3)
  await expect.poll(() => page.locator('.perfect-celebration-badge').evaluate(node => Number(getComputedStyle(node).opacity)), { timeout: 15000, intervals: [100] }).toBeGreaterThan(0.9)
  const path = '/tmp/shot-selection-perfect-desktop.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Perfect score celebration', { path, contentType: 'image/png' })
  await expect(celebration).toHaveCount(0, { timeout: 15000 })

  const beforeReplay = await soundStarts(page)
  await page.getByRole('button', { name: 'Play the best shot' }).click()
  await expect.poll(() => soundStarts(page), { timeout: 15000 }).toBeGreaterThan(beforeReplay + 2)
  await expect(page.getByRole('button', { name: 'Play the best shot' })).toBeEnabled({ timeout: 25000 })
  await expect(celebration).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { soundLog: { states: string[] } }).soundLog.states.every(state => state === 'running'))).toBe(true)

  await page.getByRole('button', { name: 'Mute sound effects' }).click()
  const beforeMutedReplay = await soundStarts(page)
  await page.getByRole('button', { name: 'Play the best shot' }).click()
  await expect(page.getByRole('button', { name: 'Shot in motion…' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Play the best shot' })).toBeEnabled({ timeout: 25000 })
  expect(await soundStarts(page)).toBe(beforeMutedReplay)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enable sound effects' })).toHaveAttribute('aria-pressed', 'false')
  await expect(celebration).toHaveCount(0)
  expect(errors).toEqual([])
})

test('mobile reduced-motion celebration stays visible while muted and clears on next level', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  })
  await page.goto('/')
  await scoreRound(page, perfect)
  await expect(page.locator('.perfect-celebration')).toHaveCSS('position', 'fixed')
  await expect(page.locator('.perfect-celebration-badge')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.perfect-celebration-confetti')).toHaveCSS('display', 'none')
  await expect(page.locator('.perfect-celebration-badge')).toBeInViewport()
  const path = '/tmp/shot-selection-perfect-mobile.png'
  await page.screenshot({ path })
  await testInfo.attach('Reduced-motion mobile celebration', { path, contentType: 'image/png' })
  expect(await soundStarts(page)).toBe(0)
  await page.getByRole('button', { name: 'Next level' }).click()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('an ordinary round crossing 100 session points does not trigger the perfect celebration', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shot-selection-session', JSON.stringify({ scoringVersion: 2, level: 1, score: 90, rounds: 1, perfect: 0, seed: 71431 })))
  await page.goto('/')
  await scoreRound(page, ordinary)
  expect(Number.parseInt((await page.locator('.points-awarded strong').textContent())!, 10)).toBeLessThan(100)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0)
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(session.score).toBeGreaterThanOrEqual(100)
  expect(session.perfect).toBe(0)
})
