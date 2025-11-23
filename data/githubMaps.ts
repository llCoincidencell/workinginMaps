
// GITHUB YAPILANDIRMASI
export const USER: string = 'llCoincidencell'; 
export const REPO: string = 'workinginMaps';      
const BRANCH = 'main';           

// URL oluşturucu
// encodeURIComponent fonksiyonu, dosya ismindeki ( ) ve boşlukları otomatik düzeltir.
const getUrl = (filename: string) => {
  return `https://raw.githubusercontent.com/${USER}/${REPO}/${BRANCH}/${encodeURIComponent(filename)}`;
};

// Yüklenecek dosyaların listesi
// DİKKAT: Filename kısmı, GitHub'daki dosya ismiyle BÜYÜK/KÜÇÜK HARF dahil birebir aynı olmalıdır.
export const availableMaps = [
  { name: 'BOKA Sınırları', filename: 'BOKA.kmz' },
  { name: 'Ovalar', filename: 'OVALAR.kmz' }, // Düzeltildi: Kullanıcının belirttiği gibi BÜYÜK HARF
  { name: 'Su Tahsis Alanları', filename: 'SU_tahsis_alanlari.kmz' }, // Düzeltildi: Kullanıcının belirttiği isme sadık kalındı
  { name: 'Tüm Korunan Alanlar', filename: 'tum_korunan_alanlar.kmz' }
].map(map => ({
  name: map.name,
  url: getUrl(map.filename)
}));
