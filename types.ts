import { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

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
  UNKNOWN = 'unknown'
}