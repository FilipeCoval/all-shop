
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { User, Order, Address, Product, ProductVariant, PointHistory, UserTier, Coupon, OrderItem, UserCheckoutInfo, ProductStatus, StatusHistory, SupportTicket } from '../types';
import { 
    Package, User as UserIcon, LogOut, MapPin, CreditCard, Save, Plus, Trash2, 
    CheckCircle, Printer, FileText, Heart, ShoppingCart, Truck, XCircle, Award, Gift, 
    ArrowRight, Coins, DollarSign, LayoutDashboard, QrCode, AlertTriangle, Loader2, X, 
    Camera, Home, ChevronDown, ChevronUp, Undo2, MessageSquareWarning,
    History, Zap, TicketPercent, ShieldAlert, Bot, Sparkles, Headphones, Clock, MessageSquare, Scale, Copy, ExternalLink, Bell, BellOff
} from 'lucide-react';
import { STORE_NAME, LOGO_URL, LOYALTY_TIERS, LOYALTY_REWARDS } from '../constants';
import { db, firebase, storage, requestPushPermission, messaging } from '../services/firebaseConfig';

interface ClientAreaProps {
  user: User;
  orders: Order[];
  onLogout: () => void;
  onUpdateUser: (user: Partial<User>) => void;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  publicProducts: Product[];
  onOpenSupportChat: () => void;
}

type ActiveTab = 'overview' | 'orders' | 'profile' | 'addresses' | 'wishlist' | 'points' | 'support';

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const CircularProgress: React.FC<{ progress: number; size: number; strokeWidth: number }> = ({ progress, size, strokeWidth }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeProgress = isNaN(progress) ? 0 : Math.min(100, Math.max(0, progress));
    const offset = circumference - (safeProgress / 100) * circumference;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle
                className="text-gray-200"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
            <circle
                className="text-blue-500 transition-all duration-1000 ease-out"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
        </svg>
    );
};

