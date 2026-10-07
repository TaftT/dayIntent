export function PercentCompleteSlider({ percentComplete, onChange }) {
  return (
    <div className="percent-complete-slider">
      <div className="percent-row">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percentComplete}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="percent-value">{percentComplete}%</span>
      </div>
    </div>
  )
}
