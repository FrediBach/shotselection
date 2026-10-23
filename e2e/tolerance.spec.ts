import { expect, test, type Locator, type Page } from '@playwright/test'
import { startLevel } from './helpers'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import type { PreparedRound, RoundAnalysis, ShotTolerance, ToleranceAxis } from '../src/engine/types'

interface WorkerObservation {
  method: string
  planId?: string
  completed: boolean
  terminated: boolean
  result?: ShotTolerance
  bestPlanId?: string
  plans?: { id: string; ballId: number; label: string }[]
}

type ObservedWindow = Window & { toleranceWorkers: WorkerObservation[] }

const marginRows: { label: string; axis: ToleranceAxis; side: 'negative' | 'positive'; unit: string }[] = [
  { label: 'Aim left', axis: 'angle', side: 'negative', unit: '°' },
  { label: 'Aim right', axis: 'angle', side: 'positive', unit: '°' },
  { label: 'Left English', axis: 'sideSpin', side: 'positive', unit: 'rad/s' },
  { label: 'Right English', axis: 'sideSpin', side: 'negative', unit: 'rad/s' },
  { label: 'Softer stroke', axis: 'speed', side: 'negative', unit: '%' },
  { label: 'Harder stroke', axis: 'speed', side: 'positive', unit: '%' },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
    // The table's existing fallback makes these CPU-worker tests independent of
    // software WebGL performance. The volume remains fully interactive SVG.
    const originalContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return originalContext.call(this, type as '2d', ...args)
    } as typeof originalContext

    // Observe actual worker requests/results without replacing or delaying them.
    // This lets the UI assertions catch swapped columns, stale results and spin
    // sign errors without duplicating the physics calculations in the test.
    const observations: WorkerObservation[] = []
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      observation?: WorkerObservation
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.addEventListener('message', event => {
          const observation = this.observation
          if (!observation) return
          observation.completed = true
          if (observation.method === 'tolerance') observation.result = event.data.result as ShotTolerance
          if (observation.method === 'analyze') observation.bestPlanId = (event.data.result as RoundAnalysis | undefined)?.best.plan.id
          if (observation.method === 'prepare') {
            observation.plans = (event.data.result as PreparedRound | undefined)?.balls.flatMap(ball =>
              ball.options.map(option => ({ id: option.id, ballId: ball.ballId, label: option.label })))
          }
        })
      }
      postMessage(message: { method?: string; plan?: { id: string } }, options?: Transferable[] | StructuredSerializeOptions) {
        this.observation = { method: message.method ?? '', planId: message.plan?.id, completed: false, terminated: false }
        observations.push(this.observation)
        super.postMessage(message, options as Transferable[])
      }
      terminate() {
        if (this.observation) this.observation.terminated = true
        super.terminate()
      }
    }
    Object.assign(window, { Worker: ObservedWorker, toleranceWorkers: observations })
  }, DEFAULT_CHARACTER)
})

function panel(page: Page) {
  return page.getByRole('region', { name: 'Shot tolerance comparison' })
}

