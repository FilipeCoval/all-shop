
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, ShoppingCart, User as UserIcon, MapPin, BarChart2, TicketPercent, ToggleLeft, ToggleRight, Save, Bell, Truck, Globe, FileText, CheckCircle, Copy, Bot, Send, Users, Eye, AlertTriangle, Camera, Zap, ZapOff, QrCode, Home, ArrowLeft, RefreshCw, ClipboardEdit, MinusCircle, Calendar, Info, Database, UploadCloud, Tag, Image as ImageIcon, AlignLeft, ListPlus, ArrowRight as ArrowRightIcon, Layers, Lock, Unlock, CalendarClock, Upload, Loader2, ChevronDown, ChevronRight, ShieldAlert, XCircle, Mail, ScanBarcode, ShieldCheck, ZoomIn, BrainCircuit, Wifi, WifiOff, ExternalLink, Key as KeyIcon, Coins, Combine, Printer, Headphones, Wallet, AtSign, Scale
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord, Order, Coupon, User as UserType, PointHistory, UserTier, ProductUnit, Product, OrderItem, SupportTicket } from '../types';
import { getInventoryAnalysis } from '../services/geminiService';
import { INITIAL_PRODUCTS, LOYALTY_TIERS, STORE_NAME } from '../constants';
import { db, storage, firebase } from '../services/firebaseConfig';
import ProfitCalculatorModal from './ProfitCalculatorModal';
import BarcodeScanner from './BarcodeScanner';
import OrderDetailsModal from './OrderDetailsModal';

// --- TYPES HELPERS ---

const getSafeItems = (items: any): (OrderItem | string)[] => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') return [items];
    return [];
};

interface ManualOrderItem extends Product {
    quantity: number;
    selectedVariant: string; 
    finalPrice: number;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const KpiCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; onClick?: () => void; }> = ({ title, value, icon, color, onClick }) => {
  const colorClasses: { [key: string]: string } = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };
  const colorClass = colorClasses[color] || 'bg-gray-50 text-gray-600';
  const displayValue = typeof value === 'number' ? formatCurrency(value) : value;
  const isClickable = !!onClick;

  return (
    <div 
      onClick={onClick} 
      className={`p-4 rounded-xl border bg-white shadow-sm flex flex-col justify-between h-full transition-all duration-300 ${isClickable ? 'cursor-pointer hover:border-indigo-300 hover:shadow-lg hover:scale-[1.02]' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-500 text-xs font-bold uppercase flex items-center gap-1">{title}</span>
        <div className={`p-1.5 rounded-lg ${colorClass}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold">{displayValue}</div>
    </div>
  );
};

