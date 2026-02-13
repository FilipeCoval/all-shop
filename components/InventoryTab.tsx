
import React, { useState, useMemo } from 'react';
import { 
  Search, Edit2, Trash2, RefreshCw, Camera, BrainCircuit, UploadCloud, Plus, 
  ChevronDown, ChevronRight, Globe, FileText, Copy, DollarSign, Package, TrendingUp, AlertCircle, Users, Bot, Sparkles, Loader2, Layers 
} from 'lucide-react';
import { InventoryProduct, Product } from '../types';
import { getInventoryAnalysis } from '../services/geminiService';
import KpiCard from './KpiCard';

interface InventoryTabProps {
  products: InventoryProduct[];
  stats: {
    totalInvested: number;
    realizedRevenue: number;
    realizedProfit: number;
    pendingCashback: number;
    potentialProfit: number;
  };
  onlineUsersCount: number;
  onEdit: (product: InventoryProduct) => void;
  onCreateVariant: (product: InventoryProduct) => void;
  onDeleteGroup: (groupId: string, items: InventoryProduct[]) => void;
  onSale: (product: InventoryProduct) => void;
  onDelete: (id: string) => void;
  onSyncStock: () => void;
  isSyncingStock: boolean;
  onOpenScanner: (mode: 'search' | 'add_unit' | 'sell_unit' | 'tracking' | 'verify_product') => void;
  onOpenCalculator: () => void;
  onImport: () => void;
  isImporting: boolean;
  onRecalculate: () => void;
  isRecalculating: boolean;
  onAddNew: () => void;
  onOpenInvestedModal: () => void;
  onOpenRevenueModal: () => void;
  onOpenProfitModal: () => void;
  onOpenCashbackManager: () => void;
  onOpenOnlineDetails: () => void;
  copyToClipboard: (text: string) => boolean;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const InventoryTab: React.FC<InventoryTabProps> = ({
  products, stats, onlineUsersCount,
  onEdit, onCreateVariant, onDeleteGroup, onSale, onDelete,
  onSyncStock, isSyncingStock,
  onOpenScanner, onOpenCalculator, 
  onImport, isImporting,
  onRecalculate, isRecalculating,
  onAddNew,
  onOpenInvestedModal, onOpenRevenueModal, onOpenProfitModal, onOpenCashbackManager, onOpenOnlineDetails,
  copyToClipboard
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'SOLD'>('ALL');
  const [cashbackFilter, setCashbackFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'NONE'>('ALL');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus = true;
    if (statusFilter === 'IN_STOCK') matchesStatus = p.status !== 'SOLD';
    if (statusFilter === 'SOLD') matchesStatus = p.status === 'SOLD';
    let matchesCashback = true;
    if (cashbackFilter !== 'ALL') matchesCashback = p.cashbackStatus === cashbackFilter;
    return matchesSearch && matchesStatus && matchesCashback;
  });

  const groupedInventory = useMemo(() => {
    const groups: { [key: string]: InventoryProduct[] } = {};
    filteredProducts.forEach(p => {
      const key = p.publicProductId ? p.publicProductId.toString() : `local-${p.id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.entries(groups).sort(([, itemsA], [, itemsB]) => (itemsA[0]?.name || '').localeCompare(itemsB[0]?.name || ''));
  }, [filteredProducts]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
  };

  const handleAskAi = async () => {
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    setAiResponse(null);
    try {
      setAiResponse(await getInventoryAnalysis(products, aiQuery));
    } catch (e) {
      setAiResponse("Não foi possível processar o pedido.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCopy = (text: string) => {
      if (!copyToClipboard(text)) alert("Não foi possível copiar.");
  };

  return (
    <div className="animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <KpiCard title="Total Investido" value={stats.totalInvested} icon={<Package size={18} />} color="blue" onClick={onOpenInvestedModal} />
            <KpiCard title="Vendas Reais" value={stats.realizedRevenue} icon={<DollarSign size={18} />} color="indigo" onClick={onOpenRevenueModal} />
            <KpiCard title="Lucro Líquido" value={stats.realizedProfit} icon={<TrendingUp size={18} />} color={stats.realizedProfit >= 0 ? "green" : "red"} onClick={onOpenProfitModal} />
            <KpiCard title="Cashback Pendente" value={stats.pendingCashback} icon={<AlertCircle size={18} />} color="yellow" onClick={onOpenCashbackManager} />
            <div onClick={onOpenOnlineDetails} className="p-4 rounded-xl border bg-white shadow-sm flex flex-col justify-between h-full cursor-pointer hover:border-green-300 transition-colors relative overflow-hidden"><div className="flex justify-between items-start mb-2"><span className="text-gray-500 text-xs font-bold uppercase flex items-center gap-1">Online Agora</span><div className="p-1.5 rounded-lg bg-green-50 text-green-600 relative"><Users size={18} /><span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span></div></div><div className="text-2xl font-bold text-green-600 flex items-end gap-2">{onlineUsersCount}<span className="text-xs text-gray-400 font-normal mb-1">visitantes</span></div></div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 mb-8 animate-fade-in"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Bot size={20} /></div><div><h3 className="font-bold text-gray-900">Consultor Estratégico IA</h3><p className="text-xs text-gray-500">Pergunte sobre promoções, bundles ou como vender stock parado.</p></div></div><div className="flex flex-col sm:flex-row gap-2"><input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Ex: Como posso vender as TV Boxes H96 mais rápido sem perder dinheiro? Sugere bundles." className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAskAi()} /><button onClick={handleAskAi} disabled={isAiLoading || !aiQuery.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">{isAiLoading ? 'A pensar...' : <><Sparkles size={18} /> Gerar</>}</button></div>{aiResponse && <div className="mt-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-gray-700 text-sm leading-relaxed whitespace-pre-line animate-fade-in-down">{aiResponse}</div>}</div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4 text-xs font-medium text-gray-500"><span>Total: {products.length}</span><span className="w-px h-4 bg-gray-300"></span><span className="text-green-600">Stock: {products.filter(p => p.status !== 'SOLD').length}</span><span className="w-px h-4 bg-gray-300"></span><span className="text-red-600">Esgotados: {products.filter(p => p.status === 'SOLD').length}</span></div><div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4"><div className="flex gap-2 w-full lg:w-auto"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Estados</option><option value="IN_STOCK">Em Stock</option><option value="SOLD">Esgotado</option></select><select value={cashbackFilter} onChange={(e) => setCashbackFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Cashbacks</option><option value="PENDING">Pendente</option><option value="RECEIVED">Recebido</option></select></div><div className="flex gap-2 w-full lg:w-auto"><div className="relative flex-1"><input type="text" placeholder="Pesquisar ou escanear..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/></div>
        
        <button onClick={onSyncStock} disabled={isSyncingStock} className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1" title="Sincronizar Stock da Loja">{isSyncingStock ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
        <button onClick={() => onOpenScanner('search')} className="bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors" title="Escanear Código de Barras"><Camera size={18} /></button>
        <button onClick={onOpenCalculator} className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1" title="Calculadora de Lucro"><BrainCircuit size={18} /></button>
        <button onClick={onImport} disabled={isImporting} className="bg-yellow-500 text-white px-3 py-2 rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1" title="Importar e Corrigir Produtos">{isImporting ? '...' : <UploadCloud size={18} />}</button>
        <button onClick={onRecalculate} disabled={isRecalculating} className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1" title="Recalcular Stock e Vendas">{isRecalculating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
        <button onClick={onAddNew} className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={18} /></button></div></div>
        
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
                      <td className="px-4 py-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => onEdit(mainItem)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"><Edit2 size={14} /> Editar Loja</button><button onClick={() => onCreateVariant(mainItem)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Layers size={16} /></button><button onClick={() => onDeleteGroup(groupId, items)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div></td>
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
<td className="px-4 py-3 text-right flex justify-end gap-1">{batchStock > 0 && <button onClick={() => onSale(p)} className="text-green-600 hover:bg-green-50 p-1.5 rounded bg-white border border-green-200 shadow-sm" title="Vender deste lote"><DollarSign size={14}/></button>}<button onClick={() => onEdit(p)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded bg-white border border-gray-200 shadow-sm" title="Editar este lote"><Edit2 size={14}/></button><button onClick={() => onDelete(p.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded bg-white border border-red-200 shadow-sm" title="Apagar lote"><Trash2 size={14}/></button></td></tr> ); })}</tbody></table></div></td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div></div>
    </div>
  );
};

export default InventoryTab;
