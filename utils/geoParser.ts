import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import { FileType } from '../types';

// ---------------------
// DOSYA TİPİ TESPİTİ
// ---------------------
export const detectFileType = (filename: string): FileType => {
  const cleanName = filename.split('?')[0].toLowerCase();

  if (cleanName.endsWith('.kml')) return FileType.KML;
  if (cleanName.endsWith('.kmz')) return FileType.KMZ;
  return FileType.UNKNOWN;
};

// ---------------------
// UTF-8 + WINDOWS-1254 ÇÖZÜCÜ
// ---------------------
const decodeText = (buffer: Uint8Array): string => {
  const decoderUTF8 = new TextDecoder('utf-8', { fatal: true });

  try {
    return decoderUTF8.decode(buffer);
  } catch (e) {
    const decoderTR = new TextDecoder('windows-1254');
    return decoderTR.decode(buffer);
  }
};

// ---------------------
// KML TEMİZLEYİCİ
// ---------------------
const cleanKMLText = (text: string): string => {
  let clean = text.replace(/^\uFEFF/, '');

  clean = clean.replace(/<\?xml[^>]*\?>/g, '');
  clean = clean.replace(/xmlns(:[a-zA-Z0-9-_]+)?="[^"]*"/g, '');
  clean = clean.replace(/xmlns(:[a-zA-Z0-9-_]+)?='[^']*'/g, '');

  clean = clean.replace(/<(\/?)\s*[a-zA-Z0-9-_]+\s*:\s*([a-zA-Z0-9-_]+)/g, '<$1$2');

  clean = clean.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g, '&amp;');

  return clean.trim();
};

// ---------------------
// KML PARSE
// ---------------------
const parseKML = async (file: File | Blob): Promise<any> => {
  const buffer = await file.arrayBuffer();
  let text = decodeText(new Uint8Array(buffer));

  if (text.includes('<NetworkLink>')) {
    console.warn("Dosya içinde NetworkLink tespit edildi.");
  }

  text = cleanKMLText(text);

  const parser = new DOMParser();
  const dom = parser.parseFromString(text, 'text/xml');

  const parseError = dom.querySelector('parsererror');
  if (parseError) {
    console.error("XML Parse Hatası:", parseError.textContent);
  }

  const geo = toGeoJSON.kml(dom);

  return {
    type: "FeatureCollection",
    features: geo?.features || []
  };
};

// ---------------------
// KMZ PARSE
// ---------------------
const parseKMZ = async (file: File): Promise<any> => {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);
  const allFeatures: any[] = [];
  let foundKml = false;

  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp', '.icons'];

  for (const filename of files) {
    const lowerName = filename.toLowerCase();

    if (filename.endsWith('/') || filename.startsWith('__MACOSX') || filename.startsWith('._')) continue;
    if (imageExtensions.some(ext => lowerName.endsWith(ext))) continue;

    try {
      const raw = await zip.file(filename)?.async('uint8array');
      if (!raw) continue;

      let text = decodeText(raw);

      if (!text.includes('<') || !text.includes('>')) continue;

      text = cleanKMLText(text);

      const parser = new DOMParser();
      const dom = parser.parseFromString(text, 'text/xml');
      const geo = toGeoJSON.kml(dom);

      if (geo?.features && geo.features.length > 0) {
        allFeatures.push(...geo.features);
        foundKml = true;
      }
    } catch (err) {
      console.warn(`Dosya okunamadı (${filename}):`, err);
    }
  }

  return {
    type: "FeatureCollection",
    features: allFeatures
  };
};

// ---------------------
// GEÇERLİ GEOMETRİ KONTROLÜ
// ---------------------
const hasValidGeometry = (features: any[]): boolean => {
  return features.some(f =>
    f.geometry &&
    (
      f.geometry.type === "Polygon" ||
      f.geometry.type === "MultiPolygon" ||
      f.geometry.type === "Point" ||
      f.geometry.type === "LineString" ||
      f.geometry.type === "MultiLineString"
    )
  );
};

// ---------------------
// DOSYA ROUTER
// ---------------------
export const parseFile = async (file: File): Promise<any> => {
  const type = detectFileType(file.name);

  let result;

  try {
    if (type === FileType.KMZ) result = await parseKMZ(file);
    else result = await parseKML(file);
  } catch (error) {
    console.error("Parse İşlemi Hatası:", error);
    throw new Error("Dosya formatı bozuk veya okunamıyor.");
  }

  const features = result?.features ?? [];

  // ❗ Burada düzeltme var
  if (!hasValidGeometry(features)) {
    throw new Error(
      "Dosya içeriği okundu ancak harita çizimi (Polygon/Point/Line) bulunamadı. " +
      "Dosya sadece resim içeriyor olabilir veya NetworkLink bağlantısı olabilir."
    );
  }

  return result;
};

// ---------------------
// RENK OLUŞTURUCU
// ---------------------
export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
