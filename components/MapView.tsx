import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapLayer } from '../types';
// CSS is loaded via index.html link tag

// Component to handle auto-zooming to new layers
const AutoZoom: React.FC<{ layers: MapLayer[] }> = ({ layers }) => {
  const map = useMap();
  const prevLayersLength = useRef(0);

  useEffect(() => {
    if (layers.length > prevLayersLength.current) {
      // A new layer was added, try to fit bounds
      try {
        const visibleLayers = layers.filter(l => l.visible);
        if (visibleLayers.length > 0) {
          // Focus on the newly added layer (last one)
          const latestLayer = layers[layers.length - 1];
          if (latestLayer.visible) {
            const geoJsonLayer = L.geoJSON(latestLayer.data);
            if (geoJsonLayer.getLayers().length > 0) {
               map.fitBounds(geoJsonLayer.getBounds(), { 
                 padding: [50, 50],
                 animate: true,
                 duration: 1
               });
            }
          }
        }
      } catch (e) {
        console.warn("Could not fit bounds", e);
      }
    }
    prevLayersLength.current = layers.length;
  }, [layers, map]);

  return null;
};

// Component to handle focusing on a specific layer when clicked in the list
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
            padding: [50, 50],
            animate: true,
            duration: 1.5 // Slightly slower animation for better orientation
          });
        }
      } catch (e) {
        console.warn("Focus failed", e);
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
  
  // Helper to create a custom colored pin icon (Fallback)
  const createCustomIcon = (color: string) => {
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" width="40" height="40" style="filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.4));">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `;

    return L.divIcon({
      className: 'custom-pin-icon', // Empty class to remove default styles
      html: svgIcon,
      iconSize: [40, 40],
      iconAnchor: [20, 40], // Point tip at bottom center
      popupAnchor: [0, -40]
    });
  };

  return (
    <MapContainer
      center={[39.9334, 32.8597]} // Default to Turkey (Ankara)
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {layers.map((layer) => (
        layer.visible && (
          <GeoJSON
            key={layer.id}
            data={layer.data}
            // Custom Point Rendering (Pins or Images)
            pointToLayer={(feature, latlng) => {
              // 1. Check if the feature has a specific icon URL (from KMZ extraction)
              // togeojson usually puts the icon href into feature.properties.icon
              if (feature.properties && feature.properties.icon) {
                return L.marker(latlng, {
                  icon: L.icon({
                    iconUrl: feature.properties.icon,
                    iconSize: [32, 32], // Standart ikon boyutu
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -32],
                    // shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                    // shadowSize: [41, 41]
                  })
                });
              }
              
              // 2. Fallback to generated colored pin
              return L.marker(latlng, { icon: createCustomIcon(layer.color) });
            }}
            // Custom Polygon/Line Styles
            // We use a function here to access individual feature properties
            style={(feature) => {
              return {
                // KML'den gelen renk (stroke) varsa onu kullan, yoksa katman rengini kullan
                color: feature?.properties?.stroke || layer.color,
                // KML'den gelen kalınlık varsa kullan
                weight: feature?.properties?.['stroke-width'] || 4,
                opacity: feature?.properties?.['stroke-opacity'] || 1,
                // KML'den gelen dolgu rengi (fill)
                fillColor: feature?.properties?.fill || layer.color,
                fillOpacity: feature?.properties?.['fill-opacity'] || 0.3
              };
            }}
            onEachFeature={(feature, leafletLayer) => {
              // Enhanced popup with Image support if description contains HTML images
              if (feature.properties && (feature.properties.name || feature.properties.description)) {
                leafletLayer.bindPopup(`
                  <div class="font-sans min-w-[200px] max-w-[300px]">
                    ${feature.properties.name ? 
                      `<strong class="block text-sm mb-2 text-indigo-700 border-b pb-1">${feature.properties.name}</strong>` : ''}
                    ${feature.properties.description ? 
                      `<div class="text-xs text-gray-600 max-h-60 overflow-y-auto prose prose-sm prose-img:rounded-md prose-img:max-w-full">
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