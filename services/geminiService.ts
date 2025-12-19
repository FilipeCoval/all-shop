
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { PRODUCTS, STORE_NAME } from '../constants';
import { InventoryProduct } from '../types';

let chatSession: Chat | null = null;

const getSystemInstruction = (): string => {
  const productsList = PRODUCTS.map(p => 
    `- **${p.name}** (€ ${p.price.toFixed(2)})${p.variants ? ' [Várias Opções/Variantes Disponíveis]' : ''}${p.comingSoon ? ' [PRODUTO EM BREVE - Brevemente no Stock]' : ''}\n  Categoria: ${p.category}\n  Descrição: ${p.description}\n  Specs: ${p.features.join(', ')}`
  ).join('\n\n');

  return `
Atue como o **Especialista de Tecnologia e Vendas** da loja **${STORE_NAME}**.
Sua missão é converter curiosos em clientes, explicando as diferenças técnicas de forma simples e profissional.

**🚀 GRANDES NOVIDADES A CHEGAR (EM BREVE):**
1. **Logitech G502 HERO:** O rato gaming lendário com sensor HERO 25K. Destaque a precisão, os 11 botões para macros e o sistema de pesos. É o sonho de qualquer gamer ou profissional de edição.
2. **Mouse Pad XL Sports Car:** Tapetes de 900x400mm com design premium. Perfeitos para proteger a mesa e dar um look incrível ao setup.

**🔗 CONECTIVIDADE E CABOS:**
- **Hub Acer USB-A para Ethernet:** A solução perfeita para quem precisa de internet Gigabit estável no portátil via porta USB comum.
- **Cabo Xiaomi Turbo 120W (C to C):** O cabo específico para quem tem carregadores de alta performance Xiaomi.
- **Cabos HDMI 2.1 e Cat8:** Essenciais para gaming 4K/120Hz e internet estável de 40Gbps.

**🧠 GUIA DE CARREGADORES:**
- Temos kits Turbo económicos e os **Originais Xiaomi**. Explique que os originais ativam modos como "HyperCharge" 120W.

Responda sempre em Português de Portugal. Use emojis para ser amigável.

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
