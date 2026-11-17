import { useState } from 'react'
import { Button } from '../shared/Button.jsx'
import { useAuthStore } from '../../store/useAuthStore.js'

/**
 * Forgotten password: enter the recovery key plus the account's CURRENT password
 * (the one you just signed in with, or reset to by email). The recovery key opens
 * the original encryption key and ties it to that password.
 */
export function RecoverWithKey({ initialPassword = '', onDone, onCancel }) {
  const recoverWithKey = useAuthStore((s) => s.recoverWithKey)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [password, setPassword] = useState(initialPassword)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!recoveryKey.trim() || !password) {
      setError('Enter your recovery key and your current account password.')
      return
    }
    try {
      setBusy(true)
      setError('')
      await recoverWithKey(recoveryKey, password)
      onDone?.()
    } catch (err) {
      setError(err?.message ?? 'Could not recover with that key.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-form">
      <p className="form-hint">
        Resetting your password by email can’t unlock your encrypted data — only your recovery key can. Enter it
        below along with your current account password (the new one, if you just reset it).
      </p>
      <input
        type="text"
        placeholder="Recovery key (XXXX-XXXX-…)"
        value={recoveryKey}
        onChange={(e) => setRecoveryKey(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
      />
      <input
        type="password"
        placeholder="Current account password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {error && <div className="form-error">{error}</div>}
      <div className="backup-actions">
        <Button variant="primary" loading={busy} onClick={submit} disabled={busy}>
          Recover my data
        </Button>
        {onCancel && (
          <Button variant="subtle" onClick={onCancel} disabled={busy}>
            Back
          </Button>
        )}
      </div>
    </div>
  )
}
