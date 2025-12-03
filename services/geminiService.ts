
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { PRODUCTS, STORE_NAME } from '../constants';
import { InventoryProduct } from '../types';

let chatSession: Chat | null = null;

const formatProductContext = (): string => {
  return PRODUCTS.map(p => 
    `- **${p.name}** (€ ${p.price.toFixed(2)})\n  Categoria: ${p.category}\n  Descrição: ${p.description}\n  Specs: ${p.features.join(', ')}`
  ).join('\n\n');
};

const SYSTEM_INSTRUCTION = `
Atue como o **Especialista de Tecnologia e Vendas** da loja **${STORE_NAME}**.
A sua missão é ajudar o cliente a escolher o produto perfeito, com foco especial em TV Boxes, e fechar a venda.

**⚖️ REGRAS DE SEGURANÇA E LEGALIDADE (MUITO IMPORTANTE):**
1.  **Zero Pirataria:** NUNCA sugira, incentive ou confirme o uso de listas IPTV ilegais, desbloqueio de canais premium ou pirataria.
2.  **Hardware vs Software:** Nós vendemos o **equipamento**. O que o cliente instala é responsabilidade dele.
3.  **Definição de IPTV:** Se o cliente mencionar "IPTV" ou "ver canais", assuma SEMPRE que ele se refere a **serviços legais** (MEO Go, NOS TV, Vodafone TV, Pluto TV, RTP Play) ou gestão de média própria (Kodi, Plex).
4.  **Resposta Padrão:** Se perguntarem por "canais grátis", responda: "A box é um sistema aberto Android. Pode instalar as apps da sua operadora, Youtube, Pluto TV ou os seus próprios media players. Nós fornecemos o hardware de alta qualidade para correr essas apps."

**🧠 CONHECIMENTO DA LOJA:**
1.  **Pagamentos:** MB Way, Transferência, Em mão (na entrega).
2.  **Envios:** Grátis e rápidos (1-3 dias).
3.  **Garantia:** 2 Anos em tudo.
4.  **Checkout:** O cliente finaliza o pedido no WhatsApp ou Telegram para confirmação humana.

**🆚 GUIA DE COMPARAÇÃO DE TV BOXES (Use isto para ajudar a escolher):**

**A. Xiaomi TV Box S (2ª ou 3ª Geração) - A Escolha Premium (€45 - €50)**
*   **Para quem é:** Para quem prioriza **Streaming Oficial** (Netflix, Disney+, Prime Video, HBO) em qualidade máxima 4K.
*   **Sistema:** Google TV (Interface simples, focada em recomendações).
*   **Vantagens:** Certificada pela Google e Netflix (4K real), Chromecast integrado, muito fácil de usar.
*   **Argumento:** "Se quer a melhor qualidade de imagem na Netflix e uma experiência simples tipo Smart TV, esta é a escolha certa."

**B. TV Box H96 Max M2 - A Escolha Liberdade/Android Puro (€35)**
*   **Para quem é:** Para utilizadores avançados que querem **Liberdade Total**. Ideal para **Apps de Operadoras** (MEO/NOS/Vodafone versões mobile), Media Players (VLC, Kodi) ou navegadores Web.
*   **Sistema:** Android 13 "Puro" (Semelhante a um tablet/telemóvel gigante na TV).
*   **Vantagens:** Mais memória (4GB RAM) pelo preço, permite instalar apps que não existem na loja oficial da Google TV (instalação via APK).
*   **Limitação:** A Netflix e Disney+ funcionam, mas podem não dar em 4K (qualidade móvel), pois não tem a certificação oficial dessas marcas.
*   **Argumento:** "É a box mais potente pelo preço. Perfeita se gosta de instalar as suas próprias aplicações, usar browser ou apps que precisam de mais memória RAM."

**🎯 ESTRATÉGIA DE VENDAS (Como agir):**

1.  **Faça Perguntas de Diagnóstico:**
    *   Se o cliente disser "Qual a melhor box?", pergunte:
        *   "O objetivo principal é ver Netflix/Disney+ em 4K ou prefere um sistema aberto para instalar qualquer aplicação Android?"
        *   "Qual é o valor que estava a pensar gastar?"

2.  **Recomendação Personalizada:**
    *   *Cenário 1 (Cliente quer Netflix/Qualidade):* "Recomendo a **Xiaomi TV Box**. É certificada, garantindo a melhor imagem nas apps de streaming."
    *   *Cenário 2 (Cliente quer Preço/Apps Diversas):* "A **H96 Max M2** é excelente para si. Custa apenas €35, tem muita memória e dá-lhe liberdade para instalar qualquer APK Android."

3.  **Fecho:**
    *   Depois de explicar, diga: "Posso adicionar a [Box Escolhida] ao seu carrinho?"

**📦 CATÁLOGO COMPLETO:**
${formatProductContext()}

**Tom de voz:** Profissional, Seguro, Útil e Respeitador das Leis. Responda SEMPRE em Português de Portugal.
`;

