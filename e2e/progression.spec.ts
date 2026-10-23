import { expect, test, type Page } from '@playwright/test'
import { startLevel } from './helpers'

async function seedLesson(page: Page, level: number, fallback = true, legacy = false) {
  await page.addInitScript(({ level, fallback, legacy }) => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    if (!localStorage.getItem('shot-selection-session')) localStorage.setItem('shot-selection-session', JSON.stringify({
      scoringVersion: 2, ...(!legacy ? { courseVersion: 2 } : {}), completedLessons: level - 1, level, score: (level - 1) * 50,
      rounds: level - 1, perfect: 0, seed: 71431,
    }))
    if (fallback) {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
        if (type === 'webgl2') return null
        return original.call(this, type as '2d', ...args)
      } as typeof original
    }
  }, { level, fallback, legacy })
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
  const briefing = page.getByRole('dialog', { name: 'Your first pot', exact: true })
  await expect(briefing).toContainText('LEVEL 01 / 70')
  await expect(briefing).toContainText('LESSON 1 OF 10')
  await expect(briefing.locator('.briefing-steps i')).toHaveCount(10)
  await expect(briefing.locator('.briefing-steps .step-reached')).toHaveCount(1)
  await expect(briefing).toContainText('New scenario')
  await expect(briefing.getByRole('region', { name: 'Learning focus', exact: true })).toContainText('LEARN THIS')
  await expect(briefing.getByRole('complementary', { name: 'Teaching tip', exact: true })).toContainText('Watch for this')
  const briefingPath = '/tmp/shot-selection-course-briefing.png'
  await page.screenshot({ path: briefingPath, fullPage: true })
  await testInfo.attach('First level teaching dialog', { path: briefingPath, contentType: 'image/png' })
  await startLevel(page, 1)
  const progress = page.getByRole('progressbar', { name: 'Game completion' })
  await expect(progress).toHaveAttribute('aria-valuenow', '0')
  await expect(progress).toHaveAttribute('aria-valuetext', '0 of 70 levels complete')
  const chapters = page.getByRole('list', { name: 'Learning scenarios' })
  await expect(chapters.getByRole('listitem')).toHaveCount(7)
  await expect(chapters.locator('small')).toHaveText([
    'Levels 1–10 · 0/10', 'Levels 11–20 · 0/10', 'Levels 21–30 · 0/10',
    'Levels 31–40 · 0/10', 'Levels 41–50 · 0/10', 'Levels 51–60 · 0/10', 'Levels 61–70 · 0/10',
  ])
  await expect(chapters.locator('[aria-current="step"]')).toContainText('First strokes')
  await expect(page.getByRole('region', { name: 'Current lesson', exact: true })).toHaveCount(0)
  await expect(page.locator('.lesson-brief')).toHaveCount(0)
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

