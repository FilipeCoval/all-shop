
import React, { useState, useEffect, useMemo } from 'react';
import { CartItem, UserCheckoutInfo, Order, Coupon, User } from '../types';
import { X, Trash2, Check, Loader2, ChevronLeft, Copy, User as UserIcon, Clock, ShoppingCart, Tag, AlertCircle } from 'lucide-react';
import { SELLER_PHONE, TELEGRAM_LINK, STORE_NAME } from '../constants';
import { db } from '../services/firebaseConfig';

const ReservationBanner: React.FC<{ items: CartItem[] }> = ({ items }) => {
    const [displayTime, setDisplayTime] = useState<string | null>(null);

    useEffect(() => {
        const findSoonest = () => {
            const reserved = items
                .filter(i => i.reservedUntil)
                .map(i => new Date(i.reservedUntil!).getTime())
                .filter(t => t > Date.now());

            if (reserved.length === 0) return null;
            return Math.min(...reserved);
        };

        const tick = () => {
            const soonest = findSoonest();
            if (!soonest) {
                setDisplayTime(null);
                return;
            }

            const diff = soonest - Date.now();
            if (diff <= 0) {
                setDisplayTime("Expirado");
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setDisplayTime(`${mins}:${secs.toString().padStart(2, '0')}`);
        };

        tick(); 
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [items]);

    if (!displayTime) return null;

    return (
        <div className="bg-orange-50 dark:bg-orange-900/30 border-b border-orange-200 dark:border-orange-800 p-3 flex items-center gap-3 animate-fade-in shrink-0">
            <div className="bg-orange-500 p-1.5 rounded-lg text-white animate-pulse">
                <Clock size={16} />
            </div>
            <div className="flex-1">
                <p className="font-bold text-xs text-orange-800 dark:text-orange-300 uppercase tracking-wider">Reserva de Stock Ativa</p>
                <p className="text-[11px] text-orange-700 dark:text-orange-200">Conclua o pedido em <strong className="font-mono text-sm">{displayTime}</strong> para garantir os seus itens.</p>
            </div>
        </div>
    );
};

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  total: number;
  onCheckout: (order: Order) => Promise<boolean>;
  user: User | null;
  onOpenLogin: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ 
  isOpen, onClose, cartItems, onRemoveItem, onUpdateQuantity, total, onCheckout, user, onOpenLogin
}) => {
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'info' | 'platform' | 'success'>('cart');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [userInfo, setUserInfo] = useState<UserCheckoutInfo>({
    name: '', email: '', street: '', doorNumber: '', zip: '', city: '', phone: '', paymentMethod: 'MB Way'
  });
  
  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
          setCheckoutStep('cart');
          setIsFinalizing(false);
          setCouponCode('');
          setAppliedCoupon(null);
          setCouponError('');
      }, 300);
    }
  }, [isOpen]);

  const handleApplyCoupon = async () => {
      if (!couponCode.trim()) return;
      setIsCheckingCoupon(true);
      setCouponError('');
      setAppliedCoupon(null);

      try {
          const snapshot = await db.collection('coupons')
              .where('code', '==', couponCode.trim().toUpperCase())
              .limit(1)
              .get();

          if (snapshot.empty) {
              setCouponError('Cupão inválido.');
              setIsCheckingCoupon(false);
              return;
          }

          const coupon = snapshot.docs[0].data() as Coupon;
          coupon.id = snapshot.docs[0].id; // Ensure ID is captured

          if (!coupon.isActive) {
              setCouponError('Este cupão expirou.');
              setIsCheckingCoupon(false);
              return;
          }

          if (total < coupon.minPurchase) {
              setCouponError(`Mínimo de compra: ${formatCurrency(coupon.minPurchase)}`);
              setIsCheckingCoupon(false);
              return;
          }

          // Lógica de restrição de produto
          if (coupon.validProductId) {
              const hasProduct = cartItems.some(item => item.id === coupon.validProductId);
              if (!hasProduct) {
                  setCouponError('Cupão exclusivo para um produto que não está no carrinho.');
                  setIsCheckingCoupon(false);
                  return;
              }
          }

          setAppliedCoupon(coupon);
      } catch (error) {
          console.error("Erro cupão:", error);
          setCouponError('Erro ao validar cupão.');
      } finally {
          setIsCheckingCoupon(false);
      }
  };

  // Cálculo do desconto
  const discountAmount = useMemo(() => {
      if (!appliedCoupon) return 0;
      
      let amount = 0;
      
      // Se o cupão for específico para um produto, calcula o desconto APENAS sobre esse produto
      if (appliedCoupon.validProductId) {
          const eligibleItems = cartItems.filter(item => item.id === appliedCoupon.validProductId);
          const eligibleTotal = eligibleItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
          
          if (appliedCoupon.type === 'PERCENTAGE') {
              amount = eligibleTotal * (appliedCoupon.value / 100);
          } else {
              // Se for valor fixo, não pode ser superior ao valor do item
              amount = Math.min(appliedCoupon.value, eligibleTotal);
          }
      } else {
          // Cupão geral
          if (appliedCoupon.type === 'PERCENTAGE') {
              amount = total * (appliedCoupon.value / 100);
          } else {
              amount = appliedCoupon.value;
          }
      }
      
      return Math.min(amount, total); // Nunca descontar mais que o total
  }, [appliedCoupon, total, cartItems]);

  const shippingCost = (total - discountAmount) >= 50 ? 0 : 4.99;
  const finalTotal = Math.max(0, total - discountAmount + shippingCost);

  const handleProceed = () => {
    if (checkoutStep === 'cart') setCheckoutStep('info');
    else if (checkoutStep === 'info') {
        const id = `#AS-${Math.floor(100000 + Math.random() * 900000)}`;
        setCurrentOrderId(id);
        setCheckoutStep('platform');
    }
  };

  const handleFinalize = async (platform: 'wa' | 'tg') => {
    setIsFinalizing(true);
    
    // Atualizar uso do cupão
    if (appliedCoupon && appliedCoupon.id) {
        try {
            await db.collection('coupons').doc(appliedCoupon.id).update({
                usageCount: (appliedCoupon.usageCount || 0) + 1
            });
        } catch (e) { console.error("Erro ao atualizar cupão", e); }
    }

    const newOrder: Order = {
        id: currentOrderId,
        date: new Date().toISOString(),
        total: finalTotal,
        status: 'Processamento',
        items: cartItems.map(i => ({ productId: i.id, name: i.name, price: i.price, quantity: i.quantity, selectedVariant: i.selectedVariant || '', addedAt: new Date().toISOString() })),
        shippingInfo: userInfo,
        userId: user?.uid || null
    };

    const success = await onCheckout(newOrder);
    if (success) {
        let msg = `🛍️ Pedido ${currentOrderId}\n`;
        msg += `Itens:\n${cartItems.map(i => `• ${i.quantity}x ${i.name}`).join('\n')}\n`;
        if (discountAmount > 0) msg += `Desconto (${appliedCoupon?.code}): -${formatCurrency(discountAmount)}\n`;
        msg += `Portes: ${shippingCost === 0 ? 'Grátis' : formatCurrency(shippingCost)}\n`;
        msg += `Total Final: *${formatCurrency(finalTotal)}*`;
        
        if (platform === 'wa') window.open(`https://wa.me/${SELLER_PHONE}?text=${encodeURIComponent(msg)}`);
        else window.open(TELEGRAM_LINK);
        setCheckoutStep('success');
    }
    setIsFinalizing(false);
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 shrink-0">
          <div className="flex items-center gap-2">
              {checkoutStep !== 'cart' && checkoutStep !== 'success' && <button onClick={() => setCheckoutStep('cart')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-white"><ChevronLeft size={20}/></button>}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Carrinho</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400"><X size={24} /></button>
        </div>

        {/* --- TEMPORIZADOR --- */}
        {checkoutStep === 'cart' && <ReservationBanner items={cartItems} />}

        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-900">
          {checkoutStep === 'cart' && (
            <div className="space-y-4">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {cartItems.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">O seu carrinho está vazio.</div>
                ) : (
                  cartItems.map(item => (
                    <div key={item.cartItemId} className="py-4 flex gap-4">
                      <img src={item.image} className="w-16 h-16 object-contain bg-gray-50 dark:bg-gray-800 rounded" alt="" />
                      <div className="flex-1">
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{item.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.selectedVariant}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button onClick={() => onUpdateQuantity(item.cartItemId, -1)} className="w-6 h-6 border dark:border-gray-700 rounded-full font-bold dark:text-white">-</button>
                          <span className="text-sm font-bold dark:text-white">{item.quantity}</span>
                          <button onClick={() => onUpdateQuantity(item.cartItemId, 1)} className="w-6 h-6 border dark:border-gray-700 rounded-full font-bold dark:text-white">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm dark:text-white">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(item.price * item.quantity)}</p>
                        <button onClick={() => onRemoveItem(item.cartItemId)} className="text-red-400 hover:text-red-600 mt-2"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Área de Cupão */}
              {cartItems.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 mt-4">
                      {!appliedCoupon ? (
                          <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input 
                                    type="text" 
                                    placeholder="Código Promocional" 
                                    value={couponCode} 
                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm uppercase font-bold focus:ring-2 focus:ring-primary outline-none"
                                />
                                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              </div>
                              <button 
                                onClick={handleApplyCoupon} 
                                disabled={isCheckingCoupon || !couponCode}
                                className="bg-gray-900 dark:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                              >
                                  {isCheckingCoupon ? <Loader2 size={14} className="animate-spin"/> : 'Aplicar'}
                              </button>
                          </div>
                      ) : (
                          <div className="flex justify-between items-center text-green-600 dark:text-green-400 text-sm font-bold bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-800">
                              <span className="flex items-center gap-2"><Check size={16}/> Cupão {appliedCoupon.code} aplicado!</span>
                              <button onClick={() => { setAppliedCoupon(null); setCouponCode(''); }} className="text-red-500 hover:text-red-700"><X size={16}/></button>
                          </div>
                      )}
                      {couponError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle size={12}/> {couponError}</p>}
                  </div>
              )}
            </div>
          )}

          {checkoutStep === 'info' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-bold text-lg mb-4 dark:text-white">Dados de Entrega</h3>
              <input type="text" placeholder="Nome Completo" className="w-full p-3 border dark:border-gray-700 rounded-xl dark:bg-gray-800 dark:text-white" value={userInfo.name} onChange={e => setUserInfo({...userInfo, name: e.target.value})} />
              <input type="tel" placeholder="Telemóvel" className="w-full p-3 border dark:border-gray-700 rounded-xl dark:bg-gray-800 dark:text-white" value={userInfo.phone} onChange={e => setUserInfo({...userInfo, phone: e.target.value})} />
              <input type="text" placeholder="Morada" className="w-full p-3 border dark:border-gray-700 rounded-xl dark:bg-gray-800 dark:text-white" value={userInfo.street} onChange={e => setUserInfo({...userInfo, street: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Localidade" className="w-full p-3 border dark:border-gray-700 rounded-xl dark:bg-gray-800 dark:text-white" value={userInfo.city} onChange={e => setUserInfo({...userInfo, city: e.target.value})} />
                <input type="text" placeholder="Cód. Postal" className="w-full p-3 border dark:border-gray-700 rounded-xl dark:bg-gray-800 dark:text-white" value={userInfo.zip} onChange={e => setUserInfo({...userInfo, zip: e.target.value})} />
              </div>
            </div>
          )}

          {checkoutStep === 'platform' && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                <p className="font-bold mb-2">Quase lá!</p>
                <p className="text-sm">Escolha por onde quer enviar o pedido. A nossa equipa irá confirmar os dados e pagamento consigo.</p>
              </div>
              <button onClick={() => handleFinalize('wa')} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-green-700 transition-colors">Enviar via WhatsApp</button>
              <button onClick={() => handleFinalize('tg')} className="w-full bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-600 transition-colors">Enviar via Telegram</button>
            </div>
          )}

          {checkoutStep === 'success' && (
            <div className="text-center py-20 animate-fade-in">
              <div className="bg-green-100 text-green-600 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6"><Check size={40} /></div>
              <h3 className="text-2xl font-bold mb-2 dark:text-white">Pedido Registado!</h3>
              <p className="text-gray-500 dark:text-gray-400">Obrigado pela sua compra. Entraremos em contacto brevemente.</p>
              <button onClick={onClose} className="mt-8 bg-gray-900 dark:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold">Voltar à Loja</button>
            </div>
          )}
        </div>

        {cartItems.length > 0 && checkoutStep !== 'success' && checkoutStep !== 'platform' && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
            <div className="flex justify-between text-gray-500 dark:text-gray-400 text-sm mb-2"><span>Subtotal</span><span>{formatCurrency(total)}</span></div>
            {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400 text-sm mb-2 font-medium"><span>Desconto</span><span>-{formatCurrency(discountAmount)}</span></div>
            )}
            <div className="flex justify-between text-gray-500 dark:text-gray-400 text-sm mb-4"><span>Portes</span><span>{shippingCost === 0 ? 'Grátis' : formatCurrency(shippingCost)}</span></div>
            <div className="flex justify-between text-xl font-black text-gray-900 dark:text-white mb-6 border-t dark:border-gray-800 pt-4"><span>Total</span><span>{formatCurrency(finalTotal)}</span></div>
            <button onClick={handleProceed} className="w-full bg-primary text-white font-bold py-4 rounded-xl text-lg shadow-xl shadow-blue-100 dark:shadow-none hover:scale-[1.02] transition-transform">Continuar Compra</button>
          </div>
        )}
      </div>
    </>
  );
};

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

export default CartDrawer;
