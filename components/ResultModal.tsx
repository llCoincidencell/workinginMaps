
import React from 'react';
import { X, CheckCircle2, AlertTriangle, Map, Layers } from 'lucide-react';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: string[];
  fileName: string;
  type?: 'intersection' | 'coverage'; // intersection: dosya bir yerin içinde, coverage: dosya başka şeyleri kapsıyor
}

export const ResultModal: React.FC<ResultModalProps> = ({ 
  isOpen, 
  onClose, 
  results, 
  fileName,
  type = 'intersection' 
}) => {
  if (!isOpen) return null;

  const hasMatch = results.length > 0;
  
  // Mesajları duruma göre ayarla
  let title = "Konum Analizi";
  let description = `"${fileName}" dosyası incelendi.`;
  let matchMessage = "Bu dosya şu alanların sınırları içerisinde kalmaktadır:";
  
  if (type === 'coverage' && hasMatch) {
    title = "Kapsama Analizi";
    description = `Yeni yüklenen "${fileName}" haritası incelendi.`;
    matchMessage = "Bu yeni harita, aşağıdaki mevcut dosyalarınızı kapsamaktadır:";
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden scale-100 transform transition-all">
        
        {/* Başlık */}
        <div className={`px-6 py-4 flex items-center justify-between ${hasMatch ? 'bg-indigo-600' : 'bg-gray-700'}`}>
          <div className="flex items-center gap-2 text-white">
            {type === 'coverage' ? <Layers size={20} /> : <Map size={20} />}
            <h3 className="font-bold tracking-wide">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 text-center">
          <div className="flex justify-center mb-4">
            {hasMatch ? (
              <div className="p-3 bg-indigo-100 rounded-full">
                <CheckCircle2 size={48} className="text-indigo-600" />
              </div>
            ) : (
              <div className="p-3 bg-amber-100 rounded-full">
                <AlertTriangle size={48} className="text-amber-600" />
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-6 font-medium">
            {description}
          </p>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-left">
            {hasMatch ? (
              <>
                <p className="text-sm font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">
                  {matchMessage}
                </p>
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300">
                  {results.map((res, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-indigo-800 bg-white p-2.5 rounded shadow-sm border border-indigo-100">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-indigo-500" />
                      <span className="font-semibold">{res}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="text-center">
                <p className="text-gray-800 font-medium">Kesişim Bulunamadı</p>
                <p className="text-xs text-gray-500 mt-1">
                  {type === 'intersection' 
                    ? "Yüklenen dosya, şu an haritada açık olan herhangi bir bölge sınırının içine düşmüyor."
                    : "Yeni yüklenen harita, mevcut dosyalarınızdan hiçbirini kapsamıyor."
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-3 text-center border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
