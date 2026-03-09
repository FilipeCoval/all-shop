import React, { useState, useMemo } from 'react';
import { X, Package, Plus, Trash2, Save, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Order, OrderItem, OrderPackage, InventoryProduct } from '../types';
import { db } from '../services/firebaseConfig';

interface OrderPackagingModalProps {
    order: Order;
    inventoryProducts: InventoryProduct[];
    onClose: () => void;
    onSuccess: (updatedOrder: Order) => void;
}

const OrderPackagingModal: React.FC<OrderPackagingModalProps> = ({ order, inventoryProducts, onClose, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);
    
    // Initialize packages. If order already has packages, use them. Otherwise, create Box 1 with all items.
    const [packages, setPackages] = useState<OrderPackage[]>(() => {
        if (order.packages && order.packages.length > 0) {
            return JSON.parse(JSON.stringify(order.packages));
        }
        
        const initialItems = (order.items || []).map(item => {
            if (typeof item === 'string') return null;
            const i = item as OrderItem;
            return {
                productId: i.productId,
                selectedVariant: i.selectedVariant,
                quantity: i.quantity
            };
        }).filter(Boolean) as { productId: number, selectedVariant?: string, quantity: number }[];

        return [{
            id: `box-1-${Date.now()}`,
            trackingNumber: order.trackingNumber || '',
            weight: 0, // Will be calculated or manually entered
            items: initialItems
        }];
    });

    const handleAddBox = () => {
        setPackages(prev => [
            ...prev,
            {
                id: `box-${prev.length + 1}-${Date.now()}`,
                trackingNumber: '',
                weight: 0,
                items: []
            }
        ]);
    };

    const handleRemoveBox = (boxId: string) => {
        if (packages.length <= 1) {
            alert("A encomenda tem de ter pelo menos uma caixa.");
            return;
        }
        
        // Move items from the removed box back to the first available box
        const boxToRemove = packages.find(p => p.id === boxId);
        const otherBoxes = packages.filter(p => p.id !== boxId);
        
        if (boxToRemove && boxToRemove.items.length > 0) {
            const firstBox = otherBoxes[0];
            boxToRemove.items.forEach(itemToMove => {
                const existingItem = firstBox.items.find(i => i.productId === itemToMove.productId && i.selectedVariant === itemToMove.selectedVariant);
                if (existingItem) {
                    existingItem.quantity += itemToMove.quantity;
                } else {
                    firstBox.items.push({ ...itemToMove });
                }
            });
        }
        
        setPackages(otherBoxes);
    };

    const moveItem = (fromBoxId: string, toBoxId: string, productId: number, selectedVariant?: string, quantityToMove: number = 1) => {
        setPackages(prev => {
            const newPackages = JSON.parse(JSON.stringify(prev)) as OrderPackage[];
            const fromBox = newPackages.find(p => p.id === fromBoxId);
            const toBox = newPackages.find(p => p.id === toBoxId);
            
            if (!fromBox || !toBox) return prev;
            
            const itemInFromBox = fromBox.items.find(i => i.productId === productId && i.selectedVariant === selectedVariant);
            if (!itemInFromBox || itemInFromBox.quantity < quantityToMove) return prev;
            
            // Remove from source
            itemInFromBox.quantity -= quantityToMove;
            if (itemInFromBox.quantity <= 0) {
                fromBox.items = fromBox.items.filter(i => !(i.productId === productId && i.selectedVariant === selectedVariant));
            }
            
            // Add to destination
            const itemInToBox = toBox.items.find(i => i.productId === productId && i.selectedVariant === selectedVariant);
            if (itemInToBox) {
                itemInToBox.quantity += quantityToMove;
            } else {
                toBox.items.push({ productId, selectedVariant, quantity: quantityToMove });
            }
            
            return newPackages;
        });
    };

    const handleSave = async () => {
        // Validate that all items are assigned
        const totalOriginalItems = (order.items || []).reduce((acc, item) => {
            if (typeof item === 'string') return acc;
            return acc + (item as OrderItem).quantity;
        }, 0);
        
        const totalPackagedItems = packages.reduce((acc, pkg) => {
            return acc + pkg.items.reduce((sum, item) => sum + item.quantity, 0);
        }, 0);
        
        if (totalOriginalItems !== totalPackagedItems) {
            alert(`Erro: Há uma discrepância nas quantidades. Original: ${totalOriginalItems}, Embalado: ${totalPackagedItems}. Verifique as caixas.`);
            return;
        }

        setIsSaving(true);
        try {
            const orderRef = db.collection('orders').doc(order.id);
            
            // If there's only one package, we can also sync its tracking number to the main order trackingNumber for backwards compatibility
            const updates: Partial<Order> = {
                packages: packages
            };
            
            if (packages.length === 1 && packages[0].trackingNumber) {
                updates.trackingNumber = packages[0].trackingNumber;
            }

            await orderRef.update(updates);
            
            onSuccess({ ...order, ...updates });
        } catch (error) {
            console.error("Erro ao guardar volumes:", error);
            alert("Erro ao guardar a configuração das caixas.");
        } finally {
            setIsSaving(false);
        }
    };

    const getProductName = (productId: number) => {
        const item = (order.items || []).find(i => typeof i !== 'string' && i.productId === productId) as OrderItem;
        return item ? item.name : `Produto #${productId}`;
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative transition-colors">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 flex justify-between items-center transition-colors">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Package className="text-indigo-600 dark:text-indigo-400" /> Embalar / Dividir Volumes
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Organize os produtos em diferentes caixas para a expedição.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-slate-900/50">
                    
                    <div className="flex justify-end">
                        <button 
                            onClick={handleAddBox}
                            className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                            <Plus size={18} /> Adicionar Caixa
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {packages.map((pkg, index) => (
                            <div key={pkg.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                                <div className="bg-gray-100 dark:bg-slate-700/50 p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <Package size={18} className="text-gray-500" /> Caixa {index + 1}
                                    </h3>
                                    {packages.length > 1 && (
                                        <button 
                                            onClick={() => handleRemoveBox(pkg.id)}
                                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            title="Remover Caixa"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="p-4 space-y-4 flex-1">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Rastreio (Opcional)</label>
                                            <input 
                                                type="text" 
                                                value={pkg.trackingNumber || ''}
                                                onChange={(e) => {
                                                    const newPackages = [...packages];
                                                    newPackages[index].trackingNumber = e.target.value;
                                                    setPackages(newPackages);
                                                }}
                                                placeholder="Ex: EA123456789PT"
                                                className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Peso (kg)</label>
                                            <input 
                                                type="number" 
                                                step="0.001"
                                                value={pkg.weight || ''}
                                                onChange={(e) => {
                                                    const newPackages = [...packages];
                                                    newPackages[index].weight = parseFloat(e.target.value) || 0;
                                                    setPackages(newPackages);
                                                }}
                                                placeholder="Ex: 1.5"
                                                className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Conteúdo da Caixa</h4>
                                        {pkg.items.length === 0 ? (
                                            <div className="text-sm text-gray-400 italic p-4 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                                                Caixa vazia
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {pkg.items.map((item, iIdx) => (
                                                    <div key={iIdx} className="flex items-center justify-between bg-gray-50 dark:bg-slate-900/50 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                                                        <div className="flex-1 min-w-0 pr-2">
                                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">
                                                                {item.quantity}x {getProductName(item.productId)}
                                                            </p>
                                                            {item.selectedVariant && <p className="text-xs text-gray-500">{item.selectedVariant}</p>}
                                                        </div>
                                                        
                                                        {packages.length > 1 && (
                                                            <div className="flex gap-1">
                                                                {packages.map((targetPkg, tIdx) => {
                                                                    if (targetPkg.id === pkg.id) return null;
                                                                    return (
                                                                        <button
                                                                            key={targetPkg.id}
                                                                            onClick={() => moveItem(pkg.id, targetPkg.id, item.productId, item.selectedVariant, 1)}
                                                                            className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 px-2 py-1 rounded shadow-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-gray-300 flex items-center gap-1"
                                                                            title={`Mover 1 para Caixa ${tIdx + 1}`}
                                                                        >
                                                                            Mover <ArrowRight size={12} /> C{tIdx + 1}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 transition-colors">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        disabled={isSaving}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all"
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                        Guardar Volumes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderPackagingModal;
