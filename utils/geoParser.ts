import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import { FileType } from '../types';

export const detectFileType = (filename: string): FileType => {
  const cleanName = filename.split('?')[0].toLowerCase();
  
  if (cleanName.endsWith('.kml')) return FileType.KML;
  if (cleanName.endsWith('.kmz')) return FileType.KMZ;
  return FileType.UNKNOWN;
};

// --- YENİ: Akıllı Metin Çözücü ---
// Dosya UTF-8 mi yoksa Türkçe (Windows-1254) mi kontrol eder ve ona göre çevirir.
const decodeText = (buffer: Uint8Array): string => {
  const decoderUTF8 = new TextDecoder('utf-8', { fatal: true });
  try {
    // Önce standart UTF-8 dene
    return decoderUTF8.decode(buffer);
  } catch (e) {
    // Hata verirse (bozuk karakter varsa) Türkçe Encoding (Windows-1254) dene
    console.warn("UTF-8 decoding failed, switching to windows-1254 for Turkish characters.");
    const decoderTR = new TextDecoder('windows-1254'); 
    return decoderTR.decode(buffer);
  }
};

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

const parseKML = async (file: File): Promise<any> => {
  // text() yerine arrayBuffer okuyup decode ediyoruz
  const buffer = await file.arrayBuffer();
  const text = decodeText(new Uint8Array(buffer));
  
  const parser = new DOMParser();
  const kml = parser.parseFromString(text, 'text/xml');
  return toGeoJSON.kml(kml);
};

const parseKMZ = async (file: File): Promise<any> => {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);
  
  // Arşivdeki tüm .kml dosyalarını bul
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
    // String yerine Uint8Array (byte) olarak oku
    const kmlData = await zip.file(kmlFileName)?.async('uint8array');
    if (!kmlData) continue;

    // Byte verisini doğru karakter setine göre metne çevir
    let kmlContent = decodeText(kmlData);

    // Resim ikonlarını işle
    for (const relativePath of files) {
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;
      
      const lowerPath = relativePath.toLowerCase();
      if (!imageExtensions.some(ext => lowerPath.endsWith(ext))) continue;

      const fileName = relativePath.split('/').pop();
      if (!fileName || !kmlContent.includes(fileName)) continue;

      const fileData = await zip.file(relativePath)?.async('blob');
      if (fileData) {
        const imageUrl = URL.createObjectURL(fileData);
        
        try {
          const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          kmlContent = kmlContent.replace(new RegExp(safePath, 'g'), imageUrl);

          const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          kmlContent = kmlContent.replace(new RegExp(safeFileName, 'g'), imageUrl);
        } catch (err) {
          console.warn('Image replacement error:', err);
        }
      }
    }

    // GeoJSON'a çevir
    try {
      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(kmlContent, 'text/xml');
      
      const parserError = kmlDom.querySelector('parsererror');
      if (parserError) {
        console.warn(`XML Parsing Error in ${kmlFileName}:`, parserError.textContent);
        continue; 
      }

      const geoJson = toGeoJSON.kml(kmlDom);
      if (geoJson && geoJson.features) {
        combinedFeatures.push(...geoJson.features);
      }
    } catch (err) {
      console.warn(`Conversion failed for ${kmlFileName}:`, err);
    }
  }

  return {
    type: 'FeatureCollection',
    features: combinedFeatures
  };
};

export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
