import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { RecoverWithKey } from './RecoverWithKey.jsx'

function friendlyError(err) {
  const code = err?.code ?? ''
  if (code.includes('email-already-in-use')) return 'An account with this email already exists.'
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Incorrect email or password.'
  }
  if (code.includes('weak-password')) return 'Password is too weak (use at least 8 characters).'
  if (code.includes('invalid-email')) return 'That email address looks invalid.'
  if (err?.name === 'WrongKeyError') {
    return 'You are signed in, but this password does not open your encrypted data. If you reset your password, choose “Use recovery key” below.'
  }
  if (code.includes('too-many-requests')) return 'Too many attempts — try again later.'
  return err?.message ?? 'Something went wrong.'
}

export function AuthModal() {
  const closeModal = useAppStore((s) => s.closeModal)
  const signUp = useAuthStore((s) => s.signUp)
  const signIn = useAuthStore((s) => s.signIn)
  const resetPassword = useAuthStore((s) => s.resetPassword)

  const [mode, setMode] = useState('signIn') // 'signIn' | 'signUp' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsRecovery, setNeedsRecovery] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (mode === 'forgot') {
      try {
        setBusy(true)
        await resetPassword(email.trim())
        setInfo('Password reset email sent.')
      } catch (err) {
        setError(friendlyError(err))
      } finally {
        setBusy(false)
      }
      return
    }

    if (!password) {
      setError('Password is required')
      return
    }
    if (mode === 'signUp' && password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (mode === 'signUp' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      setBusy(true)
      if (mode === 'signUp') {
        await signUp(email.trim(), password)
      } else {
        await signIn(email.trim(), password)
      }
      closeModal()
    } catch (err) {
      setError(friendlyError(err))
      if (err?.name === 'WrongKeyError') setNeedsRecovery(true)
    } finally {
      setBusy(false)
    }
  }

  const footer = mode === 'recover' ? null : (
    <>
      <Button variant="subtle" onClick={closeModal}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit} disabled={busy}>
        {busy ? (
          <span className="btn-spinner" aria-label="Working…" />
        ) : mode === 'signUp' ? (
          'Sign up'
        ) : mode === 'forgot' ? (
          'Send reset email'
        ) : (
          'Sign in'
        )}
      </Button>
    </>
  )

  const title = mode === 'recover' ? 'Recover your data' : mode === 'signUp' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in'

  return (
    <Modal title={title} onClose={closeModal} footer={footer}>
      {mode === 'recover' ? (
        <RecoverWithKey initialPassword={password} onDone={closeModal} onCancel={() => setMode('signIn')} />
      ) : (
      <div className="auth-form">
        <p className="form-hint">
          Cloud sync is optional — signing in only lets items you mark "Sync to cloud" follow you across
          devices. Everything is encrypted with your password before it leaves this device; we never see it.
        </p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        {mode !== 'forgot' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        )}
        {mode === 'signUp' && (
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        )}
        {error && <div className="form-error">{error}</div>}
        {needsRecovery && mode === 'signIn' && (
          <button type="button" className="link-button" onClick={() => setMode('recover')}>
            Use recovery key
          </button>
        )}
        {info && <div className="form-hint">{info}</div>}
        <div className="auth-mode-switch">
          {mode === 'signIn' && (
            <>
              <button type="button" className="link-button" onClick={() => setMode('signUp')}>
                Need an account? Sign up
              </button>
              <button type="button" className="link-button" onClick={() => setMode('forgot')}>
                Forgot password?
              </button>
            </>
          )}
          {mode === 'signUp' && (
            <button type="button" className="link-button" onClick={() => setMode('signIn')}>
              Already have an account? Sign in
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="link-button" onClick={() => setMode('signIn')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
      )}
    </Modal>
  )
}
