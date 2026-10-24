import { expect, test, type Page } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'
async function open(page: Page, level: number) {
  await page.setViewportSize(level === 17 ? { width: 1440, height: 1050 } : { width: 390, height: 844 })
  await page.addInitScript(({ level, character }) => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: level - 1, level, score: 0, rounds: level - 1, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null
      return original.call(this, type as '2d', ...args)
    } as typeof original
  }, { level, character: DEFAULT_CHARACTER })
  await page.goto('/')
  await startLevel(page, level)
}
async function score(page: Page) {
  await page.getByRole('button', { name: 'Choose a finish', exact: true }).click()
  await page.getByRole('button', { name: 'Choose finish A', exact: true }).click()
  await page.getByRole('button', { name: 'Lock in your shot', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Next level', exact: true })).toBeVisible({timeout:30000})
}
async function advance(page: Page, level: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('.perfect-celebration')).toHaveCount(0, {timeout:10000})
  await page.locator('.shot-panel').screenshot({path:`/tmp/everyday-lesson-${level}.png`})
  await page.getByRole('button', { name: 'Next level', exact: true }).click()
  await expect(page.getByRole('button', { name: `Start level ${level+1}`, exact: true })).toBeVisible()
}
for (const level of [15,17,18]) test(`level ${level} offers a measured optional experiment and retry`, async ({page}) => {
  await open(page,level)
  const experiment = page.getByRole('region',{name:'Lesson experiment'})
  const predictions = experiment.getByRole('group',{name:'Experiment prediction'}).getByRole('button')
  await predictions.first().click()
  await experiment.getByRole('button',{name:'Reveal comparison',exact:true}).click()
  await expect(experiment.getByRole('img')).toHaveCount(level===18?3:2)
  await expect(experiment).toContainText('Look again at the measured paths and speeds.')
  await experiment.getByRole('button',{name:'Try the prediction again'}).click()
  await expect(experiment.getByRole('img')).toHaveCount(0)
  await predictions.nth(1).click()
  await page.getByRole('button',{name:'Select ball 1',exact:true}).click()
  await score(page)
  await expect(experiment).toContainText('Your prediction matches the simulation.')
  await expect(predictions.nth(1)).toHaveAttribute('aria-pressed','true')
  await experiment.getByRole('img').last().scrollIntoViewIfNeeded()
  await advance(page,level)
})
test('level 19 requires two shortlisted balls and compares all six strokes before choosing',async({page})=>{
  await open(page,19)
  const shortlist=page.getByRole('group',{name:'Two-ball shortlist'})
  await shortlist.getByRole('button',{name:'Ball 1',exact:true}).click()
  await expect(page.getByRole('button',{name:'Use ball 1',exact:true})).toBeDisabled()
  await shortlist.getByRole('button',{name:'Ball 2',exact:true}).click()
  await expect(shortlist.getByRole('button',{name:'Ball 3',exact:true})).toBeDisabled()
  await expect(page.getByRole('region',{name:'Shortlisted ball 1'}).getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('region',{name:'Shortlisted ball 2'}).getByRole('listitem')).toHaveCount(3)
  await page.getByRole('button',{name:'Use ball 1',exact:true}).click()
  await shortlist.getByRole('button',{name:'Ball 1',exact:true}).click()
  await expect(page.getByRole('button',{name:'Choose a finish',exact:true})).toBeDisabled()
  await shortlist.getByRole('button',{name:'Ball 3',exact:true}).click()
  await page.getByRole('button',{name:'Use ball 3',exact:true}).click()
  await page.locator('.shot-panel').screenshot({path:'/tmp/shortlist-selection.png'})
  await score(page)
  await expect(page.getByLabel('Your shortlist')).toContainText('balls 2 and 3. Opener: ball 3.')
  await advance(page,19)
})
test('level 20 explains paired near-tie evidence with a retry',async({page})=>{
  await open(page,20)
  await page.getByRole('button',{name:'Select ball 1',exact:true}).click()
  await score(page)
  const comparison=page.getByRole('region',{name:'Near-tie comparison'})
  await comparison.getByRole('button',{name:'Evidence of a difference',exact:true}).click()
  await expect(comparison).toContainText('Check the matched outcomes again.')
  await comparison.getByRole('button',{name:'Try the judgment again'}).click()
  await comparison.getByRole('button',{name:'Too little evidence',exact:true}).click()
  await expect(comparison).toContainText('That matches the paired evidence.')
  await expect(comparison).toContainText('does not prove the strokes have identical chances')
  await comparison.scrollIntoViewIfNeeded()
  await advance(page,20)
})
