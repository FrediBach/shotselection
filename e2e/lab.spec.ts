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

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(webgl => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({
      scoringVersion: 2, courseVersion: 5, completedLessons: 0,
      level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431,
    }))
    if (!webgl) {
      const originalContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
        if (type === 'webgl2') return null
        return originalContext.call(this, type as '2d', ...args)
      } as typeof originalContext
    }
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
  }, testInfo.tags.includes('@webgl'))
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
  await expect(page.getByRole('heading', { name: 'Shot lab', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Trials per option', exact: true }).selectOption('32')
  // These experiments intentionally compare exact manual strokes, including
  // misses; automatic fitting has separate coverage in lab-auto.spec.ts.
  const cancelAdapting = page.getByRole('button', { name: 'Cancel adapting', exact: true })
  if (await cancelAdapting.isVisible()) await cancelAdapting.click()
  for (let ordinal = 1; ordinal <= 3; ordinal++) {
    const selected = await selectOption(page, ordinal)
    await selected.getByRole('checkbox', { name: `Auto-adapt option ${ordinal}`, exact: true }).uncheck()
  }
  await selectOption(page, 1)
}

function option(page: Page, ordinal: number) {
  return page.getByRole('group', { name: `Option ${ordinal}`, exact: true })
}

async function selectOption(page: Page, ordinal: number) {
  await page.getByRole('button', { name: new RegExp(`^Edit option ${ordinal}:`) }).click()
  await expect(option(page, ordinal)).toBeVisible()
  return option(page, ordinal)
}

async function openLayout(page: Page) {
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Table layout', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
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
  const layoutDialog = await openLayout(page)
  await page.getByRole('combobox', { name: 'Object balls', exact: true }).selectOption('3')
  await expect(page.locator('.sandbox-ball-picker button')).toHaveCount(4)
  await page.getByRole('combobox', { name: 'Object balls', exact: true }).selectOption('2')
  await expect(page.locator('.sandbox-ball-picker button')).toHaveCount(3)
  await placeBall(page, 0, '127', '95')
  await placeBall(page, 1, '127', '38')
  await placeBall(page, 2, '210', '95')
  const layout = await page.locator('#sandbox-table-description').textContent()
  await layoutDialog.getByRole('button', { name: 'Done', exact: true }).click()
  await selectOption(page, 3)
  await page.getByRole('button', { name: 'Remove option 3', exact: true }).click()
  await selectOption(page, 2)
  await page.getByRole('button', { name: 'Remove option 2', exact: true }).click()
  await page.getByRole('button', { name: 'Add option', exact: true }).click()
  const direct = option(page, 1)
  const soft = option(page, 2)
  await soft.getByRole('checkbox', { name: 'Auto-adapt option 2', exact: true }).uncheck()
  await selectOption(page, 1)
  await direct.getByRole('textbox', { name: 'Name', exact: true }).fill('Direct pot')
  await direct.getByRole('combobox', { name: 'Ball', exact: true }).selectOption('1')
  await direct.getByRole('combobox', { name: 'Pocket', exact: true }).selectOption('1')
  await setStroke(direct, { speed: '1.3', topSpin: '0', sideSpin: '0', aimOffset: '0' })
  await selectOption(page, 2)
  await soft.getByRole('textbox', { name: 'Name', exact: true }).fill('Too soft')
  await soft.getByRole('combobox', { name: 'Ball', exact: true }).selectOption('2')
  await soft.getByRole('combobox', { name: 'Pocket', exact: true }).selectOption('3')
  await setStroke(soft, { speed: '0.1', topSpin: '-0.4', sideSpin: '12', aimOffset: '2' })
  await selectOption(page, 1)
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
  const scene = diagram.locator('.pool-table-scene')
  await expect(scene.locator('svg')).toBeVisible()
  await expect(scene.getByText('2D view · WebGL unavailable')).toBeVisible()
  async function expectSelected(index: number) {
    const shot = result.shots[index]
    await expect(comparison.locator('button[aria-pressed="true"]')).toHaveAccessibleName(`Inspect ${shot.plan.label}`)
    await expect(inspector.getByRole('heading')).toContainText(shot.plan.label)
    await expect(diagram).toHaveAccessibleName(new RegExp(`^${shot.plan.label}:`))
    await expect(scene.getByTestId('nominal-cue-path')).toHaveAttribute('points', shot.nominal.cuePath.map(point => `${point.x * 100},${point.y * 100}`).join(' '))
    await expect(scene.getByTestId('nominal-object-path')).toHaveAttribute('points', shot.nominal.objectPath.map(point => `${point.x * 100},${point.y * 100}`).join(' '))
    for (const [label, value] of [
      ['Success', `${(shot.successRate * 100).toFixed(1)}%`],
      ['Pot', `${(shot.potRate * 100).toFixed(1)}%`],
      ['Scratch', `${(shot.scratchRate * 100).toFixed(1)}%`],
      ['Cue spread', shot.sampleEnds.length ? `${(shot.spread * 100).toFixed(1)} cm` : 'n/a'],
    ]) await expect(stats).toContainText(new RegExp(`${label}\\s*${value.replace('.', '\\.')}`))
  }
  await expectSelected(0)
  await expect(stats).toHaveAttribute('aria-live', 'polite')
  expect(await stats.evaluate(element => element.nextElementSibling?.matches('.lab-ensemble-table'))).toBe(true)
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
  await expect(scene.getByTestId('cue-ensemble-path')).toHaveCount(result.shots[0].samplePaths.length)
  await trialPaths.uncheck()
  await expect(scene.getByTestId('ensemble-paths')).toHaveCount(0)
  await expect(scene.getByTestId('nominal-paths')).toHaveCount(1)
  const ballFinishes = inspector.getByRole('checkbox', { name: 'Ball finishes', exact: true })
  await expect(scene.getByTestId('ensemble-ball-finish')).toHaveCount(result.shots[0].sampleBallEnds.flatMap(balls => balls.filter(ball => !ball.pocketed)).length)
  await ballFinishes.uncheck()
  await expect(scene.getByTestId('ensemble-finishes')).toHaveCount(0)
  await expect(scene.getByTestId('nominal-paths')).toHaveCount(1)
  await ballFinishes.check()
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
  await expect(scene.getByTestId('cue-ensemble-path')).toHaveCount(result.shots[1].samplePaths.length)
  const outcomeTrigger = page.getByRole('button', { name: 'Outcome details', exact: true })
  await outcomeTrigger.click()
  const outcomeDialog = page.getByRole('dialog', { name: 'Outcome details', exact: true })
  await expect(outcomeDialog).toContainText('Too soft · 32 trials')
  await expect(outcomeDialog.locator('dl')).toContainText(/Ball not potted\s*32\s*\/ 32/)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await expect(outcomeDialog).toHaveCount(0)
  await expect(outcomeTrigger).toBeFocused()
  await expectSelected(1)
  const path = '/tmp/shot-selection-lab-desktop.png'
  await inspector.screenshot({ path })
  await testInfo.attach('Lab ensemble inspector with a failed shot selected', { path, contentType: 'image/png' })
  const workspacePath = '/tmp/shot-selection-lab-workspace.png'
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: workspacePath, fullPage: true })
  await testInfo.attach('Complete desktop lab workspace', { path: workspacePath, contentType: 'image/png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => scrollTo(0, 0))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const mobilePath = '/tmp/shot-selection-lab-inspector-mobile.png'
  await inspector.screenshot({ path: mobilePath })
  await testInfo.attach('Compact ensemble stats and option stepping on mobile', { path: mobilePath, contentType: 'image/png' })
  await page.setViewportSize({ width: 1440, height: 1050 })
  await selectOption(page, 2)
  await soft.getByRole('textbox', { name: 'Name', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await expectSelected(1)
  await openLayout(page)
  await expect(page.locator('#sandbox-table-description')).toHaveText(layout!)
  await layoutDialog.getByRole('button', { name: 'Done', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toMatchObject({
    mode: 'sandbox', character: PREMADE_CHARACTERS[1], completedLessons: 0, score: 0, rounds: 0,
  })
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveCount(0)
  const strength = soft.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })
  await strength.fill('')
  await strength.blur()
  await expect(comparison).toBeVisible()
  await expect(page.getByText('Results from the previous run. Run again to update.', { exact: true })).toBeVisible()
  await expect(strength).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeDisabled()
  await strength.fill('0.2')
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeEnabled()
  await page.evaluate(() => { (window as ObservedWindow).labObservation.pauseRequests = true })
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  await expect(comparison).toBeVisible()
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click()
  await expect(comparison).toBeVisible()
  await expect(page.getByText('Results from the previous run. Run again to update.', { exact: true })).toBeVisible()
  await page.evaluate(() => (window as ObservedWindow).releaseLabRequests())
  await page.evaluate(() => { (window as ObservedWindow).labObservation.pauseRequests = true })
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  // Changing the selected editor while physics is pending should determine
  // which option is inspected when the new result arrives.
  await selectOption(page, 1)
  await page.evaluate(() => (window as ObservedWindow).releaseLabRequests())
  await expect(page.getByText('Results from the previous run. Run again to update.', { exact: true })).toHaveCount(0, { timeout: 60_000 })
  await expect(direct).toBeVisible()
  await expect(inspector.getByRole('heading')).toContainText('Direct pot')
  await expect(comparison.getByRole('button', { name: 'Inspect Direct pot', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const rerun = await page.evaluate(() => (window as ObservedWindow).labObservation)
  expect(rerun.requests).toHaveLength(3)
  expect(rerun.results).toHaveLength(2)
  expect(rerun.requests[2].variants[1].settings.speed).toBe(0.2)
  await selectOption(page, 2)
  await soft.getByRole('button', { name: 'Remove option 2', exact: true }).click()
  await expect(direct).toBeVisible()
  await expect(page.getByRole('button', { name: /^Edit option / })).toHaveCount(1)
  await inspector.getByRole('button', { name: 'Next play option', exact: true }).click()
  await expect(inspector.getByRole('heading')).toContainText('Too soft')
  await expect(direct).toBeVisible()
  await inspector.getByRole('button', { name: 'Previous play option', exact: true }).click()
  await expect(inspector.getByRole('heading')).toContainText('Direct pot')
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  await expect(page.getByText('Results from the previous run. Run again to update.', { exact: true })).toHaveCount(0, { timeout: 60_000 })
  await expect(comparison.getByRole('button', { name: /^Inspect / })).toHaveCount(1)
  await expect(inspector.getByRole('button', { name: 'Next play option', exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})

test('lab renders the shared 3D table with independent trial paths and ball finishes', { tag: '@webgl' }, async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (/THREE\.WebGLProgram|WebGL.*(?:error|failed|context lost)|(?:shader|program).*(?:error|failed)/i.test(message.text())) errors.push(message.text())
  })
  await openLab(page)
  const layout = await openLayout(page)
  await expect(layout.locator('.sandbox-table .pool-table-scene canvas')).toBeVisible()
  await page.getByRole('combobox', { name: 'Object balls', exact: true }).selectOption('1')
  await placeBall(page, 0, '127', '95')
  await placeBall(page, 1, '127', '38')
  await layout.getByRole('button', { name: 'Done', exact: true }).click()
  for (const ordinal of [3, 2]) {
    const selected = await selectOption(page, ordinal)
    await selected.getByRole('button', { name: `Remove option ${ordinal}`, exact: true }).click()
  }
  const selected = await selectOption(page, 1)
  await selected.getByRole('combobox', { name: 'Ball', exact: true }).selectOption('1')
  await selected.getByRole('combobox', { name: 'Pocket', exact: true }).selectOption('1')
  await setStroke(selected, { speed: '1.3', topSpin: '0', sideSpin: '0', aimOffset: '0' })
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  const inspector = page.getByRole('group', { name: 'Ensemble inspector', exact: true })
  await expect(inspector).toBeVisible({ timeout: 60_000 })
  const canvas = inspector.locator('.lab-ensemble-table .pool-table-scene canvas')
  await expect(canvas).toBeVisible()
  await expect.poll(() => canvas.evaluate(element => {
    const context = (element as HTMLCanvasElement).getContext('webgl2')
    return Boolean(context && !context.isContextLost() && context.drawingBufferWidth > 0 && context.drawingBufferHeight > 0)
  })).toBe(true)
  await expect(inspector.getByText('2D view · WebGL unavailable')).toHaveCount(0)
  const capture = async () => {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    return canvas.screenshot({ animations: 'disabled' })
  }
  const pathsAndFinishes = await capture()
  await inspector.getByRole('checkbox', { name: 'Trial paths', exact: true }).uncheck()
  const finishesOnly = await capture()
  expect(finishesOnly.equals(pathsAndFinishes)).toBe(false)
  await inspector.getByRole('checkbox', { name: 'Ball finishes', exact: true }).uncheck()
  const nominalOnly = await capture()
  expect(nominalOnly.equals(finishesOnly)).toBe(false)
  await inspector.getByRole('checkbox', { name: 'Trial paths', exact: true }).check()
  await inspector.getByRole('checkbox', { name: 'Ball finishes', exact: true }).check()
  const path = '/tmp/shot-selection-lab-3d-ensemble.png'
  await inspector.screenshot({ path, animations: 'disabled' })
  await testInfo.attach('Lab ensembles on the shared 3D table', { path, contentType: 'image/png' })
  expect(errors).toEqual([])
})

test('morphs interpolate all stroke values and a cancelled run can be restarted', async ({ page }) => {
  test.setTimeout(90_000)
  await openLab(page)
  await page.getByRole('button', { name: 'Morph between two strokes', exact: true }).click()
  const morphDialog = page.getByRole('dialog', { name: 'Morph between two strokes', exact: true })
  await expect(morphDialog).toBeVisible()
  await page.getByRole('combobox', { name: 'Morph ball', exact: true }).selectOption('1')
  await page.getByRole('combobox', { name: 'Morph pocket', exact: true }).selectOption('1')
  await setStroke(page.getByRole('group', { name: 'Morph start', exact: true }), { speed: '0.7', topSpin: '-1', sideSpin: '-10', aimOffset: '-2' })
  await setStroke(page.getByRole('group', { name: 'Morph end', exact: true }), { speed: '2.1', topSpin: '1', sideSpin: '10', aimOffset: '2' })
  await page.getByRole('spinbutton', { name: 'Steps (including endpoints)', exact: true }).fill('4')
  await page.getByRole('button', { name: 'Replace options with steps', exact: true }).click()
  await expect(morphDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Edit option / })).toHaveCount(4)
  for (let ordinal = 1; ordinal <= 4; ordinal++) {
    const generated = await selectOption(page, ordinal)
    await expect(generated.getByRole('checkbox', { name: `Auto-adapt option ${ordinal}`, exact: true })).not.toBeChecked()
    await expect(generated.getByRole('button', { name: /^Unlock / })).toHaveCount(6)
    const generatedNumbers = generated.locator('input[type="number"]')
    await expect(generatedNumbers).toHaveCount(4)
    expect(await generatedNumbers.evaluateAll(inputs => inputs.every(input => (input as HTMLInputElement).validity.valid))).toBe(true)
  }
  await selectOption(page, 2)
  await expect(option(page, 2).getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })).toHaveValue('1.16667')
  await expect(option(page, 2).getByRole('spinbutton', { name: 'Draw / follow', exact: true })).toHaveValue('-0.33333')
  await expect(option(page, 2).getByRole('spinbutton', { name: 'Sidespin (rad/s)', exact: true })).toHaveValue('-3.33333')
  await expect(option(page, 2).getByRole('spinbutton', { name: 'Aim offset (°)', exact: true })).toHaveValue('-0.66667')
  await selectOption(page, 1)
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
  const layoutDialog = await openLayout(page)
  await page.getByRole('button', { name: 'Place ball 1', exact: true }).click()
  const x = page.getByRole('spinbutton', { name: 'X cm', exact: true })
  const initialX = Number(await x.inputValue())
  await page.getByRole('group', { name: 'Ball layout editor. Ball 1 selected.', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  expect(Number(await x.inputValue())).toBeCloseTo(initialX - 1, 2)
  await layoutDialog.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(comparison).toBeVisible()
  await expect(page.getByText('Results from the previous run. Run again to update.', { exact: true })).toBeVisible()
})

test('stroke variations copy the selected option and append independent changes for real ensembles', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await openLab(page)
  const first = option(page, 1)
  await first.getByRole('textbox', { name: 'Name', exact: true }).fill('Reference stroke')
  await setStroke(first, { speed: '1.3', topSpin: '0.2', sideSpin: '2', aimOffset: '1' })
  const second = await selectOption(page, 2)
  await second.getByRole('textbox', { name: 'Name', exact: true }).fill('Selected stroke')
  await second.getByRole('combobox', { name: 'Pocket', exact: true }).selectOption('2')
  await setStroke(second, { speed: '1.6', topSpin: '0.4', sideSpin: '8', aimOffset: '3' })

  await page.getByRole('button', { name: 'Vary stroke', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Vary one stroke', exact: true })
  const base = dialog.getByRole('group', { name: 'Base stroke', exact: true })
  const amounts = dialog.getByRole('group', { name: 'Variation amounts', exact: true })
  const source = dialog.getByRole('combobox', { name: 'Base option', exact: true })
  await expect(source.locator('option:checked')).toHaveText('2 · Selected stroke')
  await expect(base.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })).toHaveValue('1.6')
  await expect(base.getByRole('spinbutton', { name: 'Draw / follow', exact: true })).toHaveValue('0.4')
  await expect(base.getByRole('spinbutton', { name: 'Sidespin (rad/s)', exact: true })).toHaveValue('8')
  await expect(base.getByRole('spinbutton', { name: 'Aim offset (°)', exact: true })).toHaveValue('3')
  await expect(dialog.getByRole('combobox', { name: 'Variation pocket', exact: true })).toHaveValue('2')
  await source.selectOption({ label: '1 · Reference stroke' })
  await expect(base.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })).toHaveValue('1.3')
  await expect(base.getByRole('spinbutton', { name: 'Draw / follow', exact: true })).toHaveValue('0.2')
  await expect(base.getByRole('spinbutton', { name: 'Sidespin (rad/s)', exact: true })).toHaveValue('2')
  await expect(base.getByRole('spinbutton', { name: 'Aim offset (°)', exact: true })).toHaveValue('1')
  await expect(dialog.getByRole('combobox', { name: 'Variation pocket', exact: true })).toHaveValue('1')
  await dialog.getByRole('combobox', { name: 'Variation ball', exact: true }).selectOption('1')
  await dialog.getByRole('combobox', { name: 'Variation pocket', exact: true }).selectOption('3')
  await setStroke(base, { speed: '1.5', topSpin: '0.5', sideSpin: '10', aimOffset: '2' })
  await setStroke(amounts, { speed: '0.3', topSpin: '0.4', sideSpin: '7', aimOffset: '1.5' })
  const path = '/tmp/shot-selection-lab-variations-desktop.png'
  await dialog.screenshot({ path })
  await testInfo.attach('Single-stroke variation controls on desktop', { path, contentType: 'image/png' })
  await dialog.getByRole('button', { name: 'Append variations', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Edit option / })).toHaveCount(12)
  for (let ordinal = 4; ordinal <= 12; ordinal++) {
    const generated = await selectOption(page, ordinal)
    await expect(generated.getByRole('checkbox', { name: `Auto-adapt option ${ordinal}`, exact: true })).not.toBeChecked()
    await expect(generated.getByRole('button', { name: /^Unlock / })).toHaveCount(6)
  }
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Lab comparison', exact: true })).toBeVisible({ timeout: 90_000 })
  const observed = await page.evaluate(() => (window as ObservedWindow).labObservation)
  expect(observed.requests).toHaveLength(1)
  expect(observed.requests[0].samples).toBe(32)
  const variants = observed.requests[0].variants
  expect(variants).toHaveLength(12)
  expect(new Set(variants.map(variant => variant.id)).size).toBe(12)
  expect(variants.slice(0, 2)).toMatchObject([
    { label: 'Reference stroke', settings: { ballId: 1, pocketId: 1, speed: 1.3, topSpin: 0.2, sideSpin: 2, aimOffset: 1 } },
    { label: 'Selected stroke', settings: { ballId: 1, pocketId: 2, speed: 1.6, topSpin: 0.4, sideSpin: 8, aimOffset: 3 } },
  ])
  const settings = { ballId: 1, pocketId: 3, speed: 1.5, topSpin: 0.5, sideSpin: 10, aimOffset: 2 }
  expect(variants.slice(3)).toMatchObject([
    { label: 'Base stroke', settings },
    { label: 'Strength −', settings: { ...settings, speed: expect.closeTo(1.2, 10) } },
    { label: 'Strength +', settings: { ...settings, speed: expect.closeTo(1.8, 10) } },
    { label: 'Draw / follow −', settings: { ...settings, topSpin: expect.closeTo(0.1, 10) } },
    { label: 'Draw / follow +', settings: { ...settings, topSpin: expect.closeTo(0.9, 10) } },
    { label: 'Sidespin −', settings: { ...settings, sideSpin: 3 } },
    { label: 'Sidespin +', settings: { ...settings, sideSpin: 17 } },
    { label: 'Aim offset −', settings: { ...settings, aimOffset: 0.5 } },
    { label: 'Aim offset +', settings: { ...settings, aimOffset: 3.5 } },
  ])
  expect(observed.results).toHaveLength(1)
  expect(observed.results[0].shots).toHaveLength(12)
  expect(observed.results[0].shots.every(shot => shot.samples === 32 && shot.sampleBallEnds.length === 32)).toBe(true)
  expect(observed.results[0].shots.map(shot => shot.plan.label)).toEqual(variants.map(variant => variant.label))
})

