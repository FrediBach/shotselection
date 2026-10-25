import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { PREMADE_CHARACTERS } from '../src/engine/characters'
import type { LevelDefinition } from '../src/engine/level-config'
import type { LabRequest } from '../src/engine/lab'

const firstLevel = JSON.parse(readFileSync(new URL('../src/levels/001-your-first-pot.json', import.meta.url), 'utf8')) as LevelDefinition

type ObservedWindow = Window & { authoringRequests: { method: string; request?: LabRequest }[] }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    const originalContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return originalContext.call(this, type as '2d', ...args)
    } as typeof originalContext
    const requests: { method: string; request?: LabRequest }[] = []
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      postMessage(message: { method: string; request?: LabRequest }, options?: Transferable[] | StructuredSerializeOptions) {
        requests.push(message)
        super.postMessage(message, options as Transferable[])
      }
    }
    Object.assign(window, { Worker: ObservedWorker, authoringRequests: requests })
  })
})

async function openSandbox(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sandbox mode', exact: true }).click()
  await page.getByRole('button', { name: `Choose ${PREMADE_CHARACTERS[1].name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).click()
}

async function importDocument(page: Page, document: LevelDefinition) {
  await page.getByLabel('Import level JSON file', { exact: true }).setInputFiles({
    name: `${document.id}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)),
  })
  await expect(page.getByText('JSON loaded. The saved layout and strokes are ready to edit.', { exact: true })).toBeVisible()
}

async function exportDocument(page: Page): Promise<LevelDefinition> {
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/\.json$/)
  return JSON.parse(await readFile((await download.path())!, 'utf8')) as LevelDefinition
}

function labDocument(): LevelDefinition {
  return {
    schemaVersion: 1, id: 'precise-lab-draft', kind: 'draft', variation: { mirrorX: true, mirrorY: true },
    scenario: {
      level: 1, seed: 321, title: 'A saved lab experiment', description: 'Preserve exact strokes, including misses.',
      balls: [{ id: 0, position: { x: 1.27, y: .95 } }, { id: 1, position: { x: 1.27, y: .38 } }],
      authoredShots: [.845671234, 1.3123456, 2.1234567].map((speed, index) => ({
        id: `saved-stroke-${index}`, label: `Precise option ${index + 1}`,
        settings: { ballId: 1, pocketId: 1, speed, topSpin: .123456789, sideSpin: 2.3456789, aimOffset: -.123456789 },
        target: { x: 1.254321, y: .654321 },
      })),
    },
    lab: {
      samples: 32, talents: { anglePrecision: 21, englishPrecision: 34, strengthPrecision: 55, spinPrecision: 89 },
      assistance: Object.fromEntries([0, 1, 2].map(index => [`saved-stroke-${index}`, { enabled: true, locks: { speed: true, ballId: true, topSpin: false } }])),
    },
  }
}

