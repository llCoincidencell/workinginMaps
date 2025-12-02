
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
const mapsConfig = [
  { name: 'bursa ova', filename: 'bursaova.kml' },
  { name: 'BOKA Sınırları', filename: 'BOKA.kmz' },
  { name: 'Su Tahsis Alanları', filename: 'SU TAHSİS ALANLARI (9).kmz' }, 
  { name: 'Tüm Korunan Alanlar', filename: 'tum_korunan_alanlar.kmz' }
];

export const availableMaps = mapsConfig.map(map => {
  // URL veya Filename varsa
  return {
    name: map.name,
    url: 'url' in map ? (map as any).url : getGitHubUrl((map as any).filename),
    data: null
  };
});
