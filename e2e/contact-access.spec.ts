import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'
for(const mobile of [true,false]) test(`contact trap explains visibility versus contact clearance on ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1050})
 await page.addInitScript(character=>{
  localStorage.setItem('shot-selection-help-dismissed','true');localStorage.setItem('shot-selection-sound-enabled','false')
  localStorage.setItem('shot-selection-session',JSON.stringify({character,scoringVersion:2,courseVersion:5,completedLessons:25,level:26,score:0,rounds:25,perfect:0,seed:0}))
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return original.call(this,type as '2d',...args)} as typeof original
 },DEFAULT_CHARACTER)
 await page.goto('/');await startLevel(page,26)
 await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
 const comparison=page.getByRole('region',{name:'Contact clearance comparison'}),prediction=comparison.getByRole('group',{name:'Clearance prediction'})
 if(mobile) await prediction.getByRole('button',{name:'Stroke A',exact:true}).click()
 await expect(comparison.getByRole('img')).toHaveCount(0)
 await page.getByRole('button',{name:'Choose stroke A',exact:true}).click()
 await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
 await expect(comparison.getByRole('img')).toHaveCount(3,{timeout:30000})
 if(mobile) await expect(prediction.getByRole('button',{name:'Stroke A',exact:true})).toHaveAttribute('aria-pressed','true')
 else await expect(comparison).toContainText('Inspect the two in-zone alternatives.')
 const near=comparison.locator('figure').filter({hasText:'Nearer in-zone trap'}),far=comparison.locator('figure').filter({hasText:'Farther legal finish'})
 await expect(near).toHaveCount(1);await expect(far).toHaveCount(1)
 await expect(near).toContainText('Inside the zoneYes')
 await expect(far).toContainText('Inside the zoneYes')
 await expect(near).toContainText('Hits before required contactYes')
 const label=(await near.locator('figcaption').innerText()).match(/· ([ABC]) ·/)![1]
 await comparison.getByRole('button',{name:'Try the prediction again'}).click()
 await expect(comparison.getByRole('img')).toHaveCount(0)
 await prediction.getByRole('button',{name:`Stroke ${label}`,exact:true}).click()
 await expect(comparison).toContainText('Your prediction identifies the contact trap.')
 await expect(comparison).toContainText('even with the cut limit relaxed')
 await near.getByRole('img').scrollIntoViewIfNeeded()
 await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
 await page.locator('.shot-panel').screenshot({path:`/tmp/contact-access-${mobile?'mobile':'desktop'}.png`})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'Next level',exact:true}).click()
 await expect(page.getByRole('button',{name:'Start level 27',exact:true})).toBeVisible()
})
