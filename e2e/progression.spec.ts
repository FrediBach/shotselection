import { expect, test, type Page } from '@playwright/test'
import { startLevel, chooseDefaultCharacter } from './helpers'
import { expectIdealApproach, observePreparedRound } from './ideal-approach'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import type { PreparedRound } from '../src/engine/types'

async function seedLesson(page: Page, level: number, fallback = true, course: 'current' | 'tricks' | 'plants' | 'banks' | 'legacy' = 'current') {
  await observePreparedRound(page)
  await page.addInitScript(({ level, fallback, course, character }) => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    if (!localStorage.getItem('shot-selection-session')) localStorage.setItem('shot-selection-session', JSON.stringify({
      ...(level === 1 ? { character } : {}), scoringVersion: 2, ...(course === 'legacy' ? {} : { courseVersion: course === 'banks' ? 2 : course === 'plants' ? 3 : course === 'tricks' ? 4 : 5 }), completedLessons: level - 1, level, score: (level - 1) * 50,
      rounds: level - 1, perfect: 0, seed: 71431,
    }))
    if (fallback) {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
        if (type === 'webgl2') return null
        return original.call(this, type as '2d', ...args)
      } as typeof original
    }
  }, { level, fallback, course, character: DEFAULT_CHARACTER })
}

async function chooseFirstOption(page: Page, mode: 'finish' | 'stroke' = 'finish') {
  const ball = page.getByRole('button', { name: 'Select ball 1', exact: true })
  await expect(ball).toBeEnabled({ timeout: 45_000 })
  await ball.click()
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
  await expect(page.locator('.finish-option')).toHaveCount(3)
  await page.getByRole('button', { name: `Choose ${mode} A`, exact: true }).click()
}

async function expectCompactCourse(page: Page, maximumHeight: number, allChaptersVisible = false) {
  const chapters = page.getByRole('list', { name: 'Learning scenarios' })
  await expect.poll(() => chapters.evaluate((element, allVisible) => {
    const bounds = element.getBoundingClientRect()
    const items = Array.from(element.children) as HTMLElement[]
    const current = element.querySelector<HTMLElement>('[aria-current="step"]')!
    const currentBounds = current.getBoundingClientRect()
    return {
      singleRow: items.every(item => Math.abs(item.getBoundingClientRect().top - items[0].getBoundingClientRect().top) < 1),
      labelsFit: items.every(item => item.scrollWidth <= item.clientWidth),
      currentVisible: currentBounds.left >= bounds.left - 1 && currentBounds.right <= bounds.right + 1,
      documentFits: document.documentElement.scrollWidth <= innerWidth,
      allChaptersFit: !allVisible || element.scrollWidth <= element.clientWidth + 1,
    }
  }, allChaptersVisible)).toEqual({ singleRow: true, labelsFit: true, currentVisible: true, documentFits: true, allChaptersFit: true })
  await expect.poll(() => page.getByRole('region', { name: 'Course progression' }).evaluate(element => element.getBoundingClientRect().height))
    .toBeLessThanOrEqual(maximumHeight)
}