async function completeRound(page: Page) {
  await page.goto('/')
  await startLevel(page)
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 45_000 })
  await expect(panel(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish B', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(panel(page).getByRole('heading', { name: 'How much room does this shot give you?' })).toBeVisible()
}

async function workerResult(page: Page, planId: string) {
  await expect.poll(() => page.evaluate(id => (window as unknown as ObservedWindow).toleranceWorkers
    .some(worker => worker.planId === id && Boolean(worker.result)), planId), { timeout: 60_000 }).toBe(true)
  return page.evaluate(id => (window as unknown as ObservedWindow).toleranceWorkers
    .find(worker => worker.planId === id && worker.result)!.result!, planId)
}

async function planForCard(page: Page, card: Locator) {
  const ballId = Number(await card.locator('.ball-icon').textContent())
  const label = (await card.locator('.analysis-card-title strong').textContent())!.match(/·\s*([ABC])/)![1]
  return page.evaluate(({ ballId, label }) => (window as unknown as ObservedWindow).toleranceWorkers
    .find(worker => worker.method === 'prepare' && worker.plans)?.plans
    ?.find(plan => plan.ballId === ballId && plan.label === label), { ballId, label }).then(plan => {
    expect(plan).toBeDefined()
    return plan!
  })
}

async function expectMargins(page: Page, inspectedId: string, bestId: string, criterion: 'success' | 'pot') {
  const [inspected, best] = await Promise.all([workerResult(page, inspectedId), workerResult(page, bestId)])
  const table = panel(page).getByRole('table', { name: 'Stroke tolerance margins' })
  await expect(table).toBeVisible({ timeout: 60_000 })
  await expect(table.getByRole('columnheader', { name: /^Inspected shot/ })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: /^Best shot/ })).toBeVisible()
  for (const { label, axis, side, unit } of marginRows) {
    const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    const values = row.getByRole('cell')
    await expect(values).toHaveCount(2)
    for (const [column, result] of [inspected, best].entries()) {
      const cell = values.nth(column)
      const bound = result.axes[axis][criterion][side]
      const nominalValid = criterion === 'success' ? result.nominalSuccess : result.nominalPot
      if (!nominalValid) {
        await expect(cell).toHaveText('No margin')
        continue
      }
      await expect(cell).toContainText(unit)
      await expect.poll(async () => {
        const text = await cell.textContent()
        const value = Number(text?.match(/\d+(?:\.\d+)?/)?.[0])
        return Math.abs(value - bound.value)
      }, { message: `${label} should show the ${criterion} worker result for ${result.planId}` }).toBeLessThanOrEqual(axis === 'angle' ? 0.011 : 0.101)
      if (bound.limited) await expect(cell).toContainText('≥')
      else await expect(cell).not.toContainText('≥')
    }
  }
  return { inspected, best }
}

