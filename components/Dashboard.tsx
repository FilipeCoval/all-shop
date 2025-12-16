import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, ShoppingCart, User, MapPin, BarChart2, TicketPercent, ToggleLeft, ToggleRight, Save, Bell, Truck, Globe, FileText, CheckCircle, Copy, Bot, Send, Users, Eye
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord, Order, Coupon } from '../types';
import { getInventoryAnalysis } from '../services/geminiService';
import { PRODUCTS } from '../constants';
import { db } from '../services/firebaseConfig';

// Utility para formatação de moeda
const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const Dashboard: React.FC = () => {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory();
  
  // MAIN TABS STATE
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'coupons'>('inventory');

  const [searchTerm, setSearchTerm] = useState('');
  
  // AI Consultant State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Filters Inventory
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'SOLD'>('ALL');
  const [cashbackFilter, setCashbackFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'NONE'>('ALL');

  // Modal State (Edit/Create Product)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal State (Register Sale)
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<InventoryProduct | null>(null);
  
  // Notifications State
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [showToast, setShowToast] = useState<Order | null>(null);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- ONLINE USERS STATE ---
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isOnlineDetailsOpen, setIsOnlineDetailsOpen] = useState(false);

  // --- ORDERS MANAGEMENT STATE ---
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  // --- COUPONS MANAGEMENT STATE ---
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isCouponsLoading, setIsCouponsLoading] = useState(false);
  const [newCoupon, setNewCoupon] = useState<Coupon>({
    code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0
  });

  // Form State (Product)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    publicProductId: '' as string,
    variant: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    supplierName: '', 
    supplierOrderId: '', 
    quantityBought: '',
    purchasePrice: '',
    targetSalePrice: '',
    cashbackValue: '',
    cashbackStatus: 'NONE' as CashbackStatus
  });

  // Derived state for variants dropdown in form
  const selectedPublicProductVariants = useMemo(() => {
      if (!formData.publicProductId) return [];
      const prod = PRODUCTS.find(p => p.id === Number(formData.publicProductId));
      return prod?.variants || [];
  }, [formData.publicProductId]);

  // Form State (Sale)
  const [saleForm, setSaleForm] = useState({
    quantity: '1',
    unitPrice: '',
    shippingCost: '', 
    date: new Date().toISOString().split('T')[0],
    notes: '',
    supplierName: '',
    supplierOrderId: ''
  });

  // --- REAL-TIME SALES NOTIFICATIONS ---
  useEffect(() => {
    // Som de notificação (Casino / Coins Jackpot)
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    const mountTime = Date.now();

    const unsubscribe = db.collection('orders')
        .orderBy('date', 'desc')
        .limit(10)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const order = change.doc.data() as Order;
                    const orderTime = new Date(order.date).getTime();
                    
                    if (orderTime > (mountTime - 2000)) {
                        setNotifications(prev => [order, ...prev]);
                        setShowToast(order);
                        if (audioRef.current) {
                            audioRef.current.volume = 0.6; // Volume confortável
                            audioRef.current.play().catch(e => console.log("Audio autoplay blocked", e));
                        }
                        setTimeout(() => setShowToast(null), 5000);
                    }
                }
            });
        });
    return () => unsubscribe();
  }, []);

  // --- REAL-TIME ONLINE USERS ---
  useEffect(() => {
    const unsubscribe = db.collection('online_users').onSnapshot(snapshot => {
        const now = Date.now();
        const activeUsers: any[] = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // Considera online se o último pulso foi há menos de 30 segundos
            if (now - data.lastActive < 30000) {
                activeUsers.push({ id: doc.id, ...data });
            }
        });
        setOnlineUsers(activeUsers);
    });
    return () => unsubscribe();
  }, []);

  // --- FETCH ORDERS ---
  useEffect(() => {
    // Carregar sempre as encomendas para alimentar o gráfico, independentemente da tab
    const unsubscribe = db.collection('orders').orderBy('date', 'desc').onSnapshot(snapshot => {
        const ordersData = snapshot.docs.map(doc => doc.data() as Order);
        setAllOrders(ordersData);
        setIsOrdersLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- FETCH COUPONS ---
  useEffect(() => {
      if (activeTab === 'coupons') {
          setIsCouponsLoading(true);
          const unsubscribe = db.collection('coupons').onSnapshot(snapshot => {
              const couponsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})) as Coupon[];
              setCoupons(couponsData);
              setIsCouponsLoading(false);
          });
          return () => unsubscribe();
      }
  }, [activeTab]);

  // --- COUPON HANDLERS ---
  const handleAddCoupon = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCoupon.code) return;
      try {
          await db.collection('coupons').add({
              ...newCoupon,
              code: newCoupon.code.toUpperCase().trim()
          });
          setNewCoupon({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0 });
          alert("Cupão criado!");
      } catch (err) {
          console.error(err);
          alert("Erro ao criar cupão");
      }
  };

  const handleToggleCoupon = async (coupon: Coupon) => {
      if (!coupon.id) return;
      try {
          await db.collection('coupons').doc(coupon.id).update({ isActive: !coupon.isActive });
      } catch(err) { console.error(err); }
  };

  const handleDeleteCoupon = async (id?: string) => {
      if (!id || !window.confirm("Apagar cupão?")) return;
      try {
          await db.collection('coupons').doc(id).delete();
      } catch(err) { console.error(err); }
  };

  // --- UPDATE ORDER STATUS ---
  const handleOrderStatusChange = async (orderId: string, newStatus: string) => {
      let trackingNumber = undefined;
      
      // Se mudar para "Enviado", pedir número de rastreio
      if (newStatus === 'Enviado') {
          const input = window.prompt("Insira o Número de Rastreio (Ex: DA123456789PT):");
          if (input) {
              trackingNumber = input.trim();
          }
      }

      try {
          const updateData: any = { status: newStatus };
          if (trackingNumber) {
              updateData.trackingNumber = trackingNumber;
          }
          
          await db.collection('orders').doc(orderId).update(updateData);
      } catch (error) { 
          console.error(error); 
          alert("Erro ao atualizar."); 
      }
  };
  
  const handleDeleteOrder = async (orderId: string) => {
      if (!window.confirm("ATENÇÃO: Tem a certeza que quer APAGAR esta encomenda para sempre? Isto é útil para limpar duplicados.")) return;
      try {
          await db.collection('orders').doc(orderId).delete();
      } catch (e) {
          console.error(e);
          alert("Erro ao apagar encomenda");
      }
  };

  const handleUpdateTracking = async (orderId: string, tracking: string) => {
      try {
          await db.collection('orders').doc(orderId).update({ trackingNumber: tracking });
          // Atualiza estado local do modal
          if (selectedOrderDetails) {
              setSelectedOrderDetails({...selectedOrderDetails, trackingNumber: tracking});
          }
      } catch (e) {
          console.error(e);
          alert("Erro ao gravar rastreio");
      }
  };

  // --- UTILS ---
  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  // --- AI HANDLER ---
  const handleAskAi = async () => {
      if (!aiQuery.trim()) return;
      setIsAiLoading(true);
      setAiResponse(null);
      try {
          const response = await getInventoryAnalysis(products, aiQuery);
          setAiResponse(response);
      } catch (e) {
          setAiResponse("Não foi possível processar o pedido.");
      } finally {
          setIsAiLoading(false);
      }
  };

  // --- CHART DATA (ROBUST VERSION) ---
  const chartData = useMemo(() => {
      // Helper para normalizar datas para YYYY-MM-DD local
      const toLocalISO = (dateStr: string) => {
          if (!dateStr) return '';
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '';
          
          // Se já for YYYY-MM-DD simples (vendas manuais), usa direto
          if (dateStr.length === 10 && !dateStr.includes('T')) return dateStr;

          // Se for ISO string (vendas online), extrai ano/mês/dia local
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
      };

      // 1. Extrair vendas manuais (Backoffice)
      const manualSales = products.flatMap(p => 
          (p.salesHistory || []).map(s => ({
              date: toLocalISO(s.date), 
              total: Number(s.quantity) * Number(s.unitPrice)
          }))
      );

      // 2. Extrair vendas online (Orders)
      // IGNORA APENAS O ESTADO 'CANCELADO'
      const onlineOrders = allOrders
          .filter(o => o.status !== 'Cancelado')
          .map(o => ({
              date: toLocalISO(o.date),
              total: Number(o.total)
          }));
      
      const allSales = [...manualSales, ...onlineOrders];
      const days = [];
      const today = new Date();
      let totalPeriod = 0;

      // Loop últimos 7 dias
      for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          
          // Gerar label YYYY-MM-DD baseada na data local do loop
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateLabel = `${year}-${month}-${day}`;

          const totalForDay = allSales.reduce((acc, sale) => {
              return sale.date === dateLabel ? acc + sale.total : acc;
          }, 0);

          totalPeriod += totalForDay;

          days.push({ 
              label: d.toLocaleDateString('pt-PT', { weekday: 'short' }), 
              date: dateLabel, 
              value: totalForDay 
          });
      }
      
      const maxValue = Math.max(...days.map(d => d.value), 1);
      return { days, maxValue, totalPeriod };
  }, [allOrders, products]);

  // --- KPI CALCULATIONS ---
  const stats = useMemo(() => {
    let totalInvested = 0;
    let realizedRevenue = 0;
    let realizedProfit = 0;
    let pendingCashback = 0;
    let potentialProfit = 0;

    products.forEach(p => {
      const invested = p.purchasePrice * p.quantityBought;
      totalInvested += invested;

      let revenue = 0;
      let totalShippingPaid = 0;

      if (p.salesHistory && p.salesHistory.length > 0) {
          revenue = p.salesHistory.reduce((acc, sale) => acc + (sale.quantity * sale.unitPrice), 0);
          totalShippingPaid = p.salesHistory.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0);
      } else {
          revenue = p.salePrice * p.quantitySold;
      }
      realizedRevenue += revenue;
      const cogs = p.quantitySold * p.purchasePrice; 
      const profitFromSales = revenue - cogs - totalShippingPaid;
      const cashback = p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0;
      realizedProfit += profitFromSales + cashback;
      if (p.cashbackStatus === 'PENDING') pendingCashback += p.cashbackValue;
      const remainingStock = p.quantityBought - p.quantitySold;
      if (remainingStock > 0 && p.targetSalePrice) potentialProfit += (p.targetSalePrice - p.purchasePrice) * remainingStock;
    });

    return { totalInvested, realizedRevenue, realizedProfit, pendingCashback, potentialProfit };
  }, [products]);

  // --- HANDLERS PRODUCT ---
  const handleEdit = (product: InventoryProduct) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      category: product.category,
      publicProductId: product.publicProductId ? product.publicProductId.toString() : '',
      variant: product.variant || '',
      purchaseDate: product.purchaseDate,
      supplierName: product.supplierName || '',
      supplierOrderId: product.supplierOrderId || '',
      quantityBought: product.quantityBought.toString(),
      purchasePrice: product.purchasePrice.toString(),
      targetSalePrice: product.targetSalePrice ? product.targetSalePrice.toString() : '',
      cashbackValue: product.cashbackValue.toString(),
      cashbackStatus: product.cashbackStatus
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: 'TV Box',
      publicProductId: '',
      variant: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      supplierName: '',
      supplierOrderId: '',
      quantityBought: '',
      purchasePrice: '',
      targetSalePrice: '',
      cashbackValue: '',
      cashbackStatus: 'NONE'
    });
    setIsModalOpen(true);
  };

  const handlePublicProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value;
      setFormData(prev => ({ ...prev, publicProductId: selectedId, variant: '' }));
      if (selectedId) {
          const publicProd = PRODUCTS.find(p => p.id === Number(selectedId));
          if (publicProd) {
              setFormData(prev => ({ ...prev, publicProductId: selectedId, name: publicProd.name, category: publicProd.category }));
          }
      }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPublicProductVariants.length > 0 && !formData.variant) {
        alert("Este produto tem variantes (ex: Potência, Cor). Por favor selecione qual variante está a registar.");
        return;
    }
    const qBought = Number(formData.quantityBought) || 0;
    const existingProduct = products.find(p => p.id === editingId);
    const currentSold = existingProduct ? existingProduct.quantitySold : 0;
    const safeSalesHistory = (existingProduct && Array.isArray(existingProduct.salesHistory)) ? existingProduct.salesHistory : [];
    const currentSalePrice = existingProduct ? existingProduct.salePrice : 0;

    let status: ProductStatus = 'IN_STOCK';
    if (currentSold >= qBought && qBought > 0) status = 'SOLD';
    else if (currentSold > 0) status = 'PARTIAL';

    const payload: any = {
      name: formData.name,
      category: formData.category,
      publicProductId: formData.publicProductId ? Number(formData.publicProductId) : null,
      variant: formData.variant || null,
      purchaseDate: formData.purchaseDate,
      supplierName: formData.supplierName, 
      supplierOrderId: formData.supplierOrderId, 
      quantityBought: qBought,
      quantitySold: currentSold, 
      salesHistory: safeSalesHistory,
      purchasePrice: Number(formData.purchasePrice) || 0,
      targetSalePrice: formData.targetSalePrice ? Number(formData.targetSalePrice) : null,
      salePrice: currentSalePrice, 
      cashbackValue: Number(formData.cashbackValue) || 0,
      cashbackStatus: formData.cashbackStatus,
      status
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    try {
      if (editingId) await updateProduct(editingId, payload);
      else await addProduct(payload);
      setIsModalOpen(false);
    } catch (err) { console.error("Erro ao guardar produto:", err); alert('Erro ao guardar.'); }
  };

  // --- HANDLERS SALE ---
  const openSaleModal = (product: InventoryProduct) => {
      setSelectedProductForSale(product);
      setSaleForm({
          quantity: '1',
          unitPrice: product.targetSalePrice ? product.targetSalePrice.toString() : '',
          shippingCost: '',
          date: new Date().toISOString().split('T')[0],
          notes: '',
          // Carregar dados existentes para facilitar a atualização
          supplierName: product.supplierName || '',
          supplierOrderId: product.supplierOrderId || ''
      });
      setIsSaleModalOpen(true);
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedProductForSale) return;
      const qty = Number(saleForm.quantity);
      const price = Number(saleForm.unitPrice);
      const shipping = Number(saleForm.shippingCost) || 0;
      if (qty <= 0) return alert("Quantidade deve ser maior que 0");
      const remaining = selectedProductForSale.quantityBought - selectedProductForSale.quantitySold;
      if (qty > remaining) return alert(`Erro: Só tem ${remaining} unidades em stock.`);

      const newSale: SaleRecord = {
          id: Date.now().toString(),
          date: saleForm.date,
          quantity: qty,
          unitPrice: price,
          shippingCost: shipping,
          notes: saleForm.notes || ''
      };

      const updatedHistory = [...(selectedProductForSale.salesHistory || []), newSale];
      const newQuantitySold = selectedProductForSale.quantitySold + qty;
      const totalRevenue = updatedHistory.reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0);
      const totalUnitsSold = updatedHistory.reduce((acc, s) => acc + s.quantity, 0);
      const averageSalePrice = totalUnitsSold > 0 ? totalRevenue / totalUnitsSold : 0;

      let status: ProductStatus = 'IN_STOCK';
      if (newQuantitySold >= selectedProductForSale.quantityBought) status = 'SOLD';
      else if (newQuantitySold > 0) status = 'PARTIAL';

      try {
          // Atualiza a venda E as informações de fornecedor se o utilizador as preencheu
          await updateProduct(selectedProductForSale.id, {
              quantitySold: newQuantitySold,
              salePrice: averageSalePrice,
              salesHistory: updatedHistory,
              status,
              // Atualiza o produto pai com os dados novos se fornecidos
              supplierName: saleForm.supplierName,
              supplierOrderId: saleForm.supplierOrderId
          });
          setIsSaleModalOpen(false);
      } catch (err) { alert("Erro ao registar venda"); console.error(err); }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!editingId) return;
    const product = products.find(p => p.id === editingId);
    if (!product || !product.salesHistory) return;
    const saleToDelete = product.salesHistory.find(s => s.id === saleId);
    if (!saleToDelete) return;
    if (!window.confirm(`Tem a certeza que quer cancelar esta venda de ${saleToDelete.quantity} unidade(s)? O stock será reposto.`)) return;

    const newHistory = product.salesHistory.filter(s => s.id !== saleId);
    const newQuantitySold = product.quantitySold - saleToDelete.quantity;
    const totalRevenue = newHistory.reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0);
    const totalUnitsSold = newHistory.reduce((acc, s) => acc + s.quantity, 0);
    const newAverageSalePrice = totalUnitsSold > 0 ? totalRevenue / totalUnitsSold : 0;

    let newStatus: ProductStatus = 'IN_STOCK';
    if (newQuantitySold >= product.quantityBought && product.quantityBought > 0) newStatus = 'SOLD';
    else if (newQuantitySold > 0) newStatus = 'PARTIAL';

    try {
        await updateProduct(product.id, {
            salesHistory: newHistory,
            quantitySold: Math.max(0, newQuantitySold),
            salePrice: newAverageSalePrice,
            status: newStatus
        });
        alert("Venda anulada e stock reposto com sucesso!");
    } catch (err) { console.error(err); alert("Erro ao anular venda."); }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (window.confirm('Tem a certeza absoluta que quer apagar este registo? Esta ação não pode ser desfeita.')) {
      try { await deleteProduct(id); } catch (error: any) { alert("Erro ao apagar: " + (error.message || "Permissão negada")); }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.supplierOrderId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'IN_STOCK') matchesStatus = p.status !== 'SOLD';
    if (statusFilter === 'SOLD') matchesStatus = p.status === 'SOLD';
    let matchesCashback = true;
    if (cashbackFilter !== 'ALL') matchesCashback = p.cashbackStatus === cashbackFilter;
    return matchesSearch && matchesStatus && matchesCashback;
  });

  const countInStock = products.filter(p => p.status !== 'SOLD').length;
  const countSold = products.filter(p => p.status === 'SOLD').length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 animate-fade-in relative">
      
      {showToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
              <div className="bg-white border-l-4 border-green-500 shadow-2xl rounded-r-lg p-4 flex items-start gap-3 w-80">
                  <div className="text-green-500 bg-green-50 p-2 rounded-full"><DollarSign size={24} /></div>
                  <div className="flex-1">
                      <h4 className="font-bold text-gray-900">Nova Venda Online!</h4>
                      <p className="text-sm text-gray-600 mt-1">Pedido {showToast.id.startsWith('#') ? '' : '#'}{showToast.id.toUpperCase()}</p>
                      <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(showToast.total)}</p>
                  </div>
                  <button onClick={() => setShowToast(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
          </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white"><LayoutDashboard size={24} /></div>
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Gestão Backoffice</h1>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
             <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Package size={16} /> Inventário
             </button>
             <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <ShoppingCart size={16} /> Encomendas
             </button>
             <button onClick={() => setActiveTab('coupons')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'coupons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <TicketPercent size={16} /> Cupões
             </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
                <button onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors">
                    <Bell size={20} />
                    {notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{notifications.length}</span>}
                </button>
                {isNotifDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                        <div className="p-3 border-b border-gray-100 bg-gray-50"><h4 className="text-sm font-bold text-gray-700">Notificações</h4></div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.map((n, idx) => (
                                <div key={idx} className="p-3 border-b border-gray-100 hover:bg-gray-50 last:border-0">
                                    <div className="flex justify-between items-start"><span className="font-bold text-xs text-indigo-600">{n.id.startsWith('#') ? '' : '#'}{n.id.toUpperCase()}</span></div>
                                    <p className="text-sm font-medium mt-1">Venda: {formatCurrency(n.total)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="h-6 w-px bg-gray-200 mx-1"></div>
            <button onClick={() => window.location.hash = '/'} className="text-gray-500 hover:text-gray-700 font-medium px-3 py-2 text-sm">Voltar à Loja</button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        
        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
            <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <KpiCard title="Total Investido" value={stats.totalInvested} icon={<Package size={18} />} color="blue" />
                    <KpiCard title="Vendas Reais" value={stats.realizedRevenue} icon={<DollarSign size={18} />} color="indigo" />
                    <KpiCard title="Lucro Líquido" value={stats.realizedProfit} icon={<TrendingUp size={18} />} color={stats.realizedProfit >= 0 ? "green" : "red"} />
                    <KpiCard title="Cashback Pendente" value={stats.pendingCashback} icon={<AlertCircle size={18} />} color="yellow" />
                    
                    {/* ONLINE USERS CARD */}
                    <div 
                        onClick={() => setIsOnlineDetailsOpen(true)}
                        className="p-4 rounded-xl border bg-white shadow-sm flex flex-col justify-between h-full cursor-pointer hover:border-green-300 transition-colors relative overflow-hidden"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-gray-500 text-xs font-bold uppercase flex items-center gap-1">Online Agora</span>
                            <div className="p-1.5 rounded-lg bg-green-50 text-green-600 relative">
                                <Users size={18} />
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-green-600 flex items-end gap-2">
                            {onlineUsers.length}
                            <span className="text-xs text-gray-400 font-normal mb-1">visitantes</span>
                        </div>
                    </div>
                </div>

                {/* ONLINE USERS DETAILS DRAWER */}
                {isOnlineDetailsOpen && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex justify-end" onClick={() => setIsOnlineDetailsOpen(false)}>
                        <div className="w-80 h-full bg-white shadow-2xl p-6 overflow-y-auto animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900"><Users className="text-green-600" /> Tráfego Real</h3>
                                <button onClick={() => setIsOnlineDetailsOpen(false)}><X size={20} className="text-gray-400" /></button>
                            </div>
                            <div className="space-y-3">
                                {onlineUsers.map(u => (
                                    <div key={u.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-gray-800">{u.userName}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.device === 'Mobile' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.device}</span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 truncate">
                                            <Eye size={12} />
                                            <span className="truncate">{u.page === '#/' ? 'Home' : u.page.replace('#', '')}</span>
                                        </div>
                                        <div className="mt-1 text-[10px] text-gray-400 text-right">
                                            Há {Math.floor((Date.now() - u.lastActive) / 1000)}s
                                        </div>
                                    </div>
                                ))}
                                {onlineUsers.length === 0 && <p className="text-gray-500 text-center text-sm py-4">Ninguém online agora.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* AI CONSULTANT SECTION */}
                <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 mb-8 animate-fade-in">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Bot size={20} /></div>
                        <div>
                            <h3 className="font-bold text-gray-900">Consultor Estratégico IA</h3>
                            <p className="text-xs text-gray-500">Pergunte sobre promoções, bundles ou como vender stock parado.</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={aiQuery} 
                            onChange={(e) => setAiQuery(e.target.value)}
                            placeholder="Ex: Como posso vender as TV Boxes H96 mais rápido sem perder dinheiro? Sugere bundles."
                            className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                        />
                        <button 
                            onClick={handleAskAi}
                            disabled={isAiLoading || !aiQuery.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isAiLoading ? 'A pensar...' : <><Sparkles size={18} /> Gerar</>}
                        </button>
                    </div>

                    {aiResponse && (
                        <div className="mt-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-gray-700 text-sm leading-relaxed whitespace-pre-line animate-fade-in-down">
                            {aiResponse}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4 text-xs font-medium text-gray-500">
                        <span>Total: {products.length}</span><span className="w-px h-4 bg-gray-300"></span>
                        <span className="text-green-600">Stock: {countInStock}</span><span className="w-px h-4 bg-gray-300"></span>
                        <span className="text-red-600">Esgotados: {countSold}</span>
                    </div>
                    <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="flex gap-2 w-full lg:w-auto">
                             <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Estados</option><option value="IN_STOCK">Em Stock</option><option value="SOLD">Esgotado</option></select>
                             <select value={cashbackFilter} onChange={(e) => setCashbackFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Cashbacks</option><option value="PENDING">Pendente</option><option value="RECEIVED">Recebido</option></select>
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                            <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
                            <button onClick={handleAddNew} className="bg-indigo-600 text-white px-3 py-2 rounded-lg"><Plus size={18} /></button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-3">Produto</th>
                                    <th className="px-4 py-3">Origem</th> {/* NOVA COLUNA */}
                                    <th className="px-4 py-3 text-center">Stock</th>
                                    <th className="px-4 py-3 text-right">Compra</th>
                                    <th className="px-4 py-3 text-right">Venda Alvo</th>
                                    <th className="px-4 py-3 text-center">Cashback / Lucro</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                    <th className="px-4 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredProducts.map(p => {
                                    const profitUnit = (p.targetSalePrice || 0) - p.purchasePrice;
                                    const stockPercent = p.quantityBought > 0 ? (p.quantitySold / p.quantityBought) * 100 : 0;
                                    
                                    // CÁLCULO DE LUCRO FINAL PREVISTO
                                    const totalCost = p.quantityBought * p.purchasePrice;
                                    
                                    // 1. Receita Real (Histórico) + Portes Pagos
                                    let realizedRevenue = 0;
                                    let totalShippingPaid = 0;
                                    if (p.salesHistory && p.salesHistory.length > 0) {
                                        realizedRevenue = p.salesHistory.reduce((acc, sale) => acc + (sale.quantity * sale.unitPrice), 0);
                                        totalShippingPaid = p.salesHistory.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0);
                                    } else {
                                        realizedRevenue = p.quantitySold * p.salePrice; 
                                    }

                                    // 2. Receita Potencial (Resto do Stock)
                                    const remainingStock = p.quantityBought - p.quantitySold;
                                    const potentialRevenue = remainingStock * (p.targetSalePrice || 0);
                                    const canCalculate = p.targetSalePrice || (p.quantityBought > 0 && remainingStock === 0);
                                    const totalProjectedRevenue = realizedRevenue + potentialRevenue;
                                    
                                    // Lucro Final = Receita Total - Custos Compra - Portes + Cashback
                                    const projectedFinalProfit = totalProjectedRevenue - totalCost - totalShippingPaid + p.cashbackValue;

                                    // Margem de Lucro %
                                    const margin = projectedFinalProfit > 0 && totalProjectedRevenue > 0 
                                        ? ((projectedFinalProfit / totalProjectedRevenue) * 100).toFixed(0) 
                                        : 0;

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4"><div className="font-bold whitespace-normal min-w-[150px]">{p.name}</div><span className="text-xs text-blue-500">{p.variant}</span></td>
                                            
                                            {/* COLUNA ORIGEM (NOVA) */}
                                            <td className="px-4 py-4">
                                                {p.supplierName ? (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1 font-bold text-gray-700">
                                                            <Globe size={12} className="text-indigo-500" /> {p.supplierName}
                                                        </div>
                                                        {p.supplierOrderId && (
                                                            <div className="text-xs text-gray-500 flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded w-fit mt-1 group cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleCopy(p.supplierOrderId!)} title="Clique para copiar">
                                                                <FileText size={10} /> {p.supplierOrderId} <Copy size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : <span className="text-gray-400 text-xs">-</span>}
                                            </td>

                                            <td className="px-4 py-4 text-center">
                                                <div className="flex justify-between text-xs mb-1 font-medium text-gray-600"><span>{remainingStock} restam</span></div>
                                                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                    <div className={`h-full rounded-full ${stockPercent === 100 ? 'bg-gray-400' : 'bg-blue-500'}`} style={{ width: `${stockPercent}%` }}></div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">{formatCurrency(p.purchasePrice)}</td>
                                            <td className="px-4 py-4 text-right">{p.targetSalePrice ? formatCurrency(p.targetSalePrice) : '-'}</td>
                                            
                                            {/* CASHBACK / LUCRO TOTAL */}
                                            <td className="px-4 py-4 text-center">
                                                {p.cashbackValue > 0 ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${p.cashbackStatus === 'RECEIVED' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                                            {formatCurrency(p.cashbackValue)} {p.cashbackStatus === 'PENDING' && <AlertCircle size={10} />}
                                                        </div>
                                                        {canCalculate && (
                                                            <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap">
                                                                Lucro: <span className={`${projectedFinalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(projectedFinalProfit)}</span>
                                                                {projectedFinalProfit > 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">{margin}%</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-gray-300 text-xs">-</span>
                                                        {canCalculate && (remainingStock === 0 || p.targetSalePrice) && (
                                                            <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap mt-1">
                                                                Lucro: <span className={`${projectedFinalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(projectedFinalProfit)}</span>
                                                                {projectedFinalProfit > 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">{margin}%</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-4 text-center">
                                                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${p.status === 'SOLD' ? 'bg-red-400' : 'bg-green-500'}`}></span>
                                                <span className="text-xs font-medium text-gray-600">{p.status === 'SOLD' ? 'Esgotado' : 'Em Stock'}</span>
                                            </td>
                                            <td className="px-4 py-4 text-right gap-1 flex justify-end">
                                                {p.status !== 'SOLD' && <button onClick={() => openSaleModal(p)} className="bg-green-600 text-white p-1.5 rounded" title="Registar Venda"><DollarSign size={16} /></button>}
                                                <button onClick={() => handleEdit(p)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Editar"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Apagar"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                         <h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart2 className="text-indigo-600" /> Faturação (7 Dias)</h3>
                         <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Total: {formatCurrency(chartData.totalPeriod)}</span>
                    </div>
                    
                    {/* CHART CONTAINER - MODERN STYLE */}
                    <div className="flex items-stretch h-64 gap-4">
                        {/* Y-Axis Labels */}
                        <div className="flex flex-col justify-between text-xs font-medium text-gray-400 py-2 min-w-[30px] text-right">
                            <span>{formatCurrency(chartData.maxValue)}</span>
                            <span>{formatCurrency(chartData.maxValue / 2)}</span>
                            <span>0€</span>
                        </div>

                        {/* Bars Area */}
                        <div className="flex items-end flex-1 gap-2 md:gap-4 relative border-l border-b border-gray-200">
                             {/* Background Grid Lines */}
                            <div className="absolute w-full border-t border-dashed border-gray-100 top-2 left-0 z-0"></div>
                            <div className="absolute w-full border-t border-dashed border-gray-100 top-1/2 left-0 z-0"></div>

                            {chartData.days.map((day, idx) => {
                                const heightPercent = (day.value / chartData.maxValue) * 100;
                                const isZero = day.value === 0;

                                return (
                                    <div key={idx} className="flex-1 flex flex-col justify-end h-full group relative z-10">
                                        {/* Bar */}
                                        <div 
                                            className={`w-full rounded-t-md transition-all duration-700 ease-out relative group-hover:brightness-110
                                                ${isZero ? 'bg-gray-100' : 'bg-gradient-to-t from-blue-500 to-indigo-600 shadow-lg shadow-indigo-200'}
                                            `} 
                                            style={{ 
                                                height: isZero ? '4px' : `${heightPercent}%`,
                                                minHeight: '4px'
                                            }}
                                        >
                                            {/* Tooltip on Hover */}
                                            {!isZero && (
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-20">
                                                    {formatCurrency(day.value)}
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                </div>
                                            )}
                                        </div>
                                        {/* X-Axis Label */}
                                        <span className="text-[10px] md:text-xs text-gray-500 font-medium mt-2 text-center uppercase tracking-wide">{day.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                                <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Total</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Ações</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {allOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold text-indigo-700">{order.id}</td>
                                        <td className="px-6 py-4">{order.shippingInfo?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 font-bold">{formatCurrency(order.total)}</td>
                                        <td className="px-6 py-4">
                                            <select 
                                                value={order.status} 
                                                onChange={(e) => handleOrderStatusChange(order.id, e.target.value)} 
                                                className={`text-xs font-bold px-2 py-1 rounded-full border-none cursor-pointer
                                                    ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : 
                                                    order.status === 'Enviado' ? 'bg-blue-100 text-blue-800' : 
                                                    order.status === 'Cancelado' ? 'bg-red-100 text-red-800' :
                                                    'bg-yellow-100 text-yellow-800'}`}
                                            >
                                                <option value="Processamento">Processamento</option>
                                                <option value="Enviado">Enviado</option>
                                                <option value="Entregue">Entregue</option>
                                                <option value="Cancelado">Cancelado</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end items-center gap-2">
                                            <button onClick={() => setSelectedOrderDetails(order)} className="text-indigo-600 font-bold text-xs hover:underline">Detalhes</button>
                                            <button 
                                                onClick={() => handleDeleteOrder(order.id)} 
                                                className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                                                title="Apagar Duplicado / Remover Encomenda"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* COUPONS TAB */}
        {activeTab === 'coupons' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                {/* Create Coupon Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Plus size={20} className="text-green-600" /> Novo Cupão
                    </h3>
                    <form onSubmit={handleAddCoupon} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Código</label>
                            <input 
                                type="text" 
                                required
                                value={newCoupon.code}
                                onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                                className="w-full p-2 border border-gray-300 rounded uppercase font-bold tracking-wider"
                                placeholder="NATAL20"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Tipo</label>
                                <select 
                                    value={newCoupon.type}
                                    onChange={e => setNewCoupon({...newCoupon, type: e.target.value as any})}
                                    className="w-full p-2 border border-gray-300 rounded"
                                >
                                    <option value="PERCENTAGE">Percentagem (%)</option>
                                    <option value="FIXED">Valor Fixo (€)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Valor</label>
                                <input 
                                    type="number" 
                                    required
                                    min="1"
                                    value={newCoupon.value}
                                    onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})}
                                    className="w-full p-2 border border-gray-300 rounded"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Mínimo Compra (€)</label>
                            <input 
                                type="number" 
                                min="0"
                                value={newCoupon.minPurchase}
                                onChange={e => setNewCoupon({...newCoupon, minPurchase: Number(e.target.value)})}
                                className="w-full p-2 border border-gray-300 rounded"
                            />
                        </div>
                        <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Criar Cupão</button>
                    </form>
                </div>

                {/* Coupons List */}
                <div className="md:col-span-2 space-y-4">
                    {isCouponsLoading ? <p>A carregar...</p> : coupons.map(c => (
                        <div key={c.id} className={`bg-white p-4 rounded-xl border flex items-center justify-between ${c.isActive ? 'border-gray-200' : 'border-red-100 bg-red-50 opacity-75'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                                    <TicketPercent size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg tracking-wider">{c.code}</h4>
                                    <p className="text-sm text-gray-600">
                                        {c.type === 'PERCENTAGE' ? `${c.value}% Desconto` : `${formatCurrency(c.value)} Desconto`}
                                        {c.minPurchase > 0 && ` (Min. ${formatCurrency(c.minPurchase)})`}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">Usado {c.usageCount} vezes</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleToggleCoupon(c)}
                                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                                >
                                    {c.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                    {c.isActive ? 'Ativo' : 'Inativo'}
                                </button>
                                <button onClick={() => handleDeleteCoupon(c.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                    {coupons.length === 0 && <p className="text-center text-gray-500 mt-10">Não há cupões criados.</p>}
                </div>
            </div>
        )}

      </div>
      
      {/* --- MODALS SECTION --- */}

      {/* 1. PRODUCT EDIT/CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {editingId ? <Edit2 size={20} /> : <Plus size={20} />} 
                {editingId ? 'Editar Lote / Produto' : 'Novo Lote de Stock'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24} /></button>
            </div>
            
            <div className="p-6">
                <form onSubmit={handleProductSubmit} className="space-y-8">
                    {/* PASSO 1: Identificação */}
                    <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                        <h3 className="text-sm font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><LinkIcon size={16} /> Passo 1: Ligar a Produto da Loja (Opcional)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Produto da Loja</label>
                                <select 
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    value={formData.publicProductId}
                                    onChange={handlePublicProductSelect}
                                >
                                    <option value="">-- Nenhum (Apenas Backoffice) --</option>
                                    {PRODUCTS.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">Ao selecionar, o nome e categoria são preenchidos automaticamente.</p>
                            </div>
                             {/* SELETOR DE VARIANTE (SÓ APARECE SE O PRODUTO TIVER VARIANTES) */}
                            {selectedPublicProductVariants.length > 0 && (
                                <div className="animate-fade-in-down">
                                    <label className="block text-xs font-bold text-gray-900 uppercase mb-1 bg-yellow-100 w-fit px-1 rounded">Passo 2: Escolha a Variante</label>
                                    <select 
                                        className="w-full p-3 border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white font-bold"
                                        value={formData.variant}
                                        onChange={(e) => setFormData({...formData, variant: e.target.value})}
                                        required
                                    >
                                        <option value="">-- Selecione uma Opção --</option>
                                        {selectedPublicProductVariants.map((v, idx) => (
                                            <option key={idx} value={v.name}>{v.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-yellow-700 mt-1 font-medium">⚠ Obrigatório: Este produto tem várias opções.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dados Gerais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Lote</label>
                            <input required type="text" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                            <select className="w-full p-3 border border-gray-300 rounded-lg" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                <option>TV Box</option><option>Cabos</option><option>Acessórios</option><option>Outros</option>
                            </select>
                        </div>
                    </div>

                    {/* DADOS FORNECEDOR (NOVO) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div className="md:col-span-2">
                             <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Globe size={16} /> Rastreabilidade do Fornecedor</h4>
                             <p className="text-[10px] text-gray-500 mb-3">Preencha para saber a origem deste produto em caso de garantia.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Fornecedor (Ex: Temu)</label>
                            <input type="text" placeholder="Temu, AliExpress, Amazon..." className="w-full p-3 border border-gray-300 rounded-lg" value={formData.supplierName} onChange={e => setFormData({...formData, supplierName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Encomenda Origem</label>
                            <input type="text" placeholder="Ex: PO-2023-9999" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.supplierOrderId} onChange={e => setFormData({...formData, supplierOrderId: e.target.value})} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Compra</label>
                            <input required type="date" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd. Comprada</label>
                            <input required type="number" min="1" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.quantityBought} onChange={e => setFormData({...formData, quantityBought: e.target.value})} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Compra (Unitário)</label>
                             <div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input required type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} /></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6 border-gray-100">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Venda (Alvo/Estimado)</label>
                            <div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg" value={formData.targetSalePrice} onChange={e => setFormData({...formData, targetSalePrice: e.target.value})} /></div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                        <h4 className="font-bold text-yellow-800 mb-3 text-sm">Cashback / Reembolso</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Total</label>
                                <input type="number" step="0.01" className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackValue} onChange={e => setFormData({...formData, cashbackValue: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                                <select className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackStatus} onChange={e => setFormData({...formData, cashbackStatus: e.target.value as any})}>
                                    <option value="NONE">Sem Cashback</option><option value="PENDING">Pendente</option><option value="RECEIVED">Recebido</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* HISTÓRICO DE VENDAS (PERMITE REVERTER STOCK) */}
                    {editingId && (
                        <div className="border-t pt-6">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <History size={20} /> Histórico de Vendas deste Lote
                            </h3>
                            {products.find(p => p.id === editingId)?.salesHistory?.length ? (
                                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
                                            <tr>
                                                <th className="px-4 py-2">Data</th>
                                                <th className="px-4 py-2">Qtd</th>
                                                <th className="px-4 py-2">Valor</th>
                                                <th className="px-4 py-2 text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {products.find(p => p.id === editingId)?.salesHistory?.map((sale) => (
                                                <tr key={sale.id}>
                                                    <td className="px-4 py-2">{sale.date}</td>
                                                    <td className="px-4 py-2 font-bold">{sale.quantity}</td>
                                                    <td className="px-4 py-2">{formatCurrency(sale.unitPrice * sale.quantity)}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteSale(sale.id)}
                                                            className="text-red-500 hover:text-red-700 text-xs font-bold border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                                                        >
                                                            Anular (Repor Stock)
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm italic">Nenhuma venda registada para este lote ainda.</p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center gap-2"><Save size={20} /> Guardar Lote</button>
                    </div>
                </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. SALE REGISTER MODAL */}
      {isSaleModalOpen && selectedProductForSale && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-green-600 p-6 text-white shrink-0">
                      <h3 className="text-xl font-bold flex items-center gap-2"><DollarSign /> Registar Venda</h3>
                      <p className="opacity-90 mt-1 text-sm">{selectedProductForSale.name}</p>
                      <div className="mt-2 text-xs bg-green-700 inline-block px-2 py-1 rounded">Stock Atual: {selectedProductForSale.quantityBought - selectedProductForSale.quantitySold}</div>
                  </div>
                  <div className="overflow-y-auto p-6">
                    <form onSubmit={handleSaleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantidade</label>
                                <input type="number" min="1" max={selectedProductForSale.quantityBought - selectedProductForSale.quantitySold} required className="w-full p-3 border border-gray-300 rounded-lg text-lg font-bold" value={saleForm.quantity} onChange={e => setSaleForm({...saleForm, quantity: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Unitário (€)</label>
                                <input type="number" step="0.01" required className="w-full p-3 border border-gray-300 rounded-lg text-lg" value={saleForm.unitPrice} onChange={e => setSaleForm({...saleForm, unitPrice: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Portes de Envio Pagos (€)</label>
                            <input type="number" step="0.01" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="0.00" value={saleForm.shippingCost} onChange={e => setSaleForm({...saleForm, shippingCost: e.target.value})} />
                            <p className="text-[10px] text-gray-400 mt-1">Se ofereceu portes, deixe 0. Se pagou CTT, coloque aqui o custo.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data da Venda</label>
                            <input type="date" required className="w-full p-3 border border-gray-300 rounded-lg" value={saleForm.date} onChange={e => setSaleForm({...saleForm, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas (Cliente/Origem)</label>
                            <input type="text" className="w-full p-3 border border-gray-300 rounded-lg" placeholder="Ex: Vendido no OLX ao Rui" value={saleForm.notes} onChange={e => setSaleForm({...saleForm, notes: e.target.value})} />
                        </div>

                        {/* ATUALIZAR DADOS DE ORIGEM */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                             <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Globe size={16} /> Atualizar Origem / Garantia</h4>
                             <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fornecedor</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="Ex: Temu, AliExpress" value={saleForm.supplierName} onChange={e => setSaleForm({...saleForm, supplierName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID da Encomenda (Origem)</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="Ex: PO-2023-9999" value={saleForm.supplierOrderId} onChange={e => setSaleForm({...saleForm, supplierOrderId: e.target.value})} />
                                    <p className="text-[10px] text-gray-400 mt-1">Ao preencher, atualiza automaticamente o registo do produto.</p>
                                </div>
                             </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setIsSaleModalOpen(false)} className="px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancelar</button>
                            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg">Confirmar Venda</button>
                        </div>
                    </form>
                  </div>
              </div>
          </div>
      )}

      {/* 3. ORDER DETAILS MODAL */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-indigo-600 p-6 text-white flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2"><ShoppingCart /> Pedido {selectedOrderDetails.id}</h3>
                        <p className="opacity-80 text-sm mt-1">{new Date(selectedOrderDetails.date).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setSelectedOrderDetails(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div>
                        <h4 className="font-bold text-gray-900 border-b pb-2 mb-3 flex items-center gap-2"><User size={18} /> Dados do Cliente</h4>
                        <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2">
                            <p><span className="font-bold text-gray-500">Nome:</span> {selectedOrderDetails.shippingInfo?.name}</p>
                            <p><span className="font-bold text-gray-500">Pagamento:</span> {selectedOrderDetails.shippingInfo?.paymentMethod}</p>
                            <div className="flex items-start gap-1">
                                <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                <span className="text-gray-700">{selectedOrderDetails.shippingInfo?.address}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* TRACKING NUMBER SECTION */}
                    <div>
                        <h4 className="font-bold text-gray-900 border-b pb-2 mb-3 flex items-center gap-2"><Truck size={18} /> Rastreio de Envio</h4>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                             <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Código de Rastreio (CTT)</label>
                             <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="flex-1 p-2 text-sm border border-blue-200 rounded text-gray-700"
                                    placeholder="Ex: DA123456789PT"
                                    value={selectedOrderDetails.trackingNumber || ''}
                                    onChange={(e) => setSelectedOrderDetails({...selectedOrderDetails, trackingNumber: e.target.value})}
                                />
                                <button 
                                    onClick={() => handleUpdateTracking(selectedOrderDetails.id, selectedOrderDetails.trackingNumber || '')}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700"
                                >
                                    Guardar
                                </button>
                             </div>
                             <p className="text-[10px] text-blue-500 mt-1">Este código aparecerá na área do cliente.</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 border-b pb-2 mb-3 flex items-center gap-2"><Package size={18} /> Artigos & Origem</h4>
                        <ul className="space-y-3">
                            {selectedOrderDetails.items.map((item, idx) => {
                                // Tentar encontrar a origem do produto no inventário pelo nome
                                const itemNameClean = item.replace(/^\d+x\s/, '').trim().split('(')[0].trim();
                                const relatedInventoryItem = products.find(p => 
                                    (p.name.includes(itemNameClean) || itemNameClean.includes(p.name)) && 
                                    (p.supplierName || p.supplierOrderId)
                                );

                                return (
                                    <li key={idx} className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                                        <div className="flex items-start gap-2 text-sm">
                                            <div className="bg-indigo-50 text-indigo-600 p-1 rounded font-bold text-xs min-w-[24px] text-center">1x</div>
                                            <span className="text-gray-700 font-medium">{item}</span>
                                        </div>
                                        
                                        {/* EXIBIR ORIGEM SE ENCONTRADA */}
                                        {relatedInventoryItem && (
                                            <div 
                                                className="mt-2 ml-8 bg-green-50 border border-green-100 p-2 rounded-md flex items-start gap-2 group cursor-pointer hover:bg-green-100 transition-colors"
                                                onClick={() => relatedInventoryItem.supplierOrderId && handleCopy(relatedInventoryItem.supplierOrderId)}
                                                title="Clique para copiar ID de Origem"
                                            >
                                                <CheckCircle size={14} className="text-green-600 mt-0.5 shrink-0" />
                                                <div className="text-xs">
                                                    <span className="font-bold text-green-700 block">Origem Detetada: {relatedInventoryItem.supplierName}</span>
                                                    <span className="text-green-600 flex items-center gap-1">
                                                        ID Encomenda: {relatedInventoryItem.supplierOrderId || 'N/A'}
                                                        {relatedInventoryItem.supplierOrderId && <Copy size={10} className="opacity-50 group-hover:opacity-100" />}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        <span className="text-gray-500 font-medium">Total do Pedido</span>
                        <span className="text-2xl font-bold text-indigo-600">{formatCurrency(selectedOrderDetails.total)}</span>
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button onClick={() => setSelectedOrderDetails(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-100">Fechar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{title: string, value: number, icon: React.ReactNode, color: string}> = ({title, value, icon, color}) => {
    const colorClasses: any = { blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600', green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600', yellow: 'bg-yellow-50 text-yellow-600' };
    return (
        <div className={`p-4 rounded-xl border bg-white shadow-sm flex flex-col justify-between h-full`}>
            <div className="flex justify-between items-start mb-2"><span className="text-gray-500 text-xs font-bold uppercase">{title}</span><div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>{icon}</div></div>
            <div className={`text-xl font-bold ${colorClasses[color].split(' ')[1]}`}>{formatCurrency(value)}</div>
        </div>
    );
};

export default Dashboard;
