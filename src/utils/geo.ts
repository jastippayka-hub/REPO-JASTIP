// Google Maps URL & coordinate extraction helper
export function parseGoogleMapsInput(input: string): { lat: number; lng: number } | null {
  if (!input || typeof input !== 'string') return null;

  // Pattern 1: coordinates string like "0.9080, 108.9870" or "0.9080,108.9870"
  const rawCoordMatch = input.trim().match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
  if (rawCoordMatch) {
    const lat = parseFloat(rawCoordMatch[1]);
    const lng = parseFloat(rawCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 2: Google Maps query param ?q=0.9080,108.9870 or place/0.9080,108.9870
  const qMatch = input.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/i) ||
                 input.match(/\/place\/(-?\d+\.\d+),(-?\d+\.\d+)/i) ||
                 input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

// WhatsApp link generator with Indonesian phone formatting
export function formatWhatsAppUrl(phoneNumber: string, message: string): string {
  if (!phoneNumber) return '#';
  // Strip non-numeric
  let clean = phoneNumber.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
