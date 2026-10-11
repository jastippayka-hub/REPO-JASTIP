import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface SingkawangMapProps {
  storePos?: { lat: number; lng: number; title: string };
  deliveryPos?: { lat: number; lng: number; title: string };
  driverPos?: { lat: number; lng: number; title: string; plate?: string };
  selectable?: boolean;
  onSelectPos?: (lat: number, lng: number) => void;
  className?: string;
  zoom?: number;
}

export const SingkawangMap: React.FC<SingkawangMapProps> = ({
  storePos,
  deliveryPos,
  driverPos,
  selectable = false,
  onSelectPos,
  className = 'h-72 w-full',
  zoom = 14,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // Default Singkawang coordinates
  const defaultCenter: [number, number] = [0.9069, 108.9866];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if map already initialized on this container
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: driverPos ? [driverPos.lat, driverPos.lng] : (deliveryPos ? [deliveryPos.lat, deliveryPos.lng] : defaultCenter),
        zoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap kontributor',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Handle map click for selecting location
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (selectable && onSelectPos) {
          onSelectPos(e.latlng.lat, e.latlng.lng);
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers and route when positions change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    const bounds: [number, number][] = [];

    // Custom Icon Generators using HTML/SVG to avoid missing Leaflet default PNG image paths!
    const createCustomIcon = (bgColor: string, iconHtml: string, pulse = false) => {
      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
            ${pulse ? `<div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${bgColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
            <div style="width: 34px; height: 34px; border-radius: 50%; background: ${bgColor}; border: 3px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); display: flex; align-items: center; justify-content: center; color: white;">
              ${iconHtml}
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });
    };

    // Store marker
    if (storePos && !isNaN(storePos.lat) && !isNaN(storePos.lng)) {
      const storeIcon = createCustomIcon(
        '#0284c7',
        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`
      );
      const m = L.marker([storePos.lat, storePos.lng], { icon: storeIcon })
        .bindPopup(`<b>Toko:</b> ${storePos.title}`)
        .addTo(markersGroup);
      bounds.push([storePos.lat, storePos.lng]);
    }

    // Delivery destination marker
    if (deliveryPos && !isNaN(deliveryPos.lat) && !isNaN(deliveryPos.lng)) {
      const destIcon = createCustomIcon(
        '#ef4444',
        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`
      );
      const m = L.marker([deliveryPos.lat, deliveryPos.lng], { icon: destIcon })
        .bindPopup(`<b>Tujuan Antar:</b> ${deliveryPos.title}`)
        .addTo(markersGroup);
      bounds.push([deliveryPos.lat, deliveryPos.lng]);
    }

    // Driver / Courier marker
    if (driverPos && !isNaN(driverPos.lat) && !isNaN(driverPos.lng)) {
      const driverIcon = createCustomIcon(
        '#16a34a',
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M12 18V9l4-3h3"/><path d="M9 18l3-6"/></svg>`,
        true
      );
      const m = L.marker([driverPos.lat, driverPos.lng], { icon: driverIcon, zIndexOffset: 1000 })
        .bindPopup(`<b>Kurir: ${driverPos.title}</b><br/><span style="font-size:12px;color:#4b5563;">${driverPos.plate || 'Motor Payka'}</span>`)
        .addTo(markersGroup);
      bounds.push([driverPos.lat, driverPos.lng]);
    }

    // Draw route line
    const routePoints: [number, number][] = [];
    if (storePos) routePoints.push([storePos.lat, storePos.lng]);
    if (driverPos) routePoints.push([driverPos.lat, driverPos.lng]);
    if (deliveryPos) routePoints.push([deliveryPos.lat, deliveryPos.lng]);

    if (routePoints.length >= 2) {
      routeLayerRef.current = L.polyline(routePoints, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 6',
      }).addTo(map);
    }

    // Auto-fit bounds if we have 2 or more coordinates
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], zoom);
    }
  }, [storePos, deliveryPos, driverPos, selectable, onSelectPos, zoom]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 shadow-inner ${className}`}>
      <div ref={mapContainerRef} className="h-full w-full" />
      {selectable && (
        <div className="absolute top-2 left-2 z-[500] rounded-lg bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-slate-700 shadow border border-slate-200">
          📍 Klik peta untuk memilih lokasi di Singkawang
        </div>
      )}
    </div>
  );
};
