import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { RecoverWithKey } from './RecoverWithKey.jsx'

export function UnlockPrompt() {
  const closeModal = useAppStore((s) => s.closeModal)
  const user = useAuthStore((s) => s.user)
  const unlock = useAuthStore((s) => s.unlock)
  const signOut = useAuthStore((s) => s.signOut)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(false)

  const handleUnlock = async () => {
    if (!password) {
      setError('Enter your password')
      return
    }
    try {
      setBusy(true)
      setError('')
      await unlock(password)
      closeModal()
    } catch (err) {
      setError(err?.name === 'WrongKeyError' ? 'Incorrect password' : err?.message ?? 'Could not unlock. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    closeModal()
  }

  const footer = recovering ? null : (
    <>
      <Button variant="subtle" onClick={handleSignOut} disabled={busy}>
        Sign out instead
      </Button>
      <Button variant="primary" onClick={handleUnlock} disabled={busy}>
        {busy ? <span className="btn-spinner" aria-label="Unlocking…" /> : 'Unlock'}
      </Button>
    </>
  )

  return (
    <Modal title={recovering ? 'Recover your data' : 'Resume cloud sync'} onClose={closeModal} footer={footer}>
      {recovering ? (
        <RecoverWithKey onDone={closeModal} onCancel={() => setRecovering(false)} />
      ) : (
      <div className="auth-form">
        <p className="form-hint">
          Signed in as {user?.email}. Re-enter your password to resume encrypted cloud sync — everything
          else keeps working without it.
        </p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          autoFocus
        />
        {error && <div className="form-error">{error}</div>}
        <button type="button" className="link-button" onClick={() => setRecovering(true)}>
          Forgot password? Use your recovery key
        </button>
      </div>
      )}
    </Modal>
  )
}
