
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, Calendar, Filter, Wallet, ArrowUpRight, Truck
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord } from '../types';
import { getInventoryAnalysis } from '../services/geminiService';
import { PRODUCTS } from '../constants'; // Importar produtos públicos para o select

const Dashboard: React.FC = () => {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [aiTip, setAiTip] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'SOLD'>('ALL');
  const [cashbackFilter, setCashbackFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'NONE'>('ALL');

  // Modal State (Edit/Create Product)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal State (Register Sale)
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<InventoryProduct | null>(null);
  
  // Form State (Product)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    publicProductId: '' as string,
    purchaseDate: new Date().toISOString().split('T')[0],
    quantityBought: '',
    purchasePrice: '',
    targetSalePrice: '',
    cashbackValue: '',
    cashbackStatus: 'NONE' as CashbackStatus
  });

  // Form State (Sale)
  const [saleForm, setSaleForm] = useState({
    quantity: '1',
    unitPrice: '',
    shippingCost: '', // NOVO CAMPO: PORTES
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

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
      setFormData(prev => ({ ...prev, publicProductId: selectedId }));

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
    
    const qBought = Number(formData.quantityBought) || 0;
    
    // Preservar dados existentes se estiver a editar
    const existingProduct = products.find(p => p.id === editingId);
    const currentSold = existingProduct ? existingProduct.quantitySold : 0;
    const currentHistory = existingProduct?.salesHistory || [];
    const currentSalePrice = existingProduct ? existingProduct.salePrice : 0;

    // Calcular status
    let status: ProductStatus = 'IN_STOCK';
    if (currentSold >= qBought && qBought > 0) status = 'SOLD';
    else if (currentSold > 0) status = 'PARTIAL';

    // Campos Opcionais como NULL se vazios (para o Firebase)
    const targetPrice = formData.targetSalePrice ? Number(formData.targetSalePrice) : null;
    const publicId = formData.publicProductId ? Number(formData.publicProductId) : null;

    const payload = {
      name: formData.name,
      category: formData.category,
      publicProductId: publicId,
      purchaseDate: formData.purchaseDate,
      quantityBought: qBought,
      quantitySold: currentSold, 
      salesHistory: currentHistory || [], // Garante array vazio se undefined
      purchasePrice: Number(formData.purchasePrice) || 0,
      targetSalePrice: targetPrice,
      salePrice: currentSalePrice, 
      cashbackValue: Number(formData.cashbackValue) || 0,
      cashbackStatus: formData.cashbackStatus,
      status
    };

    try {
      if (editingId) {
        await updateProduct(editingId, payload as any);
      } else {
        await addProduct(payload as any);
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
          notes: saleForm.notes
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 animate-fade-in">
      
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <LayoutDashboard size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Gestão Backoffice</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => window.location.hash = '/'}
                className="text-gray-500 hover:text-gray-700 font-medium px-3 py-2 text-sm"
            >
                Voltar à Loja
            </button>
            <button 
                onClick={handleAddNew}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors text-sm"
            >
                <Plus size={18} /> <span className="hidden sm:inline">Novo Lote</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        
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
          
          {/* Controls Bar */}
          <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4 bg-gray-50/50">
            <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
                {/* Status Filter */}
                <div className="relative">
                    <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white appearance-none cursor-pointer hover:border-gray-400"
                    >
                        <option value="ALL">Todos os Estados</option>
                        <option value="IN_STOCK">Em Stock (À Venda)</option>
                        <option value="SOLD">Esgotados</option>
                    </select>
                </div>

                {/* Cashback Filter */}
                <div className="relative">
                    <Wallet className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <select 
                        value={cashbackFilter} 
                        onChange={(e) => setCashbackFilter(e.target.value as any)}
                        className="pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white appearance-none cursor-pointer hover:border-gray-400"
                    >
                        <option value="ALL">Todos Cashbacks</option>
                        <option value="PENDING">Pendente</option>
                        <option value="RECEIVED">Recebido</option>
                        <option value="NONE">Sem Cashback</option>
                    </select>
                </div>
            </div>

            <div className="relative w-full lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Pesquisar lote..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
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
                            <div className="text-xs text-gray-500">{new Date(p.purchaseDate).toLocaleDateString()}</div>
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
      </div>

      {/* --- MODAL: EDIT PRODUCT --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-900">{editingId ? 'Editar Lote' : 'Nova Compra de Stock'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleProductSubmit} className="p-6 space-y-6">
              
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-yellow-800 flex gap-3">
                  <AlertCircle className="flex-shrink-0" size={20} />
                  <p>
                      <strong>Organização:</strong> Crie registos separados (Lotes) se comprar o mesmo produto com preços diferentes. Ex: "Xiaomi Box Lote Jan" e "Xiaomi Box Lote Fev".
                  </p>
              </div>

              {/* Ligar ao Produto do Site */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <LinkIcon size={16} /> Produto da Loja (Para controle de Stock)
                  </label>
                  <select 
                      value={formData.publicProductId} 
                      onChange={handlePublicProductSelect}
                      className="input-field border-blue-200 focus:ring-blue-500"
                  >
                      <option value="">-- Apenas registo interno (Sem link ao site) --</option>
                      {PRODUCTS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
              </div>

              {/* Secção Geral */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Lote</label>
                   <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" placeholder="Ex: Xiaomi TV Box - Compra Worten" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                   <input type="text" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="input-field" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Data da Compra</label>
                   <input type="date" required value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} className="input-field" />
                </div>
              </div>

              {/* Secção Quantidades e Custos */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Package size={16} /> Custo & Stock</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Qtd Comprada</label>
                      <input type="number" min="1" required value={formData.quantityBought} onChange={e => setFormData({...formData, quantityBought: e.target.value})} className="input-field" />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Custo Unitário (€)</label>
                      <input type="number" step="0.01" required value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} className="input-field" />
                   </div>
                </div>
              </div>

              {/* Secção Previsão e Cashback */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><ArrowUpRight size={16} /> Venda & Retorno</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-bold text-indigo-800 mb-1">Preço Venda Alvo (€)</label>
                      <input type="number" step="0.01" value={formData.targetSalePrice} onChange={e => setFormData({...formData, targetSalePrice: e.target.value})} className="input-field border-indigo-300 focus:ring-indigo-500 bg-white" placeholder="Por quanto vai vender?" />
                      <p className="text-[10px] text-indigo-600 mt-1">Define a sua margem prevista.</p>
                   </div>
                   <div className="hidden md:block"></div> {/* Spacer */}
                   
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cashback Total (€)</label>
                      <input type="number" step="0.01" value={formData.cashbackValue} onChange={e => setFormData({...formData, cashbackValue: e.target.value})} className="input-field" placeholder="Ex: 5.00" />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estado do Cashback</label>
                      <select 
                        value={formData.cashbackStatus} 
                        onChange={e => setFormData({...formData, cashbackStatus: e.target.value as CashbackStatus})}
                        className="input-field"
                      >
                        <option value="NONE">Não aplicável</option>
                        <option value="PENDING">Pendente ⏳</option>
                        <option value="RECEIVED">Recebido ✅</option>
                      </select>
                   </div>
                </div>
              </div>

              <div className="pt-4 border-t flex gap-3 justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg">Guardar Lote</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: REGISTER SALE --- */}
      {isSaleModalOpen && selectedProductForSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSaleModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up overflow-hidden">
                <div className="bg-green-600 p-6 text-white">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <DollarSign /> Registrar Venda
                    </h3>
                    <p className="text-green-100 text-sm mt-1">{selectedProductForSale.name}</p>
                </div>
                
                <form onSubmit={handleSaleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Quantidade</label>
                            <input 
                                type="number" 
                                min="1" 
                                max={selectedProductForSale.quantityBought - selectedProductForSale.quantitySold}
                                required 
                                value={saleForm.quantity} 
                                onChange={e => setSaleForm({...saleForm, quantity: e.target.value})} 
                                className="input-field text-lg font-bold" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Preço Real (€)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                required 
                                value={saleForm.unitPrice} 
                                onChange={e => setSaleForm({...saleForm, unitPrice: e.target.value})} 
                                className="input-field text-lg font-bold text-green-600 border-green-200 focus:ring-green-500" 
                                placeholder="45.00"
                            />
                        </div>
                    </div>

                    {/* Novo Campo: PORTES */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                            <Truck size={14} /> Portes de Envio (€)
                        </label>
                        <input 
                            type="number" 
                            step="0.01" 
                            value={saleForm.shippingCost} 
                            onChange={e => setSaleForm({...saleForm, shippingCost: e.target.value})} 
                            className="input-field" 
                            placeholder="Ex: 5.04 (Deixe vazio se foi 0)"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Este valor será descontado do seu lucro final.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data da Venda</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="date" 
                                required 
                                value={saleForm.date} 
                                onChange={e => setSaleForm({...saleForm, date: e.target.value})} 
                                className="input-field pl-10" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                        <input 
                            type="text" 
                            value={saleForm.notes} 
                            onChange={e => setSaleForm({...saleForm, notes: e.target.value})} 
                            className="input-field" 
                            placeholder="Ex: Amigo do trabalho, OLX..." 
                        />
                    </div>
                    
                    {/* Resumo do Lucro desta Venda */}
                    {saleForm.unitPrice && (
                        <div className="bg-gray-50 p-3 rounded-lg text-sm flex justify-between items-center border border-gray-100">
                            <div className="flex flex-col">
                                <span className="text-gray-600 font-medium">Lucro Líquido nesta venda:</span>
                                <span className="text-[10px] text-gray-400">(Preço - Custo - Portes)</span>
                            </div>
                            <span className={`font-bold text-lg ${(Number(saleForm.unitPrice) - selectedProductForSale.purchasePrice - (Number(saleForm.shippingCost)||0)) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {formatCurrency(
                                    ((Number(saleForm.unitPrice) - selectedProductForSale.purchasePrice) * Number(saleForm.quantity)) - (Number(saleForm.shippingCost) || 0)
                                )}
                            </span>
                        </div>
                    )}

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={() => setIsSaleModalOpen(false)} className="flex-1 py-3 border rounded-xl hover:bg-gray-50 font-medium text-gray-700">Cancelar</button>
                        <button type="submit" className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold shadow-lg flex items-center justify-center gap-2">
                            Confirmar Venda
                        </button>
                    </div>
                </form>
                
                {/* Histórico Recente */}
                {selectedProductForSale.salesHistory && selectedProductForSale.salesHistory.length > 0 && (
                    <div className="bg-gray-50 p-4 border-t border-gray-100 max-h-40 overflow-y-auto">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><History size={12} /> Histórico deste Lote</h4>
                        <div className="space-y-2">
                            {selectedProductForSale.salesHistory.slice().reverse().map((sale, idx) => (
                                <div key={idx} className="text-xs flex justify-between border-b border-gray-200 pb-1 last:border-0">
                                    <div>
                                        <span className="font-medium text-gray-700">{new Date(sale.date).toLocaleDateString()}</span>
                                        {sale.notes && <span className="text-gray-500 ml-1">- {sale.notes}</span>}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="font-medium text-gray-900">{sale.quantity}x {formatCurrency(sale.unitPrice)}</span>
                                        {sale.shippingCost && sale.shippingCost > 0 && (
                                            <span className="text-[10px] text-red-400 flex items-center gap-0.5"><Truck size={8}/> -{formatCurrency(sale.shippingCost)}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
      )}

      {/* Styles Injection for Inputs */}
      <style>{`
        .input-field {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          outline: none;
          transition: all 0.2s;
        }
        .input-field:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
      `}</style>
    </div>
  );
};

// Helper Components & Functions
const formatCurrency = (val: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

const KpiCard: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100'
  };

  const currentClass = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`p-4 rounded-xl border ${currentClass.replace('bg-', 'border-opacity-50 ')} bg-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{title}</p>
          <h3 className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(value)}</h3>
        </div>
        <div className={`p-2 rounded-lg ${currentClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

