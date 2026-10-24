import type { RefObject } from 'react'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { highscorePercent, type HighscoreEntry } from '@/lib/highscores'
import './Highscores.css'

interface Props {
  entries: HighscoreEntry[]
  currentId?: string
  storageAvailable: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  onClose: () => void
}

const playedDate = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const playedTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' })

export default function Highscores({ entries, currentId, storageAvailable, headingRef, onClose }: Props) {
  return <>
    <div className="modal-symbol"><Trophy size={25} /></div>
    <DialogTitle ref={headingRef} tabIndex={-1}>Highscores</DialogTitle>
    <DialogDescription>Your course attempts, saved only in this browser. Unfinished attempts count too.</DialogDescription>
    {!storageAvailable && <p className="highscores-storage-note" role="status">Browser storage is unavailable. Scores will only be kept until you leave this page.</p>}
    {entries.length ? <>
      <table className="highscores-table">
        <caption className="sr-only">Course highscores</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">Played</th><th scope="col">Score</th><th scope="col">Percentage</th><th scope="col">Progress</th></tr></thead>
        <tbody>{entries.map((entry, index) => {
          const current = entry.id === currentId
          const status = entry.completedLessons >= entry.totalLessons ? 'Complete' : current ? 'In progress' : 'Unfinished'
          return <tr key={entry.id} data-current={current || undefined}>
            <th scope="row" className="highscore-rank"><span className="sr-only">Rank </span>{index + 1}</th>
            <td className="highscore-played">
              <strong>{entry.playerName}</strong>
              {entry.playedAt ? <time dateTime={entry.playedAt} title={playedTime.format(new Date(entry.playedAt))}>{playedDate.format(new Date(entry.playedAt))}</time> : <span className="highscore-date">Date unavailable</span>}
              {current && <span className="highscore-current-label">This session</span>}
            </td>
            <td className="highscore-score"><span className="highscore-mobile-label" aria-hidden="true">Score</span><strong>{entry.score.toLocaleString()} <span>pts</span></strong></td>
            <td className="highscore-percentage"><span className="highscore-mobile-label" aria-hidden="true">Percentage</span><strong>{highscorePercent(entry)}%</strong></td>
            <td className="highscore-progress"><span>{entry.completedLessons} / {entry.totalLessons} lessons</span><progress aria-label={`Course progress for ${entry.playerName}`} value={entry.completedLessons} max={entry.totalLessons} /><span className={`highscore-status${status === 'Complete' ? ' highscore-complete' : ''}`}>{status}</span></td>
          </tr>
        })}</tbody>
      </table>
      <p className="modal-note highscores-explanation">Ranked by total points. Percentage shows points earned out of the maximum for played lessons. Dates show the last scored lesson.</p>
    </> : <div className="highscores-empty"><strong>No scores yet.</strong><p>Finish a course lesson to save your first score. Your result stays here even if you stop before the end.</p></div>}
    <Button className="full-width" onClick={onClose}>Back to the game</Button>
  </>
}
