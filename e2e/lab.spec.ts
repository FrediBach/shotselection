import { expect, test, type Locator, type Page } from '@playwright/test'
import { PREMADE_CHARACTERS } from '../src/engine/characters'
import type { LabRequest, LabResult } from '../src/engine/lab'

type LabObservation = {
  requests: LabRequest[]
  results: LabResult[]
  pauseRequests: boolean
  terminatedWorkers: number
}
type ObservedWindow = Window & { labObservation: LabObservation; releaseLabRequests: () => void }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({
      scoringVersion: 2, courseVersion: 5, completedLessons: 0,
      level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431,
    }))
    const originalContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return originalContext.call(this, type as '2d', ...args)
    } as typeof originalContext
    const observation: LabObservation = { requests: [], results: [], pauseRequests: false, terminatedWorkers: 0 }
    const pending: (() => void)[] = []
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      private lab = false
      postMessage(message: { method: string; request?: LabRequest }, options?: Transferable[] | StructuredSerializeOptions) {
        if (message.method === 'lab') {
          this.lab = true
          observation.requests.push(message.request!)
          this.addEventListener('message', event => {
            if (event.data.result) observation.results.push(event.data.result)
          }, { once: true })
          // Hold dispatch only when testing cancellation, so a fast worker cannot
          // finish before the cancel click. All completed runs use real physics.
          if (observation.pauseRequests) {
            pending.push(() => super.postMessage(message, options as Transferable[]))
            return
          }
        }
        super.postMessage(message, options as Transferable[])
      }
      terminate() {
        if (this.lab) observation.terminatedWorkers++
        super.terminate()
      }
    }
    Object.assign(window, {
      Worker: ObservedWorker,
      labObservation: observation,
      releaseLabRequests: () => { observation.pauseRequests = false; pending.splice(0).forEach(dispatch => dispatch()) },
    })
  })
})

