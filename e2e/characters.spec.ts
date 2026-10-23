import { expect, test } from '@playwright/test'
import { PREMADE_CHARACTERS, TALENT_DEFINITIONS } from '../src/engine/characters'
import type { CharacterTalents, PlayerCharacter } from '../src/engine/types'
import { startLevel } from './helpers'

type ObservedWindow = Window & { characterRequests: { method?: string; options?: { talents?: CharacterTalents } }[] }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    // A saved but unstarted older session must still offer player selection.
    if (!localStorage.getItem('shot-selection-session')) localStorage.setItem('shot-selection-session', JSON.stringify({
      scoringVersion: 2, courseVersion: 3, completedLessons: 0,
      level: 1, score: 0, rounds: 0, perfect: 0, seed: 71431,
    }))
    const originalContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return originalContext.call(this, type as '2d', ...args)
    } as typeof originalContext
    const requests: ObservedWindow['characterRequests'] = []
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      postMessage(message: ObservedWindow['characterRequests'][number], options?: Transferable[] | StructuredSerializeOptions) {
        requests.push(message)
        super.postMessage(message, options as Transferable[])
      }
    }
    Object.assign(window, { Worker: ObservedWorker, characterRequests: requests })
  })
})

test('a playthrough starts with a keyboard-accessible preset and remembers its talents', async ({ page }, testInfo) => {
  await page.goto('/')
  const heading = page.getByRole('heading', { name: 'Choose your player.', exact: true })
  await expect(heading).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => (window as ObservedWindow).characterRequests)).toEqual([])
  for (const preset of PREMADE_CHARACTERS) {
    const button = page.getByRole('button', { name: `Choose ${preset.name}`, exact: true })
    await button.focus()
    await page.keyboard.press('Space')
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  }
  const chosen = PREMADE_CHARACTERS[1]
  await page.getByRole('button', { name: `Choose ${chosen.name}`, exact: true }).click()
  const path = '/tmp/shot-selection-character-desktop.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Choose a player on desktop', { path, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Start playthrough', exact: true }).click()
  await startLevel(page, 1)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).character)).toEqual(chosen)
  await page.getByRole('button', { name: 'View player talents', exact: true }).click()
  const player = page.getByRole('dialog', { name: 'Your player.', exact: true })
  await expect(player).toContainText(chosen.name)
  for (const talent of TALENT_DEFINITIONS) await expect(player).toContainText(talent.label)
  await expect(player.getByRole('slider')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'View player talents', exact: true })).toBeFocused()
  await page.reload()
  await startLevel(page, 1)
  await expect(heading).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).character)).toEqual(chosen)
})

test('custom slider talents drive the ensemble and survive progress until a new playthrough', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 360, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: /^Create a custom player/ }).click()
  await page.getByRole('textbox', { name: 'Player name', exact: true }).fill('Robin Cue')
  const talents: CharacterTalents = { anglePrecision: 100, englishPrecision: 0, strengthPrecision: 51, spinPrecision: 49 }
  for (const { key, label } of TALENT_DEFINITIONS) {
    const slider = page.getByRole('slider', { name: label, exact: true })
    await expect(slider).toHaveAttribute('min', '0')
    await expect(slider).toHaveAttribute('max', '100')
    await slider.focus()
    await page.keyboard.press(key === 'anglePrecision' ? 'End' : key === 'englishPrecision' ? 'Home' : key === 'strengthPrecision' ? 'ArrowRight' : 'ArrowLeft')
    await expect(slider).toHaveValue(String(talents[key]))
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const path = '/tmp/shot-selection-custom-character-mobile.png'
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach('Custom player sliders on mobile', { path, contentType: 'image/png' })
  await page.getByRole('button', { name: 'Choose Mina Park', exact: true }).click()
  await page.getByRole('button', { name: /^Create a custom player/ }).click()
  await expect(page.getByRole('textbox', { name: 'Player name', exact: true })).toHaveValue('Robin Cue')
  for (const { key, label } of TALENT_DEFINITIONS) {
    await expect(page.getByRole('slider', { name: label, exact: true })).toHaveValue(String(talents[key]))
  }
  const character: PlayerCharacter = { id: 'custom', name: 'Robin Cue', talents }
  await page.getByRole('button', { name: 'Start playthrough', exact: true }).click()
  await startLevel(page, 1)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).character)).toEqual(character)
  await page.reload()
  await startLevel(page, 1)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).character)).toEqual(character)
  await expect(page.getByRole('button', { name: 'Select ball 1', exact: true })).toBeEnabled({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Select ball 1', exact: true }).click()
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible({ timeout: 45_000 })
  expect(await page.evaluate(() => (window as ObservedWindow).characterRequests.find(request => request.method === 'analyze')?.options?.talents)).toEqual(talents)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toMatchObject({ character, rounds: 1, level: 2 })
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await startLevel(page, 2)
  await page.reload()
  await startLevel(page, 2)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).character)).toEqual(character)
  await page.getByRole('button', { name: 'Restart session', exact: true }).click()
  await page.getByRole('button', { name: 'Start fresh', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your player.', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!))).toMatchObject({ character: null, rounds: 0, level: 1, score: 0 })
  const nextCharacter = PREMADE_CHARACTERS[3]
  await page.getByRole('button', { name: `Choose ${nextCharacter.name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Start playthrough', exact: true }).click()
  await startLevel(page, 1)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shot-selection-session')!).character)).toEqual(nextCharacter)
  expect(errors).toEqual([])
})
