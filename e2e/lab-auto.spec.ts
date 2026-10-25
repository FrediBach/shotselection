import { expect, test, type Locator, type Page } from '@playwright/test'
import { PREMADE_CHARACTERS } from '../src/engine/characters'
import { createLabShot, type LabShotSettings } from '../src/engine/lab'
import type { LabAutoRequest, LabAutoResult, LabShotLocks } from '../src/engine/lab-auto'
import { simulateShot } from '../src/engine/physics'

type AutoObservation = {
  requests: LabAutoRequest[]
  results: LabAutoResult[]
  pauseResults: boolean
  pendingResults: number
  terminatedWorkers: number
}
type ObservedWindow = Window & { autoObservation: AutoObservation; releaseNextAutoResult: () => void }

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
    const observation: AutoObservation = { requests: [], results: [], pauseResults: false, pendingResults: 0, terminatedWorkers: 0 }
    const pending: (() => void)[] = []
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      private auto = false
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        let handler: ((this: Worker, event: MessageEvent) => unknown) | null = null
        Object.defineProperty(this, 'onmessage', { get: () => handler, set: callback => { handler = callback } })
        this.addEventListener('message', event => {
          if (this.auto && event.data.result) {
            observation.results.push(event.data.result)
            // Hold real completed worker replies only for the cancellation test.
            // Releasing one after terminate exercises the stale-result guard.
            if (observation.pauseResults) {
              pending.push(() => handler?.call(this, event))
              observation.pendingResults = pending.length
              return
            }
          }
          handler?.call(this, event)
        })
      }
      postMessage(message: { method: string; request?: LabAutoRequest }, options?: Transferable[] | StructuredSerializeOptions) {
        if (message.method === 'lab-auto') {
          this.auto = true
          observation.requests.push(message.request!)
        }
        super.postMessage(message, options as Transferable[])
      }
      terminate() {
        if (this.auto) observation.terminatedWorkers++
        super.terminate()
      }
    }
    Object.assign(window, {
      Worker: ObservedWorker,
      autoObservation: observation,
      releaseNextAutoResult: () => { pending.shift()?.(); observation.pendingResults = pending.length },
    })
  })
})

const fieldLabels: Record<keyof LabShotSettings, string> = {
  ballId: 'Ball', pocketId: 'Pocket', speed: 'Strength (m/s)', topSpin: 'Draw / follow', sideSpin: 'Sidespin (rad/s)', aimOffset: 'Aim offset (°)',
}
const allLocked: LabShotLocks = { ballId: true, pocketId: true, speed: true, topSpin: true, sideSpin: true, aimOffset: true }

