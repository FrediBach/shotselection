import { useState } from 'react'
import { Button } from './ui/button'
import { plantMarginEvidence } from '../engine/plant-margin'
import { TABLE } from '../engine/constants'
import { CUSHIONS, POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'
const points = (p: Vec2[]) => p.map(v => `${v.x},${v.y}`).join(' ')
export default function PlantMarginComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [changed, setChanged] = useState(false)
  const x = prepared.plantMargin!, option = prepared.balls.find(b => b.ballId === 1)!.options.find(o => o.id === x.referenceId)!
  const e = plantMarginEvidence(prepared.scenario, option.plan, x)!, revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Plant aiming-margin comparison" hidden={hidden}>
    <h3>How much aiming room remains?</h3>
    <p>Compare the authored offset pair with a centered reference. Which accepts a wider range of small aim changes around plant finish {option.label}?</p>
    <div role="group" className="lesson-predictions" aria-label="Margin prediction">{['Centered reference', 'Offset pair'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === 'Centered reference' ? 'Correct: the centered reference has more aiming room.' : 'The centered reference has more aiming room.'}</strong></p>
      <p>The reference shifts the cue and both plant balls together by {(Math.hypot(x.shift.x, x.shift.y) * 1000).toFixed(1)} mm along the mouth, centering the initial pair line. This preserves cue approach, cut and pair spacing. Free ball 3 stays fixed; speed and spin stay identical.</p>
      <p>Both layouts pot ball 2 at the original aim. Across 33 matched aim changes in 0.025° steps, the centered reference accepts every sampled angle through ±{e.centeredMargin.toFixed(3)}°; the offset pair through ±{e.offsetMargin.toFixed(3)}° symmetrically around zero.</p>
      <figure><figcaption><strong>Target pot at each tested angle</strong></figcaption>
        <svg viewBox="0 0 330 100" role="img" aria-label="Sampled target pots: centered reference and offset pair">
          {(['centeredPot', 'offsetPot'] as const).map((key, row) => <g key={key}><text x="4" y={14 + row * 37} fill="currentColor" fontSize="12">{row === 0 ? 'Centered' : 'Offset'}</text>{x.samples.map((s, i) => <circle key={i} data-testid={`margin-${key}-${i}`} aria-label={`${s.degrees.toFixed(3)} degrees: ${s[key] ? 'pot' : 'miss'}`} cx={9 + i * 9.7} cy={25 + row * 37} r="3.5" fill={s[key] ? '#7de3bf' : '#ff9f98'} />)}</g>)}
          <text x="4" y="87" fill="currentColor" fontSize="12">−0.400°</text><text x="164" y="87" textAnchor="middle" fill="currentColor" fontSize="12">0°</text><text x="325" y="87" textAnchor="end" fill="currentColor" fontSize="12">+0.400°</text>
        </svg>
      </figure>
      <p>Green = target pot; pink = miss. These are sampled bounds for this stroke, not exact continuous limits or success probabilities. The next sample on at least one side fails; acceptance can be asymmetric. Cue-ball finish and scratch are excluded from this target-pot measure.</p>
      <div role="group" className="lesson-predictions" aria-label="Compared aim"><Button size="sm" variant={!changed ? 'default' : 'outline'} aria-pressed={!changed} onClick={() => setChanged(false)}>Original aim</Button><Button size="sm" variant={changed ? 'default' : 'outline'} aria-pressed={changed} onClick={() => setChanged(true)}>Same aim change</Button></div>
      <p>{changed ? `Apply ${x.witnessDegrees > 0 ? '+' : ''}${x.witnessDegrees.toFixed(3)}° to both: the centered reference pots ball 2; the offset pair misses.` : 'Original aim: both layouts pot ball 2.'}</p>
      {([true, false] as const).map(centered => {
        const scenario = centered ? e.centered : prepared.scenario, geometry = centered ? e.centeredGeometry : e.geometry
        const simulation = centered ? (changed ? x.centeredWitness : x.centeredNominal) : (changed ? x.offsetWitness : x.offsetNominal)
        const id = centered ? 'centered' : 'offset', color = !centered && changed ? '#ff9f98' : '#7de3bf'
        return <figure key={id}><figcaption><strong>{centered ? 'Centered reference' : 'Authored offset'} · {!centered && changed ? 'Target miss' : 'Target pot'}</strong></figcaption>
          <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`${id} target-ball path`}>
            <rect x="-.08" y="-.08" width="2.70" height="1.43" fill="#0b241f" /><rect width="2.54" height="1.27" fill="#143f38" />
            {CUSHIONS.map(c => <polygon key={c.id} points={points(c.polygon)} fill="#205247" stroke="#8aa99f" strokeWidth=".002" />)}
            {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r={p.radius} fill="#061713" />)}
            <polyline data-testid={`${id}-actual`} points={points(simulation.objectPath)} fill="none" stroke={color} strokeWidth=".008" />
            <polyline points={points([geometry.first, geometry.target, geometry.hit])} fill="none" stroke="#fff" strokeWidth=".003" strokeDasharray=".012 .008" />
            <polyline points={points(geometry.pocket.mouth)} fill="none" stroke="#ffc16e" strokeWidth=".008" />
            {scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#7de3ef' : b.id === 2 ? '#ffc16e' : '#9aa9a4'} /><text x={b.position.x} y={b.position.y + .009} textAnchor="middle" fontSize=".026" fill="#071e1b">{b.id || ''}</text></g>)}
          </svg>
        </figure>
      })}
      <p>Solid traces show ball 2’s recorded travel, including later rebounds. White dashes show the initial pair line; gold marks the pocket mouth. Balls mark starting positions. Every tested stroke contacts cue → 1 → 2 with no other ball collisions.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference plant finish ${option.label}.` : `You chose another stroke; this comparison uses plant finish ${option.label}.`} Your scored shot uses the authored offset layout, including its cue-ball finish.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setChanged(false) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
