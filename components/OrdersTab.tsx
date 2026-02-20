
import React, { useState, useMemo } from 'react';
import { BarChart2, ClipboardEdit, Trash2, Package } from 'lucide-react';
import { Order, InventoryProduct } from '../types';

interface OrdersTabProps {
  orders: Order[];
  inventoryProducts: InventoryProduct[];
  isAdmin: boolean;
  onStatusChange: (orderId: string, newStatus: string) => void;
  onDeleteOrder: (orderId: string) => void;
  onViewDetails: (order: Order) => void;
  onOpenManualOrder: () => void;
  onOpenFulfillment: (order: Order) => void;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const OrdersTab: React.FC<OrdersTabProps> = ({ 
  orders, inventoryProducts, isAdmin, 
  onStatusChange, onDeleteOrder, onViewDetails, onOpenManualOrder, onOpenFulfillment
}) => {
  const [chartTimeframe, setChartTimeframe] = useState<'7d' | '30d' | '1y'>('7d');

  const chartData = useMemo(() => {
    const numDays = chartTimeframe === '1y' ? 365 : chartTimeframe === '30d' ? 30 : 7;
    const toLocalISO = (dateStr: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      if (dateStr.length === 10 && !dateStr.includes('T')) return dateStr;
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const manualSales = inventoryProducts.flatMap(p => (p.salesHistory || []).filter(s => !s.id.startsWith('ORDER-') && !s.id.startsWith('FULFILL-')).map(s => ({ date: toLocalISO(s.date), total: (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0) })));
    const onlineOrders = orders.filter(o => o.status !== 'Cancelado').map(o => ({ date: toLocalISO(o.date), total: (Number(o.total) || 0) }));
    const allSales = [...manualSales, ...onlineOrders];
    
    const today = new Date();
    let totalPeriod = 0;

    if (chartTimeframe === '1y') {
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(today.getMonth() - i, 1);
        return d;
      }).reverse();

      const monthlyData = months.map(monthStart => {
        const year = monthStart.getFullYear();
        const month = monthStart.getMonth() + 1;
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
        
        const totalForMonth = allSales.reduce((acc, sale) => {
          return sale.date.startsWith(monthStr) ? acc + sale.total : acc;
        }, 0);
        
        totalPeriod += totalForMonth;
        return { label: monthStart.toLocaleDateString('pt-PT', { month: 'short' }), value: totalForMonth };
      });

      const maxValue = Math.max(...monthlyData.map(d => d.value), 1);
      return { days: monthlyData, maxValue, totalPeriod };
    } else {
      const days = [];
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const dateLabel = `${year}-${month}-${day}`;
        
        const totalForDay = allSales.reduce((acc, sale) => sale.date === dateLabel ? acc + sale.total : acc, 0);
        totalPeriod += totalForDay;
        
        days.push({ label: d.toLocaleDateString('pt-PT', { day: 'numeric' }), date: dateLabel, value: totalForDay });
      }
      
      const maxValue = Math.max(...days.map(d => d.value), 1);
      return { days, maxValue, totalPeriod };
    }
  }, [orders, inventoryProducts, chartTimeframe]);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><div className="flex justify-between items-center mb-6"><div className="flex items-center gap-4"><h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart2 className="text-indigo-600" /> Faturação Geral</h3><div className="bg-gray-100 p-1 rounded-lg flex gap-1 text-xs font-medium"><button onClick={() => setChartTimeframe('7d')} className={`px-2 py-1 rounded ${chartTimeframe === '7d' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>7D</button><button onClick={() => setChartTimeframe('30d')} className={`px-2 py-1 rounded ${chartTimeframe === '30d' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>30D</button><button onClick={() => setChartTimeframe('1y')} className={`px-2 py-1 rounded ${chartTimeframe === '1y' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>1A</button></div></div><span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Total: {formatCurrency(chartData.totalPeriod)}</span></div><div className="flex items-stretch h-64 gap-4"><div className="flex flex-col justify-between text-xs font-medium text-gray-400 py-2 min-w-[30px] text-right"><span>{formatCurrency(chartData.maxValue)}</span><span>{formatCurrency(chartData.maxValue / 2)}</span><span>0€</span></div><div className="flex items-end flex-1 gap-2 md:gap-4 relative border-l border-b border-gray-200"><div className="absolute w-full border-t border-dashed border-gray-100 top-2 left-0 z-0"></div><div className="absolute w-full border-t border-dashed border-gray-100 top-1/2 left-0 z-0"></div>{chartData.days.map((day, idx) => { const heightPercent = (day.value / chartData.maxValue) * 100; const isZero = day.value === 0; return <div key={idx} className="flex-1 flex flex-col justify-end h-full group relative z-10"><div className={`w-full rounded-t-md transition-all duration-700 ease-out relative group-hover:brightness-110 ${isZero ? 'bg-gray-100' : 'bg-gradient-to-t from-blue-500 to-indigo-600 shadow-lg shadow-indigo-200'}`} style={{ height: isZero ? '4px' : `${heightPercent}%`, minHeight: '4px' }}>{!isZero && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-20">{formatCurrency(day.value)}<div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div></div>}</div><span className="text-[10px] md:text-xs text-gray-500 font-medium mt-2 text-center uppercase tracking-wide">{day.label}</span></div>})}</div></div></div>
        <div className="flex justify-end"><button onClick={onOpenManualOrder} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-bold shadow-md"><ClipboardEdit size={18} /> Registar Encomenda Manual</button></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase"><tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Total</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100 text-sm">{orders.map(order => <tr key={order.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold text-indigo-700">{order.id}</td><td className="px-6 py-4">{order.shippingInfo?.name || 'N/A'}</td><td className="px-6 py-4 font-bold">{formatCurrency(order.total)}</td><td className="px-6 py-4"><select value={order.status} onChange={(e) => onStatusChange(order.id, e.target.value)} className={`text-xs font-bold px-2 py-1 rounded-full border-none cursor-pointer ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : order.status === 'Enviado' ? 'bg-blue-100 text-blue-800' : order.status === 'Pago' ? 'bg-cyan-100 text-cyan-800' : order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : order.status === 'Levantamento em Loja' ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800'}`}><option value="Processamento">Processamento</option><option value="Pago">Pago</option><option value="Enviado">Enviado</option><option value="Levantamento em Loja">Levantamento em Loja</option><option value="Entregue">Entregue</option><option value="Cancelado">Cancelado</option></select></td><td className="px-6 py-4 text-right flex justify-end items-center gap-2">{isAdmin && ['Processamento', 'Pago'].includes(order.status) && (<button onClick={() => onOpenFulfillment(order)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold hover:bg-blue-200 flex items-center gap-1 shadow-sm mr-2" title="Preparar Envio e Stock"><Package size={14} /> Expedir</button>)}<button onClick={() => onViewDetails(order)} className="text-indigo-600 font-bold text-xs hover:underline">Detalhes</button>{isAdmin && order.status === 'Cancelado' && (<button onClick={() => onDeleteOrder(order.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Apagar Encomenda"><Trash2 size={16} /></button>)}</td></tr>)}</tbody></table></div></div>
    </div>
  );
};

export default OrdersTab;