test('stroke variations validate amounts, support replacement at capacity, and fit the mobile dialog', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openLab(page)
  await setStroke(option(page, 1), { speed: '1.3', topSpin: '0', sideSpin: '0', aimOffset: '0' })
  const trigger = page.getByRole('button', { name: 'Vary stroke', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Vary one stroke', exact: true })
  const base = dialog.getByRole('group', { name: 'Base stroke', exact: true })
  const amounts = dialog.getByRole('group', { name: 'Variation amounts', exact: true })
  const append = dialog.getByRole('button', { name: 'Append variations', exact: true })
  const replace = dialog.getByRole('button', { name: 'Replace options with variations', exact: true })
  for (const [label, value] of [['Strength (m/s)', '0.2'], ['Draw / follow', '0.25'], ['Sidespin (rad/s)', '5'], ['Aim offset (°)', '1']]) {
    await expect(amounts.getByRole('spinbutton', { name: label, exact: true })).toHaveValue(value)
  }
  const strengthAmount = amounts.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })
  for (const invalid of ['', '-0.2']) {
    await strengthAmount.fill(invalid)
    await expect(append).toBeDisabled()
    await expect(replace).toBeDisabled()
  }
  await strengthAmount.fill('0.2')
  const strength = base.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })
  await strength.fill('5')
  await expect(append).toBeDisabled()
  await expect(replace).toBeDisabled()
  await strength.fill('1.3')
  await expect(append).toBeEnabled()
  await expect(replace).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const path = '/tmp/shot-selection-lab-variations-mobile.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Single-stroke variation controls on mobile', { path, contentType: 'image/png' })
  await append.click()
  await expect(page.getByRole('button', { name: /^Edit option / })).toHaveCount(12)

  await trigger.click()
  await expect(append).toBeDisabled()
  await expect(replace).toBeEnabled()
  // Excluding three axes leaves the base and strength minus/plus, which fit.
  await setStroke(amounts, { speed: '0.2', topSpin: '0', sideSpin: '0', aimOffset: '0' })
  await expect(append).toBeEnabled()
  await append.click()
  await expect(page.getByRole('button', { name: /^Edit option / })).toHaveCount(15)
  await trigger.click()
  await setStroke(amounts, { speed: '0.2', topSpin: '0.25', sideSpin: '5', aimOffset: '1' })
  await expect(append).toBeDisabled()
  await expect(replace).toBeEnabled()
  await replace.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Edit option / })).toHaveCount(9)
  await expect(option(page, 1).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Base stroke')
  await expect(option(page, 1).getByRole('checkbox', { name: 'Auto-adapt option 1', exact: true })).not.toBeChecked()
  await expect(option(page, 1).getByRole('button', { name: /^Unlock / })).toHaveCount(6)
})

