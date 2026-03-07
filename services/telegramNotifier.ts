
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, STORE_NAME } from '../constants';
import { Order, OrderItem } from '../types';

export const notifyNewOrder = async (order: Order, customerName: string, targetChatId: string = TELEGRAM_CHAT_ID) => {
    if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
        console.warn("Telegram Token ou Chat ID não configurados.");
        return;
    }

    const totalFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total);
    const dateFormatted = new Date(order.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeFormatted = new Date(order.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    // SOLUÇÃO DEFINITIVA: Processamento seguro da lista de itens.
    // Isto garante que a notificação funciona para encomendas novas (com objetos)
    // e antigas (com strings), eliminando o erro '[object Object]'.
    const itemsList = Array.isArray(order.items) ? order.items.map(item => {
        // Caso #1: Item é uma string simples (formato antigo)
        if (typeof item === 'string') {
            return `▫️ ${item}`;
        }
        // Caso #2: Item é um objeto (formato novo)
        if (typeof item === 'object' && item !== null && 'name' in item && 'quantity' in item) {
            const orderItem = item as OrderItem;
            const variantText = orderItem.selectedVariant ? ` (${orderItem.selectedVariant})` : '';
            return `▫️ ${orderItem.quantity}x ${orderItem.name}${variantText}`;
        }
        // Fallback para qualquer formato inesperado
        return '▫️ (Item inválido)';
    }).join('\n') : '▫️ (Lista de itens indisponível)';


    // Layout Estilo Fatura
    const shipping = order.shippingInfo;
    const addressLine = `${shipping.street}, ${shipping.doorNumber}${shipping.addressExtra ? ` (${shipping.addressExtra})` : ''}`;
    const zipCity = `${shipping.zip} ${shipping.city}`;

    const message = `
⚡️ *NOVA VENDA CONFIRMADA* ⚡️

👤 *Cliente:* ${customerName}
📞 *Tel:* ${shipping.phone}
🆔 *Ref:* ${order.id}

🏠 *Dados de Entrega:*
${addressLine}
${zipCity}

🚚 *Método:* ${shipping.deliveryMethod === 'Pickup' ? 'Levantamento em Loja' : 'Envio'}
💳 *Pagamento:* ${shipping.paymentMethod}

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
            console.error("Erro Telegram (Raw):", data);
            
            // Tratamento de erros específicos para ajudar o utilizador
            if (data.description.includes("chat not found") || data.error_code === 400) {
                throw new Error("O BOT NÃO ESTÁ NO GRUPO!\n\nPor favor, vá ao seu grupo do Telegram, clique em 'Adicionar Membro' e adicione o seu Bot.");
            } else if (data.error_code === 401) {
                throw new Error("TOKEN INVÁLIDO.\n\nO token do bot em constants.ts está errado.");
            } else {
                throw new Error(data.description);
            }
        } else {
            console.log("Notificação Telegram enviada com sucesso.");
            return true;
        }
    } catch (error) {
        console.error("Falha ao enviar notificação Telegram:", error);
        throw error;
    }
};


