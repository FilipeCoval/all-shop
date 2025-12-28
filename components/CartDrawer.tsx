import React, { useState, useEffect, useRef } from 'react';
import { CartItem, UserCheckoutInfo, Order, Coupon, User } from '../types';
import { X, Trash2, Smartphone, Send, Check, TicketPercent, Loader2, Lock, ChevronLeft, Truck, Coins, Landmark, Banknote, AlertCircle, Copy } from 'lucide-react';
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
  const [showManualMessage, setShowManualMessage] = useState<string | null>(null);
  
  const lastOrderRef = useRef<{ items: string, total: number, time: number } | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState<string>('');

  const [addressFields, setAddressFields] = useState({
    street: '', number: '', zip: '', city: ''
  });
  
  const [userInfo, setUserInfo] = useState<UserCheckoutInfo>({
    name: '', address: '', paymentMethod: 'MB Way', phone: ''
  });

  const [formError, setFormError] = useState<string | null>(null);

  const SHIPPING_THRESHOLD = 50;
  const SHIPPING_COST = 4.99;
  const COD_FEE = 2.00; 

  useEffect(() => {
    if (!isOpen) {
        setTimeout(() => {
            setCheckoutStep('cart');
            setCurrentOrderId('');
            setDiscount(0);
            setAppliedCoupon(null);
            setCouponCode('');
            setIsFinalizing(false);
            setShowManualMessage(null);
        }, 500);
    }
  }, [isOpen]);

  useEffect(() => {
      if (user) {
          const firstAddr = user.addresses?.[0];
          if (firstAddr) {
              setAddressFields({ street: firstAddr.street || '', number: '', zip: firstAddr.zip || '', city: firstAddr.city || '' });
          }
          setUserInfo(prev => ({ ...prev, name: user.name || '', phone: user.phone || prev.phone }));
      }
  }, [user]);

  const shippingCost = total >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const paymentFee = userInfo.paymentMethod === 'Cobrança' ? COD_FEE : 0;
  const finalTotal = Math.max(0, total + shippingCost + paymentFee - discount);
  
  const remainingForFreeShipping = SHIPPING_THRESHOLD - total;
  const progressPercentage = (total / SHIPPING_THRESHOLD) * 100;

  const handleApplyCoupon = async () => {
      const code = couponCode.trim().toUpperCase();
      if (!code) return;
      setIsCheckingCoupon(true);
      try {
          const snapshot = await db.collection('coupons').where('code', '==', code).get();
          if (snapshot.empty) { setCouponError('Cupão inválido.'); return; }
          const couponData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Coupon;
          if (!couponData.isActive) { setCouponError('Expirado.'); return; }
          if (total < couponData.minPurchase) { setCouponError(`Mín. ${couponData.minPurchase}€`); return; }
          setAppliedCoupon(couponData);
          setDiscount(couponData.type === 'PERCENTAGE' ? total * (couponData.value / 100) : couponData.value);
          setCouponCode('');
      } catch (error) { setCouponError('Erro.'); } finally { setIsCheckingCoupon(false); }
  };

  const legacyCopy = (text: string): boolean => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Ensure element is not visible but part of DOM
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch { return false; }
  };

  const handleFinalizeOrder = async () => {
      if (isFinalizing) return;
      setIsFinalizing(true);
      
      const newOrder: Order = {
          id: currentOrderId || `#AS-${Math.floor(100000 + Math.random() * 900000)}`,
          date: new Date().toISOString(),
          total: finalTotal,
          status: 'Processamento',
          items: cartItems.map(item => `${item.quantity}x ${item.name} ${item.selectedVariant ? `(${item.selectedVariant})` : ''}`),
          userId: user?.uid,
          shippingInfo: userInfo
      };

      onCheckout(newOrder);

      const itemsList = cartItems.map(item => `• ${item.quantity}x ${item.name} - ${item.price}€`).join('\n');
      const message = `🛍️ *${STORE_NAME}* - Pedido ${newOrder.id}\n👤 Cliente: ${userInfo.name}\n📍 Morada: ${userInfo.address}\n📱 Tel: ${userInfo.phone}\n💳 Pagamento: ${userInfo.paymentMethod}\n\n🛒 Artigos:\n${itemsList}\n\n💰 TOTAL: ${finalTotal.toFixed(2)}€`.trim();

      if (platform === 'whatsapp') {
          window.open(`https://wa.me/${SELLER_PHONE}?text=${encodeURIComponent(message)}`, '_blank');
          onClose();
      } else {
          // Telegram flow
          // Attempt copy FIRST to ensure focus is on document
          let success = false;
          
          // Try async Clipboard API first
          try {
             if (navigator.clipboard && navigator.clipboard.writeText) {
                 await navigator.clipboard.writeText(message);
                 success = true;
             }
          } catch (err) {
             console.debug("Async copy failed, trying legacy", err);
          }

          // Fallback to legacy execCommand if async failed or unavailable
          if (!success) {
              success = legacyCopy(message);
          }

          if (success) {
              setIsCopied(true);
              // Open Telegram AFTER copy to prevent losing focus
              window.open(TELEGRAM_LINK, '_blank');
              setTimeout(() => { setIsCopied(false); onClose(); }, 2000);
          } else {
              // If all copy attempts fail, open telegram anyway but show manual copy modal
              window.open(TELEGRAM_LINK, '_blank');
              setShowManualMessage(message);
              setIsFinalizing(false);
          }
      }
  };
  
  return (
    <>
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Modal Mensagem Manual Telegram */}
        {showManualMessage && (
            <div className="absolute inset-0 z-[60] bg-white p-6 flex flex-col items-center justify-center text-center">
                <div className="bg-blue-50 p-4 rounded-full text-blue-500 mb-4"><AlertCircle size={40}/></div>
                <h3 className="text-xl font-bold mb-2">Quase lá!</h3>
                <p className="text-sm text-gray-500 mb-6">O navegador bloqueou a cópia automática. Por favor, copie a mensagem abaixo e cole-a no Telegram:</p>
                <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-left mb-6 font-mono whitespace-pre-wrap select-all max-h-48 overflow-y-auto">
                    {showManualMessage}
                </div>
                <button onClick={() => { legacyCopy(showManualMessage); onClose(); }} className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                    <Check size={20}/> Concluir
                </button>
            </div>
        )}

        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
              {checkoutStep !== 'cart' && <button onClick={() => setCheckoutStep(checkoutStep === 'platform' ? 'info' : 'cart')} className="p-1 hover:bg-gray-100 rounded-full mr-1"><ChevronLeft size={20}/></button>}
              <h2 className="text-xl font-bold text-gray-900">{checkoutStep === 'cart' ? 'O seu Carrinho' : checkoutStep === 'info' ? 'Dados de Envio' : 'Confirmar Pedido'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {checkoutStep === 'cart' && (
                <div className="space-y-4">
                    {cartItems.map((item) => (
                        <div key={item.cartItemId} className="bg-white p-3 rounded-xl border border-gray-100 flex gap-3 shadow-sm animate-slide-in">
                            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0"><img src={item.image} alt={item.name} className="w-full h-full object-cover" /></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div><h3 className="font-bold text-gray-900 text-sm truncate pr-2">{item.name}</h3>{item.selectedVariant && <p className="text-xs text-gray-500 mt-0.5">{item.selectedVariant}</p>}</div>
                                    <button onClick={() => onRemoveItem(item.cartItemId)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                        <button onClick={() => onUpdateQuantity(item.cartItemId, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm" disabled={item.quantity <= 1}>-</button>
                                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => onUpdateQuantity(item.cartItemId, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm">+</button>
                                    </div>
                                    <span className="font-bold">{(item.price * item.quantity).toFixed(2)}€</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {cartItems.length === 0 && <div className="text-center py-20 text-gray-400">Carrinho vazio</div>}
                </div>
            )}

            {checkoutStep === 'info' && (
                <form id="infoForm" onSubmit={(e) => { e.preventDefault(); setCheckoutStep('platform'); }} className="space-y-4 animate-fade-in">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                        <input type="text" required placeholder="Nome Completo" value={userInfo.name} onChange={e => setUserInfo({...userInfo, name: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                        <input type="text" required placeholder="Morada Completa" value={userInfo.address} onChange={e => setUserInfo({...userInfo, address: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                        <input type="tel" required placeholder="Telemóvel" value={userInfo.phone} onChange={e => setUserInfo({...userInfo, phone: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                        <div className="space-y-2">
                            {['MB Way', 'Transferência', 'Cobrança'].map(m => (
                                <label key={m} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${userInfo.paymentMethod === m ? 'border-primary bg-blue-50 text-primary' : 'border-gray-100'}`}>
                                    <input type="radio" checked={userInfo.paymentMethod === m} onChange={() => setUserInfo({...userInfo, paymentMethod: m})} className="hidden" />
                                    <span className="font-bold text-sm">{m}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </form>
            )}

            {checkoutStep === 'platform' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600"><Check size={32} /></div>
                        <h3 className="text-xl font-bold">Quase Concluído</h3>
                        <p className="text-gray-500 text-sm">Escolha a aplicação para enviar o pedido:</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setPlatform('whatsapp')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${platform === 'whatsapp' ? 'border-green-500 bg-green-50' : 'bg-white'}`}>
                            <Smartphone className="text-green-600" size={32} /><span className="font-bold">WhatsApp</span>
                        </button>
                        <button onClick={() => setPlatform('telegram')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${platform === 'telegram' ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}>
                            <Send className="text-blue-500" size={32} /><span className="font-bold">Telegram</span>
                        </button>
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 border-t bg-white shadow-lg shrink-0">
            
            {checkoutStep === 'cart' && total > 0 && total < SHIPPING_THRESHOLD && (
                <div className="mb-4 text-center p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-600 mb-2">
                        Faltam <strong>{remainingForFreeShipping.toFixed(2)}€</strong> para portes grátis!
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                </div>
            )}

            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-gray-500 text-sm"><span>Subtotal</span><span>{total.toFixed(2)}€</span></div>
                <div className="flex justify-between text-gray-500 text-sm">
                    <span>Portes de Envio</span>
                    <span className={shippingCost === 0 ? 'font-bold text-green-600' : ''}>{shippingCost > 0 ? `${shippingCost.toFixed(2)}€` : 'Grátis'}</span>
                </div>
                {checkoutStep !== 'cart' && paymentFee > 0 && (
                    <div className="flex justify-between text-gray-500 text-sm">
                        <span>Taxa de Cobrança</span>
                        <span>{paymentFee.toFixed(2)}€</span>
                    </div>
                )}
                {appliedCoupon && (
                    <div className="flex justify-between text-green-600 text-sm font-medium">
                        <span>Desconto ({appliedCoupon.code})</span>
                        <span>-{discount.toFixed(2)}€</span>
                    </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-2 border-t mt-2"><span>Total</span><span>{finalTotal.toFixed(2)}€</span></div>
            </div>

            {checkoutStep === 'cart' ? (
                <button onClick={() => cartItems.length > 0 && (user ? setCheckoutStep('info') : onOpenLogin())} disabled={cartItems.length === 0} className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50">Continuar Compra</button>
            ) : checkoutStep === 'info' ? (
                <button form="infoForm" type="submit" className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg">Seguinte</button>
            ) : (
                <button onClick={handleFinalizeOrder} disabled={isFinalizing} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 text-white ${platform === 'whatsapp' ? 'bg-green-600' : 'bg-blue-500'}`}>
                    {isFinalizing ? <Loader2 className="animate-spin" /> : isCopied ? <Check /> : <Send />} Finalizar no {platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
                </button>
            )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
