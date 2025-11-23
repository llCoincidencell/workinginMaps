import React from 'react';
import { MapLayer } from '../types';
import { Eye, EyeOff, Trash2, Bot, Loader2, MapPin } from 'lucide-react';

interface LayerListProps {
  layers: MapLayer[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAnalyze: (layer: MapLayer) => void;
  onFocus: (id: string) => void;
  analyzingId: string | null;
}

export const LayerList: React.FC<LayerListProps> = ({ 
  layers, 
  onToggle, 
  onDelete, 
  onAnalyze,
  onFocus,
  analyzingId 
}) => {
  if (layers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">Yüklü katman yok.</p>
        <p className="text-xs mt-1">Başlamak için .kml veya .kmz dosyası yükleyin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {layers.map((layer) => (
        <div 
          key={layer.id} 
          className={`bg-white p-3 rounded-lg shadow-sm border transition-all duration-200 flex flex-col gap-2 ${!layer.visible ? 'opacity-60 bg-gray-50' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            {/* Layer Name Section - Clickable for Focus */}
            <div 
              onClick={() => onFocus(layer.id)}
              className="flex items-center gap-2 overflow-hidden cursor-pointer group hover:opacity-80 transition-opacity flex-1"
              title="Haritada bu katmana git"
            >
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                style={{ backgroundColor: layer.color }}
              />
              <span className="font-medium text-sm text-gray-700 truncate group-hover:text-indigo-600 transition-colors">
                {layer.name}
              </span>
              <MapPin size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(layer.id); }}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title={layer.visible ? "Katmanı Gizle" : "Katmanı Göster"}
              >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Katmanı Sil"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          
          <button
            onClick={() => onAnalyze(layer)}
            disabled={analyzingId === layer.id}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors disabled:opacity-70"
          >
            {analyzingId === layer.id ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analiz ediliyor...
              </>
            ) : (
              <>
                <Bot size={14} />
                Gemini ile Analiz Et
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  );
};