import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { PRODUCTS, STORE_NAME } from '../constants';
import { InventoryProduct } from '../types';

let chatSession: Chat | null = null;

const getSystemInstruction = (): string => {
  const productsList = PRODUCTS.map(p => 
    `- **${p.name}** (€ ${p.price.toFixed(2)})${p.variants ? ' [Várias Opções de Potência]' : ''}\n  Categoria: ${p.category}\n  Descrição: ${p.description}\n  Specs: ${p.features.join(', ')}`
  ).join('\n\n');

  return `
Atue como o **Especialista de Tecnologia e Vendas** da loja **${STORE_NAME}**.
Sua missão é converter curiosos em clientes, explicando as diferenças técnicas de forma simples e profissional.

**🧠 GUIA DE CARREGADORES:**
- Temos duas gamas de kits:
  1. **Carregador Turbo (Kit c/ Cabo):** Gama económica com excelente performance para uso diário (33W, 67W, 120W).
  2. **Carregador Xiaomi Turbo Original (Kit):** Gama oficial da marca, para quem não abre mão da certificação original (33W e 67W).
- O cabo **USB-C para USB-C (120W)** é ideal para modelos mais recentes e portáteis.

**🆚 BOXES DE TV:**
- **Xiaomi 3ª Gen:** Topo de gama, 32GB, Wi-Fi 6, suporte 8K. Destaque o salto de 130% em performance gráfica.
- **Xiaomi 2ª Gen:** A clássica estável para Netflix e Disney+.
- **H96 Max:** Potência bruta com 64GB de espaço e Android livre para APKs e IPTV.

Responda sempre em Português de Portugal.

**📦 CATÁLOGO ATUALIZADO:**
${productsList}
`;
}

export const initializeChat = async (): Promise<Chat> => {
  const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
  chatSession = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: getSystemInstruction(),
      temperature: 0.3,
      maxOutputTokens: 600,
    },
  });
  return chatSession;
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  try {
    if (!chatSession) await initializeChat();
    if (!chatSession) return "A ligar sistemas...";
    const response: GenerateContentResponse = await chatSession.sendMessage({ message });
    return response.text || "Pode repetir?";
  } catch (error) {
    console.error(error);
    return "Tive um soluço técnico. Pode tentar de novo?";
  }
};

export const getInventoryAnalysis = async (products: InventoryProduct[], userPrompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
    const inventoryContext = products.filter(p => p.status !== 'SOLD').map(p => `- ${p.name}: ${p.quantityBought - p.quantitySold} unid. (€${p.purchasePrice})`).join('\n');
    const prompt = `Consultor Financeiro Allshop. Inventário:\n${inventoryContext}\nPedido: ${userPrompt}\nRegras: Proteger lucro, sugerir combos.`;
    try {
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-pro-preview', 
            contents: prompt 
        });
        return response.text || "Sem sugestões.";
    } catch (e) { 
        return "Erro na análise."; 
    }
};
