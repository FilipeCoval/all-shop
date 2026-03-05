import React, { useState, useMemo, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Package, ScanLine, Loader2, Lock, Camera, MousePointerClick } from 'lucide-react';
import { Order, InventoryProduct, OrderItem, StockMovement, ProductStatus, SaleRecord, User, PointHistory } from '../types';
import { db, auth, firebase } from '../services/firebaseConfig';
import BarcodeScanner from './BarcodeScanner';
import { LOYALTY_TIERS } from '../constants';

interface OrderFulfillmentModalProps {
    order: Order;
    inventoryProducts: InventoryProduct[];
    onClose: () => void;
    onSuccess: () => void;
}

interface ScannedItem {
    orderItemId: string; // productId-variant ou apenas productId
    serialNumber: string;
    inventoryProductId: string; // ID do documento no Firestore (lote)
    productName: string;
}

const OrderFulfillmentModal: React.FC<OrderFulfillmentModalProps> = ({ order, inventoryProducts, onClose, onSuccess }) => {
    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [showManualSelection, setShowManualSelection] = useState<string | null>(null); // ID do item da encomenda para seleção manual

    // Normalizar itens da encomenda para facilitar o processamento
    const orderItems = useMemo(() => {
        return (order.items || []).map(item => {
            if (typeof item === 'string') return null; // Ignorar legacy string items se existirem
            const i = item as OrderItem;
            return {
                ...i,
                uniqueId: i.selectedVariant ? `${i.productId}-${i.selectedVariant}` : `${i.productId}`,
                needed: i.quantity
            };
        }).filter(Boolean) as (OrderItem & { uniqueId: string, needed: number })[];
    }, [order.items]);

    // Calcular progresso
    const progress = useMemo(() => {
        const totalNeeded = orderItems.reduce((acc, item) => acc + item.needed, 0);
        const totalScanned = scannedItems.length;
        return { totalNeeded, totalScanned, isComplete: totalNeeded === totalScanned && totalNeeded > 0 };
    }, [orderItems, scannedItems]);

    const processCode = (code: string) => {
        if (!code) return;
        setError(null);

        // 1. Verificar se já foi scaneado nesta sessão
        if (scannedItems.some(s => s.serialNumber === code)) {
            setError(`O serial ${code} já foi adicionado a esta expedição.`);
            return;
        }

        // 2. Encontrar o lote de inventário que contém este serial
        let foundBatch: InventoryProduct | undefined;
        let foundUnit: any | undefined;

        for (const batch of inventoryProducts) {
            if (batch.units) {
                const unit = batch.units.find(u => u.id.toUpperCase() === code);
                if (unit) {
                    foundBatch = batch;
                    foundUnit = unit;
                    break;
                }
            }
        }

        if (!foundBatch || !foundUnit) {
            setError(`Serial ${code} não encontrado no sistema.`);
            return;
        }

        // 3. Validar estado da unidade
        if (foundUnit.status !== 'AVAILABLE') {
             setError(`A unidade ${code} não está disponível (Status: ${foundUnit.status}).`);
             return;
        }

        // 4. Verificar se corresponde a algum item da encomenda que ainda precisa de unidades
        const targetItem = orderItems.find(item => {
            const isProductMatch = item.productId === foundBatch?.publicProductId;
            
            const orderVariant = (item.selectedVariant || '').trim().toLowerCase();
            const batchVariant = (foundBatch?.variant || '').trim().toLowerCase();
            
            const isVariantMatch = orderVariant === '' || orderVariant === batchVariant;

            const scannedForThisItem = scannedItems.filter(s => s.orderItemId === item.uniqueId).length;
            const needsMore = scannedForThisItem < item.needed;

            return isProductMatch && isVariantMatch && needsMore;
        });

        if (!targetItem) {
            setError(`O serial ${code} (${foundBatch.name}) não corresponde a nenhum item pendente nesta encomenda.`);
            return;
        }

        // 5. Adicionar à lista
        setScannedItems(prev => [...prev, {
            orderItemId: targetItem.uniqueId,
            serialNumber: code,
            inventoryProductId: foundBatch!.id,
            productName: foundBatch!.name
        }]);
        setCurrentInput('');
        setIsScannerOpen(false);
    };

    const handleScanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        processCode(currentInput.trim().toUpperCase());
    };

    const handleManualSelect = (serial: string) => {
        processCode(serial);
        setShowManualSelection(null);
    };

    const getAvailableUnitsForOrderItem = (orderItemUniqueId: string) => {
        const item = orderItems.find(i => i.uniqueId === orderItemUniqueId);
        if (!item) return [];

        const availableUnits: { serial: string, batchName: string }[] = [];

        inventoryProducts.forEach(batch => {
            const isProductMatch = item.productId === batch.publicProductId;
            const orderVariant = (item.selectedVariant || '').trim().toLowerCase();
            const batchVariant = (batch.variant || '').trim().toLowerCase();
            const isVariantMatch = orderVariant === '' || orderVariant === batchVariant;

            if (isProductMatch && isVariantMatch && batch.units) {
                batch.units.forEach(unit => {
                    if (unit.status === 'AVAILABLE' && !scannedItems.some(s => s.serialNumber === unit.id)) {
                        availableUnits.push({ serial: unit.id, batchName: batch.name });
                    }
                });
            }
        });

        return availableUnits;
    };

    const [trackingNumber, setTrackingNumber] = useState('');
    
    const isPickup = order.status === 'Levantamento em Loja';

    const handleConfirmFulfillment = async () => {
        if (!progress.isComplete) return;
        if (!window.confirm(isPickup ? "Confirmar entrega ao cliente? O stock será abatido." : "Tem a certeza? Esta ação é irreversível e irá abater o stock imediatamente.")) return;

        setIsProcessing(true);
        setError(null);

        try {
            await db.runTransaction(async (transaction) => {
                const timestamp = new Date().toISOString(); // Mantemos ISO para compatibilidade com interfaces atuais, mas validado na transação
                const adminId = auth.currentUser?.uid || 'admin';
                const adminEmail = auth.currentUser?.email || 'admin';

                // 1. Leituras (Reads) - Têm de ser feitas ANTES de qualquer escrita
                const orderRef = db.collection('orders').doc(order.id);
                const orderDoc = await transaction.get(orderRef);

                if (!orderDoc.exists) {
                    throw new Error("A encomenda não existe.");
                }

                const currentOrder = orderDoc.data() as Order;
                if (currentOrder.fulfillmentStatus === 'COMPLETED') {
                    throw new Error("Esta encomenda já foi processada anteriormente.");
                }

                // Ler documento do utilizador se for levantamento em loja para atribuir pontos
                let userDoc: firebase.firestore.DocumentSnapshot | null = null;
                const userRef = order.userId ? db.collection('users').doc(order.userId) : null;
                if (isPickup && userRef && !currentOrder.pointsAwarded) {
                    userDoc = await transaction.get(userRef);
                }

                // Identificar e ler todos os lotes necessários
                const batchIds = Array.from(new Set(scannedItems.map(i => i.inventoryProductId)));
                const batchDocs: Record<string, firebase.firestore.DocumentSnapshot> = {};
                
                for (const batchId of batchIds) {
                    const ref = db.collection('products_inventory').doc(batchId);
                    const doc = await transaction.get(ref);
                    if (!doc.exists) throw new Error(`Lote ${batchId} não encontrado no sistema.`);
                    batchDocs[batchId] = doc;
                }

                // 2. Processamento e Validações em Memória
                const updatesByBatch: Record<string, { newSold: number, newStatus: ProductStatus, updatedUnits: any[] }> = {};
                const stockMovementItems: any[] = [];

                // Agrupar scans por lote para processamento
                const scansByBatch: Record<string, string[]> = {};
                scannedItems.forEach(item => {
                    if (!scansByBatch[item.inventoryProductId]) scansByBatch[item.inventoryProductId] = [];
                    scansByBatch[item.inventoryProductId].push(item.serialNumber);
                });

                for (const [batchId, serials] of Object.entries(scansByBatch)) {
                    const batchDoc = batchDocs[batchId];
                    const batchData = batchDoc.data() as InventoryProduct;
                    
                    let currentUnits = batchData.units || [];
                    
                    // Validar cada serial
                    for (const serial of serials) {
                        const unitIndex = currentUnits.findIndex(u => u.id === serial);
                        if (unitIndex === -1) throw new Error(`Unidade ${serial} não encontrada no lote ${batchData.name}.`);
                        
                        if (currentUnits[unitIndex].status !== 'AVAILABLE') {
                            throw new Error(`Unidade ${serial} já não está disponível (Status: ${currentUnits[unitIndex].status}).`);
                        }

                        // Atualizar unidade em memória
                        currentUnits[unitIndex] = {
                            ...currentUnits[unitIndex],
                            status: 'SOLD',
                            soldAt: timestamp,
                            soldToOrder: order.id
                        };
                    }

                    const newSold = (batchData.quantitySold || 0) + serials.length;
                    const newStatus: ProductStatus = newSold >= batchData.quantityBought ? 'SOLD' : 'PARTIAL';

                    updatesByBatch[batchId] = {
                        newSold,
                        newStatus,
                        updatedUnits: currentUnits
                    };
                }

                // 3. Escritas (Writes)
                
                // A. Atualizar Lotes
                for (const [batchId, update] of Object.entries(updatesByBatch)) {
                    const ref = db.collection('products_inventory').doc(batchId);
                    transaction.update(ref, {
                        quantitySold: update.newSold,
                        status: update.newStatus,
                        units: update.updatedUnits
                        // REMOVIDO: salesHistory update (evita duplicação de registos de venda)
                    });
                }

                // B. Criar Stock Movement
                const movementRef = db.collection('stock_movements').doc();
                transaction.set(movementRef, {
                    id: movementRef.id,
                    type: 'SALE',
                    orderId: order.id,
                    items: orderItems.map(item => ({
                        productId: item.productId.toString(),
                        quantity: item.quantity,
                        serialNumbers: scannedItems.filter(s => s.orderItemId === item.uniqueId).map(s => s.serialNumber)
                    })),
                    totalValue: order.total,
                    createdAt: timestamp,
                    createdBy: adminEmail
                });

                // C. Atribuir Pontos (Se for levantamento em loja)
                let pointsWereAwarded = false;
                if (isPickup && userDoc && userDoc.exists && userRef) {
                    const userData = userDoc.data() as User;
                    const tier = userData.tier || 'Bronze';
                    let multiplier = 1;
                    if (tier === 'Prata') multiplier = LOYALTY_TIERS.SILVER.multiplier;
                    if (tier === 'Ouro') multiplier = LOYALTY_TIERS.GOLD.multiplier;

                    const pointsToAward = Math.floor(order.total * multiplier);

                    if (pointsToAward > 0) {
                        const newHistory: PointHistory = {
                            id: `earn-${order.id}`,
                            date: timestamp,
                            amount: pointsToAward,
                            reason: `Compra #${order.id} (Levantamento em Loja)`,
                            orderId: order.id
                        };

                        transaction.update(userRef, {
                            loyaltyPoints: (userData.loyaltyPoints || 0) + pointsToAward,
                            pointsHistory: [newHistory, ...(userData.pointsHistory || [])]
                        });
                        pointsWereAwarded = true;
                    }
                }

                // D. Atualizar Encomenda
                const newStatus = isPickup ? 'Entregue' : 'Enviado';
                const notes = isPickup 
                    ? `Levantado em loja. Processado por ${adminEmail} com validação de serial.`
                    : `Expedido por ${adminEmail} com validação de serial.${trackingNumber ? ` Rastreio: ${trackingNumber}` : ''}`;

                transaction.update(orderRef, {
                    status: newStatus,
                    fulfilledAt: timestamp,
                    fulfilledBy: adminEmail,
                    serialNumbersUsed: scannedItems.map(s => s.serialNumber),
                    fulfillmentStatus: 'COMPLETED',
                    stockDeducted: true,
                    trackingNumber: isPickup ? null : (trackingNumber || null),
                    pointsAwarded: pointsWereAwarded,
                    statusHistory: firebase.firestore.FieldValue.arrayUnion({
                        status: newStatus,
                        date: timestamp,
                        notes: notes
                    })
                });
            });

            onSuccess();
            onClose();

        } catch (err: any) {
            console.error("Erro na transação de expedição:", err);
            setError("Erro crítico ao processar: " + err.message);
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden relative transition-colors">
                
                {/* Scanner Overlay */}
                {isScannerOpen && (
                    <div className="absolute inset-0 z-50 bg-black">
                        <BarcodeScanner 
                            onCodeSubmit={(code) => processCode(code)} 
                            onClose={() => setIsScannerOpen(false)} 
                            mode="serial"
                        />
                    </div>
                )}

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 flex justify-between items-center transition-colors">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Package className="text-indigo-600 dark:text-indigo-400" /> {isPickup ? `Processar Levantamento #${order.id}` : `Preparar Encomenda #${order.id}`}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{isPickup ? 'Digitalize os seriais para confirmar a entrega ao cliente.' : 'Digitalize os números de série para confirmar a expedição.'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Progress Bar */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800 transition-colors">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase">{isPickup ? 'Progresso da Validação' : 'Progresso da Expedição'}</span>
                            <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{progress.totalScanned} / {progress.totalNeeded}</span>
                        </div>
                        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2.5">
                            <div 
                                className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-500" 
                                style={{ width: `${(progress.totalScanned / progress.totalNeeded) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Tracking Number Input - Only show if NOT pickup */}
                    {!isPickup && (
                        <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 transition-colors">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Número de Rastreio (Opcional)</label>
                            <input 
                                type="text" 
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                placeholder="Ex: EA123456789PT"
                                className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-colors"
                            />
                        </div>
                    )}

                    {/* Scanner Input & Actions */}
                    <div className="flex gap-2">
                        <form onSubmit={handleScanSubmit} className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <ScanLine className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                autoFocus
                                value={currentInput}
                                onChange={(e) => setCurrentInput(e.target.value)}
                                placeholder="Clique aqui e leia o código de barras / serial..."
                                className="w-full pl-10 pr-4 py-3 border-2 border-indigo-100 dark:border-indigo-800 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none font-mono shadow-sm transition-all bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            />
                        </form>
                        <button 
                            onClick={() => setIsScannerOpen(true)}
                            className="bg-indigo-600 text-white px-4 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 font-bold shadow-md"
                            title="Abrir Câmara"
                        >
                            <Camera size={20} /> <span className="hidden md:inline">Ler com Câmara</span>
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-800 p-4 rounded-r flex items-start gap-3 animate-shake transition-colors">
                            <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" />
                            <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Items List */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wider border-b border-gray-200 dark:border-slate-700 pb-2">Itens da Encomenda</h3>
                        {orderItems.map((item) => {
                            const scannedCount = scannedItems.filter(s => s.orderItemId === item.uniqueId).length;
                            const isComplete = scannedCount >= item.needed;
                            const availableUnits = getAvailableUnitsForOrderItem(item.uniqueId);

                            return (
                                <div key={item.uniqueId} className={`p-4 rounded-xl border transition-all ${isComplete ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                                            {item.selectedVariant && <p className="text-sm text-gray-500 dark:text-gray-400">Variante: {item.selectedVariant}</p>}
                                            <p className="text-xs text-gray-400 mt-1">ID: {item.productId}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            <span className={`text-xl font-bold ${isComplete ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {scannedCount} / {item.needed}
                                            </span>
                                            {!isComplete && (
                                                <button 
                                                    onClick={() => setShowManualSelection(showManualSelection === item.uniqueId ? null : item.uniqueId)}
                                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 transition-colors"
                                                >
                                                    <MousePointerClick size={12} /> Selecionar Manualmente
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Manual Selection Dropdown */}
                                    {showManualSelection === item.uniqueId && !isComplete && (
                                        <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-fade-in transition-colors">
                                            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2 uppercase">Unidades Disponíveis:</p>
                                            {availableUnits.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {availableUnits.map((unit, idx) => (
                                                        <button 
                                                            key={idx}
                                                            onClick={() => handleManualSelect(unit.serial)}
                                                            className="text-left bg-white dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 p-2 rounded border border-indigo-100 dark:border-indigo-800 text-xs transition-colors flex justify-between items-center group"
                                                        >
                                                            <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{unit.serial}</span>
                                                            <span className="text-[10px] text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400">{unit.batchName}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-red-500 dark:text-red-400 italic">Nenhuma unidade disponível encontrada no inventário para este produto.</p>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Scanned Serials for this item */}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {scannedItems.filter(s => s.orderItemId === item.uniqueId).map((scan, idx) => (
                                            <span key={idx} className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-xs font-mono px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-colors">
                                                <CheckCircle size={10} className="text-green-500" />
                                                {scan.serialNumber}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 flex justify-end gap-3 transition-colors">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                        disabled={isProcessing}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirmFulfillment}
                        disabled={!progress.isComplete || isProcessing}
                        className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all ${
                            progress.isComplete 
                                ? 'bg-green-600 hover:bg-green-700 hover:scale-105' 
                                : 'bg-gray-400 dark:bg-slate-600 cursor-not-allowed'
                        }`}
                    >
                        {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                        Confirmar Expedição
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderFulfillmentModal;