async function openLab(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sandbox mode', exact: true }).click()
  await page.getByRole('button', { name: `Choose ${PREMADE_CHARACTERS[1].name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).click()
  const lab = page.getByRole('button', { name: 'Lab mode', exact: true })
  await lab.focus()
  await page.keyboard.press('Space')
  await expect(lab).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Scenario mode', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('heading', { name: 'Build your own experiment.', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Trials per option', exact: true }).selectOption('32')
  // These experiments intentionally compare exact manual strokes, including
  // misses; automatic fitting has separate coverage in lab-auto.spec.ts.
  for (const toggle of await page.getByRole('checkbox', { name: /^Auto-adapt option / }).all()) await toggle.uncheck()
}

function option(page: Page, ordinal: number) {
  return page.getByRole('group', { name: `Option ${ordinal}`, exact: true })
}

async function setStroke(group: Locator, values: { speed: string; topSpin: string; sideSpin: string; aimOffset: string }) {
  await group.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true }).fill(values.speed)
  await group.getByRole('spinbutton', { name: 'Draw / follow', exact: true }).fill(values.topSpin)
  await group.getByRole('spinbutton', { name: 'Sidespin (rad/s)', exact: true }).fill(values.sideSpin)
  await group.getByRole('spinbutton', { name: 'Aim offset (°)', exact: true }).fill(values.aimOffset)
}

async function placeBall(page: Page, id: number, x: string, y: string) {
  await page.getByRole('button', { name: id === 0 ? 'Place cue ball' : `Place ball ${id}`, exact: true }).click()
  await page.getByRole('spinbutton', { name: 'X cm', exact: true }).fill(x)
  await page.getByRole('spinbutton', { name: 'Y cm', exact: true }).fill(y)
}

test('free layouts compare every requested stroke, including failures, with the chosen player', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openLab(page)
  await page.getByRole('combobox', { name: 'Object balls', exact: true }).selectOption('3')
  await expect(page.locator('.sandbox-ball-picker button')).toHaveCount(4)
  await page.getByRole('combobox', { name: 'Object balls', exact: true }).selectOption('2')
  await expect(page.locator('.sandbox-ball-picker button')).toHaveCount(3)
  await placeBall(page, 0, '127', '95')
  await placeBall(page, 1, '127', '38')
  await placeBall(page, 2, '210', '95')
  await page.getByRole('button', { name: 'Remove option 3', exact: true }).click()
  await page.getByRole('button', { name: 'Remove option 2', exact: true }).click()
  await page.getByRole('button', { name: 'Add option', exact: true }).click()
  const direct = option(page, 1)
  const soft = option(page, 2)
  await soft.getByRole('checkbox', { name: 'Auto-adapt option 2', exact: true }).uncheck()
  await direct.getByRole('textbox', { name: 'Name', exact: true }).fill('Direct pot')
  await direct.getByRole('combobox', { name: 'Ball', exact: true }).selectOption('1')
  await direct.getByRole('combobox', { name: 'Pocket', exact: true }).selectOption('1')
  await setStroke(direct, { speed: '1.3', topSpin: '0', sideSpin: '0', aimOffset: '0' })
  await soft.getByRole('textbox', { name: 'Name', exact: true }).fill('Too soft')
  await soft.getByRole('combobox', { name: 'Ball', exact: true }).selectOption('2')
  await soft.getByRole('combobox', { name: 'Pocket', exact: true }).selectOption('3')
  await setStroke(soft, { speed: '0.1', topSpin: '-0.4', sideSpin: '12', aimOffset: '2' })
  const layout = await page.locator('#sandbox-table-description').textContent()
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  const comparison = page.getByRole('table', { name: 'Lab comparison', exact: true })
  await expect(comparison).toBeVisible({ timeout: 60_000 })
  await expect(comparison.getByRole('button', { name: 'Inspect Direct pot', exact: true })).toBeVisible()
  const inspector = page.getByRole('group', { name: 'Ensemble inspector', exact: true })
  await expect(inspector).toBeFocused()
  const observed = await page.evaluate(() => (window as ObservedWindow).labObservation)
  expect(observed.requests).toHaveLength(1)
  expect(observed.requests[0]).toMatchObject({
    samples: 32,
    talents: PREMADE_CHARACTERS[1].talents,
    scenario: { balls: [
      { id: 0, position: { x: 1.27, y: 0.95 } },
      { id: 1, position: { x: 1.27, y: 0.38 } },
      { id: 2, position: { x: 2.1, y: 0.95 } },
    ] },
    variants: [
      { label: 'Direct pot', settings: { ballId: 1, pocketId: 1, speed: 1.3, topSpin: 0, sideSpin: 0, aimOffset: 0 } },
      { label: 'Too soft', settings: { ballId: 2, pocketId: 3, speed: 0.1, topSpin: -0.4, sideSpin: 12, aimOffset: 2 } },
    ],
  })
  expect(observed.results).toHaveLength(1)
  const result = observed.results[0]
  expect(result.samples).toBe(32)
  expect(result.shots.map(shot => shot.plan.label)).toEqual(['Direct pot', 'Too soft'])
  expect(result.shots.every(shot => shot.samples === 32 && shot.sampleBallEnds.length === 32 && shot.sampleObjectPaths.length === 32)).toBe(true)
  expect(result.shots[0].potRate).toBeGreaterThan(0)
  expect(result.shots[1]).toMatchObject({ potRate: 0, successRate: 0, failures: { misses: 32, wrongContact: 32 } })
  const stats = inspector.locator('.lab-inspection-stats')
  const diagram = inspector.getByRole('img')
  async function expectSelected(index: number) {
    const shot = result.shots[index]
    await expect(comparison.locator('button[aria-pressed="true"]')).toHaveAccessibleName(`Inspect ${shot.plan.label}`)
    await expect(inspector.getByRole('heading')).toContainText(shot.plan.label)
    await expect(diagram).toHaveAccessibleName(new RegExp(`^${shot.plan.label}:`))
    for (const [label, value] of [
      ['Success', `${(shot.successRate * 100).toFixed(1)}%`],
      ['Pot', `${(shot.potRate * 100).toFixed(1)}%`],
      ['Scratch', `${(shot.scratchRate * 100).toFixed(1)}%`],
      ['Cue spread', shot.sampleEnds.length ? `${(shot.spread * 100).toFixed(1)} cm` : 'n/a'],
    ]) await expect(stats).toContainText(new RegExp(`${label}\\s*${value.replace('.', '\\.')}`))
  }
  await expectSelected(0)
  await expect(stats).toHaveAttribute('aria-live', 'polite')
  expect(await stats.evaluate(element => element.nextElementSibling?.matches('svg.lab-ensemble-table'))).toBe(true)
  await inspector.scrollIntoViewIfNeeded()
  const scrollPosition = await page.evaluate(() => scrollY)
  for (const [key, selected] of [['ArrowRight', 1], ['ArrowDown', 0], ['ArrowLeft', 1], ['ArrowUp', 0]] as const) {
    await page.keyboard.press(key)
    await expectSelected(selected)
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(scrollPosition, 1)
  }
  await page.keyboard.press('Shift+ArrowRight')
  await expectSelected(0)
  await comparison.getByRole('button', { name: 'Inspect Too soft', exact: true }).click()
  await expectSelected(1)
  await page.keyboard.press('ArrowRight')
  await expectSelected(0)
  const trialPaths = inspector.getByRole('checkbox', { name: 'Trial paths', exact: true })
  await trialPaths.uncheck()
  // Display controls keep their native keyboard behavior; clicking the table
  // returns focus to the inspector for continued option stepping.
  await page.keyboard.press('ArrowRight')
  await expectSelected(0)
  await diagram.click({ position: { x: 40, y: 40 } })
  await expect(inspector).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expectSelected(1)
  await expect(trialPaths).not.toBeChecked()
  await expect(inspector.getByRole('checkbox', { name: 'Ball finishes', exact: true })).toBeChecked()
  await inspector.getByRole('button', { name: 'Next play option', exact: true }).click()
  await expectSelected(0)
  await inspector.getByRole('button', { name: 'Previous play option', exact: true }).click()
  await expectSelected(1)
  await trialPaths.check()
  const path = '/tmp/shot-selection-lab-desktop.png'
  await inspector.screenshot({ path })
  await testInfo.attach('Lab ensemble inspector with a failed shot selected', { path, contentType: 'image/png' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const mobilePath = '/tmp/shot-selection-lab-inspector-mobile.png'
  await inspector.screenshot({ path: mobilePath })
  await testInfo.attach('Compact ensemble stats and option stepping on mobile', { path: mobilePath, contentType: 'image/png' })
  await page.setViewportSize({ width: 1440, height: 1050 })
  await soft.getByRole('textbox', { name: 'Name', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await expectSelected(1)
  await expect(page.locator('#sandbox-table-description')).toHaveText(layout!)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toMatchObject({
    mode: 'sandbox', character: PREMADE_CHARACTERS[1], completedLessons: 0, score: 0, rounds: 0,
  })
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveCount(0)
  const strength = soft.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })
  await strength.fill('')
  await strength.blur()
  await expect(comparison).toHaveCount(0)
  await expect(strength).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeDisabled()
  await strength.fill('0.2')
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeEnabled()
  expect(errors).toEqual([])
})

test('morphs interpolate all stroke values and a cancelled run can be restarted', async ({ page }) => {
  test.setTimeout(90_000)
  await openLab(page)
  await page.locator('.lab-morph > summary').click()
  await page.getByRole('combobox', { name: 'Morph ball', exact: true }).selectOption('1')
  await page.getByRole('combobox', { name: 'Morph pocket', exact: true }).selectOption('1')
  await setStroke(page.getByRole('group', { name: 'Morph start', exact: true }), { speed: '0.7', topSpin: '-1', sideSpin: '-10', aimOffset: '-2' })
  await setStroke(page.getByRole('group', { name: 'Morph end', exact: true }), { speed: '2.1', topSpin: '1', sideSpin: '10', aimOffset: '2' })
  await page.getByRole('spinbutton', { name: 'Steps (including endpoints)', exact: true }).fill('4')
  await page.getByRole('button', { name: 'Replace options with steps', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /^Auto-adapt option / })).toHaveCount(4)
  for (let ordinal = 1; ordinal <= 4; ordinal++) {
    const generated = option(page, ordinal)
    await expect(generated.getByRole('checkbox', { name: `Auto-adapt option ${ordinal}`, exact: true })).not.toBeChecked()
    await expect(generated.getByRole('button', { name: /^Unlock / })).toHaveCount(6)
  }
  await expect(option(page, 2).getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })).toHaveValue('1.16667')
  await expect(option(page, 2).getByRole('spinbutton', { name: 'Draw / follow', exact: true })).toHaveValue('-0.33333')
  await expect(option(page, 2).getByRole('spinbutton', { name: 'Sidespin (rad/s)', exact: true })).toHaveValue('-3.33333')
  await expect(option(page, 2).getByRole('spinbutton', { name: 'Aim offset (°)', exact: true })).toHaveValue('-0.66667')
  const generatedNumbers = page.locator('.lab-option input[type="number"]')
  await expect(generatedNumbers).toHaveCount(16)
  expect(await generatedNumbers.evaluateAll(inputs => inputs.every(input => (input as HTMLInputElement).validity.valid))).toBe(true)
  await page.evaluate(() => { (window as ObservedWindow).labObservation.pauseRequests = true })
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as ObservedWindow).labObservation.terminatedWorkers)).toBe(1)
  await page.evaluate(() => (window as ObservedWindow).releaseLabRequests())
  await expect(page.getByRole('table', { name: 'Lab comparison', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Lab comparison', exact: true })).toBeVisible({ timeout: 60_000 })
  const observed = await page.evaluate(() => (window as ObservedWindow).labObservation)
  expect(observed.requests).toHaveLength(2)
  expect(observed.results).toHaveLength(1)
  const settings = observed.requests[1].variants.map(variant => variant.settings)
  expect(settings).toHaveLength(4)
  expect(settings[0]).toEqual({ ballId: 1, pocketId: 1, speed: 0.7, topSpin: -1, sideSpin: -10, aimOffset: -2 })
  expect(settings[1]).toMatchObject({
    ballId: 1, pocketId: 1, speed: expect.closeTo(1.1666666667, 8), topSpin: expect.closeTo(-0.3333333333, 8),
    sideSpin: expect.closeTo(-3.3333333333, 8), aimOffset: expect.closeTo(-0.6666666667, 8),
  })
  expect(settings[2]).toMatchObject({
    ballId: 1, pocketId: 1, speed: expect.closeTo(1.6333333333, 8), topSpin: expect.closeTo(0.3333333333, 8),
    sideSpin: expect.closeTo(3.3333333333, 8), aimOffset: expect.closeTo(0.6666666667, 8),
  })
  expect(settings[3]).toEqual({ ballId: 1, pocketId: 1, speed: 2.1, topSpin: 1, sideSpin: 10, aimOffset: 2 })
  expect(observed.results[0].shots).toHaveLength(4)
  const comparison = page.getByRole('table', { name: 'Lab comparison', exact: true })
  await page.keyboard.press('ArrowRight')
  await expect(comparison.getByRole('button', { name: 'Inspect Step 2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(comparison.getByRole('button', { name: 'Inspect Step 3', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(comparison.getByRole('button', { name: 'Inspect Step 2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Place ball 1', exact: true }).click()
  const x = page.getByRole('spinbutton', { name: 'X cm', exact: true })
  const initialX = Number(await x.inputValue())
  await page.getByRole('group', { name: 'Ball layout editor. Ball 1 selected.', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  expect(Number(await x.inputValue())).toBeCloseTo(initialX - 1, 2)
  await expect(comparison).toHaveCount(0)
})

test('mobile lab supports fifteen balls, rejects overlaps, and keeps controls within the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openLab(page)
  await page.getByRole('combobox', { name: 'Object balls', exact: true }).selectOption('15')
  await expect(page.locator('.sandbox-ball-picker button')).toHaveCount(16)
  await page.getByRole('button', { name: 'Place cue ball', exact: true }).click()
  const x = page.getByRole('spinbutton', { name: 'X cm', exact: true })
  const y = page.getByRole('spinbutton', { name: 'Y cm', exact: true })
  const cue = { x: await x.inputValue(), y: await y.inputValue() }
  await placeBall(page, 15, cue.x, cue.y)
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeDisabled()
  await expect(page.getByText('Separate the cue ball and ball 15 so they do not overlap.', { exact: true })).toBeVisible()
  await x.fill('230')
  await y.fill('110')
  const editor = page.getByRole('group', { name: 'Ball layout editor. Ball 15 selected.', exact: true })
  await editor.focus()
  await page.keyboard.press('Shift+ArrowLeft')
  expect(Number(await x.inputValue())).toBeCloseTo(229.9, 2)
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeEnabled()
  await page.locator('.lab-morph > summary').click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const path = '/tmp/shot-selection-lab-mobile.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Lab on mobile with fifteen balls and morph controls', { path, contentType: 'image/png' })
})
