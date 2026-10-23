import { expect, test, type Locator, type Page } from '@playwright/test'
import { startLevel } from './helpers'

const visualViewports = [
  { name: 'desktop', width: 1440, height: 1050 },
  { name: 'large', width: 2000, height: 1400 },
  { name: 'mobile', width: 390, height: 844 },
] as const

async function documentBounds(locator: Locator) {
  return locator.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x: x + window.scrollX, y: y + window.scrollY, width, height }
  })
}

async function readGameFrame(page: Page) {
  return {
    panel: await documentBounds(page.locator('.shot-panel')),
    canvas: await documentBounds(page.locator('.pool-canvas')),
    actions: await documentBounds(page.locator('.shot-panel-actions')),
  }
}

async function expectStableGameFrame(page: Page, initial: Awaited<ReturnType<typeof readGameFrame>>, phase: string) {
  // Document coordinates distinguish a layout shift from ordinary page scrolling.
  await expect.poll(async () => {
    const current = await readGameFrame(page)
    return Math.max(...(['panel', 'canvas', 'actions'] as const).flatMap(part =>
      (['x', 'y', 'width', 'height'] as const).map(key => Math.abs(current[part][key] - initial[part][key]))))
  }, { message: `The sidebar and table should keep their bounds ${phase}` }).toBeLessThanOrEqual(1)
}

async function expectSidebarFits(page: Page, startsAtTop = false) {
  const body = page.locator('.shot-panel-body')
  const actions = page.locator('.shot-panel-actions')
  await expect.poll(() => body.evaluate(element => element.scrollWidth - element.clientWidth),
    { message: 'The current wizard step should have no horizontal overflow' }).toBeLessThanOrEqual(1)
  if (startsAtTop) await expect.poll(() => body.evaluate(element => Math.abs(element.scrollTop)),
    { message: 'A new wizard step should start at the top' }).toBeLessThanOrEqual(1)
  const actionBounds = await documentBounds(actions)
  const bodyBounds = await documentBounds(body)
  expect(bodyBounds.y + bodyBounds.height).toBeLessThanOrEqual(actionBounds.y + 1)
  const panelBounds = await documentBounds(page.locator('.shot-panel'))
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(panelBounds.y + panelBounds.height)

  // Larger text may scroll inside the fixed panel; its final content must remain reachable.
  const hasOverflow = await body.evaluate(element => element.scrollHeight > element.clientHeight + 1)
  if (hasOverflow) {
    await expect(body).toHaveCSS('overflow-y', /^(auto|scroll)$/)
    const initialFrame = await readGameFrame(page)
    const initialScrollTop = await body.evaluate(element => element.scrollTop)
    try {
      await body.evaluate(element => { element.scrollTop = element.scrollHeight })
      await expect.poll(() => body.evaluate(element =>
        Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
      ), { message: 'The sidebar should scroll all the way to its final content' }).toBeLessThanOrEqual(1)
      await expectControlInsideSidebar(body.locator(':scope > :last-child'))
      await expectStableGameFrame(page, initialFrame, 'while reading sidebar overflow')
    } finally {
      await body.evaluate((element, scrollTop) => { element.scrollTop = scrollTop }, initialScrollTop)
    }
    await expect.poll(() => body.evaluate((element, scrollTop) => Math.abs(element.scrollTop - scrollTop), initialScrollTop)).toBeLessThanOrEqual(1)
  }
}

async function expectWizardStep(page: Page, step: 'Ball' | 'Finish' | 'Result') {
  const progress = page.locator('.shot-progress')
  await expect(progress.getByRole('listitem')).toHaveCount(3)
  for (const label of ['Ball', 'Finish', 'Result']) await expect(progress.getByRole('listitem').filter({ hasText: label })).toBeVisible()
  await expect(progress.locator('[aria-current="step"]')).toContainText(step)
  await expectSidebarFits(page, true)
}

async function expectControlInsideSidebar(control: Locator) {
  await expect.poll(() => control.evaluate(element => {
    const body = element.closest('.shot-panel-body')!.getBoundingClientRect()
    const bounds = element.getBoundingClientRect()
    return bounds.top >= body.top - 1 && bounds.bottom <= body.bottom + 1
      && bounds.left >= body.left - 1 && bounds.right <= body.right + 1
  })).toBe(true)
}

