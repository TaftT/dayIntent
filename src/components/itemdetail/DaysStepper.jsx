// Duration control for an all-day item, expressed as a whole number of days
// (a 1-day item is a normal single-day all-day event). Stored on the item as
// durationMinutes = days * 1440 so it flows through sync/rendering like any
// other duration.
export function DaysStepper({ days, onChange }) {
  return (
    <div className="duration-stepper">
      <div className="stepper-controls">
        <button
          type="button"
          className="icon-button"
          onClick={() => onChange(Math.max(1, days - 1))}
          disabled={days <= 1}
          aria-label="Decrease by one day"
        >
          −
        </button>
        <span className="stepper-value">
          {days} {days === 1 ? 'day' : 'days'}
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={() => onChange(days + 1)}
          aria-label="Increase by one day"
        >
          +
        </button>
      </div>
    </div>
  )
}
