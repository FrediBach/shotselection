import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'
for(const mobile of [true,false]) test(`signed angle compares useful departure sides on ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1050})
 await page.addInitScript(character=>{
  localStorage.setItem('shot-selection-help-dismissed','true');localStorage.setItem('shot-selection-sound-enabled','false')
  localStorage.setItem('shot-selection-session',JSON.stringify({character,scoringVersion:2,courseVersion:5,completedLessons:28,level:29,score:0,rounds:28,perfect:0,seed:0}))
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return original.call(this,type as '2d',...args)} as typeof original
 },DEFAULT_CHARACTER)
 await page.goto('/');await startLevel(page,29)


 await page.getByRole('button',{name:'Choose a stroke',exact:true}).click()
 const comparison=page.getByRole('region',{name:'Signed angle comparison'}),prediction=comparison.getByRole('group',{name:'Side prediction'})
 await expect(comparison.getByRole('img')).toHaveCount(2)
 await expect(comparison.getByRole('img',{name:/ideal stun departure/})).toHaveCount(0)
 if(mobile){
  await prediction.getByRole('button').first().click()
  await comparison.getByRole('button',{name:'Reveal departure directions',exact:true}).click()
  await expect(comparison.getByRole('img',{name:/ideal stun departure/})).toHaveCount(2)
 }
 await page.getByRole('button',{name:'Choose stroke A',exact:true}).click()
 await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
 await expect(page.getByRole('button',{name:'Next level',exact:true})).toBeVisible({timeout:30000})
 if(mobile) await expect(prediction.getByRole('button').first()).toHaveAttribute('aria-pressed','true')
 else await expect(comparison).toContainText('Inspect the two departure directions.')
 const toward=comparison.locator('figure').filter({hasText:'Toward the preview'}),away=comparison.locator('figure').filter({hasText:'Away from the preview'})
 await expect(toward).toHaveCount(1);await expect(away).toHaveCount(1)
 for(const figure of [toward,away]){
  await expect(figure).toContainText('Inside the zoneYes')
  await expect(figure).toContainText('Cut within 60°Yes')
 }
 const angle=async(figure:typeof toward)=>parseFloat(await figure.locator('dl > div').filter({hasText:'Signed next cut'}).locator('dd').innerText())
 expect((await angle(toward))*(await angle(away))).toBeLessThan(0)
 const correct=await toward.locator('figcaption strong').innerText(),wrong=await away.locator('figcaption strong').innerText()
 await comparison.getByRole('button',{name:'Try the prediction again'}).click()
 await expect(comparison.getByRole('img',{name:/ideal stun departure/})).toHaveCount(0)
 await prediction.getByRole('button',{name:wrong,exact:true}).click()
 await expect(comparison).toContainText('Both cuts are allowed; compare their departure sides.')
 await comparison.getByRole('button',{name:'Try the prediction again'}).click()
 await prediction.getByRole('button',{name:correct,exact:true}).click()
 await expect(comparison).toContainText('Your prediction selects the useful side.')
 await toward.getByRole('img').scrollIntoViewIfNeeded()
 await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
 await page.locator('.shot-panel').screenshot({path:`/tmp/signed-angle-${mobile?'mobile':'desktop'}.png`})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'Next level',exact:true}).click()
 await expect(page.getByRole('button',{name:'Start level 30',exact:true})).toBeVisible()
})
