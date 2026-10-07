import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { firebaseEnabled } from '../../firebase/config.js'
import { DayNavControls } from '../dayview/DayNavControls.jsx'
import { Icon } from '../shared/Icon.jsx'
import { useJournal } from '../../hooks/useJournal.js'
import { isRichTextEmpty } from '../../utils/richText.js'

export function TopBar({ date }) {
  const openModal = useAppStore((s) => s.openModal)
  const toggleJournal = useAppStore((s) => s.toggleJournal)
  const authReady = useAuthStore((s) => s.ready)
  const user = useAuthStore((s) => s.user)
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  const syncing = useAuthStore((s) => s.syncing)
  const ownerMismatch = useAuthStore((s) => s.ownerMismatch)
  const resync = useAuthStore((s) => s.resync)
  const signOut = useAuthStore((s) => s.signOut)
  // Loading the journal here (not just when the panel is open) lets the
  // button itself reflect whether this day already has an entry. Only
  // fetched when there's an actual day (Backlog/Stats render TopBar with no
  // date and no journal button).
  const { journal } = useJournal(date ?? null)
  const hasJournalEntry = Boolean(
    journal &&
      (!isRichTextEmpty(journal.content) ||
        journal.mood ||
        journal.spouseMood ||
        journal.screenTimeMinutes != null)
  )

  return (
    <header className="top-bar">
      <div className="top-bar-left">{date && <DayNavControls date={date} />}</div>
      <div className="top-bar-right">
        {date && (
          <button
            className={hasJournalEntry ? 'icon-button icon-button-journal-has-entry' : 'icon-button'}
            onClick={toggleJournal}
            aria-label={hasJournalEntry ? 'Journal (entry saved for this day)' : 'Journal'}
          >
            <Icon name="journal" />
          </button>
        )}
        <button className="icon-button" onClick={() => openModal('search')} aria-label="Search">
          <Icon name="search" />
        </button>
        <button className="icon-button" onClick={() => openModal('categoryManager')} aria-label="Organize categories and groups">
          <Icon name="categories" />
        </button>
        {firebaseEnabled && authReady && (
          <div className="account-controls">
            {!user && (
              <button className="icon-button" onClick={() => openModal('auth')} aria-label="Sign in">
                Sign in
              </button>
            )}
            {user && needsUnlock && (
              <button className="icon-button account-locked" onClick={() => openModal('unlock')} aria-label="Unlock cloud sync">
                🔒 Unlock sync
              </button>
            )}
            {user && !needsUnlock && ownerMismatch && (
              <button
                className="icon-button account-locked"
                onClick={() => openModal('syncMismatch')}
                aria-label="This device also has local data that isn't synced to this account"
                title="Showing this account's cloud data. This device also has local data that isn't synced here."
              >
                ⚠️ Cloud only
              </button>
            )}
            {user && !needsUnlock && !ownerMismatch && (
              <>
                <span className="account-email" title={syncing ? 'Syncing…' : user.email}>
                  {syncing ? <span className="btn-spinner" aria-label="Syncing" /> : '☁'} {user.email}
                </span>
                <button
                  className="icon-button"
                  onClick={resync}
                  disabled={syncing}
                  aria-label="Resync now"
                  title="Force a full resync — use this if a change on another device hasn't shown up here"
                >
                  ⟳
                </button>
                <button className="icon-button" onClick={signOut} aria-label="Sign out">
                  Sign out
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
