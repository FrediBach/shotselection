import { expect, test } from '@playwright/test'

const visualViewports = [
  { name: 'desktop', width: 1440, height: 1050 },
  { name: 'large', width: 2000, height: 1400 },
  { name: 'mobile', width: 390, height: 844 },
] as const

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('shot-selection-session')) localStorage.setItem('shot-selection-session', JSON.stringify({ level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431 }))
  })
})

for (const viewport of visualViewports) {
  test.describe(`${viewport.name} table appearance`, () => {
    test.use({ deviceScaleFactor: viewport.name === 'large' ? 2 : 1 })
    test(`table appearance renders clean angled and overhead views at ${viewport.name} size`, async ({ page }, testInfo) => {
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
      await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()

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

      const screenshots: Buffer[] = []
      for (const view of ['angled', 'overhead'] as const) {
        if (view === 'overhead') await page.getByRole('button', { name: 'Switch to overhead view' }).click()
        await expect(page.getByRole('button', { name: view === 'angled' ? 'Switch to overhead view' : 'Switch to angled view' })).toBeVisible()
        // Let the camera effect and the following WebGL frame finish before capture.
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const path = `/tmp/shot-selection-realism-${viewport.name}-${view}.png`
        screenshots.push(await page.locator('.table-panel').screenshot({ path, animations: 'disabled' }))
        await testInfo.attach(`${viewport.name} ${view} table`, { path, contentType: 'image/png' })
        await expect(canvas).not.toHaveAttribute('data-context-lost', 'true')
        await expect(page.locator('.finish-option')).toHaveCount(0)
      }
      // A camera toggle must change the actual rendered table, not only its label.
      expect(screenshots[0].equals(screenshots[1])).toBe(false)
      expect(pageErrors).toEqual([])
      expect(renderingErrors).toEqual([])
    })
  })
}

test('three feasible finish choices, comparison, replay and advancement without duplicate scoring', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Make your call.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  await expect(page.locator('.pool-table-scene canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 30_000 })
  const offeredBallCount = await page.locator('.ball-choice:enabled').count()
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await expect(page.locator('.finish-option').first()).toHaveCSS('display', 'flex')
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  const strokes = await page.locator('.finish-copy').allTextContents()
  expect(new Set(strokes).size).toBe(3)
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose finish A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Choose finish B', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose finish A', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Choose finish B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Select ball 2', exact: true }).click()
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await expect(page.locator('.finish-option[aria-pressed="true"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  expect(await page.locator('.finish-copy').allTextContents()).toEqual(strokes)
  await page.getByRole('button', { name: 'Choose finish B', exact: true }).click()
  await page.screenshot({ path: '/tmp/shot-selection-fixed-finishes.png', fullPage: true })
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 30_000 })
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
  await expect(page.getByRole('button', { name: 'Play the best shot' })).toBeEnabled({ timeout: 25_000 })
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(completed.rounds).toBe(1)
  expect(completed.level).toBe(2)
  await page.getByRole('button', { name: 'Next level' }).click()
  await expect(page.getByText('LEVEL 02', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  await page.reload()
  await expect(page.getByText('LEVEL 02', { exact: false })).toBeVisible()
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(reloaded).toEqual(completed)
  expect(errors).toEqual([])
})

test('mobile fixed choices work with keyboard, help, camera and reset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'How to play', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('A, B, or C')
  await page.getByRole('button', { name: 'Let’s read the table' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Select ball 2', exact: true }).click()
  await expect(page.locator('.finish-option')).toHaveCount(3)
  const finishC = page.getByRole('button', { name: 'Choose finish C', exact: true })
  await finishC.focus()
  await page.keyboard.press('Space')
  await expect(finishC).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeEnabled()
  await page.screenshot({ path: '/tmp/shot-selection-fixed-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Switch to overhead view' }).click()
  await expect(page.getByRole('button', { name: 'Switch to angled view' })).toBeVisible()
  await page.getByRole('button', { name: 'Restart session' }).click()
  await page.getByRole('button', { name: 'Keep playing' }).click()
  await expect(finishC).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Restart session' }).click()
  await page.getByRole('button', { name: 'Start fresh' }).click()
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  await expect(page.locator('.finish-option')).toHaveCount(0)
})

test('WebGL fallback offers the same fixed markers and ignores free cloth placement', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  })
  await page.goto('/')
  await expect(page.getByText('2D view · WebGL unavailable')).toBeVisible()
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await page.locator('svg[aria-label="Interactive pool table, top view"] > rect').nth(3).dispatchEvent('pointerdown', { clientX: 100, clientY: 100 })
  await expect(page.getByRole('button', { name: 'Lock in your shot' })).toBeDisabled()
  await page.getByRole('button', { name: 'Table finish B', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose finish B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Lock in your shot' }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 30_000 })
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
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/shot-selection-potting-mobile.png', fullPage: true })
})
