import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import { FileType } from '../types';

// ---------------------
// DOSYA TÜRÜ ALGILAYICI
// ---------------------
export const detectFileType = (filename: string): FileType => {
  const cleanName = filename.split('?')[0].toLowerCase();

  if (cleanName.endsWith('.kml')) return FileType.KML;
  if (cleanName.endsWith('.kmz')) return FileType.KMZ;
  return FileType.UNKNOWN;
};

// ---------------------
// TÜRKÇE KARAKTER AKILLI ÇÖZÜCÜ
// ---------------------
const decodeText = (buffer: Uint8Array): string => {
  const decoderUTF8 = new TextDecoder('utf-8', { fatal: false });

  try {
    return decoderUTF8.decode(buffer);
  } catch (e) {
    const decoderTR = new TextDecoder('windows-1254');
    return decoderTR.decode(buffer);
  }
};

// ---------------------
// ANA PARSE FONKSİYONU
// ---------------------
export const parseFile = async (file: File): Promise<any> => {
  const type = detectFileType(file.name);

  if (type === FileType.UNKNOWN) {
    throw new Error('Desteklenmeyen dosya formatı. Lütfen .kml veya .kmz dosyası yükleyin.');
  }

  try {
    if (type === FileType.KMZ) return await parseKMZ(file);
    else return await parseKML(file);

  } catch (e: any) {
    const msg = e.message || '';

    if (msg.includes('Corrupted zip') || msg.includes('End of data')) {
      throw new Error('Dosya bozuk veya eksik indirilmiş.');
    }

    throw e;
  }
};

// ---------------------
// KML PARSE
// ---------------------
const parseKML = async (file: File): Promise<any> => {
  const buffer = await file.arrayBuffer();
  const text = decodeText(new Uint8Array(buffer));

  const parser = new DOMParser();
  const kmlDom = parser.parseFromString(text, 'text/xml');

  validateKML(kmlDom);

  return toGeoJSON.kml(kmlDom);
};

// ---------------------
// KMZ PARSE (TAM ÇALIŞAN)
// ---------------------
const parseKMZ = async (file: File): Promise<any> => {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);

  const kmlFiles = files.filter(f =>
    f.toLowerCase().endsWith('.kml') &&
    !f.includes('__MACOSX') &&
    !f.startsWith('._')
  );

  if (kmlFiles.length === 0) {
    throw new Error('Geçersiz KMZ: İçinde KML dosyası bulunamadı.');
  }

  const combinedFeatures: any[] = [];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

  for (const kmlFileName of kmlFiles) {
    const kmlBuffer = await zip.file(kmlFileName)?.async('uint8array');
    if (!kmlBuffer) continue;

    let kmlContent = decodeText(kmlBuffer);

    // ---- Resim dosyaları replace ----
    for (const path of files) {
      const lower = path.toLowerCase();
      if (!imageExtensions.some(ext => lower.endsWith(ext))) continue;
      if (path.includes('__MACOSX') || path.startsWith('._')) continue;

      const imageBlob = await zip.file(path)?.async('blob');
      if (!imageBlob) continue;

      const fileName = path.split('/').pop();
      if (!fileName) continue;

      if (kmlContent.includes(fileName)) {
        const url = URL.createObjectURL(imageBlob);

        const safe = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        kmlContent = kmlContent.replace(new RegExp(safe, 'g'), url);
      }
    }

    // ---- KML DOM ----
    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(kmlContent, 'text/xml');

    validateKML(kmlDom);

    const geoJson = toGeoJSON.kml(kmlDom);
    if (geoJson?.features) combinedFeatures.push(...geoJson.features);
  }

  return {
    type: 'FeatureCollection',
    features: combinedFeatures,
  };
};

// ---------------------
// KML VALIDATOR (EN KRİTİK KISIM)
// ---------------------
const validateKML = (kmlDom: Document) => {
  const parserError = kmlDom.querySelector('parsererror');
  if (parserError) {
    throw new Error('KML dosyası bozuk: XML hatası içeriyor.');
  }

  // NetworkLink kontrolü
  const networkLink = kmlDom.querySelector('NetworkLink href');
  if (networkLink) {
    throw new Error('Bu KML/KMZ harita verisi içermiyor: Dış URL’den veri çağırıyor (NetworkLink).');
  }

  // Placemark var mı?
  const placemarkCount = kmlDom.getElementsByTagName('Placemark').length;
  if (placemarkCount === 0) {
    throw new Error('Dosya indirildi ancak içinde harita verisi (Placemark/Feature) bulunamadı.');
  }
};

// ---------------------
export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
