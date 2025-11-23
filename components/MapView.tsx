import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { MapLayer } from '../types';

// Yeni katman eklendiğinde otomatik zoom yapan bileşen
const AutoZoom: React.FC<{ layers: MapLayer[] }> = ({ layers }) => {
  const map = useMap();
  const prevLayersLength = useRef(0);

  useEffect(() => {
    if (layers.length > prevLayersLength.current) {
      try {
        const visibleLayers = layers.filter(l => l.visible);
        if (visibleLayers.length > 0) {
          const latestLayer = layers[layers.length - 1];
          if (latestLayer.visible) {
            const geoJsonLayer = L.geoJSON(latestLayer.data);
            if (geoJsonLayer.getLayers().length > 0) {
               map.fitBounds(geoJsonLayer.getBounds(), { 
                 padding: [20, 20],
                 animate: true,
                 duration: 1
               });
            }
          }
        }
      } catch (e) {
        console.warn("Zoom hatası:", e);
      }
    }
    prevLayersLength.current = layers.length;
  }, [layers, map]);

  return null;
};

// Listeden tıklanan katmana odaklanan bileşen
const LayerFocuser: React.FC<{ layers: MapLayer[]; focusTrigger: { id: string; timestamp: number } | null }> = ({ layers, focusTrigger }) => {
  const map = useMap();

  useEffect(() => {
    if (!focusTrigger) return;

    const layerToFocus = layers.find(l => l.id === focusTrigger.id);
    
    if (layerToFocus && layerToFocus.visible) {
      try {
        const geoJsonLayer = L.geoJSON(layerToFocus.data);
        if (geoJsonLayer.getLayers().length > 0) {
          map.fitBounds(geoJsonLayer.getBounds(), {
            padding: [20, 20],
            animate: true,
            duration: 1.5 
          });
        }
      } catch (e) {
        console.warn("Odaklanma hatası:", e);
      }
    }
  }, [focusTrigger, layers, map]);

  return null;
};

interface MapViewProps {
  layers: MapLayer[];
  focusTrigger: { id: string; timestamp: number } | null;
}

export const MapView: React.FC<MapViewProps> = ({ layers, focusTrigger }) => {
  
  // SADECE TÜRKİYE SINIRLARI
  // Kullanıcının dışarı çıkmasını engellemek için koordinatlar kilitlendi.
  const turkeyBounds: L.LatLngBoundsExpression = [
    [35.5, 25.5], // Güney Batı (Akdeniz açıkları)
    [42.5, 45.0]  // Kuzey Doğu (Kafkaslar sınırı)
  ];

  // Özel renkli pin oluşturucu
  const createCustomIcon = (color: string) => {
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" width="40" height="40" style="filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.4));">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `;

    return L.divIcon({
      className: 'custom-pin-icon',
      html: svgIcon,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });
  };

  return (
    <MapContainer
      center={[39.0, 35.0]} // Türkiye'nin tam ortası
      zoom={6}
      minZoom={6} // KİLİT: Dünyayı görmek için uzaklaşmayı engelle
      maxZoom={18}
      maxBounds={turkeyBounds} // KİLİT: Sadece Türkiye sınırları içinde gezilebilir
      maxBoundsViscosity={1.0} // KİLİT: Kenarlara çarpınca esnemeyi engelle (Tam kilit)
      preferCanvas={true} // PERFORMANS: Binlerce çizgiyi kasmadan çizer (Mobil için kritik)
      style={{ height: '100%', width: '100%', background: '#f8fafc' }}
      zoomControl={false} // Varsayılan zoom butonunu kapat (yerini değiştireceğiz)
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Mobil uyumlu, sağ altta zoom kontrolleri */}
      <ZoomControl position="bottomright" />

      {layers.map((layer) => (
        layer.visible && (
          <GeoJSON
            key={layer.id}
            data={layer.data}
            // Nokta stili
            pointToLayer={(feature, latlng) => {
              if (feature.properties && feature.properties.icon) {
                return L.marker(latlng, {
                  icon: L.icon({
                    iconUrl: feature.properties.icon,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -32],
                  })
                });
              }
              return L.marker(latlng, { icon: createCustomIcon(layer.color) });
            }}
            // Çizgi ve Alan stili
            style={(feature) => {
              return {
                color: feature?.properties?.stroke || layer.color,
                weight: feature?.properties?.['stroke-width'] || 3,
                opacity: 0.9,
                fillColor: feature?.properties?.fill || layer.color,
                fillOpacity: 0.35,
                // PERFORMANS: Bu değer artırıldı. Mobilde donmayı engeller, çizgileri basitleştirir.
                smoothFactor: 2 
              };
            }}
            onEachFeature={(feature, leafletLayer) => {
              if (feature.properties && (feature.properties.name || feature.properties.description)) {
                leafletLayer.bindPopup(`
                  <div class="font-sans min-w-[200px] max-w-[260px]">
                    ${feature.properties.name ? 
                      `<strong class="block text-sm mb-2 text-indigo-700 border-b pb-1 truncate">${feature.properties.name}</strong>` : ''}
                    ${feature.properties.description ? 
                      `<div class="text-xs text-gray-600 max-h-40 overflow-y-auto break-words">
                        ${feature.properties.description}
                      </div>` 
                      : ''}
                  </div>
                `);
              }
            }}
          />
        )
      ))}
      <AutoZoom layers={layers} />
      <LayerFocuser layers={layers} focusTrigger={focusTrigger} />
    </MapContainer>
  );
};
