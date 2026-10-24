import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { prepareRound } from '../src/engine/preparation'
import { generateScenario } from '../src/engine/scenarios'
import { analyzeShot } from '../src/engine/analysis'
import { twoObjectBankReplay } from '../src/engine/two-object-bank'
import { startLevel } from './helpers'
for (const mobile of [true, false]) test(`trace two object ball cushions on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 })
  await page.addInitScript(character => {
    localStorage.setItem('shot-selection-help-dismissed', 'true')
    localStorage.setItem('shot-selection-sound-enabled', 'false')
    localStorage.setItem('shot-selection-session', JSON.stringify({ character, scoringVersion: 2, courseVersion: 5, completedLessons: 88, level: 89, score: 0, rounds: 88, perfect: 0, seed: 0 }))
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) { if (type === 'webgl2') return null; return original.call(this, type as '2d', ...args) } as typeof original
  }, DEFAULT_CHARACTER)
  const p=prepareRound(generateScenario(89,89*919))
  await page.goto('/');await startLevel(page,89)
  await page.getByRole('button',{name:'Select ball 1',exact:true}).click()
  await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
  const panel=page.getByRole('region',{name:'Two cushion object bank replay',exact:true})
  await expect(panel.getByRole('img')).toHaveCount(0)
  await page.getByRole('button',{name:'Choose stroke C',exact:true}).click()
  await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('Cue → ball 1',{timeout:30000})
  await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
  await expect(panel.getByRole('button',{name:'Stroke C',exact:true})).toHaveAttribute('aria-pressed','true')
  for(const option of p.balls[0].options){
    const sim=analyzeShot(p.scenario,option.plan,8).nominal,data=twoObjectBankReplay(p.scenario,sim)!
    await panel.getByRole('button',{name:`Stroke ${option.label}`,exact:true}).click()
    await expect(panel.getByRole('table')).toHaveCount(0)
    await expect(panel.locator('polyline')).toHaveCount(0)
    for(const [phase,label] of ['Cue contact','First object rebound','Second object rebound','Complete bank route','Settled result'].entries()){
      await panel.getByRole('button',{name:label,exact:true}).click()
      const balls=phase===0?data.contact.balls!:phase===4?sim.finalBalls:phase===1?data.rebounds[0].balls:data.rebounds[1].balls
      for(const ball of balls){
        const g=panel.getByTestId(`two-bank-ball-${ball.id}`)
        if(ball.pocketed){await expect(g).toHaveCount(0);continue}
        expect(Number(await g.locator('circle').getAttribute('cx'))).toBeCloseTo(ball.position.x,9)
        expect(Number(await g.locator('circle').getAttribute('cy'))).toBeCloseTo(ball.position.y,9)
      }
      if(phase===1||phase===2){
        await expect(panel.getByRole('status')).toContainText(`Object rebound ${phase}: ball 1 at ${data.rebounds[phase-1].time.toFixed(3)} s`)
        expect((await panel.getByRole('img').getAttribute('viewBox'))!.split(' ').map(Number).slice(2)).toEqual([.7,.5])
      }
      await expect(panel.locator('polyline')).toHaveCount(Math.min(phase,3))
      for(let i=0;i<Math.min(phase,3);i++){
        const points=(await panel.getByTestId(`two-bank-segment-${i}`).getAttribute('points'))!.split(' ').map(pair=>pair.split(',').map(Number))
        expect(points).toHaveLength(data.segments[i].length)
        for(const [j,point] of data.segments[i].entries()){expect(points[j][0]).toBeCloseTo(point.x,9);expect(points[j][1]).toBeCloseTo(point.y,9)}
      }
      for(let i=0;i<Math.min(phase,2);i++){
        const marker=panel.getByTestId(`two-bank-rebound-${i}`)
        expect(Number(await marker.locator('circle').getAttribute('cx'))).toBeCloseTo(data.rebounds[i].position.x,9)
        expect(Number(await marker.locator('circle').getAttribute('cy'))).toBeCloseTo(data.rebounds[i].position.y,9)
        await expect(marker.locator('text')).toHaveText(`R${i+1}`)
        const row=panel.getByTestId(`two-bank-speed-${i}`)
        await expect(row.getByRole('cell').nth(0)).toHaveText(`${data.speeds[i].before.toFixed(2)} m/s`)
        await expect(row.getByRole('cell').nth(1)).toHaveText(`${data.speeds[i].after.toFixed(2)} m/s`)
      }
      if(phase===1)await expect(panel.getByTestId('two-bank-speed-1')).toHaveCount(0)
      if((phase===2||phase===3)&&option.label==='C'){
        await panel.getByRole('img').scrollIntoViewIfNeeded()
        await page.locator('.shot-panel').screenshot({path:`/tmp/two-object-bank-${phase}-${mobile?'mobile':'desktop'}.png`})
      }
    }
    await expect(panel.getByRole('status')).toContainText('the two-cushion bank succeeds')
    await panel.getByRole('button',{name:'First object rebound',exact:true}).click()
    await expect(panel.getByTestId('two-bank-speed-1')).toHaveCount(0)
    await panel.getByRole('button',{name:'Cue contact',exact:true}).click()
    await expect(panel.getByRole('table')).toHaveCount(0)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByRole('button',{name:'Next level',exact:true}).click()
  await expect(page.getByRole('button',{name:'Start level 90',exact:true})).toBeVisible()
})
