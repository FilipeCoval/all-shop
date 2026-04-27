import React, { useState, useMemo } from 'react';
import { 
  Search, Edit2, Trash2, RefreshCw, Camera, BrainCircuit, UploadCloud, Plus, 
  ChevronDown, ChevronRight, Globe, FileText, Copy, DollarSign, Package, TrendingUp, AlertCircle, Users, Loader2, Layers, BellRing, Info, X
} from 'lucide-react';
import { InventoryProduct, Order, Product, StockReservation } from '../types';
import KpiCard from './KpiCard';

interface InventoryTabProps {
  products: InventoryProduct[];
  catalogProducts?: Product[]; // NOVO: Para poder ir buscar imagens
  pendingOrders: Order[];
  reservations: StockReservation[];
  stats: {
    totalInvested: number;
    realizedRevenue: number;
    realizedProfit: number;
    pendingCashback: number;
    potentialProfit: number;
  };
  onlineUsersCount: number;
  stockAlerts: any[];
  onEdit: (product: InventoryProduct) => void;
  onEditProduct?: (product: InventoryProduct) => void;
  onCreateVariant: (product: InventoryProduct) => void;
  onDeleteGroup: (groupId: string, items: InventoryProduct[]) => void;
  onSale: (product: InventoryProduct) => void;
  onDelete: (id: string) => void;
  onSyncStock: () => void;
  isSyncingStock: boolean;
  onOpenScanner: (mode: 'search' | 'add_unit' | 'sell_unit' | 'tracking' | 'verify_product') => void;
  onOpenCalculator: () => void;
  onAddNew: () => void;
  onOpenInvestedModal: () => void;
  onOpenRevenueModal: () => void;
  onOpenProfitModal: () => void;
  onOpenCashbackManager: () => void;
  onOpenOnlineDetails: () => void;
  onOpenStockAlerts: (product: InventoryProduct) => void;

