
import React, { useState, useEffect } from 'react';
import { X, Package, CheckCircle, ScanBarcode, Search } from 'lucide-react';
import { Order, InventoryProduct, OrderItem, SaleRecord } from '../types';
import BarcodeScanner from './BarcodeScanner';

interface OrderFulfillmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[]; // Apenas encomendas pendentes (Processamento/Pago)
    inventory: InventoryProduct[];
    onConfirmFulfillment: (orderId: string, deductions: { batchId: string, quantity: number, saleRecord: SaleRecord, serialNumbers?: string[] }[]) => Promise<void>;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const OrderFulfillmentModal: React.FC<OrderFulfillmentModalProps> = ({ isOpen, onClose, orders, inventory, onConfirmFulfillment }) => {
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    // Mapeia index do item na encomenda -> dados de fulfillment
    const [scannedItems, setScannedItems] = useState<Record<string, { batchId: string, serials: string[], fulfilledQty: number }>>({});
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [activeScanItemIndex, setActiveScanItemIndex] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset ao abrir
    useEffect(() => {
        if (isOpen) {
            setSelectedOrderId('');
            setScannedItems({});
            setIsSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const selectedOrder = orders.find(o => o.id === selectedOrderId);

    // Helpers
    const getSafeItems = (items: any): OrderItem[] => {
        if (!items) return [];
        return Array.isArray(items) 
            ? items.filter(i => typeof i === 'object') as OrderItem[] 
            : [];
    };

    const orderItems = selectedOrder ? getSafeItems(selectedOrder.items) : [];

    // Encontrar stock compatível para um item da encomenda
    const findMatchingInventory = (orderItem: OrderItem) => {
        return inventory.filter(inv => {
            const idMatch = inv.publicProductId === orderItem.productId;
            // Se o item da encomenda tem variante, o stock tem de ter a mesma variante
            // Se o item não tem variante, aceita qualquer lote (ou preferencialmente lote sem variante)
            const variantMatch = !orderItem.selectedVariant || (inv.variant === orderItem.selectedVariant);
            const hasStock = (inv.quantityBought - inv.quantitySold) > 0;
            return idMatch && variantMatch && hasStock;
        });
    };

    const handleScan = (code: string) => {
        if (activeScanItemIndex === null || !selectedOrder) return;
        
        const item = orderItems[activeScanItemIndex];
        const matchingBatches = findMatchingInventory(item);
        
        // 1. Tentar encontrar a unidade pelo Serial Number (S/N) nos lotes compatíveis
        let foundBatch = null;
        let isSerialMatch = false;

        for (const batch of matchingBatches) {
            if (batch.units?.some(u => u.id === code && u.status === 'AVAILABLE')) {
                foundBatch = batch;
                isSerialMatch = true;
                break;
            }
        }

        // Se encontrou por S/N
        if (isSerialMatch && foundBatch) {
            const key = `${activeScanItemIndex}`;
            const current = scannedItems[key] || { batchId: foundBatch.id, serials: [], fulfilledQty: 0 };
            
            if (current.serials.includes(code)) {
                alert("Este número de série já foi adicionado.");
                return;
            }

            if (current.fulfilledQty >= item.quantity) {
                alert("Quantidade máxima atingida para este item.");
                return;
            }

            setScannedItems(prev => ({
                ...prev,
                [key]: {
                    batchId: foundBatch!.id,
                    serials: [...current.serials, code],
                    fulfilledQty: current.fulfilledQty + 1
                }
            }));
            
            // Feedback sonoro
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
            
            // Se completou a quantidade deste item, fecha o scanner
            if (current.fulfilledQty + 1 >= item.quantity) {
                setIsScannerOpen(false);
            }
        } else {
            // Fallback: Se o código lido for o EAN/Código do produto e o produto não exigir S/N
            alert(`Código "${code}" não corresponde a um S/N disponível para este artigo.`);
        }
    };

    const handleManualSelect = (index: number, batchId: string) => {
        const item = orderItems[index];
        const key = `${index}`;
        
        // Para seleção manual (sem S/N), assumimos que preenche a quantidade total restante
        // Isto é ideal para cabos ou acessórios sem S/N individual
        
        setScannedItems(prev => ({
            ...prev,
            [key]: {
                batchId: batchId,
                serials: [], // Sem seriais manuais
                fulfilledQty: item.quantity 
            }
        }));
    };

    const isReadyToSubmit = orderItems.length > 0 && orderItems.every((item, idx) => {
        const data = scannedItems[`${idx}`];
        return data && data.fulfilledQty === item.quantity;
    });

    const handleSubmit = async () => {
        if (!selectedOrder) return;
        setIsSubmitting(true);

        const deductions = Object.entries(scannedItems).map(([key, data]) => {
            const idx = parseInt(key);
            const item = orderItems[idx];
            
            const saleRecord: SaleRecord = {
                id: `FULFILL-${selectedOrder.id}-${Date.now()}`,
                date: new Date().toISOString(),
                quantity: data.fulfilledQty,
                unitPrice: item.price,
                notes: `Encomenda Online ${selectedOrder.id}`,
                shippingCost: 0 // Portes são globais
            };

            return {
                batchId: data.batchId,
                quantity: data.fulfilledQty,
                saleRecord,
                serialNumbers: data.serials.length > 0 ? data.serials : undefined
            };
        });

        try {
            await onConfirmFulfillment(selectedOrder.id, deductions);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Erro ao processar venda.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                            <Package className="text-indigo-600"/> Processar Encomenda
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Valide o stock para expedir a encomenda.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={24}/></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* 1. Seleção de Encomenda */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">1. Selecione a Encomenda Pendente</label>
                        <div className="relative">
                            <select 
                                value={selectedOrderId} 
                                onChange={(e) => { setSelectedOrderId(e.target.value); setScannedItems({}); }} 
                                className="w-full p-4 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-base bg-white appearance-none cursor-pointer"
                            >
                                <option value="">-- Selecione --</option>
                                {orders.map(o => (
                                    <option key={o.id} value={o.id}>
                                        {o.id} | {o.shippingInfo.name} | {formatCurrency(o.total)} | {new Date(o.date).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                        </div>
                    </div>

                    {selectedOrder && (
                        <div className="animate-fade-in space-y-6">
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-full text-indigo-600 shadow-sm"><Package size={24}/></div>
                                    <div>
                                        <p className="font-bold text-indigo-900">{selectedOrder.shippingInfo.name}</p>
                                        <p className="text-sm text-indigo-700">{selectedOrder.shippingInfo.email}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="inline-block px-3 py-1 bg-white text-indigo-600 rounded-lg text-xs font-bold shadow-sm border border-indigo-100">
                                        {selectedOrder.shippingInfo.deliveryMethod === 'Pickup' ? 'Levantamento em Loja' : 'Envio CTT'}
                                    </span>
                                </div>
                            </div>

                            {/* 2. Lista de Artigos para validar */}
                            <div>
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 border-b pb-2">
                                    2. Validação de Artigos <span className="text-xs font-normal text-gray-500 ml-auto">Escaneie o S/N ou selecione o lote</span>
                                </h4>
                                <div className="space-y-3">
                                    {orderItems.map((item, idx) => {
                                        const matchingBatches = findMatchingInventory(item);
                                        const status = scannedItems[`${idx}`];
                                        const isFulfilled = status && status.fulfilledQty >= item.quantity;
                                        const hasAvailableSerials = matchingBatches.some(b => b.units && b.units.some(u => u.status === 'AVAILABLE'));
                                        
                                        return (
                                            <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${isFulfilled ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-lg">{item.name}</p>
                                                        <p className="text-sm text-gray-500">{item.selectedVariant || 'Padrão'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${isFulfilled ? 'bg-green-200 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                            {status ? status.fulfilledQty : 0} / {item.quantity} un
                                                        </span>
                                                    </div>
                                                </div>

                                                {!isFulfilled && (
                                                    <div className="flex flex-col md:flex-row gap-2 items-center">
                                                        {hasAvailableSerials ? (
                                                            <button 
                                                                onClick={() => { setActiveScanItemIndex(idx); setIsScannerOpen(true); }}
                                                                className="w-full md:w-auto flex-1 bg-gray-900 hover:bg-black text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md"
                                                            >
                                                                <ScanBarcode size={18}/> Ler Número de Série
                                                            </button>
                                                        ) : (
                                                            <div className="w-full relative">
                                                                <select 
                                                                    className="w-full p-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                                                    onChange={(e) => handleManualSelect(idx, e.target.value)}
                                                                    value={status?.batchId || ''}
                                                                >
                                                                    <option value="">Selecione o Lote Manualmente...</option>
                                                                    {matchingBatches.map(b => (
                                                                        <option key={b.id} value={b.id}>
                                                                            Lote: {new Date(b.purchaseDate).toLocaleDateString()} (Stock: {b.quantityBought - b.quantitySold})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {status && status.serials.length > 0 && (
                                                    <div className="mt-3 text-xs font-mono text-gray-600 bg-white/80 p-2 rounded border border-gray-200 flex flex-wrap gap-2">
                                                        <span className="font-bold text-gray-400">S/N:</span> 
                                                        {status.serials.map(s => <span key={s} className="bg-gray-100 px-1 rounded">{s}</span>)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors">Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={!isReadyToSubmit || isSubmitting}
                        className="px-8 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all transform active:scale-95"
                    >
                        <CheckCircle size={20}/> {isSubmitting ? 'A Processar...' : 'Confirmar Saída'}
                    </button>
                </div>
            </div>

            {isScannerOpen && (
                <BarcodeScanner 
                    mode="serial" 
                    onClose={() => setIsScannerOpen(false)} 
                    onCodeSubmit={handleScan} 
                />
            )}
        </div>
    );
};

export default OrderFulfillmentModal;
