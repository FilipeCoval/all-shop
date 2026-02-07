
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionDeclaration, Type, Tool } from "@google/genai";
import { STORE_NAME } from '../constants';
import { InventoryProduct, Product, SupportTicket } from '../types';
import { db } from './firebaseConfig';

let chatSession: Chat | null = null;

// --- DEFINIÇÃO DA FERRAMENTA (TOOL) ---
const createTicketTool: FunctionDeclaration = {
    name: "createSupportTicket",
    description: "Cria um ticket de suporte oficial quando o cliente quer acionar a garantia, fazer uma devolução ou reportar um problema técnico grave.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            customerEmail: { type: Type.STRING, description: "O email do cliente (perguntar se não souber)." },
            customerName: { type: Type.STRING, description: "O nome do cliente." },
            subject: { type: Type.STRING, description: "Um título curto para o problema (ex: 'TV Box não liga')." },
            description: { type: Type.STRING, description: "Um resumo detalhado e técnico do problema relatado pelo cliente." },
            category: { type: Type.STRING, description: "Categoria do problema.", enum: ["Garantia", "Devolução", "Dúvida Técnica", "Outros"] },
            orderId: { type: Type.STRING, description: "O número da encomenda (opcional, mas tentar obter)." },
            priority: { type: Type.STRING, description: "Prioridade baseada na urgência ou gravidade.", enum: ["Baixa", "Média", "Alta"] },
        },
        required: ["subject", "description", "category", "priority"]
    }
};

const tools: Tool[] = [{ functionDeclarations: [createTicketTool] }];

const getSystemInstruction = (products: Product[]): string => {
  const productsList = products.map(p => 
    `- **${p.name}** (€ ${p.price.toFixed(2)})${p.variants ? ' [Várias Opções/Variantes Disponíveis]' : ''}${p.comingSoon ? ' [PRODUTO EM BREVE - Brevemente no Stock]' : ''}\n  Categoria: ${p.category}\n  Descrição: ${p.description}\n  Specs: ${p.features.join(', ')}`
  ).join('\n\n');

  return `
Atue como o **Especialista de Tecnologia e Suporte** da loja **${STORE_NAME}**.
Sua missão é dupla:
1. VENDER: Converter curiosos em clientes, explicando as diferenças técnicas.
2. SUPORTE: Ajudar clientes com problemas técnicos.

**REGRAS DE SUPORTE (Garantias/Devoluções):**
- Se o cliente reportar um defeito ou quiser devolver, **NÃO mande enviar email**.
- Faça uma triagem técnica primeiro (ex: "Já tentou reiniciar?", "A luz acende?").
- Se o problema persistir, diga que vai abrir um processo de suporte técnico interno.
- Peça os detalhes necessários (Nome, Email, ID da Encomenda se tiverem, descrição do erro).
- **USE A FERRAMENTA 'createSupportTicket'** para registar o pedido no sistema.
- Após criar o ticket, informe o cliente que a equipa técnica vai analisar e entrar em contacto brevemente.

Responda sempre em Português de Portugal. Use emojis para ser amigável.

**📦 CATÁLOGO ATUALIZADO (Use apenas estes dados):**
${productsList}
`;
}

// Função real que guarda no Firebase
async function executeCreateTicket(args: any): Promise<string> {
    try {
        const newTicket: SupportTicket = {
            id: `TICKET-${Date.now().toString().slice(-6)}`,
            customerEmail: args.customerEmail || 'Não fornecido',
            customerName: args.customerName || 'Cliente Chat',
            subject: args.subject,
            description: args.description,
            category: args.category,
            status: 'Aberto',
            priority: args.priority,
            createdAt: new Date().toISOString(),
            orderId: args.orderId,
            aiSummary: "Gerado automaticamente pelo Assistente IA."
        };

        await db.collection('support_tickets').doc(newTicket.id).set(newTicket);
        return `Ticket criado com sucesso! ID: ${newTicket.id}. Informe o cliente.`;
    } catch (error) {
        console.error("Erro ao criar ticket via Tool:", error);
        return "Erro interno ao criar ticket. Peça ao cliente para tentar mais tarde.";
    }
}

// Inicia sessão com os produtos atuais
export const initializeChat = async (products: Product[]): Promise<Chat> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash', // Modelo mais rápido e capaz de tool use
    config: {
      systemInstruction: getSystemInstruction(products),
      temperature: 0.3,
      tools: tools
    },
  });
  return chatSession;
};

// Recebe os produtos para garantir que a IA sabe do que está a falar
export const sendMessageToGemini = async (message: string, currentProducts: Product[]): Promise<string> => {
  try {
    if (!chatSession) {
        await initializeChat(currentProducts);
    }
    
    if (!chatSession) return "A ligar sistemas...";
    
    let response = await chatSession.sendMessage({ message });
    
    // LOOP para lidar com chamadas de função (Tools)
    // O modelo pode chamar a função, nós executamos, e devolvemos o resultado
    // para ele gerar a resposta final ao utilizador.
    while (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === 'createSupportTicket') {
            const toolResult = await executeCreateTicket(call.args);
            
            // Enviar o resultado da função de volta para o modelo
            response = await chatSession.sendToolResponse({
                functionResponses: [
                    {
                        id: call.id,
                        name: call.name,
                        response: { result: toolResult }
                    }
                ]
            });
        }
    }

    return response.text || "Pode repetir?";
  } catch (error) {
    console.error(error);
    // Tenta recuperar sessão
    chatSession = null;
    return "Tive um pequeno lapso. Pode repetir a pergunta?";
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
        // O anterior 'flash-image' pode estar restrito a geração de imagem.
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
                        text: "Look at this product label. Locate the Serial Number (S/N), SN, IMEI, or the main alphanumeric barcode string. Return ONLY the code itself (letters and numbers). Do not include prefixes like 'S/N:', 'SN', or explanations. If multiple codes exist, prefer the one labeled S/N. If nothing is found, return 'NOT_FOUND'."
                    }
                ]
            }
        });

        const text = response.text?.trim();
        if (!text || text.includes('NOT_FOUND')) return null;
        
        // Limpeza extra para garantir que só vem o código
        return text.replace(/[^a-zA-Z0-9\-\/]/g, '');
    } catch (error) {
        console.error("Gemini OCR Error:", error);
        // Lança o erro para que o Dashboard o possa mostrar no alert
        throw error;
    }
};
