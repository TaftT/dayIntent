import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { ToggleButton } from '../shared/ToggleButton.jsx'
import { InfoTip } from '../shared/InfoTip.jsx'
import { DurationStepper } from './DurationStepper.jsx'
import { DaysStepper } from './DaysStepper.jsx'
import { StartTimeEditor } from './StartTimeEditor.jsx'
import { PercentCompleteSlider } from './PercentCompleteSlider.jsx'
import { CategoryPicker } from './CategoryPicker.jsx'
import { RecurrenceEditor } from './RecurrenceEditor.jsx'
import { GroupSection } from './GroupSection.jsx'
import { RichTextEditor } from '../shared/RichTextEditor.jsx'
import { useItem } from '../../hooks/useItem.js'
import { useInstance } from '../../hooks/useInstance.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { todayStr } from '../../utils/dateUtils.js'

// An all-day item's duration is stored as whole days packed into
// durationMinutes (days * 1440) so it rides the same field as every other
// duration through save, sync, and rendering.
const MINUTES_PER_DAY = 1440
const allDayDaysFromMinutes = (minutes) => Math.max(1, Math.round((minutes || MINUTES_PER_DAY) / MINUTES_PER_DAY))

export function ItemDetailModal({ itemId, instanceId, date, time, initialTitle }) {
  const existingItem = useItem(itemId)
  const instance = useInstance(instanceId)
  const closeModal = useAppStore((s) => s.closeModal)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const createItem = useEntityStore((s) => s.createItem)
  const updateItem = useEntityStore((s) => s.updateItem)
  const deleteItem = useEntityStore((s) => s.deleteItem)
  const scheduleItemOnDate = useEntityStore((s) => s.scheduleItemOnDate)
  const unscheduleInstance = useEntityStore((s) => s.unscheduleInstance)
  const deleteInstanceOnly = useEntityStore((s) => s.deleteInstanceOnly)
  const deleteFutureSeries = useEntityStore((s) => s.deleteFutureSeries)
  const moveInstanceTime = useEntityStore((s) => s.moveInstanceTime)
  const moveInstanceDate = useEntityStore((s) => s.moveInstanceDate)
  const setInstancePercentComplete = useEntityStore((s) => s.setInstancePercentComplete)
  const setInstanceNotes = useEntityStore((s) => s.setInstanceNotes)
  const setInstanceDuration = useEntityStore((s) => s.setInstanceDuration)

  const isCreate = !itemId

  const [title, setTitle] = useState(existingItem?.title ?? initialTitle ?? '')
  // Duration lives on the template (existingItem) by default, but once an
  // occurrence has its own override (see setInstanceDuration / "Save for
  // all" below) the instance's own value takes precedence for that one day.
  const [durationMinutes, setDurationMinutes] = useState(
    instance ? instance.durationMinutes : (existingItem ? existingItem.durationMinutes : 30)
  )
  // Notes live on the instance once an item is scheduled — each occurrence
  // of a recurring series gets its own, same reasoning as percent complete.
  // Only a plain (unscheduled) backlog item's notes live on the item itself.
  const [notes, setNotes] = useState(instance ? instance.notes : (existingItem?.notes ?? ''))
  const [categoryId, setCategoryId] = useState(existingItem?.categoryId ?? null)
  // Progress lives on the instance once an item is scheduled — each
  // occurrence of a recurring series tracks its own completion. Only a
  // plain (unscheduled) backlog item's percent lives on the item itself.
  const [percentComplete, setPercentComplete] = useState(
    instance ? instance.percentComplete : (existingItem?.percentComplete ?? 0)
  )
  const [isAllDay, setIsAllDay] = useState(instance ? instance.isAllDay : (existingItem?.isAllDay ?? false))
  const [scheduledDate, setScheduledDate] = useState(instance?.date ?? date ?? todayStr())
  const [startTime, setStartTime] = useState(instance?.time ?? time ?? '09:00')
  const [recurrence, setRecurrence] = useState(existingItem?.recurrence ?? null)
  const [isHabit, setIsHabit] = useState(existingItem?.isHabit ?? false)
  // New items default to syncing only when signed in (the toggle below is
  // hidden while signed out); an item created offline stays local-only and
  // won't be pushed to the cloud on a later sign-in.
  const [syncEnabled, setSyncEnabled] = useState(existingItem?.syncEnabled ?? signedIn)
  const [group, setGroup] = useState(existingItem?.group ?? '')
  const [error, setError] = useState('')
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  // Notes, recurrence, habit, sync and links stay tucked away until asked for.
  // Starts open when anything inside has already been set, so existing values
  // are never hidden; otherwise stays collapsed.
  const [showMore, setShowMore] = useState(
    () =>
      Boolean(recurrence) ||
      Boolean(existingItem?.group) ||
      isHabit ||
      (!isCreate && percentComplete > 0) ||
      notes.replace(/<[^>]*>|&nbsp;/g, '').trim() !== '' ||
      Boolean(existingItem && (existingItem.parentIds?.length || existingItem.childIds?.length)) ||
      (!isCreate && syncEnabled !== signedIn)
  )

  // Deleting one occurrence of a recurring series is ambiguous — "delete"
  // could mean just this day or the whole series — so a recurring item
  // being edited from a specific instance gets both options spelled out
  // instead of a single Delete button. The same ambiguity applies to
  // duration/all-day: "Save" below only ever touches this one occurrence;
  // "Save for all" is the explicit opt-in to change the series' template.
  const isRecurringInstance = !isCreate && instanceId && existingItem?.recurrence

  // `applyToSeries` only matters for a recurring-instance edit — everywhere
  // else there's only ever one save button, and it always means "apply
  // to the item," so the default (false) is a no-op there.
  // `percentOverride` lets "Mark complete" save 100% in the same call —
  // state set just before handleSave wouldn't be visible to it yet.
  const handleSave = async (applyToSeries = false, percentOverride = null) => {
    const percent = percentOverride ?? percentComplete
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!scheduledDate) {
      setError('Pick a valid date')
      return
    }
    // Duration/all-day live on the item as the series' template. Editing one
    // occurrence defaults to changing just that occurrence (scopeToInstance)
    // — the template payload sent to updateItem below keeps the template's
    // existing values untouched, and setInstanceDuration patches the
    // instance directly instead. "Save for all" (applyToSeries) skips that
    // and lets the real edited values flow into the template payload as
    // usual, which updateItem then applies to every future occurrence.
    const scopeToInstance = isRecurringInstance && !applyToSeries
    // Notes are excluded here when editing a specific instance — they live
    // on the instance in that case (added back into the item payload only
    // for a plain, unscheduled item below).
    //
    // The series' own regular time (recurrence.time) must not be derived
    // from startTime when editing just ONE occurrence (plain "Save"):
    // startTime is seeded from that instance's own time, which can differ
    // from the series' regular time whenever this occurrence was previously
    // moved. Overwriting the rule's time with a one-off occurrence's time
    // would look like a recurrence change and trigger a full regeneration,
    // wiping out any other occurrence that had been individually moved.
    // "Save for all" (applyToSeries) is the explicit opt-in to change the
    // series' regular time — there, startTime IS the new series time.
    const recurrenceTime =
      !instanceId || applyToSeries ? (isAllDay ? null : startTime) : (recurrence?.time ?? null)
    // An all-day item carries its length as whole days (days * 1440); coerce
    // here so an untouched stepper (still holding null from old data) still
    // saves a valid 1-day span.
    const effectiveDuration = isAllDay
      ? allDayDaysFromMinutes(durationMinutes) * MINUTES_PER_DAY
      : durationMinutes
    const payload = {
      title: title.trim(),
      durationMinutes: scopeToInstance ? existingItem.durationMinutes : effectiveDuration,
      categoryId,
      isAllDay: scopeToInstance ? existingItem.isAllDay : isAllDay,
      recurrence: recurrence
        ? { ...recurrence, startDate: recurrence.startDate ?? scheduledDate, time: recurrenceTime }
        : null,
      isHabit: recurrence ? isHabit : false,
      syncEnabled,
      group: group.trim() || null,
    }

    try {
      if (isCreate) {
        const saved = await createItem({ ...payload, notes, isUnscheduled: true })
        if (recurrence) {
          await updateItem(saved.id, { recurrence: payload.recurrence, isUnscheduled: false })
        } else if (date) {
          await scheduleItemOnDate(saved.id, scheduledDate, { time: startTime, isAllDay })
        }
      } else if (instanceId) {
        // Instance-specific changes (which day/time this one occurrence
        // falls on, its own progress) go first and are independent of the
        // series — moving this occurrence must not depend on, or be undone
        // by, the item-level save below.
        if (scheduledDate !== instance?.date) {
          await moveInstanceDate(instanceId, scheduledDate)
        }
        // Plain "Save" moves just this occurrence's time. "Save for all"
        // instead flows startTime into recurrence.time above, so updateItem
        // regenerates every future occurrence at the new time — no per-
        // instance move needed (and doing one here would be undone anyway).
        if (!applyToSeries && !isAllDay && startTime !== instance?.time) {
          await moveInstanceTime(instanceId, startTime)
        }
        if (percent !== instance?.percentComplete) {
          await setInstancePercentComplete(instanceId, percent)
        }
        if (notes !== instance?.notes) {
          await setInstanceNotes(instanceId, notes)
        }
        if (scopeToInstance && (effectiveDuration !== instance?.durationMinutes || isAllDay !== instance?.isAllDay)) {
          await setInstanceDuration(instanceId, effectiveDuration, isAllDay)
        }
        await updateItem(itemId, payload)
      } else {
        // Remember the pre-completion percent so "Mark incomplete" can restore it.
        const before = existingItem?.percentComplete ?? 0
        let percentBeforeComplete = existingItem?.percentBeforeComplete ?? null
        if (percent >= 100 && before < 100) percentBeforeComplete = before
        else if (percent < 100) percentBeforeComplete = null
        await updateItem(itemId, { ...payload, percentComplete: percent, percentBeforeComplete, notes })
      }
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving this item')
    }
  }

  const handleDelete = async () => {
    await deleteItem(itemId)
    closeModal()
  }

  const handleDeleteThisInstance = async () => {
    await deleteInstanceOnly(instanceId)
    closeModal()
  }

  const handleDeleteSeries = async () => {
    // Anchor on the occurrence this modal was opened from — "delete series"
    // removes this one and every later occurrence, keeping earlier history.
    await deleteFutureSeries(itemId, instance?.date ?? date ?? todayStr())
    closeModal()
  }

  const handleUnschedule = async () => {
    await unscheduleInstance(instanceId)
    closeModal()
  }

  const handleAllDayChange = (next) => {
    setIsAllDay(next)
    // Switching in/out of all-day swaps the meaning of the duration field, so
    // reset it to a sane default for the new mode unless it already holds a
    // value that fits.
    if (next) {
      setDurationMinutes((d) => (d && d % MINUTES_PER_DAY === 0 ? d : MINUTES_PER_DAY))
    } else {
      setDurationMinutes((d) => (d && d % MINUTES_PER_DAY === 0 ? 30 : (d ?? 30)))
    }
  }

  const footer = (
    <>
      {isRecurringInstance ? (
        <>
          <Button variant="danger" onClick={handleDeleteThisInstance}>
            Delete this event
          </Button>
          <Button variant="danger" onClick={handleDeleteSeries} title="Removes this occurrence and every later one — earlier occurrences are kept">
            Delete series
          </Button>
        </>
      ) : (
        !isCreate && (
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        )
      )}
      {!isCreate && instanceId && !existingItem?.recurrence && (
        <Button variant="subtle" onClick={handleUnschedule}>
          Unschedule
        </Button>
      )}
      <Button variant="subtle" onClick={closeModal}>
        Cancel
      </Button>
    </>
  )

  // A recurring occurrence has two meanings of "save", so the header button
  // turns into a menu offering both; everywhere else it's a plain button.
  const saveButton = isRecurringInstance ? (
    <div className="save-menu">
      <Button
        variant="primary"
        onClick={() => setSaveMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={saveMenuOpen}
      >
        Save ▾
      </Button>
      {saveMenuOpen && (
        <div className="save-menu-list" role="menu">
          <button type="button" role="menuitem" onClick={() => handleSave(false)}>
            Save this event
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSave(true)}
            title="Applies time, duration and all-day changes to every future occurrence, not just this one"
          >
            Save for all
          </button>
        </div>
      )}
    </div>
  ) : (
    <Button variant="primary" onClick={() => handleSave(false)}>
      Save
    </Button>
  )

  return (
    <Modal
      title={isCreate ? 'New Item' : 'Edit Item'}
      onClose={closeModal}
      headerAction={saveButton}
    >
      <div className="item-detail-form">
        <input
          type="text"
          className="title-input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={isCreate}
        />
        {error && <div className="form-error">{error}</div>}

        <CategoryPicker categoryId={categoryId} onChange={setCategoryId} />

        <div className="scheduled-info-row">
          {date && (
            <input
              type="date"
              className="scheduled-date-input"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              aria-label="Scheduled date"
            />
          )}
          {date && !isAllDay && <StartTimeEditor time={startTime} onChange={setStartTime} />}
          {date && isRecurringInstance && (
            <InfoTip label="About changing the date or time">
              Changing the date only moves this occurrence. Changing the time moves just this
              occurrence on "Save", or the whole series' regular time on "Save for all".
            </InfoTip>
          )}
          <ToggleButton pressed={isAllDay} onChange={handleAllDayChange}>
            All day
          </ToggleButton>
        </div>
        {isAllDay ? (
          <DaysStepper
            days={allDayDaysFromMinutes(durationMinutes)}
            onChange={(d) => setDurationMinutes(d * MINUTES_PER_DAY)}
            info={isRecurringInstance ? (
              <InfoTip label="About changing the duration">
                Duration/all-day changes only apply to this occurrence — use "Save for all" in the Save menu to change every future one.
              </InfoTip>
            ) : null}
          />
        ) : (
          <DurationStepper
            durationMinutes={durationMinutes}
            onChange={setDurationMinutes}
            startTime={date ? startTime : null}
            info={isRecurringInstance ? (
              <InfoTip label="About changing the duration">
                Duration/all-day changes only apply to this occurrence — use "Save for all" in the Save menu to change every future one.
              </InfoTip>
            ) : null}
          />
        )}
        {!isCreate && percentComplete >= 100 && (
          <Button
            variant="subtle"
            onClick={() => {
              // Back to where it was before being completed (0 if unknown).
              const prev = (instanceId ? instance : existingItem)?.percentBeforeComplete
              const restored = prev != null && prev < 100 ? prev : 0
              setPercentComplete(restored)
              handleSave(false, restored)
            }}
          >
            ↺ Mark incomplete
          </Button>
        )}
        {!isCreate && percentComplete < 100 && (
          <Button variant="success" onClick={() => { setPercentComplete(100); handleSave(false, 100) }}>
            ✓ Mark complete
          </Button>
        )}

        <button
          type="button"
          className="btn btn-subtle more-options-toggle"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? 'Fewer options ▴' : 'More options ▾'}
        </button>

        {showMore && (
          <>
          {!isCreate && (
            <PercentCompleteSlider percentComplete={percentComplete} onChange={setPercentComplete} />
          )}

          <RichTextEditor value={notes} onChange={setNotes} className="notes-editor" placeholder="Notes" />

          <RecurrenceEditor recurrence={recurrence} defaultStartDate={scheduledDate} onChange={setRecurrence} />

          {recurrence && (
            <ToggleButton pressed={isHabit} onChange={setIsHabit}>
              Track as habit
            </ToggleButton>
          )}

          {signedIn && (
            <ToggleButton pressed={syncEnabled} onChange={setSyncEnabled}>
              Sync to cloud
            </ToggleButton>
          )}

          <GroupSection group={group} onChange={setGroup} />

          <div className="item-detail-actions">{footer}</div>
          </>
        )}
      </div>
    </Modal>
  )
}
