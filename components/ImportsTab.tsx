import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebaseConfig';
import { ImportShipment, ImportOrder, ImportItem } from '../types';
import { Plus, Trash2, Edit2, Save, X, Package, Truck, Calculator, DollarSign, ArrowRight, CheckCircle } from 'lucide-react';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
};

const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

export const ImportsTab: React.FC = () => {
    const [shipments, setShipments] = useState<ImportShipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingShipment, setEditingShipment] = useState<ImportShipment | null>(null);

    useEffect(() => {
        const unsubscribe = db.collection('import_shipments')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImportShipment));
                setShipments(data);
                setLoading(false);
            }, error => {
                console.error("Erro ao carregar importações:", error);
                setLoading(false);
            });
        return () => unsubscribe();
    }, []);

    const handleCreateShipment = async () => {
        const newShipment: Omit<ImportShipment, 'id'> = {
            name: `Lote ${new Date().toLocaleDateString()}`,
            status: 'GATHERING',
            agentShippingCost: 0,
            customsCost: 0,
            distributionMethod: 'QUANTITY',
            exchangeRate: 0.92,
            orders: [],
            createdAt: new Date().toISOString()
        };
        try {
            await db.collection('import_shipments').add(newShipment);
        } catch (e) {
            alert("Erro ao criar lote de importação.");
        }
    };

    const handleDeleteShipment = async (id: string) => {
        if (!window.confirm("Apagar este lote de importação?")) return;
        try {
            await db.collection('import_shipments').doc(id).delete();
        } catch (e) {
            alert("Erro ao apagar lote.");
        }
    };

    const handleSaveShipment = async (shipment: ImportShipment) => {
        try {
            await db.collection('import_shipments').doc(shipment.id).update(shipment);
            setEditingShipment(null);
        } catch (e) {
            alert("Erro ao guardar lote.");
        }
    };

    if (loading) return <div className="p-8 text-center">A carregar importações...</div>;

    if (editingShipment) {
        return <ShipmentEditor shipment={editingShipment} onSave={handleSaveShipment} onCancel={() => setEditingShipment(null)} />;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Truck className="text-indigo-600" />
                        Gestão de Importações
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 mt-1">Calcule o custo real dos produtos importados (Agente + Alfândega).</p>
                </div>
                <button 
                    onClick={handleCreateShipment}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Plus size={20} /> Novo Lote
                </button>
            </div>

            {shipments.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <Package size={48} className="mx-auto text-gray-300 dark:text-slate-700 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Sem Lotes de Importação</h3>
                    <p className="text-gray-500 dark:text-slate-400">Crie um novo lote para começar a calcular os custos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {shipments.map(shipment => {
                        const totalItems = shipment.orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
                        const totalBaseValueUSD = shipment.orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0), 0);
                        const rate = shipment.exchangeRate || 1;
                        const totalBaseValueEUR = totalBaseValueUSD * rate;
                        const totalExtraCostsEUR = shipment.agentShippingCost + shipment.customsCost + shipment.orders.reduce((acc, o) => acc + (o.localShippingCost * rate), 0);

                        return (
                            <div key={shipment.id} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative group">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{shipment.name}</h3>
                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                                        shipment.status === 'RECEIVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        shipment.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    }`}>
                                        {shipment.status === 'RECEIVED' ? 'Recebido' : shipment.status === 'SHIPPED' ? 'A Caminho' : 'No Agente'}
                                    </span>
                                </div>
                                
                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-slate-400">Encomendas:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{shipment.orders.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-slate-400">Total Produtos:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{totalItems} unid.</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-slate-400">Valor Base:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{formatUSD(totalBaseValueUSD)} <span className="text-xs font-normal opacity-70">({formatCurrency(totalBaseValueEUR)})</span></span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-slate-800">
                                        <span className="text-gray-500 dark:text-slate-400">Custos Extra:</span>
                                        <span className="font-bold text-red-600 dark:text-red-400">+{formatCurrency(totalExtraCostsEUR)}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setEditingShipment(shipment)}
                                        className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 py-2 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Edit2 size={16} /> Gerir Lote
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteShipment(shipment.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                                        title="Apagar Lote"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ShipmentEditor: React.FC<{ shipment: ImportShipment, onSave: (s: ImportShipment) => void, onCancel: () => void }> = ({ shipment: initialShipment, onSave, onCancel }) => {
    const [shipment, setShipment] = useState<ImportShipment>(initialShipment);

    const handleAddOrder = () => {
        const newOrder: ImportOrder = {
            id: Date.now().toString(),
            supplierName: '',
            localShippingCost: 0,
            items: []
        };
        setShipment(prev => ({ ...prev, orders: [...prev.orders, newOrder] }));
    };

    const handleUpdateOrder = (orderId: string, updates: Partial<ImportOrder>) => {
        setShipment(prev => ({
            ...prev,
            orders: prev.orders.map(o => o.id === orderId ? { ...o, ...updates } : o)
        }));
    };

    const handleDeleteOrder = (orderId: string) => {
        if (!window.confirm("Apagar esta encomenda?")) return;
        setShipment(prev => ({
            ...prev,
            orders: prev.orders.filter(o => o.id !== orderId)
        }));
    };

    const handleAddItem = (orderId: string) => {
        const newItem: ImportItem = {
            id: Date.now().toString(),
            name: '',
            quantity: 1,
            unitPrice: 0
        };
        setShipment(prev => ({
            ...prev,
            orders: prev.orders.map(o => o.id === orderId ? { ...o, items: [...o.items, newItem] } : o)
        }));
    };

    const handleUpdateItem = (orderId: string, itemId: string, updates: Partial<ImportItem>) => {
        setShipment(prev => ({
            ...prev,
            orders: prev.orders.map(o => o.id === orderId ? {
                ...o,
                items: o.items.map(i => i.id === itemId ? { ...i, ...updates } : i)
            } : o)
        }));
    };

    const handleDeleteItem = (orderId: string, itemId: string) => {
        setShipment(prev => ({
            ...prev,
            orders: prev.orders.map(o => o.id === orderId ? {
                ...o,
                items: o.items.filter(i => i.id !== itemId)
            } : o)
        }));
    };

    // Cálculos
    const totals = useMemo(() => {
        let totalItems = 0;
        let totalBaseValueUSD = 0;
        let totalLocalShippingUSD = 0;

        shipment.orders.forEach(o => {
            totalLocalShippingUSD += o.localShippingCost;
            o.items.forEach(i => {
                totalItems += i.quantity;
                totalBaseValueUSD += (i.quantity * i.unitPrice);
            });
        });

        const rate = shipment.exchangeRate || 1;
        const totalBaseValueEUR = totalBaseValueUSD * rate;
        const totalLocalShippingEUR = totalLocalShippingUSD * rate;

        const globalExtraCostsEUR = shipment.agentShippingCost + shipment.customsCost;

        return { totalItems, totalBaseValueUSD, totalBaseValueEUR, totalLocalShippingUSD, totalLocalShippingEUR, globalExtraCostsEUR };
    }, [shipment]);

    const calculateFinalCost = (order: ImportOrder, item: ImportItem, includeGlobalCosts: boolean = true) => {
        const rate = shipment.exchangeRate || 1;
        const itemUnitPriceEUR = item.unitPrice * rate;

        if (totals.totalItems === 0 || totals.totalBaseValueUSD === 0) return itemUnitPriceEUR;

        const orderTotalItems = order.items.reduce((acc, i) => acc + i.quantity, 0);
        const orderTotalValueUSD = order.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);

        let localShippingShareEUR = 0;
        let globalShippingShareEUR = 0;

        if (shipment.distributionMethod === 'QUANTITY') {
            const localShippingEUR = order.localShippingCost * rate;
            localShippingShareEUR = orderTotalItems > 0 ? (localShippingEUR / orderTotalItems) : 0;
            if (includeGlobalCosts) {
                globalShippingShareEUR = totals.totalItems > 0 ? (totals.globalExtraCostsEUR / totals.totalItems) : 0;
            }
        } else {
            // VALUE
            const itemTotalValueUSD = item.quantity * item.unitPrice;
            const localShippingEUR = order.localShippingCost * rate;
            
            localShippingShareEUR = orderTotalValueUSD > 0 ? (localShippingEUR * (itemTotalValueUSD / orderTotalValueUSD)) / item.quantity : 0;
            if (includeGlobalCosts) {
                globalShippingShareEUR = totals.totalBaseValueUSD > 0 ? (totals.globalExtraCostsEUR * (itemTotalValueUSD / totals.totalBaseValueUSD)) / item.quantity : 0;
            }
        }

        return itemUnitPriceEUR + localShippingShareEUR + globalShippingShareEUR;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fade-in pb-32">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                        <ArrowRight size={20} className="rotate-180 text-gray-600 dark:text-gray-300" />
                    </button>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Editar Lote</h1>
                </div>
                <button 
                    onClick={() => onSave(shipment)}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Save size={20} /> Guardar
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configurações do Lote */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <Truck size={20} className="text-indigo-500"/> Detalhes do Lote
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Lote</label>
                                <input 
                                    type="text" 
                                    value={shipment.name} 
                                    onChange={e => setShipment({...shipment, name: e.target.value})}
                                    className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
                                <select 
                                    value={shipment.status} 
                                    onChange={e => setShipment({...shipment, status: e.target.value as any})}
                                    className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                                >
                                    <option value="GATHERING">No Agente (A juntar)</option>
                                    <option value="SHIPPED">A Caminho de PT</option>
                                    <option value="RECEIVED">Recebido</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Custo Envio Agente → PT (€)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={shipment.agentShippingCost || ''} 
                                    onChange={e => setShipment({...shipment, agentShippingCost: parseFloat(e.target.value) || 0})}
                                    className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alfândega / Impostos (€)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={shipment.customsCost || ''} 
                                    onChange={e => setShipment({...shipment, customsCost: parseFloat(e.target.value) || 0})}
                                    className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Taxa de Câmbio (1 USD = X EUR)</label>
                                <input 
                                    type="number" 
                                    step="0.0001"
                                    value={shipment.exchangeRate || ''} 
                                    onChange={e => setShipment({...shipment, exchangeRate: parseFloat(e.target.value) || 0})}
                                    className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Distribuição de Custos</label>
                                <select 
                                    value={shipment.distributionMethod} 
                                    onChange={e => setShipment({...shipment, distributionMethod: e.target.value as any})}
                                    className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                                >
                                    <option value="QUANTITY">Por Quantidade (Igual por unidade)</option>
                                    <option value="VALUE">Por Valor (Proporcional ao preço)</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    {shipment.distributionMethod === 'QUANTITY' 
                                        ? 'O custo de envio é dividido igualmente por todas as unidades.' 
                                        : 'Produtos mais caros pagam uma fatia maior do envio.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Resumo */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                        <h2 className="font-bold text-lg mb-4 text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                            <Calculator size={20} /> Resumo Global
                        </h2>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-indigo-700/70 dark:text-indigo-400/70">Total Produtos:</span>
                                <span className="font-bold text-indigo-900 dark:text-indigo-300">{totals.totalItems} unid.</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-indigo-700/70 dark:text-indigo-400/70">Valor Base (Produtos):</span>
                                <span className="font-bold text-indigo-900 dark:text-indigo-300">{formatUSD(totals.totalBaseValueUSD)} <span className="text-xs font-normal opacity-70">({formatCurrency(totals.totalBaseValueEUR)})</span></span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-indigo-700/70 dark:text-indigo-400/70">Envios Locais (China):</span>
                                <span className="font-bold text-indigo-900 dark:text-indigo-300">{formatUSD(totals.totalLocalShippingUSD)} <span className="text-xs font-normal opacity-70">({formatCurrency(totals.totalLocalShippingEUR)})</span></span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-indigo-700/70 dark:text-indigo-400/70">Envio Global + Alfândega:</span>
                                <span className="font-bold text-indigo-900 dark:text-indigo-300">{formatCurrency(totals.globalExtraCostsEUR)}</span>
                            </div>
                            <div className="pt-3 border-t border-indigo-200 dark:border-indigo-800/50 flex justify-between">
                                <span className="font-bold text-indigo-900 dark:text-indigo-300">Custo Total Final:</span>
                                <span className="font-black text-lg text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(totals.totalBaseValueEUR + totals.totalLocalShippingEUR + totals.globalExtraCostsEUR)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Encomendas */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Package size={24} className="text-indigo-500" /> Encomendas no Lote
                        </h2>
                        <button 
                            onClick={handleAddOrder}
                            className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center gap-2 text-sm"
                        >
                            <Plus size={16} /> Adicionar Encomenda
                        </button>
                    </div>

                    {shipment.orders.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
                            <p className="text-gray-500 dark:text-slate-400">Nenhuma encomenda adicionada a este lote.</p>
                        </div>
                    ) : (
                        shipment.orders.map((order, orderIndex) => (
                            <div key={order.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                {/* Cabeçalho da Encomenda */}
                                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 border-b border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fornecedor / Loja</label>
                                            <input 
                                                type="text" 
                                                placeholder="Ex: Alibaba - Loja X"
                                                value={order.supplierName} 
                                                onChange={e => handleUpdateOrder(order.id, { supplierName: e.target.value })}
                                                className="w-full p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nº Encomenda (Opcional)</label>
                                            <input 
                                                type="text" 
                                                value={order.orderNumber || ''} 
                                                onChange={e => handleUpdateOrder(order.id, { orderNumber: e.target.value })}
                                                className="w-full p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Envio Local (China) $</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={order.localShippingCost || ''} 
                                                onChange={e => handleUpdateOrder(order.id, { localShippingCost: parseFloat(e.target.value) || 0 })}
                                                className="w-full p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 self-end sm:self-center">
                                        <div className="text-right">
                                            <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Custo Total da Encomenda</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                {formatCurrency(order.items.reduce((sum, item) => sum + (calculateFinalCost(order, item, false) * item.quantity), 0))}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteOrder(order.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                            title="Apagar Encomenda"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Itens da Encomenda */}
                                <div className="p-4">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="text-xs text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                                                    <th className="pb-2 font-bold w-1/3">Produto</th>
                                                    <th className="pb-2 font-bold w-1/6">Variante</th>
                                                    <th className="pb-2 font-bold w-1/12 text-center">Qtd</th>
                                                    <th className="pb-2 font-bold w-1/6 text-right">Preço Base Unit.</th>
                                                    <th className="pb-2 font-bold w-1/6 text-right text-indigo-600 dark:text-indigo-400">Custo Final Unit.</th>
                                                    <th className="pb-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order.items.map(item => {
                                                    const finalCost = calculateFinalCost(order, item);
                                                    return (
                                                        <tr key={item.id} className="border-b border-gray-50 dark:border-slate-800/50 last:border-0">
                                                            <td className="py-2 pr-2">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Nome do produto"
                                                                    value={item.name} 
                                                                    onChange={e => handleUpdateItem(order.id, item.id, { name: e.target.value })}
                                                                    className="w-full p-1.5 bg-gray-50 dark:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-600 focus:border-indigo-500 rounded text-sm outline-none"
                                                                />
                                                            </td>
                                                            <td className="py-2 pr-2">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Ex: Preto 1m"
                                                                    value={item.variant || ''} 
                                                                    onChange={e => handleUpdateItem(order.id, item.id, { variant: e.target.value })}
                                                                    className="w-full p-1.5 bg-gray-50 dark:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-600 focus:border-indigo-500 rounded text-sm outline-none"
                                                                />
                                                            </td>
                                                            <td className="py-2 pr-2">
                                                                <input 
                                                                    type="number" 
                                                                    min="1"
                                                                    value={item.quantity || ''} 
                                                                    onChange={e => handleUpdateItem(order.id, item.id, { quantity: parseInt(e.target.value) || 1 })}
                                                                    className="w-full p-1.5 bg-gray-50 dark:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-600 focus:border-indigo-500 rounded text-sm outline-none text-center"
                                                                />
                                                            </td>
                                                            <td className="py-2 pr-2">
                                                                <div className="relative">
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                                                    <input 
                                                                        type="number" 
                                                                        step="0.01"
                                                                        value={item.unitPrice || ''} 
                                                                        onChange={e => handleUpdateItem(order.id, item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                                                        className="w-full p-1.5 pl-6 bg-gray-50 dark:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-600 focus:border-indigo-500 rounded text-sm outline-none text-right"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="py-2 pr-2 text-right">
                                                                <div className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-1.5 rounded text-sm">
                                                                    {formatCurrency(finalCost)}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 text-right">
                                                                <button 
                                                                    onClick={() => handleDeleteItem(order.id, item.id)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button 
                                        onClick={() => handleAddItem(order.id)}
                                        className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Adicionar Produto
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
