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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><BrainCircuit size={20} className="text-purple-600"/> Calculadora de Rentabilidade</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna de Inputs */}
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-3">Dados da Compra</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cashback (%)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                placeholder="Ex: 75" 
                                value={totalCashback} 
                                onChange={e => setTotalCashback(e.target.value)} 
                                className="w-full p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                            />
                            <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        <p className="text-[10px] text-blue-600 mt-1">Calculado sobre valor s/ IVA.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Taxa IVA (%)</label>
                        <input type="number" value={vatRate} onChange={e => setVatRate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-gray-800">Produtos na Encomenda</h4>
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-gray-200 relative">
                  <input type="text" placeholder={`Produto #${index + 1}`} value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} className="p-2 border border-gray-300 rounded-lg bg-gray-50/50" />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                    <input type="number" placeholder="Preço Pago (c/ IVA)" value={item.price} onChange={e => handleItemChange(item.id, 'price', e.target.value)} className="w-full p-2 pl-6 border border-gray-300 rounded-lg bg-gray-50/50" />
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-500 p-1 rounded-full hover:bg-red-200 transition-colors"><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
              <button onClick={addItem} className="w-full text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg flex items-center justify-center gap-2"><Plus size={16} /> Adicionar Produto</button>
            </div>
            
            <button onClick={handleCalculate} className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-600 transition-all">Calcular Custo Real</button>
          </div>

          {/* Coluna de Resultados */}
          <div className="bg-green-50/50 p-4 rounded-xl border border-green-200">
            <h4 className="font-bold text-green-900 mb-4">Resultados e Simulação</h4>
            {results.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <p>Os resultados aparecerão aqui.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {results.map((res, index) => {
                        const sellPriceNum = parseFloat(res.sellPrice) || 0;
                        const profit = sellPriceNum - res.realCost;
                        const margin = sellPriceNum > 0 ? (profit / sellPriceNum) * 100 : 0;
                        
                        return (
                            <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
                                <p className="font-bold text-gray-800">{res.name || `Produto #${index + 1}`}</p>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Custo Real (c/ Cashback)</label>
                                    <p className="text-2xl font-bold text-green-700">{formatCurrency(res.realCost)}</p>
                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Pago (c/ IVA)</p>
                                            <p className="text-xs font-medium">{formatCurrency(res.pricePaid)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Base (s/ IVA)</p>
                                            <p className="text-xs font-medium">{formatCurrency(res.priceExVat)}</p>
                                        </div>
                                        <div className="col-span-2 bg-yellow-50 p-1.5 rounded text-center border border-yellow-100">
                                            <p className="text-[10px] text-yellow-700 font-bold">Retorno Cashback ({totalCashback}%)</p>
                                            <p className="text-xs font-bold text-yellow-600">{formatCurrency(res.allocatedCashback)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-3 border-t border-gray-100">
                                  <label className="block text-xs font-bold text-gray-500 uppercase">Simulador de Preço</label>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                                    <input 
                                        type="number" 
                                        placeholder="Preço de Venda" 
                                        value={res.sellPrice}
                                        onChange={e => handleSellPriceChange(index, e.target.value)}
                                        className="w-full p-2 pl-6 border border-gray-300 rounded-lg" 
                                    />
                                  </div>
                                  {res.sellPrice && (
                                    <div className="grid grid-cols-2 gap-2 text-center pt-2">
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase">Lucro Unitário</p>
                                            <p className={`font-bold text-lg ${profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(profit)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase">Margem</p>
                                            <p className={`font-bold text-lg ${margin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</p>
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
