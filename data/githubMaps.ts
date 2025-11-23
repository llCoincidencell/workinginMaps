
// BU DOSYAYI DÜZENLEYİN

// 1. GitHub Kullanıcı Adı
export const USER: string = 'llCoincidencell'; 

// 2. GitHub Repo Adı
export const REPO: string = 'workinginMaps';      

// 3. Branch adı (Genellikle main)
const BRANCH = 'main';           

// URL oluşturucu yardımcı fonksiyon
// raw.githubusercontent.com adresini kullanmak CORS hatalarını önler ve daha hızlıdır.
const getUrl = (filename: string) => `https://raw.githubusercontent.com/${USER}/${REPO}/${BRANCH}/${filename}`;

// Harita listesi
export const githubMaps = [
  getUrl('BOKA.kmz'),
  getUrl('OVALAR%20(4).kmz'),             // "OVALAR (4).kmz" için
  getUrl('SU%20TAHSİS%20ALANLARI%20(9).kmz'), // "SU TAHSİS ALANLARI (9).kmz" için
  getUrl('tum_korunan_alanlar.kmz')
];
