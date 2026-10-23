import type { Ref } from 'react'
import { ArrowRight, Focus, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LEVELS_PER_CHAPTER, TOTAL_LEVELS } from '@/engine/scenarios'
import type { Scenario } from '@/engine/types'

const stageLabels = {
  introduce: 'New scenario',
  develop: 'Build your skill',
  apply: 'Put it together',
}

export default function LevelBriefing({ scenario, headingRef, onStart, reviewing, sandbox = false }: {
  scenario: Scenario
  headingRef: Ref<HTMLHeadingElement>
  onStart: () => void
  reviewing: boolean
  sandbox?: boolean
}) {
  const { curriculum, objective, bank, plant } = scenario
  const briefing = curriculum?.briefing
  const lessonIndex = curriculum?.lessonIndex ?? 0
  const lessonCount = curriculum?.lessonCount ?? LEVELS_PER_CHAPTER

  return <>
    <div className="briefing-meta">
      <span className="eyebrow">{sandbox ? 'SANDBOX SCENARIO' : `LEVEL ${String(scenario.level).padStart(2, '0')} / ${TOTAL_LEVELS}`}</span>
      {!sandbox && <span>LESSON {lessonIndex + 1} OF {lessonCount}</span>}
    </div>
    <div className="briefing-scenario">
      <span className="briefing-stage">{sandbox ? 'Free practice' : briefing ? stageLabels[briefing.stage] : 'Your next lesson'}</span>
      <span>{curriculum?.chapterTitle}</span>
      {!sandbox && <span className="briefing-steps" aria-hidden="true">{Array.from({ length: lessonCount }, (_, index) => <i key={index} className={index <= lessonIndex ? 'step-reached' : ''} />)}</span>}
    </div>
    <DialogTitle ref={headingRef} tabIndex={-1}>{scenario.title}</DialogTitle>
    <DialogDescription>{scenario.description}</DialogDescription>
    <section className="briefing-focus" aria-label="Learning focus">
      <span className="lesson-goal-label"><Focus size={15} /> LEARN THIS</span>
      {briefing && <h3>{briefing.focus}</h3>}
      <p>{curriculum?.lesson}</p>
      {plant && <p className="briefing-objective">Plant {plant.ballId} → {plant.targetBallId}: hit ball {plant.ballId} first to pot ball {plant.targetBallId} · Or choose a difficult free ball · Compare the margin for error and cue-ball finish.</p>}
      {bank && <p className="briefing-objective">Reach ball {bank.ballId} after at least {bank.minCushions} cushion{bank.minCushions === 1 ? "" : "s"} · Pot the target ball · Control the cue-ball finish.</p>}
      {objective && <p className="briefing-objective">Pot ball {objective.ballId} · Hold the cyan zone · Leave ball {objective.nextBallId} a clear shot with a cut of {objective.maxCutAngle}° or less.</p>}
    </section>
    {briefing && <aside className="briefing-gotcha" aria-label="Teaching tip">
      <Lightbulb size={19} aria-hidden="true" />
      <div><h3>Watch for this</h3><p>{briefing.gotcha}</p></div>
    </aside>}
    <Button className="full-width briefing-start" onClick={onStart}>{reviewing ? 'Back to the table' : sandbox ? 'Start sandbox round' : `Start level ${scenario.level}`}<ArrowRight size={16} /></Button>
  </>
}
