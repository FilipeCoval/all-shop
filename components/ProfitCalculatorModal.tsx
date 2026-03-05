
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, TrendingUp, Percent, BrainCircuit, Info } from 'lucide-react';

interface ProfitCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CalcItem {
  id: number;
  name: string;
  price: string;
}

interface ResultItem {
  name: string;
  pricePaid: number;
  priceExVat: number; // Novo campo para mostrar valor base
  realCost: number;
  allocatedCashback: number;
  sellPrice: string;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const ProfitCalculatorModal: React.FC<ProfitCalculatorModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<CalcItem[]>([{ id: 1, name: '', price: '' }]);
  const [totalCashback, setTotalCashback] = useState(''); 
  const [vatRate, setVatRate] = useState('23');
  const [results, setResults] = useState<ResultItem[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setItems([{ id: 1, name: '', price: '' }]);
      setTotalCashback('');
      setVatRate('23');
      setResults([]);
    }
  }, [isOpen]);

  const handleItemChange = (id: number, field: 'name' | 'price', value: string) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems([...items, { id: Date.now(), name: '', price: '' }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSellPriceChange = (index: number, value: string) => {
    setResults(results.map((res, i) => i === index ? { ...res, sellPrice: value } : res));
  };

  const handleCalculate = () => {
    const vatNum = parseFloat(vatRate);
    const cashbackPercentage = parseFloat(totalCashback) || 0; 
    
    if (isNaN(vatNum)) {
      alert("Taxa de IVA inválida.");
      return;
    }

    const processedItems = items.map(item => ({
      ...item,
      priceWithVat: parseFloat(item.price) || 0,
    })).filter(item => item.priceWithVat > 0);

    if (processedItems.length === 0) {
      alert("Adicione pelo menos um produto com preço válido.");
      return;
    }
    
    // CORREÇÃO: Cashback calculado sobre o valor SEM IVA (Base Taxável)
    const newResults: ResultItem[] = processedItems.map(item => {
        // 1. Encontrar o valor sem IVA (Ex: 116 / 1.23 = 94.30)
        const priceExVat = item.priceWithVat / (1 + (vatNum / 100));

        // 2. Calcular cashback sobre o valor base
        const allocatedCashback = priceExVat * (cashbackPercentage / 100);
        
        // 3. Custo real é o que saiu do bolso (c/ IVA) menos o que volta (cashback)
        const realCost = item.priceWithVat - allocatedCashback;
        
        return {
            name: item.name,
            pricePaid: item.priceWithVat,
            priceExVat: priceExVat,
            realCost: realCost,
            allocatedCashback: allocatedCashback,
            sellPrice: ''
        };
    });

    setResults(newResults);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2"><BrainCircuit size={20} className="text-purple-600 dark:text-purple-400"/> Calculadora de Rentabilidade</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors"><X size={24}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna de Inputs */}
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-3">Dados da Compra</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Cashback (%)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                placeholder="Ex: 75" 
                                value={totalCashback} 
                                onChange={e => setTotalCashback(e.target.value)} 
                                className="w-full p-2 pr-8 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors" 
                            />
                            <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Calculado sobre valor s/ IVA.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Taxa IVA (%)</label>
                        <input type="number" value={vatRate} onChange={e => setVatRate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors" />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 dark:text-gray-200">Produtos na Encomenda</h4>
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-slate-700 relative transition-colors">
                  <input type="text" placeholder={`Produto #${index + 1}`} value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50/50 dark:bg-slate-900/50 text-gray-900 dark:text-white transition-colors" />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                    <input type="number" placeholder="Preço Pago (c/ IVA)" value={item.price} onChange={e => handleItemChange(item.id, 'price', e.target.value)} className="w-full p-2 pl-6 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50/50 dark:bg-slate-900/50 text-gray-900 dark:text-white transition-colors" />
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="absolute -top-2 -right-2 bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
              <button onClick={addItem} className="w-full text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"><Plus size={16} /> Adicionar Produto</button>
            </div>
            
            <button onClick={handleCalculate} className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-600 transition-all">Calcular Custo Real</button>
          </div>

          {/* Coluna de Resultados */}
          <div className="bg-green-50/50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 transition-colors">
            <h4 className="font-bold text-green-900 dark:text-green-300 mb-4">Resultados e Simulação</h4>
            {results.length === 0 ? (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                    <p>Os resultados aparecerão aqui.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {results.map((res, index) => {
                        const sellPriceNum = parseFloat(res.sellPrice) || 0;
                        const profit = sellPriceNum - res.realCost;
                        const margin = sellPriceNum > 0 ? (profit / sellPriceNum) * 100 : 0;
                        
                        return (
                            <div key={index} className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm space-y-3 transition-colors">
                                <p className="font-bold text-gray-800 dark:text-gray-200">{res.name || `Produto #${index + 1}`}</p>
                                <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded-lg border border-gray-100 dark:border-slate-800 transition-colors">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Custo Real (c/ Cashback)</label>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(res.realCost)}</p>
                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Pago (c/ IVA)</p>
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">{formatCurrency(res.pricePaid)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Base (s/ IVA)</p>
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">{formatCurrency(res.priceExVat)}</p>
                                        </div>
                                        <div className="col-span-2 bg-yellow-50 dark:bg-yellow-900/20 p-1.5 rounded text-center border border-yellow-100 dark:border-yellow-800 transition-colors">
                                            <p className="text-[10px] text-yellow-700 dark:text-yellow-400 font-bold">Retorno Cashback ({totalCashback}%)</p>
                                            <p className="text-xs font-bold text-yellow-600 dark:text-yellow-500">{formatCurrency(res.allocatedCashback)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-slate-700 transition-colors">
                                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Simulador de Preço</label>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                                    <input 
                                        type="number" 
                                        placeholder="Preço de Venda" 
                                        value={res.sellPrice}
                                        onChange={e => handleSellPriceChange(index, e.target.value)}
                                        className="w-full p-2 pl-6 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors" 
                                    />
                                  </div>
                                  {res.sellPrice && (
                                    <div className="grid grid-cols-2 gap-2 text-center pt-2">
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Lucro Unitário</p>
                                            <p className={`font-bold text-lg ${profit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(profit)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Margem</p>
                                            <p className={`font-bold text-lg ${margin >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{margin.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                  )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitCalculatorModal;
