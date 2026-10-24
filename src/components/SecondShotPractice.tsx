import { useMemo, useState } from 'react'
import type { Scenario, ShotAnalysis } from '../engine/types'
import { secondShotSetup, secondShotPlan, secondShotPotted } from '../engine/second-shot'
import { simulateShot } from '../engine/physics'
import { POCKETS } from '../engine/constants'
import PoolTable from './PoolTable'
import type { TableReplay } from './PoolTable'
import { Button } from './ui/button'
import './SecondShotPractice.css'

export default function SecondShotPractice({ scenario, opener }: { scenario: Scenario; opener: ShotAnalysis }) {
  const setup = useMemo(() => secondShotSetup(scenario, opener.plan, opener.nominal), [scenario, opener])
  const [pocket, setPocket] = useState(setup.routes[0]?.pocketId ?? -1)
  const [pace, setPace] = useState(1.2)
  const [spin, setSpin] = useState(0)
  const [replay, setReplay] = useState<TableReplay | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playbackKey, setPlaybackKey] = useState(0)
  const route = setup.routes.find(candidate => candidate.pocketId === pocket)
  function play() {
    if (!route || playing) return
    const plan = secondShotPlan(setup.scenario, setup.ballId, route, pace, spin)
    setReplay({ plan, nominal: simulateShot(setup.scenario, plan), samplePaths: [], sampleObjectPaths: [], sampleBallEnds: [] })
    setPlaybackKey(key => key + 1)
    setPlaying(true)
  }
  function reset() { setReplay(null) }
  return <section className="second-shot-practice" aria-label="Play the second shot">
    <span className="lesson-goal-label">TWO-SHOT PRACTICE · UNSCORED</span>
    <h2>The first finish becomes the next start.</h2>
    <p>This table continues your selected opening stroke’s nominal replay. Every remaining ball stays where it settled. Choose a pocket, pace and spin for ball {setup.ballId}, then play it.</p>
    {setup.reason ? <p role="status">{setup.reason} Review the opening alternatives below, or continue to the next lesson.</p> : <>
      <div className="second-shot-controls">
        <label>Second-shot pocket<select value={pocket} disabled={playing} onChange={event => { setPocket(Number(event.target.value)); reset() }}>
          {setup.routes.map(candidate => <option key={candidate.pocketId} value={candidate.pocketId}>{POCKETS.find(p => p.id === candidate.pocketId)!.name} · {candidate.cutAngle.toFixed(0)}° cut</option>)}
        </select></label>
        <label>Second-shot pace<select value={pace} disabled={playing} onChange={event => { setPace(Number(event.target.value)); reset() }}>
          <option value={.95}>Gentle</option><option value={1.2}>Medium</option><option value={1.5}>Firm</option>
        </select></label>
        <label>Second-shot spin<select value={spin} disabled={playing} onChange={event => { setSpin(Number(event.target.value)); reset() }}>
          <option value={0}>Center ball</option><option value={-.7}>Draw</option><option value={1}>Follow</option>
        </select></label>
        <Button disabled={playing} onClick={play}>{playing ? 'Second shot in motion' : 'Play second shot'}</Button>
      </div>
      <p>A clear route is a geometric opportunity, not a guaranteed pot. These strokes use no English. Retrying starts from the same first-shot finish.</p>
    </>}
    <div className="second-shot-table">
      <PoolTable scenario={setup.scenario} selectedBall={setup.ballId} target={null} onSelectBall={() => {}} finishOptions={[]} approachOption={null} selectedOptionId={null} onSelectOption={() => {}} selectableBallIds={[]} analysis={replay} showEnsemble={false} showFinishes={false} playing={playing} playbackKey={playbackKey} onPlaybackEnd={() => setPlaying(false)} interactive={false} />
    </div>
    {replay && !playing && <p role="status">{secondShotPotted(setup.ballId, replay.nominal)
      ? `Two pots connected: ball ${setup.ballId} was potted legally from your opening finish.`
      : replay.nominal.scratch ? 'The second shot scratched. Try another pace or spin from the same starting position.'
        : !replay.nominal.stopped ? 'The second shot did not settle within the simulation limit.'
          : `The second shot did not legally pot ball ${setup.ballId}. Try another pocket or stroke.`}</p>}
    <p>Your score measures the opening choice. This second shot is a nominal practice attempt, not a probability estimate or a full run-out.</p>
  </section>
}