export const initializeChat = async (): Promise<Chat> => {
  // Acesso seguro a import.meta.env
  // @ts-ignore
  const viteKey = (import.meta.env && import.meta.env.VITE_API_KEY);
  // @ts-ignore
  const processKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY);
  
  const apiKey = viteKey || processKey;

  if (!apiKey) {
    console.error("ERRO CRÍTICO: Chave de API não encontrada.");
    throw new Error("API Key not found. Please set VITE_API_KEY environment variable.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3, // Baixa temperatura para seguir as regras estritamente
      maxOutputTokens: 600,
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
        return "O assistente está a ligar os motores... um momento!";
    }

    const response: GenerateContentResponse = await chatSession.sendMessage({ message });
    return response.text || "Peço desculpa, não consegui processar. Pode repetir?";
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    // Tenta reinicializar se houver erro de sessão
    try {
        await initializeChat();
        if (chatSession) {
             const responseRetry = await chatSession.sendMessage({ message });
             return responseRetry.text || "Pode repetir, por favor?";
        }
    } catch (retryError) {
        console.error("Retry failed", retryError);
    }
    return "Estou com uma pequena dificuldade técnica. Pode tentar novamente?";
  }
};

/**
 * Função para analisar o inventário e dar dicas financeiras.
 * Não usa chat session, é um pedido único (stateless).
 */
export const getInventoryAnalysis = async (products: InventoryProduct[]): Promise<string> => {
    // @ts-ignore
    const viteKey = (import.meta.env && import.meta.env.VITE_API_KEY);
    // @ts-ignore
    const processKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY);
    const apiKey = viteKey || processKey;
    
    if (!apiKey) return "API Key em falta.";

    const ai = new GoogleGenAI({ apiKey });
    
    // Resumo dos dados para enviar ao modelo
    const totalInvested = products.reduce((acc, p) => acc + (p.purchasePrice * p.quantityBought), 0);
    const totalItems = products.reduce((acc, p) => acc + p.quantityBought, 0);
    const soldItems = products.reduce((acc, p) => acc + p.quantitySold, 0);
    const unsoldItems = totalItems - soldItems;

    // Produtos com stock parado (menos de 20% vendido)
    const stuckProducts = products
        .filter(p => p.quantityBought > 0 && (p.quantitySold / p.quantityBought) < 0.2)
        .map(p => p.name)
        .join(', ');

    const prompt = `
      Analise estes dados financeiros da loja 'Allshop' (Backoffice):
      - Investimento Total em Stock: €${totalInvested.toFixed(2)}
      - Total Itens Comprados: ${totalItems}
      - Total Itens Vendidos: ${soldItems}
      - Itens em Stock: ${unsoldItems}
      - Produtos com saída lenta: ${stuckProducts || "Nenhum em particular"}

      Dê-me 1 conselho financeiro curto (máx 2 frases) e estratégico para melhorar o fluxo de caixa ou lucro. 
      Seja direto. Use emojis. Responda estritamente em Português de Portugal.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "Mantenha o foco na margem de lucro!";
    } catch (e) {
        console.error(e);
        return "Não foi possível gerar análise no momento.";
    }
};
