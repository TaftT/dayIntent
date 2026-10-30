import { useState } from 'react'
import { Button } from '../shared/Button.jsx'
import { searchPlaces } from '../../weather/geocoding.js'

// Type a place name, pick from the matches. onPick gets { label, lat, lon }.
export function PlaceSearch({ onPick, placeholder = 'City or place' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  const search = async () => {
    setSearching(true)
    setError(null)
    try {
      setResults(await searchPlaces(query))
    } catch {
      setResults(null)
      setError('Couldn’t search for places right now.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="place-search">
      <div className="place-search-row">
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault() // don't submit an enclosing form
              if (query.trim()) search()
            }
          }}
        />
        <Button type="button" variant="subtle" onClick={search} loading={searching} disabled={query.trim().length < 2}>
          Search
        </Button>
      </div>
      {error && <p className="weather-error">{error}</p>}
      {results && results.length === 0 && <p className="stats-section-hint">No places found.</p>}
      {results && results.length > 0 && (
        <ul className="place-search-results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon},${r.label}`}>
              <button
                type="button"
                className="place-search-result"
                onClick={() => {
                  onPick(r)
                  setResults(null)
                  setQuery('')
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