test('beginner training starts with one ball, a lesson and an empty course progress bar', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await seedLesson(page, 1)
  await page.goto('/')
  const briefing = page.getByRole('dialog', { name: 'Your first pot', exact: true })
  await expect(briefing).toContainText('LEVEL 01 / 100')
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
  await expect(progress).toHaveAttribute('aria-valuetext', '0 of 100 levels complete')
  const chapters = page.getByRole('list', { name: 'Learning scenarios' })
  await expect(chapters.getByRole('listitem')).toHaveCount(10)
  await expect(chapters.locator('small')).toHaveText([
    'Levels 1–10 · 0/10', 'Levels 11–20 · 0/10', 'Levels 21–30 · 0/10',
    'Levels 31–40 · 0/10', 'Levels 41–50 · 0/10', 'Levels 51–60 · 0/10', 'Levels 61–70 · 0/10', 'Levels 71–80 · 0/10', 'Levels 81–90 · 0/10', 'Levels 91–100 · 0/10',
  ])
  await expect(chapters.locator('[aria-current="step"]')).toContainText('First strokes')
  await expectCompactCourse(page, 120, true)
  await expect(page.getByRole('button', { name: 'Show earlier chapters' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show later chapters' })).toHaveCount(0)
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
  await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/, exact: true }).click()
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
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '20')
  const chapters = page.getByRole('list', { name: 'Learning scenarios' })
  await expect(chapters.locator('[aria-current="step"]')).toContainText('Play for position')
  await expect(chapters.locator('.chapter-done')).toHaveCount(2)
  await expect(chapters.locator('[aria-current="step"] small')).toHaveText('Levels 21–30 · 0/10')
  await expectCompactCourse(page, 145)
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
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expectIdealApproach(page, 'A')
  await page.getByRole('button', { name: 'Choose a stroke', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your stroke.', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Stroke options', exact: true }).getByRole('button')).toHaveCount(3)
  await expect(page.locator('.shot-progress [aria-current="step"]')).toHaveText(/Stroke/)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toBeDisabled()
  const readPuzzle = () => table.evaluate(element => {
    const puzzle = element.cloneNode(true) as SVGSVGElement
    puzzle.querySelector('[data-testid="ideal-approach"]')?.remove()
    return puzzle.outerHTML
  })
  const unchangedPuzzle = await readPuzzle()
  const beforePath = '/tmp/shot-selection-position-mobile-before-stroke.png'
  await page.locator('.table-panel').screenshot({ path: beforePath, animations: 'disabled' })
  await testInfo.attach('Mobile position puzzle before choosing a stroke', { path: beforePath, contentType: 'image/png' })
  for (const label of ['A', 'B', 'C'] as const) {
    const stroke = page.getByRole('button', { name: `Choose stroke ${label}`, exact: true })
    await stroke.click()
    await expect(stroke).toHaveAttribute('aria-pressed', 'true')
    await expectIdealApproach(page, label)
    expect(await readZone()).toEqual(fixedZone)
    expect(await readPuzzle(), 'Only the cue-ball approach may change before commitment').toBe(unchangedPuzzle)
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
  await expect(page.getByTestId('ideal-approach')).toHaveCount(0)
  await expect(legend).not.toContainText('Ideal path')
  await expect(page.getByTestId('nominal-cue-finish')).toBeVisible()
  await expect(legend).toContainText('Planned finish')
  await expect(page.locator('.analysis-rate')).toHaveCount(3)
  await expect(page.getByTestId('ensemble-paths')).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '21')
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
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '21 of 100 levels complete')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('WebGL position table previews the approach without revealing stroke outcomes', async ({ page }, testInfo) => {
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
  await expect(legend).toContainText('Ideal path · A')
  await expect(page.getByRole('img', { name: 'Ideal cue-ball path to ball 1, stroke A', exact: true })).toHaveCount(1)
  await expect(legend).not.toContainText('Planned finish')
  await expect(page.locator('.analysis-rate')).toHaveCount(0)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  // The instruction above the cloth changes after choosing a stroke. Hide that
  // overlapping status line only for the table-rendering comparison.
  const screenshotStyle = '.table-instruction { visibility: hidden !important; }'
  const beforePath = '/tmp/shot-selection-position-webgl-before-stroke.png'
  const before = await page.locator('.pool-table-scene').screenshot({ path: beforePath, animations: 'disabled', style: screenshotStyle })
  await testInfo.attach('WebGL position table before choosing a stroke', { path: beforePath, contentType: 'image/png' })
  // A is already previewed when the ball is selected. Selecting it explicitly
  // must not reveal its post-contact path or predicted finish.
  await page.getByRole('button', { name: 'Choose stroke A', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose stroke A', exact: true })).toHaveAttribute('aria-pressed', 'true')
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
  await page.getByRole('button', { name: 'Choose stroke B', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose stroke B', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('img', { name: 'Ideal cue-ball path to ball 1, stroke B', exact: true })).toHaveCount(1)
  await expect(page.getByRole('img', { name: 'Ideal cue-ball path to ball 1, stroke A', exact: true })).toHaveCount(0)
  await expect(legend).toContainText('Ideal path · B')
  const changedApproachPath = '/tmp/shot-selection-position-webgl-stroke-b.png'
  await page.locator('.table-panel').screenshot({ path: changedApproachPath, animations: 'disabled' })
  await testInfo.attach('WebGL position table with stroke B approach and hidden outcomes', { path: changedApproachPath, contentType: 'image/png' })
  await expect(legend).not.toContainText('Planned finish')
  await expect(page.locator('.analysis-rate')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a completed earlier course resumes at banks while retaining tournament credit', async ({ page }) => {
  await seedLesson(page, 61, true, 'legacy')
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('LEVEL 51 / 100')
  await expect(page.getByRole('dialog')).toContainText('Kick shots')
  await startLevel(page, 51)
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Kick shots')
  await expect(page.getByRole('region', { name: 'Course progression' })).toContainText('Your 10 completed tournament lessons are saved')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ courseVersion: 5, completedLessons: 50, level: 51,
    carriedTournamentLessons: 10, rounds: 60, score: 3000, perfect: 0, seed: 71431 })
  await page.reload()
  await expect(page.getByRole('dialog')).toContainText('LEVEL 51 / 100')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
})


test('a completed bank-era course resumes at plants and preserves earned tournament credit', async ({ page }) => {
  await seedLesson(page, 71, true, 'banks')
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('LEVEL 61 / 100')
  await expect(page.getByRole('dialog')).toContainText('Plants')
  await startLevel(page, 61)
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Plants')
  await expect(page.getByRole('region', { name: 'Course progression' })).toContainText('Your 10 completed tournament lessons are saved')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ courseVersion: 5, completedLessons: 60, level: 61,
    carriedTournamentLessons: 10, rounds: 70, score: 3500, perfect: 0, seed: 71431 })
  await page.reload()
  await expect(page.getByRole('dialog')).toContainText('LEVEL 61 / 100')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
})

test('a completed eighty-lesson course resumes at Trick shots with its score and progress intact', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedLesson(page, 81, true, 'plants')
  await page.goto('/')
  const briefing = page.getByRole('dialog')
  await expect(briefing).toContainText('LEVEL 81 / 100')
  await expect(briefing).toContainText('Trick shots')
  await expect(briefing).toContainText('LESSON 1 OF 10')
  await expect(briefing).toContainText('New scenario')
  await expect(briefing.getByRole('region', { name: 'Learning focus' })).toBeVisible()
  await expect(briefing.getByRole('complementary', { name: 'Teaching tip' })).toBeVisible()
  const path = '/tmp/shot-selection-trick-shots-briefing-mobile.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('First trick-shot briefing on mobile', { path, contentType: 'image/png' })
  await startLevel(page, 81)
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '80 of 100 levels complete')
  const chapters = page.getByRole('list', { name: 'Learning scenarios' })
  await expect(chapters.locator('.chapter-done')).toHaveCount(8)
  await expect(chapters.locator('[aria-current="step"]')).toContainText('Trick shots')
  await expect(chapters.locator('[aria-current="step"] small')).toHaveText('Levels 81–90 · 0/10')
  await expectCompactCourse(page, 145)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ courseVersion: 5, completedLessons: 80, level: 81,
    rounds: 80, score: 4000, perfect: 0, seed: 71431, character: DEFAULT_CHARACTER })
  await page.reload()
  await expect(page.getByRole('dialog')).toContainText('LEVEL 81 / 100')
  await expect(page.getByRole('dialog')).toContainText('Trick shots')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
})

