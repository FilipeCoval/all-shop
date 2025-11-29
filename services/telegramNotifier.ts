

import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, STORE_NAME } from '../constants';
import { Order } from '../types';

export const notifyNewOrder = async (order: Order, customerName: string, targetChatId: string = TELEGRAM_CHAT_ID) => {
    if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
        console.warn("Telegram Token ou Chat ID não configurados.");
        return;
    }

    const totalFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total);
    const dateFormatted = new Date(order.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeFormatted = new Date(order.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    // Ícones para cada item
    const itemsList = order.items.map(i => `▫️ ${i}`).join('\n');

    // Layout Estilo Fatura
    const message = `
⚡️ *NOVA VENDA CONFIRMADA* ⚡️

👤 *Cliente:* ${customerName}
🆔 *Ref:* ${order.id}

🛒 *Itens:*
${itemsList}

💰 *TOTAL: ${totalFormatted}*
📅 _${dateFormatted} às ${timeFormatted}_
`;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: targetChatId,
                text: message,
                parse_mode: 'Markdown'
            }),
        });

        const data = await response.json();
        if (!data.ok) {
            console.error("Erro Telegram:", data);
            throw new Error(data.description);
        } else {
            console.log("Notificação Telegram enviada com sucesso.");
            return true;
        }
    } catch (error) {
        console.error("Falha ao enviar notificação Telegram:", error);
        throw error;
    }
};

// Função de Teste Melhorada
// Aceita um ID opcional para testar sem mudar o código
export const sendTestMessage = async (customId?: string) => {
    if (!TELEGRAM_BOT_TOKEN) {
        alert("Erro: Token do Bot não configurado em constants.ts");
        return;
    }

    // Usa o ID passado manualmente OU o que está no ficheiro
    const targetChatId = customId || TELEGRAM_CHAT_ID;

    if (!targetChatId) {
        alert("Erro: ID de Chat em falta.");
        return;
    }

    // CRIA UMA ENCOMENDA FICTÍCIA PARA O TESTE
    const fakeOrder: Order = {
        id: `TESTE-${Math.floor(Math.random() * 9999)}`,
        date: new Date().toISOString(),
        total: 59.99,
        status: 'Processamento',
        items: ['1x Xiaomi TV Box S', '1x Cabo HDMI 2.1'],
        userId: 'teste-user'
    };

    try {
        await notifyNewOrder(fakeOrder, "Cliente Teste", targetChatId);
        alert("✅ SUCESSO! Simulação de venda enviada. Verifique o seu Telegram para ver como ficou.");
    } catch (error: any) {
        alert(`❌ ERRO TELEGRAM:\n${error.message || 'Verifique a consola'}`);
    }
};