async function openSingleManualOption(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sandbox mode', exact: true }).click()
  await page.getByRole('button', { name: `Choose ${PREMADE_CHARACTERS[1].name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).click()
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Auto-adapt option 1', exact: true })).toBeChecked()
  const cancelAdapting = page.getByRole('button', { name: 'Cancel adapting', exact: true })
  if (await cancelAdapting.isVisible()) await cancelAdapting.click()
  for (let ordinal = 1; ordinal <= 3; ordinal++) {
    await page.getByRole('button', { name: new RegExp(`^Edit option ${ordinal}:`) }).click()
    await page.getByRole('checkbox', { name: `Auto-adapt option ${ordinal}`, exact: true }).uncheck()
  }
  await page.getByRole('button', { name: 'Remove option 3', exact: true }).click()
  await page.getByRole('button', { name: 'Remove option 2', exact: true }).click()
  await page.evaluate(() => {
    const observation = (window as ObservedWindow).autoObservation
    observation.requests = []
    observation.results = []
    observation.terminatedWorkers = 0
  })
  return page.getByRole('group', { name: 'Option 1', exact: true })
}

async function layoutDescription(page: Page) {
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Table layout', exact: true })
  const description = await dialog.locator('#sandbox-table-description').textContent()
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  return description
}

async function setLocks(option: Locator, locks: LabShotLocks) {
  for (const key of Object.keys(fieldLabels) as (keyof LabShotSettings)[]) {
    const action = option.getByRole('button', { name: `${locks[key] ? 'Lock' : 'Unlock'} ${fieldLabels[key]}`, exact: true })
    if (await action.count()) await action.click()
  }
}

async function settings(option: Locator): Promise<LabShotSettings> {
  return {
    ballId: Number(await option.getByRole('combobox', { name: 'Ball', exact: true }).inputValue()),
    pocketId: Number(await option.getByRole('combobox', { name: 'Pocket', exact: true }).inputValue()),
    speed: Number(await option.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true }).inputValue()),
    topSpin: Number(await option.getByRole('spinbutton', { name: 'Draw / follow', exact: true }).inputValue()),
    sideSpin: Number(await option.getByRole('spinbutton', { name: 'Sidespin (rad/s)', exact: true }).inputValue()),
    aimOffset: Number(await option.getByRole('spinbutton', { name: 'Aim offset (°)', exact: true }).inputValue()),
  }
}

function expectPlayable(request: LabAutoRequest, result: LabAutoResult) {
  expect(result.status).toBe('found')
  const shot = simulateShot(request.scenario, createLabShot(request.scenario, result.settings, 'verified-auto-option', 'Auto option'))
  expect(shot.firstContact).toBe(result.settings.ballId)
  expect(shot.pocketEvents).toContainEqual(expect.objectContaining({ ballId: result.settings.ballId, pocketId: result.settings.pocketId }))
  expect(shot.scratch).toBe(false)
  expect(shot.stopped).toBe(true)
}

test('auto-fit repairs free values, preserves chosen locks, and reports impossible locked strokes honestly', async ({ page }) => {
  test.setTimeout(90_000)
  const option = await openSingleManualOption(page)
  const strength = option.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })
  await strength.fill('0.1')
  await setLocks(option, { ...allLocked, speed: false })
  const before = await settings(option)
  const layout = await layoutDescription(page)
  await page.getByRole('button', { name: 'Auto-fit options', exact: true }).click()
  await expect(option.locator('.lab-fit-status[data-status="found"]')).toBeVisible({ timeout: 60_000 })
  let observed = await page.evaluate(() => (window as ObservedWindow).autoObservation)
  expect(observed.requests).toHaveLength(1)
  expect(observed.requests[0].locks).toEqual({ ...allLocked, speed: false })
  expectPlayable(observed.requests[0], observed.results[0])
  expect(observed.results[0].settings).toEqual({ ...before, speed: expect.any(Number) })
  expect(observed.results[0].settings.speed).toBeGreaterThan(0.1)
  expect(await settings(option)).toEqual(observed.results[0].settings)
  expect(await layoutDescription(page)).toBe(layout)

  // Editing locks the chosen strength; auto-adapt must repair the bad aim
  // without changing that strength or the nominated ball and pocket.
  await strength.fill('1.3')
  await option.getByRole('spinbutton', { name: 'Aim offset (°)', exact: true }).fill('8')
  await setLocks(option, { ...allLocked, topSpin: false, sideSpin: false, aimOffset: false })
  await option.getByRole('checkbox', { name: 'Auto-adapt option 1', exact: true }).check()
  await expect(option.locator('.lab-fit-status[data-status="found"]')).toBeVisible({ timeout: 60_000 })
  observed = await page.evaluate(() => (window as ObservedWindow).autoObservation)
  expect(observed.requests).toHaveLength(2)
  expect(observed.requests[1]).toMatchObject({ variant: { settings: { speed: 1.3, aimOffset: 8 } }, locks: { speed: true, ballId: true, pocketId: true, aimOffset: false } })
  expectPlayable(observed.requests[1], observed.results[1])
  await expect(strength).toHaveValue('1.3')
  expect(Number(await option.getByRole('spinbutton', { name: 'Aim offset (°)', exact: true }).inputValue())).not.toBe(8)
  await expect(option.getByRole('button', { name: 'Unlock Strength (m/s)', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await option.getByRole('checkbox', { name: 'Auto-adapt option 1', exact: true }).uncheck()
  await strength.fill('0.1')
  await setLocks(option, allLocked)
  const impossible = await settings(option)
  await option.getByRole('button', { name: 'Find playable shot', exact: true }).click()
  await expect(option.locator('.lab-fit-status[data-status="not-found"]')).toContainText('No playable stroke found', { timeout: 60_000 })
  observed = await page.evaluate(() => (window as ObservedWindow).autoObservation)
  expect(observed.results.at(-1)).toMatchObject({ status: 'not-found', settings: impossible })
  expect(await settings(option)).toEqual(impossible)
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeEnabled()
})

test('editing an auto option cancels its worker and ignores a late result', async ({ page }) => {
  test.setTimeout(90_000)
  const option = await openSingleManualOption(page)
  const strength = option.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })
  await strength.fill('0.1')
  await setLocks(option, { ...allLocked, speed: false })
  await page.evaluate(() => { (window as ObservedWindow).autoObservation.pauseResults = true })
  await option.getByRole('checkbox', { name: 'Auto-adapt option 1', exact: true }).check()
  await expect.poll(() => page.evaluate(() => (window as ObservedWindow).autoObservation.pendingResults), { timeout: 60_000 }).toBe(1)
  await strength.fill('1.3')
  await expect.poll(() => page.evaluate(() => (window as ObservedWindow).autoObservation.terminatedWorkers)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => (window as ObservedWindow).autoObservation.pendingResults), { timeout: 60_000 }).toBe(2)
  await page.evaluate(() => (window as ObservedWindow).releaseNextAutoResult())
  await expect(strength).toHaveValue('1.3')
  await expect(option.locator('.lab-fit-status[data-status="fitting"]')).toBeVisible()
  await page.evaluate(() => (window as ObservedWindow).releaseNextAutoResult())
  await expect(option.locator('.lab-fit-status[data-status="found"]')).toBeVisible()
  await expect(strength).toHaveValue('1.3')
  const observed = await page.evaluate(() => (window as ObservedWindow).autoObservation)
  expect(observed.requests).toHaveLength(2)
  expect(observed.requests[1]).toMatchObject({ variant: { settings: { speed: 1.3 } }, locks: { speed: true } })
  expectPlayable(observed.requests[1], observed.results[1])
})

test('mobile lab keeps six keyboard-operable locks and automatic controls within the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const option = await openSingleManualOption(page)
  await setLocks(option, { ...allLocked, speed: false })
  const strengthLock = option.getByRole('button', { name: 'Lock Strength (m/s)', exact: true })
  await strengthLock.focus()
  await page.keyboard.press('Space')
  await expect(option.getByRole('button', { name: 'Unlock Strength (m/s)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await option.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true }).fill('2')
  await expect(option.getByRole('spinbutton', { name: 'Strength (m/s)', exact: true })).toBeEditable()
  const locks = option.getByRole('button', { name: /^(Lock|Unlock) / })
  await expect(locks).toHaveCount(6)
  for (const control of [...await locks.all(), option.getByRole('checkbox', { name: 'Auto-adapt option 1', exact: true }), option.getByRole('button', { name: 'Find playable shot', exact: true })]) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const path = '/tmp/shot-selection-lab-auto-mobile.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Automatic options and field locks on mobile', { path, contentType: 'image/png' })
})
