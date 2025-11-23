import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import { FileType } from '../types';

export const detectFileType = (filename: string): FileType => {
  const cleanName = filename.split('?')[0].toLowerCase();
  
  if (cleanName.endsWith('.kml')) return FileType.KML;
  if (cleanName.endsWith('.kmz')) return FileType.KMZ;
  return FileType.UNKNOWN;
};

// Metin çözücü: Önce UTF-8 dener, bozuksa Türkçe (windows-1254) dener
const decodeText = (buffer: Uint8Array): string => {
  const decoderUTF8 = new TextDecoder('utf-8', { fatal: true });
  try {
    return decoderUTF8.decode(buffer);
  } catch (e) {
    // UTF-8 hatası verirse Türkçe encoding dene
    console.warn("UTF-8 decoding failed, trying windows-1254 for Turkish support");
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
  // File.text() yerine buffer okuyup decode ediyoruz (Encoding sorunu için)
  const buffer = await file.arrayBuffer();
  const text = decodeText(new Uint8Array(buffer));
  
  const parser = new DOMParser();
  const kml = parser.parseFromString(text, 'text/xml');
  return toGeoJSON.kml(kml);
};

const parseKMZ = async (file: File): Promise<any> => {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);
  
  // Tüm KML dosyalarını bul
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
    // String yerine Uint8Array oku (Encoding kontrolü için)
    const kmlData = await zip.file(kmlFileName)?.async('uint8array');
    if (!kmlData) continue;

    let kmlContent = decodeText(kmlData);

    // Resim ikonlarını (blob) işle
    for (const relativePath of files) {
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;
      
      const lowerPath = relativePath.toLowerCase();
      if (!imageExtensions.some(ext => lowerPath.endsWith(ext))) continue;

      const fileName = relativePath.split('/').pop();
      // Basit kontrol: dosya adı KML içinde geçiyor mu?
      if (!fileName || !kmlContent.includes(fileName)) continue;

      const fileData = await zip.file(relativePath)?.async('blob');
      if (fileData) {
        const imageUrl = URL.createObjectURL(fileData);
        
        // Regex ile değiştir (Slaç yönlerini de hesaba kat)
        try {
          // Tam yol değişimi
          const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          kmlContent = kmlContent.replace(new RegExp(safePath, 'g'), imageUrl);

          // Sadece dosya adı değişimi
          const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          kmlContent = kmlContent.replace(new RegExp(safeFileName, 'g'), imageUrl);
        } catch (err) {
          console.warn('Image replacement regex error:', err);
        }
      }
    }

    // Parse et ve birleştir
    try {
      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(kmlContent, 'text/xml');
      
      // Hata kontrolü: XML parse edilemediyse
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
      console.warn(`KML to GeoJSON failed for ${kmlFileName}:`, err);
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