test('a saved level 5 session prepares three playable finishes', async ({ page }) => {
  await seedLesson(page, 5)
  await page.goto('/')
  await startLevel(page, 5)
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 30_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry preparation', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Choose finish [ABC]$/ })).toHaveCount(3)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('position lesson hides stroke outcomes until commitment and keeps its labels in the legend', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await seedLesson(page, 21)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Leave a shot on the 2', exact: true })).toContainText('New scenario')
  const briefingPath = '/tmp/shot-selection-position-briefing-mobile.png'
  await page.screenshot({ path: briefingPath, fullPage: true })
  await testInfo.attach('Mobile position scenario introduction', { path: briefingPath, contentType: 'image/png' })
  await startLevel(page, 21)
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '29')
  const chapters = page.getByRole('list', { name: 'Learning scenarios' })
  await expect(chapters.locator('[aria-current="step"]')).toContainText('Play for position')
  await expect(chapters.locator('.chapter-done')).toHaveCount(2)
  await expect(chapters.locator('[aria-current="step"] small')).toHaveText('Levels 21–30 · 0/10')
  expect(await chapters.getByRole('listitem').evaluateAll(items => items.every(item => {
    const bounds = item.getBoundingClientRect()
    return bounds.left >= 0 && bounds.right <= innerWidth && item.scrollWidth <= item.clientWidth
  })), 'All ten-level scenario cards should fit on mobile').toBe(true)
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
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '30')
  await expect(chapters.locator('[aria-current="step"] small')).toHaveText('Levels 21–30 · 1/10')
  await expect(page.getByRole('region', { name: 'Lesson takeaway', exact: true })).toContainText('LESSON 21 COMPLETE')
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
  expect(saved).toMatchObject({ completedLessons: 21, rounds: 21, level: 22 })
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Control the length', exact: true })).toContainText('LEVEL 22')
  await expect(page.getByRole('dialog')).toContainText('Build your skill')
  await startLevel(page, 22)
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Control the length', exact: true })).toContainText('LEVEL 22')
  await startLevel(page, 22)
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '21 of 70 levels complete')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('WebGL position table keeps the same puzzle visible across stroke choices', async ({ page }, testInfo) => {
  await seedLesson(page, 21, false)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await startLevel(page, 21)
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
  const comparison = await page.evaluate(async sources => {
    const images = await Promise.all(sources.map(async source => {
      const image = new Image()
      image.src = `data:image/png;base64,${source}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return { width: image.width, height: image.height, pixels: context.getImageData(0, 0, image.width, image.height).data }
    }))
    let maxChannelDifference = 0
    for (let index = 0; index < images[0].pixels.length; index++) {
      maxChannelDifference = Math.max(maxChannelDifference, Math.abs(images[0].pixels[index] - images[1].pixels[index]))
    }
    return { dimensions: images.map(image => [image.width, image.height]), maxChannelDifference }
  }, [before.toString('base64'), selected.toString('base64')])
  expect(comparison.dimensions[1]).toEqual(comparison.dimensions[0])
  // Software WebGL redraws can round a few RGB channels by one level. Compare
  // every pixel, allowing only that rounding; a drawn endpoint still fails.
  expect(comparison.maxChannelDifference, 'Choosing a stroke must not draw its predicted endpoint on the table').toBeLessThanOrEqual(1)
  await expect(legend).not.toContainText('Planned finish')
  await expect(page.locator('.analysis-rate')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a completed earlier course resumes at banks while retaining tournament credit', async ({ page }) => {
  await seedLesson(page, 61, true, true)
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('LEVEL 51 / 70')
  await expect(page.getByRole('dialog')).toContainText('Bank shots')
  await startLevel(page, 51)
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Bank shots')
  await expect(page.getByRole('region', { name: 'Course progression' })).toContainText('Your 10 completed tournament lessons are saved')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ courseVersion: 2, completedLessons: 50, level: 51,
    carriedTournamentLessons: 10, rounds: 60, score: 3000, perfect: 0, seed: 71431 })
  await page.reload()
  await expect(page.getByRole('dialog')).toContainText('LEVEL 51 / 70')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
})

test('the final lesson reaches 100% and reloads its summary without scoring twice', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await seedLesson(page, 70)
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('Put it together')
  await startLevel(page, 70)
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '99')
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Tournament table')
  await chooseFirstOption(page, 'stroke')
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  const awarded = Number.parseInt((await page.locator('.points-awarded strong').textContent())!, 10)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ completedLessons: 70, rounds: 70, level: 71, score: 3450 + awarded })
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByRole('button', { name: 'Next level', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'View course summary', exact: true }).click()
  const summary = page.getByRole('region', { name: 'Course complete', exact: true })
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('100%')
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('.chapter-done')).toHaveCount(7)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(summary.getByRole('heading')).toBeFocused()
  const path = '/tmp/shot-selection-course-complete.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Completed course summary', { path, contentType: 'image/png' })
  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await expect(summary).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(summary.getByRole('heading')).toBeFocused()
    await expect(page.locator('.simulation-overlay')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toHaveCount(0)
    await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '70 of 70 levels complete')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
  }
  await page.getByRole('button', { name: 'Start a new course', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Your first pot', exact: true })).toContainText('New scenario')
  await startLevel(page, 1)
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '0 of 70 levels complete')
})

test('reviewing a briefing preserves the selected ball and finish', async ({ page }) => {
  await seedLesson(page, 11)
  await page.goto('/')
  await startLevel(page, 11)
  await chooseFirstOption(page)
  await page.getByRole('button', { name: 'Review level briefing', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Two balls, one decision', exact: true })).toContainText('New scenario')
  await page.getByRole('dialog').getByRole('button', { name: 'Back to the table', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review level briefing', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Choose finish A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('the tenth encounter brings previous skills together with a specific cue-ball tip', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await seedLesson(page, 10)
  await page.goto('/')
  const briefing = page.getByRole('dialog', { name: 'Let the cue ball travel', exact: true })
  await expect(briefing).toContainText('LESSON 10 OF 10')
  await expect(briefing.locator('.briefing-steps i')).toHaveCount(10)
  await expect(briefing.locator('.briefing-steps .step-reached')).toHaveCount(10)
  expect(await briefing.locator('.briefing-steps').evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const container = element.closest('.briefing-scenario')!.getBoundingClientRect()
    return bounds.left >= container.left && bounds.right <= container.right && bounds.width > 0
  }), 'All ten lesson indicators should fit inside the mobile briefing').toBe(true)
  await expect(briefing).toContainText('Put it together')
  await expect(briefing.getByRole('region', { name: 'Learning focus', exact: true })).toContainText('Follow the whole route')
  await expect(briefing.getByRole('complementary', { name: 'Teaching tip', exact: true })).toContainText('Backspin does not always bring the cue ball straight back.')
  const path = '/tmp/shot-selection-tenth-lesson-briefing.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Tenth lesson teaching dialog', { path, contentType: 'image/png' })
  await startLevel(page, 10)
})
