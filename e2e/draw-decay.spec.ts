import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'
for(const mobile of [true,false]) test(`draw decay compares short and long approaches on ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1050})
 await page.addInitScript(character=>{
  localStorage.setItem('shot-selection-help-dismissed','true');localStorage.setItem('shot-selection-sound-enabled','false')
  localStorage.setItem('shot-selection-session',JSON.stringify({character,scoringVersion:2,courseVersion:5,completedLessons:26,level:27,score:0,rounds:26,perfect:0,seed:0}))
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return original.call(this,type as '2d',...args)} as typeof original
 },DEFAULT_CHARACTER)
 await page.goto('/');await startLevel(page,27)

 await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
 const comparison=page.getByRole('region',{name:'Draw decay comparison'}),prediction=comparison.getByRole('group',{name:'Draw prediction'})
 await expect(comparison.getByRole('img')).toHaveCount(0)
 if(mobile){
  await prediction.getByRole('button',{name:/Short approach/}).click()
  await comparison.getByRole('button',{name:'Reveal comparison',exact:true}).click()
  await expect(comparison).toContainText('Compare launch spin with spin at contact.')
  await expect(comparison.getByRole('img')).toHaveCount(3)
 }
 await page.getByRole('button',{name:'Choose stroke A',exact:true}).click()
 await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
 await expect(page.getByRole('button',{name:'Next level',exact:true})).toBeVisible({timeout:30000})
 await expect(comparison.getByRole('img')).toHaveCount(3,{timeout:30000})
 if(mobile) await expect(prediction.getByRole('button',{name:/Short approach/})).toHaveAttribute('aria-pressed','true')
 else await expect(comparison).toContainText('Inspect the measured comparison.')
 const short=comparison.locator('figure').filter({hasText:'Short approach'})
 const long=comparison.locator('figure').filter({hasText:'Long approach'}).first()
 const recovered=comparison.locator('figure').filter({hasText:'Long approach · more backspin'})
 await expect(short).toContainText('Backspin at contactRetained')
 await expect(long).toContainText('Backspin at contactLost')
 await expect(recovered).toContainText('Backspin at contactRetained')
 await comparison.getByRole('button',{name:'Try the prediction again'}).click()
 await expect(comparison.getByRole('img')).toHaveCount(0)
 await prediction.getByRole('button',{name:/Long approach/}).click()
 await expect(comparison).toContainText('Your prediction matches the simulation.')
 await short.getByRole('img').scrollIntoViewIfNeeded()
 await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
 await page.locator('.shot-panel').screenshot({path:`/tmp/draw-decay-${mobile?'mobile':'desktop'}.png`})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'Next level',exact:true}).click()
 await expect(page.getByRole('button',{name:'Start level 28',exact:true})).toBeVisible()
})