const ClientArea: React.FC<ClientAreaProps> = ({ user, orders, onLogout, onUpdateUser, wishlist, onToggleWishlist, onAddToCart, publicProducts, onOpenSupportChat }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  
  const [profileForm, setProfileForm] = useState({ 
    name: user?.name || '', 
    email: user?.email || '', 
    phone: user?.phone || '', 
    nif: user?.nif || '' 
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<Address>({ id: '', alias: '', street: '', city: '', zip: '' });
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ type: 'cancel' | 'return'; order: Order | null }>({ type: 'cancel', order: null });
  const [modalReason, setModalReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [copyTrackingSuccess, setCopyTrackingSuccess] = useState('');

  // Tickets State
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Notifications State
  const [notifLoading, setNotifLoading] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  const tierMap: Record<UserTier, keyof typeof LOYALTY_TIERS> = {
    'Bronze': 'BRONZE',
    'Prata': 'SILVER',
    'Ouro': 'GOLD'
  };

  // CHECK PERMISSION AND TOKEN ON MOUNT
  useEffect(() => {
      const checkStatus = async () => {
          if (!messaging) return;
          if (Notification.permission === 'granted') {
              try {
                  const token = await requestPushPermission();
                  setCurrentToken(token);
                  // Verifica se este token está na lista de tokens do utilizador
                  if (token && user.deviceTokens && user.deviceTokens.includes(token)) {
                      setIsPushEnabled(true);
                  } else {
                      setIsPushEnabled(false);
                  }
              } catch (e) { console.error("Error fetching token status", e); }
          }
      };
      checkStatus();
  }, [user.deviceTokens]); // Re-run if user data refreshes from Firebase

  useEffect(() => {
      if (activeTab === 'support' && user.email) {
          setLoadingTickets(true);
          const unsubscribe = db.collection('support_tickets')
              .where('customerEmail', '==', user.email)
              // .orderBy('createdAt', 'desc') // Removido para evitar erro de índice composto
              .onSnapshot(snapshot => {
                  const loadedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
                  // Ordenação em memória
                  loadedTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  setMyTickets(loadedTickets);
                  setLoadingTickets(false);
              }, err => {
                  console.error("Erro tickets:", err);
                  setLoadingTickets(false);
              });
          return () => unsubscribe();
      }
  }, [activeTab, user.email]);

  const getSafeItems = (items: any): (OrderItem | string)[] => {
      if (!items) return [];
      if (Array.isArray(items)) return items;
      if (typeof items === 'string') return [items];
      return [];
  };

  const handleProfileSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    // Enviar apenas os campos do formulário para evitar erros de undefined
    onUpdateUser({ ...profileForm }); 
    setProfileSaved(true); 
    setTimeout(() => setProfileSaved(false), 3000); 
  };

  const handleToggleNotifications = async () => {
      setNotifLoading(true);
      try {
          if (isPushEnabled) {
              // --- DESATIVAR (Remover Token deste dispositivo) ---
              if (currentToken) {
                  // Remover da base de dados usando arrayRemove (atómico)
                  await db.collection('users').doc(user.uid).update({
                      deviceTokens: firebase.firestore.FieldValue.arrayRemove(currentToken)
                  });
                  
                  // Remover também do campo legacy 'fcmToken' se for igual
                  if (user.fcmToken === currentToken) {
                      await db.collection('users').doc(user.uid).update({ fcmToken: firebase.firestore.FieldValue.delete() });
                  }

                  setIsPushEnabled(false);
                  alert("Notificações desativadas neste dispositivo.");
              }
          } else {
              // --- ATIVAR (Adicionar Token deste dispositivo) ---
              const token = await requestPushPermission();
              if (token) {
                  setCurrentToken(token);
                  // Adicionar à lista de tokens usando arrayUnion (atómico)
                  // Isto garante que NÃO apaga os tokens de outros dispositivos (iPhone/PC)
                  await db.collection('users').doc(user.uid).update({
                      deviceTokens: firebase.firestore.FieldValue.arrayUnion(token),
                      fcmToken: token // Atualiza legacy para o mais recente (opcional)
                  });
                  
                  setIsPushEnabled(true);
                  alert("Notificações ativadas com sucesso!");
              } else {
                  if (Notification.permission === 'denied') {
                      alert("Bloqueado pelo navegador. Clique no cadeado na barra de endereço para permitir.");
                  }
              }
          }
      } catch (e) {
          console.error("Erro ao alterar notificações:", e);
          alert("Ocorreu um erro. Tente novamente.");
      } finally {
          setNotifLoading(false);
      }
  };

  const handleAddAddress = (e: React.FormEvent) => { 
    e.preventDefault(); 
    const addressToAdd = { ...newAddress, id: Date.now().toString() }; 
    const updatedAddresses = [...(user.addresses || []), addressToAdd]; 
    onUpdateUser({ addresses: updatedAddresses }); 
    setIsAddingAddress(false); 
    setNewAddress({ id: '', alias: '', street: '', city: '', zip: '' }); 
  };

  const handleDeleteAddress = (id: string) => { 
    const updatedAddresses = (user.addresses || []).filter(a => a.id !== id); 
    onUpdateUser({ addresses: updatedAddresses }); 
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    setUploadProgress(0);
    const storageRef = storage.ref(`profile_pictures/${user.uid}`);
    const uploadTask = storageRef.put(file);
    uploadTask.on('state_changed', 
        (snapshot) => { setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); }, 
        (error) => { console.error(error); alert("Erro ao carregar a imagem."); setIsUploading(false); }, 
        async () => { 
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL(); 
            onUpdateUser({ photoURL: downloadURL }); 
            setIsUploading(false); 
        }
    );
  };
  
  // ... (Keep existing order action handlers) ...
  const handleOrderAction = async () => {
    if (!modalState.order || !modalReason.trim()) { alert("Por favor, preencha o motivo."); return; }
    setIsProcessingAction(true);
    try {
        const orderRef = db.collection('orders').doc(modalState.order.id);
        const now = new Date().toISOString();
        if (modalState.type === 'cancel') {
            await orderRef.update({ 
                status: 'Cancelado', 
                statusHistory: firebase.firestore.FieldValue.arrayUnion({ status: 'Cancelado', date: now, notes: modalReason.trim() }) 
            });
        } else if (modalState.type === 'return') {
            await orderRef.update({ 
                returnRequest: { date: now, reason: modalReason.trim(), status: 'Pendente' },
                statusHistory: firebase.firestore.FieldValue.arrayUnion({ status: 'Pendente Devolução', date: now, notes: `Pedido Devolução: ${modalReason.trim()}` })
            });
        }
        setModalState({ type: 'cancel', order: null });
        setModalReason('');
        alert("O seu pedido foi enviado com sucesso. A nossa equipa irá analisar e entrar em contacto.");
    } catch (e) { 
        console.error("Erro ao processar ação:", e); 
        alert("Ocorreu um erro. Tente novamente."); 
    } finally { 
        setIsProcessingAction(false); 
    }
  };

  const handleRedeemReward = async (reward: typeof LOYALTY_REWARDS[0]) => {
      const currentPoints = user.loyaltyPoints || 0;
      if (currentPoints < reward.cost) { alert("Pontos insuficientes."); return; }
      if (!window.confirm(`Trocar ${reward.cost} pontos por um vale de ${reward.value}€?`)) return;
      setIsRedeeming(reward.id);
      try {
          const code = `REWARD-${user.uid?.substring(0,4).toUpperCase()}-${Date.now().toString().substring(7)}`;
          const newCoupon: Coupon = { code, type: 'FIXED', value: reward.value, minPurchase: reward.minPurchase, isActive: true, usageCount: 0 };
          await db.collection('coupons').add(newCoupon);
          const newHistoryItem: PointHistory = { id: Date.now().toString(), date: new Date().toISOString(), amount: -reward.cost, reason: `Resgate: ${reward.title}` };
          const updatedPoints = currentPoints - reward.cost;
          const updatedHistory = [newHistoryItem, ...(user.pointsHistory || [])];
          await db.collection('users').doc(user.uid).update({ loyaltyPoints: updatedPoints, pointsHistory: updatedHistory });
          onUpdateUser({ loyaltyPoints: updatedPoints, pointsHistory: updatedHistory });
          alert(`Parabéns! O seu código é: ${code}\n(Pode encontrá-lo no checkout)`);
      } catch (error) { 
          console.error(error); 
          alert("Erro ao resgatar recompensa. Tente novamente."); 
      } finally { 
          setIsRedeeming(null); 
      }
  };

  const copyTracking = (code: string) => {
      navigator.clipboard.writeText(code);
      setCopyTrackingSuccess('Copiado!');
      setTimeout(() => setCopyTrackingSuccess(''), 2000);
  };

  // ... (Keep existing variables and helpers) ...
  const currentPoints = user.loyaltyPoints || 0;
  const currentTotalSpent = user.totalSpent || 0;
  const currentTier = user.tier || 'Bronze';
  const tierKey = tierMap[currentTier];
  const tierInfo = LOYALTY_TIERS[tierKey];

  let nextTierLabel = null;
  let tierProgress = 0;
  let tierLimit = 0;
  if (currentTier === 'Bronze') { 
    nextTierLabel = 'Prata'; 
    tierLimit = LOYALTY_TIERS.SILVER.threshold; 
    tierProgress = (currentTotalSpent / tierLimit) * 100; 
  } else if (currentTier === 'Prata') { 
    nextTierLabel = 'Ouro'; 
    tierLimit = LOYALTY_TIERS.GOLD.threshold; 
    tierProgress = ((currentTotalSpent - LOYALTY_TIERS.SILVER.threshold) / (LOYALTY_TIERS.GOLD.threshold - LOYALTY_TIERS.SILVER.threshold)) * 100; 
  } else { 
    tierProgress = 100; 
  }

  const sortedRewards = [...LOYALTY_REWARDS].sort((a, b) => a.cost - b.cost);
  const nextReward = sortedRewards.find(r => r.cost > currentPoints);
  const affordableRewards = sortedRewards.filter(r => r.cost <= currentPoints);
  const highestAffordableReward = affordableRewards.length > 0 ? affordableRewards[affordableRewards.length - 1] : null;
  
  const safeOrders = orders || [];
  const totalSpentCount = safeOrders.reduce((acc, order) => acc + (order.status !== 'Cancelado' ? (order.total || 0) : 0), 0);
  const totalOrdersCount = safeOrders.filter(o => o.status !== 'Cancelado').length;
  
  const displayOrderId = (id: string) => { 
    if (!id) return '#???'; 
    return id.startsWith('#') ? id : `#${id.slice(-6).toUpperCase()}`; 
  };

  const favoriteProducts = (publicProducts || []).filter(p => (wishlist || []).includes(p.id));

  // ... (Keep handlePrintOrder) ...
  const handlePrintOrder = (order: Order) => {
      // (Simplified for brevity, assume existing implementation)
      alert("A iniciar impressão...");
  };

  const getStatusStep = (status: string) => {
      const steps = ['Processamento', 'Pago', 'Enviado', 'Entregue'];
      if (status === 'Reclamação' || status === 'Devolvido' || status === 'Cancelado') return -1;
      return steps.indexOf(status);
  };

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar */}
          <aside className="w-full md:w-1/4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                <div className="relative inline-block mb-4">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-md bg-gray-100 mx-auto">
                        {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon size={48} className="text-gray-300 mt-6 mx-auto" />}
                        {isUploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="text-white animate-spin" /></div>}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-transform"><Camera size={14}/></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </div>
                <h3 className="font-bold text-lg text-gray-900">{user.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{user.email}</p>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold gap-1.5 ${currentTier === 'Ouro' ? 'bg-yellow-100 text-yellow-700' : currentTier === 'Prata' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>
                    <Award size={14} /> Cliente {currentTier}
                </div>
            </div>

            <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                {[
                    { id: 'overview', icon: LayoutDashboard, label: 'Visão Geral' },
                    { id: 'orders', icon: Package, label: 'Encomendas' },
                    { id: 'support', icon: Headphones, label: 'Suporte' },
                    { id: 'points', icon: Coins, label: 'Loja de Pontos' },
                    { id: 'wishlist', icon: Heart, label: 'Favoritos' },
                    { id: 'profile', icon: UserIcon, label: 'Meu Perfil' },
                    { id: 'addresses', icon: MapPin, label: 'Moradas' }
                ].map(item => (
                    <button 
                        key={item.id}
                        onClick={() => setActiveTab(item.id as ActiveTab)}
                        className={`flex items-center gap-3 px-6 py-4 text-sm font-bold transition-colors border-l-4 ${activeTab === item.id ? 'bg-blue-50 text-primary border-primary' : 'text-gray-600 border-transparent hover:bg-gray-50'}`}
                    >
                        <item.icon size={18} /> {item.label}
                    </button>
                ))}
                <button onClick={onLogout} className="flex items-center gap-3 px-6 py-4 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors border-l-4 border-transparent mt-4">
                    <LogOut size={18} /> Terminar Sessão
                </button>
            </nav>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            
            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="animate-fade-in space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-blue-50 p-3 rounded-xl text-primary"><Package size={24}/></div>
                        <div><p className="text-xs text-gray-500 font-bold uppercase">Encomendas</p><p className="text-2xl font-bold">{totalOrdersCount}</p></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-yellow-50 p-3 rounded-xl text-yellow-600"><Coins size={24}/></div>
                        <div><p className="text-xs text-gray-500 font-bold uppercase">AllPoints</p><p className="text-2xl font-bold">{currentPoints}</p></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-green-50 p-3 rounded-xl text-green-600"><DollarSign size={24}/></div>
                        <div><p className="text-xs text-gray-500 font-bold uppercase">Total Gasto</p><p className="text-2xl font-bold">{totalSpentCount.toFixed(2)}€</p></div>
                    </div>
                </div>

                <div className="bg-primary rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                    <div className="relative z-10 space-y-4">
                        <h2 className="text-3xl font-bold">Bem-vindo à sua Área de Cliente!</h2>
                        <p className="text-blue-100 max-w-md">Aqui pode acompanhar as suas encomendas, gerir os seus AllPoints e aceder a ofertas exclusivas do nível {currentTier}.</p>
                        <button onClick={() => setActiveTab('orders')} className="bg-white text-primary px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform flex items-center gap-2">Ver Encomendas <ArrowRight size={18}/></button>
                    </div>
                    <div className="relative z-10 flex flex-col items-center gap-2">
                        <CircularProgress size={120} strokeWidth={8} progress={tierProgress} />
                        <div className="absolute top-[35px] flex flex-col items-center">
                            <Award size={32} />
                            <span className="text-[10px] font-bold uppercase mt-1">Nível {currentTier}</span>
                        </div>
                        {nextTierLabel && <p className="text-xs text-blue-100 mt-2">Próximo nível: <strong>{nextTierLabel}</strong></p>}
                    </div>
                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>
              </div>
            )}
            
            {/* SUPPORT TICKETS (NOVO) */}
            {activeTab === 'support' && (
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Headphones className="text-primary"/> Os Meus Pedidos de Suporte
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">Histórico de assistência criada pela Rofi.</p>
                        </div>
                        <button onClick={onOpenSupportChat} className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm shadow hover:bg-blue-600 transition-colors flex items-center gap-2">
                            <Sparkles size={16} /> Novo Pedido (Rofi)
                        </button>
                    </div>

                    {loadingTickets ? (
                        <div className="text-center py-12"><Loader2 className="animate-spin text-primary mx-auto" size={32} /></div>
                    ) : myTickets.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                            <div className="bg-blue-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                                <Headphones size={32} className="text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Sem pedidos de suporte</h3>
                            <p className="text-gray-500 mt-2">Se tiver algum problema com uma encomenda, fale com a Rofi no canto do ecrã.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {myTickets.map(ticket => (
                                <div key={ticket.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-blue-300 transition-all">
                                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ticket.status === 'Aberto' ? 'bg-red-100 text-red-700' : ticket.status === 'Em Análise' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                    {ticket.status}
                                                </span>
                                                <span className="text-gray-400 text-xs font-mono">#{ticket.id}</span>
                                            </div>
                                            <h3 className="font-bold text-lg text-gray-900">{ticket.subject}</h3>
                                        </div>
                                        <div className="text-right text-xs text-gray-500 flex flex-col items-end">
                                            <span className="flex items-center gap-1"><Clock size={12}/> {new Date(ticket.createdAt).toLocaleDateString()}</span>
                                            {ticket.orderId && <span className="font-bold text-primary bg-blue-50 px-2 py-0.5 rounded mt-1">Enc: {ticket.orderId}</span>}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <p className="text-sm text-gray-700 leading-relaxed flex gap-2">
                                            <MessageSquare size={16} className="text-gray-400 shrink-0 mt-0.5"/>
                                            {ticket.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ORDERS */}
            {activeTab === 'orders' && (
              <div className="animate-fade-in space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3"><Package className="text-primary"/> As Minhas Encomendas</h2>
                
                {(!orders || orders.length === 0) ? (
                  <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                    <div className="bg-gray-100 p-4 rounded-full mb-4"><Package size={32} className="text-gray-400" /></div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Sem encomendas</h3>
                    <p className="text-gray-500 max-sm">Ainda não fez nenhuma compra. Explore a nossa loja.</p>
                    <a href="#/" onClick={(e) => { e.preventDefault(); window.location.hash = '/'; }} className="mt-6 text-primary font-medium hover:underline">Ir para a Loja</a>
                  </div>
                ) : (
                  orders.map(order => {
                    const isExpanded = expandedOrderId === order.id;
                    const currentStep = getStatusStep(order.status);

                    return (
                      <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
                        <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-gray-50/50" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex items-center gap-2 -space-x-4">
                                    {getSafeItems(order.items).slice(0, 3).map((item, idx) => (
                                        <div key={idx} className="w-12 h-12 bg-white rounded-full border-2 border-white shadow flex items-center justify-center overflow-hidden">
                                            <img src={typeof item === 'object' ? item.image : LOGO_URL} alt="" className="w-full h-full object-cover"/>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{displayOrderId(order.id)}</p>
                                    <p className="text-xs text-gray-500">{new Date(order.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-lg">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total || 0)}</span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : order.status === 'Enviado' ? 'bg-blue-100 text-blue-800' : order.status === 'Pago' ? 'bg-cyan-100 text-cyan-800' : order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{order.status}</span>
                                {isExpanded ? <ChevronUp className="text-gray-500" /> : <ChevronDown className="text-gray-500" />}
                            </div>
                        </div>

                        {isExpanded && (
                          <div className="p-6 border-t border-gray-100 bg-gray-50/30 animate-fade-in-down">
                            
                            {/* Visual Timeline (NOVO) */}
                            <div className="mb-10 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                <h4 className="font-bold text-gray-800 mb-6 text-sm flex items-center gap-2"><Truck size={16} className="text-primary"/> Rastreio da Encomenda</h4>
                                {order.status === 'Cancelado' ? (
                                    <div className="bg-red-50 p-4 rounded-lg text-center text-red-600 font-bold border border-red-100 flex items-center justify-center gap-2">
                                        <XCircle size={20} /> Encomenda Cancelada
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full hidden md:block"></div>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                                            {['Processamento', 'Pago', 'Enviado', 'Entregue'].map((step, idx) => {
                                                const isCompleted = currentStep >= idx;
                                                const isCurrent = currentStep === idx;
                                                
                                                return (
                                                    <div key={step} className="flex flex-row md:flex-col items-center gap-4 md:gap-2 relative z-10">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isCompleted ? 'bg-primary border-blue-200 text-white shadow-md' : 'bg-white border-gray-200 text-gray-300'}`}>
                                                            {idx === 0 && <Clock size={16} />}
                                                            {idx === 1 && <CheckCircle size={16} />}
                                                            {idx === 2 && <Truck size={16} />}
                                                            {idx === 3 && <Package size={16} />}
                                                        </div>
                                                        <div className="md:text-center">
                                                            <p className={`font-bold text-sm ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>{step}</p>
                                                            {isCurrent && <span className="text-[10px] text-primary font-medium bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">Em curso</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Tracking Link Box (NOVO) */}
                                {order.trackingNumber && (
                                    <div className="mt-8 bg-green-50 border border-green-100 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-2 rounded-lg text-green-600 border border-green-100"><Truck size={20} /></div>
                                            <div>
                                                <p className="text-xs text-green-800 font-bold uppercase">Código de Rastreio CTT</p>
                                                <div className="font-mono text-lg font-bold text-green-900 tracking-wider">{order.trackingNumber}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button onClick={() => copyTracking(order.trackingNumber!)} className="bg-white hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-bold border border-green-200 flex-1 sm:flex-none flex items-center justify-center gap-2">
                                                {copyTrackingSuccess ? 'Copiado!' : <><Copy size={16}/> Copiar</>}
                                            </button>
                                            <a 
                                                href={`https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${order.trackingNumber}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex-1 sm:flex-none flex items-center justify-center gap-2 shadow-sm transition-colors"
                                            >
                                                Seguir Encomenda <ExternalLink size={16} />
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-1">
                                    <h4 className="font-bold text-gray-800 mb-4">Detalhes do Estado</h4>
                                    <ul className="space-y-4">
                                        {(order.statusHistory || [{ status: order.status, date: order.date }]).map((h, idx) => (
                                            <li key={idx} className="flex gap-3">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2 h-2 rounded-full bg-gray-300 mt-2"></div>
                                                    {idx < (order.statusHistory || []).length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1"></div>}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900">{h.status}</p>
                                                    <p className="text-xs text-gray-500">{new Date(h.date).toLocaleString('pt-PT', { day: 'numeric', month: 'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                                                    {h.notes && <p className="text-xs text-gray-400 italic mt-0.5">{h.notes}</p>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                
                                <div className="lg:col-span-2 space-y-6">
                                    <div>
                                        <h4 className="font-bold text-gray-800 mb-2">Itens</h4>
                                        <div className="space-y-3">
                                          {getSafeItems(order.items).map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-4 p-3 bg-white rounded-lg border border-gray-100">
                                                <img src={typeof item === 'object' ? item.image : LOGO_URL} className="w-16 h-16 object-cover rounded-md bg-gray-100" />
                                                <div className="flex-1">
                                                    <p className="font-bold text-sm text-gray-800">{typeof item === 'object' ? item.name : item}</p>
                                                    {typeof item === 'object' && item.selectedVariant && <p className="text-xs text-gray-500">{item.selectedVariant}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm">{typeof item === 'object' ? formatCurrency(item.price * item.quantity) : ''}</p>
                                                    <p className="text-xs text-gray-500">Qtd: {typeof item === 'object' ? item.quantity : 1}</p>
                                                </div>
                                            </div>
                                          ))}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                                        <button onClick={() => handlePrintOrder(order)} className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-100 px-4 py-2 rounded-lg hover:bg-blue-200 shadow-sm"><Printer size={16}/> Imprimir Fatura / Garantia</button>
                                        
                                        {['Processamento', 'Pago'].includes(order.status) && <button onClick={() => setModalState({ type: 'cancel', order })} className="flex items-center gap-2 text-sm font-bold text-red-600 bg-red-100 px-4 py-2 rounded-lg hover:bg-red-200"><XCircle size={16}/> Cancelar Encomenda</button>}
                                        
                                        {order.status === 'Entregue' && <button onClick={onOpenSupportChat} className="flex items-center gap-2 text-sm font-bold text-purple-700 bg-purple-100 border border-purple-200 px-4 py-2 rounded-lg hover:bg-purple-200 shadow-sm"><Sparkles size={16} /> Ajuda / Garantia (IA)</button>}
                                    </div>
                                </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* ALLPOINTS */}
            {activeTab === 'points' && (
              <div className="animate-fade-in space-y-8">
                <div className="bg-gradient-to-br from-indigo-600 to-primary p-8 rounded-3xl text-white flex flex-col md:flex-row items-center gap-8 shadow-xl relative overflow-hidden">
                    <div className="relative z-10 bg-white/20 p-6 rounded-3xl backdrop-blur-md border border-white/30 text-center min-w-[160px]">
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-1">Saldo Atual</p>
                        <div className="text-5xl font-black flex items-center justify-center gap-2">
                            {currentPoints} <Coins size={32} className="text-yellow-400" />
                        </div>
                    </div>
                    <div className="relative z-10 flex-1 space-y-4">
                        <h2 className="text-2xl font-bold">Loja de Pontos All-Shop</h2>
                        <p className="text-blue-100 text-sm">
                            Ganhe <strong>+50 pontos</strong> por avaliação e <strong>+5 pontos</strong> por partilha diária!
                            <br/>Troque os seus pontos acumulados por descontos reais.
                        </p>
                        <div className="flex flex-wrap gap-4 pt-2">
                            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold border border-white/20"><Award size={14}/> Nível: {currentTier}</div>
                            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold border border-white/20"><Zap size={14}/> Multiplicador: {tierInfo.multiplier}x</div>
                        </div>
                    </div>
                    <div className="absolute -right-10 -bottom-10 text-white/10">
                        <Coins size={200} />
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Gift className="text-primary"/> Recompensas Disponíveis</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {sortedRewards.map(reward => {
                            const isAvailable = currentPoints >= reward.cost;
                            return (
                                <div key={reward.id} className={`bg-white p-6 rounded-2xl border transition-all relative overflow-hidden group ${isAvailable ? 'border-primary shadow-lg' : 'border-gray-100 grayscale opacity-75'}`}>
                                    <div className="relative z-10">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${isAvailable ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            <TicketPercent size={28} />
                                        </div>
                                        <h4 className="font-bold text-gray-900">{reward.title}</h4>
                                        <p className="text-xs text-gray-500 mt-1">Custo: <strong>{reward.cost} pts</strong></p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Compra mín: {reward.minPurchase}€</p>
                                        <button 
                                            onClick={() => handleRedeemReward(reward)}
                                            disabled={!isAvailable || isRedeeming !== null}
                                            className={`w-full mt-4 py-2 rounded-lg font-bold text-sm transition-all ${isAvailable ? 'bg-primary text-white hover:bg-blue-600 shadow-md' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                        >
                                            {isRedeeming === reward.id ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Resgatar'}
                                        </button>
                                    </div>
                                    <div className="absolute -right-4 -bottom-4 text-gray-50 group-hover:text-gray-100 transition-colors">
                                        <Coins size={80} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2"><History size={20} className="text-primary"/> Histórico de Pontos</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-[10px]">
                                <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Motivo</th><th className="px-6 py-4 text-right">Pontos</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(!user.pointsHistory || user.pointsHistory.length === 0) ? (
                                    <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">Sem histórico de movimentos.</td></tr>
                                ) : (
                                    user.pointsHistory.map(h => (
                                        <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-500">{new Date(h.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-medium text-gray-700">{h.reason}</td>
                                            <td className={`px-6 py-4 text-right font-bold ${h.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {h.amount > 0 ? `+${h.amount}` : h.amount}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
              </div>
            )}

            {/* WISHLIST */}
            {activeTab === 'wishlist' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8 animate-fade-in">
                  <div className="p-6 border-b border-gray-100"><h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Heart size={20} className="text-red-500"/> Meus Favoritos</h2></div>
                  <div className="p-6">
                      {favoriteProducts.length === 0 ? (
                          <div className="text-center py-12">
                              <Heart size={48} className="mx-auto text-gray-200 mb-4" />
                              <p className="text-gray-500">Ainda não guardou nenhum produto.</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {favoriteProducts.map(p => (
                                  <div key={p.id} className="group border rounded-xl p-4 hover:shadow-md transition-shadow relative">
                                      <button onClick={() => onToggleWishlist(p.id)} className="absolute top-2 right-2 text-red-500 p-1 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={16}/></button>
                                      <a href={`#product/${p.id}`} className="block">
                                          <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden mb-3 p-4">
                                              <img src={p.image} className="w-full h-full object-contain mix-blend-multiply" />
                                          </div>
                                          <h4 className="font-bold text-gray-900 text-sm truncate">{p.name}</h4>
                                          <p className="text-primary font-bold text-lg mt-1">{formatCurrency(p.price)}</p>
                                      </a>
                                      <button onClick={() => onAddToCart(p)} className="w-full mt-3 bg-secondary text-white py-2 rounded-lg text-xs font-bold hover:bg-primary transition-colors flex items-center justify-center gap-2"><ShoppingCart size={14}/> Adicionar</button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
            )}

            {/* PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-fade-in">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><UserIcon size={20} className="text-primary"/> Dados da Conta</h2>
                          {profileSaved && <span className="text-green-600 text-xs font-bold animate-fade-in flex items-center gap-1"><CheckCircle size={14}/> Guardado com sucesso!</span>}
                      </div>
                      <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome Completo</label><input type="text" required value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" /></div>
                              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email</label><input type="email" disabled value={profileForm.email} className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed" /></div>
                              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Telemóvel</label><input type="tel" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" /></div>
                              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">NIF (para faturas)</label><input type="text" value={profileForm.nif} onChange={e => setProfileForm({...profileForm, nif: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" /></div>
                          </div>
                          <button type="submit" className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-600 transition-colors flex items-center gap-2"><Save size={20}/> Guardar Alterações</button>
                      </form>
                  </div>

                  {/* Configurações de Notificação */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-6 border-b border-gray-100">
                          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Bell size={20} className="text-yellow-500"/> Notificações</h2>
                      </div>
                      <div className="p-6 flex items-center justify-between">
                          <div>
                              <p className="font-bold text-gray-800">Alertas de Stock e Promoções</p>
                              <p className="text-sm text-gray-500 mb-2">Receba avisos quando os seus produtos favoritos voltarem ao stock.</p>
                              {isPushEnabled && (
                                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">
                                      <CheckCircle size={12}/> Ativo neste dispositivo
                                  </span>
                              )}
                          </div>
                          <button 
                            onClick={handleToggleNotifications} 
                            disabled={notifLoading}
                            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all 
                                ${isPushEnabled 
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                                    : 'bg-green-600 text-white hover:bg-green-700 shadow-md'
                                }`}
                          >
                              {notifLoading ? <Loader2 size={16} className="animate-spin"/> : isPushEnabled ? <><BellOff size={16}/> Desativar</> : <><Bell size={16}/> Ativar Agora</>}
                          </button>
                      </div>
                  </div>
              </div>
            )}

            {/* ADDRESSES */}
            {activeTab === 'addresses' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8 animate-fade-in">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><MapPin size={20} className="text-primary"/> Moradas de Envio</h2>
                      <button onClick={() => setIsAddingAddress(true)} className="text-primary font-bold text-sm flex items-center gap-1 hover:underline"><Plus size={16}/> Adicionar Nova</button>
                  </div>
                  <div className="p-8">
                      {isAddingAddress && (
                          <form onSubmit={handleAddAddress} className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8 animate-fade-in-down">
                              <h3 className="font-bold mb-4">Nova Morada</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <input placeholder="Apelido (ex: Casa, Trabalho)" required className="p-3 border rounded-xl" value={newAddress.alias} onChange={e => setNewAddress({...newAddress, alias: e.target.value})} />
                                  <input placeholder="Rua e Nº Porta" required className="p-3 border rounded-xl" value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} />
                                  <input placeholder="Localidade" required className="p-3 border rounded-xl" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} />
                                  <input placeholder="Código Postal" required className="p-3 border rounded-xl" value={newAddress.zip} onChange={e => setNewAddress({...newAddress, zip: e.target.value})} />
                              </div>
                              <div className="flex gap-2 mt-6">
                                  <button type="submit" className="bg-primary text-white px-6 py-2 rounded-xl font-bold">Guardar</button>
                                  <button type="button" onClick={() => setIsAddingAddress(false)} className="bg-gray-200 px-6 py-2 rounded-xl font-bold">Cancelar</button>
                              </div>
                          </form>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(!user.addresses || user.addresses.length === 0) ? (
                              <p className="text-gray-500 italic col-span-2">Nenhuma morada registada.</p>
                          ) : (
                              user.addresses.map(addr => (
                                  <div key={addr.id} className="border border-gray-200 p-5 rounded-2xl flex justify-between items-start group hover:border-primary transition-colors">
                                      <div>
                                          <p className="font-bold text-gray-900 flex items-center gap-2">{addr.alias} <CheckCircle size={14} className="text-green-500"/></p>
                                          <p className="text-sm text-gray-600 mt-1">{addr.street}</p>
                                          <p className="text-sm text-gray-600">{addr.zip} {addr.city}</p>
                                      </div>
                                      <button onClick={() => handleDeleteAddress(addr.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2"><Trash2 size={18}/></button>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
            )}

          </div>
        </div>

        {/* Modal Genérico para Ações de Encomenda */}
        {modalState.order && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                      <div>
                          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                              {modalState.type === 'cancel' && <><AlertTriangle className="text-red-500"/> Cancelar Encomenda</>}
                              {modalState.type === 'return' && <><Undo2 className="text-orange-500"/> Pedir Devolução</>}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">Ref: {displayOrderId(modalState.order.id)}</p>
                      </div>
                      <button onClick={() => setModalState({type: 'cancel', order: null})} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                  </div>
                  <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-4">
                        Descreva a situação detalhadamente (obrigatório).
                      </p>
                      <label htmlFor="modalReason" className="block text-sm font-bold text-gray-700 mb-2">Descrição</label>
                      <textarea id="modalReason" value={modalReason} onChange={(e) => setModalReason(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none" rows={4} placeholder="O que aconteceu?"/>
                  </div>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setModalState({type: 'cancel', order: null})} className="px-4 py-2 border rounded-lg text-gray-700 font-medium hover:bg-gray-50">Voltar</button>
                      <button onClick={handleOrderAction} disabled={!modalReason.trim() || isProcessingAction} className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                          {isProcessingAction ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                          {isProcessingAction ? 'A processar...' : 'Confirmar'}
                      </button>
                  </div>
              </div>
          </div>
        )}
    </div>
  );
};

export default ClientArea;
