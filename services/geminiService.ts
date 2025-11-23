import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.API_KEY || '';

export const analyzeGeoData = async (geoJsonData: any, layerName: string): Promise<string> => {
  if (!GEMINI_API_KEY) {
    return "API Anahtarı eksik. Analiz yapılamıyor.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    // Simplify GeoJSON for prompt context to avoid token limits
    // We extract basic stats and the first few coordinates/properties
    const summary = JSON.stringify(geoJsonData).substring(0, 10000); 

    const prompt = `
      Sen bir Coğrafi Bilgi Sistemleri (GIS) uzmanısın. "${layerName}" adlı KML/KMZ dosyasından türetilen aşağıdaki GeoJSON verisini analiz et.
      
      1. Bu verinin neyi temsil ettiğini belirle (örn. yürüyüş parkuru, teslimat noktaları, uçuş yolu, sınır vb.).
      2. Koordinatlara dayanarak coğrafi bağlam sağla (örn. "Bu parkur ... yakınında yer alıyor").
      3. Karmaşıklığı özetle (nokta/çokgen sayısı).
      
      Yanıtı Türkçe, öz ve profesyonel tut.
      
      Veri Özeti:
      ${summary}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Analiz oluşturulamadı.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Yapay zeka servisiyle iletişimde hata oluştu. Lütfen daha sonra tekrar deneyin.";
  }
};