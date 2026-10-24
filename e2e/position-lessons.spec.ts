import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'
for (const level of [22,23]) test(`level ${level} preserves position prediction, explains actual strokes and allows retry`,async({page})=>{
 await page.setViewportSize(level===22?{width:390,height:844}:{width:1440,height:1050})
 await page.addInitScript(({level,character})=>{
  localStorage.setItem('shot-selection-help-dismissed','true')
  localStorage.setItem('shot-selection-sound-enabled','false')
  localStorage.setItem('shot-selection-session',JSON.stringify({character,scoringVersion:2,courseVersion:5,completedLessons:level-1,level,score:0,rounds:level-1,perfect:0,seed:0}))
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return original.call(this,type as '2d',...args)} as typeof original
 },{level,character:DEFAULT_CHARACTER})
 await page.goto('/')
 await startLevel(page,level)
 await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
 const comparison=page.getByRole('region',{name:'Position lesson comparison'})
 const prediction=comparison.getByRole('group',{name:'Position prediction'})
 if(level===23) await prediction.getByRole('button',{name:'Stroke A',exact:true}).click()
 await expect(comparison.getByRole('img')).toHaveCount(0)
 await page.getByRole('button',{name:'Choose stroke A',exact:true}).click()
 await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
 await expect(comparison.getByRole('img')).toHaveCount(3,{timeout:30000})
 if(level===23) {
  await expect(prediction.getByRole('button',{name:'Stroke A',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(comparison).toContainText('Safe, settled trials in zone')
  await expect(comparison).toContainText('Complete successful trials')
 } else {
  await expect(comparison).toContainText('Inspect the measured comparison.')
  await expect(comparison).toContainText('Roll ratio at contact')
 }
 await comparison.getByRole('button',{name:'Try the prediction again'}).click()
 await expect(comparison.getByRole('img')).toHaveCount(0)
 await prediction.getByRole('button',{name:'Stroke B',exact:true}).click()
 await expect(comparison.getByRole('img')).toHaveCount(3)
 await comparison.getByRole('img').last().scrollIntoViewIfNeeded()
 await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
 await page.locator('.shot-panel').screenshot({path:`/tmp/position-lesson-${level}.png`})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'Next level',exact:true}).click()
 await expect(page.getByRole('button',{name:`Start level ${level+1}`,exact:true})).toBeVisible()
})
