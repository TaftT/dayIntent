import { useEffect, useRef, useState } from 'react'
import { Button } from '../shared/Button.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { exportBackup, parseBackup, importBackup, summarize, BackupError } from '../../data/backup.js'
import { todayStr } from '../../utils/dateUtils.js'

const LABELS = {
  items: 'items',
  instances: 'scheduled events',
  categories: 'categories',
  groups: 'groups',
  journals: 'journal days',
  weatherDays: 'weather days',
}

function downloadJson(doc, filename) {
  const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Backup & restore: download everything as a file, or load one back in. */
export function BackupPanel() {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { kind: 'ok' | 'error', text }
  const [pending, setPending] = useState(null) // parsed backup awaiting a mode choice
  const [persisted, setPersisted] = useState(null) // null = unknown / unsupported

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
  }, [])

  const handleExport = async () => {
    setBusy(true)
    setMessage(null)
    try {
      downloadJson(await exportBackup(), `dayintent-backup-${todayStr()}.json`)
      setMessage({ kind: 'ok', text: 'Backup downloaded. Keep it somewhere private — it is not encrypted.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not create the backup.' })
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMessage(null)
    setPending(null)
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof BackupError ? err.message : 'Could not read that file.' })
    }
  }

  const handleImport = async (mode) => {
    setBusy(true)
    setMessage(null)
    try {
      const r = await importBackup(pending, { mode })
      const s = useEntityStore.getState()
      await Promise.all([s.refreshCategories(), s.refreshGroups(), s.refreshItems(), s.refreshAllInstances(), s.refreshAllJournals()])
      await s.reloadLoadedDates()
      setPending(null)
      setMessage({ kind: 'ok', text: `Imported: ${r.added} added, ${r.updated} updated, ${r.unchanged} already up to date.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Import failed.' })
    } finally {
      setBusy(false)
    }
  }

  const handleProtect = async () => {
    try {
      setPersisted(await navigator.storage.persist())
    } catch {
      /* unsupported */
    }
  }

  const counts = pending ? summarize(pending) : null

  return (
    <section className="stats-section backup-panel">
      <div className="stats-section-header">
        <h2>Backup &amp; restore</h2>
      </div>
      <p className="stats-section-hint">
        Download a copy of everything on this device, or load one back in. The file is plain text (not encrypted), so
        keep it private. Nothing is ever deleted by an import.
      </p>

      <div className="backup-actions">
        <Button variant="primary" loading={busy && !pending} onClick={handleExport} disabled={busy}>
          Download backup
        </Button>
        <Button variant="subtle" onClick={() => fileRef.current?.click()} disabled={busy}>
          Import from file…
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} hidden />
      </div>

      {pending && (
        <div className="backup-preview">
          <p>
            <strong>Backup from {pending.exportedAt ? new Date(pending.exportedAt).toLocaleString() : 'an unknown date'}</strong>
            <br />
            {Object.entries(counts)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => `${n} ${LABELS[k]}`)
              .join(' · ') || 'No data in this file.'}
          </p>
          <div className="backup-actions">
            <Button variant="primary" loading={busy} onClick={() => handleImport('merge')} disabled={busy}>
              Merge (keep newest)
            </Button>
            <Button variant="subtle" onClick={() => handleImport('restore')} disabled={busy}>
              Restore (file wins)
            </Button>
            <Button variant="subtle" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
          <p className="stats-section-hint">
            <strong>Merge</strong> adds anything missing and updates only what the file has newer. <strong>Restore</strong>{' '}
            puts every record from the file back, replacing what is here — including on your other devices once they
            sync.
          </p>
        </div>
      )}

      {message && (
        <p className={message.kind === 'error' ? 'backup-message backup-error' : 'backup-message'} role="status">
          {message.text}
        </p>
      )}

      {persisted === false && (
        <p className="stats-section-hint">
          Your browser may clear this app’s data when space is low or after a long time unused.{' '}
          <button type="button" className="link-button" onClick={handleProtect}>
            Ask the browser to keep it
          </button>
          , and download a backup now and then.
        </p>
      )}
      {persisted === true && <p className="stats-section-hint">Browser storage is protected from automatic clearing.</p>}
    </section>
  )
}
