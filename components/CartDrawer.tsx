
import React, { useState, useEffect, useRef } from 'react';
import { CartItem, UserCheckoutInfo, Order, Coupon, User } from '../types';
import { X, Trash2, Smartphone, Send, Check, TicketPercent, Loader2, Lock, ChevronLeft, Truck, Coins, Landmark, Banknote, AlertCircle } from 'lucide-react';
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
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  // Anti-Spam / Duplicated Order check
  const lastOrderRef = useRef<{ items: string, total: number, time: number } | null>(null);
  
  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  
  const [currentOrderId, setCurrentOrderId] = useState<string>('');

  // Structured Address State
  const [addressFields, setAddressFields] = useState({
    street: '',
    number: '',
    zip: '',
    city: ''
  });
  
  const [userInfo, setUserInfo] = useState<UserCheckoutInfo>({
    name: '', address: '', paymentMethod: 'MB Way', phone: ''
  });

  const [formError, setFormError] = useState<string | null>(null);

  // CONSTANTES DE CUSTOS
  const SHIPPING_THRESHOLD = 50;
  const SHIPPING_COST = 4.99;
  const COD_FEE = 2.00; 

  useEffect(() => {
    if (!isOpen) {
        const timer = setTimeout(() => {
            setCheckoutStep('cart');
            setCurrentOrderId('');
            setDiscount(0);
            setAppliedCoupon(null);
            setCouponCode('');
            setCouponError('');
            setIsFinalizing(false);
            setFormError(null);
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // AUTO-FILL USER DATA
  useEffect(() => {
      if (user) {
          const firstAddr = user.addresses?.[0];
          if (firstAddr) {
              setAddressFields({
                  street: firstAddr.street || '',
                  number: '', // O campo antigo não tinha número separado
                  zip: firstAddr.zip || '',
                  city: firstAddr.city || ''
              });
          }
          setUserInfo(prev => ({
              ...prev,
              name: user.name || '',
              phone: user.phone || prev.phone
          }));
      }
  }, [user]);

  // Format ZIP Code 0000-000
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 4) {
          value = value.substring(0, 4) + '-' + value.substring(4, 7);
      }
      setAddressFields(prev => ({ ...prev, zip: value }));
  };

  useEffect(() => {
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
          setAppliedCoupon(couponData);
          if (couponData.type === 'PERCENTAGE') {
              setDiscount(total * (couponData.value / 100));
          } else {
              setDiscount(couponData.value);
          }
          setCouponCode('');
          if(couponData.id) {
             db.collection('coupons').doc(couponData.id).update({ usageCount: (couponData.usageCount || 0) + 1 });
          }
      } catch (error) {
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
      setFormError(null);

      // Validação de Morada Incompleta (Verifica se há um número na rua)
      if (!/\d/.test(addressFields.street) && !addressFields.number) {
          setFormError("Por favor, indique o número da porta ou andar para garantir a entrega.");
          return;
      }

      // Validação de Código Postal
      if (!/^\d{4}-\d{3}$/.test(addressFields.zip)) {
          setFormError("O Código Postal deve ter o formato 0000-000.");
          return;
      }

      const fullAddress = `${addressFields.street}, ${addressFields.number}, ${addressFields.zip} ${addressFields.city}`;
      setUserInfo(prev => ({ ...prev, address: fullAddress }));
      
      if (!currentOrderId) setCurrentOrderId(generateOrderId());
      setCheckoutStep('platform');
  };

  const handleFinalizeOrder = () => {
      if (isFinalizing) return;

      // Anti-Duplication Logic
      const itemsFingerprint = cartItems.map(i => `${i.id}-${i.quantity}`).join('|');
      const now = Date.now();
      
      if (lastOrderRef.current && 
          lastOrderRef.current.items === itemsFingerprint && 
          lastOrderRef.current.total === finalTotal &&
          (now - lastOrderRef.current.time) < 120000) { // 2 minutos
          alert("Parece que já enviou este pedido recentemente. Verifique as suas mensagens ou aguarde um momento.");
          return;
      }

      setIsFinalizing(true);
      
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
      lastOrderRef.current = { items: itemsFingerprint, total: finalTotal, time: now };

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

      setTimeout(() => {
          onClose();
          setIsFinalizing(false);
      }, 1000);
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
            {checkoutStep === 'cart' && (
                <>
                    {cartItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                            <div className="bg-gray-200 p-6 rounded-full mb-4">
                                <Smartphone size={48} className="text-gray-400" />
                            </div>
                            <p className="text-lg font-medium text-gray-900">O carrinho está vazio</p>
                            <button onClick={onClose} className="mt-6 text-primary font-bold hover:underline">Continuar a comprar</button>
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
                                                {item.selectedVariant && <p className="text-xs text-gray-500 mt-0.5">{item.selectedVariant}</p>}
                                            </div>
                                            <button onClick={() => onRemoveItem(item.cartItemId)} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                                        </div>
                                        <div className="flex justify-between items-end mt-2">
                                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                                <button onClick={() => onUpdateQuantity(item.cartItemId, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-primary disabled:opacity-50" disabled={item.quantity <= 1}>-</button>
                                                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => onUpdateQuantity(item.cartItemId, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-primary">+</button>
                                            </div>
                                            <span className="font-bold text-gray-900">{(item.price * item.quantity).toFixed(2)}€</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {checkoutStep === 'info' && (
                <form id="infoForm" onSubmit={handleInfoSubmit} className="space-y-4 animate-fade-in">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                        {formError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center gap-2 animate-shake">
                                <AlertCircle size={16} /> {formError}
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                                <input 
                                    type="text" required autoComplete="name"
                                    value={userInfo.name}
                                    onChange={e => setUserInfo({...userInfo, name: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                    placeholder="João Silva"
                                />
                            </div>
                            
                            <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rua / Avenida</label>
                                    <input 
                                        type="text" required autoComplete="address-line1"
                                        value={addressFields.street}
                                        onChange={e => setAddressFields({...addressFields, street: e.target.value})}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                        placeholder="Rua da Liberdade"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nº / Piso</label>
                                    <input 
                                        type="text" required
                                        value={addressFields.number}
                                        onChange={e => setAddressFields({...addressFields, number: e.target.value})}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                        placeholder="12 2E"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código Postal</label>
                                    <input 
                                        type="text" required autoComplete="postal-code"
                                        value={addressFields.zip}
                                        onChange={handleZipChange}
                                        maxLength={9}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                        placeholder="1000-000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Localidade</label>
                                    <input 
                                        type="text" required autoComplete="address-level2"
                                        value={addressFields.city}
                                        onChange={e => setAddressFields({...addressFields, city: e.target.value})}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                        placeholder="Lisboa"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telemóvel (WhatsApp)</label>
                                <input 
                                    type="tel" required autoComplete="tel"
                                    value={userInfo.phone}
                                    onChange={e => setUserInfo({...userInfo, phone: e.target.value})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                                    placeholder="912 345 678"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Pagamento</label>
                                <div className="space-y-2">
                                    {['MB Way', 'Transferência Bancária', 'Cobrança'].map(method => (
                                        <label key={method} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${userInfo.paymentMethod === method ? 'border-primary bg-blue-50 text-primary' : 'border-gray-100 bg-white text-gray-600'}`}>
                                            <input type="radio" name="payment" value={method} checked={userInfo.paymentMethod === method} onChange={e => setUserInfo({...userInfo, paymentMethod: e.target.value})} className="hidden" />
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${userInfo.paymentMethod === method ? 'border-primary' : 'border-gray-300'}`}>{userInfo.paymentMethod === method && <div className="w-2 h-2 rounded-full bg-primary" />}</div>
                                            <div className="flex items-center gap-2">
                                                {method === 'MB Way' && <Smartphone size={16}/>}
                                                {method === 'Transferência Bancária' && <Landmark size={16}/>}
                                                {method === 'Cobrança' && <Banknote size={16}/>}
                                                <span className="font-bold text-sm">{method === 'Cobrança' ? 'Pagamento na Entrega' : method}</span>
                                                {method === 'Cobrança' && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">+2€</span>}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {checkoutStep === 'platform' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 animate-bounce">
                            <Check size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Validado com Sucesso</h3>
                        <p className="text-gray-500 text-sm mt-2">Escolha onde quer finalizar para recebermos o seu comprovativo.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setPlatform('whatsapp')} className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${platform === 'whatsapp' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 bg-white text-gray-600'}`}>
                            <Smartphone size={32} className={platform === 'whatsapp' ? 'text-green-600' : 'text-gray-400'} />
                            <span className="font-bold">WhatsApp</span>
                        </button>
                        <button onClick={() => setPlatform('telegram')} className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${platform === 'telegram' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-600'}`}>
                            <Send size={32} className={platform === 'telegram' ? 'text-blue-500' : 'text-gray-400'} />
                            <span className="font-bold">Telegram</span>
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
            {checkoutStep === 'cart' && cartItems.length > 0 && (
                <div className="mb-4">
                    {appliedCoupon ? (
                        <div className="flex justify-between items-center bg-green-50 border border-green-200 p-3 rounded-lg text-sm">
                            <span className="text-green-700 font-bold flex items-center gap-2"><TicketPercent size={16} /> {appliedCoupon.code} aplicado</span>
                            <button onClick={removeCoupon} className="text-red-500 p-1"><X size={16} /></button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input type="text" placeholder="Cupão" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-lg text-sm uppercase outline-none focus:border-primary" onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()} />
                            <button onClick={handleApplyCoupon} disabled={isCheckingCoupon || !couponCode} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">{isCheckingCoupon ? <Loader2 size={16} className="animate-spin" /> : 'Aplicar'}</button>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-gray-500 text-sm"><span>Subtotal</span><span>{total.toFixed(2)}€</span></div>
                <div className={`flex justify-between text-sm ${shippingCost === 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    <span className="flex items-center gap-1"><Truck size={14} /> Portes</span>
                    <span>{shippingCost === 0 ? 'Grátis' : `+${shippingCost.toFixed(2)}€`}</span>
                </div>
                {paymentFee > 0 && <div className="flex justify-between text-sm text-orange-600"><span className="flex items-center gap-1"><Coins size={14} /> Taxa Cobrança</span><span>+{paymentFee.toFixed(2)}€</span></div>}
                {discount > 0 && <div className="flex justify-between text-green-600 text-sm font-medium"><span>Desconto</span><span>-{discount.toFixed(2)}€</span></div>}
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-100 mt-2"><span>Total</span><span>{finalTotal.toFixed(2)}€</span></div>
            </div>

            {checkoutStep === 'cart' ? (
                <button onClick={handleCheckoutStart} disabled={cartItems.length === 0} className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all disabled:opacity-50">Continuar Compra</button>
            ) : checkoutStep === 'info' ? (
                <button form="infoForm" type="submit" className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all">Seguinte</button>
            ) : (
                <button 
                    onClick={handleFinalizeOrder}
                    disabled={isFinalizing}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 text-white disabled:opacity-70 disabled:cursor-not-allowed
                        ${platform === 'whatsapp' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30'}
                    `}
                >
                    {isFinalizing ? <Loader2 className="animate-spin" /> : isCopied ? <Check size={24} /> : <Send size={24} />}
                    {isFinalizing ? 'A Processar...' : `Finalizar no ${platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}`}
                </button>
            )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
