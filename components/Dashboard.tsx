import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, Calendar, Filter, Wallet, ArrowUpRight, Truck, Bell, Layers, CheckCircle, ShoppingCart, User, MapPin, Smartphone, Eye, BarChart2
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord, Order } from '../types';
import { getInventoryAnalysis } from '../services/geminiService';
import { PRODUCTS } from '../constants'; // Importar produtos públicos para o select
import { db } from '../services/firebaseConfig';

// Utility para formatação de moeda
const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const Dashboard: React.FC = () => {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory();
  
  // MAIN TABS STATE
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders'>('inventory');

  const [searchTerm, setSearchTerm] = useState('');
  const [aiTip, setAiTip] = useState<string | null>(null);
  
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

  // --- ORDERS MANAGEMENT STATE ---
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null); // Para modal de detalhes

  // Form State (Product)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    publicProductId: '' as string,
    variant: '', // NOVO CAMPO
    purchaseDate: new Date().toISOString().split('T')[0],
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
    notes: ''
  });

  // --- REAL-TIME SALES NOTIFICATIONS ---
  useEffect(() => {
    // Som de notificação (opcional, simples beep)
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    // Data de montagem do componente para ignorar encomendas antigas no load inicial
    const mountTime = Date.now();

    const unsubscribe = db.collection('orders')
        .orderBy('date', 'desc')
        .limit(10)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const order = change.doc.data() as Order;
                    const orderTime = new Date(order.date).getTime();
                    
                    // Só notifica se a encomenda foi criada DEPOIS de abrirmos o dashboard (margem de 2s)
                    if (orderTime > (mountTime - 2000)) {
                        setNotifications(prev => [order, ...prev]);
                        setShowToast(order);
                        
                        // Tentar tocar som (browsers bloqueiam autoplay às vezes)
                        if (audioRef.current) {
                            audioRef.current.play().catch(e => console.log("Audio autoplay blocked", e));
                        }

                        // Esconder toast após 5 segundos
                        setTimeout(() => setShowToast(null), 5000);
                    }
                }
            });
        });

    return () => unsubscribe();
  }, []);

  // --- FETCH ORDERS (Only when tab is active) ---
  useEffect(() => {
    if (activeTab === 'orders') {
        setIsOrdersLoading(true);
        const unsubscribe = db.collection('orders')
            .orderBy('date', 'desc')
            .onSnapshot(snapshot => {
                const ordersData = snapshot.docs.map(doc => doc.data() as Order);
                setAllOrders(ordersData);
                setIsOrdersLoading(false);
            }, err => {
                console.error("Erro ao buscar encomendas:", err);
                setIsOrdersLoading(false);
            });
        return () => unsubscribe();
    }
  }, [activeTab]);

  // --- UPDATE ORDER STATUS ---
  const handleOrderStatusChange = async (orderId: string, newStatus: string) => {
      try {
          await db.collection('orders').doc(orderId).update({ status: newStatus });
          // O listener onSnapshot vai atualizar a UI automaticamente
      } catch (error) {
          console.error("Erro ao atualizar estado:", error);
          alert("Erro ao atualizar o estado da encomenda.");
      }
  };

  // --- CHART DATA CALCULATION ---
  const chartData = useMemo(() => {
      const days = [];
      const today = new Date();
      
      // Criar array dos últimos 7 dias
      for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          
          // Somar vendas deste dia
          const totalForDay = allOrders
            .filter(o => o.date.startsWith(dateStr))
            .reduce((acc, o) => acc + o.total, 0);
            
          days.push({
              label: d.toLocaleDateString('pt-PT', { weekday: 'short' }),
              date: dateStr,
              value: totalForDay
          });
      }
      
      const maxValue = Math.max(...days.map(d => d.value), 1); // Evitar divisão por zero
      return { days, maxValue };
  }, [allOrders]);

  // --- KPI CALCULATIONS ---
  const stats = useMemo(() => {
    let totalInvested = 0;
    let realizedRevenue = 0;
    let realizedProfit = 0;
    let pendingCashback = 0;
    let potentialProfit = 0;

    products.forEach(p => {
      // Investimento: Tudo o que comprei
      const invested = p.purchasePrice * p.quantityBought;
      totalInvested += invested;

      // Receita e Custos Reais
      let revenue = 0;
      let totalShippingPaid = 0;

      if (p.salesHistory && p.salesHistory.length > 0) {
          // Soma revenue e portes de cada venda individual
          revenue = p.salesHistory.reduce((acc, sale) => acc + (sale.quantity * sale.unitPrice), 0);
          totalShippingPaid = p.salesHistory.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0);
      } else {
          // Fallback para dados antigos (sem histórico detalhado)
          revenue = p.salePrice * p.quantitySold;
      }
      
      realizedRevenue += revenue;

      // Lucro Realizado
      // Lucro = (Receita - Custo da Mercadoria Vendida - Portes Pagos) + Cashback(se recebido)
      const cogs = p.quantitySold * p.purchasePrice; 
      const profitFromSales = revenue - cogs - totalShippingPaid;
      
      const cashback = p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0;
      realizedProfit += profitFromSales + cashback;

      if (p.cashbackStatus === 'PENDING') {
        pendingCashback += p.cashbackValue;
      }

      // Lucro Potencial (Stock restante * (Preço Alvo - Preço Compra))
      // Nota: Não descontamos portes futuros aqui porque não sabemos quanto serão, assume-se margem bruta.
      const remainingStock = p.quantityBought - p.quantitySold;
      if (remainingStock > 0 && p.targetSalePrice) {
        potentialProfit += (p.targetSalePrice - p.purchasePrice) * remainingStock;
      }
    });

    return { totalInvested, realizedRevenue, realizedProfit, pendingCashback, potentialProfit };
  }, [products]);

  // --- AI TIP ---
  useEffect(() => {
    if (products.length > 0 && !aiTip) {
      getInventoryAnalysis(products).then(setAiTip);
    }
  }, [products, aiTip]);

  // --- HANDLERS PRODUCT ---
  const handleEdit = (product: InventoryProduct) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      category: product.category,
      publicProductId: product.publicProductId ? product.publicProductId.toString() : '',
      variant: product.variant || '',
      purchaseDate: product.purchaseDate,
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
              setFormData(prev => ({
                  ...prev,
                  publicProductId: selectedId,
                  name: publicProd.name,
                  category: publicProd.category
              }));
          }
      }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação extra para variantes
    if (selectedPublicProductVariants.length > 0 && !formData.variant) {
        alert("Este produto tem variantes (ex: Potência, Cor). Por favor selecione qual variante está a registar.");
        return;
    }

    const qBought = Number(formData.quantityBought) || 0;
    
    // Preservar dados existentes se estiver a editar
    const existingProduct = products.find(p => p.id === editingId);
    const currentSold = existingProduct ? existingProduct.quantitySold : 0;
    
    // CRÍTICO: Garantir que salesHistory é um array válido e não undefined
    const safeSalesHistory = (existingProduct && Array.isArray(existingProduct.salesHistory)) 
        ? existingProduct.salesHistory 
        : [];
        
    const currentSalePrice = existingProduct ? existingProduct.salePrice : 0;

    // Calcular status
    let status: ProductStatus = 'IN_STOCK';
    if (currentSold >= qBought && qBought > 0) status = 'SOLD';
    else if (currentSold > 0) status = 'PARTIAL';

    // Campos Opcionais como NULL se vazios (para o Firebase)
    const targetPrice = formData.targetSalePrice ? Number(formData.targetSalePrice) : null;
    const publicId = formData.publicProductId ? Number(formData.publicProductId) : null;

    const payload: any = {
      name: formData.name,
      category: formData.category,
      publicProductId: publicId,
      variant: formData.variant || null,
      purchaseDate: formData.purchaseDate,
      quantityBought: qBought,
      quantitySold: currentSold, 
      salesHistory: safeSalesHistory, // Garante array vazio se undefined
      purchasePrice: Number(formData.purchasePrice) || 0,
      targetSalePrice: targetPrice,
      salePrice: currentSalePrice, 
      cashbackValue: Number(formData.cashbackValue) || 0,
      cashbackStatus: formData.cashbackStatus,
      status
    };
    
    // Remover quaisquer chaves undefined (embora a lógica acima deva prevenir)
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    try {
      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await addProduct(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Erro ao guardar produto:", err);
      alert('Erro ao guardar produto. Verifique a consola.');
    }
  };

  // --- HANDLERS SALE ---
  const openSaleModal = (product: InventoryProduct) => {
      setSelectedProductForSale(product);
      setSaleForm({
          quantity: '1',
          unitPrice: product.targetSalePrice ? product.targetSalePrice.toString() : '',
          shippingCost: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
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
      if (qty > remaining) {
          return alert(`Erro: Só tem ${remaining} unidades em stock.`);
      }

      const newSale: SaleRecord = {
          id: Date.now().toString(),
          date: saleForm.date,
          quantity: qty,
          unitPrice: price,
          shippingCost: shipping,
          notes: saleForm.notes || '' // Garante string vazia se undefined
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
          await updateProduct(selectedProductForSale.id, {
              quantitySold: newQuantitySold,
              salePrice: averageSalePrice, // Atualiza com a média ponderada
              salesHistory: updatedHistory,
              status
          });
          setIsSaleModalOpen(false);
      } catch (err) {
          alert("Erro ao registar venda");
          console.error(err);
      }
  };

  // --- HANDLE DELETE SALE (REVERT STOCK) ---
  const handleDeleteSale = async (saleId: string) => {
    if (!editingId) return;
    
    // 1. Encontrar produto atual
    const product = products.find(p => p.id === editingId);
    if (!product || !product.salesHistory) return;

    const saleToDelete = product.salesHistory.find(s => s.id === saleId);
    if (!saleToDelete) return;

    if (!window.confirm(`Tem a certeza que quer cancelar esta venda de ${saleToDelete.quantity} unidade(s)? O stock será reposto.`)) {
        return;
    }

    // 2. Calcular novo histórico e quantidades
    const newHistory = product.salesHistory.filter(s => s.id !== saleId);
    const newQuantitySold = product.quantitySold - saleToDelete.quantity;

    // Recalcular preço médio
    const totalRevenue = newHistory.reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0);
    const totalUnitsSold = newHistory.reduce((acc, s) => acc + s.quantity, 0);
    const newAverageSalePrice = totalUnitsSold > 0 ? totalRevenue / totalUnitsSold : 0;

    // 3. Recalcular Status
    let newStatus: ProductStatus = 'IN_STOCK';
    if (newQuantitySold >= product.quantityBought && product.quantityBought > 0) newStatus = 'SOLD';
    else if (newQuantitySold > 0) newStatus = 'PARTIAL';

    // 4. Update
    try {
        await updateProduct(product.id, {
            salesHistory: newHistory,
            quantitySold: Math.max(0, newQuantitySold), // Safety
            salePrice: newAverageSalePrice,
            status: newStatus
        });
        alert("Venda anulada e stock reposto com sucesso!");
    } catch (err) {
        console.error(err);
        alert("Erro ao anular venda.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (window.confirm('Tem a certeza absoluta que quer apagar este registo? Esta ação não pode ser desfeita.')) {
      try {
        await deleteProduct(id);
      } catch (error: any) {
        console.error("Erro ao apagar:", error);
        alert("Erro ao apagar: " + (error.message || "Permissão negada"));
      }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'IN_STOCK') matchesStatus = p.status !== 'SOLD';
    if (statusFilter === 'SOLD') matchesStatus = p.status === 'SOLD';

    let matchesCashback = true;
    if (cashbackFilter !== 'ALL') matchesCashback = p.cashbackStatus === cashbackFilter;

    return matchesSearch && matchesStatus && matchesCashback;
  });

  // Summary Counts for Filter Visibility
  const countInStock = products.filter(p => p.status !== 'SOLD').length;
  const countSold = products.filter(p => p.status === 'SOLD').length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 animate-fade-in relative">
      
      {/* TOAST NOTIFICATION (POPUP) */}
      {showToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
              <div className="bg-white border-l-4 border-green-500 shadow-2xl rounded-r-lg p-4 flex items-start gap-3 w-80">
                  <div className="text-green-500 bg-green-50 p-2 rounded-full">
                      <DollarSign size={24} />
                  </div>
                  <div className="flex-1">
                      <h4 className="font-bold text-gray-900">Nova Venda Online!</h4>
                      <p className="text-sm text-gray-600 mt-1">
                          Pedido {showToast.id.startsWith('#') ? '' : '#'}{showToast.id.toUpperCase()}
                      </p>
                      <p className="text-lg font-bold text-green-600 mt-1">
                          {formatCurrency(showToast.total)}
                      </p>
                  </div>
                  <button onClick={() => setShowToast(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                  </button>
              </div>
          </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <LayoutDashboard size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Gestão Backoffice</h1>
          </div>
          
          {/* NAVIGATION TABS */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
             <button 
                onClick={() => setActiveTab('inventory')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Package size={16} /> Inventário
             </button>
             <button 
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <ShoppingCart size={16} /> Encomendas
             </button>
          </div>

          <div className="flex items-center gap-3">
            {/* NOTIFICATIONS BELL */}
            <div className="relative">
                <button 
                    onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors"
                >
                    <Bell size={20} />
                    {notifications.length > 0 && (
                        <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                            {notifications.length}
                        </span>
                    )}
                </button>

                {isNotifDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                            <h4 className="text-sm font-bold text-gray-700">Notificações (Sessão Atual)</h4>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <p className="p-4 text-center text-xs text-gray-500">Sem novas vendas nesta sessão.</p>
                            ) : (
                                notifications.map((n, idx) => (
                                    <div key={idx} className="p-3 border-b border-gray-100 hover:bg-gray-50 last:border-0">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-xs text-indigo-600">{n.id.startsWith('#') ? '' : '#'}{n.id.toUpperCase()}</span>
                                            <span className="text-xs text-gray-400">{new Date(n.date).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-sm font-medium mt-1">Venda: {formatCurrency(n.total)}</p>
                                        <p className="text-xs text-gray-500 truncate">{n.items.join(', ')}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="h-6 w-px bg-gray-200 mx-1"></div>

            <button 
                onClick={() => window.location.hash = '/'}
                className="text-gray-500 hover:text-gray-700 font-medium px-3 py-2 text-sm"
            >
                Voltar à Loja
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        
        {/* =========================================================================
            TAB: INVENTORY (Gestão de Stock)
           ========================================================================= */}
        {activeTab === 'inventory' && (
            <>
                {/* KPI CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <KpiCard 
                    title="Total Investido" 
                    value={stats.totalInvested} 
                    icon={<Package size={18} />} 
                    color="blue" 
                />
                <KpiCard 
                    title="Vendas Reais" 
                    value={stats.realizedRevenue} 
                    icon={<DollarSign size={18} />} 
                    color="indigo" 
                />
                <KpiCard 
                    title="Lucro Líquido (Real)" 
                    value={stats.realizedProfit} 
                    icon={<TrendingUp size={18} />} 
                    color={stats.realizedProfit >= 0 ? "green" : "red"} 
                />
                <KpiCard 
                    title="Cashback Pendente" 
                    value={stats.pendingCashback} 
                    icon={<AlertCircle size={18} />} 
                    color="yellow" 
                />
                </div>

                {/* AI TIP SECTION */}
                {aiTip && (
                <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3 shadow-sm">
                    <div className="bg-white p-1.5 rounded-full shadow-sm text-indigo-600 flex-shrink-0">
                    <Sparkles size={16} />
                    </div>
                    <p className="text-indigo-900 text-sm italic">"{aiTip}"</p>
                </div>
                )}

                {/* TABLE SECTION */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                
                {/* Filter Summary Counters */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4 text-xs font-medium text-gray-500">
                    <span className={`${statusFilter === 'ALL' ? 'text-indigo-600 font-bold' : ''}`}>
                        Total Registos: {products.length}
                    </span>
                    <span className="w-px h-4 bg-gray-300"></span>
                    <span className={`${statusFilter === 'IN_STOCK' ? 'text-green-600 font-bold' : ''}`}>
                        Em Stock: {countInStock}
                    </span>
                    <span className="w-px h-4 bg-gray-300"></span>
                    <span className={`${statusFilter === 'SOLD' ? 'text-red-600 font-bold' : ''}`}>
                        Esgotados: {countSold}
                    </span>
                </div>

                {/* Controls Bar */}
                <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
                        {/* Status Filter */}
                        <div className="relative">
                            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white appearance-none cursor-pointer hover:border-gray-400 shadow-sm font-medium text-gray-700"
                            >
                                <option value="ALL">Mostrar Tudo</option>
                                <option value="IN_STOCK">✅ Em Stock ({countInStock})</option>
                                <option value="SOLD">❌ Esgotados ({countSold})</option>
                            </select>
                        </div>

                        {/* Cashback Filter */}
                        <div className="relative">
                            <Wallet className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <select 
                                value={cashbackFilter} 
                                onChange={(e) => setCashbackFilter(e.target.value as any)}
                                className="pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white appearance-none cursor-pointer hover:border-gray-400 shadow-sm"
                            >
                                <option value="ALL">Todos Cashbacks</option>
                                <option value="PENDING">Pendente</option>
                                <option value="RECEIVED">Recebido</option>
                                <option value="NONE">Sem Cashback</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Pesquisar lote..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                            />
                        </div>
                        <button 
                            onClick={handleAddNew}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center justify-center"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <tr>
                        <th className="px-6 py-3">Lote / Produto</th>
                        <th className="px-4 py-3 text-center">Stock</th>
                        <th className="px-4 py-3 text-right">Compra</th>
                        <th className="px-4 py-3 text-right text-indigo-600">Venda Alvo</th>
                        <th className="px-4 py-3 text-right">Margem Unit.</th>
                        <th className="px-4 py-3 text-center">Cashback / Lucro Total</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading ? (
                        <tr><td colSpan={8} className="p-8 text-center text-gray-500">A carregar dados...</td></tr>
                        ) : filteredProducts.length === 0 ? (
                        <tr><td colSpan={8} className="p-8 text-center text-gray-500">Nenhum registo encontrado.</td></tr>
                        ) : (
                        filteredProducts.map((p) => {
                            const profitUnit = (p.targetSalePrice || 0) - p.purchasePrice;
                            const stockPercent = (p.quantitySold / p.quantityBought) * 100;

                            // --- CÁLCULO DE LUCRO FINAL PREVISTO ---
                            const totalCost = p.quantityBought * p.purchasePrice;
                            
                            // 1. Receita já realizada (Vendas registadas) e Portes já Pagos
                            let realizedRevenue = 0;
                            let totalShippingPaid = 0;

                            if (p.salesHistory && p.salesHistory.length > 0) {
                                realizedRevenue = p.salesHistory.reduce((acc, sale) => acc + (sale.quantity * sale.unitPrice), 0);
                                totalShippingPaid = p.salesHistory.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0);
                            } else {
                                realizedRevenue = p.quantitySold * p.salePrice; // fallback
                            }

                            // 2. Receita Potencial (Stock restante * Preço Alvo)
                            const remainingStock = p.quantityBought - p.quantitySold;
                            const potentialRevenue = remainingStock * (p.targetSalePrice || 0);

                            // Só calcula se houver preço alvo definido ou se já vendeu tudo
                            const canCalculateProjected = p.targetSalePrice || (p.quantityBought > 0 && remainingStock === 0);
                            const totalProjectedRevenue = realizedRevenue + potentialRevenue;
                            
                            // Lucro Final = Receita Total - Custos Compra - Portes Pagos + Cashback
                            const projectedFinalProfit = totalProjectedRevenue - totalCost - totalShippingPaid + p.cashbackValue;

                            return (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 max-w-[200px]">
                                    <div className="font-bold text-gray-900 flex items-center gap-1 truncate" title={p.name}>
                                        {p.name}
                                        {p.publicProductId && <LinkIcon size={12} className="text-indigo-400 flex-shrink-0" />}
                                    </div>
                                    {p.variant && (
                                        <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded mt-1">
                                            {p.variant}
                                        </span>
                                    )}
                                    <div className="text-xs text-gray-500 mt-0.5">{new Date(p.purchaseDate).toLocaleDateString()}</div>
                                </td>

                                <td className="px-4 py-4 w-32">
                                    <div className="flex justify-between text-xs mb-1 font-medium text-gray-600">
                                    <span>{remainingStock} restam</span>
                                    <span className="text-gray-400">/ {p.quantityBought}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${stockPercent === 100 ? 'bg-gray-400' : 'bg-blue-500'}`} 
                                        style={{ width: `${stockPercent}%` }}
                                    ></div>
                                    </div>
                                </td>

                                <td className="px-4 py-4 text-right font-medium text-gray-600">
                                    {formatCurrency(p.purchasePrice)}
                                </td>

                                <td className="px-4 py-4 text-right font-bold text-indigo-700 bg-indigo-50/30">
                                    {p.targetSalePrice ? formatCurrency(p.targetSalePrice) : '-'}
                                </td>

                                <td className="px-4 py-4 text-right">
                                    {p.targetSalePrice ? (
                                        <span className={`font-bold text-xs ${profitUnit > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {profitUnit > 0 ? '+' : ''}{formatCurrency(profitUnit)}
                                        </span>
                                    ) : '-'}
                                    <div className="text-[10px] text-gray-400">s/ cashback</div>
                                </td>

                                <td className="px-4 py-4 text-center">
                                {p.cashbackValue > 0 ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium
                                                ${p.cashbackStatus === 'RECEIVED' ? 'bg-green-50 border-green-200 text-green-700' : 
                                                p.cashbackStatus === 'PENDING' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 
                                                'bg-gray-50 text-gray-500'}
                                        `}>
                                            {formatCurrency(p.cashbackValue)}
                                            {p.cashbackStatus === 'PENDING' && <AlertCircle size={10} />}
                                        </div>
                                        {canCalculateProjected && (
                                            <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap" title="Lucro total estimado (Vendas - Custos - Portes + Cashback)">
                                                Lucro Final: <span className={`${projectedFinalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {formatCurrency(projectedFinalProfit)}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <span className="text-gray-300 text-xs">-</span>
                                        {canCalculateProjected && (remainingStock === 0) && (
                                            <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap mt-1">
                                                Lucro Final: <span className={`${projectedFinalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {formatCurrency(projectedFinalProfit)}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                )}
                                </td>

                                <td className="px-4 py-4 text-center">
                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 
                                        ${p.status === 'SOLD' ? 'bg-red-400' : 'bg-green-500'}
                                    `}></span>
                                    <span className="text-xs font-medium text-gray-600">
                                        {p.status === 'SOLD' ? 'Esgotado' : 'Em Stock'}
                                    </span>
                                </td>

                                <td className="px-4 py-4 text-right flex items-center justify-end gap-1">
                                    {p.status !== 'SOLD' && (
                                        <button 
                                            onClick={() => openSaleModal(p)} 
                                            className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-md shadow-sm transition-colors"
                                            title="Registrar Venda"
                                        >
                                            <DollarSign size={16} />
                                        </button>
                                    )}
                                    <button onClick={() => handleEdit(p)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors" title="Editar"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition-colors" title="Apagar"><Trash2 size={16} /></button>
                                </td>
                                </tr>
                            );
                        })
                        )}
                    </tbody>
                    </table>
                </div>
                </div>
            </>
        )}

        {/* =========================================================================
            TAB: ORDERS (Gestão de Encomendas)
           ========================================================================= */}
        {activeTab === 'orders' && (
            <div className="space-y-6">
                
                {/* SALES CHART (LAST 7 DAYS) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <BarChart2 className="text-indigo-600" /> Faturação (Últimos 7 Dias)
                    </h3>
                    <div className="flex items-end justify-between h-48 gap-2">
                        {chartData.days.map((day, idx) => {
                            const heightPercent = (day.value / chartData.maxValue) * 100;
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center group">
                                    <div className="w-full bg-gray-100 rounded-t-lg relative flex items-end justify-center h-full hover:bg-gray-200 transition-colors">
                                        <div 
                                            className="w-full mx-1 bg-indigo-500 rounded-t-lg transition-all duration-500 group-hover:bg-indigo-600 relative"
                                            style={{ height: `${heightPercent}%` }}
                                        >
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatCurrency(day.value)}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-500 font-medium mt-2">{day.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-gray-200 bg-gray-50/50">
                        <h2 className="font-bold text-gray-800">Todas as Encomendas</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">ID / Data</th>
                                    <th className="px-6 py-4">Cliente (Envio)</th>
                                    <th className="px-6 py-4">Total</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {isOrdersLoading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">A carregar encomendas...</td></tr>
                                ) : allOrders.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhuma encomenda registada.</td></tr>
                                ) : (
                                    allOrders.map(order => (
                                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-indigo-700 block text-xs md:text-sm">
                                                    {order.id.startsWith('#') ? '' : '#'}{order.id.toUpperCase()}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(order.date).toLocaleDateString()} {new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {order.shippingInfo ? (
                                                    <div>
                                                        <span className="font-bold text-gray-900 block">{order.shippingInfo.name}</span>
                                                        <span className="text-xs text-gray-500 truncate max-w-[150px] block">
                                                            {order.shippingInfo.address.split(',')[0]}...
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">Dados não gravados</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-900">
                                                {formatCurrency(order.total)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <select 
                                                    value={order.status}
                                                    onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
                                                    className={`text-xs font-bold px-2 py-1 rounded-full border-none focus:ring-2 cursor-pointer
                                                        ${order.status === 'Entregue' ? 'bg-green-100 text-green-800 focus:ring-green-500' : 
                                                        order.status === 'Enviado' ? 'bg-blue-100 text-blue-800 focus:ring-blue-500' : 
                                                        'bg-yellow-100 text-yellow-800 focus:ring-yellow-500'}
                                                    `}
                                                >
                                                    <option value="Processamento">Processamento</option>
                                                    <option value="Enviado">Enviado</option>
                                                    <option value="Entregue">Entregue</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => setSelectedOrderDetails(order)}
                                                    className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-indigo-100"
                                                >
                                                    Ver Detalhes
                                                </button>
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
      </div>

      {/* --- ORDER DETAILS MODAL --- */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-900">Detalhes da Encomenda</h3>
                    <button onClick={() => setSelectedOrderDetails(null)} className="p-2 hover:bg-gray-200 rounded-full">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    {/* Header Info */}
                    <div className="flex justify-between items-center">
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold">
                            {selectedOrderDetails.id}
                        </span>
                        <span className="text-gray-500 text-sm">
                            {new Date(selectedOrderDetails.date).toLocaleString()}
                        </span>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                            <Truck size={12} /> Dados de Envio
                        </h4>
                        {selectedOrderDetails.shippingInfo ? (
                            <div className="space-y-2 text-sm">
                                <p><span className="font-semibold">Nome:</span> {selectedOrderDetails.shippingInfo.name}</p>
                                <p><span className="font-semibold">Morada:</span> {selectedOrderDetails.shippingInfo.address}</p>
                                <p><span className="font-semibold">Pagamento:</span> {selectedOrderDetails.shippingInfo.paymentMethod}</p>
                                {selectedOrderDetails.shippingInfo.phone && (
                                    <p><span className="font-semibold">Telemóvel:</span> {selectedOrderDetails.shippingInfo.phone}</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-red-500 italic">Dados de envio não registados nesta versão.</p>
                        )}
                    </div>

                    {/* Items List */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                            <ShoppingCart size={12} /> Artigos
                        </h4>
                        <ul className="space-y-2">
                            {selectedOrderDetails.items.map((item, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-sm border-b border-gray-50 pb-2 last:border-0">
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-100">
                            <span className="font-bold text-gray-600">Total</span>
                            <span className="font-bold text-xl text-indigo-600">
                                {formatCurrency(selectedOrderDetails.total)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 text-center">
                    <button 
                        onClick={() => setSelectedOrderDetails(null)}
                        className="text-gray-500 hover:text-gray-800 text-sm font-medium"
                    >
                        Fechar Janela
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- PRODUCT MODAL (Create/Edit) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {editingId ? <Edit2 size={20} /> : <Plus size={20} />} 
                {editingId ? 'Editar Lote' : 'Novo Lote de Stock'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleProductSubmit} className="overflow-y-auto p-8 space-y-6">
              
              {/* STEP 1: Product Selection */}
              <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                  <label className="block text-sm font-bold text-indigo-900 mb-2">Passo 1: Ligar a Produto da Loja (Obrigatório)</label>
                  <div className="relative">
                      <select 
                          value={formData.publicProductId}
                          onChange={handlePublicProductSelect}
                          className="w-full p-3 pl-4 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                      >
                          <option value="">-- Selecione um produto --</option>
                          {PRODUCTS.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                  </div>
                  <p className="text-xs text-indigo-600 mt-2">
                    Isto liga o stock ao site para mostrar "Esgotado" automaticamente.
                  </p>
              </div>

              {/* STEP 2: Variants (Conditional) */}
              {selectedPublicProductVariants.length > 0 && (
                  <div className="bg-yellow-50 p-5 rounded-xl border border-yellow-200 animate-slide-in">
                      <label className="block text-sm font-bold text-yellow-900 mb-2 flex items-center gap-2">
                          <AlertCircle size={16} /> Passo 2: Escolha a Variante
                      </label>
                      <select 
                          required
                          value={formData.variant}
                          onChange={(e) => setFormData({...formData, variant: e.target.value})}
                          className="w-full p-3 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white font-bold"
                      >
                          <option value="">-- Selecione a Opção (ex: 33W) --</option>
                          {selectedPublicProductVariants.map((v, idx) => (
                              <option key={idx} value={v.name}>{v.name}</option>
                          ))}
                      </select>
                  </div>
              )}

              {/* STEP 3: Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Lote (Interno)</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: Lote Xiaomi Jan/24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Compra</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({...formData, purchaseDate: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Comprada</label>
                  <input 
                    type="number" 
                    required 
                    min="1"
                    value={formData.quantityBought}
                    onChange={(e) => setFormData({...formData, quantityBought: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custo Unitário (€)</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({...formData, purchasePrice: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço Venda Alvo (€)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={formData.targetSalePrice}
                    onChange={(e) => setFormData({...formData, targetSalePrice: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Wallet size={16} className="text-gray-500" /> Cashback / Reembolso
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Valor Total Cashback (€)</label>
                            <input 
                                type="number" 
                                min="0"
                                step="0.01"
                                value={formData.cashbackValue}
                                onChange={(e) => setFormData({...formData, cashbackValue: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                            <select 
                                value={formData.cashbackStatus}
                                onChange={(e) => setFormData({...formData, cashbackStatus: e.target.value as any})}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                            >
                                <option value="NONE">Nenhum</option>
                                <option value="PENDING">Pendente</option>
                                <option value="RECEIVED">Recebido</option>
                            </select>
                        </div>
                    </div>
                </div>
              </div>

              {/* SALES HISTORY MANAGEMENT */}
              {editingId && products.find(p => p.id === editingId)?.salesHistory && (products.find(p => p.id === editingId)?.salesHistory?.length || 0) > 0 && (
                  <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <History size={16} className="text-gray-500" /> Histórico de Vendas deste Lote
                      </h4>
                      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                          <table className="w-full text-xs text-left">
                              <thead className="bg-gray-100 text-gray-500 font-bold uppercase">
                                  <tr>
                                      <th className="p-3">Data</th>
                                      <th className="p-3">Qtd</th>
                                      <th className="p-3">Preço</th>
                                      <th className="p-3">Notas</th>
                                      <th className="p-3 text-right">Ação</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                  {products.find(p => p.id === editingId)?.salesHistory?.map(sale => (
                                      <tr key={sale.id} className="hover:bg-gray-100">
                                          <td className="p-3">{new Date(sale.date).toLocaleDateString()}</td>
                                          <td className="p-3 font-bold">{sale.quantity}</td>
                                          <td className="p-3">{formatCurrency(sale.unitPrice)}</td>
                                          <td className="p-3 text-gray-500 truncate max-w-[100px]">{sale.notes}</td>
                                          <td className="p-3 text-right">
                                              <button 
                                                  type="button"
                                                  onClick={() => handleDeleteSale(sale.id)}
                                                  className="text-red-500 hover:bg-red-100 p-1.5 rounded transition-colors"
                                                  title="Apagar venda e devolver stock"
                                              >
                                                  <Trash2 size={14} />
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Guardar Lote</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SALE MODAL --- */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 bg-green-50">
              <h2 className="text-xl font-bold text-green-900 flex items-center gap-2">
                <DollarSign size={24} /> Registar Venda
              </h2>
              <p className="text-sm text-green-700 mt-1">{selectedProductForSale?.name}</p>
            </div>
            
            <form onSubmit={handleSaleSubmit} className="p-6 space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                  <input 
                    type="number" 
                    required 
                    min="1"
                    max={selectedProductForSale ? selectedProductForSale.quantityBought - selectedProductForSale.quantitySold : 1}
                    value={saleForm.quantity}
                    onChange={(e) => setSaleForm({...saleForm, quantity: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Stock disponível: {selectedProductForSale ? selectedProductForSale.quantityBought - selectedProductForSale.quantitySold : 0}</p>
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unitário de Venda (€)</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    step="0.01"
                    value={saleForm.unitPrice}
                    onChange={(e) => setSaleForm({...saleForm, unitPrice: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  />
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custo de Envio Suportado (€)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={saleForm.shippingCost}
                    onChange={(e) => setSaleForm({...saleForm, shippingCost: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Ex: 3.50 (se ofereceu portes)"
                  />
                  <p className="text-xs text-gray-400 mt-1">Preencha apenas se pagou o envio do seu bolso.</p>
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                  <textarea 
                    value={saleForm.notes}
                    onChange={(e) => setSaleForm({...saleForm, notes: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none h-20 resize-none"
                    placeholder="Ex: Vendido no OLX, Cliente Filipe..."
                  />
               </div>

               <button type="submit" className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 mt-4">
                  Confirmar Venda
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente Auxiliar KPI
const KpiCard: React.FC<{title: string, value: number, icon: React.ReactNode, color: string}> = ({title, value, icon, color}) => {
    const colorClasses: {[key: string]: string} = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    };
    
    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <div className={`p-4 rounded-xl border ${colors.split(' ')[2]} bg-white shadow-sm flex flex-col justify-between h-full`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</span>
                <div className={`p-1.5 rounded-lg ${colors.split(' ')[0]} ${colors.split(' ')[1]}`}>
                    {icon}
                </div>
            </div>
            <div className={`text-xl lg:text-2xl font-bold ${colors.split(' ')[1]}`}>
                {formatCurrency(value)}
            </div>
        </div>
    );
};

export default Dashboard;
