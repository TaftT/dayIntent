import { useEffect } from 'react'
import { useEntityStore } from '../store/useEntityStore.js'
import { useAppStore } from '../store/useAppStore.js'

/**
 * Ctrl/Cmd+Z undoes the last drag-move, but never while typing or with a form
 * open, where it has its own meaning. Pass `enabled: false` for the secondary
 * pane of a split view so two day/week views don't undo twice.
 */
export function useUndoMoveShortcut(enabled = true) {
  const undoLastMove = useEntityStore((s) => s.undoLastMove)
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (useAppStore.getState().activeModal) return
      e.preventDefault()
      undoLastMove()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, undoLastMove])
}
