import { useId, useRef, useState, type ReactNode } from 'react'
import { Download, FileJson, Upload } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import './LevelJsonTools.css'

type LevelJsonToolsProps = {
  getJson: () => string
  onImport: (json: string) => void
  filename: string
  children?: ReactNode
}

/** One authoring surface for files produced by the course, sandbox, and lab. */
export default function LevelJsonTools({ getJson, onImport, filename, children }: LevelJsonToolsProps) {
  const input = useRef<HTMLInputElement>(null)
  const editorId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  function report(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'The level JSON could not be read.')
    setNotice('')
  }

  function apply(json: string) {
    onImport(json)
    setError(null)
    setNotice('JSON loaded. The saved layout and strokes are ready to edit.')
  }

  function download() {
    try {
      const json = getJson()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError(null)
      setNotice('JSON exported with the current layout and settings.')
    } catch (reason) { report(reason) }
  }

  return <div className="level-json-tools">
    <div className="level-json-actions" role="group" aria-label="Level authoring">
      <input ref={input} className="sr-only" type="file" accept=".json,application/json" aria-label="Import level JSON file" tabIndex={-1} onChange={async event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        try {
          if (file.size > 1_000_000) throw new Error('Choose a level JSON file smaller than 1 MB.')
          apply(await file.text())
        } catch (reason) { report(reason) }
      }} />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}><Upload size={14} /> Import JSON</Button>
      <Button type="button" variant="outline" size="sm" onClick={download}><Download size={14} /> Export JSON</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => {
        try { setDraft(getJson()); setError(null); setOpen(true) }
        catch (reason) { report(reason) }
      }}><FileJson size={14} /> Edit level JSON</Button>
      {children}
    </div>
    {!open && error && <p className="level-json-error" role="alert">{error}</p>}
    {!open && notice && <p className="level-json-notice" role="status">{notice}</p>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="level-json-dialog">
        <DialogTitle>Edit level JSON</DialogTitle>
        <DialogDescription>Tune the title, teaching text, objectives, table conditions, and shot settings. Apply validates the complete file before changing your setup. Positions use meters.</DialogDescription>
        <label htmlFor={editorId}>Level JSON</label>
        <textarea id={editorId} value={draft} onChange={event => { setDraft(event.target.value); setError(null) }} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
        {error && <p className="level-json-error" role="alert">{error}</p>}
        <div className="level-json-dialog-actions"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" onClick={() => {
          try { apply(draft); setOpen(false) }
          catch (reason) { report(reason) }
        }}>Apply JSON</Button></div>
      </DialogContent>
    </Dialog>
  </div>
}
