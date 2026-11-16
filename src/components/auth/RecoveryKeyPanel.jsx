import { useEffect, useState } from 'react'
import { Button } from '../shared/Button.jsx'
import { useAuthStore } from '../../store/useAuthStore.js'
import { firebaseEnabled } from '../../firebase/config.js'
import { hasRecoveryKey } from '../../sync/keyRecovery.js'

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Settings panel: create the recovery key that rescues encrypted data after a forgotten password. */
export function RecoveryKeyPanel() {
  const user = useAuthStore((s) => s.user)
  const unlocked = useAuthStore((s) => Boolean(s.masterKey))
  const createRecoveryKey = useAuthStore((s) => s.createRecoveryKey)

  const [exists, setExists] = useState(null) // null = checking / unknown
  const [creating, setCreating] = useState(false)
  const [password, setPassword] = useState('')
  const [newKey, setNewKey] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user || !unlocked) return
    hasRecoveryKey(user.uid).then(setExists).catch(() => setExists(null))
  }, [user, unlocked])

  if (!firebaseEnabled || !user || !unlocked) return null

  const create = async () => {
    if (!password) {
      setError('Enter your account password to continue.')
      return
    }
    try {
      setBusy(true)
      setError('')
      setNewKey(await createRecoveryKey(password))
      setExists(true)
      setCreating(false)
      setPassword('')
    } catch (err) {
      setError(err?.name === 'WrongKeyError' ? 'That is not your current password.' : err?.message ?? 'Could not create the key.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
    } catch {
      /* the key is on screen to copy by hand */
    }
  }

  return (
    <section className="stats-section backup-panel">
      <div className="stats-section-header">
        <h2>Password recovery</h2>
      </div>
      <p className="stats-section-hint">
        Your data is encrypted with your password, and we can’t read it. If you forget the password, a reset email
        alone will <strong>not</strong> bring your synced data back. A recovery key will. Keep it somewhere safe
        (a password manager or printed) — anyone with it and your account can open your data.
      </p>

      {newKey && (
        <div className="backup-preview">
          <p>
            <strong>Your recovery key — shown only once:</strong>
          </p>
          <p className="recovery-key">{newKey}</p>
          <div className="backup-actions">
            <Button variant="primary" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="subtle" onClick={() => downloadText(`DayIntent recovery key\n${user.email}\n\n${newKey}\n`, 'dayintent-recovery-key.txt')}>
              Download
            </Button>
            <Button variant="subtle" onClick={() => setNewKey(null)}>
              I’ve saved it
            </Button>
          </div>
        </div>
      )}

      {!newKey && !creating && (
        <div className="backup-actions">
          <Button variant={exists ? 'subtle' : 'primary'} onClick={() => setCreating(true)}>
            {exists ? 'Make a new recovery key' : 'Create recovery key'}
          </Button>
          <span className="stats-section-hint">
            {exists === true ? 'A recovery key is set up.' : exists === false ? 'No recovery key yet.' : ''}
          </span>
        </div>
      )}

      {!newKey && creating && (
        <div className="auth-form">
          <input
            type="password"
            placeholder="Your account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            autoFocus
          />
          {exists && <p className="stats-section-hint">The old recovery key stops working once you make a new one.</p>}
          {error && <div className="form-error">{error}</div>}
          <div className="backup-actions">
            <Button variant="primary" loading={busy} onClick={create} disabled={busy}>
              Create
            </Button>
            <Button variant="subtle" onClick={() => { setCreating(false); setError('') }} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
