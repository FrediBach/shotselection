import { expect, test, type Locator, type Page } from '@playwright/test'
import { PREMADE_CHARACTERS } from '../src/engine/characters'
import { TABLE } from '../src/engine/constants'
import { COURSE_CHAPTERS } from '../src/engine/course'
import { scoreSelection } from '../src/engine/scoring'
import type { AnalyzeOptions, PreparedRound, RoundAnalysis, Scenario } from '../src/engine/types'

type ObservedRequest = {
  method: string
  options?: AnalyzeOptions
  request?: { scenario: Scenario; placement: 'random' | 'manual' }
  prepared?: PreparedRound
}
type SandboxObservation = { requests: ObservedRequest[]; analyses: RoundAnalysis[] }
type ObservedWindow = Window & { sandboxObservation: SandboxObservation }

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(webgl => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    if (!localStorage.getItem('shot-selection-session')) localStorage.setItem('shot-selection-session', JSON.stringify({
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
    const observation: SandboxObservation = { requests: [], analyses: [] }
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      postMessage(message: ObservedRequest, options?: Transferable[] | StructuredSerializeOptions) {
        observation.requests.push(message)
        if (message.method === 'analyze') this.addEventListener('message', event => {
          if (event.data.result) observation.analyses.push(event.data.result)
        }, { once: true })
        super.postMessage(message, options as Transferable[])
      }
    }
    Object.assign(window, { Worker: ObservedWorker, sandboxObservation: observation })
  }, testInfo.tags.includes('@webgl'))
})

async function openSandbox(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choose your player.', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Course mode', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const sandbox = page.getByRole('button', { name: 'Sandbox mode', exact: true })
  await sandbox.focus()
  await page.keyboard.press('Space')
  await expect(sandbox).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Course mode', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: `Choose ${PREMADE_CHARACTERS[1].name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).click()
  await expect(page.locator('#sandbox-heading')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function expectNoProgress(page: Page) {
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toMatchObject({
    mode: 'sandbox', character: PREMADE_CHARACTERS[1],
    completedLessons: 0, level: 1, score: 0, rounds: 0, perfect: 0,
  })
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^View session stats/ })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Learning scenarios' })).toHaveCount(0)
}

