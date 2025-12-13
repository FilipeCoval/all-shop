import React, { useState, useEffect } from 'react';
import { CartItem, UserCheckoutInfo, Order, Coupon, User } from '../types';
import { X, Trash2, Smartphone, Send, Check, TicketPercent, Loader2, Lock, ChevronLeft, Truck, Coins } from 'lucide-react';
import { SELLER_PHONE, TELEGRAM_LINK, STORE_NAME } from '../constants';
import { db } from '../services/firebaseConfig';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (cartItemId: string) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  total: number;
  onCheckout: (order: Order) => void;
  user: User | null;
  onOpenLogin: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ 
  isOpen, onClose, cartItems, onRemoveItem, onUpdateQuantity, total, onCheckout, user, onOpenLogin
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
    name: '', address: '', paymentMethod: 'MB Way', phone: ''
  });

  // CONSTANTES DE CUSTOS
  const SHIPPING_THRESHOLD = 50;
  const SHIPPING_COST = 4.99;
  const COD_FEE = 2.00; // Taxa de Cobrança

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

  // AUTO-FILL USER DATA
  useEffect(() => {
      if (user) {
          const hasAddress = user.addresses && user.addresses.length > 0 && user.addresses[0];
          const formattedAddress = hasAddress 
              ? `${user.addresses[0].street || ''}, ${user.addresses[0].zip || ''} ${user.addresses[0].city || ''}` 
              : '';

          setUserInfo(prev => ({
              ...prev,
              name: user.name || '',
              address: formattedAddress || prev.address,
              phone: user.phone || prev.phone
          }));
      }
  }, [user]);

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
          
          // Incrementar uso
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

  // --- CÁLCULOS FINAIS ---
  const shippingCost = total >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const paymentFee = userInfo.paymentMethod === 'Cobrança' ? COD_FEE : 0;
  
  const finalTotal = Math.max(0, total + shippingCost + paymentFee - discount);

  const generateOrderId = () => `#AS-${Math.floor(100000 + Math.random() * 900000)}`;

  const handleCheckoutStart = () => {
    if (cartItems.length === 0) return;

    if (!user) {
        onOpenLogin();
        return;
    }

    setCheckoutStep('info');
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentOrderId) setCurrentOrderId(generateOrderId());
      setCheckoutStep('platform');
  };

  const handleFinalizeOrder = () => {
      const newOrder: Order = {
          id: currentOrderId,
          date: new Date().toISOString(),
          total: finalTotal,
          status: 'Processamento',
          items: cartItems.map(item => `${item.quantity}x ${item.name} ${item.selectedVariant ? `(${item.selectedVariant})` : ''}`),
          userId: user?.uid,
          shippingInfo: userInfo
      };

      onCheckout(newOrder);

      const itemsList = cartItems.map(item => 
          `• ${item.quantity}x ${item.name} ${item.selectedVariant ? `(${item.selectedVariant})` : ''} - ${item.price}€`
      ).join('\n');

      const couponText = appliedCoupon ? `\n🏷️ Desconto (${appliedCoupon.code}): -${discount.toFixed(2)}€` : '';
      
      const shippingText = shippingCost > 0 ? `\n🚚 Portes: +${shippingCost.toFixed(2)}€` : '\n🚚 Portes: Grátis';
      const feeText = paymentFee > 0 ? `\n💵 Taxa Cobrança: +${paymentFee.toFixed(2)}€` : '';

      const message = `
Olá! Gostaria de finalizar a minha encomenda na *${STORE_NAME}*.

🆔 *Pedido:* ${currentOrderId}
👤 *Nome:* ${userInfo.name}
📍 *Morada:* ${userInfo.address}
📱 *Contacto:* ${userInfo.phone}
💳 *Pagamento:* ${userInfo.paymentMethod}

🛒 *Carrinho:*
${itemsList}
${couponText}${shippingText}${feeText}

💰 *Total a Pagar:* ${finalTotal.toFixed(2)}€
`.trim();

      const encodedMessage = encodeURIComponent(message);
      if (platform === 'whatsapp') {
          window.open(`https://wa.me/${SELLER_PHONE}?text=${encodedMessage}`, '_blank');
      } else {
          window.open(TELEGRAM_LINK, '_blank');
          
          navigator.clipboard.writeText(message);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
          alert("Mensagem copiada! Cole no chat do Telegram.");
      }

      onClose();
  };
  
  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
              {checkoutStep !== 'cart' && (
                  <button onClick={() => setCheckoutStep(checkoutStep === 'platform' ? 'info' : 'cart')} className="p-1 hover:bg-gray-100 rounded-full mr-1">
                      <ChevronLeft size={20} />
                  </button>
              )}
              <h2 className="text-xl font-bold text-gray-900">
                  {checkoutStep === 'cart' && 'O seu Carrinho'}
                  {checkoutStep === 'info' && 'Dados de Envio'}
                  {checkoutStep === 'platform' && 'Confirmar Pedido'}
              </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {/* STEP 1: CART */}
            {checkoutStep === 'cart' && (
                <>
                    {cartItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                            <div className="bg-gray-200 p-6 rounded-full mb-4">
                                <Smartphone size={48} className="text-gray-400" />
                            </div>
                            <p className="text-lg font-medium text-gray-900">O carrinho está vazio</p>
                            <p className="text-sm text-gray-500 mt-1">Adicione produtos para começar</p>
                            <button onClick={onClose} className="mt-6 text-primary font-bold hover:underline">
                                Continuar a comprar
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {cartItems.map((item) => (
                                <div key={item.cartItemId} className="bg-white p-3 rounded-xl border border-gray-100 flex gap-3 shadow-sm animate-slide-in">
                                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-sm truncate pr-2">{item.name}</h3>
                                                {item.selectedVariant && (
                                                    <p className="text-xs text-gray-500 mt-0.5">{item.selectedVariant}</p>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => onRemoveItem(item.cartItemId)}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-end mt-2">
                                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                                <button 
                                                    onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                                                    className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-primary disabled:opacity-50"
                                                    disabled={item.quantity <= 1}
                                                >
                                                    -
                                                </button>
                                                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                                <button 
                                                    onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                                                    className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-primary"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="font-bold text-gray-900">
                                                {(item.price * item.quantity).toFixed(2)}€
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* STEP 2: INFO */}
            {checkoutStep === 'info' && (
                <form id="infoForm" onSubmit={handleInfoSubmit} className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                                <input 
                                    type="text" 
                                    required
                                    value={userInfo.name}
                                    onChange={e => setUserInfo({...userInfo, name: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                                    placeholder="Ex: João Silva"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Morada de Entrega</label>
                                <textarea 
                                    required
                                    rows={3}
                                    value={userInfo.address}
                                    onChange={e => setUserInfo({...userInfo, address: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                                    placeholder="Rua, Número, Código Postal, Cidade"
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Telemóvel (WhatsApp)</label>
                                <input 
                                    type="tel" 
                                    required
                                    value={userInfo.phone}
                                    onChange={e => setUserInfo({...userInfo, phone: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                                    placeholder="Ex: 912 345 678"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-3">Método de Pagamento</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {['MB Way', 'Transferência Bancária', 'Cobrança'].map((method) => (
                                        <label 
                                            key={method}
                                            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                                                ${userInfo.paymentMethod === method 
                                                    ? 'border-primary bg-blue-50 text-primary' 
                                                    : 'border-gray-100 hover:border-gray-200 text-gray-600 bg-white'
                                                }
                                            `}
                                        >
                                            <input 
                                                type="radio" 
                                                name="payment" 
                                                value={method}
                                                checked={userInfo.paymentMethod === method}
                                                onChange={e => setUserInfo({...userInfo, paymentMethod: e.target.value})}
                                                className="hidden"
                                            />
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                                                ${userInfo.paymentMethod === method ? 'border-primary' : 'border-gray-300'}
                                            `}>
                                                {userInfo.paymentMethod === method && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-bold block">{method}</span>
                                                {method === 'Cobrança' && (
                                                    <span className="text-xs text-orange-600 font-medium">+2.00€ Taxa</span>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* STEP 3: PLATFORM & SUMMARY */}
            {checkoutStep === 'platform' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 animate-bounce">
                            <Check size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Quase lá!</h3>
                        <p className="text-gray-500 text-sm mt-2">Escolha onde quer finalizar o pedido para recebermos os seus dados.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => setPlatform('whatsapp')}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all
                                ${platform === 'whatsapp' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 bg-white text-gray-600 hover:border-green-200'}
                            `}
                        >
                            <Smartphone size={32} className={platform === 'whatsapp' ? 'text-green-600' : 'text-gray-400'} />
                            <span className="font-bold">WhatsApp</span>
                        </button>
                        <button 
                            onClick={() => setPlatform('telegram')}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all
                                ${platform === 'telegram' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-600 hover:border-blue-200'}
                            `}
                        >
                            <Send size={32} className={platform === 'telegram' ? 'text-blue-500' : 'text-gray-400'} />
                            <span className="font-bold">Telegram</span>
                        </button>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm text-gray-600 flex items-start gap-3">
                        <Lock size={16} className="mt-0.5 shrink-0" />
                        <p>Ao clicar em finalizar, será redirecionado para a aplicação escolhida com os detalhes da sua encomenda preenchidos.</p>
                    </div>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
            {/* Coupon Input */}
            {checkoutStep === 'cart' && cartItems.length > 0 && (
                <div className="mb-4">
                    {appliedCoupon ? (
                        <div className="flex justify-between items-center bg-green-50 border border-green-200 p-3 rounded-lg text-sm">
                            <span className="text-green-700 font-bold flex items-center gap-2">
                                <TicketPercent size={16} /> {appliedCoupon.code} aplicado
                            </span>
                            <button onClick={removeCoupon} className="text-red-500 hover:text-red-700 p-1">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Código de Cupão"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm uppercase outline-none focus:border-primary"
                                onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                            />
                            <button 
                                onClick={handleApplyCoupon}
                                disabled={isCheckingCoupon || !couponCode}
                                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 disabled:opacity-50"
                            >
                                {isCheckingCoupon ? <Loader2 size={16} className="animate-spin" /> : 'Aplicar'}
                            </button>
                        </div>
                    )}
                    {couponError && <p className="text-red-500 text-xs mt-1 ml-1">{couponError}</p>}
                </div>
            )}

            {/* Summary Lines */}
            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-gray-500 text-sm">
                    <span>Subtotal</span>
                    <span>{total.toFixed(2)}€</span>
                </div>
                
                {/* Shipping Line */}
                <div className={`flex justify-between text-sm ${shippingCost === 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    <span className="flex items-center gap-1">
                        <Truck size={14} /> Portes {total >= SHIPPING_THRESHOLD && '(>50€)'}
                    </span>
                    <span>{shippingCost === 0 ? 'Grátis' : `+${shippingCost.toFixed(2)}€`}</span>
                </div>

                {/* COD Fee Line */}
                {paymentFee > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                        <span className="flex items-center gap-1"><Coins size={14} /> Taxa Cobrança</span>
                        <span>+{paymentFee.toFixed(2)}€</span>
                    </div>
                )}

                {discount > 0 && (
                    <div className="flex justify-between text-green-600 text-sm font-medium">
                        <span>Desconto</span>
                        <span>-{discount.toFixed(2)}€</span>
                    </div>
                )}
                
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-100 mt-2">
                    <span>Total</span>
                    <span>{finalTotal.toFixed(2)}€</span>
                </div>
            </div>

            {/* Main Action Button */}
            {checkoutStep === 'cart' ? (
                <button 
                    onClick={handleCheckoutStart}
                    disabled={cartItems.length === 0}
                    className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                    Continuar Compra
                </button>
            ) : checkoutStep === 'info' ? (
                <button 
                    form="infoForm"
                    type="submit"
                    className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-all"
                >
                    Seguinte
                </button>
            ) : (
                <button 
                    onClick={handleFinalizeOrder}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 text-white
                        ${platform === 'whatsapp' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30'}
                    `}
                >
                    {isCopied ? <Check size={24} /> : <Send size={24} />}
                    Finalizar no {platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
                </button>
            )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
