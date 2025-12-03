
import React, { useState, useEffect } from 'react';
import { CartItem, UserCheckoutInfo, Order, Coupon } from '../types';
import { X, Trash2, Smartphone, Send, MessageCircle, Copy, Check, TicketPercent, Loader2 } from 'lucide-react';
import { SELLER_PHONE, TELEGRAM_LINK } from '../constants';
import { db } from '../services/firebaseConfig'; // Importar DB

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
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  
  const [currentOrderId, setCurrentOrderId] = useState<string>('');

  const [userInfo, setUserInfo] = useState<UserCheckoutInfo>({
    name: '', address: '', paymentMethod: 'MB Way'
  });

  useEffect(() => {
    if (!isOpen) {
        const timer = setTimeout(() => {
            setCheckoutStep('cart');
            setCurrentOrderId('');
            setDiscount(0);
            setAppliedCoupon(null);
            setCouponCode('');
            setCouponError('');
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
      // Recalcular desconto se o total mudar
      if (appliedCoupon) {
          if (total < appliedCoupon.minPurchase) {
              setAppliedCoupon(null);
              setDiscount(0);
              setCouponError(`Mínimo de ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(appliedCoupon.minPurchase)} para este cupão.`);
          } else {
              if (appliedCoupon.type === 'PERCENTAGE') {
                  setDiscount(total * (appliedCoupon.value / 100));
              } else {
                  setDiscount(appliedCoupon.value);
              }
          }
      }
      if (total === 0) {
          setDiscount(0);
          setAppliedCoupon(null);
      }
  }, [total, appliedCoupon]);

  const handleApplyCoupon = async () => {
      const code = couponCode.trim().toUpperCase();
      if (!code) return;

      setIsCheckingCoupon(true);
      setCouponError('');

      try {
          const snapshot = await db.collection('coupons').where('code', '==', code).get();
          
          if (snapshot.empty) {
              setCouponError('Cupão inválido.');
              setIsCheckingCoupon(false);
              return;
          }

          const couponData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Coupon;

          if (!couponData.isActive) {
              setCouponError('Este cupão expirou.');
              setIsCheckingCoupon(false);
              return;
          }

          if (total < couponData.minPurchase) {
              setCouponError(`Válido apenas para compras acima de ${couponData.minPurchase}€`);
              setIsCheckingCoupon(false);
              return;
          }

          // Sucesso
          setAppliedCoupon(couponData);
          if (couponData.type === 'PERCENTAGE') {
              setDiscount(total * (couponData.value / 100));
          } else {
              setDiscount(couponData.value);
          }
          setCouponCode('');
          
          // Incrementar uso (opcional, mas bom para stats)
          if(couponData.id) {
             db.collection('coupons').doc(couponData.id).update({ usageCount: (couponData.usageCount || 0) + 1 });
          }

      } catch (error) {
          console.error(error);
          setCouponError('Erro ao verificar cupão.');
      } finally {
          setIsCheckingCoupon(false);
      }
  };

  const removeCoupon = () => {
      setDiscount(0);
      setAppliedCoupon(null);
      setCouponError('');
  };

  const finalTotal = Math.max(0, total - discount);

  const generateOrderId = () => `#AS-${Math.floor(100000 + Math.random() * 900000)}`;

  const handleCheckoutStart = () => {
    if (cartItems.length === 0) return;
    setCheckoutStep('info');
  };

  const handleInfoSubmit = () => {
      if (!currentOrderId) setCurrentOrderId(generateOrderId());
      setCheckoutStep('platform');
  };

  const generateOrderMessage = (orderId: string) => {
    const itemsList = cartItems.map(item => {
        const variantText = item.selectedVariant ? ` [${item.selectedVariant}]` : '';
        return `- ${item.quantity}x ${item.name}${variantText} (${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.price)})`;
    }).join('\n');
  
      const discountFormatted = discount > 0 ? `\nDesconto (${appliedCoupon?.code}): -${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(discount)}` : '';
      const finalFormatted = discount > 0 ? `\n\n*TOTAL FINAL: ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(finalTotal)}*` : `\n\n*TOTAL: ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(total)}*`;

      return `Olá! Quero finalizar a minha encomenda na Allshop.\n\n*Pedido:* ${orderId}\n\n*Cliente:* ${userInfo.name}\n*Morada:* ${userInfo.address}\n*Pagamento:* ${userInfo.paymentMethod}\n\n*Itens:*\n${itemsList}\n${discountFormatted}${finalFormatted}`;
  };

  const handleFinalize = () => {
    const orderIdToUse = currentOrderId || generateOrderId();
    const message = generateOrderMessage(orderIdToUse);
    const encodedMessage = encodeURIComponent(message);
    
    const newOrder: Order = {
      id: orderIdToUse,
      date: new Date().toISOString(),
      total: finalTotal,
      status: 'Processamento',
      items: cartItems.map(i => `${i.quantity}x ${i.name}${i.selectedVariant ? ` (${i.selectedVariant})` : ''}`),
      shippingInfo: { ...userInfo }
    };

    onCheckout(newOrder);

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/${SELLER_PHONE}?text=${encodedMessage}`, '_blank');
    } else {
      navigator.clipboard.writeText(message);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      window.open(TELEGRAM_LINK, '_blank');
    }
    onClose();
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity z-50 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Seu Carrinho</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {checkoutStep === 'cart' ? (
            cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <Smartphone size={48} className="opacity-20" />
                <p>O seu carrinho está vazio.</p>
                <button onClick={onClose} className="text-primary font-bold hover:underline">Começar a comprar</button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.cartItemId} className="flex gap-4 p-3 bg-white border border-gray-100 rounded-xl shadow-sm animate-fade-in">
                    <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg bg-gray-100" />
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-800 text-sm line-clamp-2">{item.name}</h3>
                        {item.selectedVariant && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 inline-block">{item.selectedVariant}</span>}
                        <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-primary">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.price)}</span>
                            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-2">
                                <button onClick={() => onUpdateQuantity(item.cartItemId, -1)} className="text-gray-500 hover:text-red-500 px-1 font-bold text-lg disabled:opacity-30" disabled={item.quantity <= 1}>-</button>
                                <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                                <button onClick={() => onUpdateQuantity(item.cartItemId, 1)} className="text-gray-500 hover:text-green-500 px-1 font-bold text-lg">+</button>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => onRemoveItem(item.cartItemId)} className="text-gray-300 hover:text-red-500 self-start p-1"><Trash2 size={18} /></button>
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
                                    <p className="text-sm font-bold text-green-700">Cupão {appliedCoupon.code}</p>
                                    <p className="text-xs text-green-600">-{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(discount)} aplicado</p>
                                </div>
                            </div>
                            <button onClick={removeCoupon} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
                        </div>
                    ) : (
                        <div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value)}
                                    placeholder="NATAL20"
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none uppercase"
                                    disabled={isCheckingCoupon}
                                />
                                <button 
                                    onClick={handleApplyCoupon}
                                    disabled={isCheckingCoupon || !couponCode}
                                    className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors disabled:opacity-50"
                                >
                                    {isCheckingCoupon ? <Loader2 className="animate-spin" size={16} /> : 'Aplicar'}
                                </button>
                            </div>
                            {couponError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><X size={12} /> {couponError}</p>}
                        </div>
                    )}
                </div>
              </div>
            )
          ) : checkoutStep === 'info' ? (
            <div className="space-y-6 animate-fade-in-right">
                <div className="text-center mb-6"><h3 className="font-bold text-xl">Dados de Envio</h3></div>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label><input type="text" required className="w-full border border-gray-300 rounded-lg px-4 py-3" placeholder="Ex: João Silva" value={userInfo.name} onChange={e => setUserInfo({...userInfo, name: e.target.value})} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Morada Completa</label><textarea required className="w-full border border-gray-300 rounded-lg px-4 py-3 h-24 resize-none" placeholder="Rua, Nº, Andar, Código Postal, Cidade" value={userInfo.address} onChange={e => setUserInfo({...userInfo, address: e.target.value})} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento</label><div className="grid grid-cols-2 gap-3">{['MB Way', 'Transferência', 'Cobrança (+2€)'].map(method => (<button key={method} className={`py-3 px-2 rounded-lg text-sm font-medium border transition-all ${userInfo.paymentMethod === method ? 'bg-blue-50 border-primary text-primary' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`} onClick={() => setUserInfo({...userInfo, paymentMethod: method})}>{method}</button>))}</div></div>
                </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in-right text-center pt-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 mb-4"><Check size={40} /></div>
                <h3 className="font-bold text-2xl text-gray-900">Quase lá!</h3>
                <p className="text-gray-600">Escolha onde quer finalizar o pedido.</p>
                <div className="grid grid-cols-1 gap-4 mt-8">
                    <button onClick={() => setPlatform('whatsapp')} className={`p-4 rounded-xl border-2 flex items-center gap-4 ${platform === 'whatsapp' ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}><div className="bg-green-500 text-white p-3 rounded-full"><Smartphone size={24} /></div><div className="text-left"><h4 className="font-bold text-gray-900">WhatsApp</h4></div></button>
                    <button onClick={() => setPlatform('telegram')} className={`p-4 rounded-xl border-2 flex items-center gap-4 ${platform === 'telegram' ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}><div className="bg-blue-500 text-white p-3 rounded-full"><MessageCircle size={24} /></div><div className="text-left"><h4 className="font-bold text-gray-900">Telegram</h4></div></button>
                </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          {checkoutStep === 'cart' ? (
            <>
              <div className="flex justify-between mb-2 text-gray-600 text-sm"><span>Subtotal</span><span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(total)}</span></div>
              {discount > 0 && (<div className="flex justify-between mb-2 text-green-600 font-medium text-sm"><span>Desconto ({appliedCoupon?.code})</span><span>-{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(discount)}</span></div>)}
              <div className="flex justify-between mb-4 text-xl font-bold text-gray-900"><span>Total</span><span>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(finalTotal)}</span></div>
              <button className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50" disabled={cartItems.length === 0} onClick={handleCheckoutStart}>Finalizar Compra</button>
            </>
          ) : checkoutStep === 'info' ? (
            <div className="flex gap-3"><button onClick={() => setCheckoutStep('cart')} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">Voltar</button><button onClick={handleInfoSubmit} disabled={!userInfo.name || !userInfo.address} className="flex-[2] bg-primary text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50">Continuar</button></div>
          ) : (
            <div className="flex gap-3"><button onClick={() => setCheckoutStep('info')} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">Voltar</button><button onClick={handleFinalize} className={`flex-[2] py-3 rounded-xl font-bold shadow-lg text-white flex items-center justify-center gap-2 ${platform === 'whatsapp' ? 'bg-green-600' : 'bg-blue-500'}`}>{isCopied ? <Check size={20} /> : <Send size={20} />} {platform === 'whatsapp' ? 'Enviar Pedido' : 'Abrir Telegram'}</button></div>
          )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
