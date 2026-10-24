import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { simulateShot } from '../src/engine/physics'
import { evaluateShotObjective, directNextShotRoutes } from '../src/engine/objectives'
import { POCKET_GEOMETRY } from '../src/engine/table-geometry'
import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'
for(const mobile of [true,false]) test(`declared next pocket is verified independently on ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1050})
 await page.addInitScript(character=>{
  localStorage.setItem('shot-selection-help-dismissed','true');localStorage.setItem('shot-selection-sound-enabled','false')
  localStorage.setItem('shot-selection-session',JSON.stringify({character,scoringVersion:2,courseVersion:5,completedLessons:29,level:30,score:0,rounds:29,perfect:0,seed:0}))
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return original.call(this,type as '2d',...args)} as typeof original
 },DEFAULT_CHARACTER)
 await page.goto('/');await startLevel(page,30)



 const prepared=prepareRound(generateScenario(30,30*919),{regenerate:false})
 const options=prepared.balls[0].options.map(option=>({option,sim:simulateShot(prepared.scenario,option.plan,{record:false})}))
 const successful=options.find(s=>evaluateShotObjective(prepared.scenario,s.option.plan,s.sim).success)!
 const routes=directNextShotRoutes(prepared.scenario,successful.sim)
 const supported=POCKET_GEOMETRY.find(p=>p.id===routes[0].pocketId)!
 const unsupported=POCKET_GEOMETRY.find(p=>!routes.some(r=>r.pocketId===p.id))!
 const intended=mobile?unsupported:supported
 const comparison=page.getByRole('region',{name:'Intended next pocket'}),choices=comparison.getByRole('group',{name:'Next pocket choice'})
 await expect(page.getByRole('button',{name:'Choose a stroke',exact:true})).toBeDisabled()
 await choices.getByRole('button',{name:`${supported.id+1} · ${supported.name}`,exact:true}).click()
 await expect(page.getByRole('button',{name:'Choose a stroke',exact:true})).toBeEnabled()
 await choices.getByRole('button',{name:`${intended.id+1} · ${intended.name}`,exact:true}).click()
 await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
 await page.getByRole('button',{name:'Back to balls',exact:true}).click()
 await expect(choices.getByRole('button',{name:`${intended.id+1} · ${intended.name}`,exact:true})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
 await page.getByRole('button',{name:`Choose stroke ${successful.option.label}`,exact:true}).click()
 await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
 await expect(page.getByRole('button',{name:'Next level',exact:true})).toBeVisible({timeout:30000})
 await expect(comparison.getByRole('img')).toHaveCount(3)
 await expect(choices.getByRole('button',{name:`${intended.id+1} · ${intended.name}`,exact:true})).toHaveAttribute('aria-pressed','true')
 for(const button of await choices.getByRole('button').all()) await expect(button).toBeDisabled()
 const selected=comparison.locator('figure').filter({hasText:'Your opening stroke'})
 await expect(selected).toContainText('Any next pocketAvailable')
 await expect(selected).toContainText('Inside the zoneYes')
 if(mobile){
  await expect(selected).toContainText('Declared pocketUnavailable')
  await expect(selected).toContainText('Complete declared planNot met')
  await expect(comparison).toContainText('Another next pocket is available; it does not verify your declaration.')
 }else{
  await expect(selected).toContainText('Declared pocketAvailable')
  await expect(selected).toContainText('Complete declared planMet')
  await expect(comparison).toContainText('Your declared plan is supported.')
 }
 await selected.getByRole('img').scrollIntoViewIfNeeded()
 await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
 await page.locator('.shot-panel').screenshot({path:`/tmp/next-pocket-${mobile?'mobile':'desktop'}.png`})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'Next level',exact:true}).click()
 await expect(page.getByRole('button',{name:'Start level 31',exact:true})).toBeVisible()
})
