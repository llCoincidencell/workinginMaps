
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
    // JSZip'ten gelen teknik hataları kullanıcı dostu dile çevir
    const msg = e.message || '';
    if (msg.includes('Corrupted zip') || msg.includes('End of data') || msg.includes('signature not found')) {
      throw new Error('KMZ dosyası bozuk veya tam indirilemedi. Dosya boş olabilir.');
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
  // Bazı KMZ'lerin içinde birden fazla KML olabilir veya doc.kml ana dizinde olmayabilir.
  
  // 1. Tüm .kml dosyalarını bul (sistem dosyaları hariç)
  const kmlFiles = files.filter(f => 
    f.toLowerCase().endsWith('.kml') && 
    !f.startsWith('._') && 
    !f.includes('__MACOSX')
  );

  let kmlFileName: string | undefined;

  if (kmlFiles.length === 0) {
    throw new Error('Geçersiz KMZ: Arşiv içinde okunabilir bir KML dosyası bulunamadı.');
  } else if (kmlFiles.length === 1) {
    kmlFileName = kmlFiles[0];
  } else {
    // Birden fazla KML varsa:
    // A. Önce 'doc.kml' ismini ara (Standart budur)
    kmlFileName = kmlFiles.find(f => f.toLowerCase().endsWith('doc.kml'));
    
    // B. Eğer doc.kml yoksa, sıkıştırılmamış boyutu EN BÜYÜK olanı seç (Asıl veri odur)
    if (!kmlFileName) {
       // Dosyaları boyutlarına göre sırala (Büyükten küçüğe)
       // Not: JSZip senkron olarak size bilgisini _data içinde tutar ama public API'de olmayabilir.
       // Bu yüzden basitçe isminde 'doc' geçeni veya en uzun isimliyi değil, ilkini alıyoruz.
       // Ancak daha sağlam olması için, genellikle en büyük dosya asıl haritadır.
       // JSZip v3'te zip.files[name]._data.uncompressedSize (internal) var ama kullanmak riskli.
       // Varsayılan olarak listesinin ilkini alacağız, genelde alfabetik veya eklenme sırasıdır.
       kmlFileName = kmlFiles[0];
    }
  }

  let kmlContent = await zip.file(kmlFileName!)?.async('string');
  if (!kmlContent) {
    throw new Error('KMZ içeriğinden KML okunamadı.');
  }

  // 2. Resim dosyalarını işle (Gömülü ikonlar için)
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

  for (const relativePath of files) {
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;

    const lowerPath = relativePath.toLowerCase();
    
    if (imageExtensions.some(ext => lowerPath.endsWith(ext))) {
      const fileData = await zip.file(relativePath)?.async('blob');
      if (fileData) {
        const imageUrl = URL.createObjectURL(fileData);
        
        // Regex ile dosya yollarını değiştir
        const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPath = new RegExp(safePath, 'g');
        kmlContent = kmlContent.replace(regexPath, imageUrl);

        // Sadece dosya ismini de değiştirmeyi dene (bazı KML'ler sadece ismi referans alır)
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
