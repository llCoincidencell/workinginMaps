
import { FeatureCollection, Geometry, Position } from 'geojson';
import { MapLayer } from '../types';

// Bir noktanın bir poligon içinde olup olmadığını kontrol eden Ray-Casting algoritması
const isPointInPolygon = (point: Position, vs: Position[]): boolean => {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// GeoJSON içindeki tüm koordinat noktalarını düzleştirip çıkarır
const extractPoints = (geometry: Geometry): Position[] => {
  const points: Position[] = [];

  if (geometry.type === 'Point') {
    points.push(geometry.coordinates);
  } else if (geometry.type === 'Polygon') {
    points.push(geometry.coordinates[0][0]); 
  } else if (geometry.type === 'LineString') {
    points.push(geometry.coordinates[0]); 
    points.push(geometry.coordinates[geometry.coordinates.length - 1]); 
  } else if (geometry.type === 'MultiPoint') {
    points.push(...geometry.coordinates);
  } else if (geometry.type === 'GeometryCollection') {
    geometry.geometries.forEach(g => points.push(...extractPoints(g)));
  }
  
  return points;
};

// --- SENARYO 1: Yeni Dosya (Nokta) -> Mevcut Haritalar (Alan) İçinde mi? ---
export const checkIntersections = (newData: FeatureCollection, existingLayers: MapLayer[]): string[] => {
  const matchedLayers = new Set<string>();
  
  // Yeni veriden noktaları çıkar
  const testPoints: Position[] = [];
  newData.features.forEach(feature => {
    if (feature.geometry) {
      testPoints.push(...extractPoints(feature.geometry));
    }
  });

  if (testPoints.length === 0) return [];

  // Mevcut katmanları tara
  existingLayers.forEach(layer => {
    if (!layer.visible) return;

    let isInsideLayer = false;

    layer.data.features.forEach(feature => {
      if (isInsideLayer) return; 
      if (!feature.geometry) return;

      if (feature.geometry.type === 'Polygon') {
        const polygonRing = feature.geometry.coordinates[0];
        if (testPoints.some(p => isPointInPolygon(p, polygonRing))) {
          isInsideLayer = true;
        }
      } 
      else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(polygon => {
          const polygonRing = polygon[0];
          if (testPoints.some(p => isPointInPolygon(p, polygonRing))) {
            isInsideLayer = true;
          }
        });
      }
    });

    if (isInsideLayer) {
      matchedLayers.add(layer.name);
    }
  });

  return Array.from(matchedLayers);
};

// --- SENARYO 2: Yeni Harita (Alan) -> Mevcut Dosyaları (Nokta) Kapsıyor mu? ---
export const checkCoverage = (newPolygonData: FeatureCollection, existingLayers: MapLayer[]): string[] => {
  const coveredLayers = new Set<string>();

  // Yeni yüklenen haritadaki tüm Polygonları topla
  const polygons: Position[][] = [];
  
  newPolygonData.features.forEach(feature => {
    if (!feature.geometry) return;
    if (feature.geometry.type === 'Polygon') {
      polygons.push(feature.geometry.coordinates[0]);
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach(poly => polygons.push(poly[0]));
    }
  });

  if (polygons.length === 0) return [];

  // Mevcut katmanları (Kullanıcının önceden yüklediği noktalar) tara
  existingLayers.forEach(layer => {
    if (!layer.visible) return;

    // Mevcut katmandaki noktaları çıkar
    const layerPoints: Position[] = [];
    layer.data.features.forEach(f => {
      if (f.geometry) layerPoints.push(...extractPoints(f.geometry));
    });

    // Eğer bu katmandaki herhangi bir nokta, yeni yüklenen poligonlardan birinin içindeyse
    let isCovered = false;
    // Performans için: İlk eşleşen noktada döngüyü kır
    for (const point of layerPoints) {
      if (polygons.some(poly => isPointInPolygon(point, poly))) {
        isCovered = true;
        break; 
      }
    }

    if (isCovered) {
      coveredLayers.add(layer.name);
    }
  });

  return Array.from(coveredLayers);
};
