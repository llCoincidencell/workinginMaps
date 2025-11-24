import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import { FileType } from '../types';

export const detectFileType = (filename: string): FileType => {
  const cleanName = filename.split('?')[0].toLowerCase();

  if (cleanName.endsWith('.kml')) return FileType.KML;
  if (cleanName.endsWith('.kmz')) return FileType.KMZ;
  return FileType.UNKNOWN;
};

// ---------------------
// UTF-8 + Windows-1254
// ---------------------
const decodeText = (buffer: Uint8Array): string => {
  const decoderUTF8 = new TextDecoder('utf-8', { fatal: true });
  try {
    return decoderUTF8.decode(buffer);
  } catch (e) {
    console.warn("UTF-8 decoding failed, switching to windows-1254 for Turkish characters.");
    const decoderTR = new TextDecoder('windows-1254');
    return decoderTR.decode(buffer);
  }
};

// ---------------------
// KML Temizleyici
// ---------------------
const cleanKMLText = (text: string): string => {
  return text
    .replace(/^\uFEFF/, '') // BOM temizle
    .replace(/<!--[\s\S]*?-->/g, '') // HTML yorumlarını kaldır
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;') // bozuk & fix
    .replace(/<!\[CDATA\[/g, '<![CDATA[')
    .replace(/\]\]>/g, ']]>')
    .replace(/xmlns\:[A-Za-z0-9]+\s*=\s*""/g, ''); // bozuk namespace
};

// ---------------------
// KML Doğrulayıcı
// ---------------------
const validateKML = (kmlDom: Document) => {
  const parserError = kmlDom.querySelector('parsererror');

  if (parserError) {
    const hasRealContent =
      kmlDom.getElementsByTagName('kml').length > 0 ||
      kmlDom.getElementsByTagName('Document').length > 0 ||
      kmlDom.getElementsByTagName('Placemark').length > 0;

    if (!hasRealContent) {
      throw new Error('KML dosyası bozuk ve kurtarılamıyor.');
    }
  }

  const networkLink = kmlDom.querySelector('NetworkLink href');
  if (networkLink) {
    throw new Error('Bu KML/KMZ veri içermiyor, dışarıdan çağırıyor (NetworkLink).');
  }

  const placemarkCount = kmlDom.getElementsByTagName('Placemark').length;
  if (placemarkCount === 0) {
    throw new Error('Dosya indirildi ancak içinde harita verisi (Placemark / Feature) bulunamadı.');
  }
};

// ---------------------
// KML PARSE
// ---------------------
const parseKML = async (file: File): Promise<any> => {
  const buffer = await file.arrayBuffer();
  let text = decodeText(new Uint8Array(buffer));

  text = cleanKMLText(text);

  const parser = new DOMParser();
  const kmlDom = parser.parseFromString(text, 'text/xml');

  validateKML(kmlDom);

  return toGeoJSON.kml(kmlDom);
};

// ---------------------
// KMZ PARSE
// ---------------------
const parseKMZ = async (file: File): Promise<any> => {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);

  const kmlFiles = files.filter(f =>
    f.toLowerCase().endsWith('.kml') &&
    !f.startsWith('._') &&
    !f.includes('__MACOSX')
  );

  if (kmlFiles.length === 0) {
    throw new Error('Geçersiz KMZ: Arşiv içinde okunabilir bir KML dosyası bulunamadı.');
  }

  const combinedFeatures: any[] = [];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

  for (const kmlFileName of kmlFiles) {
    const kmlData = await zip.file(kmlFileName)?.async('uint8array');
    if (!kmlData) continue;

    let kmlContent = decodeText(kmlData);
    kmlContent = cleanKMLText(kmlContent);

    for (const relativePath of files) {
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;

      const lowerPath = relativePath.toLowerCase();
      if (!imageExtensions.some(ext => lowerPath.endsWith(ext))) continue;

      const fileName = relativePath.split('/').pop();
      if (!fileName || !kmlContent.includes(fileName)) continue;

      const fileData = await zip.file(relativePath)?.async('blob');
      if (fileData) {
        const imageUrl = URL.createObjectURL(fileData);

        const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        kmlContent = kmlContent.replace(new RegExp(safePath, 'g'), imageUrl);
        kmlContent = kmlContent.replace(new RegExp(safeFileName, 'g'), imageUrl);
      }
    }

    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(kmlContent, 'text/xml');

    validateKML(kmlDom);

    const geoJson = toGeoJSON.kml(kmlDom);
    if (geoJson && geoJson.features) {
      combinedFeatures.push(...geoJson.features);
    }
  }

  return {
    type: 'FeatureCollection',
    features: combinedFeatures
  };
};

// ---------------------
// DOSYA ROUTER
// ---------------------
export const parseFile = async (file: File): Promise<any> => {
  const type = detectFileType(file.name);

  if (type === FileType.UNKNOWN) {
    throw new Error('Desteklenmeyen dosya formatı. Lütfen .kml veya .kmz dosyası yükleyin.');
  }

  try {
    if (type === FileType.KMZ) {
      return await parseKMZ(file);
    } else {
      return await parseKML(file);
    }
  } catch (e: any) {
    const msg = e.message || '';
    if (msg.includes('Corrupted zip') || msg.includes('End of data')) {
      throw new Error('Dosya bozuk veya eksik indirilmiş.');
    }
    throw e;
  }
};

// ---------------------
// RANDOM COLOR
// ---------------------
export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
