import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import { FileType } from '../types';

export const detectFileType = (filename: string): FileType => {
  // URL parametrelerini temizle (örn: dosya.kmz?raw=true -> dosya.kmz)
  const cleanName = filename.split('?')[0].toLowerCase();
  
  if (cleanName.endsWith('.kml')) return FileType.KML;
  if (cleanName.endsWith('.kmz')) return FileType.KMZ;
  return FileType.UNKNOWN;
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
    if (msg.includes('Corrupted zip') || msg.includes('End of data') || msg.includes('signature not found')) {
      throw new Error('KMZ dosyası bozuk veya tam indirilemedi.');
    }
    throw e;
  }
};

const parseKML = async (file: File): Promise<any> => {
  const text = await file.text();
  const parser = new DOMParser();
  const kml = parser.parseFromString(text, 'text/xml');
  return toGeoJSON.kml(kml);
};

const parseKMZ = async (file: File): Promise<any> => {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);
  
  // STRATEJİ: KMZ içindeki TÜM .kml dosyalarını bul ve birleştir.
  // Bazı KMZ'lerde 'doc.kml' sadece bir kapsayıcıdır, asıl veri başka bir kml'de olabilir.
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

  // Bulunan her KML dosyasını işle
  for (const kmlFileName of kmlFiles) {
    let kmlContent = await zip.file(kmlFileName)?.async('string');
    if (!kmlContent) continue;

    // Resim dosyalarını (ikonları) işle ve KML içine göm
    // Not: Performans için sadece KML içeriğinde adı geçen resimleri işliyoruz
    for (const relativePath of files) {
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;
      
      const lowerPath = relativePath.toLowerCase();
      if (!imageExtensions.some(ext => lowerPath.endsWith(ext))) continue;

      // Dosya adı KML içinde geçiyor mu kontrol et (Basit optimizasyon)
      const fileName = relativePath.split('/').pop();
      if (!fileName || !kmlContent.includes(fileName)) continue;

      const fileData = await zip.file(relativePath)?.async('blob');
      if (fileData) {
        const imageUrl = URL.createObjectURL(fileData);
        
        // Tam yol değişimi
        const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        kmlContent = kmlContent.replace(new RegExp(safePath, 'g'), imageUrl);

        // Sadece dosya adı değişimi
        const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        kmlContent = kmlContent.replace(new RegExp(safeFileName, 'g'), imageUrl);
      }
    }

    // KML'i GeoJSON'a çevir
    try {
      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(kmlContent, 'text/xml');
      const geoJson = toGeoJSON.kml(kmlDom);
      
      if (geoJson && geoJson.features) {
        combinedFeatures.push(...geoJson.features);
      }
    } catch (err) {
      console.warn(`KML ayrıştırılamadı (${kmlFileName}):`, err);
    }
  }

  if (combinedFeatures.length === 0) {
    // Hata fırlatmak yerine boş koleksiyon dönmeyelim, üst katmanda hata verelim
    return { type: 'FeatureCollection', features: [] };
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