test('sandbox edits export complete JSON, import fixed positions, and reject invalid input without replacing the draft', async ({ page }) => {
  await openSandbox(page)
  const document = structuredClone(firstLevel) as LevelDefinition
  document.scenario.title = 'My tuned lesson'
  document.variation = { mirrorX: true, mirrorY: true }
  await importDocument(page, document)
  await expect(page.getByRole('button', { name: /^Place the balls myself/ })).toHaveAttribute('aria-pressed', 'true')
  const x = page.getByRole('spinbutton', { name: 'X cm', exact: true })
  await expect(x).toHaveValue('112')
  await x.fill('103.25')
  await x.blur()
  await page.screenshot({ path: '/private/tmp/shotselection-authoring-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Edit level JSON', exact: true }).click()
  await page.screenshot({ path: '/private/tmp/shotselection-authoring-json-dialog.png', fullPage: true })
  const editor = page.getByRole('textbox', { name: 'Level JSON', exact: true })
  const edited = JSON.parse(await editor.inputValue()) as LevelDefinition
  edited.scenario.curriculum!.takeaway = 'A deliberately adjusted takeaway.'
  edited.scenario.scoring!.tolerance = .23456
  await editor.fill(JSON.stringify(edited, null, 2))
  await page.getByRole('button', { name: 'Apply JSON', exact: true }).click()
  const exported = await exportDocument(page)
  expect(exported.scenario.title).toBe('My tuned lesson')
  expect(exported.scenario.balls[0].position).toEqual({ x: 1.0325, y: .82 })
  expect(exported.scenario.curriculum!.takeaway).toBe('A deliberately adjusted takeaway.')
  expect(exported.scenario.scoring!.tolerance).toBe(.23456)
  expect(exported.variation).toEqual({ mirrorX: false, mirrorY: false })
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  await page.getByRole('button', { name: 'Scenario mode', exact: true }).click()
  expect((await exportDocument(page)).scenario).toEqual(exported.scenario)
  await page.getByLabel('Import level JSON file', { exact: true }).setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{bad JSON') })
  await expect(page.getByRole('alert')).toContainText('not valid JSON')
  expect((await exportDocument(page)).scenario).toEqual(exported.scenario)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/private/tmp/shotselection-authoring-mobile.png', fullPage: true })
})

test('lab roundtrip preserves exact controls, locks, player precision, and mode drafts without auto-fitting', async ({ page }) => {
  test.setTimeout(90_000)
  await openSandbox(page)
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  const document = labDocument()
  await importDocument(page, document)
  const fitCount = await page.evaluate(() => (window as ObservedWindow).authoringRequests.filter(request => request.method === 'lab-auto').length)
  await expect(page.getByRole('checkbox', { name: 'Auto-adapt option 1', exact: true })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Unlock Strength (m/s)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Saved player precision', { exact: true })).toBeVisible()
  const exported = await exportDocument(page)
  expect(exported.scenario.balls).toEqual(document.scenario.balls)
  expect(exported.scenario.authoredShots).toEqual(document.scenario.authoredShots)
  expect(exported.lab).toEqual(document.lab)
  await page.getByRole('button', { name: 'Scenario mode', exact: true }).click()
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  expect((await exportDocument(page)).scenario.authoredShots).toEqual(document.scenario.authoredShots)
  await page.getByRole('button', { name: 'Run ensembles', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Run ensembles', exact: true })).toBeEnabled({ timeout: 45_000 })
  const requests = await page.evaluate(() => (window as ObservedWindow).authoringRequests)
  expect(requests.filter(request => request.method === 'lab-auto')).toHaveLength(fitCount)
  expect(requests.findLast(request => request.method === 'lab')?.request?.variants).toEqual(document.scenario.authoredShots)
  expect(requests.findLast(request => request.method === 'lab')?.request?.talents).toEqual(document.lab!.talents)
  await importDocument(page, exported)
  expect((await exportDocument(page)).scenario.authoredShots).toEqual(document.scenario.authoredShots)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Saved player precision', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Use ${PREMADE_CHARACTERS[1].name}’s precision`, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/private/tmp/shotselection-authoring-lab-mobile.png', fullPage: true })
})

test('lab drafts combine with a lesson and can return to the lab with authored strokes intact', async ({ page }) => {
  await openSandbox(page)
  const lesson = structuredClone(firstLevel) as LevelDefinition
  lesson.scenario.title = 'Keep the teaching text'
  await importDocument(page, lesson)
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  const draft = labDocument()
  await importDocument(page, draft)
  await page.getByRole('button', { name: 'Use in scenario', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toBeVisible()
  const combined = await exportDocument(page)
  expect(combined.kind).toBe('level')
  expect(combined.scenario.title).toBe(lesson.scenario.title)
  expect(combined.scenario.curriculum).toEqual(lesson.scenario.curriculum)
  expect(combined.scenario.balls).toEqual(draft.scenario.balls)
  expect(combined.scenario.authoredShots).toEqual(draft.scenario.authoredShots)
  await page.getByRole('button', { name: 'Develop in lab', exact: true }).click()
  expect((await exportDocument(page)).scenario).toEqual(combined.scenario)
  await page.screenshot({ path: '/private/tmp/shotselection-authoring-lab.png', fullPage: true })
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('A refined stroke')
  await page.getByRole('button', { name: 'Use in scenario', exact: true }).click()
  expect((await exportDocument(page)).scenario.authoredShots![0].label).toBe('A refined stroke')
})

test('indirect strokes keep their pot ball and finish target through variations and morphs', async ({ page }) => {
  await openSandbox(page)
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  const document = labDocument()
  document.scenario.balls.push({ id: 2, position: { x: 2, y: .65 } })
  document.scenario.authoredShots!.forEach(shot => { shot.potBallId = 2 })
  await importDocument(page, document)
  await expect(page.getByRole('checkbox', { name: 'Auto-adapt option 1', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Find playable shot', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Vary stroke', exact: true }).click()
  await page.getByRole('button', { name: 'Replace options with variations', exact: true }).click()
  const varied = await exportDocument(page)
  expect(varied.scenario.authoredShots).toHaveLength(9)
  for (const shot of varied.scenario.authoredShots!) {
    expect(shot.potBallId).toBe(2)
    expect(shot.target).toEqual(document.scenario.authoredShots![0].target)
  }
  await page.getByRole('button', { name: 'Morph between two strokes', exact: true }).click()
  await page.getByRole('button', { name: 'Use first and last options', exact: true }).click()
  await page.getByRole('button', { name: 'Replace options with steps', exact: true }).click()
  const morphed = await exportDocument(page)
  expect(morphed.scenario.authoredShots).toHaveLength(5)
  for (const shot of morphed.scenario.authoredShots!) {
    expect(shot.potBallId).toBe(2)
    expect(shot.target).toEqual(document.scenario.authoredShots![0].target)
  }
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  await page.getByRole('combobox', { name: 'Object balls', exact: true }).selectOption('1')
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('before removing the ball')
  await expect(page.getByRole('combobox', { name: 'Object balls', exact: true })).toHaveValue('2')
})

test('playing imported authored strokes uses the JSON scoring zone and preserves deliberate misses', async ({ page }) => {
  test.setTimeout(90_000)
  await openSandbox(page)
  const document = structuredClone(firstLevel) as LevelDefinition
  document.scenario.balls = labDocument().scenario.balls
  document.scenario.authoredShots = labDocument().scenario.authoredShots
  document.scenario.authoredShots![0].settings.aimOffset = 90
  document.scenario.scoring = { position: true, tolerance: .23456 }
  for (const position of [true, false]) {
    document.scenario.scoring.position = position
    await importDocument(page, document)
    await page.getByRole('button', { name: 'Test layout', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toBeEnabled({ timeout: 45_000 })
    await expect(page.locator('.sandbox-layout-status')).not.toContainText('found playable shots')
    await page.getByRole('button', { name: 'Play this layout', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Start sandbox round', exact: true }).click()
    await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
    await page.getByRole('button', { name: /^Choose a (?:finish|stroke)$/ }).click()
    await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
    if (position) expect(Number(await page.getByLabel('Scoring finish zone', { exact: true }).locator('circle').getAttribute('r'))).toBeCloseTo(23.456, 5)
    else await expect(page.getByLabel('Scoring finish zone', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Change setup', exact: true }).click()
  }
})

test('unfinished course layouts export as drafts and retain their teaching text through the lab', async ({ page }) => {
  await openSandbox(page)
  const document = structuredClone(firstLevel) as LevelDefinition
  document.scenario.title = 'Unfinished custom lesson'
  await importDocument(page, document)
  await page.getByRole('spinbutton', { name: 'X cm', exact: true }).fill('127')
  await page.getByRole('spinbutton', { name: 'Y cm', exact: true }).fill('32')
  await expect(page.getByRole('button', { name: 'Test layout', exact: true })).toBeDisabled()
  const draft = await exportDocument(page)
  expect(draft.kind).toBe('draft')
  expect(draft.scenario.balls[0].position).toEqual(draft.scenario.balls[1].position)
  expect(draft.scenario.curriculum).toEqual(document.scenario.curriculum)
  await page.getByRole('button', { name: 'Edit level JSON', exact: true }).click()
  expect(JSON.parse(await page.getByRole('textbox', { name: 'Level JSON', exact: true }).inputValue()).kind).toBe('draft')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Develop in lab', exact: true }).click()
  expect((await exportDocument(page)).kind).toBe('draft')
  await page.getByRole('button', { name: 'Scenario mode', exact: true }).click()
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('2')
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  await page.getByRole('button', { name: 'Use in scenario', exact: true }).click()
  const restored = await exportDocument(page)
  expect(restored.scenario.title).toBe(document.scenario.title)
  expect(restored.scenario.curriculum).toEqual(document.scenario.curriculum)
  expect(restored.scenario.balls).toEqual(draft.scenario.balls)
})

test('partial lab work preserves lesson conditions and clears a zone derived for the previous layout', async ({ page }) => {
  test.setTimeout(90_000)
  await openSandbox(page)
  await page.getByRole('button', { name: /^Place the balls myself/ }).click()
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('91')
  const original = await exportDocument(page)
  expect(original.scenario.conditions).toBeDefined()
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  await importDocument(page, labDocument())
  await page.getByRole('button', { name: 'Use in scenario', exact: true }).click()
  expect((await exportDocument(page)).scenario.conditions).toEqual(original.scenario.conditions)

  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('21')
  await page.getByRole('button', { name: 'Test layout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play this layout', exact: true })).toBeEnabled({ timeout: 45_000 })
  expect((await exportDocument(page)).scenario.objective?.target).toBeDefined()
  const draft = labDocument()
  draft.scenario.balls.push({ id: 2, position: { x: 1.9, y: .9 } })
  await page.getByRole('button', { name: 'Lab mode', exact: true }).click()
  await importDocument(page, draft)
  await page.getByRole('button', { name: 'Use in scenario', exact: true }).click()
  const merged = await exportDocument(page)
  expect(merged.scenario.objective).toBeDefined()
  expect(merged.scenario.objective?.target).toBeUndefined()
  expect(merged.scenario.objective?.regions).toBeUndefined()
})
