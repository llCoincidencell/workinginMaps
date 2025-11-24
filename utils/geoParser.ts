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
// UTF-8 + Windows-1254 Çözücü
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
// KML Temizleyici (AGRESİF)
// ---------------------
const cleanKMLText = (text: string): string => {
  return text
    .replace(/^\uFEFF/, '') // BOM temizle
    .replace(/<!--[\s\S]*?-->/g, '') // Yorumları sil
    .replace(/<\?xml.*?\?>/g, '') // XML başlığını sil (DOMParser için)
    .replace(/xmlns(:[a-z0-9]+)?="[^"]*"/g, '') // TÜM Namespace'leri sil (En önemli düzeltme)
    .replace(/<kml\s+[^>]*>/g, '<kml>') // KML etiketini temizle
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;') // Bozuk karakterleri düzelt
    .replace(/<!\[CDATA\[/g, '') // CDATA etiketlerini kaldır, içeriği tut
    .replace(/\]\]>/g, '')
    .trim();
};

// ---------------------
// KML Doğrulayıcı (Sadece Uyarı)
// ---------------------
const validateKML = (kmlDom: Document) => {
  const parserError = kmlDom.querySelector('parsererror');
  if (parserError) {
    console.warn("XML Parser Uyarısı (Yoksayılıyor):", parserError.textContent);
  }
  // Placemark kontrolü kaldırıldı. Boşsa boş dönsün, hata vermesin.
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
// KMZ PARSE (Hata Toleranslı Döngü)
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

  // TÜM KML DOSYALARINI TARA
  for (const kmlFileName of kmlFiles) {
    try {
      const kmlData = await zip.file(kmlFileName)?.async('uint8array');
      if (!kmlData) continue;

      let kmlContent = decodeText(kmlData);
      kmlContent = cleanKMLText(kmlContent);

      // Resim ikonlarını işle
      for (const relativePath of files) {
        if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;

        const lowerPath = relativePath.toLowerCase();
        if (!imageExtensions.some(ext => lowerPath.endsWith(ext))) continue;

        const fileName = relativePath.split('/').pop();
        // İçerik kontrolü (Hızlandırma)
        if (!fileName || !kmlContent.includes(fileName)) continue;

        const fileData = await zip.file(relativePath)?.async('blob');
        if (fileData) {
          const imageUrl = URL.createObjectURL(fileData);
          try {
            const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            kmlContent = kmlContent.replace(new RegExp(safePath, 'g'), imageUrl);
            
            if (fileName !== relativePath) {
                const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                kmlContent = kmlContent.replace(new RegExp(safeFileName, 'g'), imageUrl);
            }
          } catch (e) { console.warn('Resim replace hatası:', e); }
        }
      }

      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(kmlContent, 'text/xml');

      validateKML(kmlDom); // Hata fırlatmaz, sadece uyarır

      const geoJson = toGeoJSON.kml(kmlDom);
      
      if (geoJson && geoJson.features) {
        combinedFeatures.push(...geoJson.features);
      }

    } catch (err) {
      // Tek bir dosya bozuksa bile diğerlerini denemeye devam et!
      console.warn(`KMZ içindeki ${kmlFileName} okunamadı, atlanıyor.`, err);
    }
  }

  // Döngü bittiğinde hiç veri yoksa
  if (combinedFeatures.length === 0) {
    // Hata fırlatmak yerine boş dönüyoruz, App.tsx halleder.
    return { type: 'FeatureCollection', features: [] };
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
    const result = (type === FileType.KMZ) ? await parseKMZ(file) : await parseKML(file);

    // Son kontrol: Veri boş mu?
    if (!result || !result.features || result.features.length === 0) {
       throw new Error('Dosya okundu ancak içinde harita verisi (Çizim/Feature) bulunamadı.');
    }
    return result;

  } catch (e: any) {
    const msg = e.message || '';
    if (msg.includes('Corrupted zip') || msg.includes('End of data')) {
      throw new Error('Dosya bozuk veya eksik indirilmiş.');
    }
    throw e;
  }
};

export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
