import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { objectBankReplay } from '../src/engine/object-bank'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`identify the object ball cushion on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 86, level: 87, score: 0, rounds: 86, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p=prepareRound(generateScenario(87,87*919))
  await page.goto('/');await startLevel(page,87)
  await page.getByRole('button',{name:'Select ball 1',exact:true}).click()
  await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
  const panel=page.getByRole('region',{name:'Object ball bank replay',exact:true})
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button',{name:'Choose stroke C',exact:true}).click()
  await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('Cue → ball 1',{timeout:30000})
  await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
  await expect(panel.getByRole('button',{name:'Stroke C',exact:true})).toHaveAttribute('aria-pressed','true')
  for(const option of p.balls[0].options){
    const sim=analyzeShot(p.scenario,option.plan,8).nominal,data=objectBankReplay(p.scenario,sim)!
    await panel.getByRole('button',{name:`Stroke ${option.label}`,exact:true}).click()
    await expect(panel.getByTestId('bank-rebound')).toHaveCount(0)
    await expect(panel.getByTestId('bank-counts')).toHaveCount(0)
    for(const [phase,label] of ['Cue contact','Cushion close-up','Reveal bank path','Settled result'].entries()){
      await panel.getByRole('button',{name:label,exact:true}).click()
      const balls=phase===0?data.contact.balls!:phase===3?sim.finalBalls:data.rebound.balls
      for(const ball of balls){
        const g=panel.getByTestId(`bank-ball-${ball.id}`)
        if(ball.pocketed){await expect(g).toHaveCount(0);continue}
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(ball.position.x,9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(ball.position.y,9)
      }
      if(phase===1){
        await expect(panel.getByRole('status')).toContainText(`Ball 1 → cushion at ${data.rebound.time.toFixed(3)} s`)
        expect((await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number).slice(2)).toEqual([.7,.5])
        await expect(panel.getByTestId('bank-after')).toHaveCount(0)
        if(option.label==='C'){
          await panel.getByRole('img').scrollIntoViewIfNeeded()
          await page.locator('.shot-panel').screenshot({path:`/tmp/object-bank-${mobile?'mobile':'desktop'}.png`})
        }
      }
      if(phase>0){
        expect(Number(await panel.getByTestId('bank-rebound').getAttribute('cx'))).toBeCloseTo(data.rebound.position.x,9)
        expect(Number(await panel.getByTestId('bank-rebound').getAttribute('cy'))).toBeCloseTo(data.rebound.position.y,9)
        for(const [name,path] of [['before',data.before],...(phase>1?[['after',data.after] as const]:[])] as const){
          const points=(await panel.getByTestId(`bank-${name}`).getAttribute('points'))!.split(' ').map(pair=>pair.split(',').map(Number))
          expect(points).toHaveLength(path.length)
          for(const [i,point] of path.entries()){expect(points[i][0]).toBeCloseTo(point.x,9);expect(points[i][1]).toBeCloseTo(point.y,9)}
        }
      }
      if(phase>1){
        await expect(panel.getByTestId('bank-counts')).toContainText(`Counted object-ball cushions: ${sim.objectCushions}`)
        await expect(panel.getByTestId('bank-counts')).toContainText('Cue cushions before first contact: 0')
      }
    }
    await expect(panel.getByRole('status')).toContainText('the bank pot completes the trick')
    await panel.getByRole('button',{name:'Cue contact',exact:true}).click()
    await expect(panel.getByTestId('bank-rebound')).toHaveCount(0)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByRole('button',{name:'Next level',exact:true}).click()
  await expect(page.getByRole('button',{name:'Start level 88',exact:true})).toBeVisible()
})
