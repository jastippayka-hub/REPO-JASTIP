/**
 * Geographic and Coordinate Validation Utilities for PAYKAJASTIP Singkawang
 */

export interface CoordinateValidationResult {
  valid: boolean;
  lat: number;
  lng: number;
  error?: string;
}

export interface OrderCoordinatesValidationResult {
  valid: boolean;
  storeLat: number;
  storeLng: number;
  deliveryLat: number;
  deliveryLng: number;
  distanceKm: number;
  error?: string;
}

// Center of Singkawang City
export const SINGKAWANG_CENTER = {
  lat: 0.9069,
  lng: 108.9866,
};

// West Kalimantan Regional Bounding Box with buffer
export const KALBAR_BOUNDS = {
  minLat: -3.5,
  maxLat: 2.5,
  minLng: 107.5,
  maxLng: 114.5,
};

/**
 * Calculates Haversine distance in kilometers between two GPS points
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

/**
 * Validates a single pair of latitude and longitude coordinates.
 */
export function validateCoordinate(
  latInput: any,
  lngInput: any,
  fieldName = 'Titik lokasi',
  options: {
    enforceRegionalBounds?: boolean;
    maxDistanceFromSingkawangKm?: number;
  } = {}
): CoordinateValidationResult {
  const {
    enforceRegionalBounds = true,
    maxDistanceFromSingkawangKm = 120, // Max 120 km radius from Singkawang (covers Sambas, Bengkayang, Mempawah)
  } = options;

  if (latInput === undefined || latInput === null || latInput === '' ||
      lngInput === undefined || lngInput === null || lngInput === '') {
    return {
      valid: false,
      lat: NaN,
      lng: NaN,
      error: `Koordinat ${fieldName} (latitude & longitude) wajib diisi.`,
    };
  }

  const lat = typeof latInput === 'number' ? latInput : parseFloat(latInput);
  const lng = typeof lngInput === 'number' ? lngInput : parseFloat(lngInput);

  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
    return {
      valid: false,
      lat: NaN,
      lng: NaN,
      error: `Koordinat ${fieldName} harus berupa angka numerik desimal yang valid.`,
    };
  }

  // WGS-84 standard limits
  if (lat < -90 || lat > 90) {
    return {
      valid: false,
      lat,
      lng,
      error: `Latitude ${fieldName} (${lat}) tidak valid (harus berada antara -90 dan 90 derajat).`,
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      valid: false,
      lat,
      lng,
      error: `Longitude ${fieldName} (${lng}) tidak valid (harus berada antara -180 dan 180 derajat).`,
    };
  }

  // Null Island check (0, 0)
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return {
      valid: false,
      lat,
      lng,
      error: `Koordinat ${fieldName} tidak boleh berada di titik nol (0, 0). Harap pilih lokasi di area Singkawang.`,
    };
  }

  // Regional bounds validation
  if (enforceRegionalBounds) {
    const isWithinKalbar =
      lat >= KALBAR_BOUNDS.minLat &&
      lat <= KALBAR_BOUNDS.maxLat &&
      lng >= KALBAR_BOUNDS.minLng &&
      lng <= KALBAR_BOUNDS.maxLng;

    if (!isWithinKalbar) {
      return {
        valid: false,
        lat,
        lng,
        error: `Koordinat ${fieldName} (${lat.toFixed(4)}, ${lng.toFixed(4)}) berada di luar wilayah layanan Kalimantan Barat / Singkawang.`,
      };
    }

    const distFromCenter = calculateDistanceKm(
      SINGKAWANG_CENTER.lat,
      SINGKAWANG_CENTER.lng,
      lat,
      lng
    );

    if (distFromCenter > maxDistanceFromSingkawangKm) {
      return {
        valid: false,
        lat,
        lng,
        error: `Titik ${fieldName} berjarak ${distFromCenter} km dari pusat Singkawang (melebihi batas jangkauan layanan kurir ${maxDistanceFromSingkawangKm} km).`,
      };
    }
  }

  return { valid: true, lat, lng };
}

/**
 * Validates order location coordinates for both store and delivery destinations.
 */
export function validateOrderCoordinates(body: {
  storeLat: any;
  storeLng: any;
  deliveryLat: any;
  deliveryLng: any;
}): OrderCoordinatesValidationResult {
  const storeCheck = validateCoordinate(body.storeLat, body.storeLng, 'Toko', {
    enforceRegionalBounds: true,
    maxDistanceFromSingkawangKm: 100,
  });

  if (!storeCheck.valid) {
    return {
      valid: false,
      storeLat: NaN,
      storeLng: NaN,
      deliveryLat: NaN,
      deliveryLng: NaN,
      distanceKm: 0,
      error: storeCheck.error,
    };
  }

  const deliveryCheck = validateCoordinate(body.deliveryLat, body.deliveryLng, 'Pengantaran', {
    enforceRegionalBounds: true,
    maxDistanceFromSingkawangKm: 100,
  });

  if (!deliveryCheck.valid) {
    return {
      valid: false,
      storeLat: storeCheck.lat,
      storeLng: storeCheck.lng,
      deliveryLat: NaN,
      deliveryLng: NaN,
      distanceKm: 0,
      error: deliveryCheck.error,
    };
  }

  // Check distance between store and delivery destination (max 60 km for local courier trips)
  const tripDist = calculateDistanceKm(
    storeCheck.lat,
    storeCheck.lng,
    deliveryCheck.lat,
    deliveryCheck.lng
  );

  if (tripDist > 60) {
    return {
      valid: false,
      storeLat: storeCheck.lat,
      storeLng: storeCheck.lng,
      deliveryLat: deliveryCheck.lat,
      deliveryLng: deliveryCheck.lng,
      distanceKm: tripDist,
      error: `Jarak pengantaran dari toko ke tujuan terlalu jauh (${tripDist} km). Maksimal jarak jastip lokal adalah 60 km.`,
    };
  }

  return {
    valid: true,
    storeLat: storeCheck.lat,
    storeLng: storeCheck.lng,
    deliveryLat: deliveryCheck.lat,
    deliveryLng: deliveryCheck.lng,
    distanceKm: Math.max(0.5, tripDist),
  };
}
