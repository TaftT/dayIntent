/**
 * The shape every weather provider returns, so providers are interchangeable.
 *
 * To add a provider: create `providers/<id>.js` exporting an object with
 *   { id, name, coverage, maxDays, fetchHourly({ lat, lon, signal }) }
 * where fetchHourly resolves to HourlyForecast[] (upcoming hours). A provider
 * may also offer `fetchObserved({ lat, lon, signal })` returning the same shape
 * for hours that already happened; those are saved as the weather history.
 * Then register it in
 * `providers/index.js`. Nothing else needs to change.
 *
 * @typedef {Object} HourlyForecast
 * @property {string} hourKey       Location-local 'YYYY-MM-DDTHH' of the hour's start.
 * @property {string} condition     A key of CONDITIONS in conditions.js.
 * @property {boolean} isDaytime
 * @property {number|null} tempF    Degrees Fahrenheit.
 * @property {number|null} precipChance  0-100, or null when unknown.
 * @property {string} summary       Provider's own short description, for tooltips.
 */
export {}
