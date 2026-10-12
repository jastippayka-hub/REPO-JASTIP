import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';

export type MarkerType = 'store' | 'delivery' | 'driver' | 'custom';

export interface MarkerConfig {
  type: MarkerType;
  title: string;
  subtitle?: string;
  color?: string;
  draggable?: boolean;
  pulse?: boolean;
  plate?: string;
}

export interface ExtraMapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  type?: MarkerType;
  color?: string;
}

export interface SingkawangMapProps {
  storePos?: { lat: number; lng: number; title: string };
  deliveryPos?: { lat: number; lng: number; title: string };
  driverPos?: { lat: number; lng: number; title: string; plate?: string };
  extraMarkers?: ExtraMapMarker[];
  selectable?: boolean;
  onSelectPos?: (lat: number, lng: number) => void;
  storeDraggable?: boolean;
  onStoreDragEnd?: (lat: number, lng: number) => void;
  deliveryDraggable?: boolean;
  onDeliveryDragEnd?: (lat: number, lng: number) => void;
  className?: string;
  zoom?: number;
  modeLabel?: string;
  persistKey?: string;
  showTileToggle?: boolean;
}

// Default Singkawang Center Coordinates
export const SINGKAWANG_DEFAULT_CENTER: [number, number] = [0.9069, 108.9866];

/**
 * Creates custom high-contrast SVG div-icons for Singkawang Leaflet map
 */
