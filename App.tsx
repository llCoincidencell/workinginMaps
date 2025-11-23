
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Layers, Menu, Globe2 } from 'lucide-react';
import { MapView } from './components/MapView';
import { LayerList } from './components/LayerList';
import { AnalysisModal } from './components/AnalysisModal';
import { parseFile, getRandomColor } from './utils/geoParser';
import { analyzeGeoData } from './services/geminiService';
import { MapLayer } from './types';
import { v4 as uuidv4 } from 'uuid';
import { githubMaps } from './data/githubMaps';

const App: React.FC = () => {
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State to trigger map focus
  const [focusTrigger, setFocusTrigger] = useState<{id: string, timestamp: number} | null>(null);

  // Analysis State
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{isOpen: boolean; title: string; content: string}>({
    isOpen: false,
    title: '',
    content: ''
  });

  // External Data Loading (GitHub or Sample Data)
  useEffect(() => {
    const loadExternalMaps = async () => {
      if (githubMaps.length === 0) return;

      setLoading(true);
      try {
        const promises = githubMaps.map(async (url) => {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const blob = await response.blob();
            // URL'den dosya adını çıkar
            const filename = url.substring(url.lastIndexOf('/') + 1) || 'external-map.kml';
            
            // Blob'u File objesine çevir
            const file = new File([blob], filename, { type: blob.type });
            
            const geoJsonData = await parseFile(file);
            
            return {
              id: uuidv4(),
              name: decodeURIComponent(filename),
              visible: true,
              data: geoJsonData,
              color: getRandomColor()
            } as MapLayer;
          } catch (err) {
            console.error(`Failed to load map from ${url}:`, err);
            return null;
          }
        });

        const results = await Promise.all(promises);
        const validLayers = results.filter((l): l is MapLayer => l !== null);
        
        if (validLayers.length > 0) {
          setLayers(prev => {
            // Çakışmaları önlemek için mevcut olmayanları ekle
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNewLayers = validLayers.filter(l => !existingIds.has(l.id));
            return [...prev, ...uniqueNewLayers];
          });
        }
      } catch (err) {
        console.error("External map loading error:", err);
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
      if (!isSidebarOpen) setIsSidebarOpen(true);
    } catch (err: any) {
      setError(err.message || "Dosya işlenirken hata oluştu");
    } finally {
      setLoading(false);
      // Reset input so same file can be selected again if deleted
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

  const handleAnalyze = async (layer: MapLayer) => {
    setAnalyzingId(layer.id);
    try {
      const analysis = await analyzeGeoData(layer.data, layer.name);
      setModalData({
        isOpen: true,
        title: layer.name,
        content: analysis
      });
    } catch (e) {
       setError("Analiz başarısız oldu");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleLayerFocus = (id: string) => {
    // Ensure the layer is visible when trying to focus
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: true } : l));
    
    // Update trigger with timestamp to allow re-focusing the same layer
    setFocusTrigger({ id, timestamp: Date.now() });
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans text-gray-900">
      
      {/* Sidebar */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-[1000] w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out
          flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          ${!isSidebarOpen && 'md:-ml-80'}
        `}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-indigo-600 text-white">
          <Globe2 size={24} />
          <h1 className="font-bold text-xl tracking-tight">GeoVisor</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {/* Upload Section */}
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-indigo-400 transition-all cursor-pointer group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                <p className="text-sm text-gray-500 font-medium group-hover:text-indigo-600">
                  {loading ? 'İşleniyor...' : 'KML / KMZ Dosyası Yükle'}
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

          {/* Layers List */}
          <div className="mb-2 flex items-center gap-2 text-gray-800 font-semibold">
            <Layers size={18} />
            <h2>Aktif Katmanlar</h2>
          </div>
          <LayerList 
            layers={layers} 
            onToggle={toggleLayer} 
            onDelete={deleteLayer} 
            onAnalyze={handleAnalyze}
            onFocus={handleLayerFocus}
            analyzingId={analyzingId}
          />

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          Desteklenen: .kml, .kmz
          <br/>
          Gemini 2.5 & Leaflet ile güçlendirilmiştir
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute top-4 left-4 z-[999] md:hidden p-2 bg-white rounded-md shadow-md text-gray-700"
      >
        <Menu size={24} />
      </button>

      {/* Map Area */}
      <div className="flex-1 h-full relative z-0">
        <MapView layers={layers} focusTrigger={focusTrigger} />
        
        {/* Desktop Toggle for Sidebar */}
        <button
           onClick={() => setIsSidebarOpen(!isSidebarOpen)}
           className={`
             hidden md:flex absolute top-4 z-[400] p-2 bg-white hover:bg-gray-50 rounded-lg shadow-md text-gray-600 transition-all duration-300
             ${isSidebarOpen ? 'left-4' : 'left-4'}
           `}
           style={{ left: isSidebarOpen ? '1rem' : '1rem' }}
        >
          {isSidebarOpen ? <Menu className="rotate-180" size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnalysisModal 
        isOpen={modalData.isOpen}
        onClose={() => setModalData({...modalData, isOpen: false})}
        title={modalData.title}
        content={modalData.content}
      />
    </div>
  );
};

export default App;
