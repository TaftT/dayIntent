import { create } from 'zustand'
import { todayStr } from '../utils/dateUtils.js'

let highlightTimer = null

const VIEW_KEY = 'dayintent.backlogView'
// Grouped is the default: with no groups it looks identical to the flat list,
// and with groups it's the view that shows them.
function readStoredView() {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'list' || v === 'grouped' ? v : 'grouped'
  } catch {
    return 'grouped'
  }
}
function writeStoredView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {
    /* private mode etc. — the choice just won't persist */
  }
}

const SPLIT_KEY = 'dayintent.split'
function readStoredSplit() {
  try {
    const v = JSON.parse(localStorage.getItem(SPLIT_KEY))
    return { open: Boolean(v?.open), path: typeof v?.path === 'string' ? v.path : '/backlog' }
  } catch {
    return { open: false, path: '/backlog' }
  }
}
function writeStoredSplit(open, path) {
  try {
    localStorage.setItem(SPLIT_KEY, JSON.stringify({ open, path }))
  } catch {
    /* private mode etc. - the layout just won't persist */
  }
}
const pageOf = (path) => path.split('/')[1] || ''

export const useAppStore = create((set, get) => ({
  currentDate: todayStr(),
  setCurrentDate: (date) => set({ currentDate: date }),

  // Desktop split view: a second page beside the routed one. The right pane
  // keeps its own path since the browser URL only tracks the left pane.
  splitOpen: readStoredSplit().open,
  secondaryPath: readStoredSplit().path,
  setSecondaryPath: (path) => {
    writeStoredSplit(get().splitOpen, path)
    set({ secondaryPath: path })
  },
  // Opening picks a different page than the left pane is showing, so the two
  // sides start out as two different things.
  openSplit: (primaryPath) => {
    let path = get().secondaryPath
    if (pageOf(path) === pageOf(primaryPath)) {
      path = pageOf(primaryPath) === 'day' ? '/backlog' : `/day/${get().currentDate}`
    }
    writeStoredSplit(true, path)
    set({ splitOpen: true, secondaryPath: path })
  },
  closeSplit: () => {
    writeStoredSplit(false, get().secondaryPath)
    set({ splitOpen: false })
  },

  activeModal: null, // { type: 'itemDetail'|'categoryManager'|'search'|'quickAdd'|'datePicker'|'auth'|'unlock'|'syncMismatch', props }
  openModal: (type, props = {}) => set({ activeModal: { type, props } }),
  closeModal: () => set({ activeModal: null }),

  journalOpen: false,
  toggleJournal: () => set((s) => ({ journalOpen: !s.journalOpen })),

  // Day-view multi-select: double-click blocks to build this set, then drag
  // any one of them to shift the whole group by the same amount.
  selectedInstanceIds: [],
  toggleInstanceSelection: (id) =>
    set((s) => ({
      selectedInstanceIds: s.selectedInstanceIds.includes(id)
        ? s.selectedInstanceIds.filter((x) => x !== id)
        : [...s.selectedInstanceIds, id],
    })),
  clearInstanceSelection: () =>
    set((s) => (s.selectedInstanceIds.length ? { selectedInstanceIds: [] } : s)),
  // Live vertical drag offset (px) while a member of a multi-select is being
  // dragged, so the other selected blocks can follow it in real time.
  groupDragDeltaY: 0,
  setGroupDragDeltaY: (y) => set((s) => (s.groupDragDeltaY === y ? s : { groupDragDeltaY: y })),

  // Briefly highlights one item's block on the day view — set when jumping
  // there from the backlog so the user can spot what they came for.
  highlightItemId: null,
  flashItem: (itemId) => {
    clearTimeout(highlightTimer)
    set({ highlightItemId: itemId })
    highlightTimer = setTimeout(() => set({ highlightItemId: null }), 3000)
  },

  backlogFilters: {
    tab: 'todo', // 'todo' | 'scheduled' | 'recurring' | 'progress' | 'done'
    view: readStoredView(), // To do tab only: 'list' (flat, by priority) | 'grouped'
    categoryId: null,
    searchText: '',
  },
  setBacklogFilters: (partial) => {
    // The List/Grouped choice survives a reload — otherwise groups appear to
    // vanish every time the page reopens in the default view.
    if (partial.view) writeStoredView(partial.view)
    set((s) => ({ backlogFilters: { ...s.backlogFilters, ...partial } }))
  },

  // Only ever one toast on screen: a new one replaces whatever's showing and
  // stays until the user dismisses it (or it's replaced again). Stacking
  // reminders buried the bottom nav and each other, so newest-wins instead.
  toasts: [],
  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    set({ toasts: [{ id, ...toast }] })
    return id
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