test('mobile lab supports fifteen balls, rejects overlaps, and keeps controls within the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openLab(page)
  const layoutDialog = await openLayout(page)
  await page.getByRole('combobox', { name: 'Object balls', exact: true }).selectOption('15')
  await expect(page.locator('.sandbox-ball-picker button')).toHaveCount(16)
  await page.getByRole('button', { name: 'Place cue ball', exact: true }).click()
  const x = page.getByRole('spinbutton', { name: 'X cm', exact: true })
  const y = page.getByRole('spinbutton', { name: 'Y cm', exact: true })
  const cue = { x: await x.inputValue(), y: await y.inputValue() }
  await placeBall(page, 15, cue.x, cue.y)
  await expect(page.getByText('Separate the cue ball and ball 15 so they do not overlap.', { exact: true })).toBeVisible()
  await layoutDialog.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeDisabled()
  await openLayout(page)
  await page.getByRole('button', { name: 'Place ball 15', exact: true }).click()
  await x.fill('230')
  await y.fill('110')
  const editor = page.getByRole('group', { name: 'Ball layout editor. Ball 15 selected.', exact: true })
  await editor.focus()
  await page.keyboard.press('Shift+ArrowLeft')
  expect(Number(await x.inputValue())).toBeCloseTo(229.9, 2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await layoutDialog.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Morph between two strokes', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const path = '/tmp/shot-selection-lab-mobile.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Lab on mobile with fifteen balls and morph controls', { path, contentType: 'image/png' })
})

