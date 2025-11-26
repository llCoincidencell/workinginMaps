import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import { FileType } from '../types';

export const detectFileType = (filename: string): FileType => {
  if (filename.toLowerCase().endsWith('.kml')) return FileType.KML;
  if (filename.toLowerCase().endsWith('.kmz')) return FileType.KMZ;
  return FileType.UNKNOWN;
};

export const parseFile = async (file: File): Promise<any> => {
  const type = detectFileType(file.name);
  
  if (type === FileType.UNKNOWN) {
    throw new Error('Desteklenmeyen dosya formatı. Lütfen .kml veya .kmz dosyası yükleyin.');
  }

  if (type === FileType.KMZ) {
    return parseKMZ(file);
  } else {
    return parseKML(file);
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
  
  // 1. KML dosyasını bul (Genellikle doc.kml veya kök dizindeki ilk .kml dosyasıdır)
  let kmlFileName = Object.keys(zip.files).find(filename => filename.toLowerCase().endsWith('.kml'));
  
  if (!kmlFileName) {
    throw new Error('Geçersiz KMZ: Arşiv içinde KML dosyası bulunamadı.');
  }

  let kmlContent = await zip.file(kmlFileName)?.async('string');
  if (!kmlContent) {
    throw new Error('KMZ içeriğinden KML okunamadı.');
  }

  // 2. Resim dosyalarını işle (Gömülü ikonlar için)
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
  
  // Tüm dosya listesini al
  const fileNames = Object.keys(zip.files);

  for (const relativePath of fileNames) {
    const lowerPath = relativePath.toLowerCase();
    
    // Eğer dosya bir resimse
    if (imageExtensions.some(ext => lowerPath.endsWith(ext))) {
      const fileData = await zip.file(relativePath)?.async('blob');
      if (fileData) {
        // Blob'dan geçici bir URL oluştur
        const imageUrl = URL.createObjectURL(fileData);
        
        // KML içinde bu resmin geçtiği yolları bul ve değiştir.
        // KMZ içinde yollar "files/img.png" veya sadece "img.png" olabilir.
        // Windows zip'lerinde "files\img.png" olabilir.
        
        // 1. Dosya adını tam yol olarak değiştirmeyi dene
        // Regex ile özel karakterleri kaçır (escape)
        const safePath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPath = new RegExp(safePath, 'g');
        kmlContent = kmlContent.replace(regexPath, imageUrl);

        // 2. Sadece dosya ismini değiştirmeyi dene (bazı KML'ler relative path kullanmaz)
        const fileName = relativePath.split('/').pop() || relativePath;
        if (fileName !== relativePath) {
             const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             // Sadece href etiketi içindekileri veya benzerlerini değiştirmek daha güvenli olabilir ama
             // basitlik adına global replace yapıyoruz.
             const regexFile = new RegExp(safeFileName, 'g');
             kmlContent = kmlContent.replace(regexFile, imageUrl);
        }
      }
    }
  }

  // 3. Güncellenmiş KML'i parse et
  const parser = new DOMParser();
  const kml = parser.parseFromString(kmlContent, 'text/xml');
  return toGeoJSON.kml(kml);
};

export const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};