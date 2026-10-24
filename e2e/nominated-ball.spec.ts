import { generateScenario } from '../src/engine/scenarios'
import { prepareRound } from '../src/engine/preparation'
import { expect, test } from '@playwright/test'
import { DEFAULT_CHARACTER } from '../src/engine/characters'
import { startLevel } from './helpers'
for(const mobile of [true,false]) test(`nominated ball is reserved and the connection checked on ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1050})
 await page.addInitScript(character=>{
  localStorage.setItem('shot-selection-help-dismissed','true');localStorage.setItem('shot-selection-sound-enabled','false')
  localStorage.setItem('shot-selection-session',JSON.stringify({character,scoringVersion:2,courseVersion:5,completedLessons:30,level:31,score:0,rounds:30,perfect:0,seed:0}))
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type==='webgl2')return null;return original.call(this,type as '2d',...args)} as typeof original
 },DEFAULT_CHARACTER)
 await page.goto('/');await startLevel(page,31)




 const prepared=prepareRound(generateScenario(31,31*919),{regenerate:false})
 const contrast=prepared.nextBallNominations!.find(c=>c.ballId===(mobile?2:3))!
 const option=prepared.balls.flatMap(b=>b.options).find(o=>o.id===(mobile?contrast.lostId:contrast.keptId))!
 const comparison=page.getByRole('region',{name:'Nominated next ball'}),choices=comparison.getByRole('group',{name:'Next ball nomination'})
 await page.getByRole('button',{name:`Select ball ${contrast.ballId}`,exact:true}).click()
 await expect(page.getByRole('button',{name:'Choose a finish',exact:true})).toBeDisabled()
 await choices.getByRole('button',{name:`Next ball ${contrast.ballId}`,exact:true}).click()
 const reserved=page.getByRole('button',{name:`Select ball ${contrast.ballId}`,exact:true})
 await expect(reserved).toBeDisabled()
 await expect(reserved).toHaveAttribute('aria-pressed','false')
 await expect(page.getByRole('button',{name:'Choose a finish',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:`Select ball ${option.plan.ballId}`,exact:true}).click()
 await page.getByRole('button',{name:'Choose a finish',exact:true}).click()
 await page.getByRole('button',{name:'Back to balls',exact:true}).click()
 await expect(choices.getByRole('button',{name:`Next ball ${contrast.ballId}`,exact:true})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Choose a finish',exact:true}).click()
 await page.getByRole('button',{name:`Choose finish ${option.label}`,exact:true}).click()
 await page.getByRole('button',{name:'Lock in your shot',exact:true}).click()
 await expect(page.getByRole('button',{name:'Next level',exact:true})).toBeVisible({timeout:30000})
 await expect(comparison.getByRole('img')).toHaveCount(1)
 await expect(choices.getByRole('button',{name:`Next ball ${contrast.ballId}`,exact:true})).toHaveAttribute('aria-pressed','true')
 for(const button of await choices.getByRole('button').all()) await expect(button).toBeDisabled()
 const lost=comparison.locator('.nomination-result').filter({hasText:'Easier cut, lost connection'}),kept=comparison.locator('.nomination-result').filter({hasText:'Harder cut, preserved connection'})
 await expect(lost).toHaveCount(1);await expect(kept).toHaveCount(1)
 await expect(lost).toContainText('Legal opening potYes')
 await expect(lost).toContainText('Nominated connectionLost')
 await expect(kept).toContainText('Nominated connectionPreserved')
 if(mobile) await expect(comparison).toContainText(`The opening pot works, but no permitted route remains to ball ${contrast.ballId}.`)
 else await expect(comparison).toContainText('Your opening pot preserves the nominated connection.')
 await comparison.getByRole('img').scrollIntoViewIfNeeded()
 await expect(page.locator('.perfect-celebration')).toHaveCount(0,{timeout:10000})
 await page.locator('.shot-panel').screenshot({path:`/tmp/nominated-ball-${mobile?'mobile':'desktop'}.png`})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'Next level',exact:true}).click()
 await expect(page.getByRole('button',{name:'Start level 32',exact:true})).toBeVisible()
})