async function startPreparedRound(page: Page) {
  await page.getByRole('button', { name: 'Play this layout', exact: true }).click()
  const briefing = page.getByRole('dialog')
  await expect(briefing).toContainText('SANDBOX SCENARIO')
  await expect(briefing).not.toContainText('LESSON 1 OF 10')
  await briefing.getByRole('button', { name: 'Start sandbox round', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your ball.', exact: true })).toBeFocused()
}

async function tablePoint(editor: Locator, x: number, y: number) {
  return editor.evaluate((element, position) => {
    const svg = element as SVGSVGElement
    const point = svg.createSVGPoint()
    point.x = position.x
    point.y = position.y
    const screen = point.matrixTransform(svg.getScreenCTM()!)
    return { x: screen.x, y: screen.y }
  }, { x, y })
}

test.describe('shared table placement controls', () => {
  test.use({ hasTouch: true })

  for (const renderer of ['3D', 'fallback'] as const) {
    test(`${renderer} table keeps touch, drag and keyboard placement aligned after resizing`, { tag: renderer === '3D' ? '@webgl' : '@fallback' }, async ({ page }, testInfo) => {
      test.setTimeout(90_000)
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await openSandbox(page)
      const scene = page.locator('.sandbox-table .pool-table-scene')
      await expect(scene).toBeVisible()
      if (renderer === '3D') {
        const canvas = scene.locator('canvas')
        await expect(canvas).toBeVisible()
        await expect.poll(() => canvas.evaluate(element => {
          const context = (element as HTMLCanvasElement).getContext('webgl2')
          return Boolean(context && !context.isContextLost() && context.drawingBufferWidth > 0 && context.drawingBufferHeight > 0)
        })).toBe(true)
        await expect(scene.getByText('2D view · WebGL unavailable')).toHaveCount(0)
      } else {
        await expect(scene.locator('svg[aria-label="Interactive pool table, top view"]')).toBeVisible()
        await expect(scene.locator('canvas')).toHaveCount(0)
      }
      await page.getByRole('button', { name: /^Place the balls myself/ }).click()
      const editor = page.locator('.ball-placement-controls')
      const x = page.getByRole('spinbutton', { name: 'X cm', exact: true })
      const y = page.getByRole('spinbutton', { name: 'Y cm', exact: true })
      await x.fill('100')
      await y.fill('50')
      await y.blur()
      await expect(page.locator('#sandbox-table-description')).toContainText('Cue ball at 100 centimeters from the left and 50 centimeters from the top')
      await editor.scrollIntoViewIfNeeded()
      const tapped = await tablePoint(editor, 0.8, 0.4)
      await page.touchscreen.tap(tapped.x, tapped.y)
      expect(Number(await x.inputValue())).toBeCloseTo(80, 1)
      expect(Number(await y.inputValue())).toBeCloseTo(40, 1)
      await expect(editor).toBeFocused()
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Shift+ArrowDown')
      expect(Number(await x.inputValue())).toBeCloseTo(81, 1)
      expect(Number(await y.inputValue())).toBeCloseTo(40.1, 1)

      const ball = editor.locator('[data-ball-id="1"]')
      const ballBounds = (await ball.boundingBox())!
      const destination = await tablePoint(editor, 1.5, 0.8)
      await page.mouse.move(ballBounds.x + ballBounds.width / 2, ballBounds.y + ballBounds.height / 2)
      await page.mouse.down()
      await page.mouse.move(destination.x, destination.y, { steps: 4 })
      await page.mouse.up()
      await expect(editor).toHaveAccessibleName('Ball layout editor. Ball 1 selected.')
      expect(Number(await x.inputValue())).toBeCloseTo(150, 1)
      expect(Number(await y.inputValue())).toBeCloseTo(80, 1)
      const rail = await tablePoint(editor, -0.1, 0.8)
      await page.mouse.click(rail.x, rail.y)
      expect(Number(await x.inputValue())).toBeCloseTo(TABLE.ballRadius * 100, 2)

      await page.setViewportSize({ width: 390, height: 844 })
      await editor.scrollIntoViewIfNeeded()
      const mobileDestination = await tablePoint(editor, 1.8, 0.9)
      await page.touchscreen.tap(mobileDestination.x, mobileDestination.y)
      expect(Number(await x.inputValue())).toBeCloseTo(180, 1)
      expect(Number(await y.inputValue())).toBeCloseTo(90, 1)
      const bounds = await editor.boundingBox()
      const sceneBounds = await scene.boundingBox()
      for (const dimension of ['x', 'y', 'width', 'height'] as const) expect(bounds![dimension]).toBeCloseTo(sceneBounds![dimension], 0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const path = `/tmp/shot-selection-sandbox-${renderer.toLowerCase()}-placement.png`
      await page.locator('.sandbox-table').screenshot({ path })
      await testInfo.attach(`${renderer} table and placement controls on mobile`, { path, contentType: 'image/png' })
      expect(errors).toEqual([])
    })
  }
})

test('sandbox keeps normal scoring and character ensembles without total points or progression', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openSandbox(page)
  await expectNoProgress(page)
  await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toBeEnabled({ timeout: 45_000 })
  const initialLayout = await page.locator('#sandbox-table-description').textContent()
  const path = '/tmp/shot-selection-sandbox-desktop.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Sandbox setup on desktop', { path, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Generate another layout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toBeEnabled({ timeout: 45_000 })
  const playedLayout = await page.locator('#sandbox-table-description').textContent()
  expect(playedLayout).not.toBe(initialLayout)
  await startPreparedRound(page)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  const observed = await page.evaluate(() => (window as ObservedWindow).sandboxObservation)
  const analyzeRequest = observed.requests.find(request => request.method === 'analyze')!
  expect(analyzeRequest.options).toEqual({ samples: 64, talents: PREMADE_CHARACTERS[1].talents })
  expect(observed.requests.some(request => request.method === 'sandbox' && request.request?.placement === 'random')).toBe(true)
  const analysis = observed.analyses[0]
  expect(analysis.samples).toBe(64)
  expect(analysis.candidates.every(candidate => candidate.samples === 64 && candidate.sampleBallEnds.length === 64)).toBe(true)
  expect(analysis.scoring).toEqual(scoreSelection(analysis.selected, analysis.candidates))
  await expect(page.locator('.points-awarded strong')).toHaveText(`${analysis.points} / 100`)
  await expect(page.getByRole('region', { name: 'How your score adds up' })).toContainText(' / 70')
  await expect(page.getByRole('region', { name: 'How your score adds up' })).toContainText(' / 30')
  await expect(page.locator('.ensemble-explanation')).toContainText('64 seeded trials per shot')
  await expect(page.locator('.ensemble-player-note')).toContainText(PREMADE_CHARACTERS[1].name)
  await expect(page.getByRole('button', { name: 'Next level', exact: true })).toHaveCount(0)
  await expectNoProgress(page)
  await page.getByRole('button', { name: 'New sandbox round', exact: true }).click()
  await expect(page.locator('#sandbox-heading')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toBeEnabled({ timeout: 45_000 })
  expect(await page.locator('#sandbox-table-description').textContent()).not.toBe(playedLayout)
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toHaveCount(0)
  await expectNoProgress(page)
  await page.reload()
  await expect(page.locator('#sandbox-heading')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choose your player.', exact: true })).toHaveCount(0)
  await expectNoProgress(page)
  expect(errors).toEqual([])
})

test('manual placement rejects overlapping balls, accepts a corrected layout, and fits mobile', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await openSandbox(page)
  await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toBeEnabled({ timeout: 45_000 })
  await page.getByRole('button', { name: /^Place the balls myself/ }).click()
  const x = page.getByRole('spinbutton', { name: 'X cm', exact: true })
  const y = page.getByRole('spinbutton', { name: 'Y cm', exact: true })
  const cuePosition = { x: await x.inputValue(), y: await y.inputValue() }
  await x.fill('0')
  await expect(page.getByRole('status')).toContainText('must fit fully inside the playing surface')
  await expect(page.getByRole('button', { name: 'Test layout', exact: true })).toBeDisabled()
  await x.fill(cuePosition.x)
  await page.getByRole('button', { name: 'Place ball 1', exact: true }).click()
  const objectPosition = { x: await x.inputValue(), y: await y.inputValue() }
  await x.fill(cuePosition.x)
  await y.fill(cuePosition.y)
  await expect(page.getByRole('status')).toContainText('Separate the cue ball and ball 1 so they do not overlap')
  await expect(page.getByRole('button', { name: 'Test layout', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => (window as ObservedWindow).sandboxObservation.requests.filter(request => request.request?.placement === 'manual'))).toEqual([])
  await x.fill(objectPosition.x)
  await y.fill(objectPosition.y)
  const editor = page.getByRole('group', { name: 'Ball layout editor. Ball 1 selected.', exact: true })
  await editor.focus()
  await page.keyboard.press('ArrowRight')
  expect(Number(await x.inputValue())).toBeCloseTo(Number(objectPosition.x) + 1, 2)
  await page.keyboard.press('ArrowLeft')
  expect(Number(await x.inputValue())).toBeCloseTo(Number(objectPosition.x), 2)
  const correctedLayout = await page.locator('#sandbox-table-description').textContent()
  await page.getByRole('button', { name: 'Test layout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toBeEnabled({ timeout: 45_000 })
  await expect(page.getByRole('status')).toContainText('Ready to play')
  expect(await page.locator('#sandbox-table-description').textContent()).toBe(correctedLayout)
  const manualRequest = await page.evaluate(() => (window as ObservedWindow).sandboxObservation.requests.find(request => request.request?.placement === 'manual'))
  expect(manualRequest?.request?.scenario.balls.find(ball => ball.id === 1)?.position).toMatchObject({
    x: Number(objectPosition.x) / 100, y: Number(objectPosition.y) / 100,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const path = '/tmp/shot-selection-sandbox-manual-mobile.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Corrected manual sandbox layout on mobile', { path, contentType: 'image/png' })
  await startPreparedRound(page)
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled()
  await expectNoProgress(page)
  await page.getByRole('button', { name: 'Change setup', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Place the balls myself/ })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.locator('#sandbox-table-description').textContent()).toBe(correctedLayout)
})

test('manual near-rail pot offers three playable finishes without moving the balls', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await openSandbox(page)
  await page.getByRole('button', { name: /^Place the balls myself/ }).click()
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveValue('1')
  const x = page.getByRole('spinbutton', { name: 'X cm', exact: true })
  const y = page.getByRole('spinbutton', { name: 'Y cm', exact: true })
  await x.fill('39.45')
  await y.fill('79.59')
  await page.getByRole('button', { name: 'Place ball 1', exact: true }).click()
  await x.fill('7.6')
  await y.fill('36.67')
  const layout = await page.locator('#sandbox-table-description').textContent()
  await page.getByRole('button', { name: 'Test layout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toBeEnabled({ timeout: 45_000 })
  await expect(page.getByRole('status')).toContainText('Ready to play')
  await expect(page.locator('#sandbox-table-description')).toHaveText(layout!)
  const manualRequest = await page.evaluate(() => (window as ObservedWindow).sandboxObservation.requests.find(request => request.request?.placement === 'manual'))
  expect(manualRequest?.request?.scenario.balls.map(ball => ({ id: ball.id, position: ball.position }))).toEqual([
    { id: 0, position: { x: 39.45 / 100, y: 79.59 / 100 } },
    { id: 1, position: { x: 7.6 / 100, y: 36.67 / 100 } },
  ])
  await startPreparedRound(page)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  const choices = page.getByRole('group', { name: 'Cue-ball finish options', exact: true })
  await expect(choices.getByRole('button')).toHaveCount(3)
  await expect(choices).toContainText('Topspin')
  await expect(choices).toContainText('Backspin')
  for (const label of ['A', 'B', 'C']) {
    const choice = choices.getByRole('button', { name: `Choose finish ${label}`, exact: true })
    await expect(choice).toBeVisible()
    await choice.click()
    await expect(choice).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toBeEnabled()
  }
  const path = '/tmp/shot-selection-sandbox-near-rail-finishes.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Three finishes for the manual near-rail pot', { path, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Change setup', exact: true }).click()
  await expect(page.locator('#sandbox-table-description')).toHaveText(layout!)
})

test('all scenario categories and variations are available without completing any lessons', async ({ page }) => {
  await openSandbox(page)
  await page.getByRole('button', { name: /^Place the balls myself/ }).click()
  const scenario = page.getByRole('combobox', { name: 'Scenario', exact: true })
  await expect(scenario.locator('option')).toHaveCount(100)
  await expect(scenario.locator('optgroup')).toHaveCount(COURSE_CHAPTERS.length)
  await expect(scenario.locator('optgroup[label="Trick shots"] option')).toHaveCount(10)
  expect(await scenario.locator('option:disabled').count()).toBe(0)
  for (const chapter of COURSE_CHAPTERS) {
    await scenario.selectOption(String(chapter.firstLevel))
    await expect(page.locator('.sandbox-scenario-description > span')).toHaveText(chapter.title)
    await expect(scenario).toHaveValue(String(chapter.firstLevel))
    await expect(page.getByRole('button', { name: 'Place cue ball', exact: true })).toBeEnabled()
    await scenario.selectOption(String(chapter.lastLevel))
    await expect(scenario).toHaveValue(String(chapter.lastLevel))
    await expect(page.locator('.sandbox-scenario-description > span')).toHaveText(chapter.title)
  }
  await expectNoProgress(page)
})
