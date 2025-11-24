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
    // JSZip'ten gelen "Corrupted zip" hatalarını kullanıcı dostu dile çevir
    if (e.message && (e.message.includes('Corrupted zip') || e.message.includes('End of data'))) {
      throw new Error('Dosya içeriği bozuk veya eksik indirildi. GitHub\'daki dosyanın sağlam olduğundan emin olun.');
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
  
  // 1. KML dosyasını bul
  let kmlFileName = Object.keys(zip.files).find(filename => {
    const lowName = filename.toLowerCase();
    return lowName.endsWith('.kml') && 
           !filename.includes('__MACOSX') && 
           !filename.startsWith('._');
  });
  
  if (!kmlFileName) {
    throw new Error('Geçersiz KMZ: Arşiv içinde okunabilir bir KML dosyası bulunamadı.');
  }

  let kmlContent = await zip.file(kmlFileName)?.async('string');
  if (!kmlContent) {
    throw new Error('KMZ içeriğinden KML okunamadı.');
  }

  // 2. Resim dosyalarını işle
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
  const fileNames = Object.keys(zip.files);

  for (const relativePath of fileNames) {
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('._')) continue;

    const lowerPath = relativePath.toLowerCase();
    
    if (imageExtensions.some(ext => lowerPath.endsWith(ext))) {
      const fileData = await zip.file(relativePath)?.async('blob');
      if (fileData) {
        const imageUrl = URL.createObjectURL(fileData);
        
        const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPath = new RegExp(safePath, 'g');
        kmlContent = kmlContent.replace(regexPath, imageUrl);

        const fileName = relativePath.split('/').pop() || relativePath;
        if (fileName !== relativePath) {
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
