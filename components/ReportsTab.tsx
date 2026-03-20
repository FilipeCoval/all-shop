import React, { useState, useMemo } from 'react';
import { Order, InventoryProduct, OrderItem } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';
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
            const isYearMatch = d.getFullYear() === selectedYear;
            const isMonthMatch = selectedMonth === -1 ? true : d.getMonth() === selectedMonth;
            return isValidStatus && isYearMatch && isMonthMatch;
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
            if (order.totalProductCost !== undefined) {
                totalProductCost += order.totalProductCost;
            } else {
                let orderCost = 0;
                if (order.serialNumbersUsed && order.serialNumbersUsed.length > 0) {
                    order.serialNumbersUsed.forEach((sn: string) => {
                        const batch = inventoryProducts.find(p => p.units?.some(u => u.id === sn));
                        if (batch) {
                            orderCost += (batch.purchasePrice || 0);
                        }
                    });
                    const totalItems = order.items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
                    if (totalItems > order.serialNumbersUsed.length) {
                        const remainingItems = totalItems - order.serialNumbersUsed.length;
                        const avgCost = order.items.reduce((acc: number, item: any) => {
                            const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                            return acc + (p?.purchasePrice || 0);
                        }, 0) / order.items.length;
                        orderCost += (avgCost || 0) * remainingItems;
                    }
                } else {
                    order.items.forEach((item: any) => {
                        let itemCost = 0;
                        if (item.serialNumbers && item.serialNumbers.length > 0) {
                            item.serialNumbers.forEach((sn: string) => {
                                const batch = inventoryProducts.find(p => p.units?.some(u => u.id === sn));
                                if (batch) {
                                    itemCost += (batch.purchasePrice || 0);
                                } else {
                                    const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                    itemCost += (p?.purchasePrice || 0);
                                }
                            });
                            if (item.quantity > item.serialNumbers.length) {
                                const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                itemCost += (p?.purchasePrice || 0) * (item.quantity - item.serialNumbers.length);
                            }
                        } else {
                            const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                            itemCost += (p?.purchasePrice || 0) * (item.quantity || 1);
                        }
                        orderCost += itemCost;
                    });
                }
                totalProductCost += orderCost;
            }
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

    // Dados para o Gráfico
    const chartData = useMemo(() => {
        const data = [];

        if (selectedMonth === -1) {
            // Gráfico Anual (Jan-Dez)
            for (let i = 0; i < 12; i++) {
                const monthOrders = monthlyOrders.filter(o => new Date(o.date).getMonth() === i);
                const monthSales = monthOrders.reduce((acc, o) => acc + o.total, 0);
                const monthProfit = monthOrders.reduce((acc, o) => {
                    let cost = (o.shippingInfo.deliveryMethod === 'Pickup' ? 0 : (o.storeShippingCost || 5.40));
                    if (o.totalProductCost !== undefined) {
                        cost += o.totalProductCost;
                    } else {
                        let orderCost = 0;
                        if (o.serialNumbersUsed && o.serialNumbersUsed.length > 0) {
                            o.serialNumbersUsed.forEach((sn: string) => {
                                const batch = inventoryProducts.find(p => p.units?.some(u => u.id === sn));
                                if (batch) {
                                    orderCost += (batch.purchasePrice || 0);
                                }
                            });
                            const totalItems = o.items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
                            if (totalItems > o.serialNumbersUsed.length) {
                                const remainingItems = totalItems - o.serialNumbersUsed.length;
                                const avgCost = o.items.reduce((acc: number, item: any) => {
                                    const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                    return acc + (p?.purchasePrice || 0);
                                }, 0) / o.items.length;
                                orderCost += (avgCost || 0) * remainingItems;
                            }
                        } else {
                            o.items.forEach((item: any) => {
                                let itemCost = 0;
                                if (item.serialNumbers && item.serialNumbers.length > 0) {
                                    item.serialNumbers.forEach((sn: string) => {
                                        const batch = inventoryProducts.find(p => p.units?.some(u => u.id === sn));
                                        if (batch) {
                                            itemCost += (batch.purchasePrice || 0);
                                        } else {
                                            const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                            itemCost += (p?.purchasePrice || 0);
                                        }
                                    });
                                    if (item.quantity > item.serialNumbers.length) {
                                        const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                        itemCost += (p?.purchasePrice || 0) * (item.quantity - item.serialNumbers.length);
                                    }
                                } else {
                                    const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                    itemCost += (p?.purchasePrice || 0) * (item.quantity || 1);
                                }
                                orderCost += itemCost;
                            });
                        }
                        cost += orderCost;
                    }
                    return acc + (o.total - cost);
                }, 0);

                data.push({
                    name: new Date(0, i).toLocaleString('pt-PT', { month: 'short' }),
                    Vendas: monthSales,
                    Lucro: monthProfit
                });
            }
        } else {
            // Gráfico Mensal (Dias)
            const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const dayOrders = monthlyOrders.filter(o => new Date(o.date).getDate() === i);
                const daySales = dayOrders.reduce((acc, o) => acc + o.total, 0);
                const dayProfit = dayOrders.reduce((acc, o) => {
                    let cost = (o.shippingInfo.deliveryMethod === 'Pickup' ? 0 : (o.storeShippingCost || 5.40));
                    if (o.totalProductCost !== undefined) {
                        cost += o.totalProductCost;
                    } else {
                        let orderCost = 0;
                        if (o.serialNumbersUsed && o.serialNumbersUsed.length > 0) {
                            o.serialNumbersUsed.forEach((sn: string) => {
                                const batch = inventoryProducts.find(p => p.units?.some(u => u.id === sn));
                                if (batch) {
                                    orderCost += (batch.purchasePrice || 0);
                                }
                            });
                            const totalItems = o.items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
                            if (totalItems > o.serialNumbersUsed.length) {
                                const remainingItems = totalItems - o.serialNumbersUsed.length;
                                const avgCost = o.items.reduce((acc: number, item: any) => {
                                    const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                    return acc + (p?.purchasePrice || 0);
                                }, 0) / o.items.length;
                                orderCost += (avgCost || 0) * remainingItems;
                            }
                        } else {
                            o.items.forEach((item: any) => {
                                let itemCost = 0;
                                if (item.serialNumbers && item.serialNumbers.length > 0) {
                                    item.serialNumbers.forEach((sn: string) => {
                                        const batch = inventoryProducts.find(p => p.units?.some(u => u.id === sn));
                                        if (batch) {
                                            itemCost += (batch.purchasePrice || 0);
                                        } else {
                                            const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                            itemCost += (p?.purchasePrice || 0);
                                        }
                                    });
                                    if (item.quantity > item.serialNumbers.length) {
                                        const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                        itemCost += (p?.purchasePrice || 0) * (item.quantity - item.serialNumbers.length);
                                    }
                                } else {
                                    const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                    itemCost += (p?.purchasePrice || 0) * (item.quantity || 1);
                                }
                                orderCost += itemCost;
                            });
                        }
                        cost += orderCost;
                    }
                    return acc + (o.total - cost);
                }, 0);

                data.push({
                    name: i.toString(),
                    Vendas: daySales,
                    Lucro: dayProfit
                });
            }
        }
        return data;
    }, [monthlyOrders, selectedMonth, selectedYear, inventoryProducts]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header e Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                <div className="flex items-center gap-3 mb-4 md:mb-0">
                    <div className="bg-indigo-100 dark:bg-indigo-900/20 p-2 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">Relatório Financeiro</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">Análise de lucros e despesas</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors"
                    >
                        <option value={-1}>Todo o Ano</option>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{new Date(0, i).toLocaleString('pt-PT', { month: 'long' })}</option>
                        ))}
                    </select>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase transition-colors">Total Vendas</p>
                        <div className="bg-green-100 dark:bg-green-900/20 p-1.5 rounded text-green-600 dark:text-green-400 transition-colors"><DollarSign size={16}/></div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{formatCurrency(metrics.totalSales)}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">{monthlyOrders.length} encomendas</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase transition-colors">Custo Produtos</p>
                        <div className="bg-blue-100 dark:bg-blue-900/20 p-1.5 rounded text-blue-600 dark:text-blue-400 transition-colors"><Package size={16}/></div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{formatCurrency(metrics.totalProductCost)}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">Valor de compra do stock</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase transition-colors">Custo Envios</p>
                        <div className="bg-orange-100 dark:bg-orange-900/20 p-1.5 rounded text-orange-600 dark:text-orange-400 transition-colors"><Truck size={16}/></div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{formatCurrency(metrics.totalShippingCost)}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">Pago à transportadora</p>
                </div>

                <div className={`p-6 rounded-xl shadow-sm border transition-colors ${metrics.netProfit >= 0 ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <p className={`text-sm font-bold uppercase transition-colors ${metrics.netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>Lucro Líquido</p>
                        <div className={`p-1.5 rounded transition-colors ${metrics.netProfit >= 0 ? 'bg-indigo-200 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'bg-red-200 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                            {metrics.netProfit >= 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                        </div>
                    </div>
                    <h3 className={`text-2xl font-black transition-colors ${metrics.netProfit >= 0 ? 'text-indigo-900 dark:text-indigo-100' : 'text-red-900 dark:text-red-100'}`}>{formatCurrency(metrics.netProfit)}</h3>
                    <p className={`text-xs mt-1 font-bold transition-colors ${metrics.netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>Margem: {metrics.margin.toFixed(1)}%</p>
                </div>
            </div>

            {/* Gráfico */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-96 transition-colors">
                <h3 className="font-bold text-gray-800 dark:text-white mb-6 transition-colors">{selectedMonth === -1 ? 'Evolução Mensal' : 'Evolução Diária'}</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" className="stroke-gray-200 dark:stroke-slate-700" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} tickFormatter={(val) => `€${val}`} />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--tooltip-bg, #fff)', 
                                borderColor: 'var(--tooltip-border, #e5e7eb)', 
                                borderRadius: '8px', 
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                color: 'var(--tooltip-text, #111827)'
                            }}
                        />
                        <Legend />
                        <Bar dataKey="Vendas" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Lucro" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
                <style>{`
                    :root {
                        --tooltip-bg: #fff;
                        --tooltip-border: #e5e7eb;
                        --tooltip-text: #111827;
                    }
                    .dark {
                        --tooltip-bg: #1e293b;
                        --tooltip-border: #334155;
                        --tooltip-text: #f3f4f6;
                    }
                `}</style>
            </div>

            {/* Tabela Detalhada */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors">
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 transition-colors">
                    <h3 className="font-bold text-gray-800 dark:text-white transition-colors">Detalhe de Encomendas</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-700 text-xs uppercase text-gray-500 dark:text-gray-300 font-semibold transition-colors">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Encomenda</th>
                                <th className="px-6 py-4">Total (Cliente)</th>
                                <th className="px-6 py-4">Custo Produtos</th>
                                <th className="px-6 py-4">Custo Envio (Loja)</th>
                                <th className="px-6 py-4 text-right">Lucro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700 transition-colors">
                            {monthlyOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">Sem dados para este período.</td>
                                </tr>
                            ) : (
                                monthlyOrders.map(order => {
                                    let prodCost = 0;
                                    if (order.totalProductCost !== undefined) {
                                        prodCost = order.totalProductCost;
                                    } else {
                                        order.items.forEach((item: any) => {
                                            let itemCost = 0;
                                            if (item.serialNumbers && item.serialNumbers.length > 0) {
                                                item.serialNumbers.forEach((sn: string) => {
                                                    const batch = inventoryProducts.find(p => p.units?.some(u => u.id === sn));
                                                    if (batch) {
                                                        itemCost += (batch.purchasePrice || 0);
                                                    } else {
                                                        const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                                        itemCost += (p?.purchasePrice || 0);
                                                    }
                                                });
                                                if (item.quantity > item.serialNumbers.length) {
                                                    const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                                    itemCost += (p?.purchasePrice || 0) * (item.quantity - item.serialNumbers.length);
                                                }
                                            } else {
                                                const p = inventoryProducts.find(prod => prod.publicProductId === item.productId);
                                                itemCost += (p?.purchasePrice || 0) * (item.quantity || 1);
                                            }
                                            prodCost += itemCost;
                                        });
                                    }
                                    const shipCost = order.shippingInfo.deliveryMethod === 'Pickup' ? 0 : (order.storeShippingCost || 5.40);
                                    const profit = order.total - prodCost - shipCost;

                                    return (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{new Date(order.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{order.id}</td>
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{formatCurrency(order.total)}</td>
                                            <td className="px-6 py-4 text-red-500 dark:text-red-400">-{formatCurrency(prodCost)}</td>
                                            <td className="px-6 py-4 text-orange-500 dark:text-orange-400">-{formatCurrency(shipCost)}</td>
                                            <td className={`px-6 py-4 text-right font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
