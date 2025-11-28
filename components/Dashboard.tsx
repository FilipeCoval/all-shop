
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, ArrowRight, Link as LinkIcon
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus } from '../types';
import { getInventoryAnalysis } from '../services/geminiService';
import { PRODUCTS } from '../constants'; // Importar produtos públicos para o select

const Dashboard: React.FC = () => {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [aiTip, setAiTip] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    publicProductId: '' as string, // ID do produto público (string para o select)
    purchaseDate: new Date().toISOString().split('T')[0],
    quantityBought: '',
    quantitySold: '',
    purchasePrice: '',
    targetSalePrice: '',
    salePrice: '',
    cashbackValue: '',
    cashbackStatus: 'NONE' as CashbackStatus
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

      // Receita: O que já vendi
      const revenue = p.salePrice * p.quantitySold;
      realizedRevenue += revenue;

      // Lucro Realizado
      const profitFromSales = (p.salePrice - p.purchasePrice) * p.quantitySold;
      const cashback = p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0;
      realizedProfit += profitFromSales + cashback;

      if (p.cashbackStatus === 'PENDING') {
        pendingCashback += p.cashbackValue;
      }

      // Lucro Potencial
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

  // --- HANDLERS ---
  const handleEdit = (product: InventoryProduct) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      category: product.category,
      publicProductId: product.publicProductId ? product.publicProductId.toString() : '',
      purchaseDate: product.purchaseDate,
      quantityBought: product.quantityBought.toString(),
      quantitySold: product.quantitySold.toString(),
      purchasePrice: product.purchasePrice.toString(),
      targetSalePrice: product.targetSalePrice ? product.targetSalePrice.toString() : '',
      salePrice: product.salePrice.toString(),
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
      quantitySold: '0',
      purchasePrice: '',
      targetSalePrice: '',
      salePrice: '',
      cashbackValue: '',
      cashbackStatus: 'NONE'
    });
    setIsModalOpen(true);
  };

  const handlePublicProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value;
      setFormData(prev => ({ ...prev, publicProductId: selectedId }));

      // Auto-preencher nome e categoria se selecionar um produto da lista
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const qBought = Number(formData.quantityBought) || 0;
    const qSold = Number(formData.quantitySold) || 0;
    
    // Auto status
    let status: ProductStatus = 'IN_STOCK';
    if (qSold >= qBought && qBought > 0) status = 'SOLD';
    else if (qSold > 0) status = 'PARTIAL';

    const payload = {
      name: formData.name,
      category: formData.category,
      publicProductId: formData.publicProductId ? Number(formData.publicProductId) : undefined,
      purchaseDate: formData.purchaseDate,
      quantityBought: qBought,
      quantitySold: qSold,
      purchasePrice: Number(formData.purchasePrice) || 0,
      targetSalePrice: formData.targetSalePrice ? Number(formData.targetSalePrice) : undefined,
      salePrice: Number(formData.salePrice) || 0,
      cashbackValue: Number(formData.cashbackValue) || 0,
      cashbackStatus: formData.cashbackStatus,
      status
    };

    try {
      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await addProduct(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('Erro ao guardar produto');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem a certeza que quer apagar este registo?')) {
      await deleteProduct(id);
    }
  };

  // --- CALCULATIONS FOR MODAL PREVIEW ---
  const modalPreview = useMemo(() => {
    const qBought = Number(formData.quantityBought) || 0;
    const pBuy = Number(formData.purchasePrice) || 0;
    const pTarget = Number(formData.targetSalePrice) || 0;
    
    const totalCost = qBought * pBuy;
    const estimatedRev = qBought * pTarget;
    const estimatedProfit = estimatedRev - totalCost + (Number(formData.cashbackValue) || 0);
    
    return { totalCost, estimatedRev, estimatedProfit };
  }, [formData]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 animate-fade-in">
      
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
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
            subtitle="Vendas efetivas"
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
            <h2 className="font-bold text-lg text-gray-800">Inventário</h2>
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
                  <th className="px-6 py-4">Qtd. (Venda/Total)</th>
                  <th className="px-6 py-4 text-right">Compra (Uni)</th>
                  <th className="px-6 py-4 text-right">Venda (Uni)</th>
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
                      </td>
                      <td className="px-6 py-4 w-48">
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
                           <span className="font-bold text-green-600">{formatCurrency(p.salePrice)}</span>
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

      {/* MODAL ADD/EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-900">{editingId ? 'Editar Produto' : 'Novo Registo de Compra'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              
              {/* Ligar ao Produto do Site */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <LinkIcon size={16} /> Ligar a Produto da Loja (Recomendado)
                  </label>
                  <select 
                      value={formData.publicProductId} 
                      onChange={handlePublicProductSelect}
                      className="input-field border-blue-200 focus:ring-blue-500"
                  >
                      <option value="">-- Apenas registo interno (Sem ligação) --</option>
                      {PRODUCTS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                  <p className="text-xs text-blue-600 mt-2">
                      Ao selecionar, o stock no site será atualizado automaticamente com base nas quantidades abaixo.
                  </p>
              </div>

              {/* Secção Geral */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Lote/Produto</label>
                   <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" placeholder="Ex: Xiaomi TV Box S 2nd Gen - Lote #4" />
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
                      <label className="block text-sm font-medium text-gray-600 mb-1">Preço Custo (Unidade)</label>
                      <input type="number" step="0.01" required value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} className="input-field" />
                   </div>
                </div>
              </div>

              {/* Secção Vendas e Alvos */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Dados de Venda</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-indigo-800 mb-1">Preço Alvo (Est.)</label>
                      <input type="number" step="0.01" value={formData.targetSalePrice} onChange={e => setFormData({...formData, targetSalePrice: e.target.value})} className="input-field border-indigo-200 focus:ring-indigo-500" placeholder="Opcional" />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-indigo-800 mb-1">Qtd já Vendida</label>
                      <input type="number" min="0" value={formData.quantitySold} onChange={e => setFormData({...formData, quantitySold: e.target.value})} className="input-field border-indigo-200 focus:ring-indigo-500" />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-indigo-800 mb-1">Preço Venda Real</label>
                      <input type="number" step="0.01" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} className="input-field border-indigo-200 focus:ring-indigo-500" placeholder="Se já vendeu" />
                   </div>
                </div>
              </div>

              {/* Secção Cashback */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Live Preview Bar */}
              <div className="bg-gray-900 text-white p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
                 <div>
                    <span className="block text-gray-400 text-xs uppercase">Custo Total</span>
                    <span className="font-bold text-lg">{formatCurrency(modalPreview.totalCost)}</span>
                 </div>
                 <ArrowRight className="hidden sm:block text-gray-500" />
                 <div>
                    <span className="block text-gray-400 text-xs uppercase">Receita Estimada</span>
                    <span className="font-bold text-lg text-blue-300">{formatCurrency(modalPreview.estimatedRev)}</span>
                 </div>
                 <ArrowRight className="hidden sm:block text-gray-500" />
                 <div>
                    <span className="block text-gray-400 text-xs uppercase">Lucro Previsto</span>
                    <span className={`font-bold text-lg ${modalPreview.estimatedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(modalPreview.estimatedProfit)}
                    </span>
                 </div>
              </div>

              <div className="pt-4 border-t flex gap-3 justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg">Guardar Produto</button>
              </div>

            </form>
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
