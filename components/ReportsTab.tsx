import React, { useState, useMemo } from 'react';
import { Order, InventoryProduct, OrderItem } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Truck, Package, Download } from 'lucide-react';

interface ReportsTabProps {
    orders: Order[];
    inventoryProducts: InventoryProduct[];
}

const ReportsTab: React.FC<ReportsTabProps> = ({ orders, inventoryProducts }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Helper para formatar moeda
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

    // Filtrar encomendas válidas (pagas/enviadas) do mês selecionado
    const monthlyOrders = useMemo(() => {
        return orders.filter(o => {
            const d = new Date(o.date);
            const isValidStatus = ['Pago', 'Enviado', 'Entregue', 'Levantamento em Loja'].includes(o.status);
            return isValidStatus && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });
    }, [orders, selectedMonth, selectedYear]);

    // Calcular métricas financeiras
    const metrics = useMemo(() => {
        let totalSales = 0;
        let totalProductCost = 0;
        let totalShippingCost = 0;

        monthlyOrders.forEach(order => {
            // 1. Total Vendas (O que o cliente pagou)
            totalSales += order.total;

            // 2. Custo de Envio da Loja (O que a loja pagou)
            // Se for levantamento em loja, custo é 0. Se não, usa o valor guardado ou 5.40€ por defeito.
            if (order.shippingInfo.deliveryMethod === 'Pickup') {
                totalShippingCost += 0;
            } else {
                totalShippingCost += (order.storeShippingCost !== undefined ? order.storeShippingCost : 5.40);
            }

            // 3. Custo dos Produtos (CPV)
            order.items.forEach((item: any) => {
                // Tentar encontrar o produto no inventário para saber o preço de compra
                // Nota: Isto assume o preço de compra ATUAL. O ideal seria guardar o custo na altura da venda.
                // Mas como SaleRecord guarda unitPrice (venda), precisamos ir ao produto pai.
                
                // Se o item tiver productId (public ID), procuramos no inventário
                const product = inventoryProducts.find(p => p.publicProductId === item.productId);
                if (product) {
                    totalProductCost += (product.purchasePrice || 0) * (item.quantity || 1);
                }
            });
        });

        const totalExpenses = totalProductCost + totalShippingCost;
        const netProfit = totalSales - totalExpenses;
        const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

        return {
            totalSales,
            totalProductCost,
            totalShippingCost,
            totalExpenses,
            netProfit,
            margin
        };
    }, [monthlyOrders, inventoryProducts]);

    // Dados para o Gráfico Diário
    const chartData = useMemo(() => {
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const data = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dayOrders = monthlyOrders.filter(o => new Date(o.date).getDate() === i);
            const daySales = dayOrders.reduce((acc, o) => acc + o.total, 0);
            const dayProfit = dayOrders.reduce((acc, o) => {
                let cost = (o.shippingInfo.deliveryMethod === 'Pickup' ? 0 : (o.storeShippingCost || 5.40));
                o.items.forEach((item: any) => {
                    const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                    cost += (p?.purchasePrice || 0) * (item.quantity || 1);
                });
                return acc + (o.total - cost);
            }, 0);

            data.push({
                day: i,
                Vendas: daySales,
                Lucro: dayProfit
            });
        }
        return data;
    }, [monthlyOrders, selectedMonth, selectedYear, inventoryProducts]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header e Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-4 md:mb-0">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Relatório Financeiro</h2>
                        <p className="text-sm text-gray-500">Análise de lucros e despesas</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="p-2 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{new Date(0, i).toLocaleString('pt-PT', { month: 'long' })}</option>
                        ))}
                    </select>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="p-2 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-gray-500 uppercase">Total Vendas</p>
                        <div className="bg-green-100 p-1.5 rounded text-green-600"><DollarSign size={16}/></div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{formatCurrency(metrics.totalSales)}</h3>
                    <p className="text-xs text-gray-400 mt-1">{monthlyOrders.length} encomendas</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-gray-500 uppercase">Custo Produtos</p>
                        <div className="bg-blue-100 p-1.5 rounded text-blue-600"><Package size={16}/></div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{formatCurrency(metrics.totalProductCost)}</h3>
                    <p className="text-xs text-gray-400 mt-1">Valor de compra do stock</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-gray-500 uppercase">Custo Envios</p>
                        <div className="bg-orange-100 p-1.5 rounded text-orange-600"><Truck size={16}/></div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">{formatCurrency(metrics.totalShippingCost)}</h3>
                    <p className="text-xs text-gray-400 mt-1">Pago à transportadora</p>
                </div>

                <div className={`p-6 rounded-xl shadow-sm border ${metrics.netProfit >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <p className={`text-sm font-bold uppercase ${metrics.netProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>Lucro Líquido</p>
                        <div className={`p-1.5 rounded ${metrics.netProfit >= 0 ? 'bg-indigo-200 text-indigo-700' : 'bg-red-200 text-red-700'}`}>
                            {metrics.netProfit >= 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                        </div>
                    </div>
                    <h3 className={`text-2xl font-black ${metrics.netProfit >= 0 ? 'text-indigo-900' : 'text-red-900'}`}>{formatCurrency(metrics.netProfit)}</h3>
                    <p className={`text-xs mt-1 font-bold ${metrics.netProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>Margem: {metrics.margin.toFixed(1)}%</p>
                </div>
            </div>

            {/* Gráfico */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-96">
                <h3 className="font-bold text-gray-800 mb-6">Evolução Diária</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(val) => `€${val}`} />
                        <Tooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                            formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend />
                        <Bar dataKey="Vendas" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Lucro" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Tabela Detalhada */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800">Detalhe de Encomendas</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Encomenda</th>
                                <th className="px-6 py-4">Total (Cliente)</th>
                                <th className="px-6 py-4">Custo Produtos</th>
                                <th className="px-6 py-4">Custo Envio (Loja)</th>
                                <th className="px-6 py-4 text-right">Lucro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {monthlyOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Sem dados para este período.</td>
                                </tr>
                            ) : (
                                monthlyOrders.map(order => {
                                    let prodCost = 0;
                                    order.items.forEach((item: any) => {
                                        const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                        prodCost += (p?.purchasePrice || 0) * (item.quantity || 1);
                                    });
                                    const shipCost = order.shippingInfo.deliveryMethod === 'Pickup' ? 0 : (order.storeShippingCost || 5.40);
                                    const profit = order.total - prodCost - shipCost;

                                    return (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-gray-600">{new Date(order.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{order.id}</td>
                                            <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(order.total)}</td>
                                            <td className="px-6 py-4 text-red-500">-{formatCurrency(prodCost)}</td>
                                            <td className="px-6 py-4 text-orange-500">-{formatCurrency(shipCost)}</td>
                                            <td className={`px-6 py-4 text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(profit)}
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
    );
};

export default ReportsTab;
