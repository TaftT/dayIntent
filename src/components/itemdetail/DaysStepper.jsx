// Duration control for an all-day item, expressed as a whole number of days
// (a 1-day item is a normal single-day all-day event). Stored on the item as
// durationMinutes = days * 1440 so it flows through sync/rendering like any
// other duration.
export function DaysStepper({ days, onChange, info }) {
  return (
    <div className="duration-stepper">
      <div className="stepper-controls">
        <button
          type="button"
          className="btn btn-subtle stepper-btn"
          onClick={() => onChange(Math.max(1, days - 1))}
          disabled={days <= 1}
          aria-label="Decrease by one day"
        >
          −
        </button>
        <span className="stepper-value">
          {days} {days === 1 ? 'day' : 'days'}
          {info}
        </span>
        <button
          type="button"
          className="btn btn-subtle stepper-btn"
          onClick={() => onChange(days + 1)}
          aria-label="Increase by one day"
        >
          +
        </button>
      </div>
    </div>
  )
}