export function createMapMarkerIcon(config: MarkerConfig): L.DivIcon {
  const { type, color, draggable = false, pulse = false } = config;

  let bgColor = color || '#0284c7';
  let iconSvg = '';

  switch (type) {
    case 'store':
      bgColor = color || '#0284c7'; // Sky Blue
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`;
      break;
    case 'delivery':
      bgColor = color || '#ef4444'; // Red
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
      break;
    case 'driver':
      bgColor = color || '#10b981'; // Emerald Green
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M12 18V9l4-3h3"/><path d="M9 18l3-6"/></svg>`;
      break;
    case 'custom':
    default:
      bgColor = color || '#8b5cf6'; // Violet
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
      break;
  }

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; cursor: ${draggable ? 'grab' : 'pointer'};">
      ${
        pulse
          ? `<div style="position: absolute; width: 48px; height: 48px; border-radius: 50%; background: ${bgColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
          : ''
      }
      <div style="width: 36px; height: 36px; border-radius: 50%; background: ${bgColor}; border: 3px solid #ffffff; box-shadow: 0 4px 10px -1px rgba(0, 0, 0, 0.35); display: flex; align-items: center; justify-content: center; color: white;">
        ${iconSvg}
      </div>
      ${
        draggable
          ? `<div style="position: absolute; top: -3px; right: -3px; width: 16px; height: 16px; border-radius: 50%; background: #ffffff; border: 2px solid ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; color: ${bgColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.35);">✥</div>`
          : ''
      }
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

export const SingkawangMap: React.FC<SingkawangMapProps> = ({
  storePos,
  deliveryPos,
  driverPos,
  extraMarkers = [],
  selectable = false,
  onSelectPos,
  storeDraggable = false,
  onStoreDragEnd,
  deliveryDraggable = false,
  onDeliveryDragEnd,
  className = 'h-72 w-full',
  zoom = 14,
  modeLabel,
  persistKey,
  showTileToggle = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // Persistent marker references to prevent tearing down DOM on every prop change
  const storeMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const extraMarkersGroupRef = useRef<Map<string, L.Marker>>(new Map());

  const initialFittedRef = useRef<boolean>(false);
  const [activeTileLayer, setActiveTileLayer] = useState<'standard' | 'voyager'>('standard');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Keep refs for callbacks to prevent stale closure bugs in Leaflet event listeners
  const onSelectPosRef = useRef(onSelectPos);
  onSelectPosRef.current = onSelectPos;
  const selectableRef = useRef(selectable);
  selectableRef.current = selectable;

  const onStoreDragEndRef = useRef(onStoreDragEnd);
  onStoreDragEndRef.current = onStoreDragEnd;
  const onDeliveryDragEndRef = useRef(onDeliveryDragEnd);
  onDeliveryDragEndRef.current = onDeliveryDragEnd;

  // Restore saved view from storage if key provided
  const getInitialView = (): { center: [number, number]; zoom: number } => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(`map_view_${persistKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed.lat === 'number' &&
            typeof parsed.lng === 'number' &&
            typeof parsed.zoom === 'number'
          ) {
            return { center: [parsed.lat, parsed.lng], zoom: parsed.zoom };
          }
        }
      } catch (err) {
        console.debug('Failed to restore map view', err);
      }
    }

    if (driverPos && !isNaN(driverPos.lat) && !isNaN(driverPos.lng)) {
      return { center: [driverPos.lat, driverPos.lng], zoom };
    }
    if (storePos && !isNaN(storePos.lat) && !isNaN(storePos.lng)) {
      return { center: [storePos.lat, storePos.lng], zoom };
    }
    if (deliveryPos && !isNaN(deliveryPos.lat) && !isNaN(deliveryPos.lng)) {
      return { center: [deliveryPos.lat, deliveryPos.lng], zoom };
    }
    return { center: SINGKAWANG_DEFAULT_CENTER, zoom };
  };

  // 1. Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initial = getInitialView();
      const map = L.map(mapContainerRef.current, {
        center: initial.center,
        zoom: initial.zoom,
        zoomControl: true,
      });

      const tileUrl =
        activeTileLayer === 'voyager'
          ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tile = L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap kontributor',
        maxZoom: 19,
      }).addTo(map);

      tileLayerRef.current = tile;

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Handle map click for dynamic point picking
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (selectableRef.current && onSelectPosRef.current) {
          onSelectPosRef.current(e.latlng.lat, e.latlng.lng);
        }
      });

      // Persist map center and zoom level if persistKey provided
      if (persistKey) {
        const persistCurrentView = () => {
          try {
            const center = map.getCenter();
            const currentZoom = map.getZoom();
            localStorage.setItem(
              `map_view_${persistKey}`,
              JSON.stringify({
                lat: center.lat,
                lng: center.lng,
                zoom: currentZoom,
              })
            );
          } catch (err) {
            console.debug('Failed to save map view', err);
          }
        };

        map.on('moveend', persistCurrentView);
        map.on('zoomend', persistCurrentView);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        storeMarkerRef.current = null;
        deliveryMarkerRef.current = null;
        driverMarkerRef.current = null;
        extraMarkersGroupRef.current.clear();
        routeLayerRef.current = null;
      }
    };
  }, []);

  // 2. Manage Store Marker Lifecycle
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup) return;

    if (storePos && !isNaN(storePos.lat) && !isNaN(storePos.lng)) {
      const popupHtml = `<b>🏬 Toko:</b> ${storePos.title || 'Lokasi Pembelian'}${
        storeDraggable
          ? '<br/><span style="font-size:11px;color:#0284c7;font-weight:700;">📌 Tarik pin ini bebas di peta Singkawang</span>'
          : ''
      }`;

      if (!storeMarkerRef.current) {
        const icon = createMapMarkerIcon({
          type: 'store',
          title: storePos.title,
          draggable: storeDraggable,
        });

        const marker = L.marker([storePos.lat, storePos.lng], {
          icon,
          draggable: !!storeDraggable,
          zIndexOffset: 500,
        })
          .bindPopup(popupHtml)
          .addTo(markersGroup);

        marker.on('dragend', (e: L.LeafletEvent) => {
          const target = e.target as L.Marker;
          const pos = target.getLatLng();
          if (onStoreDragEndRef.current) {
            onStoreDragEndRef.current(pos.lat, pos.lng);
          }
        });

        storeMarkerRef.current = marker;
      } else {
        // Update existing marker smoothly
        storeMarkerRef.current.setLatLng([storePos.lat, storePos.lng]);
        storeMarkerRef.current.setPopupContent(popupHtml);
        if (storeDraggable) {
          storeMarkerRef.current.dragging?.enable();
        } else {
          storeMarkerRef.current.dragging?.disable();
        }
      }
    } else if (storeMarkerRef.current) {
      markersGroup.removeLayer(storeMarkerRef.current);
      storeMarkerRef.current = null;
    }
  }, [storePos?.lat, storePos?.lng, storePos?.title, storeDraggable]);

  // 3. Manage Delivery Marker Lifecycle
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup) return;

    if (deliveryPos && !isNaN(deliveryPos.lat) && !isNaN(deliveryPos.lng)) {
      const popupHtml = `<b>📍 Tujuan Antar:</b> ${deliveryPos.title || 'Lokasi Pengantaran'}${
        deliveryDraggable
          ? '<br/><span style="font-size:11px;color:#ef4444;font-weight:700;">📌 Tarik pin ini bebas ke lokasi rumah Anda</span>'
          : ''
      }`;

      if (!deliveryMarkerRef.current) {
        const icon = createMapMarkerIcon({
          type: 'delivery',
          title: deliveryPos.title,
          draggable: deliveryDraggable,
        });

        const marker = L.marker([deliveryPos.lat, deliveryPos.lng], {
          icon,
          draggable: !!deliveryDraggable,
          zIndexOffset: 600,
        })
          .bindPopup(popupHtml)
          .addTo(markersGroup);

        marker.on('dragend', (e: L.LeafletEvent) => {
          const target = e.target as L.Marker;
          const pos = target.getLatLng();
          if (onDeliveryDragEndRef.current) {
            onDeliveryDragEndRef.current(pos.lat, pos.lng);
          }
        });

        deliveryMarkerRef.current = marker;
      } else {
        // Update existing marker position smoothly
        deliveryMarkerRef.current.setLatLng([deliveryPos.lat, deliveryPos.lng]);
        deliveryMarkerRef.current.setPopupContent(popupHtml);
        if (deliveryDraggable) {
          deliveryMarkerRef.current.dragging?.enable();
        } else {
          deliveryMarkerRef.current.dragging?.disable();
        }
      }
    } else if (deliveryMarkerRef.current) {
      markersGroup.removeLayer(deliveryMarkerRef.current);
      deliveryMarkerRef.current = null;
    }
  }, [deliveryPos?.lat, deliveryPos?.lng, deliveryPos?.title, deliveryDraggable]);

  // 4. Manage Driver Marker Lifecycle
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup) return;

    if (driverPos && !isNaN(driverPos.lat) && !isNaN(driverPos.lng)) {
      const popupHtml = `<b>🛵 Kurir: ${driverPos.title}</b><br/><span style="font-size:12px;color:#4b5563;">${driverPos.plate || 'Motor Payka'}</span>`;

      if (!driverMarkerRef.current) {
        const icon = createMapMarkerIcon({
          type: 'driver',
          title: driverPos.title,
          pulse: true,
          plate: driverPos.plate,
        });

        const marker = L.marker([driverPos.lat, driverPos.lng], {
          icon,
          zIndexOffset: 1000,
        })
          .bindPopup(popupHtml)
          .addTo(markersGroup);

        driverMarkerRef.current = marker;
      } else {
        driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
        driverMarkerRef.current.setPopupContent(popupHtml);
      }
    } else if (driverMarkerRef.current) {
      markersGroup.removeLayer(driverMarkerRef.current);
      driverMarkerRef.current = null;
    }
  }, [driverPos?.lat, driverPos?.lng, driverPos?.title, driverPos?.plate]);

  // 5. Manage Extra Waypoints / Markers
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup) return;

    const existingMap = extraMarkersGroupRef.current;
    const currentIds = new Set(extraMarkers.map(m => m.id));

    // Remove deleted markers
    for (const [id, marker] of existingMap.entries()) {
      if (!currentIds.has(id)) {
        markersGroup.removeLayer(marker);
        existingMap.delete(id);
      }
    }

    // Add or update markers
    extraMarkers.forEach(em => {
      if (isNaN(em.lat) || isNaN(em.lng)) return;

      const popupHtml = `<b>${em.title}</b>${em.subtitle ? `<br/><span style="font-size:11px;color:#475569;">${em.subtitle}</span>` : ''}`;

      if (existingMap.has(em.id)) {
        const marker = existingMap.get(em.id)!;
        marker.setLatLng([em.lat, em.lng]);
        marker.setPopupContent(popupHtml);
      } else {
        const icon = createMapMarkerIcon({
          type: em.type || 'custom',
          title: em.title,
          color: em.color,
        });

        const marker = L.marker([em.lat, em.lng], { icon, zIndexOffset: 400 })
          .bindPopup(popupHtml)
          .addTo(markersGroup);

        existingMap.set(em.id, marker);
      }
    });
  }, [extraMarkers]);

  // 6. Manage Route Polyline & Initial Fit Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const routePoints: [number, number][] = [];
    if (storePos && !isNaN(storePos.lat) && !isNaN(storePos.lng)) {
      routePoints.push([storePos.lat, storePos.lng]);
    }
    if (driverPos && !isNaN(driverPos.lat) && !isNaN(driverPos.lng)) {
      routePoints.push([driverPos.lat, driverPos.lng]);
    }
    if (deliveryPos && !isNaN(deliveryPos.lat) && !isNaN(deliveryPos.lng)) {
      routePoints.push([deliveryPos.lat, deliveryPos.lng]);
    }

    if (routePoints.length >= 2) {
      if (!routeLayerRef.current) {
        routeLayerRef.current = L.polyline(routePoints, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 6',
        }).addTo(map);
      } else {
        routeLayerRef.current.setLatLngs(routePoints);
      }
    } else if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    // Auto-fit bounds ONLY on initial load to avoid interrupting user dragging
    if (!initialFittedRef.current && routePoints.length > 0) {
      if (routePoints.length > 1) {
        map.fitBounds(routePoints, { padding: [40, 40], maxZoom: 16 });
        initialFittedRef.current = true;
      } else {
        map.setView(routePoints[0], zoom);
        initialFittedRef.current = true;
      }
    }
  }, [storePos?.lat, storePos?.lng, deliveryPos?.lat, deliveryPos?.lng, driverPos?.lat, driverPos?.lng, zoom]);

  const handleCenterRoute = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds: [number, number][] = [];
    if (storePos && !isNaN(storePos.lat) && !isNaN(storePos.lng)) bounds.push([storePos.lat, storePos.lng]);
    if (deliveryPos && !isNaN(deliveryPos.lat) && !isNaN(deliveryPos.lng)) bounds.push([deliveryPos.lat, deliveryPos.lng]);
    if (driverPos && !isNaN(driverPos.lat) && !isNaN(driverPos.lng)) bounds.push([driverPos.lat, driverPos.lng]);

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], zoom);
    } else {
      map.setView(SINGKAWANG_DEFAULT_CENTER, zoom);
    }
  }, [storePos, deliveryPos, driverPos, zoom]);

  const handleResetToCityCenter = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView(SINGKAWANG_DEFAULT_CENTER, 14);
  }, []);

  const toggleTileLayer = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const next = activeTileLayer === 'standard' ? 'voyager' : 'standard';
    setActiveTileLayer(next);

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newUrl =
      next === 'voyager'
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(newUrl, {
      attribution: '&copy; OpenStreetMap kontributor',
      maxZoom: 19,
    }).addTo(map);
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 shadow-inner ${className}`}>
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Top Banner / Mode Badge */}
      {selectable && (
        <div className="absolute top-2 left-2 z-[500] rounded-lg bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md border border-slate-200 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          <span>{modeLabel || '📍 Klik peta untuk menentukan lokasi di Singkawang'}</span>
        </div>
      )}

      {/* Control Buttons Group (Bottom Right) */}
      <div className="absolute bottom-2 right-2 z-[500] flex flex-wrap items-center gap-1.5">
        {showTileToggle && (
          <button
            type="button"
            onClick={toggleTileLayer}
            title="Ganti Tampilan Peta"
            className="rounded-lg bg-white/95 hover:bg-slate-100 backdrop-blur px-2 py-1 text-[11px] font-bold text-slate-700 shadow border border-slate-200 transition"
          >
            🗺️ {activeTileLayer === 'standard' ? 'Modern' : 'OSM'}
          </button>
        )}
        <button
          type="button"
          onClick={handleResetToCityCenter}
          title="Lihat Pusat Kota Singkawang"
          className="rounded-lg bg-white/95 hover:bg-slate-100 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow border border-slate-200 transition"
        >
          🏙️ Pusat Singkawang
        </button>
        <button
          type="button"
          onClick={handleCenterRoute}
          title="Pusatkan Tampilan Peta Rute"
          className="rounded-lg bg-white/95 hover:bg-blue-50 text-blue-700 backdrop-blur px-2.5 py-1 text-[11px] font-bold shadow border border-blue-200 transition"
        >
          🎯 Pusatkan Rute
        </button>
      </div>
    </div>
  );
};