  copyToClipboard: (text: string) => boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const InventoryTab: React.FC<InventoryTabProps> = ({
  products, catalogProducts, pendingOrders, reservations, stats, onlineUsersCount, stockAlerts,
  onEdit, onEditProduct, onCreateVariant, onDeleteGroup, onSale, onDelete,
  onSyncStock, isSyncingStock,
  onOpenScanner, onOpenCalculator, 
  onAddNew,
  onOpenInvestedModal, onOpenRevenueModal, onOpenProfitModal, onOpenCashbackManager, onOpenOnlineDetails,
  onOpenStockAlerts,

  copyToClipboard,
  searchTerm, onSearchChange
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'SOLD'>('ALL');
  const [cashbackFilter, setCashbackFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'NONE'>('ALL');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [selectedReservationProduct, setSelectedReservationProduct] = useState<{ name: string, orders: { id: string, customer: string, qty: number }[] } | null>(null);

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
            <div onClick={onOpenOnlineDetails} className="p-4 rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 shadow-sm flex flex-col justify-between h-full cursor-pointer hover:border-green-300 dark:hover:border-green-500 transition-colors relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase flex items-center gap-1">Online Agora</span>
                    <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 relative">
                        <Users size={18} />
                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                    </div>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 flex items-end gap-2">
                    {onlineUsersCount}
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-normal mb-1">visitantes</span>
                </div>
            </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors">
            <div className="bg-gray-50 dark:bg-slate-700 px-4 py-3 border-b border-gray-200 dark:border-slate-600 flex gap-4 text-xs font-medium text-gray-500 dark:text-gray-300 transition-colors">
                <span>Total: {products.length}</span>
                <span className="w-px h-4 bg-gray-300 dark:bg-slate-500"></span>
                <span className="text-green-600 dark:text-green-400">Stock: {products.filter(p => p.status !== 'SOLD').length}</span>
                <span className="w-px h-4 bg-gray-300 dark:bg-slate-500"></span>
                <span className="text-red-600 dark:text-red-400">Esgotados: {products.filter(p => p.status === 'SOLD').length}</span>
            </div>
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-col lg:flex-row justify-between items-center gap-4 transition-colors">
                <div className="flex gap-2 w-full lg:w-auto">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
                        <option value="ALL">Todos os Estados</option>
                        <option value="IN_STOCK">Em Stock</option>
                        <option value="SOLD">Esgotado</option>
                    </select>
                    <select value={cashbackFilter} onChange={(e) => setCashbackFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
                        <option value="ALL">Todos os Cashbacks</option>
                        <option value="PENDING">Pendente</option>
                        <option value="RECEIVED">Recebido</option>
                    </select>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <div className="relative flex-1">
                        <input 
                            type="text" 
                            placeholder="Pesquisar ou escanear..." 
                            value={searchTerm} 
                            onChange={(e) => onSearchChange(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors" 
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                    </div>
        
                    <button onClick={onSyncStock} disabled={isSyncingStock} className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1" title="Sincronizar Stock da Loja">
                        {isSyncingStock ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    </button>
                    <button onClick={() => onOpenScanner('search')} className="bg-gray-700 dark:bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-gray-900 dark:hover:bg-slate-500 transition-colors" title="Escanear Código de Barras">
                        <Camera size={18} />
                    </button>
                    <button onClick={onOpenCalculator} className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1" title="Calculadora de Lucro">
                        <BrainCircuit size={18} />
                    </button>
                    <button onClick={onAddNew} className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                        <Plus size={18} />
                    </button>
                </div>
            </div>
        
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase transition-colors">
                        <tr>
                            <th className="px-6 py-3 w-10"></th>
                            <th className="px-6 py-3">Produto (Loja)</th>
                            <th className="px-4 py-3 text-center">Stock Total</th>
                            <th className="px-4 py-3 text-center">Estado Geral</th>
                            <th className="px-4 py-3 text-right">Preço Loja</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-sm transition-colors">
                        {groupedInventory.map(([groupId, items]) => {
                            const mainItem = items[0]; 
                            const isExpanded = expandedGroups.includes(groupId);
                            const totalPhysicalStock = items.reduce((acc, i) => acc + Math.max(0, (i.quantityBought || 0) - (i.quantitySold || 0)), 0);
                            
                            // Calcular stock pendente em encomendas para este grupo
                            let pendingInOrders = 0;
                            pendingOrders.forEach(order => {
                                if (order.items && Array.isArray(order.items)) {
                                    order.items.forEach(item => {
                                        if (typeof item === 'object' && item !== null) {
                                            const orderItem = item as any;
                                            if (orderItem.productId === mainItem.publicProductId) {
                                                // Se o lote tem variante, só descontamos se a encomenda for para essa variante
                                                // Se o lote não tem variante (genérico), descontamos tudo
                                                const itemVariant = (orderItem.selectedVariant || '').trim().toLowerCase();
                                                const batchVariant = (mainItem.variant || '').trim().toLowerCase();
                                                if (batchVariant === '' || itemVariant === batchVariant) {
                                                    pendingInOrders += (orderItem.quantity || 1);
                                                }
                                            }
                                        }
                                    });
                                }
                            });

                            // Calcular stock reservado no carrinho para este grupo
                            const reservedInCart = reservations
                                .filter(r => r.productId === mainItem.publicProductId)
                                .reduce((sum, r) => sum + r.quantity, 0);

                            const availableStock = Math.max(0, totalPhysicalStock - pendingInOrders - reservedInCart);
                            
                            const alertsCount = mainItem.publicProductId 
                                ? stockAlerts.filter(a => a.productId === mainItem.publicProductId).length
                                : 0;

                            return (
                                <React.Fragment key={groupId}>
                                    <tr className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${isExpanded ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                        <td className="px-6 py-4">
                                            <button onClick={() => toggleGroup(groupId)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-500 dark:text-gray-400 transition-colors">
                                                {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {(() => {
                                                    const catalogProd = catalogProducts?.find(p => String(p.id) === String(mainItem.publicProductId));
                                                    const imgUrl = catalogProd?.image || (catalogProd?.images && catalogProd.images[0]) || (mainItem.images && mainItem.images[0]);
                                                    return imgUrl ? (
                                                        <img src={imgUrl} className="w-10 h-10 object-cover rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600" alt="" />
                                                    ) : null;
                                                })()}
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white">{mainItem.name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{mainItem.category} • {items.length} Lote(s)</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`font-bold px-2 py-1 rounded text-sm ${availableStock > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                                    {availableStock} un.
                                                </span>
                                                {pendingInOrders > 0 && (
                                                    <button 
                                                       onClick={(e) => {
                                                           e.stopPropagation();
                                                           const ordersReserving: any[] = [];
                                                           pendingOrders.forEach(o => {
                                                               const item = o.items.find((i: any) => i.productId === mainItem.publicProductId);
                                                               if (item && typeof item === 'object') {
                                                                   ordersReserving.push({
                                                                       id: o.id,
                                                                       customer: o.shippingInfo?.name || 'N/A',
                                                                       qty: (item as any).quantity || 1
                                                                   });
                                                               }
                                                           });
                                                           setSelectedReservationProduct({ name: mainItem.name, orders: ordersReserving });
                                                       }}
                                                       className="text-[10px] text-orange-600 dark:text-orange-400 font-bold mt-1 hover:underline flex items-center gap-0.5"
                                                    >
                                                        ({totalPhysicalStock} físico - {pendingInOrders} reserv.)
                                                        <Info size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {mainItem.comingSoon ? (
                                                <span className="text-purple-600 dark:text-purple-400 font-bold text-xs uppercase bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">Em Breve</span>
                                            ) : (
                                                <span className={`text-xs font-bold uppercase ${availableStock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    {availableStock > 0 ? 'Disponível' : 'Esgotado'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(mainItem.salePrice || mainItem.targetSalePrice || 0)}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                {alertsCount > 0 && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onOpenStockAlerts(mainItem); }} 
                                                        className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors animate-pulse"
                                                        title="Notificar Clientes"
                                                    >
                                                        <BellRing size={14} /> {alertsCount}
                                                    </button>
                                                )}
                                                
                                                {onEditProduct && mainItem.publicProductId && (
                                                    <button onClick={(e) => { e.stopPropagation(); onEditProduct(mainItem); }} className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm" title="Atalho focado: Editar Imagens, Descrição e Modo Em Breve no Catálogo">
                                                        <Globe size={14} /> Atalho Catálogo
                                                    </button>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); onCreateVariant(mainItem); }} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors" title="Adicionar um novo lote ou opção (variante) a este produto">
                                                    <Layers size={14} /> + Lote
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteGroup(groupId, items); }} className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Apagar todos os lotes deste produto">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700 transition-colors">
                                            <td colSpan={6} className="px-4 py-4">
                                                <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm ml-10 transition-colors">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase transition-colors">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left">Lote / Variante</th>
                                                                <th className="px-4 py-2 text-left">Origem</th>
                                                                <th className="px-4 py-2 text-center">Stock</th>
                                                                <th className="px-4 py-2 text-right">Compra</th>
                                                                <th className="px-4 py-2 text-right">Venda (Estimada)</th>
                                                                <th className="px-4 py-2 text-center">Lucro Unitário</th>
                                                                <th className="px-4 py-2 text-right">Ações</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800 transition-colors">
                                                            {items.map(p => { 
                                                                const batchStock = (p.quantityBought || 0) - (p.quantitySold || 0); 
                                                                const salePrice = p.salePrice || p.targetSalePrice || 0; 
                                                                const purchasePrice = p.purchasePrice || 0; 
                                                                const cashbackValue = (p.cashbackValue || 0) / (p.quantityBought || 1); 
                                                                const finalProfit = salePrice - purchasePrice + cashbackValue; 
                                                                const hasLossBeforeCashback = salePrice < purchasePrice; 
                                                                const profitColor = finalProfit > 0 ? 'text-green-600 dark:text-green-400' : finalProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'; 
                                                                
                                                                return ( 
                                                                    <tr key={p.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                                                                        <td className="px-4 py-3">
                                                                            <div className="font-bold whitespace-normal text-gray-900 dark:text-white">{new Date(p.purchaseDate).toLocaleDateString()}</div>
                                                                            {p.variant && <span className="text-[10px] text-blue-500 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-1 rounded">{p.variant}</span>}
                                                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{p.description?.substring(0, 30)}...</div>
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            {p.supplierName ? (
                                                                                <div>
                                                                                    <div className="flex items-center gap-1 font-bold text-gray-700 dark:text-gray-300 text-[10px]">
                                                                                        <Globe size={10} className="text-indigo-500 dark:text-indigo-400" /> {p.supplierName}
                                                                                    </div>
                                                                                    {p.supplierOrderId && (
                                                                                        <div 
                                                                                            className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded w-fit mt-1 group cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors" 
                                                                                            onClick={() => handleCopy(p.supplierOrderId!)} 
                                                                                            title="Clique para copiar"
                                                                                        >
                                                                                            <FileText size={10} /> {p.supplierOrderId} <Copy size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className="flex justify-center text-[10px] mb-1 font-medium text-gray-600 dark:text-gray-300"><span>{batchStock} un.</span></div>
                                                                            <div className="w-20 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mx-auto">
                                                                                <div 
                                                                                    className={`h-full rounded-full ${ (p.quantityBought || 0) > 0 && ((p.quantitySold || 0) / (p.quantityBought || 1)) >= 1 ? 'bg-gray-400 dark:bg-gray-600' : 'bg-blue-500 dark:bg-blue-400'}`} 
                                                                                    style={{ width: `${(p.quantityBought || 0) > 0 ? (((p.quantitySold || 0) / (p.quantityBought || 1)) * 100) : 0}%` }}
                                                                                ></div>
                                                                            </div>
                                                                            {p.units && p.units.length > 0 && (
                                                                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800 space-y-1 max-w-[200px] mx-auto">
                                                                                    {p.units.sort((a,b) => a.status.localeCompare(b.status)).map(unit => {
                                                                                        const statusColor = unit.status === 'AVAILABLE' 
                                                                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                                                                            : unit.status === 'SOLD' 
                                                                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                                                                                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
                                                                                        const statusText = unit.status === 'AVAILABLE' ? 'Disponível' : unit.status === 'SOLD' ? 'Vendido' : 'Reservado';
                                                                                        
                                                                                        return (
                                                                                            <div key={unit.id} className="flex justify-between items-center text-[10px] group">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className={`font-mono ${unit.status !== 'AVAILABLE' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-300'}`}>{unit.id}</span>
                                                                                                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>{statusText}</span>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <span className="text-gray-400 dark:text-gray-500">{new Date(unit.addedAt).toLocaleDateString('pt-PT')}</span>
                                                                                                    <button onClick={() => handleCopy(unit.id)} title="Copiar S/N" className="text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                        <Copy size={10} />
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(p.purchasePrice)}</td>
                                                                        <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{p.targetSalePrice ? formatCurrency(p.targetSalePrice) : '-'}</td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            {salePrice > 0 ? (
                                                                                <div title={`Cálculo: Venda (${formatCurrency(salePrice)}) - Compra (${formatCurrency(purchasePrice)}) ${cashbackValue > 0 ? `+ Cashback (${formatCurrency(cashbackValue)})` : ''}`}>
                                                                                    <div className={`font-bold text-sm ${profitColor}`}>
                                                                                        {finalProfit >= 0 ? '+' : ''}{formatCurrency(finalProfit)}
                                                                                    </div>
                                                                                    {cashbackValue > 0 && (
                                                                                        <div className={`text-[10px] font-medium mt-0.5 ${p.cashbackStatus === 'PENDING' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-700 dark:text-green-400'}`}>
                                                                                            Cashback {p.cashbackStatus === 'PENDING' ? 'Pendente' : 'Recebido'}
                                                                                        </div>
                                                                                    )}
                                                                                    {hasLossBeforeCashback && cashbackValue > 0 && finalProfit > 0 && (
                                                                                        <div className="text-[10px] font-bold text-orange-500 dark:text-orange-400 mt-0.5" title="O preço de venda é inferior ao de compra, mas o cashback compensa.">
                                                                                            Lucro c/ Cashback
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right flex justify-end gap-1">
                                                                            <button onClick={() => onEdit(p)} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 p-1.5 rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm transition-colors" title="Editar este lote">
                                                                                <Edit2 size={14}/>
                                                                            </button>
                                                                            <button onClick={() => onDelete(p.id)} className="text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/30 shadow-sm transition-colors" title="Apagar lote">
                                                                                <Trash2 size={14}/>
                                                                            </button>
                                                                        </td>
                                                                    </tr> 
                                                                ); 
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
        {/* Modal de Detalhes de Reservas */}
        {selectedReservationProduct && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-orange-50 dark:bg-orange-900/20 transition-colors">
                        <h3 className="font-bold text-orange-900 dark:text-orange-300 flex items-center gap-2">
                            <Package size={18} /> Reservas: {selectedReservationProduct.name}
                        </h3>
                        <button onClick={() => setSelectedReservationProduct(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-4 max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-900 transition-colors">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Estas encomendas têm este produto mas o stock ainda não foi descontado oficialmente no inventário físico.</p>
                        <div className="space-y-2">
                            {selectedReservationProduct.orders.map((order, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 transition-colors">
                                    <div>
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">#{order.id}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{order.customer}</div>
                                    </div>
                                    <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded font-bold text-xs">
                                        {order.qty} un.
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex justify-end transition-colors">
                        <button 
                            onClick={() => setSelectedReservationProduct(null)}
                            className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-bold text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default InventoryTab;