test('finishing Tournament table advances into Trick shots instead of completing the course', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await seedLesson(page, 80)
  await page.goto('/')
  await startLevel(page, 80)
  await chooseFirstOption(page, 'stroke')
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  const awarded = Number.parseInt((await page.locator('.points-awarded strong').textContent())!, 10)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toMatchObject({
    completedLessons: 80, rounds: 80, level: 81, score: 3950 + awarded,
  })
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '80')
  await expect(page.getByRole('button', { name: 'View course summary', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('LEVEL 81 / 100')
  await expect(page.getByRole('dialog')).toContainText('Trick shots')
  await startLevel(page, 81)
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Trick shots')
  await expect(page.getByRole('region', { name: 'Course complete', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 45_000 })
  await chooseFirstOption(page, 'stroke')
  await expectIdealApproach(page, 'A')
  await expect(page.getByRole('group', { name: 'Stroke options', exact: true }).getByRole('button')).toHaveCount(3)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await expect(page.getByTestId('nominal-cue-finish')).toHaveCount(0)
  await expect(page.getByLabel('Table legend', { exact: true })).not.toContainText('Desired finish')
  await expect(page.locator('.selected-ball-summary')).not.toContainText('Plant')
  const choicesPath = '/tmp/shot-selection-first-trick-choices.png'
  await page.screenshot({ path: choicesPath, fullPage: true })
  await testInfo.attach('First trick-shot choices', { path: choicesPath, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.analysis-card')).toHaveCount(3)
  await expect(page.locator('.analysis-metrics').first()).toContainText('All pots')
  await expect(page.locator('.analysis-metrics').first()).toContainText('Legal trick')
  await expect(page.getByTestId('nominal-cue-finish')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Planned stroke outcome' })).toBeVisible()
  await expect(page.locator('.ensemble-explanation')).toContainText('every required pot')
  await expect(page.getByRole('button', { name: 'Legal trick', exact: true })).toBeVisible()
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, { timeout: 10_000 })
  const resultPath = '/tmp/shot-selection-first-trick-result.png'
  await page.screenshot({ path: resultPath, fullPage: true })
  await testInfo.attach('First trick-shot result', { path: resultPath, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Play the best shot', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Shot in motion…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Play the best shot', exact: true })).toBeEnabled({ timeout: 30_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a multi-pot trick shows its full goal and keeps WebGL stroke finishes hidden until commitment', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await seedLesson(page, 82, false)
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('Trick shots')
  await startLevel(page, 82)
  await chooseFirstOption(page, 'stroke')
  const prepared = await page.evaluate(() => (window as Window & { idealApproachPrepared: PreparedRound }).idealApproachPrepared)
  const trick = prepared.scenario.trick!
  expect(trick.requiredPots.length).toBeGreaterThan(1)
  await expect(page.locator('.selected-ball-summary')).toContainText(`Hit ${trick.ballId} first · Pot ${trick.requiredPots.join(' + ')}`)
  await expect(page.locator('.pool-table-scene canvas')).toBeVisible()
  await expect(page.locator('.pool-table-scene')).toHaveAccessibleName(`Pool table. ${trick.description}`)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
  await expect(page.getByLabel('Table legend', { exact: true })).not.toContainText('Planned finish')
  await expect(page.getByLabel('Table legend', { exact: true })).not.toContainText('Position zone')
  await expect(page.getByLabel('Table legend', { exact: true })).not.toContainText('Desired finish')
  const path = '/tmp/shot-selection-trick-shot-webgl-stroke.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Multi-pot trick stroke choices in WebGL', { path, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByLabel('Table legend', { exact: true })).toContainText('Planned finish')
  await expect(page.locator('.analysis-metrics').first()).toContainText('All pots')
  await expect(page.locator('.analysis-metrics').first()).toContainText('Legal trick')
  await page.getByRole('button', { name: 'Explain my shot', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('table')).toContainText('Legal trick')
  await expect(page.getByRole('dialog')).not.toContainText('Plant')
})

test('a completed trick-shot save opens Broken table on mobile with scores intact', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedLesson(page, 91, true, 'tricks')
  await page.goto('/')
  const briefing = page.getByRole('dialog')
  await expect(briefing).toContainText('Broken table')
  await expect(briefing).toContainText('LEVEL 91 / 100')
  await expect(briefing.getByRole('region', { name: 'Table defects' })).toContainText('Slow cloth')
  await startLevel(page, 91)
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '90 of 100 levels complete')
  const chapters = page.getByRole('list', { name: 'Learning scenarios' })
  const current = chapters.locator('[aria-current="step"]')
  await expect(current).toContainText('Broken table')
  await expect(current.locator('small')).toHaveText('Levels 91–100 · 0/10')
  await expectCompactCourse(page, 145)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ courseVersion: 5, level: 91, completedLessons: 90, rounds: 90, score: 4500 })
  const earlier = page.getByRole('button', { name: 'Show earlier chapters', exact: true })
  const later = page.getByRole('button', { name: 'Show later chapters', exact: true })
  const scrollPosition = () => chapters.evaluate(element => element.scrollLeft)
  await expect(earlier).toBeEnabled()
  await expect(later).toBeDisabled()
  for (let clicks = 0; clicks < 10 && await scrollPosition() > 1; clicks++) {
    const previous = await scrollPosition()
    await earlier.click()
    await expect.poll(scrollPosition).toBeLessThan(previous)
  }
  await expect(earlier).toBeDisabled()
  await expect.poll(() => chapters.getByRole('listitem').first().evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const strip = element.parentElement!.getBoundingClientRect()
    return bounds.left >= strip.left - 1 && bounds.right <= strip.right + 1
  })).toBe(true)
  await expect(current).toContainText('Broken table')
  for (let clicks = 0; clicks < 10 && await chapters.evaluate(element => element.scrollLeft + element.clientWidth < element.scrollWidth - 1); clicks++) {
    const previous = await scrollPosition()
    await later.click()
    await expect.poll(scrollPosition).toBeGreaterThan(previous)
  }
  await expect(later).toBeDisabled()
  await expectCompactCourse(page, 145)
  await chapters.focus()
  await page.keyboard.press('Home')
  await expect.poll(scrollPosition).toBe(0)
  await expect(earlier).toBeDisabled()
  await page.keyboard.press('ArrowRight')
  await expect.poll(scrollPosition).toBeGreaterThan(0)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(scrollPosition).toBe(0)
  await page.keyboard.press('End')
  await expect(later).toBeDisabled()
  await expectCompactCourse(page, 145)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
  await page.setViewportSize({ width: 1024, height: 900 })
  await expectCompactCourse(page, 120)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expectCompactCourse(page, 120, true)
  await expect(earlier).toHaveCount(0)
  await expect(later).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expectCompactCourse(page, 145)
  await chooseFirstOption(page)
  await expect(page.locator('.table-condition-summary')).toContainText('Slow cloth')
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(3)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const path = '/tmp/shot-selection-broken-table-mobile.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Broken table on mobile', { path, contentType: 'image/png' })
})

