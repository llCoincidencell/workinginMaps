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
  if (cleanName.endsWith('.geojson') || cleanName.endsWith('.json')) return FileType.GEOJSON;
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
    // Türkçe karakter içeren eski Windows dosyaları için
    const decoderTR = new TextDecoder('windows-1254');
    return decoderTR.decode(buffer);
  }
};

// ---------------------
// KML TEMİZLEYİCİ (GÜÇLÜ MOD)
// ---------------------
const cleanKMLText = (text: string): string => {
  // 1. BOM temizle
  let clean = text.replace(/^\uFEFF/, '');

  // 2. XML Deklarasyonlarını temizle
  clean = clean.replace(/<\?xml[^>]*\?>/g, '');
  
  // 3. Namespace (xmlns) tanımlarını temizle
  clean = clean.replace(/xmlns(:[a-zA-Z0-9-_]+)?="[^"]*"/g, '');
  clean = clean.replace(/xmlns(:[a-zA-Z0-9-_]+)?='[^']*'/g, '');

  // 4. ETİKET PREFIX TEMİZLİĞİ 
  // <kml:Placemark> -> <Placemark>
  clean = clean.replace(/<(\/?)[a-zA-Z0-9-_]+:([a-zA-Z0-9-_]+)/g, '<$1$2');

  // 5. Hatalı & işaretlerini düzelt
  clean = clean.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g, '&amp;');

  return clean.trim();
};

// ---------------------
// KML PARSE
// ---------------------
const parseKML = async (file: File | Blob): Promise<any> => {
  const buffer = await file.arrayBuffer();
  let text = decodeText(new Uint8Array(buffer));
  text = cleanKMLText(text);

  const parser = new DOMParser();
  const dom = parser.parseFromString(text, 'text/xml');
  const geo = toGeoJSON.kml(dom);

  return normalizeGeoJSON(geo);
};

// ---------------------
// KMZ PARSE (GÜÇLENDİRİLMİŞ)
// ---------------------
const parseKMZ = async (file: File): Promise<any> => {
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);

  // KML olabilecek dosyaları bul (uzantısız veya .xml/.kml)
  const kmlFiles = files.filter(f =>
    (f.toLowerCase().endsWith('.kml') || f.toLowerCase().endsWith('.xml') || f.endsWith('doc')) &&
    !f.includes('__MACOSX') &&
    !f.startsWith('._')
  );

  console.log("KMZ İçindeki Potansiyel Dosyalar:", kmlFiles);

  const allFeatures: any[] = [];

  for (const name of kmlFiles) {
    try {
      const raw = await zip.file(name)?.async('uint8array');
      if (!raw) continue;

      let text = decodeText(raw);
      text = cleanKMLText(text);

      const parser = new DOMParser();
      const dom = parser.parseFromString(text, 'text/xml');
      const geo = toGeoJSON.kml(dom);
      
      if (geo?.features && geo.features.length > 0) {
        allFeatures.push(...geo.features);
      }
    } catch (err) {
      console.warn("KMZ içindeki bir dosya okunamadı:", name, err);
    }
  }

  return normalizeGeoJSON({
    type: "FeatureCollection",
    features: allFeatures
  });
};

// ---------------------
// GEOJSON NORMALİZASYON (YENİ)
// ---------------------
// İç içe geçmiş FeatureCollection'ları ve hatalı yapıları düzeltir.
export const normalizeGeoJSON = (data: any): any => {
  const features: any[] = [];

  const extract = (item: any) => {
    if (!item) return;

    if (Array.isArray(item)) {
      item.forEach(extract);
    } else if (item.type === 'FeatureCollection') {
      if (item.features && Array.isArray(item.features)) {
        item.features.forEach(extract);
      }
    } else if (item.type === 'Feature') {
      features.push(item);
    } else if (item.type === 'GeometryCollection') {
       // GeometryCollection'ı feature'lara çevir
       if (item.geometries && Array.isArray(item.geometries)) {
         item.geometries.forEach((geom: any) => {
           features.push({ type: 'Feature', properties: {}, geometry: geom });
         });
       }
    } else if (item.coordinates && item.type) {
       // Saf geometry objesi
       features.push({ type: 'Feature', properties: {}, geometry: item });
    }
  };

  extract(data);

  return {
    type: "FeatureCollection",
    features: features
  };
};

// ---------------------
// GEOJSON PARSE
// ---------------------
const parseGeoJSON = async (file: File): Promise<any> => {
  const text = await file.text();
  try {
    const json = JSON.parse(text);
    return normalizeGeoJSON(json);
  } catch (e) {
    throw new Error("Geçersiz GeoJSON formatı.");
  }
};

// ---------------------
// DOSYA ROUTER (ÇAPRAZ KONTROLLÜ)
// ---------------------
export const parseFile = async (file: File): Promise<any> => {
  const type = detectFileType(file.name);

  try {
    if (type === FileType.GEOJSON) {
      return await parseGeoJSON(file);
    } 
    else if (type === FileType.KMZ) {
      try {
        return await parseKMZ(file);
      } catch (kmzErr) {
        console.warn("KMZ olarak açılamadı, KML olarak deneniyor...", kmzErr);
        // Belki uzantısı KMZ ama içi düz KML'dir (İndirilen dosyalarda olabiliyor)
        return await parseKML(file);
      }
    } else {
      try {
        // Varsayılan olarak KML dene
        return await parseKML(file);
      } catch (kmlErr) {
         // KML başarısız olursa KMZ olarak dene (Belki uzantısı yanlıştır)
         console.warn("KML okuma başarısız, KMZ olarak deneniyor...", kmlErr);
         return await parseKMZ(file);
      }
    }
  } catch (error) {
    console.error("Parse İşlemi Hatası:", error);
    throw new Error("Dosya formatı bozuk veya okunamıyor. Lütfen geçerli bir KML, KMZ veya GeoJSON dosyası olduğundan emin olun.");
  }
};

// ---------------------
// RENK OLUŞTURUCU
// ---------------------
export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
