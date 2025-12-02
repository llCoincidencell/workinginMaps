// Harici 'geojson' paketi yerine yerel tip tanımları
// Bu, Vercel build hatalarını önler.

export type Position = number[]; // [longitude, latitude, elevation?]

export interface GeoJsonProperties {
  [name: string]: any;
}

export interface Geometry {
  type: string;
  coordinates: any;
}

export interface Feature<G extends Geometry | null = Geometry, P = GeoJsonProperties> {
  type: "Feature";
  geometry: G;
  id?: string | number;
  properties: P;
}

export interface FeatureCollection<G extends Geometry | null = Geometry, P = GeoJsonProperties> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  data: FeatureCollection<Geometry, GeoJsonProperties>;
  color: string;
}

export interface AnalysisResult {
  layerId: string;
  text: string;
  loading: boolean;
}

export enum FileType {
  KML = 'kml',
  KMZ = 'kmz',
  GEOJSON = 'geojson',
  UNKNOWN = 'unknown'
}
