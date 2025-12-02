import React, { useState, useEffect } from 'react';
import { CartItem, UserCheckoutInfo, Order } from '../types';
import { X, Trash2, Smartphone, Send, MessageCircle, Copy, Check, TicketPercent } from 'lucide-react';
import { SELLER_PHONE, TELEGRAM_LINK } from '../constants';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (cartItemId: string) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  total: number;
  onCheckout: (order: Order) => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ 
  isOpen, onClose, cartItems, onRemoveItem, onUpdateQuantity, total, onCheckout
}) => {
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'info' | 'platform'>('cart');
  const [platform, setPlatform] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [isCopied, setIsCopied] = useState(false);
  
  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState('');
  
  // Estado para guardar o ID gerado para esta sessão de checkout
  const [currentOrderId, setCurrentOrderId] = useState<string>('');

  const [userInfo, setUserInfo] = useState<UserCheckoutInfo>({
    name: '',
    address: '',
    paymentMethod: 'MB Way'
  });

  // Limpa o ID se o carrinho fechar ou esvaziar
  useEffect(() => {
    if (!isOpen) {
        // Pequeno delay para não limpar enquanto a animação de fecho ocorre
        const timer = setTimeout(() => {
            setCheckoutStep('cart');
            // Não limpamos o form (userInfo) para conveniência, mas limpamos o ID
            setCurrentOrderId('');
            // Reset Coupon
            setDiscount(0);
            setAppliedCoupon('');
            setCouponCode('');
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Recalcular desconto se o total mudar (ex: removeu items)
  useEffect(() => {
      if (appliedCoupon === 'BEMVINDO10') {
          setDiscount(total * 0.10);
      }
      // Se o total ficar 0, limpa tudo
      if (total === 0) {
          setDiscount(0);
          setAppliedCoupon('');
      }
  }, [total, appliedCoupon]);

  const handleApplyCoupon = () => {
      const code = couponCode.trim().toUpperCase();
      if (!code) return;

      if (code === 'BEMVINDO10') {
          setDiscount(total * 0.10);
          setAppliedCoupon('BEMVINDO10');
          setCouponCode('');
      } else if (code === 'POUPAR5') {
          if (total < 10) {
              alert("Este cupão requer uma compra mínima de 10€");
              return;
          }
          setDiscount(5);
          setAppliedCoupon('POUPAR5');
          setCouponCode('');
      } else {
          alert('Cupão inválido ou expirado.');
      }
  };

  const removeCoupon = () => {
      setDiscount(0);
      setAppliedCoupon('');
  };

  const finalTotal = Math.max(0, total - discount);

  const generateOrderId = () => {
    // Gera um ID curto e amigável: #AS-XXXXXX
    // Ex: #AS-849201
    return `#AS-${Math.floor(100000 + Math.random() * 900000)}`;
  };

  const handleCheckoutStart = () => {
    if (cartItems.length === 0) return;
    setCheckoutStep('info');
  };

  const handleInfoSubmit = () => {
      // Gera o ID agora e guarda no estado para garantir consistência
      if (!currentOrderId) {
          const newId = generateOrderId();
          setCurrentOrderId(newId);
      }
      setCheckoutStep('platform');
  };

  // Recebe o ID explicitamente para evitar erros de estado assíncrono
  const generateOrderMessage = (orderId: string) => {
    const itemsList = cartItems.map(item => {
        const variantText = item.selectedVariant ? ` [${item.selectedVariant}]` : '';
        return `- ${item.quantity}x ${item.name}${variantText} (${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.price)})`;
    }).join('\n');
  
      const totalFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(total);
      const discountFormatted = discount > 0 ? `\nDesconto (${appliedCoupon}): -${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(discount)}` : '';
      const finalFormatted = discount > 0 ? `\n\n*TOTAL FINAL: ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(finalTotal)}*` : `\n\n*TOTAL: ${totalFormatted}*`;

      return `Olá! Quero finalizar a minha encomenda na Allshop.\n\n*Pedido:* ${orderId}\n\n*Cliente:* ${userInfo.name}\n*Morada:* ${userInfo.address}\n*Pagamento:* ${userInfo.paymentMethod}\n\n*Itens:*\n${itemsList}\n${discountFormatted}${finalFormatted}`;
  };

  const handleFinalize = () => {
    // Usa o ID do estado ou gera um novo se falhar
    const orderIdToUse = currentOrderId || generateOrderId();

    const message = generateOrderMessage(orderIdToUse);
    const encodedMessage = encodeURIComponent(message);
    
    // Create Order Object
    const newOrder: Order = {
      id: orderIdToUse,
      date: new Date().toISOString(),
      total: finalTotal, // Usa o total com desconto
      status: 'Processamento',
      items: cartItems.map(i => {
          const variantSuffix = i.selectedVariant ? ` (${i.selectedVariant})` : '';
          return `${i.quantity}x ${i.name}${variantSuffix}`;
      }),
      shippingInfo: {
        name: userInfo.name,
        address: userInfo.address,
        paymentMethod: userInfo.paymentMethod,
        phone: userInfo.phone
      }
    };

    onCheckout(newOrder);

    // Open Platform
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/${SELLER_PHONE}?text=${encodedMessage}`, '_blank');
    } else {
      // Copy to clipboard for Telegram or open direct link if configured
      navigator.clipboard.writeText(message);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      window.open(TELEGRAM_LINK, '_blank');
    }

    onClose();
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity z-50 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Seu Carrinho</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {checkoutStep === 'cart' ? (
            cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <Smartphone size={48} className="opacity-20" />
                <p>O seu carrinho está vazio.</p>
                <button onClick={onClose} className="text-primary font-bold hover:underline">
                    Começar a comprar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.cartItemId} className="flex gap-4 p-3 bg-white border border-gray-100 rounded-xl shadow-sm animate-fade-in">
                    <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg bg-gray-100" />
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-800 text-sm line-clamp-2">{item.name}</h3>
                        {item.selectedVariant && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 inline-block">
                                {item.selectedVariant}
                            </span>
                        )}
                        <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-primary">
                                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.price)}
                            </span>
                            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-2">
                                <button 
                                    onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                                    className="text-gray-500 hover:text-red-500 px-1 font-bold text-lg disabled:opacity-30"
                                    disabled={item.quantity <= 1}
                                >-</button>
                                <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                                <button 
                                    onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                                    className="text-gray-500 hover:text-green-500 px-1 font-bold text-lg"
                                >+</button>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => onRemoveItem(item.cartItemId)}
                        className="text-gray-300 hover:text-red-500 self-start p-1"
                    >
                        <Trash2 size={18} />
                    </button>
                  </div>
                ))}

                {/* --- COUPON SECTION --- */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                        <TicketPercent size={14} /> Código Promocional
                    </label>
                    
                    {appliedCoupon ? (
                        <div className="flex justify-between items-center bg-green-50 border border-green-200 p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Check size={16} className="text-green-600" />
                                <div>
                                    <p className="text-sm font-bold text-green-700">Cupão {appliedCoupon}</p>
                                    <p className="text-xs text-green-600">Desconto aplicado com sucesso!</p>
                                </div>
                            </div>
                            <button onClick={removeCoupon} className="text-gray-400 hover:text-red-500">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                placeholder="BEMVINDO10"
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none uppercase"
                            />
                            <button 
                                onClick={handleApplyCoupon}
                                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors"
                            >
                                Aplicar
                            </button>
                        </div>
                    )}
                </div>

              </div>
            )
          ) : checkoutStep === 'info' ? (
            <div className="space-y-6 animate-fade-in-right">
                <div className="text-center mb-6">
                    <h3 className="font-bold text-xl">Dados de Envio</h3>
                    <p className="text-sm text-gray-500">Para onde devemos enviar a sua encomenda?</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input 
                            type="text" 
                            required 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Ex: João Silva"
                            value={userInfo.name}
                            onChange={e => setUserInfo({...userInfo, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Morada Completa</label>
                        <textarea 
                            required 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none h-24 resize-none"
                            placeholder="Rua, Nº, Andar, Código Postal, Cidade"
                            value={userInfo.address}
                            onChange={e => setUserInfo({...userInfo, address: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Telemóvel (Opcional)</label>
                        <input 
                            type="tel" 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Para contacto da transportadora"
                            value={userInfo.phone}
                            onChange={e => setUserInfo({...userInfo, phone: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['MB Way', 'Transferência', 'Cobrança (+2€)'].map(method => (
                                <button
                                    key={method}
                                    className={`py-3 px-2 rounded-lg text-sm font-medium border transition-all ${userInfo.paymentMethod === method ? 'bg-blue-50 border-primary text-primary' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                    onClick={() => setUserInfo({...userInfo, paymentMethod: method})}
                                >
                                    {method}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in-right text-center pt-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 mb-4 animate-bounce-slow">
                    <Check size={40} />
                </div>
                <h3 className="font-bold text-2xl text-gray-900">Quase lá!</h3>
                <p className="text-gray-600">
                    Escolha onde quer finalizar o pedido. <br/>
                    Vamos abrir a conversa com os detalhes já preenchidos.
                </p>

                <div className="grid grid-cols-1 gap-4 mt-8">
                    <button 
                        onClick={() => setPlatform('whatsapp')}
                        className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${platform === 'whatsapp' ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                        <div className="bg-green-500 text-white p-3 rounded-full">
                            <Smartphone size={24} />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-gray-900">WhatsApp</h4>
                            <p className="text-xs text-gray-500">Resposta imediata</p>
                        </div>
                        {platform === 'whatsapp' && <div className="ml-auto w-4 h-4 bg-green-500 rounded-full"></div>}
                    </button>

                    <button 
                        onClick={() => setPlatform('telegram')}
                        className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${platform === 'telegram' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                        <div className="bg-blue-500 text-white p-3 rounded-full">
                            <MessageCircle size={24} />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-gray-900">Telegram</h4>
                            <p className="text-xs text-gray-500">Seguro e privado</p>
                        </div>
                        {platform === 'telegram' && <div className="ml-auto w-4 h-4 bg-blue-500 rounded-full"></div>}
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          {checkoutStep === 'cart' ? (
            <>
              <div className="flex justify-between mb-2 text-gray-600 text-sm">
                <span>Subtotal</span>
                <span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(total)}</span>
              </div>
              {discount > 0 && (
                  <div className="flex justify-between mb-2 text-green-600 font-medium text-sm">
                    <span>Desconto ({appliedCoupon})</span>
                    <span>-{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(discount)}</span>
                  </div>
              )}
              <div className="flex justify-between mb-4 text-xl font-bold text-gray-900">
                <span>Total</span>
                <span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(finalTotal)}</span>
              </div>
              <button 
                className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={cartItems.length === 0}
                onClick={handleCheckoutStart}
              >
                Finalizar Compra
              </button>
            </>
          ) : checkoutStep === 'info' ? (
            <div className="flex gap-3">
                <button 
                    onClick={() => setCheckoutStep('cart')}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                    Voltar
                </button>
                <button 
                    onClick={handleInfoSubmit}
                    disabled={!userInfo.name || !userInfo.address}
                    className="flex-[2] bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Continuar
                </button>
            </div>
          ) : (
            <div className="flex gap-3">
                <button 
                    onClick={() => setCheckoutStep('info')}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                    Voltar
                </button>
                <button 
                    onClick={handleFinalize}
                    className={`flex-[2] py-3 rounded-xl font-bold shadow-lg transition-all text-white flex items-center justify-center gap-2
                        ${platform === 'whatsapp' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'}
                    `}
                >
                    {isCopied ? <Check size={20} /> : <Send size={20} />}
                    {platform === 'whatsapp' ? 'Enviar Pedido' : 'Abrir Telegram'}
                </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
