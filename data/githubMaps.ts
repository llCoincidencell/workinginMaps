// GITHUB YAPILANDIRMASI
export const USER: string = 'llCoincidencell'; 
export const REPO: string = 'workinginMaps';      
const BRANCH = 'main';           

// URL oluşturucu
const getUrl = (filename: string) => {
  return `https://raw.githubusercontent.com/${USER}/${REPO}/${BRANCH}/${encodeURIComponent(filename)}`;
};

// Yüklenecek dosyaların listesi
export const availableMaps = [
  { name: 'BOKA Sınırları', filename: 'BOKA.kmz' },
  { name: 'Ovalar', filename: 'OVALAR4.kmz' }, // Düzeltildi: OVALAR.kmz
  { name: 'Su Tahsis Alanları', filename: 'su_tahsis_alanlari.kmz' },
  { name: 'Tüm Korunan Alanlar', filename: 'tum_korunan_alanlar.kmz' }
].map(map => ({
  name: map.name,
  url: getUrl(map.filename)
}));
