// GITHUB YAPILANDIRMASI
export const USER: string = 'llCoincidencell'; 
export const REPO: string = 'workinginMaps';      
const BRANCH = 'main';           

// URL oluşturucu
const getUrl = (filename: string) => `https://raw.githubusercontent.com/${USER}/${REPO}/${BRANCH}/${filename}`;

// Kullanıcının seçmesi için listelenen haritalar
// name: Menüde görünecek isim
// filename: GitHub'daki dosya adı (boşluklar %20 olmalı)
export const availableMaps = [
  { name: "BOKA Sınırları", filename: 'BOKA.kmz' },
  { name: "Ovalar", filename: 'OVALAR%20(4).kmz' },
  { name: "Su Tahsis Alanları", filename: 'SU%20TAHSİS%20ALANLARI%20(9).kmz' },
  { name: "Tüm Korunan Alanlar", filename: 'tum_korunan_alanlar.kmz' }
].map(map => ({
  ...map,
  url: getUrl(map.filename)
}));
