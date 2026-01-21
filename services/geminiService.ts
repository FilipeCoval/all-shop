import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { STORE_NAME } from '../constants';
import { InventoryProduct, Product } from '../types';

let chatSession: Chat | null = null;

// Agora aceita a lista de produtos como argumento
const getSystemInstruction = (products: Product[]): string => {
  const productsList = products.map(p => 
    `- **${p.name}** (€ ${p.price.toFixed(2)})${p.variants ? ' [Várias Opções/Variantes Disponíveis]' : ''}${p.comingSoon ? ' [PRODUTO EM BREVE - Brevemente no Stock]' : ''}\n  Categoria: ${p.category}\n  Descrição: ${p.description}\n  Specs: ${p.features.join(', ')}`
  ).join('\n\n');

  return `
Atue como o **Especialista de Tecnologia e Vendas** da loja **${STORE_NAME}**.
Sua missão é converter curiosos em clientes, explicando as diferenças técnicas de forma simples e profissional.

Responda sempre em Português de Portugal. Use emojis para ser amigável.

**📦 CATÁLOGO ATUALIZADO (Use apenas estes dados):**
${productsList}
`;
}

// Inicia sessão com os produtos atuais
export const initializeChat = async (products: Product[]): Promise<Chat> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  chatSession = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: getSystemInstruction(products),
      temperature: 0.3,
      maxOutputTokens: 600,
      thinkingConfig: { thinkingBudget: 300 },
    },
  });
  return chatSession;
};

// Recebe os produtos para garantir que a IA sabe do que está a falar
export const sendMessageToGemini = async (message: string, currentProducts: Product[]): Promise<string> => {
  try {
    // Recria a sessão se for a primeira vez ou se os produtos mudarem (idealmente)
    // Para simplificar, recriamos se não existir
    if (!chatSession) {
        await initializeChat(currentProducts);
    }
    
    if (!chatSession) return "A ligar sistemas...";
    
    const response: GenerateContentResponse = await chatSession.sendMessage({ message });
    return response.text || "Pode repetir?";
  } catch (error) {
    console.error(error);
    return "Tive um soluço técnico. Pode tentar de novo?";
  }
};

export const getInventoryAnalysis = async (products: InventoryProduct[], userPrompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const inventoryContext = products
      .filter(p => (p.quantityBought - p.quantitySold) > 0)
      .map(p => {
        const remaining = p.quantityBought - p.quantitySold;
        const profit = (p.salePrice - p.purchasePrice) * remaining;
        return `- ${p.name} (${p.variant || 'Padrão'}): ${remaining} unidades em stock. Custo unitário: ${p.purchasePrice.toFixed(2)}€. Preço de venda: ${p.salePrice.toFixed(2)}€. Lucro potencial total neste lote: ${profit.toFixed(2)}€.`;
      })
      .join('\n');

    const prompt = `
      Você é um consultor estratégico de e-commerce para a loja Allshop.
      O seu objetivo é analisar o inventário atual e fornecer conselhos práticos e criativos para maximizar o lucro e movimentar o stock.
      
      INVENTÁRIO ATUAL (APENAS PRODUTOS COM STOCK):
      ${inventoryContext}
      
      PEDIDO DO GESTOR: "${userPrompt}"
      
      As suas respostas devem ser:
      - Em Português de Portugal.
      - Diretas, práticas e focadas em ações.
      - Sugira bundles (combos de produtos), promoções específicas ("leve X pague Y"), ou destaque os produtos com maior margem de lucro.
      - Use **negrito** para destacar produtos ou ações chave.
      - Mantenha um tom profissional mas encorajador.
    `;

    try {
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-pro-preview', 
            contents: prompt 
        });
        return response.text || "Não foi possível gerar uma análise. Tente ser mais específico.";
    } catch (e) { 
        console.error("Gemini Analysis Error:", e);
        return "Ocorreu um erro ao comunicar com o serviço de IA. Verifique a consola para mais detalhes."; 
    }
};

/**
 * Extrai o Número de Série (S/N) ou Código de Barras de uma imagem Base64.
 * Ideal para etiquetas difíceis (Xiaomi, alta densidade, reflexos).
 */
export const extractSerialNumberFromImage = async (base64Image: string): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        // Usar gemini-3-flash-preview que é multimodal (vê imagens e texto)
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64Image
                        }
                    },
                    {
                        text: "Analyze this image of a product label. Locate the Serial Number (S/N), SN, IMEI, or the main alphanumeric identifier code. Return ONLY the code itself (letters and numbers). Remove any prefixes like 'S/N:', 'SN', 'IMEI:' or spaces. If multiple codes exist, prefer the one explicitly labeled 'S/N' or 'SN'. If the image is too blurry or no code is found, return 'NOT_FOUND'."
                    }
                ]
            }
        });

        const text = response.text?.trim();
        
        if (!text || text.includes('NOT_FOUND')) return null;
        
        // Limpeza extra para garantir que só vem o código (remove espaços e caracteres especiais indesejados)
        // Mantém letras, números, hífens e barras que são comuns em S/Ns
        const cleanCode = text.replace(/[^a-zA-Z0-9\-\/]/g, '');
        
        return cleanCode.length > 3 ? cleanCode : null; // Filtra leituras muito curtas/ruído
    } catch (error) {
        console.error("Gemini OCR Error:", error);
        // Lança o erro para que o Dashboard o possa mostrar no alert (incluindo erros de permissão)
        throw error;
    }
};
