import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { PRODUCTS, STORE_NAME } from '../constants';

let chatSession: Chat | null = null;

const formatProductContext = (): string => {
  return PRODUCTS.map(p => 
    `- ${p.name} (€ ${p.price.toFixed(2)}): ${p.description} [Características: ${p.features.join(', ')}]`
  ).join('\n');
};

const SYSTEM_INSTRUCTION = `
Você é o assistente virtual inteligente da loja ${STORE_NAME}.
Seu objetivo é ajudar os clientes a escolherem os melhores produtos eletrônicos, tirar dúvidas técnicas e sugerir itens baseados em suas necessidades.

Abaixo está a lista de produtos disponíveis na loja:
${formatProductContext()}

Regras:
1. Seja sempre educado, prestativo e conciso.
2. Responda em Português.
3. Os preços estão em Euros (€). Se o usuário perguntar o preço, informe o valor exato da lista.
4. Se o usuário procurar algo que não está na lista, peça desculpas e sugira o item mais próximo disponível.
5. Tente fechar a venda destacando os benefícios.
6. Não invente produtos que não existem na lista acima.
`;

export const initializeChat = async (): Promise<Chat> => {
  // IMPORTANTE: No Vercel, a variável de ambiente DEVE chamar-se VITE_API_KEY
  const apiKey = import.meta.env.VITE_API_KEY;

  if (!apiKey) {
    console.warn("VITE_API_KEY não encontrada. O chat não funcionará.");
    console.error("Configure a variável VITE_API_KEY nas definições do Vercel.");
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  });

  return chatSession;
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  try {
    if (!chatSession) {
      await initializeChat();
    }
    
    if (!chatSession) {
        return "Desculpe, o sistema de chat está a iniciar. Tente novamente em alguns segundos.";
    }

    const response: GenerateContentResponse = await chatSession.sendMessage({ message });
    return response.text || "Desculpe, não consegui entender.";
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    return "Ocorreu um erro técnico. Verifique se a Chave API está configurada corretamente no Vercel (VITE_API_KEY).";
  }
};
