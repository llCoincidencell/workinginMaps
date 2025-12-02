
import { OVALAR_DATA } from './embedded_ovalar';

// GITHUB YAPILANDIRMASI
export const USER: string = 'llCoincidencell'; 
export const REPO: string = 'workinginMaps';      
const BRANCH = 'main';           

// URL oluşturucu
const getGitHubUrl = (filename: string) => {
  return `https://raw.githubusercontent.com/${USER}/${REPO}/${BRANCH}/${encodeURIComponent(filename)}`;
};

// Harita Listesi
// filename: GitHub'dan çeker
// url: Harici linkten çeker
// data: Doğrudan kodun içinden (Gömülü) çeker
const mapsConfig = [

  { name: 'BOKA Sınırları', filename: 'BOKA.kmz' },
  { name: 'Ovalar (GitHub)', filename: 'OVALAR (4).kmz' }, 
  { name: 'Ovalar (GitHub)', filename: 'OVALAR.kmz' },
  { name: 'Su Tahsis Alanları', filename: 'SU TAHSİS ALANLARI (9).kmz' }, 
  { name: 'Tüm Korunan Alanlar', filename: 'tum_korunan_alanlar.kmz' }
];

export const availableMaps = mapsConfig.map(map => {
  // Eğer gömülü data varsa
  if ('data' in map) {
    return {
      name: map.name,
      url: null,
      data: map.data
    };
  }
  
  // URL veya Filename varsa
  return {
    name: map.name,
    url: 'url' in map ? map.url : getGitHubUrl(map.filename as string),
    data: null
  };
});
