import { expect, test, type Page } from '@playwright/test'

async function seedLesson(page: Page, level: number, fallback = true) {
  await page.addInitScript(({ level, fallback }) => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    if (!localStorage.getItem('shot-selection-session')) localStorage.setItem('shot-selection-session', JSON.stringify({
      scoringVersion: 2, completedLessons: level - 1, level, score: (level - 1) * 50,
      rounds: level - 1, perfect: 0, seed: 71431,
    }))
    if (fallback) {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
        if (type === 'webgl2') return null
        return original.call(this, type as '2d', ...args)
      } as typeof original
    }
  }, { level, fallback })
}

async function chooseFirstOption(page: Page, mode: 'finish' | 'stroke' = 'finish') {
  const ball = page.getByRole('button', { name: 'Select ball 1', exact: true })
  await expect(ball).toBeEnabled({ timeout: 45_000 })
  await ball.click()
  await page.getByRole('button', { name: `Choose a ${mode}`, exact: true }).click()
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await page.getByRole('button', { name: `Choose ${mode} A`, exact: true }).click()
}

test('beginner training starts with one ball, a lesson and an empty course progress bar', async ({ page }, testInfo) => {
  await seedLesson(page, 1)
  await page.goto('/')
  const progress = page.getByRole('progressbar', { name: 'Game completion' })
  await expect(progress).toHaveAttribute('aria-valuenow', '0')
  await expect(progress).toHaveAttribute('aria-valuetext', '0 of 18 levels complete')
  const chapters = page.getByRole('list', { name: 'Learning scenarios' })
  await expect(chapters.getByRole('listitem')).toHaveCount(6)
  await expect(chapters.locator('[aria-current="step"]')).toContainText('First strokes')
  await expect(page.getByRole('region', { name: 'Current lesson', exact: true })).toContainText('Your first pot')
  await expect(page.getByRole('region', { name: 'Current lesson', exact: true })).toContainText('LEARN THIS')
  await chooseFirstOption(page)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Table finish A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Choose stroke [ABC]$/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await expect(page.locator('.ball-choice')).toHaveCount(1)
  const path = '/tmp/shot-selection-course-desktop.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Beginner course and lesson briefing', { path, contentType: 'image/png' })
})