function statValue(page: Page, label: string) {
  return page.locator('.stats-grid > div').filter({ has: page.getByText(label, { exact: true }) }).locator('strong')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    if (!localStorage.getItem('shot-selection-session')) localStorage.setItem('shot-selection-session', JSON.stringify({ level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
  })
})

for (const viewport of visualViewports) {
  test.describe(`${viewport.name} table appearance`, () => {
    test.use({ deviceScaleFactor: viewport.name === 'large' ? 2 : 1 })
    test(`table appearance renders a clean permanent overhead view at ${viewport.name} size`, async ({ page }, testInfo) => {
      const pageErrors: string[] = []
      const renderingErrors: string[] = []
      page.on('pageerror', error => pageErrors.push(error.message))
      page.on('console', message => {
        if (/THREE\.WebGLProgram|WebGL.*(?:error|failed|context lost)|(?:shader|program).*(?:error|failed)/i.test(message.text())) renderingErrors.push(message.text())
      })
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')
      await startLevel(page)
      await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 30_000 })
      await expect(page.locator('.simulation-overlay')).toHaveCount(0)
      await expect(page.locator('.finish-option')).toHaveCount(0)
      await expect(page.locator('.ball-choice[aria-pressed="true"]')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Lock in your shot' })).toHaveCount(0)
      await expectWizardStep(page, 'Ball')

      const canvas = page.locator('.pool-table-scene canvas')
      await expect(canvas).toBeVisible()
      await expect(page.getByText('2D view · WebGL unavailable')).toHaveCount(0)
      await expect.poll(() => canvas.evaluate(node => {
        const context = (node as HTMLCanvasElement).getContext('webgl2')
        return Boolean(context && !context.isContextLost() && context.drawingBufferWidth > 0 && context.drawingBufferHeight > 0)
      })).toBe(true)
      await canvas.evaluate(node => {
        node.addEventListener('webglcontextlost', () => { (node as HTMLCanvasElement).dataset.contextLost = 'true' })
      })

      await expect(page.getByRole('button', { name: /Switch to (?:overhead|angled) view/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Restart session', exact: true })).toBeVisible()
      // Let the fixed camera effect and the following WebGL frame finish before capture.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const path = `/tmp/shot-selection-realism-${viewport.name}-overhead.png`
      await page.locator('.table-panel').screenshot({ path, animations: 'disabled' })
      await testInfo.attach(`${viewport.name} overhead table`, { path, contentType: 'image/png' })
      await expect(canvas).not.toHaveAttribute('data-context-lost', 'true')
      await expect(page.locator('.finish-option')).toHaveCount(0)
      expect(pageErrors).toEqual([])
      expect(renderingErrors).toEqual([])
    })
  })
}

test('three feasible finish choices, comparison, replay and advancement without duplicate scoring', async ({ page }) => {
  // This full-round flow includes several 3D redraws and a complete replay.
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    if (!JSON.parse(localStorage.getItem('shot-selection-session') || 'null')?.completedLessons) localStorage.setItem('shot-selection-session', JSON.stringify({ scoringVersion: 2, completedLessons: 10, level: 11, score: 0, rounds: 10, perfect: 0, seed: 71431 }))
  })
  await page.goto('/')
  await startLevel(page)
  await expect(page.locator('.pool-table-scene canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Choose your ball.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toHaveCount(0)
  await expectWizardStep(page, 'Ball')
  const initialFrame = await readGameFrame(page)
  const offeredBallCount = await page.locator('.ball-choice:enabled').count()
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await expect(page.locator('.finish-option')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeEnabled()
  await expectWizardStep(page, 'Ball')
  await expectStableGameFrame(page, initialFrame, 'after selecting a ball')
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your finish.' })).toBeVisible()
  await expect(page.locator('.ball-choice')).toHaveCount(0)
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await expectWizardStep(page, 'Finish')
  await expectStableGameFrame(page, initialFrame, 'after advancing to Finish')
  await expect(page.locator('.finish-option').first()).toHaveCSS('display', 'flex')
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  const strokes = await page.locator('.finish-copy').allTextContents()
  expect(new Set(strokes).size).toBe(3)
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose finish A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Choose finish B', exact: true }).click()
  await expectStableGameFrame(page, initialFrame, 'after selecting a finish')
  await expect(page.getByRole('button', { name: 'Choose finish A', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Choose finish B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await expectWizardStep(page, 'Ball')
  await expect(page.locator('.finish-option')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose finish B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeEnabled()
  await expectStableGameFrame(page, initialFrame, 'after returning to the same ball and finish')
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await page.getByRole('button', { name: 'Select ball 2', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await expect(page.locator('.finish-option[aria-pressed="true"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  expect(await page.locator('.finish-copy').allTextContents()).toEqual(strokes)
  await page.getByRole('button', { name: 'Choose finish B', exact: true }).click()
  await page.screenshot({ path: '/tmp/shot-selection-fixed-finishes.png', fullPage: true })
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expectStableGameFrame(page, initialFrame, 'after showing the verdict')
  await expectWizardStep(page, 'Result')
  await expect(page.locator('.shot-panel-actions').getByRole('button', { name: 'Play the best shot' })).toBeEnabled()
  await expect(page.locator('.shot-panel-actions').getByRole('button', { name: 'Next level' })).toBeEnabled()
  await expect(page.locator('.analysis-card')).toHaveCount(offeredBallCount * 3)
  await expect(page.locator('.analysis-active')).toContainText('Your selection · B')
  await expect(page.locator('.analysis-active .analysis-stroke')).toContainText(strokes[1].split('cue-ball speed')[0].trim())
  const roundScore = page.locator('.points-awarded strong')
  await expect(roundScore).toHaveText(/^(?:0|[1-9]0|100)\s*\/\s*100$/)
  const awardedPoints = Number.parseInt((await roundScore.textContent())!, 10)
  const breakdown = page.getByRole('region', { name: 'How your score adds up' })
  await expect(breakdown).toBeVisible()
  await expect(breakdown.locator('dd').nth(0)).toHaveText(/^(?:0|[1-7]0)\s*\/\s*70$/)
  await expect(breakdown.locator('dd').nth(1)).toHaveText(/^(?:0|[1-3]0)\s*\/\s*30$/)
  const components = (await breakdown.locator('dd').allTextContents()).map(text => Number.parseInt(text, 10))
  expect(components.reduce((sum, points) => sum + points, 0)).toBe(awardedPoints)
  await expect(breakdown).toContainText(new RegExp(`rank \\d+ of ${offeredBallCount * 3} choices`))
  await expect(page.locator('.analysis-placement')).toHaveCount(offeredBallCount * 3)
  for (const placement of await page.locator('.analysis-placement').all()) {
    await expect(placement.locator('span')).toHaveText(new RegExp(`^(?:Joint rank|Rank) \\d+ of ${offeredBallCount * 3}$`))
    await expect(placement.locator('strong')).toHaveText(/^(?:0|[1-9]0|100)\s*\/\s*100$/)
  }
  await expect(page.locator('.analysis-active .analysis-placement strong')).toHaveText(`${awardedPoints} / 100`)
  const finishSwitch = page.getByRole('switch', { name: 'Show finish positions', exact: true })
  await expect(finishSwitch).not.toBeChecked()
  await finishSwitch.click()
  await expect(finishSwitch).toBeChecked()
  await page.locator('.analysis-card').last().click()
  await expect(page.locator('.analysis-card').last()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Object pots', { exact: true })).toBeVisible()
  await expect(page.getByText('Misses / fouls', { exact: true })).toBeVisible()
  await expect(page.locator('.ensemble-explanation')).toContainText('64 object-ball paths and 24 cue-ball paths shown')
  const pathSwitch = page.getByRole('switch', { name: 'Show paths', exact: true })
  await pathSwitch.click()
  await expect(pathSwitch).not.toBeChecked()
  await expect(finishSwitch).toBeChecked()
  await pathSwitch.click()
  await page.screenshot({ path: '/tmp/shot-selection-potting-ensemble.png', fullPage: true })
  await page.getByRole('button', { name: 'Play the best shot' }).click()
  await expect(page.getByRole('button', { name: 'Shot in motion…' })).toBeDisabled()
  await expectStableGameFrame(page, initialFrame, 'during replay')
  await expect(page.getByRole('button', { name: 'Play the best shot' })).toBeEnabled({ timeout: 25_000 })
  await expectStableGameFrame(page, initialFrame, 'after replay')
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(completed.rounds).toBe(11)
  expect(completed.completedLessons).toBe(11)
  expect(completed.level).toBe(12)
  expect(completed.score).toBe(awardedPoints)
  expect(completed.scoringVersion).toBe(2)
  expect(completed.perfect).toBe(Number(awardedPoints === 100))
  await page.getByRole('button', { name: /^View session stats/ }).click()
  await expect(statValue(page, 'Total points')).toHaveText(String(awardedPoints))
  await expect(statValue(page, '100-point choices')).toHaveText(String(completed.perfect))
  await expect(statValue(page, 'Points earned')).toHaveText(`${Math.round(completed.score / completed.rounds)}%`)
  await page.getByRole('button', { name: 'Back to the table', exact: true }).click()
  await page.getByRole('button', { name: 'Next level' }).click()
  await expect(page.getByRole('dialog')).toContainText('LEVEL 12')
  await startLevel(page, 12)
  await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeDisabled()
  await expect(page.locator('.simulation-overlay')).toHaveCount(0, { timeout: 30_000 })
  await expectWizardStep(page, 'Ball')
  await expectStableGameFrame(page, initialFrame, 'after advancing to the next level')
  await expect(finishSwitch).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('dialog')).toContainText('LEVEL 12')
  await startLevel(page, 12)
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(reloaded).toEqual(completed)
  expect(errors).toEqual([])
})

test('legacy session points migrate once and retain progress and correct stats', async ({ page }) => {
  // Reloading saved progress does not require the WebGL renderer.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  })
  await page.goto('/')
  await startLevel(page)
  await expect(page.getByRole('button', { name: 'View session stats, 0 points', exact: true })).toBeVisible()
  const legacy = { level: 3, score: 1.5, rounds: 2, perfect: 1, seed: 71431 }
  await page.evaluate(saved => localStorage.setItem('shot-selection-session', JSON.stringify(saved)), legacy)
  const migrated = { ...legacy, score: 150, scoringVersion: 2, courseVersion: 2, completedLessons: 2 }
  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await startLevel(page, 3)
    await expect(page.getByRole('button', { name: 'View session stats, 150 points', exact: true })).toBeVisible()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(migrated)
    await page.getByRole('button', { name: 'View session stats, 150 points', exact: true }).click()
    await expect(statValue(page, 'Total points')).toHaveText('150')
    await expect(statValue(page, 'Rounds played')).toHaveText('2')
    await expect(statValue(page, '100-point choices')).toHaveText('1')
    await expect(statValue(page, 'Points earned')).toHaveText('75%')
  }
})

test('360px mobile wizard works with keyboard, help and reset in the overhead view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await page.goto('/')
  await startLevel(page)
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('A, B, or C')
  await page.getByRole('button', { name: 'Let’s read the table' }).click()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 30_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectWizardStep(page, 'Ball')
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await expectWizardStep(page, 'Finish')
  const finishC = page.getByRole('button', { name: 'Choose finish C', exact: true })
  await finishC.focus()
  await page.keyboard.press('Space')
  await expect(finishC).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeEnabled()
  await page.screenshot({ path: '/tmp/shot-selection-fixed-mobile.png', fullPage: true })
  await expect(page.getByRole('button', { name: /Switch to (?:overhead|angled) view/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Restart session', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Restart session' }).click()
  await page.getByRole('button', { name: 'Keep playing' }).click()
  await expect(finishC).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Restart session' }).click()
  await page.getByRole('button', { name: 'Start fresh' }).click()
  await startLevel(page, 1)
  await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeDisabled()
  await expect(page.locator('.finish-option')).toHaveCount(0)
  await expectWizardStep(page, 'Ball')
})

test('mobile WebGL fallback keeps the frame stable through fixed choices, replay and next level', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('shot-selection-session', JSON.stringify({ scoringVersion: 2, completedLessons: 10, level: 11, score: 0, rounds: 10, perfect: 0, seed: 71431 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  })
  await page.goto('/')
  await startLevel(page)
  await expect(page.getByText('2D view · WebGL unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 30_000 })
  const initialFrame = await readGameFrame(page)
  await expectWizardStep(page, 'Ball')
  const finishSwitch = page.getByRole('switch', { name: 'Show finish positions', exact: true })
  const pathSwitch = page.getByRole('switch', { name: 'Show paths', exact: true })
  const finishGroup = page.getByTestId('ensemble-finishes')
  const finishMarkers = page.getByTestId('ensemble-ball-finish')
  const readFinishes = () => finishMarkers.evaluateAll(markers => markers.map(marker => ({
    ballId: Number(marker.getAttribute('data-ball-id') ?? Number.NaN),
    trial: Number(marker.getAttribute('data-trial-index') ?? Number.NaN),
    x: Number(marker.getAttribute('cx') ?? Number.NaN),
    y: Number(marker.getAttribute('cy') ?? Number.NaN),
  })))
  await expect(finishSwitch).toHaveCount(0)
  await expect(finishGroup).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Table ball 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.finish-option')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await expectStableGameFrame(page, initialFrame, 'after selecting a ball on mobile')
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await expectWizardStep(page, 'Finish')
  await expect(finishSwitch).toHaveCount(0)
  await expect(finishMarkers).toHaveCount(0)
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(3)
  await page.locator('svg[aria-label="Interactive pool table, top view"] > rect').nth(3).dispatchEvent('pointerdown', { clientX: 100, clientY: 100 })
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  await page.getByRole('button', { name: 'Table finish B', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose finish B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await expectWizardStep(page, 'Ball')
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Table finish B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Table ball 2', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expectWizardStep(page, 'Finish')
  await expect(page.locator('.selected-ball-summary')).toContainText('Ball 2')
  await expect(page.locator('.finish-option[aria-pressed="true"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  await page.getByRole('button', { name: 'Table ball 1', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.selected-ball-summary')).toContainText('Ball 1')
  await expect(page.locator('.finish-option[aria-pressed="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Table finish B', exact: true }).click()
  await expectStableGameFrame(page, initialFrame, 'after choosing a table marker on mobile')
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expectStableGameFrame(page, initialFrame, 'after showing the verdict on mobile')
  await expectWizardStep(page, 'Result')
  const objectPaths = page.locator('[data-testid="object-pot-path"], [data-testid="object-miss-path"], [data-testid="object-foul-path"]')
  await expect(objectPaths).toHaveCount(64)
  await expect(page.getByTestId('object-pot-path').first()).toBeAttached()
  const potCount = await page.getByTestId('object-pot-path').count()
  await expect(page.locator('.analysis-active .analysis-metrics > span').first()).toContainText(`${Math.round(potCount / 64 * 100)}%`)
  await expect(finishSwitch).not.toBeChecked()
  await expect(finishGroup).toHaveCount(0)
  await finishSwitch.focus()
  await page.keyboard.press('Space')
  await expect(finishSwitch).toBeChecked()
  await expect(finishGroup).toBeVisible()
  const selectedFinishes = await readFinishes()
  expect(selectedFinishes.length).toBeGreaterThan(64)
  expect([...new Set(selectedFinishes.map(marker => marker.trial))].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i))
  expect(new Set(selectedFinishes.map(marker => `${marker.trial}:${marker.ballId}`)).size).toBe(selectedFinishes.length)
  expect(selectedFinishes.some(marker => marker.ballId === 0)).toBe(true)
  expect(selectedFinishes.some(marker => marker.ballId > 1)).toBe(true)
  expect(selectedFinishes.filter(marker => marker.ballId === 1)).toHaveLength(await page.getByTestId('object-miss-path').count())
  expect(selectedFinishes.every(marker => Number.isFinite(marker.x) && Number.isFinite(marker.y))).toBe(true)
  await page.locator('.analysis-card').last().click()
  await expect.poll(readFinishes).not.toEqual(selectedFinishes)
  const inspectedFinishes = await readFinishes()
  await expect(objectPaths).toHaveCount(64)
  await expect(page.getByTestId('object-miss-path').first()).toBeAttached()
  await expect(page.getByTestId('object-miss-path').first()).toHaveAttribute('stroke-dasharray', /.+/)
  await pathSwitch.click()
  await expect(objectPaths).toHaveCount(0)
  await expect(finishGroup).toBeVisible()
  expect(await readFinishes()).toEqual(inspectedFinishes)
  await finishSwitch.click()
  await expect(finishMarkers).toHaveCount(0)
  await expect(finishGroup).toHaveCount(0)
  await finishSwitch.click()
  expect(await readFinishes()).toEqual(inspectedFinishes)
  await expect(objectPaths).toHaveCount(0)
  await pathSwitch.click()
  await expect(objectPaths).toHaveCount(64)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/shot-selection-potting-mobile.png', fullPage: true })
  await page.locator('.shot-panel-actions').getByRole('button', { name: 'Play the best shot' }).click()
  await expect(page.getByRole('button', { name: 'Shot in motion…' })).toBeDisabled()
  await expect(finishMarkers).toHaveCount(0)
  await expect(finishGroup).toHaveCount(0)
  await expectStableGameFrame(page, initialFrame, 'during replay on mobile')
  await expect(page.getByRole('button', { name: 'Play the best shot' })).toBeEnabled({ timeout: 25_000 })
  await expect(finishSwitch).toBeChecked()
  await expect(finishGroup).toBeVisible()
  await expect(finishMarkers.first()).toBeVisible()
  await expectStableGameFrame(page, initialFrame, 'after replay on mobile')
  await page.locator('.shot-panel-actions').getByRole('button', { name: 'Next level' }).click()
  await expect(page.getByRole('dialog')).toContainText('LEVEL 12')
  await startLevel(page, 12)
  await expect(page.locator('.simulation-overlay')).toHaveCount(0, { timeout: 30_000 })
  await expectStableGameFrame(page, initialFrame, 'after advancing on mobile')
  await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeDisabled()
  await expectWizardStep(page, 'Ball')
  await expect(finishSwitch).toHaveCount(0)
  await expect(finishMarkers).toHaveCount(0)
  await expect(finishGroup).toHaveCount(0)
})

for (const width of [860, 360]) test(`${width}px later-level wizard keeps extra balls, finishes and verdict reachable`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 844 : 900 })
  await page.addInitScript(() => {
    localStorage.setItem('shot-selection-session', JSON.stringify({ scoringVersion: 2, completedLessons: 40, level: 41, score: 0, rounds: 40, perfect: 0, seed: 71431 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  })
  await page.goto('/')
  await startLevel(page)
  await expect(page.locator('.simulation-overlay')).toHaveCount(0, { timeout: 30_000 })
  const balls = page.locator('.ball-choice')
  expect(await balls.count()).toBeGreaterThan(3)
  await expectWizardStep(page, 'Ball')
  const initialFrame = await readGameFrame(page)
  for (let index = 0; index < await balls.count(); index++) {
    const ball = balls.nth(index)
    await expectControlInsideSidebar(ball)
    if (await ball.isEnabled()) {
      await ball.click()
      await expect(page.locator('.finish-option')).toHaveCount(0)
      await expectStableGameFrame(page, initialFrame, `after selecting later-level ball ${index + 1}`)
    }
  }
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await expectWizardStep(page, 'Finish')
  for (const finish of ['A', 'B', 'C']) {
    const control = page.getByRole('button', { name: `Choose finish ${finish}`, exact: true })
    await control.focus()
    await expectControlInsideSidebar(control)
    await page.keyboard.press('Space')
    await expect(control).toHaveAttribute('aria-pressed', 'true')
    await expectStableGameFrame(page, initialFrame, `after keyboard-selecting finish ${finish}`)
  }
  await expectSidebarFits(page)
  await expect(page.locator('.shot-panel-actions').getByRole('button', { name: 'Lock in your shot' })).toBeEnabled()
  await expectStableGameFrame(page, initialFrame, 'after selecting each later-level finish')
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expectWizardStep(page, 'Result')
  await expectStableGameFrame(page, initialFrame, 'after showing the later-level verdict')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `/tmp/shot-selection-scoring-${width}.png`, fullPage: true })
})