test('real worker margins follow the inspected stroke, criterion and interactive success volume', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await completeRound(page)
  const selected = await planForCard(page, page.locator('.analysis-active'))
  const bestCard = page.locator('.analysis-card').filter({ has: page.locator('.best-tag') })
  const best = await planForCard(page, bestCard)
  expect(await page.evaluate(() => (window as unknown as ObservedWindow).toleranceWorkers
    .find(worker => worker.method === 'analyze')?.bestPlanId)).toBe(best.id)
  await expect(panel(page).getByRole('button', { name: 'Pot + target', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const initialResults = await expectMargins(page, selected.id, best.id, 'success')
  const headers = panel(page).getByRole('table').getByRole('columnheader')
  await expect(headers.nth(1)).toContainText(`Ball ${selected.ballId} · ${selected.label}`)
  await expect(headers.nth(2)).toContainText(`Ball ${best.ballId} · ${best.label}`)

  const plot = panel(page).getByTestId('tolerance-volume-plot')
  await expect(plot).toBeVisible()
  await expect(plot).toHaveAttribute('aria-label', `Your selection · Ball ${selected.ballId} · ${selected.label} sampled success volume`)
  await expect(plot.locator('.tolerance-volume-point-success')).toHaveCount(initialResults.inspected.volume.successCount)
  await panel(page).getByRole('checkbox', { name: 'Show unsuccessful samples' }).check()
  await expect(plot.locator('circle[class^="tolerance-volume-point-"]')).toHaveCount(initialResults.inspected.volume.points.length)
  await panel(page).getByRole('checkbox', { name: 'Show unsuccessful samples' }).uncheck()
  const initialYaw = await plot.getAttribute('data-yaw')
  await panel(page).getByRole('button', { name: 'Rotate volume right', exact: true }).click()
  await expect(plot).not.toHaveAttribute('data-yaw', initialYaw!)
  await panel(page).getByRole('button', { name: 'Reset volume view', exact: true }).click()
  await expect(plot).toHaveAttribute('data-yaw', initialYaw!)
  await plot.scrollIntoViewIfNeeded()
  const bounds = (await plot.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.6, { steps: 6 })
  await page.mouse.up()
  await expect(plot).not.toHaveAttribute('data-yaw', initialYaw!)
  await panel(page).getByRole('button', { name: 'Strength slice', exact: true }).click()
  const slice = panel(page).getByRole('slider', { name: 'Shot strength slice' })
  await expect(slice).toBeVisible()
  const initialSlice = await slice.inputValue()
  await slice.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slice).not.toHaveValue(initialSlice)
  await panel(page).getByRole('button', { name: 'Full volume', exact: true }).click()

  await panel(page).getByRole('button', { name: 'Legal pot', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: 'Legal pot', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expectMargins(page, selected.id, best.id, 'pot')
  // The graph always requires pot + target, even when the table shows pot alone.
  await expect(plot.locator('.tolerance-volume-point-success')).toHaveCount(initialResults.inspected.volume.successCount)
  await panel(page).getByRole('button', { name: 'Pot + target', exact: true }).click()

  const alternatives = page.locator('.analysis-card').filter({ hasNot: page.locator('.best-tag') })
  const nextCard = alternatives.last()
  const nextPlan = await planForCard(page, nextCard)
  await nextCard.click()
  await expect(nextCard).toHaveAttribute('aria-pressed', 'true')
  const nextResults = await expectMargins(page, nextPlan.id, best.id, 'success')
  await expect(headers.nth(1)).toContainText(`Ball ${nextPlan.ballId} · ${nextPlan.label}`)
  await expect(headers.nth(2)).toContainText(`Ball ${best.ballId} · ${best.label}`)
  await expect(plot.locator('.tolerance-volume-point-success')).toHaveCount(nextResults.inspected.volume.successCount)
  await panel(page).getByRole('button', { name: 'Best volume', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: 'Best volume', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(plot).toHaveAttribute('aria-label', `Best shot · Ball ${best.ballId} · ${best.label} sampled success volume`)
  await expect(plot.locator('.tolerance-volume-point-success')).toHaveCount(nextResults.best.volume.successCount)
  await bestCard.click()
  await expectMargins(page, best.id, best.id, 'success')
  await expect(panel(page).getByRole('button', { name: 'Best volume', exact: true })).toHaveCount(0)
  const screenshotPath = '/tmp/shot-selection-tolerance-desktop.png'
  await panel(page).screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('Desktop shot tolerance comparison', { path: screenshotPath, contentType: 'image/png' })

  // Start a fresh analysis, then immediately advance. The in-flight worker must
  // be terminated and must never resurrect the old round's panel or scores.
  const unvisitedCard = alternatives.filter({ hasNotText: `Ball ${nextPlan.ballId} · ${nextPlan.label}` }).last()
  const unvisited = await planForCard(page, unvisitedCard)
  await unvisitedCard.click()
  await expect.poll(() => page.evaluate(id => (window as unknown as ObservedWindow).toleranceWorkers
    .some(worker => worker.method === 'tolerance' && worker.planId === id), unvisited.id)).toBe(true)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await startLevel(page, 2)
  await expect(panel(page)).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as ObservedWindow).toleranceWorkers
    .filter(worker => worker.method === 'tolerance').every(worker => worker.terminated))).toBe(true)
  await expect(page.locator('.ball-choice:enabled').first()).toBeVisible({ timeout: 45_000 })
  await expect(panel(page)).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).rounds)).toBe(1)
  expect(errors).toEqual([])
})

test('tolerance stats and volume fit a 360px screen and support keyboard controls', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 360, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await completeRound(page)
  const selected = await planForCard(page, page.locator('.analysis-active'))
  const best = await planForCard(page, page.locator('.analysis-card').filter({ has: page.locator('.best-tag') }))
  await expectMargins(page, selected.id, best.id, 'success')
  const plot = panel(page).getByTestId('tolerance-volume-plot')
  await expect(plot).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  for (const element of [panel(page), panel(page).getByRole('table'), plot]) {
    const bounds = (await element.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(361)
  }
  const yaw = await plot.getAttribute('data-yaw')
  await panel(page).getByRole('button', { name: 'Rotate volume left', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(plot).not.toHaveAttribute('data-yaw', yaw!)
  await panel(page).getByRole('button', { name: 'Legal pot', exact: true }).focus()
  await page.keyboard.press('Space')
  await expectMargins(page, selected.id, best.id, 'pot')
  const path = '/tmp/shot-selection-tolerance-mobile.png'
  await panel(page).screenshot({ path, animations: 'disabled' })
  await testInfo.attach('Mobile shot tolerance comparison', { path, contentType: 'image/png' })
})
