import React from 'react';
import { X, Map, Bot } from 'lucide-react';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Bot size={20} />
            <h3 className="font-semibold">Yapay Zeka Coğrafi Analizi</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4 text-gray-700 border-b pb-2">
            <Map size={18} className="text-indigo-600" />
            <span className="font-medium">Kaynak: {title}</span>
          </div>
          
          <div className="prose prose-sm max-w-none text-gray-600 max-h-[60vh] overflow-y-auto">
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded hover:bg-gray-300 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};