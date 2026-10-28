import { useEntityStore } from '../../store/useEntityStore.js'
import { formatScore, readTally, sideScore } from '../../utils/moodTally.js'

const ROWS = [
  { who: 'me', label: 'Me' },
  { who: 'others', label: 'Others' },
]

// Tap + for each good thing and − for each bad thing as the day goes; the
// day's score is the difference (10 good, 4 bad = +6).
export function MoodTally({ date, journal }) {
  const adjust = useEntityStore((s) => s.adjustMoodTally)
  const tally = readTally(journal)

  return (
    <div className="mood-tally">
      {ROWS.map(({ who, label }) => {
        const side = tally[who]
        const score = sideScore(side)
        return (
          <div key={who} className="mood-tally-row">
            <span className="mood-selector-label">{label}</span>
            <div className="mood-tally-side">
              <button
                type="button"
                className="mood-tally-button negative"
                onClick={() => adjust(date, who, 'neg', 1)}
                aria-label={`${label}: add a negative (now ${side.neg})`}
              >
                {'−'} {side.neg}
              </button>
              <button
                type="button"
                className="mood-tally-undo"
                onClick={() => adjust(date, who, 'neg', -1)}
                disabled={side.neg === 0}
                aria-label={`${label}: remove a negative`}
              >
                undo
              </button>
            </div>
            <div className="mood-tally-side">
              <button
                type="button"
                className="mood-tally-button positive"
                onClick={() => adjust(date, who, 'pos', 1)}
                aria-label={`${label}: add a positive (now ${side.pos})`}
              >
                + {side.pos}
              </button>
              <button
                type="button"
                className="mood-tally-undo"
                onClick={() => adjust(date, who, 'pos', -1)}
                disabled={side.pos === 0}
                aria-label={`${label}: remove a positive`}
              >
                undo
              </button>
            </div>
            <span className={`mood-tally-score ${score > 0 ? 'positive' : score < 0 ? 'negative' : ''}`}>
              = {formatScore(score)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
