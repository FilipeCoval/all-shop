
import React, { useState, useEffect } from 'react';
import { CartItem, UserCheckoutInfo, Order, Coupon, User } from '../types';
import { X, Trash2, Smartphone, Send, MessageCircle, Copy, Check, TicketPercent, Loader2, Truck, PartyPopper, Lock, LogIn, ChevronLeft } from 'lucide-react';
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

  // CONSTANTS & COSTS
  const FREE_SHIPPING_THRESHOLD = 50;
  const SHIPPING_COST = 4.99;
  const COD_FEE = 2.00; // Taxa de Cobrança

  // Logic: Shipping is based on subtotal (products only)
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - total);
  const progressPercent = Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100);

  // Logic: Costs Calculation
  const shippingValue = total > 0 && total < FREE_SHIPPING_THRESHOLD ? SHIPPING_COST : 0;
  const paymentFee = userInfo.paymentMethod === 'Cobrança (+2€)' ? COD_FEE : 0;

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
          // Safe check to prevent crashes if address data is partial
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

  // FINAL TOTAL FORMULA: Subtotal - Discount + Shipping + PaymentFee
  const finalTotal = Math.max(0, total - discount + shippingValue + paymentFee);

  const generateOrderId = () => `#AS-${Math.floor(100000 + Math.random() * 900000)}`;

  const handleCheckoutStart = () => {
    if (cartItems.length === 0) return;

    // SEGURANÇA: Verificar login antes de avançar
    if (!user) {
        onOpenLogin();
        // Não fechamos o carrinho para o utilizador perceber o contexto
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
      // 1. Criar Objeto de Encomenda
      const newOrder: Order = {
          id: currentOrderId,
          date: new Date().toISOString(),
          total: finalTotal,
          status: 'Processamento',
          items: cartItems.map(item => `${item.quantity}x ${item.name} ${item.selectedVariant ? `(${item.selectedVariant})` : ''}`),
          userId: user?.uid,
          shippingInfo: userInfo
      };

      // 2. Chamar prop para guardar na DB
      onCheckout(newOrder);

      // 3. Gerar Mensagem
      const itemsList = cartItems.map(item => 
          `• ${item.quantity}x ${item.name} ${item.selectedVariant ? `(${item.selectedVariant})` : ''} - ${item.price}€`
      ).join('\n');

      const couponText = appliedCoupon ? `\n🏷️ Desconto (${appliedCoupon.code}): -${discount.toFixed(2)}€` : '';
      const shippingText = shippingValue === 0 ? 'Grátis' : `${shippingValue.toFixed(2)}€`;
      const feeText = paymentFee > 0 ? `\n💸 Taxa de Cobrança: +${paymentFee.toFixed(2)}€` : '';

      const message = `
Olá! Gostaria de finalizar a minha encomenda na *${STORE_NAME}*.

🆔 *Pedido:* ${currentOrderId}
👤 *Nome:* ${userInfo.name}
📍 *Morada:* ${userInfo.address}
📱 *Contacto:* ${userInfo.phone}
💳 *Pagamento:* ${userInfo.paymentMethod}

🛒 *Carrinho:*
${itemsList}
${couponText}

🚚 *Portes:* ${shippingText}${feeText}

💰 *Total a Pagar:* ${finalTotal.toFixed(2)}€
`.trim();

      // 4. Redirecionar
      const encodedMessage = encodeURIComponent(message);
      if (platform === 'whatsapp') {
          window.open(`https://wa.me/${SELLER_PHONE}?text=${encodedMessage}`, '_blank');
      } else {
          window.open(TELEGRAM_LINK, '_blank');
          
          // Copy to clipboard fallback for Telegram
          navigator.clipboard.writeText(message);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
          alert("Mensagem copiada! Cole no chat do Telegram.");
      }

      // 5. Fechar
      onClose();
  };
  
  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
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
                    {/* Free Shipping Progress */}
                    {total > 0 && (
                        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                                <Truck size={18} className={remainingForFreeShipping === 0 ? "text-green-500" : "text-blue-500"} />
                                {remainingForFreeShipping > 0 ? (
                                    <span>Faltam <span className="text-blue-600 font-bold">{remainingForFreeShipping.toFixed(2)}€</span> para portes grátis!</span>
                                ) : (
                                    <span className="text-green-600 font-bold">Parabéns! Tem portes grátis.</span>
                                )}
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${remainingForFreeShipping === 0 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

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
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Telemóvel</label>
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
                                <label className="block text-sm font-bold text-gray-700 mb-1">Pagamento Preferido</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['MB Way', 'Transf. Bancária', 'Cobrança (+2€)'].map(method => (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => setUserInfo({...userInfo, paymentMethod: method})}
                                            className={`p-3 rounded-xl border text-sm font-medium transition-all
                                                ${userInfo.paymentMethod === method 
                                                    ? 'bg-blue-50 border-primary text-primary shadow-sm' 
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* STEP 3: PLATFORM */}
            {checkoutStep === 'platform' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                            <Check size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Quase lá!</h3>
                        <p className="text-gray-500 mt-2 text-sm">
                            Para confirmar a encomenda com segurança, finalizamos o processo com um humano no WhatsApp ou Telegram.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h4 className="font-bold text-gray-900 mb-4">Escolha onde finalizar:</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setPlatform('whatsapp')}
                                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                                    ${platform === 'whatsapp' 
                                        ? 'border-green-500 bg-green-50 text-green-700' 
                                        : 'border-gray-100 hover:border-green-200 bg-white'
                                    }`}
                            >
                                <Smartphone size={32} className={platform === 'whatsapp' ? 'text-green-600' : 'text-gray-400'} />
                                <span className="font-bold">WhatsApp</span>
                            </button>
                            <button 
                                onClick={() => setPlatform('telegram')}
                                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                                    ${platform === 'telegram' 
                                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                        : 'border-gray-100 hover:border-blue-200 bg-white'
                                    }`}
                            >
                                <Send size={32} className={platform === 'telegram' ? 'text-blue-600' : 'text-gray-400'} />
                                <span className="font-bold">Telegram</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-100 p-4 rounded-xl text-xs text-gray-500 flex gap-2">
                        <Lock size={16} className="shrink-0" />
                        <p>Os seus dados são enviados de forma encriptada diretamente para o nosso suporte oficial.</p>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-100 shrink-0 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
            
            {/* Coupon Input Area (Only in Cart Step) */}
            {checkoutStep === 'cart' && cartItems.length > 0 && (
                <div className="mb-4">
                    {appliedCoupon ? (
                        <div className="flex justify-between items-center bg-green-50 border border-green-200 p-3 rounded-lg mb-2 animate-fade-in">
                             <div className="flex items-center gap-2">
                                <TicketPercent className="text-green-600" size={18} />
                                <span className="text-green-800 font-bold text-sm">
                                    Cupão {appliedCoupon.code} aplicado!
                                </span>
                             </div>
                             <button onClick={removeCoupon} className="text-green-600 hover:text-green-800 p-1"><X size={16} /></button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                    type="text" 
                                    placeholder="Tem um cupão?"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none uppercase"
                                />
                                <TicketPercent className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            </div>
                            <button 
                                onClick={handleApplyCoupon}
                                disabled={!couponCode || isCheckingCoupon}
                                className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                            >
                                {isCheckingCoupon ? <Loader2 className="animate-spin" size={16} /> : 'Aplicar'}
                            </button>
                        </div>
                    )}
                    {couponError && <p className="text-red-500 text-xs mt-1 ml-1">{couponError}</p>}
                </div>
            )}

            {/* Totals */}
            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-gray-500 text-sm">
                    <span>Subtotal</span>
                    <span>{total.toFixed(2)}€</span>
                </div>
                
                {/* Portes de Envio */}
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Portes de Envio</span>
                    {shippingValue === 0 ? (
                        <span className="text-green-600 font-bold">Grátis</span>
                    ) : (
                        <span className="text-gray-900">{shippingValue.toFixed(2)}€</span>
                    )}
                </div>

                {/* Taxa de Cobrança */}
                {paymentFee > 0 && (
                    <div className="flex justify-between text-sm animate-fade-in">
                        <span className="text-gray-500">Taxa de Cobrança</span>
                        <span className="text-gray-900">+{paymentFee.toFixed(2)}€</span>
                    </div>
                )}

                {discount > 0 && (
                    <div className="flex justify-between text-green-600 text-sm font-medium animate-fade-in">
                        <span>Desconto</span>
                        <span>-{discount.toFixed(2)}€</span>
                    </div>
                )}
                
                <div className="flex justify-between text-gray-900 font-bold text-xl pt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span>{finalTotal.toFixed(2)}€</span>
                </div>
            </div>

            {/* Main Action Button */}
            {checkoutStep === 'cart' ? (
                <button 
                    onClick={handleCheckoutStart}
                    disabled={cartItems.length === 0}
                    className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {user ? 'Continuar Compra' : 'Entrar para Comprar'} <PartyPopper size={20} />
                </button>
            ) : checkoutStep === 'info' ? (
                <button 
                    type="submit"
                    form="infoForm"
                    className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    Confirmar Dados
                </button>
            ) : (
                <button 
                    onClick={handleFinalizeOrder}
                    className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-white
                        ${platform === 'whatsapp' 
                            ? 'bg-green-600 hover:bg-green-700 shadow-green-500/25' 
                            : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/25'
                        }`}
                >
                    {isCopied ? 'Copiado!' : `Enviar Pedido via ${platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}`} 
                    {isCopied ? <Check size={20} /> : <Send size={20} />}
                </button>
            )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
