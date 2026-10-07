import { create } from 'zustand'
import { todayStr } from '../utils/dateUtils.js'

let highlightTimer = null

export const useAppStore = create((set) => ({
  currentDate: todayStr(),
  setCurrentDate: (date) => set({ currentDate: date }),

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
    categoryId: null,
    searchText: '',
  },
  setBacklogFilters: (partial) =>
    set((s) => ({ backlogFilters: { ...s.backlogFilters, ...partial } })),

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
