import { useState } from 'react'
import { useEntityStore } from '../../store/useEntityStore.js'
import { Button } from '../shared/Button.jsx'
import { DEFAULT_SCORING, computeScore } from '../../utils/scoring.js'
import { loadScoringSettings, saveScoringSettings } from '../../utils/scoringSettings.js'
import { formatShortDate } from '../../utils/dateUtils.js'

const MAX_STRIP_DAYS = 92

const SETTING_FIELDS = [
  { key: 'completionPoints', label: 'Points for finishing a planned 1-hour item', step: 1 },
  { key: 'movePenaltyBase', label: 'Cost of any move', step: 0.5 },
  { key: 'movePenaltyPerHour', label: 'Extra cost per hour moved', step: 0.1 },
  { key: 'maxPenaltyPerMove', label: 'Most one move can cost (before the lock multiplier)', step: 1 },
  { key: 'lockedMultiplier', label: 'Locked items: multiply a move’s cost by', step: 0.5 },
  { key: 'graceMinutes', label: 'Free moves within this many minutes of scheduling', step: 1 },
]

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

function ScoreStrip({ days }) {
  const maxAbs = Math.max(0, ...days.map((d) => Math.abs(d.points)))
  return (
    <div className="mood-strip">
      {days.map((d) => (
        <div key={d.date} className="mood-strip-day" title={`${formatShortDate(d.date)}: ${signed(d.points)}`}>
          {d.points !== 0 && (
            <div
              className={`mood-strip-bar ${d.points > 0 ? 'positive' : 'negative'}`}
              style={{ height: `${Math.max((Math.abs(d.points) / maxAbs) * 50, 2)}%` }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function ScoreSettings({ settings, onChange }) {
  return (
    <details className="score-settings">
      <summary>Scoring settings</summary>
      <div className="score-settings-grid">
        {SETTING_FIELDS.map((f) => (
          <label key={f.key}>
            <span>{f.label}</span>
            <input
              type="number"
              min="0"
              step={f.step}
              value={settings[f.key]}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (e.target.value !== '' && Number.isFinite(n) && n >= 0) onChange({ ...settings, [f.key]: n })
              }}
            />
          </label>
        ))}
      </div>
      <Button variant="subtle" onClick={() => onChange({ ...DEFAULT_SCORING })}>
        Reset to defaults
      </Button>
    </details>
  )
}

export function ScoreSection({ from, to }) {
  const allInstances = useEntityStore((s) => s.allInstances)
  const [settings, setSettingsState] = useState(loadScoringSettings)
  const setSettings = (next) => {
    saveScoringSettings(next)
    setSettingsState(next)
  }
  const score = computeScore(allInstances, settings, from, to)
  const anything = score.completed > 0 || score.moveCount > 0

  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <h2>Planner score</h2>
        <span className="stats-section-total">{signed(score.total)} pts</span>
      </div>
      <p className="stats-section-hint">
        Finishing what you planned earns points. Moving a scheduled item costs points, more the further it moves, and
        a lot more if it was locked. Items logged after the fact don&apos;t count as planned.
      </p>
      {!anything ? (
        <div className="empty-state">Nothing planned and finished in this range yet.</div>
      ) : (
        <>
          <div className="stat-tile-row">
            <div className="stat-tile">
              <span className="stat-tile-value">{signed(score.earned)}</span>
              <span className="stat-tile-label">Earned ({score.completed} done)</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-value">{signed(-score.dockedMoves)}</span>
              <span className="stat-tile-label">Moves</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-value">{signed(-score.dockedLocked)}</span>
              <span className="stat-tile-label">Locked moves ({score.lockedMoveCount})</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-value">
                {score.completedClean}/{score.completed}
              </span>
              <span className="stat-tile-label">Done without moving</span>
            </div>
          </div>
          {score.days.length <= MAX_STRIP_DAYS ? (
            <ScoreStrip days={score.days} />
          ) : (
            <p className="stats-section-hint">Pick a range of {MAX_STRIP_DAYS} days or fewer to see the daily chart.</p>
          )}
        </>
      )}
      <ScoreSettings settings={settings} onChange={setSettings} />
    </section>
  )
}
