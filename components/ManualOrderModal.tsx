
import React, { useState, useEffect, useMemo } from 'react';
import { X, ClipboardEdit, Trash2, Truck, Store, Save, Search, Plus, Minus } from 'lucide-react';
import { Product, Order, InventoryProduct, OrderItem, SaleRecord, ProductStatus, UserCheckoutInfo } from '../types';
import { db } from '../services/firebaseConfig';

interface ManualOrderItem extends Product {
    quantity: number;
    selectedVariant: string; 
    finalPrice: number;
}

interface ManualOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    publicProducts: Product[];
    inventoryProducts: InventoryProduct[];
    onConfirm: (order: Order, deductions: { batchId: string, quantity: number, saleRecord: SaleRecord }[]) => Promise<void>;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const ManualOrderModal: React.FC<ManualOrderModalProps> = ({ isOpen, onClose, publicProducts, inventoryProducts, onConfirm }) => {
    const [items, setItems] = useState<ManualOrderItem[]>([]);
    const [customer, setCustomer] = useState({ name: '', email: '' });
    const [shippingAddress, setShippingAddress] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('MB Way');
    const [deliveryMethod, setDeliveryMethod] = useState<'Shipping' | 'Pickup'>('Shipping');
    const [shippingCost, setShippingCost] = useState(4.99);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset shipping cost when delivery method changes
    useEffect(() => {
        if (deliveryMethod === 'Pickup') {
            setShippingCost(0);
            if (!shippingAddress) setShippingAddress('Levantamento em Loja');
        } else {
            setShippingCost(4.99);
            if (shippingAddress === 'Levantamento em Loja') setShippingAddress('');
        }
    }, [deliveryMethod]);

    const productsForSelect = useMemo(() => {
        return publicProducts.flatMap(p => {
            if (p.variants && p.variants.length > 0) {
                return p.variants.map(v => ({
                    value: `${p.id}|${v.name}`,
                    label: `${p.name} - ${v.name}`
                }));
            }
            return [{ value: `${p.id}|`, label: p.name }];
        });
    }, [publicProducts]);

    const addItem = (value: string) => {
        if (!value) return;
        const [idStr, variantName] = value.split('|');
        const product = publicProducts.find(p => p.id === Number(idStr));
        if (!product) return;

        setItems(prev => {
            const key = `${product.id}|${variantName}`;
            const existing = prev.find(item => `${item.id}|${item.selectedVariant}` === key);
            
            if (existing) {
                return prev.map(item => (`${item.id}|${item.selectedVariant}` === key) ? { ...item, quantity: item.quantity + 1 } : item);
            }

            let finalPrice = product.price;
            if (variantName) {
                const variant = product.variants?.find(v => v.name === variantName);
                if (variant) finalPrice = variant.price;
            }

            return [...prev, { ...product, quantity: 1, selectedVariant: variantName, finalPrice }];
        });
    };

    const updateQuantity = (key: string, delta: number) => {
        setItems(prev => prev.map(item => {
            if (`${item.id}|${item.selectedVariant}` === key) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }).filter(item => item.quantity > 0)); // Filter is technically redundant due to newQty check but safe
    };

    const removeItem = (key: string) => {
        setItems(prev => prev.filter(item => `${item.id}|${item.selectedVariant}` !== key));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) return alert("Adicione produtos primeiro.");
        if (!customer.name) return alert("Nome do cliente é obrigatório.");

        setIsSubmitting(true);

        const orderId = `MANUAL-${Date.now().toString().slice(-6)}`;
        const productsTotal = items.reduce((acc, i) => acc + i.finalPrice * i.quantity, 0);
        const finalShipping = deliveryMethod === 'Pickup' ? 0 : shippingCost;
        const total = productsTotal + finalShipping;

        const newOrder: Order = {
            id: orderId,
            date: new Date().toISOString(),
            total: total,
            status: 'Pago',
            items: items.map(i => ({
                productId: i.id,
                name: i.name,
                price: i.finalPrice,
                quantity: i.quantity,
                selectedVariant: i.selectedVariant,
                addedAt: new Date().toISOString()
            })),
            shippingInfo: {
                name: customer.name,
                email: customer.email,
                street: deliveryMethod === 'Pickup' ? 'Levantamento em Loja' : shippingAddress,
                doorNumber: '', zip: '', city: '', phone: '',
                paymentMethod: paymentMethod as any,
                deliveryMethod: deliveryMethod
            },
            userId: null
        };

        const deductions: { batchId: string, quantity: number, saleRecord: SaleRecord }[] = [];

        // Lógica de alocação de stock (FIFO)
        for (const item of items) {
            const relevantBatches = inventoryProducts
                .filter(p => p.publicProductId === item.id)
                .filter(p => {
                    if (item.selectedVariant) return p.variant === item.selectedVariant;
                    return true;
                })
                .sort((a,b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());

            let qtyToDeduct = item.quantity;

            for (const batch of relevantBatches) {
                if (qtyToDeduct <= 0) break;
                
                const availableInBatch = Math.max(0, (batch.quantityBought || 0) - (batch.quantitySold || 0));
                
                if (availableInBatch > 0) {
                    const deduct = Math.min(availableInBatch, qtyToDeduct);
                    
                    const saleRecord: SaleRecord = {
                        id: `SALE-${orderId}-${batch.id}`,
                        date: new Date().toISOString(),
                        quantity: deduct,
                        unitPrice: item.finalPrice,
                        shippingCost: 0,
                        notes: `Encomenda Manual ${orderId}`
                    };

                    deductions.push({
                        batchId: batch.id,
                        quantity: deduct,
                        saleRecord
                    });
                    
                    qtyToDeduct -= deduct;
                }
            }
            
            if (qtyToDeduct > 0) {
                if(!window.confirm(`Aviso: Stock insuficiente para "${item.name}". Faltam ${qtyToDeduct} unidades.\nDeseja continuar e registar com stock negativo?`)) {
                    setIsSubmitting(false);
                    return;
                }
            }
        }

        try {
            await onConfirm(newOrder, deductions);
            setItems([]);
            setCustomer({ name: '', email: '' });
            setShippingAddress('');
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao processar encomenda.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><ClipboardEdit size={20} className="text-purple-600"/> Criar Encomenda Manual</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Produtos */}
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <h4 className="font-bold text-purple-900 text-sm mb-3">1. Adicionar Produtos</h4>
                        <div className="relative mb-4">
                            <select onChange={(e) => { addItem(e.target.value); e.target.value = ''; }} className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white appearance-none">
                                <option value="">-- Pesquisar Produto --</option>
                                {productsForSelect.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
                            </select>
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                                    <div>
                                        <p className="font-bold text-sm text-gray-800">{item.name}</p>
                                        <p className="text-xs text-gray-500">{item.selectedVariant || 'Padrão'} | {formatCurrency(item.finalPrice)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                            <button type="button" onClick={() => updateQuantity(`${item.id}|${item.selectedVariant}`, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm hover:bg-gray-50 text-gray-600"><Minus size={12}/></button>
                                            <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                                            <button type="button" onClick={() => updateQuantity(`${item.id}|${item.selectedVariant}`, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm hover:bg-gray-50 text-gray-600"><Plus size={12}/></button>
                                        </div>
                                        <p className="font-bold text-purple-700 w-16 text-right text-sm">{formatCurrency(item.finalPrice * item.quantity)}</p>
                                        <button type="button" onClick={() => removeItem(`${item.id}|${item.selectedVariant}`)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && <p className="text-center text-gray-400 text-sm py-4 italic">Nenhum produto adicionado.</p>}
                        </div>
                    </div>
                    
                    {/* Dados Cliente */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="font-bold text-gray-800 text-sm mb-3">2. Dados do Cliente</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label><input type="text" required value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Nome do Cliente" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (Opcional)</label><input type="email" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="email@exemplo.com" /></div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Método de Entrega</label>
                            <div className="flex gap-4 mb-4">
                                <button type="button" onClick={() => setDeliveryMethod('Shipping')} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 flex items-center justify-center gap-2 transition-colors ${deliveryMethod === 'Shipping' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'}`}><Truck size={16}/> Envio CTT</button>
                                <button type="button" onClick={() => setDeliveryMethod('Pickup')} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 flex items-center justify-center gap-2 transition-colors ${deliveryMethod === 'Pickup' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'}`}><Store size={16}/> Levantamento</button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Morada / Notas</label>
                                    <textarea required={deliveryMethod === 'Shipping'} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" rows={2} placeholder={deliveryMethod === 'Pickup' ? "Notas opcionais..." : "Morada completa"} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Custo Portes (€)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={shippingCost} 
                                        onChange={e => setShippingCost(parseFloat(e.target.value))} 
                                        disabled={deliveryMethod === 'Pickup'}
                                        className={`w-full p-2 border border-gray-300 rounded-lg ${deliveryMethod === 'Pickup' ? 'bg-gray-100 text-gray-400' : 'bg-white'}`} 
                                    />
                                    {deliveryMethod === 'Pickup' && <p className="text-[10px] text-green-600 mt-1 font-bold">Grátis para levantamento.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Pagamento</label><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white"><option value="MB Way">MB Way</option><option value="Transferência">Transferência Bancária</option><option value="Cobrança">À Cobrança</option><option value="Dinheiro">Dinheiro (Em Mão)</option></select></div>
                    </div>
                    
                    <div className="flex justify-between items-center bg-gray-100 p-4 rounded-xl border border-gray-200">
                        <span className="font-bold text-gray-600">Total Final:</span>
                        <span className="font-bold text-xl text-gray-900">{formatCurrency(items.reduce((acc, i) => acc + i.finalPrice * i.quantity, 0) + (deliveryMethod === 'Pickup' ? 0 : shippingCost))}</span>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-70 disabled:scale-100">
                        <Save size={20} /> {isSubmitting ? 'A processar...' : 'Criar Encomenda e Deduzir Stock'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ManualOrderModal;
