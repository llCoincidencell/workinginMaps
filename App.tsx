import React, { useState, useRef, useEffect } from 'react';
import { Upload, Layers, Menu, Globe2, AlertCircle, X, CloudDownload, Check, Loader2 } from 'lucide-react';
import { MapView } from './components/MapView';
import { LayerList } from './components/LayerList';
import { parseFile, getRandomColor } from './utils/geoParser';
import { MapLayer } from './types';
import { v4 as uuidv4 } from 'uuid';
import { availableMaps, USER, REPO } from './data/githubMaps';

const App: React.FC = () => {
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  // Hangi haritanın o an yüklendiğini takip etmek için
  const [loadingMapUrl, setLoadingMapUrl] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focusTrigger, setFocusTrigger] = useState<{id: string, timestamp: number} | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Konfigürasyon kontrolü
  useEffect(() => {
    if (USER === 'KULLANICI_ADINIZ' || REPO === 'REPO_ADINIZ') {
      setConfigError("GitHub yapılandırması eksik.");
    }
  }, []);

  // GitHub'dan TEK BİR haritayı talep üzerine yükle
  const loadRemoteMap = async (name: string, url: string) => {
    // Eğer zaten yüklüyse tekrar yükleme
    if (layers.some(l => l.name === name)) {
      alert("Bu harita zaten yüklü.");
      return;
    }

    setLoadingMapUrl(url);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Dosya indirilemedi (${response.status})`);
      
      const blob = await response.blob();
      // Dosya ismini URL'den temizleyerek al
      let filename = url.substring(url.lastIndexOf('/') + 1) || 'harita.kml';
      filename = decodeURIComponent(filename).split('?')[0];

      const file = new File([blob], filename, { type: blob.type });
      const geoJsonData = await parseFile(file);
      
      const newLayer: MapLayer = {
        id: uuidv4(),
        name: name, // Listeden gelen temiz ismi kullan
        visible: true,
        data: geoJsonData,
        color: getRandomColor()
      };

      setLayers(prev => [...prev, newLayer]);
      
      // Harita yüklendiğinde menüyü kapat (Mobilde)
      if (isMobile) setIsSidebarOpen(false);

    } catch (err: any) {
      console.error("Yükleme hatası:", err);
      setError(`Harita yüklenemedi: ${err.message}`);
    } finally {
      setLoadingMapUrl(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const file = files[0];
      const geoJsonData = await parseFile(file);
      
      const newLayer: MapLayer = {
        id: uuidv4(),
        name: file.name,
        visible: true,
        data: geoJsonData,
        color: getRandomColor()
      };

      setLayers(prev => [...prev, newLayer]);
      if (isMobile) setIsSidebarOpen(false);
    } catch (err: any) {
      setError(err.message || "Dosya işlenirken hata oluştu");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleLayer = (id: string) => {
    setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const deleteLayer = (id: string) => {
    setLayers(layers.filter(l => l.id !== id));
  };

  const handleLayerFocus = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: true } : l));
    setFocusTrigger({ id, timestamp: Date.now() });
    if (isMobile) setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans text-gray-900 relative">
      
      {/* Yan Menü */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-[2000] w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out
          flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Globe2 size={24} />
            <h1 className="font-bold text-lg tracking-tight">GeoVisor</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white/80 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300">
          
          {configError && (
             <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex gap-2 items-start">
               <AlertCircle size={16} className="shrink-0 mt-0.5" />
               <p>{configError}</p>
             </div>
          )}

          {/* HAZIR HARİTALAR LİSTESİ (GITHUB) */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm mb-3">
              <CloudDownload size={16} className="text-indigo-600" />
              <h2>Hazır Haritalar (Bulut)</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {availableMaps.map((map) => {
                const isLoaded = layers.some(l => l.name === map.name);
                const isLoadingThis = loadingMapUrl === map.url;

                return (
                  <button
                    key={map.url}
                    onClick={() => !isLoaded && loadRemoteMap(map.name, map.url)}
                    disabled={isLoaded || isLoadingThis}
                    className={`
                      flex items-center justify-between p-3 rounded-lg text-left text-sm transition-all border
                      ${isLoaded 
                        ? 'bg-green-50 border-green-200 text-green-700 cursor-default' 
                        : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm text-gray-700 hover:bg-gray-50'}
                    `}
                  >
                    <span className="font-medium truncate">{map.name}</span>
                    
                    {isLoadingThis && <Loader2 size={16} className="animate-spin text-indigo-600" />}
                    {isLoaded && <Check size={16} className="text-green-600" />}
                    {!isLoaded && !isLoadingThis && <CloudDownload size={16} className="text-gray-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="my-4 border-gray-100" />

          {/* DOSYA YÜKLEME */}
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-indigo-400 transition-all cursor-pointer group active:scale-95">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                <p className="text-sm text-gray-500 font-medium group-hover:text-indigo-600">
                  {loading ? 'İşleniyor...' : 'Cihazdan Yükle'}
                </p>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept=".kml,.kmz" 
                onChange={handleFileUpload}
                disabled={loading}
              />
            </label>
            {error && (
              <div className="mt-2 p-2 text-xs text-red-600 bg-red-50 rounded border border-red-100">
                {error}
              </div>
            )}
          </div>

          {/* AKTİF KATMANLAR */}
          <div className="mb-2 flex items-center gap-2 text-gray-800 font-semibold text-sm">
            <Layers size={16} />
            <h2>Aktif Katmanlar</h2>
          </div>
          <LayerList 
            layers={layers} 
            onToggle={toggleLayer} 
            onDelete={deleteLayer} 
            onFocus={handleLayerFocus}
            isLoading={loading}
          />

        </div>

        <div className="p-3 border-t border-gray-100 text-[10px] text-gray-400 text-center">
          GeoVisor © 2024
        </div>
      </div>

      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/30 z-[1500] backdrop-blur-[1px]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`flex-1 h-full relative z-0 transition-all duration-300 ${isSidebarOpen && !isMobile ? 'ml-80' : 'ml-0'}`}>
        <MapView layers={layers} focusTrigger={focusTrigger} />
        
        <button
           onClick={() => setIsSidebarOpen(!isSidebarOpen)}
           className={`
             absolute top-4 left-4 z-[400] p-2.5 bg-white hover:bg-gray-50 rounded-lg shadow-lg text-gray-700 transition-all active:scale-95
             ${isSidebarOpen && !isMobile ? 'hidden' : 'flex'}
           `}
        >
          <Menu size={20} />
        </button>
      </div>
    </div>
  );
};

export default App;
