import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'
for(const skip of [false,true]) test(`backward planning ${skip?'allows skipping':'reveals the area after a contact prediction'}`,async({page})=>{
 await page.setViewportSize(skip?{width:1440,height:1050}:{width:390,height:844})
 await page.addInitScript(character=>{
  localStorage.setItem('shot-selection-help-dismissed','true');localStorage.setItem('shot-selection-sound-enabled','false')
  localStorage.setItem('shot-selection-session',JSON.stringify({character,scoringVersion:2,courseVersion:5,completedLessons:23,level:24,score:0,rounds:23,perfect:0,seed:0}))
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return original.call(this,type as '2d',...args)} as typeof original
 },DEFAULT_CHARACTER)
 await page.goto('/');await startLevel(page,24)
 const plan=page.getByRole('region',{name:'Backward planning'})
 const next=page.getByRole('button',{name:'Choose a stroke',exact:true})
 await expect(next).toBeDisabled()
 await expect(page.getByTestId('position-zone')).toHaveCount(0)
 if(skip) await plan.getByRole('button',{name:'Show the plan without answering'}).click()
 else {
  // The game's seed is 24 * 919 (even), so B is the incorrect contact.
  await plan.getByRole('button',{name:'Contact B',exact:true}).click()
  await expect(plan).toContainText('Use contact A, on the side away from the pocket.')
 }
 await expect(page.getByTestId('position-zone')).toHaveCount(1)
 await expect(next).toBeEnabled()
 await plan.getByRole('button',{name:'Try the contact prediction again'}).click()
 await plan.getByRole('button',{name:'Contact A',exact:true}).click()
 await expect(plan).toContainText('Your contact prediction A is correct.')
 await plan.getByRole('img').first().scrollIntoViewIfNeeded()
 await page.locator('.shot-panel').screenshot({path:`/tmp/backward-plan-${skip?'desktop':'mobile'}.png`})
 await next.click()
 await expect(plan).toContainText('Your contact prediction A is correct.')
 await page.getByRole('button',{name:'Choose stroke A',exact:true}).click()
 await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
 await expect(plan.getByLabel('Planned route results')).toBeVisible({timeout:30000})
 await expect(plan.getByLabel('Planned route results').getByRole('paragraph')).toHaveCount(3)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'Next level',exact:true}).click()
 await expect(page.getByRole('button',{name:'Start level 25',exact:true})).toBeVisible()
})