// --- DASHBOARD COMPONENT ---
interface DashboardProps {
    user: UserType | null;
    isAdmin: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ user, isAdmin }) => {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory(isAdmin);
  
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'coupons' | 'clients' | 'support'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'SOLD'>('ALL');
  const [cashbackFilter, setCashbackFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'NONE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<InventoryProduct | null>(null);
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [showToast, setShowToast] = useState<Order | null>(null);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isOnlineDetailsOpen, setIsOnlineDetailsOpen] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isCouponsLoading, setIsCouponsLoading] = useState(false);
  const [newCoupon, setNewCoupon] = useState<Coupon>({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0 });
  const [publicProductsList, setPublicProductsList] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'add_unit' | 'sell_unit' | 'tracking' | 'verify_product'>('search');
  const [modalUnits, setModalUnits] = useState<ProductUnit[]>([]);
  const [manualUnitCode, setManualUnitCode] = useState('');
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [notificationModalData, setNotificationModalData] = useState<{productName: string; subject: string; body: string; bcc: string; alertsToDelete: any[];} | null>(null);
  const [copySuccess, setCopySuccess] = useState('');
  const [linkedOrderId, setLinkedOrderId] = useState<string>('');
  const [selectedOrderForSaleDetails, setSelectedOrderForSaleDetails] = useState<Order | null>(null);
  const [selectedUnitsForSale, setSelectedUnitsForSale] = useState<string[]>([]);
  const [manualUnitSelect, setManualUnitSelect] = useState('');
  const [orderMismatchWarning, setOrderMismatchWarning] = useState<string | null>(null);
  const [securityCheckPassed, setSecurityCheckPassed] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [manualOrderItems, setManualOrderItems] = useState<ManualOrderItem[]>([]);
  const [manualOrderCustomer, setManualOrderCustomer] = useState({ name: '', email: '' });
  const [manualOrderShipping, setManualOrderShipping] = useState('');
  const [manualOrderPayment, setManualOrderPayment] = useState('MB Way');
  const [chartTimeframe, setChartTimeframe] = useState<'7d' | '30d' | '1y'>('7d');
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [detailsModalData, setDetailsModalData] = useState<{ title: string; data: any[]; columns: { header: string; accessor: string | ((item: any) => React.ReactNode); }[]; total: number } | null>(null);
  const [isPublicIdEditable, setIsPublicIdEditable] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [clientsSearchTerm, setClientsSearchTerm] = useState('');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generateQty, setGenerateQty] = useState(1);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  
  const [isCashbackManagerOpen, setIsCashbackManagerOpen] = useState(false);
  const [cashbackManagerFilter, setCashbackManagerFilter] = useState<'ALL' | 'PENDING'>('PENDING');
  const [expandedCashbackAccounts, setExpandedCashbackAccounts] = useState<string[]>([]);

  const [selectedUserDetails, setSelectedUserDetails] = useState<UserType | null>(null);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [isRecalculatingClient, setIsRecalculatingClient] = useState(false);

  const [isMerging, setIsMerging] = useState(false);
  const [mergeSearchEmail, setMergeSearchEmail] = useState('');
  const [foundDuplicate, setFoundDuplicate] = useState<UserType | null>(null);
  const [duplicateOrdersCount, setDuplicateOrdersCount] = useState(0);
  const [duplicateOrdersTotal, setDuplicateOrdersTotal] = useState(0);
  const [isSyncingStock, setIsSyncingStock] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const [formData, setFormData] = useState({
    name: '', description: '', category: '', publicProductId: '' as string, variant: '',
    purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', 
    quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', cashbackValue: '',
    cashbackStatus: 'NONE' as CashbackStatus, cashbackPlatform: '', cashbackAccount: '', cashbackExpectedDate: '',
    badges: [] as string[], newImageUrl: '', 
    images: [] as string[], features: [] as string[], newFeature: '', comingSoon: false,
    weight: ''
  });

  const selectedPublicProductVariants = useMemo(() => { if (!formData.publicProductId) return []; const prod = publicProductsList.find(p => p.id === Number(formData.publicProductId)); return prod?.variants || []; }, [formData.publicProductId, publicProductsList]);
  const [saleForm, setSaleForm] = useState({ quantity: '1', unitPrice: '', shippingCost: '', date: new Date().toISOString().split('T')[0], notes: '', supplierName: '', supplierOrderId: '' });
  const pendingOrders = useMemo(() => allOrders.filter(o => ['Processamento', 'Pago'].includes(o.status)), [allOrders]);
  
  useEffect(() => {
    if (activeTab === 'support' && isAdmin) {
        setIsTicketsLoading(true);
        const unsubscribe = db.collection('support_tickets').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket)));
            setIsTicketsLoading(false);
        });
        return () => unsubscribe();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => { if (linkedOrderId) { const order = allOrders.find(o => o.id === linkedOrderId); setSelectedOrderForSaleDetails(order || null); if (selectedProductForSale && order) { const safeItems = getSafeItems(order.items); const isCompatible = safeItems.some(item => { if (typeof item === 'string') return false; const idMatch = item.productId === selectedProductForSale.publicProductId; if (!idMatch) return false; const inventoryHasVariant = !!selectedProductForSale.variant; const orderHasVariant = !!item.selectedVariant; if (inventoryHasVariant && orderHasVariant) return item.selectedVariant === selectedProductForSale.variant; if (!inventoryHasVariant && !orderHasVariant) return true; if (!inventoryHasVariant && orderHasVariant) return false; if (inventoryHasVariant && !orderHasVariant) return true; return false; }); if (!isCompatible) setOrderMismatchWarning("ATENÇÃO: Este produto NÃO consta na encomenda selecionada!"); else setOrderMismatchWarning(null); if (order) { const item = safeItems.find(i => typeof i !== 'string' && i.productId === selectedProductForSale.publicProductId) as OrderItem | undefined; if (item) { setSaleForm(prev => ({ ...prev, unitPrice: item.price.toString(), shippingCost: (order.total - (item.price * item.quantity)).toFixed(2) })); } } } } else { setSelectedOrderForSaleDetails(null); setOrderMismatchWarning(null); } }, [linkedOrderId, allOrders, selectedProductForSale]);
  useEffect(() => { if(!isAdmin) return; audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'); const mountTime = Date.now(); const unsubscribe = db.collection('orders').orderBy('date', 'desc').limit(10).onSnapshot(snapshot => { snapshot.docChanges().forEach(change => { if (change.type === 'added') { const order = change.doc.data() as Order; if (new Date(order.date).getTime() > (mountTime - 2000)) { setNotifications(prev => [order, ...prev]); setShowToast(order); if (audioRef.current) audioRef.current.play().catch(() => {}); setTimeout(() => setShowToast(null), 5000); } } }); }); return () => unsubscribe(); }, [isAdmin]);
  useEffect(() => { if (!isAdmin) return; const unsubscribe = db.collection('products_public').onSnapshot(snap => { const loadedProducts: Product[] = []; snap.forEach(doc => { const id = parseInt(doc.id, 10); const data = doc.data(); if (!isNaN(id)) loadedProducts.push({ ...data, id: data.id || id } as Product); }); setPublicProductsList(loadedProducts); }); return () => unsubscribe(); }, [isAdmin]);
  useEffect(() => { if(!isAdmin) return; const unsubscribe = db.collection('online_users').onSnapshot(snapshot => { const now = Date.now(); const activeUsers: any[] = []; snapshot.forEach(doc => { const data = doc.data(); if (data && typeof data.lastActive === 'number' && (now - data.lastActive < 30000)) { activeUsers.push({ id: doc.id, ...data }); } }); setOnlineUsers(activeUsers); }); return () => unsubscribe(); }, [isAdmin]);
  useEffect(() => { if(!isAdmin) return; const unsubscribe = db.collection('orders').orderBy('date', 'desc').onSnapshot(snapshot => { setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))); setIsOrdersLoading(false); }); return () => unsubscribe(); }, [isAdmin]);
  useEffect(() => { if (activeTab === 'coupons' && isAdmin) { setIsCouponsLoading(true); const unsubscribe = db.collection('coupons').onSnapshot(snapshot => { setCoupons(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})) as Coupon[]); setIsCouponsLoading(false); }); return () => unsubscribe(); } if (activeTab === 'clients' && isAdmin) { setIsUsersLoading(true); const unsubscribe = db.collection('users').onSnapshot(snapshot => { setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserType))); setIsUsersLoading(false); }); return () => unsubscribe(); } }, [activeTab, isAdmin]);
  useEffect(() => { if (!isAdmin) return; const unsubscribe = db.collection('stock_alerts').onSnapshot(snapshot => { const alerts: any[] = []; snapshot.forEach(doc => alerts.push({ id: doc.id, ...doc.data() })); setStockAlerts(alerts); }); return () => unsubscribe(); }, [isAdmin]);
  useEffect(() => { const fetchClientData = async () => { if (selectedUserDetails) { const [userOrdersSnap, guestOrdersSnap] = await Promise.all([ db.collection("orders").where("userId", "==", selectedUserDetails.uid).get(), db.collection('orders').where('shippingInfo.email', '==', selectedUserDetails.email.toLowerCase()).where('userId', '==', null).get() ]); const allClientOrders: Order[] = []; userOrdersSnap.forEach(doc => allClientOrders.push({ id: doc.id, ...doc.data() } as Order)); guestOrdersSnap.forEach(doc => allClientOrders.push({ id: doc.id, ...doc.data() } as Order)); setClientOrders(allClientOrders); setMergeSearchEmail(selectedUserDetails.email); setFoundDuplicate(null); setDuplicateOrdersCount(0); setDuplicateOrdersTotal(0); } else { setClientOrders([]); } }; fetchClientData(); }, [selectedUserDetails]);

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
      try {
          await db.collection('support_tickets').doc(ticketId).update({ status: newStatus });
          if(selectedTicket) setSelectedTicket({...selectedTicket, status: newStatus} as any);
      } catch (error) { alert("Erro ao atualizar ticket."); }
  };

  const handleDeleteTicket = async (ticketId: string) => {
      if(!window.confirm("Apagar ticket permanentemente?")) return;
      try { await db.collection('support_tickets').doc(ticketId).delete(); setSelectedTicket(null); } 
      catch (error) { alert("Erro ao apagar."); }
  };

  const calculatedTotalSpent = useMemo(() => { if (!selectedUserDetails) return 0; return clientOrders.filter(o => o.status !== 'Cancelado').reduce((sum, order) => sum + (order.total || 0), 0); }, [clientOrders, selectedUserDetails]);
  const handleRecalculateClientData = async () => { /* ... existing ... */ };
  const handleUpdateOrderState = (orderId: string, updates: Partial<Order>) => { setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); if (selectedOrderDetails && selectedOrderDetails.id === orderId) { setSelectedOrderDetails(prev => prev ? { ...prev, ...updates } : null); } };
  const handleAddUnit = (code: string) => { if (modalUnits.some(u => u.id === code)) return alert("Este código já foi adicionado."); setModalUnits(prev => [...prev, { id: code, status: 'AVAILABLE', addedAt: new Date().toISOString() }]); };
  const handleRemoveUnit = (id: string) => setModalUnits(prev => prev.filter(u => u.id !== id));
  const handleSelectUnitForSale = (code: string) => { if (!selectedProductForSale) return; const unit = selectedProductForSale.units?.find(u => u.id === code); if (!unit) return alert("Erro: Este S/N não pertence a este lote de produto."); if (unit.status !== 'AVAILABLE') return alert("Erro: Este S/N já foi vendido ou está reservado."); if (selectedUnitsForSale.includes(code)) return alert("Aviso: Este S/N já foi adicionado a esta venda."); setSelectedUnitsForSale(prev => [...prev, code]); setSecurityCheckPassed(true); };
  const handleVerifyProduct = (code: string) => { if (!selectedProductForSale) return; const cleanCode = code.trim().toUpperCase(); if (cleanCode === selectedProductForSale.publicProductId?.toString() || selectedProductForSale.units?.some(u => u.id.toUpperCase() === cleanCode)) { setSecurityCheckPassed(true); setVerificationCode(code); } else { alert(`Código ${code} NÃO corresponde a este produto! Verifique se pegou na caixa correta.`); setSecurityCheckPassed(false); } };
  const handleNotifySubscribers = (productId: number, productName: string, variantName?: string) => { /* ... */ };
  
  const handleClearSentAlerts = async () => {
      if (!notificationModalData) return;
      if (!window.confirm("Isto irá apagar os alertas da base de dados. Confirma que já enviou o email?")) return;
      
      try {
          const batch = db.batch();
          notificationModalData.alertsToDelete.forEach(alert => {
              batch.delete(db.collection('stock_alerts').doc(alert.id));
          });
          await batch.commit();
          setNotificationModalData(null);
          alert("Lista de espera limpa com sucesso!");
      } catch(e) {
          alert("Erro ao limpar alertas.");
      }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); return true; };
  const handleCopyToClipboard = (text: string, type: string) => { if (copyToClipboard(text)) { setCopySuccess(type); setTimeout(() => setCopySuccess(''), 2000); } else alert("Não foi possível copiar."); };
  
  const handleAddCoupon = async (e: React.FormEvent) => { 
      e.preventDefault();
      try {
          await db.collection('coupons').add(newCoupon);
          setNewCoupon({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0 });
          alert("Cupão criado!");
      } catch(e) { alert("Erro ao criar cupão."); }
  };
  
  const handleToggleCoupon = async (coupon: Coupon) => {
      if(!coupon.id) return;
      try {
          await db.collection('coupons').doc(coupon.id).update({ isActive: !coupon.isActive });
      } catch(e) { alert("Erro ao atualizar cupão."); }
  };
  
  const handleDeleteCoupon = async (id?: string) => {
      if (!id || !window.confirm("Apagar cupão permanentemente?")) return;
      try {
          await db.collection('coupons').doc(id).delete();
          setCoupons(prevCoupons => prevCoupons.filter(coupon => coupon.id !== id));
      } catch (e) {
          alert("Erro ao apagar o cupão.");
          console.error("Delete coupon error:", e);
      }
  };

  const handleOrderStatusChange = async (orderId: string, newStatus: string) => {
    try {
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        if(!orderDoc.exists) return;

        const currentOrder = orderDoc.data() as Order;
        const updates: any = {
            status: newStatus,
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                status: newStatus,
                date: new Date().toISOString(),
                notes: 'Estado alterado via Backoffice'
            })
        };

        if (newStatus === 'Entregue' && !currentOrder.pointsAwarded && currentOrder.userId) {
            const userRef = db.collection('users').doc(currentOrder.userId);
            
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) return;
                
                const userData = userDoc.data() as UserType;
                const tier = userData.tier || 'Bronze';
                
                let multiplier = 1;
                if (tier === 'Prata') multiplier = LOYALTY_TIERS.SILVER.multiplier;
                if (tier === 'Ouro') multiplier = LOYALTY_TIERS.GOLD.multiplier;
                
                const pointsToAward = Math.floor(currentOrder.total * multiplier);
                
                if (pointsToAward > 0) {
                    const newHistory: PointHistory = {
                        id: `earn-${orderId}`,
                        date: new Date().toISOString(),
                        amount: pointsToAward,
                        reason: `Compra #${orderId} (Nível ${tier})`,
                        orderId: orderId
                    };
                    
                    transaction.update(userRef, {
                        loyaltyPoints: (userData.loyaltyPoints || 0) + pointsToAward,
                        pointsHistory: [newHistory, ...(userData.pointsHistory || [])]
                    });
                    
                    updates.pointsAwarded = true;
                }
            });
        }

        await orderRef.update(updates);
        setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
        if (selectedOrderDetails?.id === orderId) {
            setSelectedOrderDetails(prev => prev ? { ...prev, ...updates } : null);
        }

    } catch (error) {
        console.error("Erro ao mudar estado:", error);
        alert("Erro ao atualizar estado da encomenda.");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
      if(!window.confirm("ATENÇÃO: Apagar a encomenda é irreversível. Deseja continuar?")) return;
      try {
          await db.collection('orders').doc(orderId).delete();
          setAllOrders(prev => prev.filter(o => o.id !== orderId));
      } catch(e) { alert("Erro ao apagar encomenda."); }
  };

  const handleSearchDuplicate = async () => { /* ... */ };
  const handleConfirmMerge = async () => { /* ... */ };
  const handleUpdateTracking = async (orderId: string, tracking: string) => { try { await db.collection('orders').doc(orderId).update({ trackingNumber: tracking }); if (selectedOrderDetails) setSelectedOrderDetails({...selectedOrderDetails, trackingNumber: tracking}); } catch (e) { alert("Erro ao gravar rastreio"); } };
  const handleCopy = (text: string) => { if (!copyToClipboard(text)) alert("Não foi possível copiar."); };
  const handleAskAi = async () => { if (!aiQuery.trim()) return; setIsAiLoading(true); setAiResponse(null); try { setAiResponse(await getInventoryAnalysis(products, aiQuery)); } catch (e) { setAiResponse("Não foi possível processar o pedido."); } finally { setIsAiLoading(false); } };
  const chartData = useMemo(() => { const numDays = chartTimeframe === '1y' ? 365 : chartTimeframe === '30d' ? 30 : 7; const toLocalISO = (dateStr: string) => { if (!dateStr) return ''; const d = new Date(dateStr); if (isNaN(d.getTime())) return ''; if (dateStr.length === 10 && !dateStr.includes('T')) return dateStr; const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0'); const day = d.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; }; const manualSales = products.flatMap(p => (p.salesHistory || []).filter(s => !s.id.startsWith('ORDER-')).map(s => ({ date: toLocalISO(s.date), total: (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0) }))); const onlineOrders = allOrders.filter(o => o.status !== 'Cancelado').map(o => ({ date: toLocalISO(o.date), total: (Number(o.total) || 0) })); const allSales = [...manualSales, ...onlineOrders]; const today = new Date(); let totalPeriod = 0; if (chartTimeframe === '1y') { const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(today.getMonth() - i, 1); return d; }).reverse(); const monthlyData = months.map(monthStart => { const year = monthStart.getFullYear(); const month = monthStart.getMonth() + 1; const monthStr = `${year}-${month.toString().padStart(2, '0')}`; const totalForMonth = allSales.reduce((acc, sale) => { return sale.date.startsWith(monthStr) ? acc + sale.total : acc; }, 0); totalPeriod += totalForMonth; return { label: monthStart.toLocaleDateString('pt-PT', { month: 'short' }), value: totalForMonth }; }); const maxValue = Math.max(...monthlyData.map(d => d.value), 1); return { days: monthlyData, maxValue, totalPeriod }; } else { const days = []; for (let i = numDays - 1; i >= 0; i--) { const d = new Date(); d.setDate(today.getDate() - i); const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0'); const day = d.getDate().toString().padStart(2, '0'); const dateLabel = `${year}-${month}-${day}`; const totalForDay = allSales.reduce((acc, sale) => sale.date === dateLabel ? acc + sale.total : acc, 0); totalPeriod += totalForDay; days.push({ label: d.toLocaleDateString('pt-PT', { day: 'numeric' }), date: dateLabel, value: totalForDay }); } const maxValue = Math.max(...days.map(d => d.value), 1); return { days, maxValue, totalPeriod }; } }, [allOrders, products, chartTimeframe]);
  const stats = useMemo(() => { let totalInvested = 0, realizedRevenue = 0, realizedProfit = 0, pendingCashback = 0, potentialProfit = 0; products.forEach(p => { const invested = (p.purchasePrice || 0) * (p.quantityBought || 0); totalInvested += invested; let revenue = 0, totalShippingPaid = 0; if (p.salesHistory && p.salesHistory.length > 0) { revenue = p.salesHistory.reduce((acc, sale) => acc + ((sale.quantity || 0) * (sale.unitPrice || 0)), 0); totalShippingPaid = p.salesHistory.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0); } else { revenue = (p.quantitySold || 0) * (p.salePrice || 0); } realizedRevenue += revenue; const cogs = (p.quantitySold || 0) * (p.purchasePrice || 0); const profitFromSales = revenue - cogs - totalShippingPaid; const cashback = p.cashbackStatus === 'RECEIVED' ? (p.cashbackValue || 0) : 0; realizedProfit += profitFromSales + cashback; if (p.cashbackStatus === 'PENDING') { pendingCashback += (p.cashbackValue || 0); } const remainingStock = (p.quantityBought || 0) - (p.quantitySold || 0); if (remainingStock > 0 && p.targetSalePrice) { potentialProfit += ((p.targetSalePrice || 0) - (p.purchasePrice || 0)) * remainingStock; } }); return { totalInvested, realizedRevenue, realizedProfit, pendingCashback, potentialProfit }; }, [products]);
  const handleEdit = (product: InventoryProduct) => { setEditingId(product.id); setFormData({ name: product.name, description: product.description || '', category: product.category, publicProductId: product.publicProductId ? product.publicProductId.toString() : '', variant: product.variant || '', purchaseDate: product.purchaseDate, supplierName: product.supplierName || '', supplierOrderId: product.supplierOrderId || '', quantityBought: product.quantityBought.toString(), purchasePrice: product.purchasePrice.toString(), salePrice: product.salePrice ? product.salePrice.toString() : '', targetSalePrice: product.targetSalePrice ? product.targetSalePrice.toString() : '', cashbackValue: product.cashbackValue.toString(), cashbackStatus: product.cashbackStatus, cashbackPlatform: product.cashbackPlatform || '', cashbackAccount: product.cashbackAccount || '', cashbackExpectedDate: product.cashbackExpectedDate || '', badges: product.badges || [], images: product.images || [], newImageUrl: '', features: product.features || [], newFeature: '', comingSoon: product.comingSoon || false, weight: product.weight ? product.weight.toString() : '' }); setModalUnits(product.units || []); setGeneratedCodes([]); setIsPublicIdEditable(false); setIsModalOpen(true); };
  const handleAddNew = () => { setEditingId(null); setFormData({ name: '', description: '', category: 'TV Box', publicProductId: '', variant: '', purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', cashbackValue: '', cashbackStatus: 'NONE', cashbackPlatform: '', cashbackAccount: '', cashbackExpectedDate: '', badges: [], images: [], newImageUrl: '', features: [], newFeature: '', comingSoon: false, weight: '' }); setModalUnits([]); setGeneratedCodes([]); setIsPublicIdEditable(false); setIsModalOpen(true); };
  const handleCreateVariant = (parentProduct: InventoryProduct) => { setEditingId(null); setFormData({ name: parentProduct.name, description: parentProduct.description || '', category: parentProduct.category, publicProductId: parentProduct.publicProductId ? parentProduct.publicProductId.toString() : '', variant: '', purchaseDate: new Date().toISOString().split('T')[0], supplierName: parentProduct.supplierName || '', supplierOrderId: '', quantityBought: '', purchasePrice: parentProduct.purchasePrice.toString(), salePrice: parentProduct.salePrice ? parentProduct.salePrice.toString() : '', targetSalePrice: parentProduct.targetSalePrice ? parentProduct.targetSalePrice.toString() : '', cashbackValue: '', cashbackStatus: 'NONE', cashbackPlatform: '', cashbackAccount: '', cashbackExpectedDate: '', badges: parentProduct.badges || [], images: parentProduct.images || [], newImageUrl: '', features: parentProduct.features || [], newFeature: '', comingSoon: parentProduct.comingSoon || false, weight: parentProduct.weight ? parentProduct.weight.toString() : '' }); setModalUnits([]); setGeneratedCodes([]); setIsPublicIdEditable(false); setIsModalOpen(true); };
  const handlePublicProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => { const selectedId = e.target.value; setFormData(prev => ({ ...prev, publicProductId: selectedId, variant: '' })); if (selectedId) { const publicProd = publicProductsList.find(p => p.id === Number(selectedId)); if (publicProd) setFormData(prev => ({ ...prev, publicProductId: selectedId, name: publicProd.name, category: publicProd.category })); } };
  const handleAddImage = () => { if (formData.newImageUrl && formData.newImageUrl.trim()) { setFormData(prev => ({ ...prev, images: [...prev.images, prev.newImageUrl.trim()], newImageUrl: '' })); } };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploading(true); setUploadProgress(0); const storageRef = storage.ref(`products/${Date.now()}_${file.name}`); const uploadTask = storageRef.put(file); uploadTask.on('state_changed', (snapshot) => { const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; setUploadProgress(progress); }, (error) => { console.error("Upload error:", error); alert("Erro ao fazer upload da imagem."); setIsUploading(false); setUploadProgress(null); }, async () => { const downloadURL = await uploadTask.snapshot.ref.getDownloadURL(); setFormData(prev => ({ ...prev, images: [...prev.images, downloadURL] })); setIsUploading(false); setUploadProgress(null); if (fileInputRef.current) fileInputRef.current.value = ''; }); };
  const handleRemoveImage = (indexToRemove: number) => { setFormData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== indexToRemove) })); };
  const handleMoveImage = (index: number, direction: 'left' | 'right') => { if ((direction === 'left' && index === 0) || (direction === 'right' && index === formData.images.length - 1)) return; const newImages = [...formData.images]; const targetIndex = direction === 'left' ? index - 1 : index + 1; [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]]; setFormData(prev => ({ ...prev, images: newImages })); };
  const handleAddFeature = () => { if (formData.newFeature && formData.newFeature.trim()) { setFormData(prev => ({ ...prev, features: [...prev.features, formData.newFeature.trim()], newFeature: '' })); } };
  const handleRemoveFeature = (indexToRemove: number) => { setFormData(prev => ({ ...prev, features: prev.features.filter((_, idx) => idx !== indexToRemove) })); };
  const handleSyncPublicStock = async () => { if (products.length === 0) { alert("O inventário parece estar vazio ou ainda a carregar."); return; } if (!window.confirm("Isto irá recalcular o stock TOTAL da loja pública baseando-se na soma de todos os lotes do inventário físico.\n\nCertifique-se que os 'IDs de Produto da Loja' estão preenchidos nos lotes.\n\nContinuar?")) return; setIsSyncingStock(true); try { const stockMap: Record<string, number> = {}; let linkedItemsCount = 0; products.forEach(p => { if (p.publicProductId) { const pid = p.publicProductId.toString(); const remaining = Math.max(0, (p.quantityBought || 0) - (p.quantitySold || 0)); if (typeof stockMap[pid] === 'undefined') stockMap[pid] = 0; stockMap[pid] += remaining; linkedItemsCount++; } }); if (linkedItemsCount === 0) { alert("Nenhum lote tem 'ID de Produto da Loja' configurado. Edite os lotes e associe-os aos produtos públicos."); setIsSyncingStock(false); return; } const entries = Object.entries(stockMap); const batches = []; for (let i = 0; i < entries.length; i += 500) { const chunk = entries.slice(i, i + 500); const batch = db.batch(); chunk.forEach(([publicId, totalStock]) => { const ref = db.collection('products_public').doc(publicId); batch.update(ref, { stock: totalStock }); }); batches.push(batch); } await Promise.all(batches.map(b => b.commit())); alert(`Sincronização concluída com sucesso!\n${entries.length} produtos atualizados na loja.`); } catch (error: any) { console.error("Erro ao sincronizar:", error); alert(`Ocorreu um erro ao sincronizar: ${error.message}`); } finally { setIsSyncingStock(false); } };
  const handleProductSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (selectedPublicProductVariants.length > 0 && !formData.variant) return alert("Selecione a variante."); const qBought = Number(formData.quantityBought) || 0; const existingProduct = products.find(p => p.id === editingId); const currentSold = existingProduct ? existingProduct.quantitySold : 0; const currentSalePrice = formData.salePrice ? Number(formData.salePrice) : 0; let productStatus: ProductStatus = 'IN_STOCK'; if (currentSold >= qBought && qBought > 0) productStatus = 'SOLD'; else if (currentSold > 0) productStatus = 'PARTIAL'; const payload: any = { name: formData.name, description: formData.description, category: formData.category, publicProductId: formData.publicProductId ? Number(formData.publicProductId) : null, variant: formData.variant || null, purchaseDate: formData.purchaseDate, supplierName: formData.supplierName, supplierOrderId: formData.supplierOrderId, quantityBought: qBought, quantitySold: currentSold, salesHistory: (existingProduct && Array.isArray(existingProduct.salesHistory)) ? existingProduct.salesHistory : [], purchasePrice: Number(formData.purchasePrice) || 0, targetSalePrice: formData.targetSalePrice ? Number(formData.targetSalePrice) : null, salePrice: currentSalePrice, cashbackValue: Number(formData.cashbackValue) || 0, cashbackStatus: formData.cashbackStatus, cashbackPlatform: formData.cashbackPlatform, cashbackAccount: formData.cashbackAccount, cashbackExpectedDate: formData.cashbackExpectedDate, units: modalUnits, status: productStatus, badges: formData.badges, images: formData.images, features: formData.features, comingSoon: formData.comingSoon, weight: formData.weight ? parseFloat(formData.weight) : 0 }; Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]); try { if (editingId) await updateProduct(editingId, payload); else await addProduct(payload); setIsModalOpen(false); } catch (err) { alert('Erro ao guardar.'); } };
  const toggleBadge = (badge: string) => { setFormData(prev => { const badges = prev.badges || []; if (badges.includes(badge)) return { ...prev, badges: badges.filter(b => b !== badge) }; else return { ...prev, badges: [...badges, badge] }; }); };
  const openSaleModal = (product: InventoryProduct) => { setSelectedProductForSale(product); setSaleForm({ quantity: '1', unitPrice: product.salePrice ? product.salePrice.toString() : product.targetSalePrice ? product.targetSalePrice.toString() : '', shippingCost: '', date: new Date().toISOString().split('T')[0], notes: '', supplierName: product.supplierName || '', supplierOrderId: product.supplierOrderId || '' }); setSelectedUnitsForSale([]); setLinkedOrderId(''); setSelectedOrderForSaleDetails(null); setOrderMismatchWarning(null); setSecurityCheckPassed(false); setVerificationCode(''); setIsSaleModalOpen(true); };
  const handleSaleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!selectedProductForSale) return; const qty = parseInt(saleForm.quantity) || 1; const price = parseFloat(saleForm.unitPrice) || 0; const shipping = parseFloat(saleForm.shippingCost) || 0; const newSale: SaleRecord = { id: `MANUAL-${Date.now()}`, date: saleForm.date, quantity: qty, unitPrice: price, shippingCost: shipping, notes: saleForm.notes }; try { const currentSold = (selectedProductForSale.quantitySold || 0) + qty; const status = currentSold >= selectedProductForSale.quantityBought ? 'SOLD' : 'PARTIAL'; await updateProduct(selectedProductForSale.id, { quantitySold: currentSold, salesHistory: [...(selectedProductForSale.salesHistory || []), newSale], status: status as ProductStatus }); if (linkedOrderId && selectedUnitsForSale.length > 0) { const orderRef = db.collection('orders').doc(linkedOrderId); const orderDoc = await orderRef.get(); if (orderDoc.exists) { const orderData = orderDoc.data() as Order; const updatedItems = orderData.items.map((item: any) => { const isMatch = item.productId === selectedProductForSale.publicProductId && ((!item.selectedVariant && !selectedProductForSale.variant) || (item.selectedVariant === selectedProductForSale.variant)); if (isMatch) { const currentSn = item.serialNumbers || []; return { ...item, serialNumbers: [...new Set([...currentSn, ...selectedUnitsForSale])] }; } return item; }); await orderRef.update({ items: updatedItems }); } } setIsSaleModalOpen(false); } catch(e) { console.error(e); alert("Erro ao registar venda."); } };
  const handleDeleteSale = async (saleId: string) => { if(!editingId || !window.confirm("Anular venda e repor stock?")) return; const product = products.find(p => p.id === editingId); if(!product) return; const sale = product.salesHistory?.find(s => s.id === saleId); if(!sale) return; const newSold = Math.max(0, (product.quantitySold || 0) - sale.quantity); const newHistory = product.salesHistory?.filter(s => s.id !== saleId) || []; const newStatus = newSold >= product.quantityBought ? 'SOLD' : newSold > 0 ? 'PARTIAL' : 'IN_STOCK'; try { await updateProduct(editingId, { quantitySold: newSold, salesHistory: newHistory, status: newStatus as ProductStatus }); } catch(e) { alert("Erro ao anular venda."); } };
  const handleDelete = async (id: string) => { if (!id) return; if (window.confirm('Apagar registo?')) { try { await deleteProduct(id); } catch (error: any) { alert("Erro: " + error.message); } } };
  const handleDeleteGroup = async (groupId: string, items: InventoryProduct[]) => { if (!window.confirm(`Apagar grupo "${items[0].name}" e ${items.length} lotes?`)) return; try { const batch = db.batch(); items.forEach(item => batch.delete(db.collection('products_inventory').doc(item.id))); if (items[0].publicProductId) batch.delete(db.collection('products_public').doc(items[0].publicProductId.toString())); await batch.commit(); } catch (e) { alert("Erro ao apagar grupo."); } };
  const handleRecalculateData = async () => { /* ... */ };
  const filteredProducts = products.filter(p => { const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()); let matchesStatus = true; if (statusFilter === 'IN_STOCK') matchesStatus = p.status !== 'SOLD'; if (statusFilter === 'SOLD') matchesStatus = p.status === 'SOLD'; let matchesCashback = true; if (cashbackFilter !== 'ALL') matchesCashback = p.cashbackStatus === cashbackFilter; return matchesSearch && matchesStatus && matchesCashback; });
  const groupedInventory = useMemo(() => { const groups: { [key: string]: InventoryProduct[] } = {}; filteredProducts.forEach(p => { const key = p.publicProductId ? p.publicProductId.toString() : `local-${p.id}`; if (!groups[key]) groups[key] = []; groups[key].push(p); }); return Object.entries(groups).sort(([, itemsA], [, itemsB]) => (itemsA[0]?.name || '').localeCompare(itemsB[0]?.name || '')); }, [filteredProducts]);
  const toggleGroup = (groupId: string) => { setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]); };
  const productsForSelect = useMemo(() => publicProductsList.filter(p => !p.comingSoon).flatMap(p => { if (p.variants?.length) return p.variants.map(v => ({ value: `${p.id}|${v.name}`, label: `${p.name} - ${v.name}` })); return { value: `${p.id}|`, label: p.name }; }), [publicProductsList]);
  const addProductToManualOrder = (value: string) => { if (!value) return; const [idStr, variantName] = value.split('|'); const product = publicProductsList.find(p => p.id === Number(idStr)); if (!product) return; const key = `${product.id}|${variantName}`; setManualOrderItems(prev => { const existing = prev.find(item => `${item.id}|${item.selectedVariant}` === key); if (existing) return prev.map(item => (`${item.id}|${item.selectedVariant}` === key) ? { ...item, quantity: item.quantity + 1 } : item); let finalPrice = product.price; if (variantName) { const variant = product.variants?.find(v => v.name === variantName); if (variant) finalPrice = variant.price; } return [...prev, { ...product, quantity: 1, selectedVariant: variantName, finalPrice: finalPrice }]; }); };
  const updateManualOrderItemQuantity = (key: string, delta: number) => { setManualOrderItems(prev => prev.map(item => { if (`${item.id}|${item.selectedVariant}` === key) { const newQuantity = item.quantity + delta; return newQuantity > 0 ? { ...item, quantity: newQuantity } : item; } return item; }).filter(item => item.quantity > 0)); };
  const handleOpenInvestedModal = () => { setDetailsModalData({ title: "Detalhe do Investimento", data: products.map(p => ({ id: p.id, name: p.name, qty: p.quantityBought, cost: p.purchasePrice, total: p.quantityBought * p.purchasePrice })).filter(i => i.total > 0).sort((a,b) => b.total - a.total), total: stats.totalInvested, columns: [{ header: "Produto", accessor: "name" }, { header: "Qtd. Comprada", accessor: "qty" }, { header: "Custo Unit.", accessor: (i) => formatCurrency(i.cost) }, { header: "Total", accessor: (i) => formatCurrency(i.total) }] }); };
  const handleOpenRevenueModal = () => { setDetailsModalData({ title: "Receita Realizada", data: products.flatMap(p => (p.salesHistory || []).map(s => ({ id: s.id, name: p.name, date: s.date, qty: s.quantity, val: s.quantity * s.unitPrice }))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), total: stats.realizedRevenue, columns: [{ header: "Data", accessor: (i) => new Date(i.date).toLocaleDateString() }, { header: "Produto", accessor: "name" }, { header: "Qtd", accessor: "qty" }, { header: "Valor", accessor: (i) => formatCurrency(i.val) }] }); };
  const handleOpenProfitModal = () => { setDetailsModalData({ title: "Lucro Líquido por Produto", data: products.map(p => { const revenue = (p.salesHistory || []).reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0); const cogs = p.quantitySold * p.purchasePrice; const cashback = p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0; return { id: p.id, name: p.name, profit: revenue - cogs + cashback }; }).filter(p => p.profit !== 0).sort((a,b) => b.profit - a.profit), total: stats.realizedProfit, columns: [{ header: "Produto", accessor: "name" }, { header: "Lucro", accessor: (i) => <span className={i.profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{formatCurrency(i.profit)}</span> }] }); };
  
  const handleOpenCashbackManager = () => { setIsCashbackManagerOpen(true); };
  const handleImportProducts = async () => { /* ... */ };
  
  const handleManualOrderSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (manualOrderItems.length === 0) return alert("Adicione produtos primeiro.");
      
      const orderId = `MANUAL-${Date.now().toString().slice(-6)}`;
      const total = manualOrderItems.reduce((acc, i) => acc + i.finalPrice * i.quantity, 0);
      
      const newOrder: Order = {
          id: orderId,
          date: new Date().toISOString(),
          total: total,
          status: 'Pago',
          items: manualOrderItems.map(i => ({
              productId: i.id,
              name: i.name,
              price: i.finalPrice,
              quantity: i.quantity,
              selectedVariant: i.selectedVariant,
              addedAt: new Date().toISOString()
          })),
          shippingInfo: {
              name: manualOrderCustomer.name || 'Cliente Balcão',
              email: manualOrderCustomer.email || '',
              street: manualOrderShipping || 'Levantamento em Loja',
              doorNumber: '', zip: '', city: '', phone: '',
              paymentMethod: manualOrderPayment as any
          },
          userId: null
      };

      try {
          await db.collection('orders').doc(orderId).set(newOrder);

          for (const item of manualOrderItems) {
              const relevantBatches = products
                  .filter(p => p.publicProductId === item.id)
                  .filter(p => {
                      if (item.selectedVariant) return p.variant === item.selectedVariant;
                      return true;
                  })
                  .sort((a,b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());

              let qtyToDeduct = item.quantity;

              for (const batch of relevantBatches) {
                  if (qtyToDeduct <= 0) break;
                  
                  const availableInBatch = Math.max(0, (batch.quantityBought || 0) - (batch.quantitySold || 0));
                  
                  if (availableInBatch > 0) {
                      const deduct = Math.min(availableInBatch, qtyToDeduct);
                      const newSold = (batch.quantitySold || 0) + deduct;
                      const status: ProductStatus = newSold >= batch.quantityBought ? 'SOLD' : 'PARTIAL';
                      
                      const saleRecord: SaleRecord = {
                          id: `SALE-${orderId}-${batch.id}`,
                          date: new Date().toISOString(),
                          quantity: deduct,
                          unitPrice: item.finalPrice,
                          shippingCost: 0,
                          notes: `Encomenda Manual ${orderId}`
                      };

                      await updateProduct(batch.id, {
                          quantitySold: newSold,
                          status: status,
                          salesHistory: [...(batch.salesHistory || []), saleRecord]
                      });
                      
                      qtyToDeduct -= deduct;
                  }
              }
              
              if (qtyToDeduct > 0) {
                  alert(`Aviso: Stock insuficiente para "${item.name}". Stock ficou negativo no sistema.`);
              }
          }

          setManualOrderItems([]);
          setManualOrderCustomer({ name: '', email: '' });
          setManualOrderShipping('');
          setIsManualOrderModalOpen(false);
          alert("Encomenda registada com sucesso!");

      } catch (error) {
          console.error(error);
          alert("Erro ao criar encomenda.");
      }
  };

  const handleGenerateCodes = () => {
      const newCodes: string[] = [];
      for(let i=0; i < generateQty; i++) {
          const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
          newCodes.push(`INT-${randomPart}`);
      }
      
      setGeneratedCodes(prev => [...prev, ...newCodes]);
      
      if (isModalOpen) {
          const newUnits = newCodes.map(code => ({
              id: code,
              status: 'AVAILABLE' as const,
              addedAt: new Date().toISOString()
          }));
          setModalUnits(prev => [...prev, ...newUnits]);
      }
  };

  const handlePrintLabels = () => {
      if (generatedCodes.length === 0) return;
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const html = `
        <html>
        <head>
            <title>Imprimir Etiquetas</title>
            <style>
                body { font-family: monospace; padding: 20px; }
                .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .label { border: 1px dashed #000; padding: 10px; text-align: center; height: 80px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
                .code { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
                .store { font-size: 10px; margin-top: 5px; text-transform: uppercase; }
                @media print { .no-print { display: none; } .label { border: 1px solid #000; break-inside: avoid; } }
            </style>
        </head>
        <body>
            <button class="no-print" onclick="window.print()" style="padding: 10px 20px; font-size: 16px; margin-bottom: 20px; cursor: pointer;">🖨️ Imprimir Agora</button>
            <div class="grid">
                ${generatedCodes.map(code => `
                    <div class="label">
                        <div class="code">${code}</div>
                        <div class="store">${STORE_NAME} - Inventário</div>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
      `;
      
      printWindow.document.write(html);
      printWindow.document.close();
  };

  const filteredClients = useMemo(() => { if (!clientsSearchTerm) return allUsers; return allUsers.filter(u => u.name.toLowerCase().includes(clientsSearchTerm.toLowerCase()) || u.email.toLowerCase().includes(clientsSearchTerm.toLowerCase()) ); }, [allUsers, clientsSearchTerm]);

  const groupedCashback = useMemo(() => {
      const pendingItems = products.filter(p => p.cashbackValue > 0 && (cashbackManagerFilter === 'ALL' || p.cashbackStatus === cashbackManagerFilter));
      
      const groups: Record<string, { total: number, items: InventoryProduct[] }> = {};
      
      pendingItems.forEach(item => {
          const account = item.cashbackAccount || 'Sem Conta Definida';
          if (!groups[account]) groups[account] = { total: 0, items: [] };
          groups[account].items.push(item);
          groups[account].total += item.cashbackValue;
      });

      return groups;
  }, [products, cashbackManagerFilter]);

  const toggleCashbackAccount = (account: string) => {
      setExpandedCashbackAccounts(prev => 
          prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]
      );
  };

  const handleMarkBatchReceived = async (itemsToUpdate: InventoryProduct[]) => {
      if(!window.confirm(`Marcar ${itemsToUpdate.length} itens como RECEBIDO?`)) return;
      try {
          const batch = db.batch();
          itemsToUpdate.forEach(item => {
              const ref = db.collection('products_inventory').doc(item.id);
              batch.update(ref, { cashbackStatus: 'RECEIVED' });
          });
          await batch.commit();
          alert("Cashback atualizado com sucesso!");
      } catch(e) {
          alert("Erro ao atualizar cashback.");
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 animate-fade-in relative">
      {showToast && <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right"><div className="bg-white border-l-4 border-green-500 shadow-2xl rounded-r-lg p-4 flex items-start gap-3 w-80"><div className="text-green-500 bg-green-50 p-2 rounded-full"><DollarSign size={24} /></div><div className="flex-1"><h4 className="font-bold text-gray-900">Nova Venda Online!</h4><p className="text-sm text-gray-600 mt-1">Pedido {showToast.id.startsWith('#') ? '' : '#'}{showToast.id.toUpperCase()}</p><p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(showToast.total)}</p></div><button onClick={() => setShowToast(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div></div>}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 flex flex-col md:flex-row md:h-20 items-center justify-between gap-4 md:gap-0 py-4 md:py-0">
          <div className="flex items-center gap-3 w-full justify-between md:w-auto">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg text-white"><LayoutDashboard size={24} /></div>
                <h1 className="text-xl font-bold text-gray-900">Backoffice</h1>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <div className="relative"><button onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{notifications.length}</span>}</button></div>
                 <button onClick={() => window.location.hash = '/'} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Voltar à Loja"><Home size={20} /></button>
              </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="w-full md:w-auto flex flex-col md:flex-row bg-gray-100 p-1 rounded-lg gap-1 md:gap-0 overflow-x-auto">
                <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'inventory' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Package size={16} /> Inventário</button>
                <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><ShoppingCart size={16} /> Encomendas</button>
                <button onClick={() => setActiveTab('clients')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'clients' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Users size={16} /> Clientes</button>
                <button onClick={() => setActiveTab('support')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'support' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Headphones size={16} /> Suporte</button>
                <button onClick={() => setActiveTab('coupons')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'coupons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><TicketPercent size={16} /> Cupões</button>
            </div>
            <div className="hidden md:flex items-center gap-3">
                <div className="relative"><button onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{notifications.length}</span>}</button>{isNotifDropdownOpen && <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"><div className="p-3 border-b border-gray-100 bg-gray-50"><h4 className="text-sm font-bold text-gray-700">Notificações</h4></div><div className="max-h-64 overflow-y-auto">{notifications.map((n, idx) => <div key={idx} className="p-3 border-b border-gray-100 hover:bg-gray-50 last:border-0"><div className="flex justify-between items-start"><span className="font-bold text-xs text-indigo-600">{n.id.startsWith('#') ? '' : '#'}{n.id.toUpperCase()}</span></div><p className="text-sm font-medium mt-1">Venda: {formatCurrency(n.total)}</p></div>)}</div></div>}</div>
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                <button onClick={() => window.location.hash = '/'} className="text-gray-500 hover:text-gray-700 font-medium px-3 py-2 text-sm">Voltar à Loja</button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        
        {activeTab === 'inventory' && (
            <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <KpiCard title="Total Investido" value={stats.totalInvested} icon={<Package size={18} />} color="blue" onClick={handleOpenInvestedModal} />
                <KpiCard title="Vendas Reais" value={stats.realizedRevenue} icon={<DollarSign size={18} />} color="indigo" onClick={handleOpenRevenueModal} />
                <KpiCard title="Lucro Líquido" value={stats.realizedProfit} icon={<TrendingUp size={18} />} color={stats.realizedProfit >= 0 ? "green" : "red"} onClick={handleOpenProfitModal} />
                <KpiCard title="Cashback Pendente" value={stats.pendingCashback} icon={<AlertCircle size={18} />} color="yellow" onClick={handleOpenCashbackManager} />
                <div onClick={() => setIsOnlineDetailsOpen(true)} className="p-4 rounded-xl border bg-white shadow-sm flex flex-col justify-between h-full cursor-pointer hover:border-green-300 transition-colors relative overflow-hidden"><div className="flex justify-between items-start mb-2"><span className="text-gray-500 text-xs font-bold uppercase flex items-center gap-1">Online Agora</span><div className="p-1.5 rounded-lg bg-green-50 text-green-600 relative"><Users size={18} /><span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span></div></div><div className="text-2xl font-bold text-green-600 flex items-end gap-2">{onlineUsers.length}<span className="text-xs text-gray-400 font-normal mb-1">visitantes</span></div></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 mb-8 animate-fade-in"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Bot size={20} /></div><div><h3 className="font-bold text-gray-900">Consultor Estratégico IA</h3><p className="text-xs text-gray-500">Pergunte sobre promoções, bundles ou como vender stock parado.</p></div></div><div className="flex flex-col sm:flex-row gap-2"><input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Ex: Como posso vender as TV Boxes H96 mais rápido sem perder dinheiro? Sugere bundles." className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAskAi()} /><button onClick={handleAskAi} disabled={isAiLoading || !aiQuery.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">{isAiLoading ? 'A pensar...' : <><Sparkles size={18} /> Gerar</>}</button></div>{aiResponse && <div className="mt-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-gray-700 text-sm leading-relaxed whitespace-pre-line animate-fade-in-down">{aiResponse}</div>}</div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4 text-xs font-medium text-gray-500"><span>Total: {products.length}</span><span className="w-px h-4 bg-gray-300"></span><span className="text-green-600">Stock: {products.filter(p => p.status !== 'SOLD').length}</span><span className="w-px h-4 bg-gray-300"></span><span className="text-red-600">Esgotados: {products.filter(p => p.status === 'SOLD').length}</span></div><div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4"><div className="flex gap-2 w-full lg:w-auto"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Estados</option><option value="IN_STOCK">Em Stock</option><option value="SOLD">Esgotado</option></select><select value={cashbackFilter} onChange={(e) => setCashbackFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Cashbacks</option><option value="PENDING">Pendente</option><option value="RECEIVED">Recebido</option></select></div><div className="flex gap-2 w-full lg:w-auto"><div className="relative flex-1"><input type="text" placeholder="Pesquisar ou escanear..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/></div>
            
            <button onClick={handleSyncPublicStock} disabled={isSyncingStock} className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1" title="Sincronizar Stock da Loja">{isSyncingStock ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
            <button onClick={() => { setScannerMode('search'); setIsScannerOpen(true); }} className="bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors" title="Escanear Código de Barras"><Camera size={18} /></button>
            <button onClick={() => setIsCalculatorOpen(true)} className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1" title="Calculadora de Lucro"><BrainCircuit size={18} /></button>
            <button onClick={handleImportProducts} disabled={isImporting} className="bg-yellow-500 text-white px-3 py-2 rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1" title="Importar e Corrigir Produtos">{isImporting ? '...' : <UploadCloud size={18} />}</button>
            <button onClick={handleRecalculateData} disabled={isRecalculating} className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1" title="Recalcular Stock e Vendas">{isRecalculating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
            <button onClick={handleAddNew} className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={18} /></button></div></div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr><th className="px-6 py-3 w-10"></th><th className="px-6 py-3">Produto (Loja)</th><th className="px-4 py-3 text-center">Stock Total</th><th className="px-4 py-3 text-center">Estado Geral</th><th className="px-4 py-3 text-right">Preço Loja</th><th className="px-4 py-3 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {groupedInventory.map(([groupId, items]) => {
                    const mainItem = items[0]; const isExpanded = expandedGroups.includes(groupId);
                    const totalStock = items.reduce((acc, i) => acc + Math.max(0, (i.quantityBought || 0) - (i.quantitySold || 0)), 0);
                    return (
                      <React.Fragment key={groupId}>
                        <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-6 py-4"><button onClick={() => toggleGroup(groupId)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">{isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}</button></td>
                          <td className="px-6 py-4"><div className="flex items-center gap-3">{mainItem.images && mainItem.images[0] && (<img src={mainItem.images[0]} className="w-10 h-10 object-cover rounded bg-white border border-gray-200" alt="" />)}<div><div className="font-bold text-gray-900">{mainItem.name}</div><div className="text-xs text-gray-500">{mainItem.category} • {items.length} Lote(s)</div></div></div></td>
                          <td className="px-4 py-4 text-center"><span className={`font-bold px-2 py-1 rounded ${totalStock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{totalStock} un.</span></td>
                          <td className="px-4 py-4 text-center">{mainItem.comingSoon ? (<span className="text-purple-600 font-bold text-xs uppercase bg-purple-100 px-2 py-1 rounded">Em Breve</span>) : (<span className={`text-xs font-bold uppercase ${totalStock > 0 ? 'text-green-600' : 'text-red-500'}`}>{totalStock > 0 ? 'Disponível' : 'Esgotado'}</span>)}</td>
                          <td className="px-4 py-4 text-right font-medium">{formatCurrency(mainItem.salePrice || mainItem.targetSalePrice || 0)}</td>
                          <td className="px-4 py-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => handleEdit(mainItem)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"><Edit2 size={14} /> Editar Loja</button><button onClick={() => handleCreateVariant(mainItem)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Layers size={16} /></button><button onClick={() => handleDeleteGroup(groupId, items)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div></td>
                        </tr>
                        {isExpanded && (
                            <tr className="bg-gray-50/50 border-b border-gray-200"><td colSpan={6} className="px-4 py-4"><div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm ml-10"><table className="w-full text-xs"><thead className="bg-gray-100 text-gray-500 uppercase"><tr><th className="px-4 py-2 text-left">Lote / Variante</th><th className="px-4 py-2 text-left">Origem</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-right">Compra</th><th className="px-4 py-2 text-right">Venda (Estimada)</th><th className="px-4 py-2 text-center">Lucro Unitário</th><th className="px-4 py-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map(p => { const batchStock = (p.quantityBought || 0) - (p.quantitySold || 0); const salePrice = p.salePrice || p.targetSalePrice || 0; const purchasePrice = p.purchasePrice || 0; const cashbackValue = p.cashbackValue || 0; const finalProfit = salePrice - purchasePrice + cashbackValue; const hasLossBeforeCashback = salePrice < purchasePrice; const profitColor = finalProfit > 0 ? 'text-green-600' : finalProfit < 0 ? 'text-red-600' : 'text-gray-500'; return ( <tr key={p.id} className="hover:bg-blue-50 transition-colors"><td className="px-4 py-3"><div className="font-bold whitespace-normal">{new Date(p.purchaseDate).toLocaleDateString()}</div>{p.variant && <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1 rounded">{p.variant}</span>}<div className="text-[10px] text-gray-400 mt-0.5">{p.description?.substring(0, 30)}...</div></td>
<td className="px-4 py-3">
    {p.supplierName ? (
        <div>
            <div className="flex items-center gap-1 font-bold text-gray-700 text-[10px]">
                <Globe size={10} className="text-indigo-500" /> {p.supplierName}
            </div>
            {p.supplierOrderId && (
                <div className="text-[10px] text-gray-500 flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded w-fit mt-1 group cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleCopy(p.supplierOrderId!)} title="Clique para copiar">
                    <FileText size={10} /> {p.supplierOrderId} <Copy size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            )}
        </div>
    ) : <span className="text-gray-400 text-xs">-</span>}
</td>
<td className="px-4 py-3 text-center">
    <div className="flex justify-center text-[10px] mb-1 font-medium text-gray-600"><span>{batchStock} un.</span></div>
    <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden mx-auto">
        <div className={`h-full rounded-full ${ (p.quantityBought || 0) > 0 && ((p.quantitySold || 0) / (p.quantityBought || 1)) >= 1 ? 'bg-gray-400' : 'bg-blue-500'}`} style={{ width: `${(p.quantityBought || 0) > 0 ? (((p.quantitySold || 0) / (p.quantityBought || 1)) * 100) : 0}%` }}></div>
    </div>
    {p.units && p.units.length > 0 && (
    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 max-w-[200px] mx-auto">
        {p.units.sort((a,b) => a.status.localeCompare(b.status)).map(unit => {
            const statusColor = unit.status === 'AVAILABLE' 
                ? 'bg-green-100 text-green-800' 
                : unit.status === 'SOLD' 
                ? 'bg-red-100 text-red-700' 
                : 'bg-yellow-100 text-yellow-800';
            const statusText = unit.status === 'AVAILABLE' ? 'Disponível' : unit.status === 'SOLD' ? 'Vendido' : 'Reservado';
            
            return (
                <div key={unit.id} className="flex justify-between items-center text-[10px] group">
                    <div className="flex items-center gap-2">
                        <span className={`font-mono ${unit.status !== 'AVAILABLE' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{unit.id}</span>
                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>{statusText}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">{new Date(unit.addedAt).toLocaleDateString('pt-PT')}</span>
                        <button onClick={() => handleCopy(unit.id)} title="Copiar S/N" className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Copy size={10} />
                        </button>
                    </div>
                </div>
            );
        })}
    </div>
)}
</td>
<td className="px-4 py-3 text-right">{formatCurrency(p.purchasePrice)}</td><td className="px-4 py-3 text-right text-gray-500">{p.targetSalePrice ? formatCurrency(p.targetSalePrice) : '-'}</td>
<td className="px-4 py-3 text-center">
    {salePrice > 0 ? (
        <div title={`Cálculo: Venda (${formatCurrency(salePrice)}) - Compra (${formatCurrency(purchasePrice)}) ${cashbackValue > 0 ? `+ Cashback (${formatCurrency(cashbackValue)})` : ''}`}>
            <div className={`font-bold text-sm ${profitColor}`}>
                {finalProfit >= 0 ? '+' : ''}{formatCurrency(finalProfit)}
            </div>
            {cashbackValue > 0 && (
                <div className={`text-[10px] font-medium mt-0.5 ${p.cashbackStatus === 'PENDING' ? 'text-yellow-600' : 'text-green-700'}`}>
                    Cashback {p.cashbackStatus === 'PENDING' ? 'Pendente' : 'Recebido'}
                </div>
            )}
            {hasLossBeforeCashback && cashbackValue > 0 && finalProfit > 0 && (
                <div className="text-[10px] font-bold text-orange-500 mt-0.5" title="O preço de venda é inferior ao de compra, mas o cashback compensa.">
                    Lucro c/ Cashback
                </div>
            )}
        </div>
    ) : (
        <span className="text-gray-400 text-xs">-</span>
    )}
</td>
<td className="px-4 py-3 text-right flex justify-end gap-1">{batchStock > 0 && <button onClick={() => openSaleModal(p)} className="text-green-600 hover:bg-green-50 p-1.5 rounded bg-white border border-green-200 shadow-sm" title="Vender deste lote"><DollarSign size={14}/></button>}<button onClick={() => handleEdit(p)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded bg-white border border-gray-200 shadow-sm" title="Editar este lote"><Edit2 size={14}/></button><button onClick={() => handleDelete(p.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded bg-white border border-red-200 shadow-sm" title="Apagar lote"><Trash2 size={14}/></button></td></tr> ); })}</tbody></table></div></td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div></div>
            </>
        )}
        
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><div className="flex justify-between items-center mb-6"><div className="flex items-center gap-4"><h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart2 className="text-indigo-600" /> Faturação Geral</h3><div className="bg-gray-100 p-1 rounded-lg flex gap-1 text-xs font-medium"><button onClick={() => setChartTimeframe('7d')} className={`px-2 py-1 rounded ${chartTimeframe === '7d' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>7D</button><button onClick={() => setChartTimeframe('30d')} className={`px-2 py-1 rounded ${chartTimeframe === '30d' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>30D</button><button onClick={() => setChartTimeframe('1y')} className={`px-2 py-1 rounded ${chartTimeframe === '1y' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>1A</button></div></div><span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Total: {formatCurrency(chartData.totalPeriod)}</span></div><div className="flex items-stretch h-64 gap-4"><div className="flex flex-col justify-between text-xs font-medium text-gray-400 py-2 min-w-[30px] text-right"><span>{formatCurrency(chartData.maxValue)}</span><span>{formatCurrency(chartData.maxValue / 2)}</span><span>0€</span></div><div className="flex items-end flex-1 gap-2 md:gap-4 relative border-l border-b border-gray-200"><div className="absolute w-full border-t border-dashed border-gray-100 top-2 left-0 z-0"></div><div className="absolute w-full border-t border-dashed border-gray-100 top-1/2 left-0 z-0"></div>{chartData.days.map((day, idx) => { const heightPercent = (day.value / chartData.maxValue) * 100; const isZero = day.value === 0; return <div key={idx} className="flex-1 flex flex-col justify-end h-full group relative z-10"><div className={`w-full rounded-t-md transition-all duration-700 ease-out relative group-hover:brightness-110 ${isZero ? 'bg-gray-100' : 'bg-gradient-to-t from-blue-500 to-indigo-600 shadow-lg shadow-indigo-200'}`} style={{ height: isZero ? '4px' : `${heightPercent}%`, minHeight: '4px' }}>{!isZero && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-20">{formatCurrency(day.value)}<div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div></div>}</div><span className="text-[10px] md:text-xs text-gray-500 font-medium mt-2 text-center uppercase tracking-wide">{day.label}</span></div>})}</div></div></div>
              <div className="flex justify-end"><button onClick={() => setIsManualOrderModalOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-bold shadow-md"><ClipboardEdit size={18} /> Registar Encomenda Manual</button></div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase"><tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Total</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100 text-sm">{allOrders.map(order => <tr key={order.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold text-indigo-700">{order.id}</td><td className="px-6 py-4">{order.shippingInfo?.name || 'N/A'}</td><td className="px-6 py-4 font-bold">{formatCurrency(order.total)}</td><td className="px-6 py-4"><select value={order.status} onChange={(e) => handleOrderStatusChange(order.id, e.target.value)} className={`text-xs font-bold px-2 py-1 rounded-full border-none cursor-pointer ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : order.status === 'Enviado' ? 'bg-blue-100 text-blue-800' : order.status === 'Pago' ? 'bg-cyan-100 text-cyan-800' : order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}><option value="Processamento">Processamento</option><option value="Pago">Pago</option><option value="Enviado">Enviado</option><option value="Entregue">Entregue</option><option value="Cancelado">Cancelado</option></select></td><td className="px-6 py-4 text-right flex justify-end items-center gap-2"><button onClick={() => setSelectedOrderDetails(order)} className="text-indigo-600 font-bold text-xs hover:underline">Detalhes</button>{isAdmin && order.status === 'Cancelado' && (<button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Apagar Encomenda"><Trash2 size={16} /></button>)}</td></tr>)}</tbody></table></div></div>
          </div>
        )}
        
        {activeTab === 'clients' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Gestão de Clientes ({allUsers.length})</h3>
                    <div className="relative"><input type="text" placeholder="Pesquisar cliente..." value={clientsSearchTerm} onChange={e => setClientsSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/></div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase"><tr><th className="px-6 py-4">Nome</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Total Gasto</th><th className="px-6 py-4">Nível</th><th className="px-6 py-4">AllPoints</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredClients.map(client => (
                                <tr key={client.uid} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-bold text-gray-900">{client.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{client.email}</td>
                                    <td className="px-6 py-4">{formatCurrency(client.totalSpent || 0)}</td>
                                    <td className="px-6 py-4 font-medium">{client.tier || 'Bronze'}</td>
                                    <td className="px-6 py-4 font-bold text-blue-600">{client.loyaltyPoints || 0}</td>
                                    <td className="px-6 py-4 text-right"><button onClick={() => setSelectedUserDetails(client)} className="text-indigo-600 font-bold text-xs hover:underline">Ver Detalhes</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'coupons' && <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit"><h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus size={20} className="text-green-600" /> Novo Cupão</h3><form onSubmit={handleAddCoupon} className="space-y-4"><div><label className="block text-xs font-bold text-gray-500 uppercase">Código</label><input type="text" required value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})} className="w-full p-2 border border-gray-300 rounded uppercase font-bold tracking-wider" placeholder="NATAL20" /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-gray-500 uppercase">Tipo</label><select value={newCoupon.type} onChange={e => setNewCoupon({...newCoupon, type: e.target.value as any})} className="w-full p-2 border border-gray-300 rounded"><option value="PERCENTAGE">Percentagem (%)</option><option value="FIXED">Valor Fixo (€)</option></select></div><div><label className="text-xs font-bold text-gray-500 uppercase">Valor</label><input type="number" required min="1" value={newCoupon.value} onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})} className="w-full p-2 border border-gray-300 rounded" /></div></div><div><label className="block text-xs font-bold text-gray-500 uppercase">Mínimo Compra (€)</label><input type="number" min="0" value={newCoupon.minPurchase} onChange={e => setNewCoupon({...newCoupon, minPurchase: Number(e.target.value)})} className="w-full p-2 border border-gray-300 rounded" /></div><button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Criar Cupão</button></form></div>
        <div className="md:col-span-2 space-y-4">{isCouponsLoading ? <p>A carregar...</p> : coupons.map(c => <div key={c.id} className={`bg-white p-4 rounded-xl border flex items-center justify-between ${c.isActive ? 'border-gray-200' : 'border-red-100 bg-red-50 opacity-75'}`}><div className="flex items-center gap-4"><div className={`p-3 rounded-lg ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}><TicketPercent size={24} /></div><div><h4 className="font-bold text-lg tracking-wider">{c.code}</h4><p className="text-sm text-gray-600">{c.type === 'PERCENTAGE' ? `${c.value}% Desconto` : `${formatCurrency(c.value)} Desconto`}{c.minPurchase > 0 && ` (Min. ${formatCurrency(c.minPurchase)})`}</p><p className="text-xs text-gray-400 mt-1">Usado {c.usageCount} vezes</p></div></div><div className="flex items-center gap-2"><button onClick={() => handleToggleCoupon(c)} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{c.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}{c.isActive ? 'Ativo' : 'Inativo'}</button><button onClick={() => handleDeleteCoupon(c.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button></div></div>)}{coupons.length === 0 && <p className="text-center text-gray-500 mt-10">Não há cupões criados.</p>}</div></div>}

        {activeTab === 'support' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Headphones className="text-indigo-600"/> Tickets de Suporte</h3>
                    <div className="flex gap-2">
                        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-bold border border-red-100">Abertos: {tickets.filter(t => t.status === 'Aberto').length}</span>
                        <span className="bg-yellow-50 text-yellow-600 px-3 py-1 rounded-lg text-xs font-bold border border-yellow-100">Em Análise: {tickets.filter(t => t.status === 'Em Análise').length}</span>
                        <span className="bg-green-50 text-green-600 px-3 py-1 rounded-lg text-xs font-bold border border-green-100">Resolvidos: {tickets.filter(t => t.status === 'Resolvido').length}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Assunto</th>
                                    <th className="px-6 py-4">Categoria</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {isTicketsLoading ? (<tr><td colSpan={7} className="text-center py-8"><Loader2 className="animate-spin mx-auto text-indigo-500"/></td></tr>) : 
                                tickets.length === 0 ? (<tr><td colSpan={7} className="text-center py-8 text-gray-500">Sem tickets de suporte.</td></tr>) :
                                tickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedTicket(ticket)}>
                                        <td className="px-6 py-4 font-bold text-gray-700">{ticket.id}</td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-900">{ticket.customerName}</p>
                                            <p className="text-xs text-gray-500">{ticket.customerEmail}</p>
                                        </td>
                                        <td className="px-6 py-4 truncate max-w-xs">{ticket.subject}</td>
                                        <td className="px-6 py-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-medium">{ticket.category}</span></td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${ticket.status === 'Aberto' ? 'bg-red-100 text-red-700' : ticket.status === 'Em Análise' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-indigo-600 font-bold text-xs hover:underline">Ver</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>
      
      <ProfitCalculatorModal isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      {selectedUserDetails && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"><div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10"><h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><UserIcon size={20} className="text-indigo-600"/> Detalhes do Cliente</h3><button onClick={() => setSelectedUserDetails(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button></div><div className="flex-1 overflow-y-auto p-6 space-y-6"><div className="flex items-center gap-4"><div className="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center text-2xl font-bold">{selectedUserDetails.name.charAt(0)}</div><div><h4 className="font-bold text-xl">{selectedUserDetails.name}</h4><p className="text-sm text-gray-500">{selectedUserDetails.email}</p></div></div><div className="grid grid-cols-3 gap-4 text-center"><div><p className="text-xs text-gray-500 font-bold uppercase">Total Gasto</p><p className="font-bold text-sm mt-1">{formatCurrency(calculatedTotalSpent)}</p></div><div><p className="text-xs text-gray-500 font-bold uppercase">Nível</p><p className="font-bold text-sm mt-1">{selectedUserDetails.tier || 'Bronze'}</p></div><div><p className="text-xs text-gray-500 font-bold uppercase">AllPoints</p><p className="font-bold text-blue-600 text-sm mt-1">{selectedUserDetails.loyaltyPoints || 0}</p></div></div><div className="pt-6 border-t"><h4 className="font-bold text-gray-800 text-sm mb-3">Histórico de Pontos</h4>{(selectedUserDetails.pointsHistory && selectedUserDetails.pointsHistory.length > 0) ? (<div className="max-h-60 overflow-y-auto space-y-2 pr-2">{selectedUserDetails.pointsHistory.map(h => (<div key={h.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg"><div className="flex flex-col"><span>{h.reason}</span><span className="text-xs text-gray-400">{new Date(h.date).toLocaleString()}</span></div><span className={`font-bold ${h.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{h.amount > 0 ? '+' : ''}{h.amount}</span></div>))}</div>) : (<p className="text-sm text-gray-500 italic">Sem histórico de pontos.</p>)}</div><div className="pt-6 border-t border-dashed"><h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Combine size={16} className="text-orange-500"/> Ferramentas de Gestão</h4><div className="bg-orange-50 p-4 rounded-lg border border-orange-200 space-y-4"><p className="text-sm font-bold text-orange-900">1. Recalcular Dados de Lealdade</p><p className="text-xs text-orange-800 -mt-2">Use esta função para corrigir o "Total Gasto", nível e pontos, com base em todas as encomendas associadas a este cliente.</p><button onClick={handleRecalculateClientData} disabled={isRecalculatingClient} className="w-full bg-orange-500 text-white font-bold py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">{isRecalculatingClient ? <Loader2 className="animate-spin" /> : <><RefreshCw size={14}/> Sincronizar Agora</>}</button></div><div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4 mt-4"><p className="text-sm font-bold text-gray-800">2. Fundir Contas Duplicadas</p><div className="flex gap-2"><input type="email" value={mergeSearchEmail} onChange={(e) => setMergeSearchEmail(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded text-sm" placeholder="Email da conta a fundir" /><button onClick={handleSearchDuplicate} className="bg-gray-700 text-white px-4 rounded font-bold text-sm hover:bg-gray-800">Procurar</button></div>{foundDuplicate && (<div className="bg-white p-4 rounded border border-orange-300 animate-fade-in space-y-2"><h5 className="font-bold text-sm">Conta duplicada encontrada:</h5><p className="text-xs"><strong>Nome:</strong> {foundDuplicate.name}</p><p className="text-xs"><strong>UID:</strong> {foundDuplicate.uid}</p><p className="text-xs"><strong>Pontos a transferir:</strong> {foundDuplicate.loyaltyPoints || 0}</p><p className="text-xs"><strong>Total gasto a somar:</strong> {formatCurrency(duplicateOrdersTotal || 0)}</p><p className="text-xs"><strong>Encomendas a reatribuir:</strong> {duplicateOrdersCount}</p><button onClick={handleConfirmMerge} disabled={isMerging} className="w-full mt-2 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">{isMerging ? <Loader2 className="animate-spin" /> : <><AlertTriangle size={14}/> Confirmar Fusão</>}</button></div>)}</div></div></div></div></div>)}
      <OrderDetailsModal order={selectedOrderDetails} inventoryProducts={products} onClose={() => setSelectedOrderDetails(null)} onUpdateOrder={handleUpdateOrderState} onUpdateTracking={handleUpdateTracking} onCopy={handleCopy} />
      
      {isModalOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"><div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10"><h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">{editingId ? <Edit2 size={20} /> : <Plus size={20} />} {editingId ? 'Editar Lote / Produto' : 'Novo Lote de Stock'}</h2><button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button></div><div className="p-6"><form onSubmit={handleProductSubmit} className="space-y-6"><div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100"><h3 className="text-sm font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><LinkIcon size={16} /> Passo 1: Ligar a Produto da Loja (Opcional)</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Produto da Loja</label><select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={formData.publicProductId} onChange={handlePublicProductSelect}><option value="">-- Nenhum (Apenas Backoffice) --</option>{publicProductsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="text-[10px] text-gray-500 mt-1">Ao selecionar, o nome e categoria são preenchidos automaticamente.</p></div>{selectedPublicProductVariants.length > 0 && <div className="animate-fade-in-down"><label className="block text-xs font-bold text-gray-900 uppercase mb-1 bg-yellow-100 w-fit px-1 rounded">Passo 2: Escolha a Variante</label><select className="w-full p-3 border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white font-bold" value={formData.variant} onChange={(e) => setFormData({...formData, variant: e.target.value})} required><option value="">-- Selecione uma Opção --</option>{selectedPublicProductVariants.map((v, idx) => <option key={idx} value={v.name}>{v.name}</option>)}</select><p className="text-xs text-yellow-700 mt-1 font-medium">⚠ Obrigatório: Este produto tem várias opções.</p></div>}</div><div className="mt-4 pt-4 border-t border-blue-200"><div className="flex items-center justify-between mb-2"><label className="text-xs font-bold text-blue-800 uppercase flex items-center gap-2"><LinkIcon size={12}/> Ligação Manual (Avançado)</label><button type="button" onClick={() => setIsPublicIdEditable(!isPublicIdEditable)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">{isPublicIdEditable ? <Unlock size={10}/> : <Lock size={10}/>} {isPublicIdEditable ? 'Bloquear' : 'Editar ID'}</button></div><div className="flex gap-2 items-center"><input type="text" value={formData.publicProductId} onChange={(e) => setFormData({...formData, publicProductId: e.target.value})} disabled={!isPublicIdEditable} placeholder="ID numérico do produto público" className={`w-full p-2 border rounded-lg text-sm font-mono ${isPublicIdEditable ? 'bg-white border-blue-300' : 'bg-gray-100 text-gray-500'}`}/><div className="text-[10px] text-gray-500 w-full">Para agrupar variantes (ex: cores), use o mesmo ID Público em todos.</div></div></div></div><div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4"><div><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><AlignLeft size={16} /> Descrição Completa</h4><textarea rows={4} className="w-full p-3 border border-gray-300 rounded-lg text-sm" placeholder="Descreva o produto com detalhes..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}/></div><div><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-2"><ImageIcon size={16} /> Galeria de Imagens</h4>{formData.images.length > 0 && (<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">{formData.images.map((img, idx) => (<div key={idx} className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col"><div className="aspect-square relative"><img src={img} alt={`Img ${idx}`} className="w-full h-full object-contain p-1" /><div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">{idx + 1}</div></div><div className="flex border-t border-gray-100 divide-x divide-gray-100"><button type="button" disabled={idx === 0} onClick={() => handleMoveImage(idx, 'left')} className="flex-1 p-1.5 hover:bg-gray-100 disabled:opacity-30 flex justify-center"><ArrowLeft size={14} /></button><button type="button" onClick={() => handleRemoveImage(idx)} className="flex-1 p-1.5 hover:bg-red-50 text-red-500 flex justify-center"><Trash2 size={14} /></button><button type="button" disabled={idx === formData.images.length - 1} onClick={() => handleMoveImage(idx, 'right')} className="flex-1 p-1.5 hover:bg-gray-100 disabled:opacity-30 flex justify-center"><ArrowRightIcon size={14} /></button></div></div>))}</div>)}<div className="flex gap-2"><div className="relative flex-1"><input type="url" placeholder="Cole o link da imagem (ex: imgur.com/...)" className="w-full p-3 border border-gray-300 rounded-lg text-sm pr-20" value={formData.newImageUrl} onChange={e => setFormData({...formData, newImageUrl: e.target.value})} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="absolute right-1 top-1 bottom-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 rounded-md text-xs font-bold flex items-center gap-1 transition-colors" title="Upload do PC">{isUploading && uploadProgress === null ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}</button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange}/></div><button type="button" onClick={handleAddImage} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 rounded-lg font-bold transition-colors">Adicionar</button></div>{isUploading && uploadProgress !== null && (<div className="mt-2"><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div></div><p className="text-xs text-center text-gray-500 mt-1">A carregar... {Math.round(uploadProgress)}%</p></div>)}</div><div><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><ListPlus size={16} /> Destaques / Características Principais</h4>{formData.features.length > 0 && (<div className="space-y-2 mb-3">{formData.features.map((feat, idx) => (<div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200 text-sm"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div><span className="flex-1 text-gray-700">{feat}</span><button type="button" onClick={() => handleRemoveFeature(idx)} className="text-gray-400 hover:text-red-500"><X size={14} /></button></div>))}</div>)}<div className="flex gap-2"><input type="text" placeholder="Ex: Bateria de 24h, WiFi 6..." className="flex-1 p-3 border border-gray-300 rounded-lg text-sm" value={formData.newFeature} onChange={e => setFormData({...formData, newFeature: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}/><button type="button" onClick={handleAddFeature} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 rounded-lg font-bold transition-colors">+ Item</button></div></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Lote</label><input required type="text" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label><select className="w-full p-3 border border-gray-300 rounded-lg" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}><option>TV Box</option><option>Cabos</option><option>Acessórios</option><option>Outros</option></select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200"><div className="md:col-span-2"><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Globe size={16} /> Rastreabilidade do Fornecedor</h4><p className="text-[10px] text-gray-500 mb-3">Preencha para saber a origem deste produto em caso de garantia.</p></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Fornecedor (Ex: Temu)</label><input type="text" placeholder="Temu, AliExpress, Amazon..." className="w-full p-3 border border-gray-300 rounded-lg" value={formData.supplierName} onChange={e => setFormData({...formData, supplierName: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Encomenda Origem</label><input type="text" placeholder="Ex: PO-2023-9999" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.supplierOrderId} onChange={e => setFormData({...formData, supplierOrderId: e.target.value})} /></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Compra</label><input required type="date" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd. Comprada</label><input required type="number" min="1" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.quantityBought} onChange={e => setFormData({...formData, quantityBought: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Compra (Unitário)</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input required type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} /></div></div></div>
      
      <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
          <h4 className="font-bold text-yellow-800 mb-3 text-sm flex items-center gap-2"><Wallet size={16}/> Detalhes do Cashback</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Total</label>
                  <input type="number" step="0.01" className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackValue} onChange={e => setFormData({...formData, cashbackValue: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                  <select className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackStatus} onChange={e => setFormData({...formData, cashbackStatus: e.target.value as any})}>
                      <option value="NONE">Sem Cashback</option>
                      <option value="PENDING">Pendente</option>
                      <option value="RECEIVED">Recebido</option>
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plataforma</label>
                  <input placeholder="Ex: Temu" type="text" className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackPlatform} onChange={e => setFormData({...formData, cashbackPlatform: e.target.value})} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conta Usada</label>
                  <input placeholder="email@exemplo.com" type="text" className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackAccount} onChange={e => setFormData({...formData, cashbackAccount: e.target.value})} />
              </div>
          </div>
          <div className="mt-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Prevista (Opcional)</label>
                <input type="date" className="w-full md:w-1/2 p-2 border border-yellow-200 rounded" value={formData.cashbackExpectedDate} onChange={e => setFormData({...formData, cashbackExpectedDate: e.target.value})} />
          </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-purple-200 mb-6 flex items-center justify-between shadow-sm"><div><h4 className="font-bold text-purple-900 text-sm flex items-center gap-2"><CalendarClock size={16} /> Modo Pré-Lançamento (Em Breve)</h4><p className="text-[10px] text-gray-500 mt-1">Se ativo, o botão de compra muda para "Em Breve" e não permite encomendas, mesmo com stock.</p></div><button type="button" onClick={() => setFormData({...formData, comingSoon: !formData.comingSoon})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.comingSoon ? 'bg-purple-600' : 'bg-gray-200'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${formData.comingSoon ? 'translate-x-6' : 'translate-x-1'}`} /></button></div><div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-6"><h4 className="font-bold text-purple-900 text-sm mb-3 flex items-center gap-2"><Tag size={16} /> Etiquetas de Marketing</h4><div className="flex flex-wrap gap-2">{['NOVIDADE', 'MAIS VENDIDO', 'PROMOÇÃO', 'ESSENCIAL'].map(badge => (<button key={badge} type="button" onClick={() => toggleBadge(badge)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${formData.badges.includes(badge) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>{badge} {formData.badges.includes(badge) && <CheckCircle size={10} className="inline ml-1" />}</button>))}</div><p className="text-[10px] text-purple-700 mt-2">Selecione as etiquetas para destacar este produto na loja online.</p></div><div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mb-4"><label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Variante / Opção (Opcional)</label><input type="text" placeholder="Ex: Azul, XL, 64GB" className="w-full p-3 border border-indigo-200 rounded-lg text-indigo-900 font-bold" value={formData.variant} onChange={e => setFormData({...formData, variant: e.target.value})} /><p className="text-[10px] text-indigo-600 mt-1">Preencha apenas se este produto for uma opção específica (ex: Cor ou Tamanho).</p></div><div className="bg-green-50/50 p-5 rounded-xl border border-green-100"><h3 className="text-sm font-bold text-green-900 uppercase mb-4 flex items-center gap-2"><QrCode size={16} /> Unidades Individuais / Nº de Série</h3><div className="flex gap-2 mb-4"><button type="button" onClick={() => { setScannerMode('add_unit'); setIsScannerOpen(true); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"><Camera size={16}/> Escanear Unidade</button></div><div className="flex gap-2 items-center text-xs text-gray-500 mb-4"><span className="font-bold">OU</span><input value={manualUnitCode} onChange={e => setManualUnitCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if(manualUnitCode.trim()) handleAddUnit(manualUnitCode.trim()); setManualUnitCode(''); } }} type="text" placeholder="Inserir código manualmente" className="flex-1 p-2 border border-gray-300 rounded-lg" /><button type="button" onClick={() => { if(manualUnitCode.trim()) handleAddUnit(manualUnitCode.trim()); setManualUnitCode(''); }} className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"><Plus size={16} /></button></div><div><p className="text-xs font-bold text-gray-600 mb-2">{modalUnits.length} / {formData.quantityBought || 0} unidades registadas</p><div className="flex flex-wrap gap-2">{modalUnits.map(unit => <div key={unit.id} className="bg-white border border-gray-200 text-gray-700 text-xs font-mono px-2 py-1 rounded flex items-center gap-2"><span>{unit.id}</span><button type="button" onClick={() => handleRemoveUnit(unit.id)} className="text-red-400 hover:text-red-600"><X size={12} /></button></div>)}</div></div><div className="bg-gray-100 p-4 rounded-xl border border-gray-200 mt-4"><h4 className="text-sm font-bold text-gray-800 mb-3">Gerador de Etiquetas Internas</h4><p className="text-[10px] text-gray-500 mb-3">Use para produtos sem código de barras. Os códigos gerados são adicionados automaticamente a este lote.</p><div className="flex gap-2"><input type="number" min="1" value={generateQty} onChange={(e) => setGenerateQty(Number(e.target.value))} className="w-20 p-2 border border-gray-300 rounded-lg" /><button type="button" onClick={handleGenerateCodes} className="flex-1 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors">Gerar e Adicionar</button></div>{generatedCodes.length > 0 && (<div className="mt-4 pt-4 border-t border-gray-200"><div className="flex justify-between items-center mb-2"><h5 className="font-bold text-xs text-gray-600">{generatedCodes.length} Códigos na Fila de Impressão:</h5><button type="button" onClick={() => setGeneratedCodes([])} className="text-xs text-red-500 hover:underline">Limpar Fila</button></div><div className="max-h-24 overflow-y-auto bg-white p-2 rounded border border-gray-200 space-y-1">{generatedCodes.map(code => <p key={code} className="text-xs font-mono text-gray-800">{code}</p>)}</div><button type="button" onClick={handlePrintLabels} className="w-full mt-3 bg-indigo-500 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-600"><Printer size={16}/> Imprimir Etiquetas</button></div>)}</div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6 border-gray-100"><div><label className="block text-xs font-bold text-green-700 uppercase mb-1 bg-green-50 w-fit px-1 rounded">Preço Venda (Loja)</label><div className="relative"><span className="absolute left-3 top-3 text-green-600 font-bold">€</span><input type="number" step="0.01" className="w-full pl-8 p-3 border-2 border-green-400 rounded-lg font-bold text-green-800" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} placeholder="Valor Final" /></div><p className="text-[10px] text-gray-500 mt-1">Este é o preço que aparecerá no site.</p></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Alvo (Estimado)</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg text-gray-500" value={formData.targetSalePrice} onChange={e => setFormData({...formData, targetSalePrice: e.target.value})} /></div></div></div>
      
      <div className="border-t pt-4 border-gray-100">
          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-3"><Scale size={16} /> Logística & Peso</h4>
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Peso Unitário (kg)</label>
              <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-400 text-xs font-bold">KG</span>
                  <input 
                      type="number" 
                      step="0.001" 
                      className="w-full pl-10 p-3 border border-gray-300 rounded-lg" 
                      value={formData.weight} 
                      onChange={e => setFormData({...formData, weight: e.target.value})} 
                      placeholder="Ex: 0.350" 
                  />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Essencial para calcular portes de envio automáticos no futuro.</p>
          </div>
      </div>

      {editingId && <div className="border-t pt-6"><h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><History size={20} /> Histórico de Vendas deste Lote</h3>{products.find(p => p.id === editingId)?.salesHistory?.length ? <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-xs text-gray-500 uppercase"><tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Qtd</th><th className="px-4 py-2">Valor</th><th className="px-4 py-2 text-right">Ação</th></tr></thead><tbody className="divide-y divide-gray-200">{products.find(p => p.id === editingId)?.salesHistory?.map((sale) => <tr key={sale.id}><td className="px-4 py-2">{sale.date}</td><td className="px-4 py-2 font-bold">{sale.quantity}</td><td className="px-4 py-2">{formatCurrency(sale.unitPrice * sale.quantity)}</td><td className="px-4 py-2 text-right"><button type="button" onClick={() => handleDeleteSale(sale.id)} className="text-red-500 hover:text-red-700 text-xs font-bold border border-red-200 px-2 py-1 rounded hover:bg-red-50">Anular (Repor Stock)</button></td></tr>)}</tbody></table></div> : <p className="text-gray-500 text-sm italic">Nenhuma venda registada para este lote ainda.</p>}</div>}<div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">Cancelar</button><button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center gap-2"><Save size={20} /> Guardar Lote</button></div></form></div></div></div>}
      
      {isSaleModalOpen && selectedProductForSale && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"><div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0"><h3 className="font-bold text-gray-900 flex items-center gap-2"><DollarSign size={20} className="text-green-600"/> Registar Venda / Baixa</h3><button onClick={() => setIsSaleModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button></div><form onSubmit={handleSaleSubmit} className="p-6 space-y-6"><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><p className="text-xs font-bold text-gray-500 uppercase">Produto</p><p className="font-bold text-gray-900">{selectedProductForSale.name}</p><p className="text-xs text-blue-600">{selectedProductForSale.variant}</p></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Passo 1: Encomenda Online (Obrigatório)</label><select required value={linkedOrderId} onChange={(e) => setLinkedOrderId(e.target.value)} className={`w-full p-2 border rounded-lg focus:ring-2 outline-none transition-colors ${orderMismatchWarning ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`}><option value="">-- Selecione uma encomenda --</option>{pendingOrders.map(o => (<option key={o.id} value={o.id}>{o.id} - {o.shippingInfo?.name} ({formatCurrency(o.total)})</option>))}</select></div>{orderMismatchWarning && (<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded animate-shake flex items-start gap-2"><ShieldAlert size={20} className="shrink-0 mt-0.5" /><div><p className="font-bold text-sm">PRODUTO ERRADO!</p><p className="text-xs">{orderMismatchWarning}</p></div></div>)}{linkedOrderId && !orderMismatchWarning && (<div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 animate-fade-in-down space-y-4"><h4 className="text-sm font-bold text-blue-900 uppercase flex items-center gap-2 border-b border-blue-200 pb-2"><FileText size={14}/> Conferência de Valores</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-600 mb-1">Preço Venda (Real)</label><input type="number" step="0.01" className="w-full p-2 border border-gray-300 rounded bg-white text-sm font-bold text-gray-800" value={saleForm.unitPrice} onChange={e => setSaleForm({...saleForm, unitPrice: e.target.value})}/></div><div><label className="block text-xs font-bold text-gray-600 mb-1">Portes Envio (Cliente)</label><input type="number" step="0.01" className="w-full p-2 border border-gray-300 rounded bg-white text-sm text-gray-800" value={saleForm.shippingCost} onChange={e => setSaleForm({...saleForm, shippingCost: e.target.value})}/></div></div><div className="border-t border-blue-200 pt-4"><h4 className="text-sm font-bold text-blue-900 uppercase flex items-center gap-2 mb-3"><ShieldCheck size={14}/> Verificação de Segurança</h4><div className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${securityCheckPassed ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-200'}`}>{securityCheckPassed ? (<><CheckCircle size={32} className="text-green-600"/><div className="text-center"><p className="font-bold text-green-800">Produto Confirmado!</p><p className="text-xs text-green-700">Pode finalizar a venda.</p></div></>) : (<><div className="w-full flex gap-2"><button type="button" onClick={() => { setScannerMode('verify_product'); setIsScannerOpen(true); }} className="bg-gray-800 text-white p-2 rounded-lg hover:bg-black transition-colors"><Camera size={20}/></button><input type="text" placeholder="Escanear produto para libertar..." className="flex-1 p-2 border border-gray-300 rounded-lg text-sm text-center font-mono uppercase focus:ring-2 focus:ring-red-500 outline-none" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVerifyProduct((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}/></div><p className="text-xs text-red-600 font-bold flex items-center gap-1"><Lock size={12}/> Venda Bloqueada: Confirme o produto físico.</p></>)}</div></div></div>)}{selectedProductForSale.units && selectedProductForSale.units.length > 0 ? (<div><label className="block text-sm font-bold text-gray-700 mb-2">Selecionar Unidades (S/N) a vender</label><div className="flex gap-2 mb-2"><button type="button" onClick={() => { setScannerMode('sell_unit'); setIsScannerOpen(true); }} className="bg-gray-200 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-300"><Camera size={14}/> Escanear S/N</button><select value={manualUnitSelect} onChange={(e) => { if(e.target.value) handleSelectUnitForSale(e.target.value); setManualUnitSelect(''); }} className="flex-1 p-2 border border-gray-300 rounded-lg text-xs"><option value="">-- Selecionar Manualmente --</option>{selectedProductForSale.units.filter(u => u.status === 'AVAILABLE' && !selectedUnitsForSale.includes(u.id)).map(u => (<option key={u.id} value={u.id}>{u.id}</option>))}</select></div><div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-gray-50 rounded-lg border border-gray-200">{selectedUnitsForSale.map(sn => (<div key={sn} className="bg-white border border-green-200 text-green-700 text-xs font-mono px-2 py-1 rounded flex items-center gap-1 shadow-sm">{sn} <button type="button" onClick={() => setSelectedUnitsForSale(prev => prev.filter(s => s !== sn))} className="text-red-400 hover:text-red-600"><X size={12}/></button></div>))}{selectedUnitsForSale.length === 0 && <span className="text-gray-400 text-xs italic">Nenhuma unidade selecionada.</span>}</div><p className="text-xs text-gray-500 mt-1">Quantidade será calculada com base nas unidades selecionadas.</p></div>) : (<div><label className="block text-sm font-bold text-gray-700 mb-1">Quantidade</label><input type="number" min="1" max={selectedProductForSale.quantityBought - selectedProductForSale.quantitySold} required value={saleForm.quantity} onChange={(e) => setSaleForm({...saleForm, quantity: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" /></div>)}<button type="submit" disabled={!!orderMismatchWarning || !securityCheckPassed} className={`w-full font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors ${orderMismatchWarning || !securityCheckPassed ? 'bg-gray-400 cursor-not-allowed text-gray-200' : 'bg-green-600 hover:bg-green-700 text-white'}`}>{!securityCheckPassed ? <Lock size={18}/> : <CheckCircle size={18}/>} {orderMismatchWarning ? 'Bloqueado: Produto Errado' : !securityCheckPassed ? 'Bloqueado: Verificação Pendente' : 'Confirmar Venda'}</button></form></div></div>)}
      
      {isManualOrderModalOpen && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col"><div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10"><h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><ClipboardEdit size={20} className="text-purple-600"/> Criar Encomenda Manual</h3><button onClick={() => setIsManualOrderModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button></div><form onSubmit={handleManualOrderSubmit} className="p-6 space-y-6"><div className="bg-purple-50 p-4 rounded-xl border border-purple-100"><h4 className="font-bold text-purple-900 text-sm mb-3">1. Adicionar Produtos</h4><select onChange={(e) => { addProductToManualOrder(e.target.value); e.target.value = ''; }} className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white mb-4"><option value="">-- Pesquisar Produto --</option>{productsForSelect.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}</select><div className="space-y-2 max-h-40 overflow-y-auto">{manualOrderItems.map((item, idx) => (<div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-purple-100 shadow-sm"><div><p className="font-bold text-sm text-gray-800">{item.name}</p><p className="text-xs text-gray-500">{item.selectedVariant} | {formatCurrency(item.finalPrice)}</p></div><div className="flex items-center gap-3"><div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1"><button type="button" onClick={() => updateManualOrderItemQuantity(`${item.id}|${item.selectedVariant}`, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm hover:bg-gray-50 font-bold">-</button><span className="w-6 text-center text-sm font-bold">{item.quantity}</span><button type="button" onClick={() => updateManualOrderItemQuantity(`${item.id}|${item.selectedVariant}`, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm">+</button></div><p className="font-bold text-purple-700 w-16 text-right">{formatCurrency(item.finalPrice * item.quantity)}</p><button type="button" onClick={() => updateManualOrderItemQuantity(`${item.id}|${item.selectedVariant}`, -999)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div></div>))}{manualOrderItems.length === 0 && <p className="text-center text-gray-400 text-sm py-2">Nenhum produto adicionado.</p>}</div>{manualOrderItems.length > 0 && (<div className="mt-4 pt-4 border-t border-purple-200 flex justify-end"><p className="text-lg font-bold text-gray-900">Total: {formatCurrency(manualOrderItems.reduce((acc, i) => acc + i.finalPrice * i.quantity, 0))}</p></div>)}</div><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><h4 className="font-bold text-gray-800 text-sm mb-3">2. Dados do Cliente</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label><input type="text" required value={manualOrderCustomer.name} onChange={e => setManualOrderCustomer({...manualOrderCustomer, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Nome do Cliente" /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (Opcional)</label><input type="email" value={manualOrderCustomer.email} onChange={e => setManualOrderCustomer({...manualOrderCustomer, email: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="email@exemplo.com" /></div></div><div className="mt-4"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Morada / Notas de Envio</label><textarea required value={manualOrderShipping} onChange={e => setManualOrderShipping(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" rows={2} placeholder="Morada completa ou 'Entrega em mão'" /></div><div className="mt-4"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Pagamento</label><select value={manualOrderPayment} onChange={e => setManualOrderPayment(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg"><option value="MB Way">MB Way</option><option value="Transferência">Transferência Bancária</option><option value="Cobrança">À Cobrança</option><option value="Dinheiro">Dinheiro (Em Mão)</option></select></div></div><button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"><Save size={20} /> Criar Encomenda e Deduzir Stock</button></form></div></div>)}
      
      {detailsModalData && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"><div className="p-6 border-b border-gray-100 flex justify-between items-center"><h3 className="text-xl font-bold text-gray-900">{detailsModalData.title}</h3><button onClick={() => setDetailsModalData(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button></div><div className="flex-1 overflow-y-auto p-0"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0"><tr>{detailsModalData.columns.map((col, idx) => <th key={idx} className="px-6 py-3">{col.header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{detailsModalData.data.map((item, rowIdx) => (<tr key={rowIdx} className="hover:bg-gray-50">{detailsModalData.columns.map((col, colIdx) => (<td key={colIdx} className="px-6 py-3">{typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor]}</td>))}</tr>))}</tbody></table></div><div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center"><span className="font-bold text-gray-500">TOTAL</span><span className="text-xl font-bold text-gray-900">{formatCurrency(detailsModalData.total)}</span></div></div></div>)}
      
      {isScannerOpen && (<BarcodeScanner mode={(scannerMode === 'add_unit' || scannerMode === 'sell_unit' || scannerMode === 'verify_product') ? 'serial' : 'product'} onClose={() => setIsScannerOpen(false)} onCodeSubmit={(code) => { if (scannerMode === 'add_unit') { handleAddUnit(code); setIsScannerOpen(false); } else if (scannerMode === 'sell_unit') { handleSelectUnitForSale(code); setIsScannerOpen(false); } else if (scannerMode === 'search') { setSearchTerm(code); setIsScannerOpen(false); } else if (scannerMode === 'verify_product') { handleVerifyProduct(code); setIsScannerOpen(false); }}} />)}
      
      {notificationModalData && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"><div className="bg-green-600 p-6 text-white flex justify-between items-center"><h3 className="font-bold text-xl flex items-center gap-2"><Mail size={24}/> Notificar Clientes</h3><button onClick={() => setNotificationModalData(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={24}/></button></div><div className="p-6 space-y-4"><p className="text-gray-600">Existem <strong>{notificationModalData.alertsToDelete.length} clientes</strong> à espera do produto <strong>{notificationModalData.productName}</strong>.</p><div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-sm text-yellow-800"><strong>Como enviar:</strong><br/>1. Copie os emails abaixo (BCC).<br/>2. Abra o seu email e cole no campo "BCC" (Cópia Oculta).<br/>3. Copie o Assunto e o Corpo da mensagem.</div><div className="space-y-3"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Emails (BCC)</label><div className="flex gap-2"><input readOnly value={notificationModalData.bcc} className="w-full p-2 bg-gray-50 border rounded text-xs" /><button onClick={() => handleCopyToClipboard(notificationModalData.bcc, 'emails')} className="bg-gray-200 hover:bg-gray-300 p-2 rounded text-gray-700 font-bold text-xs">{copySuccess === 'emails' ? 'Copiado!' : 'Copiar'}</button></div></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assunto</label><div className="flex gap-2"><input readOnly value={notificationModalData.subject} className="w-full p-2 bg-gray-50 border rounded text-xs" /><button onClick={() => handleCopyToClipboard(notificationModalData.subject, 'subject')} className="bg-gray-200 hover:bg-gray-300 p-2 rounded text-gray-700 font-bold text-xs">{copySuccess === 'subject' ? 'Copiado!' : 'Copiar'}</button></div></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mensagem</label><div className="flex gap-2 items-start"><textarea readOnly value={notificationModalData.body} className="w-full h-32 p-2 bg-gray-50 border rounded text-xs resize-none" /><button onClick={() => handleCopyToClipboard(notificationModalData.body, 'body')} className="bg-gray-200 hover:bg-gray-300 p-2 rounded text-gray-700 font-bold text-xs h-full">{copySuccess === 'body' ? 'Copiado!' : 'Copiar'}</button></div></div></div><div className="pt-4 border-t border-gray-100 flex justify-end gap-3"><button onClick={() => setNotificationModalData(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button><button onClick={handleClearSentAlerts} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2"><CheckCircle size={18} /> Já enviei, limpar lista</button></div></div></div></div>)}
      
      {isCashbackManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><Wallet size={20} className="text-yellow-600"/> Gestor Financeiro de Cashback</h3>
                    <button onClick={() => setIsCashbackManagerOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    <div className="flex gap-2 mb-6">
                        <button onClick={() => setCashbackManagerFilter('PENDING')} className={`px-4 py-2 rounded-lg font-bold text-sm ${cashbackManagerFilter === 'PENDING' ? 'bg-yellow-500 text-white shadow' : 'bg-white text-gray-600 border'}`}>A Receber</button>
                        <button onClick={() => setCashbackManagerFilter('ALL')} className={`px-4 py-2 rounded-lg font-bold text-sm ${cashbackManagerFilter === 'ALL' ? 'bg-gray-800 text-white shadow' : 'bg-white text-gray-600 border'}`}>Histórico Completo</button>
                    </div>

                    <div className="space-y-4">
                        {(Object.entries(groupedCashback) as [string, { total: number, items: InventoryProduct[] }][]).map(([account, data]) => {
                            const isExpanded = expandedCashbackAccounts.includes(account);
                            return (
                                <div key={account} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => toggleCashbackAccount(account)}>
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-50 p-2 rounded-full text-blue-600"><AtSign size={20} /></div>
                                            <div>
                                                <h4 className="font-bold text-gray-900">{account}</h4>
                                                <p className="text-xs text-gray-500">{data.items[0]?.cashbackPlatform || 'Plataforma Desconhecida'} • {data.items.length} itens</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xl font-bold text-gray-900">{formatCurrency(data.total)}</span>
                                            {isExpanded ? <ChevronDown size={20} className="text-gray-400"/> : <ChevronRight size={20} className="text-gray-400"/>}
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                                            <table className="w-full text-left text-sm mb-4">
                                                <thead className="text-xs text-gray-500 uppercase bg-gray-100">
                                                    <tr><th>Produto</th><th>Data Compra</th><th>Previsão</th><th>Valor</th><th>Estado</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {data.items.map(item => (
                                                        <tr key={item.id}>
                                                            <td className="py-2 pr-2 font-medium">{item.name} <span className="text-xs text-gray-500 block">{item.variant}</span></td>
                                                            <td className="py-2 text-gray-500 text-xs">{new Date(item.purchaseDate).toLocaleDateString()}</td>
                                                            <td className="py-2 text-gray-500 text-xs font-bold">{item.cashbackExpectedDate ? new Date(item.cashbackExpectedDate).toLocaleDateString() : '-'}</td>
                                                            <td className="py-2 font-bold">{formatCurrency(item.cashbackValue)}</td>
                                                            <td className="py-2"><span className={`text-[10px] px-2 py-1 rounded font-bold ${item.cashbackStatus === 'RECEIVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.cashbackStatus === 'RECEIVED' ? 'Recebido' : 'Pendente'}</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {cashbackManagerFilter === 'PENDING' && (
                                                <div className="flex justify-end">
                                                    <button 
                                                        onClick={() => handleMarkBatchReceived(data.items)}
                                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors"
                                                    >
                                                        <CheckCircle size={16}/> Marcar {formatCurrency(data.total)} como Recebido
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {Object.keys(groupedCashback).length === 0 && <div className="text-center py-12 text-gray-500">Nenhum registo de cashback encontrado.</div>}
                    </div>
                </div>
            </div>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><Headphones size={20} className="text-indigo-600"/> Ticket #{selectedTicket.id}</h3>
                    <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-12 h-12 bg-blue-100 text-primary rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                            {selectedTicket.customerName?.charAt(0)}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">{selectedTicket.customerName}</h4>
                            <p className="text-sm text-gray-500">{selectedTicket.customerEmail}</p>
                            {selectedTicket.orderId && <p className="text-xs text-indigo-600 font-bold mt-1">Enc: {selectedTicket.orderId}</p>}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 mb-2">Resumo da IA</h4>
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-gray-700 text-sm leading-relaxed">
                            {selectedTicket.description}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Prioridade</label>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedTicket.priority === 'Alta' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                {selectedTicket.priority}
                            </span>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                            <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium">{selectedTicket.category}</span>
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        <h4 className="font-bold text-gray-900 mb-4">Ações</h4>
                        <div className="flex gap-2">
                            <a href={`mailto:${selectedTicket.customerEmail}?subject=Re: ${selectedTicket.subject} [Ticket ${selectedTicket.id}]`} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-center hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                                <Mail size={18}/> Responder Email
                            </a>
                            <select 
                                value={selectedTicket.status} 
                                onChange={(e) => handleUpdateTicketStatus(selectedTicket.id, e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg font-bold"
                            >
                                <option value="Aberto">Aberto</option>
                                <option value="Em Análise">Em Análise</option>
                                <option value="Resolvido">Resolvido</option>
                            </select>
                        </div>
                        <button onClick={() => handleDeleteTicket(selectedTicket.id)} className="w-full mt-2 text-red-500 text-xs font-bold hover:underline">Apagar Ticket</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
