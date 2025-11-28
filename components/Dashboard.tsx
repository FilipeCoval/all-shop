
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, ArrowRight, Link as LinkIcon,
  History, ShoppingBag, Calendar
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord } from '../types';
import { getInventoryAnalysis } from '../services/geminiService';
import { PRODUCTS } from '../constants'; // Importar produtos públicos para o select

const Dashboard: React.FC = () => {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [aiTip, setAiTip] = useState<string | null>(null);
  
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

      // Receita: Calculada pelo histórico se existir, senão usa o fallback antigo
      let revenue = 0;
      if (p.salesHistory && p.salesHistory.length > 0) {
          revenue = p.salesHistory.reduce((acc, sale) => acc + (sale.quantity * sale.unitPrice), 0);
      } else {
          // Fallback para dados antigos
          revenue = p.salePrice * p.quantitySold;
      }
      realizedRevenue += revenue;

      // Lucro Realizado
      // Custo dos bens vendidos = Quantidade Vendida * Custo Unitário de Compra
      const cogs = p.quantitySold * p.purchasePrice; 
      const profitFromSales = revenue - cogs;
      
      const cashback = p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0;
      realizedProfit += profitFromSales + cashback;

      if (p.cashbackStatus === 'PENDING') {
        pendingCashback += p.cashbackValue;
      }

      // Lucro Potencial (Stock restante * (Preço Alvo - Preço Compra))
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
    
    // FIX: Garante que salesHistory nunca é undefined. Se não existir, usa [].
    const currentHistory = existingProduct?.salesHistory || [];
    
    const currentSalePrice = existingProduct ? existingProduct.salePrice : 0;

    // Calcular status
    let status: ProductStatus = 'IN_STOCK';
    if (currentSold >= qBought && qBought > 0) status = 'SOLD';
    else if (currentSold > 0) status = 'PARTIAL';

    const payload = {
      name: formData.name,
      category: formData.category,
      // FIX: Usa null em vez de undefined para compatibilidade com Firestore
      publicProductId: formData.publicProductId ? Number(formData.publicProductId) : null,
      purchaseDate: formData.purchaseDate,
      quantityBought: qBought,
      quantitySold: currentSold, 
      salesHistory: currentHistory, 
      purchasePrice: Number(formData.purchasePrice) || 0,
      // FIX: Usa null em vez de undefined
      targetSalePrice: formData.targetSalePrice ? Number(formData.targetSalePrice) : null,
      salePrice: currentSalePrice, 
      cashbackValue: Number(formData.cashbackValue) || 0,
      cashbackStatus: formData.cashbackStatus,
      status
    };

    try {
      if (editingId) {
        // Cast para any para aceitar null nos campos opcionais
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
          notes: saleForm.notes
      };

      const updatedHistory = [...(selectedProductForSale.salesHistory || []), newSale];
      const newQuantitySold = selectedProductForSale.quantitySold + qty;
      
      // Calcular nova média de venda para referência rápida
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
        // Não é necessário alerta de sucesso, a lista atualiza automaticamente
      } catch (error: any) {
        console.error("Erro ao apagar:", error);
        
        let msg = "Não foi possível apagar o registo.";
        if (error.code === 'permission-denied') {
            msg = "Erro de Permissão: A sua conta não tem autorização para apagar dados na Base de Dados.";
        } else if (error.message) {
            msg += " Detalhe: " + error.message;
        }
        
        alert(msg);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 animate-fade-in">
      
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <LayoutDashboard size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Gestão Backoffice</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => window.location.hash = '/'}
                className="text-gray-500 hover:text-gray-700 font-medium px-3 py-2 hidden sm:block"
            >
                Voltar à Loja
            </button>
            <button 
                onClick={handleAddNew}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors"
            >
                <Plus size={20} /> <span className="hidden sm:inline">Novo Produto</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        
        {/* AI TIP SECTION */}
        {aiTip && (
          <div className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 flex items-start gap-4 shadow-sm">
            <div className="bg-white p-2 rounded-full shadow-sm text-indigo-600">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wide mb-1">Dica Financeira IA</h3>
              <p className="text-indigo-800 italic">"{aiTip}"</p>
            </div>
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard 
            title="Total Investido" 
            value={stats.totalInvested} 
            icon={<Package size={20} />} 
            color="blue" 
            subtitle="Custo de stock total"
          />
          <KpiCard 
            title="Receita Realizada" 
            value={stats.realizedRevenue} 
            icon={<DollarSign size={20} />} 
            color="indigo" 
            subtitle="Soma exata das vendas"
          />
          <KpiCard 
            title="Lucro Realizado" 
            value={stats.realizedProfit} 
            icon={<TrendingUp size={20} />} 
            color={stats.realizedProfit >= 0 ? "green" : "red"} 
            subtitle="Inclui cashback recebido"
          />
          <KpiCard 
            title="Cashback Pendente" 
            value={stats.pendingCashback} 
            icon={<AlertCircle size={20} />} 
            color="yellow" 
            subtitle="A receber"
          />
        </div>

        {/* TABLE SECTION */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="font-bold text-lg text-gray-800">Inventário & Vendas</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4 text-right">Compra</th>
                  <th className="px-6 py-4 text-right">Média Venda</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">A carregar dados...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nenhum produto encontrado.</td></tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                            {p.name}
                            {p.publicProductId && (
                                <span title="Ligado à Loja">
                                    <LinkIcon size={12} className="text-indigo-500" />
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500">{p.category} • {new Date(p.purchaseDate).toLocaleDateString()}</div>
                        
                        {/* Histórico Miniatura */}
                        {p.salesHistory && p.salesHistory.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {p.salesHistory.slice(0, 3).map((s, idx) => (
                                    <span key={idx} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100" title={s.notes}>
                                        {s.quantity}x {formatCurrency(s.unitPrice)}
                                    </span>
                                ))}
                                {p.salesHistory.length > 3 && <span className="text-[10px] text-gray-400">+{p.salesHistory.length - 3}</span>}
                            </div>
                        )}
                      </td>
                      <td className="px-6 py-4 w-40">
                        <div className="flex justify-between text-xs mb-1 font-medium text-gray-600">
                          <span>{p.quantitySold} vend</span>
                          <span>{p.quantityBought} total</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${p.quantitySold === p.quantityBought ? 'bg-green-500' : 'bg-blue-500'}`} 
                            style={{ width: `${(p.quantitySold / p.quantityBought) * 100}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-600">
                        {formatCurrency(p.purchasePrice)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.quantitySold > 0 ? (
                           <div>
                               <span className="font-bold text-green-600 block">{formatCurrency(p.salePrice)}</span>
                               <span className="text-[10px] text-gray-400">média real</span>
                           </div>
                        ) : (
                           <span className="text-gray-400 text-xs italic">Alvo: {p.targetSalePrice ? formatCurrency(p.targetSalePrice) : '-'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold
                          ${p.status === 'SOLD' ? 'bg-green-100 text-green-800' : 
                            p.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-blue-100 text-blue-800'
                          }`}>
                          {p.status === 'SOLD' ? 'Esgotado' : p.status === 'PARTIAL' ? 'A Decorrer' : 'Em Stock'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        {p.status !== 'SOLD' && (
                            <button 
                                onClick={() => openSaleModal(p)} 
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                                title="Registrar Venda"
                            >
                                <DollarSign size={14} /> Vender
                            </button>
                        )}
                        <button onClick={() => handleEdit(p)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))
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
              <h3 className="text-xl font-bold text-gray-900">{editingId ? 'Editar Produto / Lote' : 'Nova Compra de Stock'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleProductSubmit} className="p-6 space-y-6">
              
              {/* Info about Batches */}
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-yellow-800 flex gap-3">
                  <AlertCircle className="flex-shrink-0" size={20} />
                  <p>
                      <strong>Dica:</strong> Se comprou produtos iguais mas com preços ou cashbacks diferentes, crie um <strong>novo registo</strong> (ex: "Lote #2") para manter as contas certas.
                  </p>
              </div>

              {/* Ligar ao Produto do Site */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <LinkIcon size={16} /> Ligar a Produto da Loja (Para Stock)
                  </label>
                  <select 
                      value={formData.publicProductId} 
                      onChange={handlePublicProductSelect}
                      className="input-field border-blue-200 focus:ring-blue-500"
                  >
                      <option value="">-- Apenas registo interno --</option>
                      {PRODUCTS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
              </div>

              {/* Secção Geral */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Lote/Produto</label>
                   <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" placeholder="Ex: Xiaomi TV Box S - Lote #4" />
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
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Package size={16} /> Dados de Compra</h4>
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
                <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Financeiro</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-indigo-800 mb-1">Preço Venda Alvo (€)</label>
                      <input type="number" step="0.01" value={formData.targetSalePrice} onChange={e => setFormData({...formData, targetSalePrice: e.target.value})} className="input-field border-indigo-200 focus:ring-indigo-500" placeholder="Estimativa" />
                   </div>
                   <div>
                        {/* Espaço vazio para alinhar ou futuro campo */}
                   </div>
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
                        <option value="NONE">Sem Cashback</option>
                        <option value="PENDING">Pendente</option>
                        <option value="RECEIVED">Recebido</option>
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
                            <span className="text-gray-600">Lucro nesta venda:</span>
                            <span className={`font-bold ${(Number(saleForm.unitPrice) - selectedProductForSale.purchasePrice) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {formatCurrency((Number(saleForm.unitPrice) - selectedProductForSale.purchasePrice) * Number(saleForm.quantity))}
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
                                    <span>{new Date(sale.date).toLocaleDateString()} {sale.notes && `(${sale.notes})`}</span>
                                    <span className="font-medium">{sale.quantity}x {formatCurrency(sale.unitPrice)}</span>
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

const KpiCard: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string, subtitle: string }> = ({ title, value, icon, color, subtitle }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100'
  };

  const currentClass = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`p-6 rounded-2xl border ${currentClass.replace('bg-', 'border-opacity-50 ')} bg-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(value)}</h3>
        </div>
        <div className={`p-3 rounded-xl ${currentClass}`}>
          {icon}
        </div>
      </div>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
};

export default Dashboard;
