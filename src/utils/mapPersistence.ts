export interface PersistedMapState {
  storeLat: number;
  storeLng: number;
  storeName?: string;
  storeAddress?: string;
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddress?: string;
  deliverySubDistrict?: string;
  mapPickerTarget?: 'store' | 'delivery';
  zoom?: number;
  center?: [number, number];
  updatedAt?: number;
}

export const DEFAULT_SINGKAWANG_MAP_STATE: PersistedMapState = {
  storeLat: 0.9080,
  storeLng: 108.9870,
  storeName: '',
  storeAddress: 'Singkawang Barat, Kalimantan Barat',
  deliveryLat: 0.9040,
  deliveryLng: 108.9820,
  deliveryAddress: 'Jl. Tani Gg. Sejahtera No. 18, Singkawang Barat',
  deliverySubDistrict: 'Singkawang Barat',
  mapPickerTarget: 'delivery',
  zoom: 14,
  center: [0.9069, 108.9866],
};

const DEFAULT_STORAGE_KEY = 'payka_jastip_map_state';

/**
 * Saves current map positions and preferences to localStorage
 */
export function saveMapState(
  state: Partial<PersistedMapState>,
  storageKey = DEFAULT_STORAGE_KEY
): void {
  try {
    const existing = loadMapState(storageKey) || { ...DEFAULT_SINGKAWANG_MAP_STATE };
    const merged: PersistedMapState = {
      ...existing,
      ...state,
      updatedAt: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch (err) {
    console.debug('Failed to save map state:', err);
  }
}

/**
 * Loads persisted map state from localStorage, returns null or validated state
 */
export function loadMapState(storageKey = DEFAULT_STORAGE_KEY): PersistedMapState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.storeLat === 'number' &&
      !isNaN(parsed.storeLat) &&
      typeof parsed.deliveryLat === 'number' &&
      !isNaN(parsed.deliveryLat)
    ) {
      return parsed as PersistedMapState;
    }
  } catch (err) {
    console.debug('Failed to load map state:', err);
  }
  return null;
}

/**
 * Clears saved map state from localStorage
 */
export function clearMapState(storageKey = DEFAULT_STORAGE_KEY): void {
  try {
    localStorage.removeItem(storageKey);
  } catch (err) {
    console.debug('Failed to clear map state:', err);
  }
}

/**
 * Utility to calculate distance between two coordinates in km
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
