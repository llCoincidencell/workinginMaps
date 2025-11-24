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
  return text
    .replace(/^\uFEFF/, '') // BOM
    .replace(/<!--[\s\S]*?-->/g, '') // yorumlar
    .replace(/<\?xml.*?\?>/g, '') // xml header
    .replace(/\s+xmlns(:[a-zA-Z0-9]+)?=(["']).*?\2/g, '') // namespace
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g, '&amp;') // hatalı &
    .trim();
};

// ---------------------
// KML PARSE — GÜÇLENDİRİLMİŞ
// ---------------------
const parseKML = async (file: File): Promise<any> => {
  const buffer = await file.arrayBuffer();
  let text = decodeText(new Uint8Array(buffer));
  text = cleanKMLText(text);

  const parser = new DOMParser();
  const dom = parser.parseFromString(text, 'text/xml');

  // 🌟 Placemark say
  const placemarks = dom.getElementsByTagName('Placemark');
  console.log("KML içindeki Placemark sayısı:", placemarks.length);

  const geo = toGeoJSON.kml(dom);

  return {
    type: "FeatureCollection",
    features: geo?.features || []
  };
};

// ---------------------
// KMZ PARSE — GÜÇLENDİRİLMİŞ
// ---------------------
const parseKMZ = async (file: File): Promise<any> => {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);

  const kmlFiles = files.filter(f =>
    (f.endsWith('.kml') || f.endsWith('.xml')) &&
    !f.includes('__MACOSX') &&
    !f.startsWith('._')
  );

  console.log("KMZ İçindeki KML dosyaları:", kmlFiles);

  if (kmlFiles.length === 0)
    return { type: "FeatureCollection", features: [] };

  const allFeatures: any[] = [];

  for (const name of kmlFiles) {
    try {
      const raw = await zip.file(name)?.async('uint8array');
      if (!raw) continue;

      let text = decodeText(raw);
      text = cleanKMLText(text);

      const parser = new DOMParser();
      const dom = parser.parseFromString(text, 'text/xml');

      // 🌟 Placemark sayım
      const placemarks = dom.getElementsByTagName('Placemark');
      console.log(`${name} içindeki Placemark sayısı:`, placemarks.length);

      const geo = toGeoJSON.kml(dom);
      if (geo?.features) allFeatures.push(...geo.features);

    } catch (err) {
      console.warn("KMZ içindeki bir KML parse edilemedi:", name);
    }
  }

  return {
    type: "FeatureCollection",
    features: allFeatures
  };
};

// ---------------------
// DOSYA ROUTER
// ---------------------
export const parseFile = async (file: File): Promise<any> => {
  const type = detectFileType(file.name);

  if (type === FileType.UNKNOWN)
    throw new Error("Sadece .kml veya .kmz yükleyebilirsin.");

  let result = (type === FileType.KMZ)
    ? await parseKMZ(file)
    : await parseKML(file);

  // ❗ Asla hata fırlatma — kullanıcı dostu rapor döner
  if (!result?.features || result.features.length === 0) {
    return {
      type: "FeatureCollection",
      features: [],
      message: "Dosya okundu fakat çizim/Placemark bulunamadı. Dosya muhtemelen sadece stil/ikon içeriyor."
    };
  }

  return result;
};

// ---------------------
// RENK
// ---------------------
export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