test('the compact workspace preserves selected edits and restores focus when dialogs close', async ({ page }) => {
  await openLab(page)
  const first = option(page, 1)
  await first.getByRole('textbox', { name: 'Name', exact: true }).fill('Control stroke')
  await first.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true }).fill('1.75')
  await selectOption(page, 2)
  await expect(first).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: /^Auto-adapt option / })).toHaveCount(1)
  await selectOption(page, 1)
  await expect(first.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Control stroke')
  await expect(first.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })).toHaveValue('1.75')
  await first.getByRole('button', { name: 'Duplicate option 1', exact: true }).click()
  const duplicate = option(page, 4)
  await expect(duplicate).toBeVisible()
  await expect(duplicate.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Control stroke copy')
  await expect(duplicate.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()
  await expect(duplicate.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })).toHaveValue('1.75')
  await duplicate.getByRole('button', { name: 'Remove option 4', exact: true }).click()
  await expect(option(page, 3)).toBeVisible()
  await expect(option(page, 3).getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Add option', exact: true }).click()
  await expect(option(page, 4)).toBeVisible()
  await expect(option(page, 4).getByRole('textbox', { name: 'Name', exact: true })).toBeFocused()
  await option(page, 4).getByRole('checkbox', { name: 'Auto-adapt option 4', exact: true }).uncheck()

  const layoutDialog = await openLayout(page)
  await page.getByRole('spinbutton', { name: 'X cm', exact: true }).fill('120')
  await page.keyboard.press('Escape')
  await expect(layoutDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit layout', exact: true })).toBeFocused()
  await openLayout(page)
  await expect(page.getByRole('spinbutton', { name: 'X cm', exact: true })).toHaveValue('120')
  await page.keyboard.press('Escape')

  const guideTrigger = page.getByRole('button', { name: 'Lab guide', exact: true })
  await guideTrigger.click()
  await expect(page.getByRole('dialog', { name: 'Lab guide', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(guideTrigger).toBeFocused()
  await expect(option(page, 4)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeInViewport()
})
