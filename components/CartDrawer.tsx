import React, { useState } from 'react';
import { CartItem, UserCheckoutInfo, Order } from '../types';
import { X, Trash2, Smartphone, Send, MessageCircle, Copy, Check } from 'lucide-react';
import { SELLER_PHONE, TELEGRAM_LINK, STORE_NAME } from '../constants';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (id: number) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  total: number;
  onCheckout: (order: Order) => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ 
  isOpen, onClose, cartItems, onRemoveItem, onUpdateQuantity, total, onCheckout
}) => {
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'info' | 'platform'>('cart');
  const [platform, setPlatform] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [isCopied, setIsCopied] = useState(false);
  const [userInfo, setUserInfo] = useState<UserCheckoutInfo>({
    name: '',
    address: '',
    paymentMethod: 'MB Way'
  });

  const handleCheckoutStart = () => {
    if (cartItems.length === 0) return;
    setCheckoutStep('info');
  };

  const handleInfoSubmit = () => {
      setCheckoutStep('platform');
  };

  const generateOrderMessage = () => {
    const itemsList = cartItems.map(item => 
        `- ${item.quantity}x ${item.name} (${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.price)})`
      ).join('\n');
  
      const totalFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(total);
  
      return `*Novo Pedido - ${STORE_NAME}*\n` +
        `--------------------------------\n` +
        `*Cliente:* ${userInfo.name}\n` +
        `*Endereço:* ${userInfo.address}\n` +
        `*Pagamento:* ${userInfo.paymentMethod}\n` +
        `--------------------------------\n` +
        `*Itens:*\n${itemsList}\n\n` +
        `*Total:* ${totalFormatted}\n` +
        `--------------------------------\n` +
        `Aguardo confirmação.`;
  };

  const finalizeOrder = () => {
    // 1. Create Order Object
    const newOrder: Order = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        total: total,
        status: 'Processamento',
        items: cartItems.map(i => `${i.quantity}x ${i.name}`)
    };

    // 2. Save to history
    onCheckout(newOrder);

    // 3. Open Platform
    if (platform === 'whatsapp') {
        const message = generateOrderMessage();
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${SELLER_PHONE}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
    } else {
        // Telegram logic - Abre o link do grupo/canal
        window.open(TELEGRAM_LINK, '_blank');
    }

    // 4. Close and Reset
    onClose();
    setTimeout(() => {
        setCheckoutStep('cart');
        setUserInfo({ name: '', address: '', paymentMethod: 'MB Way' });
    }, 500);
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(generateOrderMessage());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="absolute inset-y-0 right-0 max-w-md w-full flex">
        <div className="w-full h-full flex flex-col bg-white shadow-2xl animate-slide-in-right">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">
              {checkoutStep === 'cart' ? 'O Seu Carrinho' : 'Finalizar Pedido'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                <Smartphone size={48} className="text-gray-300" />
                <p>O seu carrinho está vazio.</p>
                <button onClick={onClose} className="text-primary font-medium hover:underline">
                  Continuar a comprar
                </button>
              </div>
            ) : (
              <>
                {checkoutStep === 'cart' && (
                  <div className="space-y-4 animate-fade-in">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex gap-4 border-b border-gray-100 pb-4 last:border-0">
                        <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-md bg-gray-100" />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 line-clamp-1">{item.name}</h4>
                          <p className="text-primary font-bold text-sm">
                            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.price)}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center border rounded-md">
                              <button 
                                onClick={() => onUpdateQuantity(item.id, -1)}
                                className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                              >-</button>
                              <span className="px-2 text-sm font-medium">{item.quantity}</span>
                              <button 
                                onClick={() => onUpdateQuantity(item.id, 1)}
                                className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                              >+</button>
                            </div>
                            <button 
                              onClick={() => onRemoveItem(item.id)}
                              className="text-red-500 p-1 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {checkoutStep === 'info' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Informações de Envio</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                      <input 
                        type="text" 
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-gray-50 focus:bg-white transition-colors"
                        value={userInfo.name}
                        onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
                        placeholder="Ex: João da Silva"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Morada de Entrega</label>
                      <textarea 
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-gray-50 focus:bg-white transition-colors"
                        rows={3}
                        value={userInfo.address}
                        onChange={(e) => setUserInfo({...userInfo, address: e.target.value})}
                        placeholder="Rua, Número, Andar, Cidade..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento Preferido</label>
                      <select 
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-gray-50 focus:bg-white transition-colors"
                        value={userInfo.paymentMethod}
                        onChange={(e) => setUserInfo({...userInfo, paymentMethod: e.target.value})}
                      >
                        <option value="MB Way">MB Way</option>
                        <option value="Transferência">Transferência Bancária</option>
                        <option value="Dinheiro">Dinheiro na Entrega (Em mão)</option>
                      </select>
                    </div>
                  </div>
                )}

                {checkoutStep === 'platform' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Quase lá!</h3>
                            <p className="text-sm text-gray-600">Escolha onde quer finalizar a sua encomenda.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setPlatform('whatsapp')}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${platform === 'whatsapp' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="bg-green-100 p-2 rounded-full">
                                    <Smartphone className="text-green-600" size={24} />
                                </div>
                                <span className="font-bold text-sm">WhatsApp</span>
                            </button>
                            <button 
                                onClick={() => setPlatform('telegram')}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${platform === 'telegram' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="bg-blue-100 p-2 rounded-full">
                                    <MessageCircle className="text-blue-600" size={24} />
                                </div>
                                <span className="font-bold text-sm">Telegram</span>
                            </button>
                        </div>

                        {platform === 'telegram' && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm">
                                <p className="mb-2 text-blue-800 font-medium">Finalizar no Grupo/Canal:</p>
                                <ol className="list-decimal pl-4 space-y-1 text-blue-700 mb-4">
                                    <li>Copie o resumo do pedido.</li>
                                    <li>Clique em "Abrir Telegram" (irá abrir o seu grupo).</li>
                                    <li>Cole a mensagem lá.</li>
                                </ol>
                                <button 
                                    onClick={copyToClipboard}
                                    className="w-full bg-white border border-blue-200 text-blue-600 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors font-bold shadow-sm"
                                >
                                    {isCopied ? <Check size={18} /> : <Copy size={18} />}
                                    {isCopied ? 'Copiado!' : '1. Copiar Pedido'}
                                </button>
                            </div>
                        )}
                        
                        {platform === 'whatsapp' && (
                             <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-sm text-green-800">
                                O WhatsApp abrirá automaticamente com todos os detalhes do pedido preenchidos.
                             </div>
                        )}
                    </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {cartItems.length > 0 && (
            <div className="border-t p-4 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">Total</span>
                <span className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(total)}
                </span>
              </div>
              
              {checkoutStep === 'cart' && (
                <button 
                  onClick={handleCheckoutStart}
                  className="w-full bg-secondary text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors shadow-lg"
                >
                  Continuar
                </button>
              )}

              {checkoutStep === 'info' && (
                 <div className="flex gap-2">
                    <button 
                        onClick={() => setCheckoutStep('cart')}
                        className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={handleInfoSubmit}
                        disabled={!userInfo.name || !userInfo.address}
                        className="flex-[2] bg-primary text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Próximo
                    </button>
                 </div>
              )}

              {checkoutStep === 'platform' && (
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setCheckoutStep('info')}
                        className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                      >
                        Voltar
                      </button>
                      <button 
                        onClick={finalizeOrder}
                        className={`flex-[2] text-white py-3 rounded-lg font-bold transition-colors shadow-lg flex items-center justify-center gap-2
                             ${platform === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-600'}
                        `}
                      >
                        <Send size={18} />
                        {platform === 'whatsapp' ? 'Enviar Pedido' : '2. Abrir Telegram'}
                      </button>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;