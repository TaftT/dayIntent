import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { ToggleButton } from '../shared/ToggleButton.jsx'
import { useAppStore } from '../../store/useAppStore.js'
import { useWeatherStore } from '../../store/useWeatherStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { firebaseEnabled } from '../../firebase/config.js'
import { getProvider, listProviders } from '../../weather/providers/index.js'
import { PlaceSearch } from './PlaceSearch.jsx'
import { locKey, roundCoord } from '../../weather/weatherSettings.js'

export function WeatherModal() {
  const closeModal = useAppStore((s) => s.closeModal)
  const { settings, updateSettings } = useWeatherStore()
  const homeKey = settings.location ? locKey(settings.location) : null
  const status = useWeatherStore((s) => (homeKey ? s.status[homeKey] : null))
  const error = useWeatherStore((s) => (homeKey ? s.errors[homeKey] : null))
  const refresh = useWeatherStore((s) => s.refresh)
  const [lat, setLat] = useState(settings.location?.lat ?? '')
  const [lon, setLon] = useState(settings.location?.lon ?? '')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState(null)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  const providers = listProviders()
  const provider = getProvider(settings.providerId)

  const setLocation = (latN, lonN, label) => {
    updateSettings({ location: { lat: roundCoord(latN), lon: roundCoord(lonN), label } })
    setLat(roundCoord(latN))
    setLon(roundCoord(lonN))
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocError('This browser can’t share its location. Enter coordinates instead.')
      return
    }
    setLocating(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setLocation(pos.coords.latitude, pos.coords.longitude, 'My location')
      },
      () => {
        setLocating(false)
        setLocError('Couldn’t get your location. Allow location access, or enter coordinates instead.')
      },
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  const applyManual = () => {
    const latN = Number(lat)
    const lonN = Number(lon)
    if (lat === '' || lon === '' || !Number.isFinite(latN) || !Number.isFinite(lonN) || Math.abs(latN) > 90 || Math.abs(lonN) > 180) {
      setLocError('Enter a latitude between −90 and 90 and a longitude between −180 and 180.')
      return
    }
    setLocError(null)
    setLocation(latN, lonN, 'Custom location')
  }

  return (
    <Modal title="Weather forecast" onClose={closeModal} width={420}>
      <div className="weather-settings">
        <p className="stats-section-hint">
          Shows an hourly forecast icon beside each hour on the day view. Your location stays on this device and is
          sent only to the forecast service.
        </p>
        <ToggleButton pressed={settings.enabled} onChange={(enabled) => updateSettings({ enabled })}>
          {settings.enabled ? 'Weather on' : 'Weather off'}
        </ToggleButton>

        {providers.length > 1 && (
          <label className="weather-field">
            <span>Forecast service</span>
            <select value={settings.providerId} onChange={(e) => updateSettings({ providerId: e.target.value })}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="stats-section-hint">
          {provider.name} — {provider.coverage}, up to about {provider.maxDays} days ahead.
        </p>

        <h3 className="weather-subhead">Home location</h3>
        <PlaceSearch onPick={(p) => setLocation(p.lat, p.lon, p.label)} />
        <Button onClick={useMyLocation} loading={locating}>
          Use my location
        </Button>
        <div className="weather-coords">
          <label className="weather-field">
            <span>Latitude</span>
            <input type="number" step="0.01" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="40.71" />
          </label>
          <label className="weather-field">
            <span>Longitude</span>
            <input type="number" step="0.01" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-74.01" />
          </label>
          <Button variant="subtle" onClick={applyManual}>
            Set
          </Button>
        </div>
        {locError && <p className="weather-error">{locError}</p>}
        {settings.location && (
          <p className="stats-section-hint">
            Using {settings.location.label || 'saved location'} ({settings.location.lat}, {settings.location.lon}).
          </p>
        )}

        {firebaseEnabled && (
          <>
            <h3 className="weather-subhead">Weather history</h3>
            <ToggleButton
              pressed={settings.syncHistory}
              onChange={(syncHistory) => updateSettings({ syncHistory })}
            >
              {settings.syncHistory ? 'Syncing history to your account' : 'Sync history to your account'}
            </ToggleButton>
            <p className="stats-section-hint">
              {!signedIn
                ? 'Sign in to sync recorded weather across your devices (end-to-end encrypted, like your journal). Until then it stays on this device.'
                : needsUnlock
                  ? 'Unlock sync to start syncing.'
                  : settings.syncHistory
                    ? 'Recorded weather is encrypted and shared across your signed-in devices. Turning this off stops syncing but leaves the cloud copy in place.'
                    : 'Off: recorded weather stays on this device only. This setting is per device.'}
            </p>
          </>
        )}

        {settings.enabled && settings.location && (
          <div className="weather-status">
            {status === 'loading' && <span>Loading forecast…</span>}
            {status === 'ready' && <span>Forecast loaded.</span>}
            {status === 'error' && <span className="weather-error">{error}</span>}
            <Button variant="subtle" onClick={() => refresh()} loading={status === 'loading'}>
              Refresh
            </Button>
          </div>
        )}
        {settings.enabled && !settings.location && (
          <p className="stats-section-hint">Pick a home location to see the forecast. Events can have their own location too — set it when editing the event.</p>
        )}
      </div>
    </Modal>
  )
}
