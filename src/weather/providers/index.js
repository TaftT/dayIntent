import { nws } from './nws.js'

// The registry of weather providers. Add new ones here (see ../types.js).
export const providers = { [nws.id]: nws }

export const DEFAULT_PROVIDER_ID = nws.id

export function getProvider(id) {
  return providers[id] ?? providers[DEFAULT_PROVIDER_ID]
}

export function listProviders() {
  return Object.values(providers)
}
