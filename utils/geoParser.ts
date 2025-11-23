import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import { FileType } from '../types';

export const detectFileType = (filename: string): FileType => {
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
  
  // STRATEJİ: En doğru KML dosyasını bul
  // 1. İsminde 'doc.kml' geçen (klasör içinde olsa bile) dosyayı ara.
  let kmlFileName = files.find(f => f.toLowerCase().endsWith('doc.kml') && !f.startsWith('._') && !f.includes('__MACOSX'));

  // 2. Bulunamazsa, herhangi bir .kml dosyası ara ama EN BÜYÜK olanı seç (Metadata dosyalarını elemek için)
  if (!kmlFileName) {
    const kmlFiles = files.filter(f => f.toLowerCase().endsWith('.kml') && !f.startsWith('._') && !f.includes('__MACOSX'));
    
    if (kmlFiles.length > 0) {
      // Dosya boyutlarını kontrol etmek için async işlem gerekir, basitçe ilkini değil, varsa en mantıklısını seçelim.
      // Şimdilik ilk bulunanı alıyoruz ama genelde en büyük dosya asıl veridir.
      // JSZip senkron size bilgisi vermediği için listeyi kullanıyoruz.
      kmlFileName = kmlFiles[0]; 
    }
  }
  
  if (!kmlFileName) {
    throw new Error('Geçersiz KMZ: Arşiv içinde okunabilir bir KML dosyası bulunamadı.');
  }

  let kmlContent = await zip.file(kmlFileName)?.async('string');
  if (!kmlContent) {
    throw new Error('KMZ içeriğinden KML okunamadı.');
  }

  // 3. Resim dosyalarını işle (Gömülü ikonlar için)
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

  for (const relativePath of files) {
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;

    const lowerPath = relativePath.toLowerCase();
    
    if (imageExtensions.some(ext => lowerPath.endsWith(ext))) {
      const fileData = await zip.file(relativePath)?.async('blob');
      if (fileData) {
        const imageUrl = URL.createObjectURL(fileData);
        
        // Basit dosya ismi değişimi (files/icon.png -> blob:...)
        const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPath = new RegExp(safePath, 'g');
        kmlContent = kmlContent.replace(regexPath, imageUrl);

        // Sadece dosya ismini de değiştirmeyi dene (icon.png -> blob:...)
        const fileName = relativePath.split('/').pop();
        if (fileName && fileName !== relativePath) {
             const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             const regexFile = new RegExp(safeFileName, 'g');
             kmlContent = kmlContent.replace(regexFile, imageUrl);
        }
      }
    }
  }

  const parser = new DOMParser();
  const kml = parser.parseFromString(kmlContent, 'text/xml');
  return toGeoJSON.kml(kml);
};

export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};
