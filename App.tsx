import React, { useState, useRef, useEffect } from 'react';
import { Upload, Layers, Menu, Globe2, AlertCircle, X } from 'lucide-react';
import { MapView } from './components/MapView';
import { LayerList } from './components/LayerList';
import { parseFile, getRandomColor } from './utils/geoParser';
import { MapLayer } from './types';
import { v4 as uuidv4 } from 'uuid';
import { githubMaps, USER, REPO } from './data/githubMaps';

const App: React.FC = () => {
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Haritada odaklanma için trigger state
  const [focusTrigger, setFocusTrigger] = useState<{id: string, timestamp: number} | null>(null);

  // Ekran genişliğini takip et (Mobil tespiti için)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    // Başlangıçta mobildeysek menüyü kapat
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // GitHub verilerini yükle
  useEffect(() => {
    if (USER === 'KULLANICI_ADINIZ' || REPO === 'REPO_ADINIZ') {
      setConfigError("GitHub yapılandırması eksik.");
      return;
    }

    const loadExternalMaps = async () => {
      if (githubMaps.length === 0) return;

      setLoading(true);
      try {
        const promises = githubMaps.map(async (url) => {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const blob = await response.blob();
            let filename = url.substring(url.lastIndexOf('/') + 1) || 'harita.kml';
            filename = decodeURIComponent(filename); 
            filename = filename.split('?')[0];

            const file = new File([blob], filename, { type: blob.type });
            const geoJsonData = await parseFile(file);
            
            return {
              id: uuidv4(),
              name: filename,
              visible: true,
              data: geoJsonData,
              color: getRandomColor()
            } as MapLayer;
          } catch (err) {
            console.error(`Harita yüklenemedi ${url}:`, err);
            return null;
          }
        });

        const results = await Promise.all(promises);
        const validLayers = results.filter((l): l is MapLayer => l !== null);
        
        if (validLayers.length > 0) {
          setLayers(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNewLayers = validLayers.filter(l => !existingIds.has(l.id));
            return [...prev, ...uniqueNewLayers];
          });
        }
      } catch (err) {
        console.error("Dış kaynak hatası:", err);
      } finally {
        setLoading(false);
      }
    };

    loadExternalMaps();
  }, []);

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
      if (isMobile) setIsSidebarOpen(false); // Mobilde yükleyince menüyü kapat
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
    if (isMobile) setIsSidebarOpen(false); // Mobilde tıklayınca haritayı görmek için menüyü kapat
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
          {/* Mobilde Menü Kapatma Butonu */}
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

          <div className="mb-6">
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-indigo-400 transition-all cursor-pointer group active:scale-95">
              <div className="flex flex-col items-center justify-center pt-3 pb-4">
                <Upload className="w-6 h-6 mb-2 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                <p className="text-sm text-gray-500 font-medium group-hover:text-indigo-600">
                  {loading ? 'İşleniyor...' : 'KML / KMZ Yükle'}
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

      {/* Menü Kapalıyken Mobilde Karartma Efekti */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/30 z-[1500] backdrop-blur-[1px]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Ana İçerik / Harita */}
      <div className={`flex-1 h-full relative z-0 transition-all duration-300 ${isSidebarOpen && !isMobile ? 'ml-80' : 'ml-0'}`}>
        <MapView layers={layers} focusTrigger={focusTrigger} />
        
        {/* Menü Açma Butonu */}
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
