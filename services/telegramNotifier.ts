

import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, STORE_NAME } from '../constants';
import { Order } from '../types';

export const notifyNewOrder = async (order: Order, customerName: string) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
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
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            }),
        });

        const data = await response.json();
        if (!data.ok) {
            console.error("Erro Telegram:", data);
        } else {
            console.log("Notificação Telegram enviada com sucesso.");
        }
    } catch (error) {
        console.error("Falha ao enviar notificação Telegram:", error);
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

    const message = `🔔 *Teste de Notificação* 🔔\n\nO sistema de alertas da ${STORE_NAME} está a funcionar corretamente!\nEnviado para ID: \`${targetChatId}\``;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: targetChatId,
                text: message,
                parse_mode: 'Markdown'
            }),
        });

        const data = await response.json();
        
        if (!data.ok) {
            // MOSTRA O ERRO EXATO DO TELEGRAM
            alert(`❌ ERRO TELEGRAM:\n${data.description}\n\nCódigo: ${data.error_code}`);
            console.error("Telegram Error Payload:", data);
        } else {
            alert("✅ SUCESSO! Mensagem enviada. Verifique o seu Telegram.");
        }
    } catch (error: any) {
        alert("Erro de conexão: " + error.message);
        console.error(error);
    }
};
