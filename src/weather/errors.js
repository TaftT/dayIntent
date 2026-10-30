/** A weather lookup failed in a way worth telling the user about. */
export class WeatherError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'WeatherError'
    this.code = code // 'network' | 'http' | 'unsupported-location' | 'no-provider'
  }
}
