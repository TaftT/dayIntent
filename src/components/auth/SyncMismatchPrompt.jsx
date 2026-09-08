import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useAppStore } from '../../store/useAppStore.js'

// Shown when this browser's local data was last synced under a different
// account. Sync is already running in pull-only mode (this account's cloud
// data is on screen and stays live), so this is just an explanation plus the
// two ways out — adopt this device, or sign out. "Keep cloud data only" is
// simply closing the dialog.
export function SyncMismatchPrompt() {
  const closeModal = useAppStore((s) => s.closeModal)
  const user = useAuthStore((s) => s.user)
  const forceSyncThisDevice = useAuthStore((s) => s.forceSyncThisDevice)
  const signOut = useAuthStore((s) => s.signOut)
  const [busy, setBusy] = useState(false)

  const handleAdopt = async () => {
    setBusy(true)
    try {
      await forceSyncThisDevice()
      closeModal()
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    await signOut()
    closeModal()
  }

  const footer = (
    <>
      <Button variant="subtle" onClick={handleSignOut} disabled={busy}>
        Sign out
      </Button>
      <Button variant="primary" onClick={handleAdopt} disabled={busy}>
        {busy ? <span className="btn-spinner" aria-label="Working…" /> : 'Sync this device too'}
      </Button>
    </>
  )

  return (
    <Modal title="Showing cloud data only" onClose={closeModal} footer={footer}>
      <div className="auth-form">
        <p className="form-hint">
          You're signed in as {user?.email}. This account's cloud data is showing and stays up to
          date, but this device also has local items from a different account that aren't being
          synced here.
        </p>
        <p className="form-hint">
          <strong>Sync this device too</strong> pushes those local items into {user?.email}'s cloud.
          <strong> Sign out</strong> removes this account's synced data from the device again. Or
          just close this to keep viewing cloud data only.
        </p>
      </div>
    </Modal>
  )
}
