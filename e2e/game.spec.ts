import { expect, test, type Locator, type Page } from '@playwright/test'

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

async function expectSidebarFits(page: Page) {
  const body = page.locator('.shot-panel-body')
  const actions = page.locator('.shot-panel-actions')
  await expect.poll(() => body.evaluate(element => Math.max(
    element.scrollHeight - element.clientHeight,
    element.scrollWidth - element.clientWidth,
    element.scrollTop,
  )), { message: 'The current wizard step should fit without sidebar scrolling' }).toBeLessThanOrEqual(1)
  const actionBounds = await documentBounds(actions)
  const bodyBounds = await documentBounds(body)
  expect(bodyBounds.y + bodyBounds.height).toBeLessThanOrEqual(actionBounds.y + 1)
  const panelBounds = await documentBounds(page.locator('.shot-panel'))
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(panelBounds.y + panelBounds.height)
}

async function expectWizardStep(page: Page, step: 'Ball' | 'Finish' | 'Result') {
  const progress = page.locator('.shot-progress')
  await expect(progress.getByRole('listitem')).toHaveCount(3)
  for (const label of ['Ball', 'Finish', 'Result']) await expect(progress.getByRole('listitem').filter({ hasText: label })).toBeVisible()
  await expect(progress.locator('[aria-current="step"]')).toContainText(step)
  await expectSidebarFits(page)
}

async function expectControlInsideSidebar(control: Locator) {
  await expect.poll(() => control.evaluate(element => {
    const body = element.closest('.shot-panel-body')!.getBoundingClientRect()
    const bounds = element.getBoundingClientRect()
    return bounds.top >= body.top - 1 && bounds.bottom <= body.bottom + 1
      && bounds.left >= body.left - 1 && bounds.right <= body.right + 1
  })).toBe(true)
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
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
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
  await page.locator('.analysis-card').last().click()
  await expect(page.locator('.analysis-card').last()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Object pots', { exact: true })).toBeVisible()
  await expect(page.getByText('Misses / fouls', { exact: true })).toBeVisible()
  await expect(page.locator('.ensemble-explanation')).toContainText('64 object-ball paths and 24 cue-ball paths shown')
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('switch').click()
  await page.screenshot({ path: '/tmp/shot-selection-potting-ensemble.png', fullPage: true })
  await page.getByRole('button', { name: 'Play the best shot' }).click()
  await expect(page.getByRole('button', { name: 'Shot in motion…' })).toBeDisabled()
  await expectStableGameFrame(page, initialFrame, 'during replay')
  await expect(page.getByRole('button', { name: 'Play the best shot' })).toBeEnabled({ timeout: 25_000 })
  await expectStableGameFrame(page, initialFrame, 'after replay')
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(completed.rounds).toBe(1)
  expect(completed.level).toBe(2)
  await page.getByRole('button', { name: 'Next level' }).click()
  await expect(page.getByText('LEVEL 02', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeDisabled()
  await expect(page.locator('.simulation-overlay')).toHaveCount(0, { timeout: 30_000 })
  await expectWizardStep(page, 'Ball')
  await expectStableGameFrame(page, initialFrame, 'after advancing to the next level')
  await page.reload()
  await expect(page.getByText('LEVEL 02', { exact: false })).toBeVisible()
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(reloaded).toEqual(completed)
  expect(errors).toEqual([])
})

test('360px mobile wizard works with keyboard, help and reset in the overhead view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('A, B, or C')
  await page.getByRole('button', { name: 'Let’s read the table' }).click()
  await expect(page.getByRole('button', { name: 'Select ball 2', exact: true })).toBeEnabled({ timeout: 30_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectWizardStep(page, 'Ball')
  await page.getByRole('button', { name: 'Select ball 2', exact: true }).click()
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
  await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeDisabled()
  await expect(page.locator('.finish-option')).toHaveCount(0)
  await expectWizardStep(page, 'Ball')
})

test('mobile WebGL fallback keeps the frame stable through fixed choices, replay and next level', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  })
  await page.goto('/')
  await expect(page.getByText('2D view · WebGL unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 30_000 })
  const initialFrame = await readGameFrame(page)
  await expectWizardStep(page, 'Ball')
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Table ball 1', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.finish-option')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await expectStableGameFrame(page, initialFrame, 'after selecting a ball on mobile')
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await expectWizardStep(page, 'Finish')
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
  await page.locator('.analysis-card').last().click()
  await expect(objectPaths).toHaveCount(64)
  await expect(page.getByTestId('object-miss-path').first()).toBeAttached()
  await expect(page.getByTestId('object-miss-path').first()).toHaveAttribute('stroke-dasharray', /.+/)
  await page.getByRole('switch').click()
  await expect(objectPaths).toHaveCount(0)
  await page.getByRole('switch').click()
  await expect(objectPaths).toHaveCount(64)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/shot-selection-potting-mobile.png', fullPage: true })
  await page.locator('.shot-panel-actions').getByRole('button', { name: 'Play the best shot' }).click()
  await expect(page.getByRole('button', { name: 'Shot in motion…' })).toBeDisabled()
  await expectStableGameFrame(page, initialFrame, 'during replay on mobile')
  await expect(page.getByRole('button', { name: 'Play the best shot' })).toBeEnabled({ timeout: 25_000 })
  await expectStableGameFrame(page, initialFrame, 'after replay on mobile')
  await page.locator('.shot-panel-actions').getByRole('button', { name: 'Next level' }).click()
  await expect(page.getByText('LEVEL 02', { exact: false })).toBeVisible()
  await expect(page.locator('.simulation-overlay')).toHaveCount(0, { timeout: 30_000 })
  await expectStableGameFrame(page, initialFrame, 'after advancing on mobile')
  await expect(page.getByRole('button', { name: 'Choose a finish', exact: true })).toBeDisabled()
  await expectWizardStep(page, 'Ball')
})

for (const width of [860, 360]) test(`${width}px later-level wizard fits extra balls, finishes and verdict without scrolling`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 844 : 900 })
  await page.addInitScript(() => {
    localStorage.setItem('shot-selection-session', JSON.stringify({ level: 12, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  })
  await page.goto('/')
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
})
