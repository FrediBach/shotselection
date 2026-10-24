import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`avoid the second bank kiss on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 87, level: 88, score: 0, rounds: 87, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p=prepareRound(generateScenario(88,88*919)),data=p.doubleKiss!
  await page.goto('/');await startLevel(page,88)
  await page.getByRole('button',{name:'Select ball 1',exact:true}).click()
  await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
  const panel=page.getByRole('region',{name:'Second kiss comparison',exact:true})
  await expect(panel.getByRole('img')).toHaveCount(0)
  if(mobile)await panel.getByRole('button',{name:'Follow',exact:true}).click()
  await page.getByRole('button',{name:'Choose stroke A',exact:true}).click()
  await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('The center-ball practice pots',{timeout:30000})
  await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
  for(const b of await panel.getByRole('group',{name:'Second kiss prediction',exact:true}).getByRole('button').all())await expect(b).toBeDisabled()
  for(const [i,v] of data.variants.entries()){
    await panel.getByRole('button',{name:i?'Follow practice':'Center-ball practice',exact:true}).click()
    await expect(panel.getByRole('button',{name:'Cushion rebound',exact:true})).toHaveAttribute('aria-pressed','true')
    for(const [phase,label] of ['Cushion rebound','Return encounter','Settled paths'].entries()){
      await panel.getByRole('button',{name:label,exact:true}).click()
      const encounter=v.kiss??v.closest,balls=phase===0?v.rebound.balls:phase===1?encounter.balls!:v.simulation.finalBalls
      for(const ball of balls){
        const g=panel.getByTestId(`practice-ball-${ball.id}`)
        if(ball.pocketed){await expect(g).toHaveCount(0);continue}
        const circle=g.locator('circle').first()
        expect(Number(await circle.getAttribute('cx'))).toBeCloseTo(ball.position.x,9)
        expect(Number(await circle.getAttribute('cy'))).toBeCloseTo(ball.position.y,9)
        await expect(g.locator('circle')).toHaveCount(phase===1&&v.kiss?2:1)
      }
      if(phase===1){
        const view=(await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number)
        expect(view.slice(2)).toEqual([.7,.5])
        expect(view[0]).toBeCloseTo(encounter.balls!.find(b=>b.id===0)!.position.x-.35,9)
        await expect(panel.getByTestId('kiss-practice-timing')).toContainText(`${encounter.time.toFixed(3)} s`)
        if(v.kiss)await expect(panel.getByTestId('kiss-practice-timing')).toContainText(`${(v.kiss.time-v.rebound.time).toFixed(3)} s after the cushion`)
        else await expect(panel.getByTestId('kiss-practice-timing')).toContainText(`${(v.closest.separation*100).toFixed(1)} cm`)
        await panel.getByRole('img').scrollIntoViewIfNeeded()
        await page.locator('.shot-panel').screenshot({path:`/tmp/double-kiss-${i}-${mobile?'mobile':'desktop'}.png`})
      }
      if(phase===2){
        for(const [name,path] of [['cue',v.simulation.cuePath],['object',v.simulation.objectPath]] as const){
          const points=(await panel.getByTestId(`practice-${name}-path`).getAttribute('points'))!.split(' ').map(pair=>pair.split(',').map(Number))
          expect(points).toHaveLength(path.length)
          for(const [j,point] of path.entries()){expect(points[j][0]).toBeCloseTo(point.x,9);expect(points[j][1]).toBeCloseTo(point.y,9)}
        }
      }
    }
  }
  await panel.getByRole('button',{name:'Try the prediction again',exact:true}).click()
  await expect(panel.getByRole('img')).toHaveCount(0)
  await expect(panel.getByRole('status')).toHaveCount(0)
  await expect(panel.getByRole('button',{name:'Center ball',exact:true})).toHaveAttribute('aria-pressed','false')
  await panel.getByRole('button',{name:'Center ball',exact:true}).click()
  await panel.getByRole('button',{name:'Check prediction',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('Your prediction matches')
  await expect(panel.getByRole('button',{name:'Center-ball practice',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(panel.getByRole('button',{name:'Cushion rebound',exact:true})).toHaveAttribute('aria-pressed','true')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByRole('button',{name:'Next level',exact:true}).click()
  await expect(page.getByRole('button',{name:'Start level 89',exact:true})).toBeVisible()
})
