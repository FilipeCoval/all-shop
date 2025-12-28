import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { PRODUCTS, STORE_NAME } from '../constants';
import { InventoryProduct, Product } from '../types';

let chatSession: Chat | null = null;

const getSystemInstruction = (): string => {
  const productsList = PRODUCTS.map(p => 
    `- **${p.name}** (€ ${p.price.toFixed(2)})${p.variants ? ' [Várias Opções/Variantes Disponíveis]' : ''}${p.comingSoon ? ' [PRODUTO EM BREVE - Brevemente no Stock]' : ''}\n  Categoria: ${p.category}\n  Descrição: ${p.description}\n  Specs: ${p.features.join(', ')}`
  ).join('\n\n');

  return `
Atue como o **Especialista de Tecnologia e Vendas** da loja **${STORE_NAME}**.
Sua missão é converter curiosos em clientes, explicando as diferenças técnicas de forma simples e profissional.

**🚀 GRANDES NOVIDADES A CHEGAR (EM BREVE):**
1. **Redmi Buds 6 Play:** A última palavra em áudio Xiaomi. Destaque o Bluetooth 5.4 e a redução de ruído por IA. Incrível autonomia de 36h por apenas 24.99€.
2. **Lenovo LivePods LP40:** Auriculares TWS ultra-leves e económicos para o dia-a-dia.
3. **Logitech G502 HERO:** O rato gaming lendário com sensor HERO 25K.
4. **Mouse Pad XL Sports Car:** Tapetes de 900x400mm com design premium.

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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  chatSession = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: getSystemInstruction(),
      temperature: 0.3,
      maxOutputTokens: 600,
      thinkingConfig: { thinkingBudget: 300 },
    },
  });
  return chatSession;
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  try {
    if (!chatSession) {
        await initializeChat();
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
