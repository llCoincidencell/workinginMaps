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
// UTF-8 + Windows-1254 (Gelişmiş)
// ---------------------
const decodeText = (buffer: Uint8Array): string => {
  const decoderUTF8 = new TextDecoder('utf-8', { fatal: true });
  try {
    return decoderUTF8.decode(buffer);
  } catch (e) {
    // UTF-8 başarısızsa Türkçe (Windows-1254) dene
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
    .replace(/<!--[\s\S]*?-->/g, '') // Yorumları temizle
    // Bozuk namespace tanımlarını temizle (bazı programlar hatalı xmlns koyar)
    .replace(/xmlns:[a-zA-Z0-9]+=""/g, '')
    .trim();
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

  // Parse hatası kontrolü
  const parserError = kmlDom.querySelector('parsererror');
  if (parserError) {
    throw new Error('KML dosyası okunamadı (XML Parse Hatası).');
  }

  const geoJson = toGeoJSON.kml(kmlDom);
  
  if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
    // KML'de feature yoksa boş dön, hata fırlatma (KMZ için önemli)
    return { type: 'FeatureCollection', features: [] };
  }

  return geoJson;
};

// ---------------------
// KMZ PARSE (GÜNCELLENDİ)
// ---------------------
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

  // TÜM KML dosyalarını tara
  for (const kmlFileName of kmlFiles) {
    try {
      const kmlData = await zip.file(kmlFileName)?.async('uint8array');
      if (!kmlData) continue;

      let kmlContent = decodeText(kmlData);
      kmlContent = cleanKMLText(kmlContent);

      // Resim/İkon yollarını düzelt (Blob URL yap)
      for (const relativePath of files) {
        if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;

        const lowerPath = relativePath.toLowerCase();
        if (!imageExtensions.some(ext => lowerPath.endsWith(ext))) continue;

        const fileName = relativePath.split('/').pop();
        if (!fileName || !kmlContent.includes(fileName)) continue;

        const fileData = await zip.file(relativePath)?.async('blob');
        if (fileData) {
          const imageUrl = URL.createObjectURL(fileData);
          
          // Regex ile güvenli değiştirme
          try {
            const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Hem tam yolu hem dosya adını değiştirmeyi dene
            kmlContent = kmlContent.replace(new RegExp(safePath, 'g'), imageUrl);
            kmlContent = kmlContent.replace(new RegExp(safeFileName, 'g'), imageUrl);
          } catch (e) {
            console.warn('Resim yolu değiştirilemedi:', e);
          }
        }
      }

      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(kmlContent, 'text/xml');

      // Eğer bu dosya bozuksa veya boşsa, atla ve diğerine geç
      const parserError = kmlDom.querySelector('parsererror');
      if (parserError) continue;

      const geoJson = toGeoJSON.kml(kmlDom);
      
      if (geoJson && geoJson.features) {
        combinedFeatures.push(...geoJson.features);
      }
    } catch (err) {
      console.warn(`KMZ içindeki ${kmlFileName} dosyası işlenirken hata oluştu (atlandı):`, err);
    }
  }

  // Döngü bittiğinde elimizde hiç veri yoksa O ZAMAN hata ver
  if (combinedFeatures.length === 0) {
    throw new Error('Dosya indirildi ancak içinde harita verisi (Placemark / Feature) bulunamadı.');
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
    let result;
    if (type === FileType.KMZ) {
      result = await parseKMZ(file);
    } else {
      result = await parseKML(file);
    }

    // Son kontrol: Feature yoksa hata fırlat (UI'da yakalamak için)
    if (!result || !result.features || result.features.length === 0) {
       throw new Error('Dosya içeriği boş veya harita verisi içermiyor.');
    }

    return result;

  } catch (e: any) {
    const msg = e.message || '';
    if (msg.includes('Corrupted zip') || msg.includes('End of data')) {
      throw new Error('Dosya bozuk veya eksik indirilmiş (Zip Hatası).');
    }
    throw e;
  }
};

export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
