// 1. GitHub Kullanıcı Adı
export const USER: string = 'llCoincidencell';

// 2. GitHub Repo Adı
export const REPO: string = 'workinginMaps';

// 3. Branch adı
const BRANCH = 'main';

// RAW URL oluşturucu
const getUrl = (filename: string) =>
  `https://raw.githubusercontent.com/${USER}/${REPO}/${BRANCH}/${filename}`;

// Harita listesi (RAW linkler)
export const githubMaps = [
  getUrl('BOKA.kmz'),
  getUrl('OVALAR%20(4).kmz'),
  getUrl('SU%20TAHSİS%20ALANLARI%20(9).kmz'),
   getUrl('SU_tahsis.alanlari.kmz'),
  getUrl('tum_korunan_alanlar.kmz'),
  getUrl('OVALAR.kmz')
];

// Çalıştırıldığında üretilen RAW URL'ler:
// https://raw.githubusercontent.com/llCoincidencell/workinginMaps/main/BOKA.kmz
// https://raw.githubusercontent.com/llCoincidencell/workinginMaps/main/OVALAR%20(4).kmz
// https://raw.githubusercontent.com/llCoincidencell/workinginMaps/main/SU%20TAHSİS%20ALANLARI%20(9).kmz
// https://raw.githubusercontent.com/llCoincidencell/workinginMaps/main/tum_korunan_alanlar.kmz
