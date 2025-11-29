
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, STORE_NAME } from '../constants';
import { Order } from '../types';

export const notifyNewOrder = async (order: Order, customerName: string) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn("Telegram Token ou Chat ID não configurados.");
        return;
    }

    const totalFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total);
    const dateFormatted = new Date(order.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    const message = `
🚨 *NOVA VENDA NO SITE!* 🚨

🛒 *Loja:* ${STORE_NAME}
💰 *Valor:* ${totalFormatted}
👤 *Cliente:* ${customerName}
📦 *Produtos:*
${order.items.map(i => `• ${i}`).join('\n')}

📅 ${dateFormatted}
🔗 _Aceda ao Dashboard para mais detalhes._
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

export const sendTestMessage = async () => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

    const message = `🔔 *Teste de Notificação* 🔔\n\nO sistema de alertas da ${STORE_NAME} está a funcionar corretamente!`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            }),
        });
        alert("Mensagem de teste enviada! Verifique o seu Telegram.");
    } catch (error) {
        alert("Erro ao enviar teste. Verifique a consola.");
        console.error(error);
    }
};