test('the final boss renders its combined faults in WebGL and explains every defect', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await seedLesson(page, 100, false)
  await page.goto('/')
  const defects = page.getByRole('dialog').getByRole('region', { name: 'Table defects' })
  await expect(defects).toContainText('THE FINAL BOSS')
  await expect(defects.locator('li')).toHaveCount(6)
  await startLevel(page, 100)
  await chooseFirstOption(page)
  await expect(page.locator('.pool-table-scene canvas')).toBeVisible()
  await expect(page.locator('.table-condition-summary')).toContainText('6 defects')
  await page.locator('.table-condition-summary > summary').click()
  await expect(page.locator('.table-condition-popover')).toBeVisible()
  await expect(page.locator('.table-condition-popover')).toContainText('Dirty balls')
  await expect(page.locator('.table-condition-popover')).toContainText('requested speed')
  await page.locator('.table-condition-summary > summary').click()
  const path = '/tmp/shot-selection-broken-table-boss-webgl.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Broken table final boss in WebGL', { path, contentType: 'image/png' })
})

test('the final lesson reaches 100% and reloads its summary without scoring twice', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await seedLesson(page, 100)
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('Final boss')
  await expect(page.getByRole('dialog')).toContainText('LESSON 10 OF 10')
  await startLevel(page, 100)
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '99')
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('[aria-current="step"]')).toContainText('Broken table')
  await chooseFirstOption(page)
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  const awarded = Number.parseInt((await page.locator('.points-awarded strong').textContent())!, 10)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))
  expect(saved).toMatchObject({ completedLessons: 100, rounds: 100, level: 101, score: 4950 + awarded })
  expect(saved.history).toEqual([expect.objectContaining({ level: 100, points: awarded })])
  expect(saved.history[0].evidence).toMatchObject({ selected: expect.any(Object), best: expect.any(Object) })
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByRole('button', { name: 'Next level', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'View course summary', exact: true }).click()
  const summary = page.getByRole('region', { name: 'Course complete', exact: true })
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('100 / 100 LEVELS COMPLETE')
  await expect(summary).toContainText('ten trick shots')
  await expect(page.getByRole('list', { name: 'Learning scenarios' }).locator('.chapter-done')).toHaveCount(10)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const completionHeading = summary.getByRole('heading', { name: 'Even the broken table couldn’t stop you.', exact: true })
  await expect(completionHeading).toBeFocused()
  const path = '/tmp/shot-selection-course-complete.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Completed course summary', { path, contentType: 'image/png' })
  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await expect(summary).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(completionHeading).toBeFocused()
    await expect(page.locator('.simulation-overlay')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toHaveCount(0)
    await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '100 of 100 levels complete')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toEqual(saved)
  }
  await page.getByRole('button', { name: 'Start a new course', exact: true }).click()
  await chooseDefaultCharacter(page)
  await expect(page.getByRole('dialog', { name: 'Your first pot', exact: true })).toContainText('New scenario')
  await startLevel(page, 1)
  await expect(page.getByRole('progressbar', { name: 'Game completion' })).toHaveAttribute('aria-valuetext', '0 of 100 levels complete')
})

test('reviewing a briefing preserves the selected ball and finish', async ({ page }) => {
  await seedLesson(page, 11)
  await page.goto('/')
  await startLevel(page, 11)
  await chooseFirstOption(page)
  await expectIdealApproach(page, 'A')
  await page.getByRole('button', { name: 'Review level briefing', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Two balls, one decision', exact: true })).toContainText('New scenario')
  await page.getByRole('dialog').getByRole('button', { name: 'Back to the table', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review level briefing', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Choose finish A', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Lock in your shot', exact: true })).toBeEnabled()
  await expectIdealApproach(page, 'A')
  await page.getByRole('button', { name: 'Back to balls', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expectIdealApproach(page, 'A')
  await page.getByRole('button', { name: 'Table ball 2', exact: true }).click()
  await expectIdealApproach(page, 'A', 2)
  await expect(page.getByRole('button', { name: /^Table finish [ABC]$/ })).toHaveCount(0)
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