test('position lesson hides stroke outcomes until commitment and keeps its labels in the legend', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await seedLesson(page, 7)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '33')
  await expect(page.getByRole('region', { name: 'Current lesson', exact: true })).toContainText('Leave a shot on the 2')
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Play for position')
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 45_000 })
  await expect(page.getByRole('button', { name: 'Select ball 2', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Table ball 2', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('button', { name: 'Table ball 2', exact: true })).toHaveAccessibleDescription(/Next ball/)
  const zone = page.getByTestId('position-zone')
  await expect(zone).toBeVisible()
  await expect(zone).toHaveAttribute('stroke', '#8ce6df')
  await expect(zone).toHaveAttribute('r', '20')
  await expect(page.getByTestId('next-ball-marker')).toBeVisible()
  const legend = page.getByLabel('Table legend', { exact: true })
  await expect(legend).toContainText('Position zone')
  await expect(legend).toContainText('Next ball 2')
  await expect(legend).not.toContainText('Planned finish')
  const table = page.locator('svg[aria-label="Interactive pool table, top view"]')
  // The rings remain on the cloth; descriptive text belongs to the legend.
  await expect(table.getByText(/^(Position zone|Next · 2|[ABC])$/)).toHaveCount(0)
  await expect(page.getByTestId('nominal-cue-finish')).toHaveCount(0)
  await expect(page.locator('.analysis-rate')).toHaveCount(0)
  await expect(page.getByTestId('ensemble-paths')).toHaveCount(0)
  const readZone = () => zone.evaluate(element => ['cx', 'cy', 'r'].map(name => element.getAttribute(name)))
  const fixedZone = await readZone()
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your stroke.', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Stroke options', exact: true }).getByRole('button')).toHaveCount(3)
  await expect(page.locator('.shot-progress [aria-current="step"]')).toHaveText(/Stroke/)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toBeDisabled()
  const unchangedTable = await table.evaluate(element => element.outerHTML)
  const beforePath = '/tmp/shot-selection-position-mobile-before-stroke.png'
  await page.locator('.table-panel').screenshot({ path: beforePath, animations: 'disabled' })
  await testInfo.attach('Mobile position puzzle before choosing a stroke', { path: beforePath, contentType: 'image/png' })
  for (const label of ['A', 'B', 'C']) {
    const stroke = page.getByRole('button', { name: `Choose stroke ${label}`, exact: true })
    await stroke.click()
    await expect(stroke).toHaveAttribute('aria-pressed', 'true')
    expect(await readZone()).toEqual(fixedZone)
    expect(await table.evaluate(element => element.outerHTML)).toBe(unchangedTable)
    await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
    await expect(page.getByTestId('nominal-cue-finish')).toHaveCount(0)
    await expect(page.getByTestId('ensemble-paths')).toHaveCount(0)
    await expect(page.locator('.analysis-rate')).toHaveCount(0)
  }
  await expect(legend).not.toContainText('Planned finish')
  const path = '/tmp/shot-selection-position-mobile-selected-stroke.png'
  await page.locator('.table-panel').screenshot({ path, animations: 'disabled' })
  await testInfo.attach('Mobile position puzzle after choosing a stroke', { path, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByTestId('nominal-cue-finish')).toBeVisible()
  await expect(legend).toContainText('Planned finish')
  await expect(page.locator('.analysis-rate')).toHaveCount(3)
  await expect(page.getByTestId('ensemble-paths')).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '39')
  await expect(page.getByRole('region', { name: 'Lesson takeaway', exact: true })).toContainText('LESSON 7 COMPLETE')
  await expect(page.locator('.analysis-card')).toHaveCount(3)
  const revealedFinishes: string[] = []
  for (const card of await page.locator('.analysis-card').all()) {
    await expect(card).toContainText('In zone')
    await expect(card).toContainText('Next shot')
    await card.click()
    expect(await readZone()).toEqual(fixedZone)
    revealedFinishes.push(await page.getByTestId('nominal-cue-finish').evaluate(element => element.outerHTML))
  }
  expect(new Set(revealedFinishes).size).toBe(3)
  expect(await legend.locator(':scope > span').evaluateAll(items => items.every(item => {
    const bounds = item.getBoundingClientRect()
    const footer = item.closest('.table-footer')!.getBoundingClientRect()
    return bounds.left >= footer.left && bounds.right <= footer.right && bounds.top >= footer.top && bounds.bottom <= footer.bottom
  })), 'Every result legend item should fit inside the mobile footer').toBe(true)
  const resultPath = '/tmp/shot-selection-position-mobile-result.png'
  await page.locator('.table-panel').screenshot({ path: resultPath, animations: 'disabled' })
  await testInfo.attach('Mobile position result with revealed finish and complete legend', { path: resultPath, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Play the best shot', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Shot in motion…', exact: true })).toBeDisabled()
  await expect(zone).toBeVisible()
  expect(await readZone()).toEqual(fixedZone)
  await expect(page.getByRole('button', { name: 'Play the best shot', exact: true })).toBeEnabled({ timeout: 30_000 })
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ completedLessons: 7, rounds: 7, level: 8 })
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Current lesson', exact: true })).toContainText('LEVEL 08')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Current lesson', exact: true })).toContainText('LEVEL 08')
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '7 of 18 levels complete')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('WebGL position table keeps the same puzzle visible across stroke choices', async ({ page }, testInfo) => {
  await seedLesson(page, 7, false)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 45_000 })
  await expect(page.locator('.pool-table-scene canvas')).toBeVisible()
  await expect(page.locator('.pool-table-scene')).toHaveAccessibleName('Pool table. Pot ball 1 and leave the cue ball in the cyan position zone to play ball 2 next.')
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  const legend = page.getByLabel('Table legend', { exact: true })
  await expect(legend).toContainText('Position zone')
  await expect(legend).toContainText('Next ball 2')
  await expect(legend).not.toContainText('Planned finish')
  await expect(page.locator('.analysis-rate')).toHaveCount(0)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  // The instruction above the cloth changes after choosing a stroke. Hide that
  // overlapping status line only for the table-rendering comparison.
  const screenshotStyle = '.table-instruction { visibility: hidden !important; }'
  const beforePath = '/tmp/shot-selection-position-webgl-before-stroke.png'
  const before = await page.locator('.pool-table-scene').screenshot({ path: beforePath, animations: 'disabled', style: screenshotStyle })
  await testInfo.attach('WebGL position table before choosing a stroke', { path: beforePath, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Choose stroke B', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose stroke B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const path = '/tmp/shot-selection-position-webgl-selected-stroke.png'
  const selected = await page.locator('.pool-table-scene').screenshot({ path, animations: 'disabled', style: screenshotStyle })
  await testInfo.attach('WebGL position table after choosing a stroke', { path, contentType: 'image/png' })
  expect(selected.equals(before), 'Choosing a stroke must not draw its predicted endpoint on the table').toBe(true)
  await expect(legend).not.toContainText('Planned finish')
  await expect(page.locator('.analysis-rate')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the final lesson reaches 100% and reloads its summary without scoring twice', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await seedLesson(page, 18)
  await page.goto('/')
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '94')
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Tournament table')
  await chooseFirstOption(page, 'stroke')
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  const awarded = Number.parseInt((await page.locator('.points-awarded strong').textContent())!, 10)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ completedLessons: 18, rounds: 18, level: 19, score: 850 + awarded })
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByRole('button', { name: 'Next level', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'View course summary', exact: true }).click()
  const summary = page.getByRole('region', { name: 'Course complete', exact: true })
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('100%')
  await expect(summary.getByRole('heading')).toBeFocused()
  const path = '/tmp/shot-selection-course-complete.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Completed course summary', { path, contentType: 'image/png' })
  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await expect(summary).toBeVisible()
    await expect(summary.getByRole('heading')).toBeFocused()
    await expect(page.locator('.simulation-overlay')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toHaveCount(0)
    await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '18 of 18 levels complete')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
  }
})
