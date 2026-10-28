import { DEFAULT_SCORING } from './scoring.js'

const KEY = 'dayintent.scoring'

/** Scoring settings saved on this device, over the defaults. */
export function loadScoringSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    const merged = { ...DEFAULT_SCORING }
    for (const k of Object.keys(DEFAULT_SCORING)) {
      if (typeof saved?.[k] === 'number' && Number.isFinite(saved[k]) && saved[k] >= 0) merged[k] = saved[k]
    }
    return merged
  } catch {
    return { ...DEFAULT_SCORING }
  }
}

export function saveScoringSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* private mode etc. — the change just won't persist */
  }
}
