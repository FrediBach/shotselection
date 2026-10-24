import type { Ref } from 'react'
import { ArrowRight, Focus, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LEVELS_PER_CHAPTER, TOTAL_LEVELS } from '@/engine/scenarios'
import type { Scenario } from '@/engine/types'
import { TableConditionBriefing } from './TableConditions'

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
  const { curriculum, objective, bank, plant, trick, conditions } = scenario
  const briefing = curriculum?.briefing
  const lessonIndex = curriculum?.lessonIndex ?? 0
  const lessonCount = curriculum?.lessonCount ?? LEVELS_PER_CHAPTER

  return <>
    <div className="briefing-meta">
      <span className="eyebrow">{sandbox ? 'SANDBOX SCENARIO' : `LEVEL ${String(scenario.level).padStart(2, '0')} / ${TOTAL_LEVELS}`}</span>
      {!sandbox && <span>LESSON {lessonIndex + 1} OF {lessonCount}</span>}
    </div>
    <div className="briefing-scenario">
      <span className="briefing-stage">{sandbox ? 'Free practice' : conditions && lessonIndex === lessonCount - 1 ? 'Final boss' : briefing ? stageLabels[briefing.stage] : 'Your next lesson'}</span>
      <span>{curriculum?.chapterTitle}</span>
      {!sandbox && <span className="briefing-steps" aria-hidden="true">{Array.from({ length: lessonCount }, (_, index) => <i key={index} className={index <= lessonIndex ? 'step-reached' : ''} />)}</span>}
    </div>
    <DialogTitle ref={headingRef} tabIndex={-1}>{scenario.title}</DialogTitle>
    <DialogDescription>{scenario.description}</DialogDescription>
    {conditions && <TableConditionBriefing conditions={conditions} finalBoss={lessonIndex === lessonCount - 1} />}
    <section className="briefing-focus" aria-label="Learning focus">
      <span className="lesson-goal-label"><Focus size={15} /> {curriculum?.chapterId === 'patterns' ? 'PRACTICE THIS' : 'LEARN THIS'}</span>
      {briefing && <h3>{briefing.focus}</h3>}
      <p>{curriculum?.lesson}</p>
      {curriculum?.learning?.comparison === 'spare-graze' && <p className="briefing-objective">Compare a clear pass with an actual glancing contact after ball 1 drops. Inspect the cue’s heading change, then remove only ball 3 and repeat the same stroke to isolate the collision’s effect. This prediction is separate from scoring.</p>}
      {curriculum?.learning?.comparison === 'moving-traffic' && <p className="briefing-objective">Compare two in-zone finishes: one nudges ball 3 into the next corridor, while the other keeps it clear. Reset only the moved ball to diagnose why the next route disappears, then inspect the clear continuation.</p>}
      {curriculum?.learning?.comparison === 'ball-width' && <p className="briefing-objective">Compare two illustrated routes on the starting table. After committing a shot, reveal the swept width and the spare ball that blocks the narrow route. This optional prediction is separate from your opening-shot score.</p>}
      {curriculum?.chapterId === 'patterns' && <p className="briefing-objective">Connection practice: {curriculum.learning?.comparison === 'fallback-plan' ? 'compare two finishes inside the same zone: one leaves a single high-cut continuation, while the other preserves two playable next balls. Inspect independent simulated next pots. The regular score still checks access to ball 2; the fallback comparison is separate.' : curriculum.learning?.comparison === 'sequence-reliability' ? 'compare two complete orders using sampled two-shot completion rates for your player. Both begin at a fixed reference finish; every trial carries its actual first-shot position into the second shot. The regular opening score remains separate.' : curriculum.learning?.comparison === 'stepping-stone' ? 'compare two complete orders from one reference opening finish: distant ball 2 first, or nearer ball 3 as a stepping stone to ball 2. Both orders work; compare the resulting approach distance and cut on ball 2. This nominal sequence comparison is separate from opening-shot scoring.' : curriculum.learning?.comparison === 'corridor-diagnosis' ? 'diagnose two blocked corridors before choosing a stroke: the cue approach and the object-to-pocket line. Answer both cases; incorrect answers still unlock play. Removing only the named blocker verifies each explanation. Scoring accepts any permitted next pocket.' : curriculum.learning?.comparison === 'angle-travel' ? 'compare fuller and thinner second contacts on the same useful side of ball 2. Matched strokes show too little versus enough cue-ball travel toward a demonstrated setup for ball 3. The opening score and nominal continuation comparison remain separate.' : curriculum.learning?.comparison === 'zone-exit' ? 'compare two finishes inside the same zone. Identify the spare ball that blocks the next approach, then remove only that blocker in a separate diagnostic diagram. A clear pocket line alone does not guarantee access to the contact point.' : curriculum.learning?.comparison === 'look-ahead' ? 'compare two in-zone opening finishes with a matched second shot, then inspect access to ball 3. The regular score checks the first link; the separate continuation comparison checks one shot further.' : curriculum.learning?.comparison === 'key-ball' ? 'preserve ball 2 as the link to ball 3. The regular score checks the opening pot, zone and access to ball 2; a separate comparison demonstrates a simulated continuation through ball 3 and why moving ball 2 loses it.' : scenario.level === 32 ? 'play ball 1, then choose and execute a second stroke on ball 2 from your selected opener’s settled nominal layout. The second-shot practice is unscored; the opening choice keeps its regular score.' : curriculum.learning?.comparison === 'nominated-next-ball' ? 'nominate a later ball and reserve it while choosing an opener. The regular score compares opening shots; a separate check verifies access to the nominated ball. This round does not execute a second stroke.' : objective ? 'ball 1 is the fixed opener and ball 2 is the reserved next ball. This round checks the first pot and availability of the next shot; it does not play a second stroke or choose a full sequence.' : 'choose an opener and its finish. This round scores the opening shot only; it does not check a next-ball route.'}</p>}
      {plant && <p className="briefing-objective">Plant {plant.ballId} → {plant.targetBallId}: hit ball {plant.ballId} first to pot ball {plant.targetBallId} · Or choose a difficult free ball · Compare the margin for error and cue-ball finish.</p>}
      {bank && <p className="briefing-objective">Reach ball {bank.ballId} after at least {bank.minCushions} cushion{bank.minCushions === 1 ? "" : "s"} · Pot the target ball · Control the cue-ball finish.</p>}
      {objective && <p className="briefing-objective">Pot ball {objective.ballId} · Hold the cyan zone · Leave ball {objective.nextBallId} a clear shot with a cut of {objective.maxCutAngle}° or less.</p>}
      {trick && <p className="briefing-objective">{trick.description} Keep the cue ball on the table and control its finish.</p>}
      {conditions && <p className="briefing-objective">Pot your chosen ball · Keep the cue ball on the table · Compare which finish holds up with these defects.</p>}
    </section>
    {briefing && <aside className="briefing-gotcha" aria-label="Teaching tip">
      <Lightbulb size={19} aria-hidden="true" />
      <div><h3>Watch for this</h3><p>{briefing.gotcha}</p></div>
    </aside>}
    <Button className="full-width briefing-start" onClick={onStart}>{reviewing ? 'Back to the table' : sandbox ? 'Start sandbox round' : `Start level ${scenario.level}`}<ArrowRight size={16} /></Button>
  </>
}
