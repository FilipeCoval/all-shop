
import React, { useState, useEffect, useMemo } from 'react';
import { CartItem, UserCheckoutInfo, Order, Coupon, User, OrderItem, StatusHistory } from '../types';
import { X, Trash2, Smartphone, Send, Check, TicketPercent, Loader2, ChevronLeft, Copy, User as UserIcon, LogIn, Award, Coins, AlertCircle, Clock } from 'lucide-react';
import { SELLER_PHONE, TELEGRAM_LINK, STORE_NAME } from '../constants';
import { db } from '../services/firebaseConfig';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (cartItemId: string) => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  total: number;
  onCheckout: (order: Order) => Promise<boolean>;
  user: User | null;
  onOpenLogin: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ 
  isOpen, onClose, cartItems, onRemoveItem, onUpdateQuantity, total, onCheckout, user, onOpenLogin
}) => {
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'login-prompt' | 'info' | 'platform' | 'success'>('cart');
  const [platform, setPlatform] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [isCopied, setIsCopied] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  const [userInfo, setUserInfo] = useState<UserCheckoutInfo>({
    name: '', street: '', doorNumber: '', zip: '', city: '', phone: '', nif: '', paymentMethod: 'MB Way', email: ''
  });

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserCheckoutInfo, string>>>({});

  const SHIPPING_THRESHOLD = 50;
  const SHIPPING_COST = 4.99;
  const COD_FEE = 2.00; 

  // Efeito para o cronómetro de reserva (Apenas se houver itens com reserva ativa)
  useEffect(() => {
    const reservedItem = cartItems.find(i => i.reservedUntil);
    if (!reservedItem || !reservedItem.reservedUntil) {
        setTimeRemaining('');
        return;
    }

    const interval = setInterval(() => {
      const remaining = new Date(reservedItem.reservedUntil!).getTime() - Date.now();
      if (remaining <= 0) {
          setTimeRemaining('Expirada');
          clearInterval(interval);
      } else {
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cartItems]);

  // Efeito para avançar automaticamente após o login
  useEffect(() => {
    if (checkoutStep === 'login-prompt' && user) {
      setCheckoutStep('info');
    }
  }, [user, checkoutStep]);

  useEffect(() => {
    if (!isOpen) {
        // Se fechar, espera a animação para resetar
        setTimeout(() => {
            setCheckoutStep('cart');
            setCurrentOrderId('');
            setDiscount(0);
            setAppliedCoupon(null);
            setCouponCode('');
            setIsFinalizing(false);
            setFormErrors({});
        }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
      if (user && (checkoutStep === 'info' || isOpen)) {
          const firstAddr = user.addresses?.[0];
          setUserInfo(prev => ({ 
              ...prev, 
              name: user.name || '',
              email: user.email || '',
              phone: user.phone || prev.phone,
              nif: user.nif || prev.nif,
              street: firstAddr?.street || prev.street,
              zip: firstAddr?.zip || prev.zip,
              city: firstAddr?.city || prev.city,
          }));
      }
  }, [user, isOpen, checkoutStep]);

  const shippingCost = total >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const paymentFee = userInfo.paymentMethod === 'Cobrança' ? COD_FEE : 0;
  const finalTotal = Math.max(0, total + shippingCost + paymentFee - discount);
  
  const remainingForFreeShipping = SHIPPING_THRESHOLD - total;
  const progressPercentage = (total / SHIPPING_THRESHOLD) * 100;

  const fullAddress = `${userInfo.street}, ${userInfo.doorNumber}, ${userInfo.zip} ${userInfo.city}`;

  const orderMessage = useMemo(() => {
    const itemsList = cartItems.map(item => `• ${item.quantity}x ${item.name} ${item.selectedVariant ? `(${item.selectedVariant})` : ''}`).join('\n');
    return `🛍️ *${STORE_NAME}* - Pedido ${currentOrderId}\n👤 Cliente: ${userInfo.name}\n${userInfo.nif ? `🧾 NIF: ${userInfo.nif}\n` : ''}📍 Morada: ${fullAddress}\n📱 Tel: ${userInfo.phone}\n💳 Pagamento: ${userInfo.paymentMethod}\n\n🛒 Artigos:\n${itemsList}\n\n💰 TOTAL: ${finalTotal.toFixed(2)}€`.trim();
  }, [cartItems, userInfo, finalTotal, currentOrderId, fullAddress]);


  const handleApplyCoupon = async () => {
      const code = couponCode.trim().toUpperCase();
      if (!code) return;
      setIsCheckingCoupon(true);
      setCouponError('');
      try {
          const snapshot = await db.collection('coupons').where('code', '==', code).get();
          if (snapshot.empty) { setCouponError('Cupão inválido.'); return; }
          const couponData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Coupon;
          if (!couponData.isActive) { setCouponError('Expirado.'); return; }
          if (total < couponData.minPurchase) { setCouponError(`Mín. ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(couponData.minPurchase)}`); return; }
          setAppliedCoupon(couponData);
          setDiscount(couponData.type === 'PERCENTAGE' ? total * (couponData.value / 100) : couponData.value);
          setCouponCode('');
      } catch (error) { setCouponError('Erro.'); } finally { setIsCheckingCoupon(false); }
  };
  
  const handleProceedToPlatform = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Partial<Record<keyof UserCheckoutInfo, string>> = {};
    if (!userInfo.name.trim()) newErrors.name = "O nome é obrigatório.";
    if (!userInfo.street.trim()) newErrors.street = "A morada é obrigatória.";
    if (!userInfo.doorNumber.trim()) newErrors.doorNumber = "O nº da porta é obrigatório.";
    if (!userInfo.zip.trim()) {
        newErrors.zip = "O código postal é obrigatório.";
    } else if (!/^\d{4}-\d{3}$/.test(userInfo.zip)) {
        newErrors.zip = "Formato inválido (ex: 1234-567).";
    }
    if (!userInfo.city.trim()) newErrors.city = "A localidade é obrigatória.";
    if (!userInfo.phone.trim()) newErrors.phone = "O telemóvel é obrigatório.";
    if (!user && !userInfo.email.trim()) {
        newErrors.email = "O email é obrigatório para o seguimento.";
    } else if (!user && userInfo.email.trim() && !/\S+@\S+\.\S+/.test(userInfo.email)) {
        newErrors.email = "Formato de email inválido.";
    }

    setFormErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
        const firstErrorKey = Object.keys(newErrors)[0] as keyof UserCheckoutInfo;
        const errorElement = document.querySelector(`[name=${firstErrorKey}]`);
        errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    const orderId = `#AS-${Math.floor(100000 + Math.random() * 900000)}`;
    setCurrentOrderId(orderId);
    setCheckoutStep('platform');
  };

  const createOrderObject = (): Order => {
    return {
        id: currentOrderId,
        date: new Date().toISOString(),
        total: finalTotal,
        status: 'Processamento',
        statusHistory: [{ status: 'Processamento' as const, date: new Date().toISOString() }],
        items: cartItems.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          description: item.description || '',
          quantity: item.quantity,
          selectedVariant: item.selectedVariant || '',
          serialNumbers: [], 
          unitIds: [],
          cartItemId: item.cartItemId,
          addedAt: new Date().toISOString()
        })),
        userId: user?.uid || null,
        shippingInfo: {
            ...userInfo,
            email: (user?.email || userInfo.email).toLowerCase()
        }
    };
  };

  const handleFinalizeOrder = async () => {
      if (isFinalizing) return;
      setIsFinalizing(true);
      
      const newOrder = createOrderObject();
      const success = await onCheckout(newOrder);

      if (success) {
          if (platform === 'whatsapp') {
              window.open(`https://wa.me/${SELLER_PHONE}?text=${encodeURIComponent(orderMessage)}`, '_blank');
          }
          setCheckoutStep('success');
      }
      setIsFinalizing(false);
  };
  
  const handleTelegramCheckout = async () => {
      if (isFinalizing) return;
      setIsFinalizing(true);
      
      const newOrder = createOrderObject();
      const success = await onCheckout(newOrder);

      if (success) {
          window.open(TELEGRAM_LINK, '_blank');
          setCheckoutStep('success');
      }
      setIsFinalizing(false);
  };

  const copyToClipboard = (text: string): boolean => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
    return successful;
  };

  const handleCopyToClipboard = () => {
      const success = copyToClipboard(orderMessage);
      if (success) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      } else {
          alert("Não foi possível copiar a mensagem automaticamente. Por favor, copie o texto manualmente da caixa de texto.");
      }
  };

  const handleGoBack = () => {
      if(checkoutStep === 'platform') setCheckoutStep('info');
      else if (checkoutStep === 'info') user ? setCheckoutStep('cart') : setCheckoutStep('login-prompt');
      else if (checkoutStep === 'login-prompt') setCheckoutStep('cart');
      else setCheckoutStep('cart');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setUserInfo(prev => ({ ...prev, [name]: value }));
      if (formErrors[name as keyof UserCheckoutInfo]) {
          setFormErrors(prev => ({ ...prev, [name]: undefined }));
      }
  };

  return (
    <>
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
              {checkoutStep !== 'cart' && checkoutStep !== 'success' && <button onClick={handleGoBack} className="p-1 hover:bg-gray-100 rounded-full mr-1"><ChevronLeft size={20}/></button>}
              <h2 className="text-xl font-bold text-gray-900">
                {checkoutStep === 'cart' && 'O seu Carrinho'}
                {checkoutStep === 'login-prompt' && 'Identificação'}
                {checkoutStep === 'info' && 'Dados de Envio'}
                {checkoutStep === 'platform' && 'Confirmar Pedido'}
                {checkoutStep === 'success' && 'Pedido Registado!'}
              </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {checkoutStep === 'cart' && (
                <div className="space-y-4">
                    {/* AVISO DE RESERVA ATIVA */}
                    {cartItems.some(i => i.reservedUntil) && (
                        <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex items-center gap-3 animate-pulse">
                            <Clock className="text-orange-600" size={18} />
                            <div>
                                <p className="text-xs text-orange-800 font-bold">RESERVA ATIVA: {timeRemaining} min</p>
                                <p className="text-[10px] text-orange-700">Stock garantido para si. Finalize antes que o tempo acabe!</p>
                            </div>
                        </div>
                    )}

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
                                    <div className="text-right">
                                        <span className="font-bold">{(item.price * item.quantity).toFixed(2)}€</span>
                                        {item.reservedUntil && <span className="block text-[9px] text-orange-500 font-bold uppercase mt-1">Reservado</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {cartItems.length === 0 && <div className="text-center py-20 text-gray-400">Carrinho vazio</div>}
                </div>
            )}

            {checkoutStep === 'login-prompt' && (
                <div className="p-4 space-y-6 text-center animate-fade-in">
                    <UserIcon size={48} className="mx-auto text-primary" />
                    <h3 className="text-2xl font-bold">Como deseja continuar?</h3>
                    <button onClick={onOpenLogin} className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"><LogIn size={20}/> Entrar na minha conta</button>
                    <button onClick={() => setCheckoutStep('info')} className="text-gray-600 font-bold hover:underline">Continuar como convidado</button>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-6 text-left">
                        <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2"><Award size={18} className="text-yellow-500"/> Vantagens de criar conta:</h4>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-center gap-2"><Coins size={14} className="text-primary"/> Acumule <strong>AllPoints</strong> para descontos.</li>
                            <li className="flex items-center gap-2"><Check size={14} className="text-green-500"/> Checkout mais rápido no futuro.</li>
                            <li className="flex items-center gap-2"><UserIcon size={14} className="text-gray-500"/> Aceda ao seu histórico de compras.</li>
                        </ul>
                    </div>
                </div>
            )}

            {checkoutStep === 'info' && (
                <form id="infoForm" noValidate onSubmit={handleProceedToPlatform} className="space-y-4 animate-fade-in">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                        <div>
                            <input type="text" name="name" placeholder="Nome Completo" value={userInfo.name} onChange={handleInputChange} className={`w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-colors ${formErrors.name ? 'border-red-500 ring-red-500/20' : 'border-gray-200'}`} />
                            {formErrors.name && <p className="text-red-600 text-xs mt-1 px-1">{formErrors.name}</p>}
                        </div>
                        {!user && <div>
                            <input type="email" name="email" placeholder="Email (para receber o estado)" value={userInfo.email} onChange={handleInputChange} className={`w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-colors ${formErrors.email ? 'border-red-500 ring-red-500/20' : 'border-gray-200'}`} />
                            {formErrors.email && <p className="text-red-600 text-xs mt-1 px-1">{formErrors.email}</p>}
                        </div>}
                        <div>
                            <input type="tel" name="phone" placeholder="Telemóvel" value={userInfo.phone} onChange={handleInputChange} className={`w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-colors ${formErrors.phone ? 'border-red-500 ring-red-500/20' : 'border-gray-200'}`} />
                            {formErrors.phone && <p className="text-red-600 text-xs mt-1 px-1">{formErrors.phone}</p>}
                        </div>
                        <div>
                            <input type="text" name="nif" placeholder="NIF (Opcional, para fatura)" value={userInfo.nif} onChange={handleInputChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        
                        <div className="pt-2 border-t border-gray-100 space-y-4">
                           <div>
                              <input type="text" name="street" placeholder="Rua / Avenida" value={userInfo.street} onChange={handleInputChange} className={`w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary mt-2 transition-colors ${formErrors.street ? 'border-red-500 ring-red-500/20' : 'border-gray-200'}`} />
                              {formErrors.street && <p className="text-red-600 text-xs mt-1 px-1">{formErrors.street}</p>}
                           </div>
                            <div className="flex gap-4">
                                <div className="w-1/3">
                                    <input type="text" name="doorNumber" placeholder="Nº Porta" value={userInfo.doorNumber} onChange={handleInputChange} className={`w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-colors ${formErrors.doorNumber ? 'border-red-500 ring-red-500/20' : 'border-gray-200'}`} />
                                    {formErrors.doorNumber && <p className="text-red-600 text-xs mt-1 px-1">{formErrors.doorNumber}</p>}
                                </div>
                                <div className="flex-1">
                                    <input type="text" name="zip" placeholder="Código Postal" pattern="\d{4}-\d{3}" title="Formato: 1234-567" value={userInfo.zip} onChange={handleInputChange} className={`w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-colors ${formErrors.zip ? 'border-red-500 ring-red-500/20' : 'border-gray-200'}`} />
                                    {formErrors.zip && <p className="text-red-600 text-xs mt-1 px-1">{formErrors.zip}</p>}
                                </div>
                            </div>
                            <div>
                                <input type="text" name="city" placeholder="Localidade / Cidade" value={userInfo.city} onChange={handleInputChange} className={`w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-primary transition-colors ${formErrors.city ? 'border-red-500 ring-red-500/20' : 'border-gray-200'}`} />
                                {formErrors.city && <p className="text-red-600 text-xs mt-1 px-1">{formErrors.city}</p>}
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-gray-100">
                            {(['MB Way', 'Transferência', 'Cobrança'] as const).map(m => (
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

                    {platform === 'telegram' && (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-200 space-y-4">
                            <h4 className="font-bold text-blue-900 text-center">Passos para Telegram:</h4>
                            <p className="text-xs text-gray-500 text-center -mt-2">Siga estes 2 passos para garantir que o seu pedido é enviado corretamente.</p>
                            
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500">Passo 1: Copie a sua encomenda</label>
                                <textarea readOnly value={orderMessage} className="w-full h-32 p-2 text-xs font-mono bg-gray-50 border rounded-lg" />
                                <button onClick={handleCopyToClipboard} className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                                    {isCopied ? <><Check size={16}/> Copiado!</> : <><Copy size={16}/> Copiar Mensagem</>}
                                </button>
                            </div>
                            
                            <button onClick={handleTelegramCheckout} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                                <Send size={16}/> Passo 2: Abrir Telegram para Colar
                            </button>
                        </div>
                    )}
                </div>
            )}

            {checkoutStep === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-fade-in-up">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 shadow-inner">
                        <Check size={48} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido Registado!</h2>
                    <p className="text-gray-500 mb-6 max-w-xs">
                        A sua encomenda <strong>{currentOrderId}</strong> foi registada com sucesso na nossa base de dados.
                    </p>
                    <div className="bg-white p-4 rounded-xl border border-green-100 text-left w-full shadow-sm mb-6">
                        <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2"><Smartphone size={16}/> Próximos Passos:</h4>
                        <ul className="text-sm text-gray-600 space-y-2">
                            <li>1. Se ainda não enviou a mensagem na App, faça-o agora.</li>
                            <li>2. A nossa equipa irá confirmar o stock e dados de pagamento.</li>
                            <li>3. Irá receber o tracking assim que for enviado.</li>
                        </ul>
                    </div>
                    <button onClick={onClose} className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg">
                        Voltar à Loja
                    </button>
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

            {checkoutStep !== 'success' && (
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
            )}

            {checkoutStep === 'cart' ? (
                 <>
                    <div className="mb-4">
                      <div className="flex gap-2">
                        <input type="text" value={couponCode} onChange={e=>setCouponCode(e.target.value)} placeholder="Código do Cupão" className="flex-1 px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                        <button onClick={handleApplyCoupon} disabled={isCheckingCoupon} className="bg-gray-800 text-white px-4 rounded-lg font-bold text-sm disabled:opacity-50">{isCheckingCoupon ? <Loader2 className="animate-spin" /> : 'Aplicar'}</button>
                      </div>
                      {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
                    </div>
                    <button onClick={() => cartItems.length > 0 && (user ? setCheckoutStep('info') : setCheckoutStep('login-prompt'))} disabled={cartItems.length === 0} className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50">Continuar Compra</button>
                 </>
            ) : checkoutStep === 'info' ? (
                <button form="infoForm" type="submit" className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg">Seguinte</button>
            ) : checkoutStep === 'platform' && platform === 'whatsapp' ? (
                <button onClick={handleFinalizeOrder} disabled={isFinalizing} className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 text-white bg-green-600">
                    {isFinalizing ? <Loader2 className="animate-spin" /> : <Send />} Finalizar no WhatsApp
                </button>
            ) : null}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
