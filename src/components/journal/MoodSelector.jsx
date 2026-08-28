const MOODS = ['😞', '😕', '😐', '🙂', '😄']

export function MoodSelector({ mood, onChange, label = 'Mood' }) {
  return (
    <div className="mood-selector">
      {label && <span className="mood-selector-label">{label}</span>}
      <div className="mood-selector-buttons">
        {MOODS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`mood-button ${mood === emoji ? 'selected' : ''}`}
            onClick={() => onChange(mood === emoji ? null : emoji)}
            aria-label={`${label}: ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
