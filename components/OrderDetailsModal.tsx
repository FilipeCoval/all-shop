
import React, { useState } from 'react';
import { FileText, X, Truck, Scale, CheckCircle, Copy, AlertTriangle, Loader2, XCircle, Coins, QrCode, Printer, TicketPercent, Package } from 'lucide-react';
import { Order, InventoryProduct, OrderItem, User as UserType, PointHistory } from '../types';
import { db, firebase } from '../services/firebaseConfig';
import { LOYALTY_TIERS, STORE_NAME, STORE_ADDRESS, LOGO_URL } from '../constants';

import OrderPackagingModal from './OrderPackagingModal';

interface OrderDetailsModalProps {
    order: Order | null;
    onClose: () => void;
    onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
    onUpdateTracking: (orderId: string, tracking: string) => void;
    onCopy: (text: string) => void;
    inventoryProducts: InventoryProduct[];
}

const getSafeItems = (items: any): (OrderItem | string)[] => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') return [items];
    return [];
};

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose, onUpdateOrder, onUpdateTracking, onCopy, inventoryProducts }) => {
    if (!order) return null;
    const [tracking, setTracking] = useState(order.trackingNumber || '');
    const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);
    const [manualPoints, setManualPoints] = useState(0);
    const [copySuccess, setCopySuccess] = useState('');
    const [isSavingTracking, setIsSavingTracking] = useState(false);
    const [trackingSaved, setTrackingSaved] = useState(false);
    const [pointsAwardedSuccess, setPointsAwardedSuccess] = useState(false);
    const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);

    const handleSaveTracking = async () => {
        setIsSavingTracking(true);
        await onUpdateTracking(order.id, tracking);
        setIsSavingTracking(false);
        setTrackingSaved(true);
        setTimeout(() => setTrackingSaved(false), 2000);
    };

    const handleRevokePoints = async () => { if (!window.confirm("Tem a certeza que quer anular os pontos desta encomenda? Isto irá permitir que sejam re-atribuídos.")) return; setIsUpdatingPoints(true); try { await db.collection('orders').doc(order.id).update({ pointsAwarded: false }); onUpdateOrder(order.id, { pointsAwarded: false }); alert("Selo de pontos removido! Agora pode alterar o estado para 'Entregue' para re-atribuir os pontos corretamente."); } catch (error) { console.error("Erro ao anular pontos:", error); alert("Ocorreu um erro. Tente novamente."); } finally { setIsUpdatingPoints(false); } };
    const handleManualPointsAward = async () => { 
        if (manualPoints <= 0) { alert("Insira um valor de pontos válido."); return; } 
        if (!window.confirm(`Atribuir ${manualPoints} pontos ao cliente desta encomenda (${order.id})?`)) return; 
        
        setIsUpdatingPoints(true); 
        try { 
            let userRef: firebase.firestore.DocumentReference | null = null; 
            if (order.userId) { 
                const potentialUserRef = db.collection('users').doc(order.userId); 
                const userDoc = await potentialUserRef.get(); 
                if (userDoc.exists) { userRef = potentialUserRef; } 
            } 
            if (!userRef && order.shippingInfo.email) { 
                const userQuery = await db.collection('users').where('email', '==', (order.shippingInfo.email || '').trim().toLowerCase()).limit(1).get(); 
                if (!userQuery.empty) { userRef = userQuery.docs[0].ref; } 
            } 
            if (!userRef) { throw new Error("Utilizador não encontrado (nem por ID, nem por email). Verifique se o cliente tem conta criada."); } 
            
            const orderRef = db.collection('orders').doc(order.id); 
            await db.runTransaction(async (transaction) => { 
                const userDoc = await transaction.get(userRef!); 
                if (!userDoc.exists) throw new Error("Utilizador não encontrado na base de dados."); 
                const userData = userDoc.data() as UserType; 
                const newPointsTotal = (userData.loyaltyPoints || 0) + manualPoints; 
                const newHistoryEntry: PointHistory = { id: `manual-${order.id}-${Date.now()}`, date: new Date().toISOString(), amount: manualPoints, reason: `Ajuste manual (Encomenda ${order.id})`, orderId: order.id }; 
                const newHistory = [newHistoryEntry, ...(userData.pointsHistory || [])]; 
                transaction.update(userRef!, { loyaltyPoints: newPointsTotal, pointsHistory: newHistory }); 
                transaction.update(orderRef, { pointsAwarded: true }); 
            }); 
            
            onUpdateOrder(order.id, { pointsAwarded: true }); 
            setPointsAwardedSuccess(true);
            setManualPoints(0);
            setTimeout(() => setPointsAwardedSuccess(false), 3000);
        } catch (error: any) { 
            console.error("Erro ao atribuir pontos manualmente:", error); 
            alert(`Ocorreu um erro ao atribuir os pontos: ${error.message}`); 
        } finally { 
            setIsUpdatingPoints(false); 
        } 
    };
    
    // Cálculo do peso total
    const totalWeight = getSafeItems(order.items).reduce((acc, item) => {
        if (typeof item === 'string') return acc;
        const itemObj = item as OrderItem;
        const product = inventoryProducts.find(p => p.publicProductId === itemObj.productId);
        const itemWeight = product?.weight || 0;
        return acc + (itemWeight * itemObj.quantity);
    }, 0);

    const handleCopyAddress = () => {
        const extra = order.shippingInfo.addressExtra ? `\n${order.shippingInfo.addressExtra}` : '';
        const text = `${order.shippingInfo.name}\n${order.shippingInfo.street}, ${order.shippingInfo.doorNumber}${extra}\n${order.shippingInfo.zip} ${order.shippingInfo.city}\n${order.shippingInfo.phone}`;
        navigator.clipboard.writeText(text);
        setCopySuccess('address');
        setTimeout(() => setCopySuccess(''), 2000);
    };

    const handlePrintShippingLabel = () => {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const extraAddress = order.shippingInfo.addressExtra ? `<br>${order.shippingInfo.addressExtra}` : '';
        
        const packages = order.packages && order.packages.length > 0 
            ? order.packages 
            : [{ id: 'default', weight: totalWeight }];

        let pagesHtml = '';

        packages.forEach((pkg, index) => {
            const isLastPage = index === packages.length - 1;
            const pageBreak = isLastPage ? '' : 'page-break-after: always;';
            const volumeText = packages.length > 1 ? `<br><span style="font-size: 14px; color: #d97706;">Volume ${index + 1} de ${packages.length}</span>` : '';
            const pkgWeight = pkg.weight || totalWeight;

            pagesHtml += `
                <div class="page" style="${pageBreak}">
                    <div class="header">
                        <div class="sender">
                            <img src="${LOGO_URL}" class="logo" alt="Logo" /><br>
                            <strong>Remetente:</strong><br>
                            ${STORE_NAME}<br>
                            ${STORE_ADDRESS.senderName}<br>
                            ${STORE_ADDRESS.street}<br>
                            ${STORE_ADDRESS.zip} ${STORE_ADDRESS.city}<br>
                            ${STORE_ADDRESS.country}
                        </div>
                        <div class="stamp-area" style="border: 1px solid #000; width: 60px; height: 70px; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center;">
                            CTT<br>Postage
                        </div>
                    </div>

                    <div class="recipient">
                        <strong>${order.shippingInfo.name}</strong>
                        <span style="font-size: 14px; font-weight: bold; margin-bottom: 8px; display: block;">Tel: ${order.shippingInfo.phone}</span>
                        <span class="address-line">${order.shippingInfo.street}, ${order.shippingInfo.doorNumber}</span>
                        ${extraAddress}
                        <span class="zip-city">${order.shippingInfo.zip} ${order.shippingInfo.city}</span>
                    </div>

                    <div class="footer">
                        <div class="tracking-placeholder">
                            ${(pkg as any).trackingNumber || order.trackingNumber ? ((pkg as any).trackingNumber || order.trackingNumber) : 'Colar Etiqueta CTT Aqui'}
                        </div>
                        <div class="order-ref">
                            <strong>Ref: #${order.id}</strong>${volumeText}<br>
                            Peso: ${pkgWeight.toFixed(3)} kg<br>
                            Data: ${new Date().toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `;
        });

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiquetas de Envio - ${order.id}</title>
                <style>
                    @page { size: A6 landscape; margin: 0; }
                    body { 
                        font-family: 'Arial', sans-serif; 
                        margin: 0; 
                        padding: 0;
                        background: #f0f0f0;
                    }
                    .page {
                        width: 148mm; 
                        height: 105mm; 
                        box-sizing: border-box;
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        background: white;
                        border: 1px dashed #ccc;
                        margin: 0 auto 20px auto;
                    }
                    @media print {
                        body { background: white; }
                        .page { border: none; margin: 0; }
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .sender {
                        font-size: 10px;
                        color: #555;
                    }
                    .sender strong {
                        font-size: 12px;
                        color: #000;
                        text-transform: uppercase;
                    }
                    .recipient {
                        font-size: 16px;
                        line-height: 1.4;
                        margin-left: 40px; /* Indent recipient */
                        margin-bottom: 40px; /* Espaço extra garantido antes da linha do rodapé */
                    }
                    .recipient strong {
                        font-size: 22px;
                        text-transform: uppercase;
                        display: block;
                        margin-bottom: 5px;
                    }
                    .recipient .address-line {
                        display: block;
                        font-size: 18px;
                    }
                    .recipient .zip-city {
                        font-size: 20px;
                        font-weight: bold;
                        margin-top: 5px;
                        display: block;
                    }
                    .footer {
                        border-top: 2px solid #000;
                        padding-top: 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        font-size: 10px;
                    }
                    .tracking-placeholder {
                        border: 2px dashed #999;
                        width: 200px;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #999;
                        font-weight: bold;
                        background: #f9f9f9;
                    }
                    .order-ref {
                        text-align: right;
                    }
                    .logo {
                        max-height: 40px;
                        margin-bottom: 5px;
                    }
                </style>
            </head>
            <body>
                ${pagesHtml}
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transition-colors"><div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors"><h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2"><FileText size={20} className="text-indigo-600 dark:text-indigo-400"/> Detalhes da Encomenda</h3><button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors"><X size={24}/></button></div><div className="flex-1 overflow-y-auto p-6 space-y-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center"><div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">ID Encomenda</p><p className="font-bold text-indigo-700 dark:text-indigo-400 text-sm mt-1">{order.id}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Estado</p><p className="font-bold text-sm mt-1 text-gray-900 dark:text-white">{order.status}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Data</p><p className="font-bold text-sm mt-1 text-gray-900 dark:text-white">{new Date(order.date).toLocaleDateString()}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Total</p><p className="font-bold text-sm mt-1 text-gray-900 dark:text-white">{formatCurrency(order.total)}</p></div></div>
    
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 transition-colors">
        <h4 className="font-bold text-blue-900 dark:text-blue-300 text-sm mb-3 flex items-center gap-2"><Truck size={16} /> Logística & Envio</h4>
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                    <Scale size={20} />
                </div>
                <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Peso Total Estimado</p>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">{totalWeight.toFixed(3)} kg</p>
                </div>
            </div>
            <div className="text-right">
                <button 
                    onClick={handleCopyAddress} 
                    className="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800 shadow-sm flex items-center gap-1 transition-colors"
                >
                    {copySuccess === 'address' ? <CheckCircle size={14}/> : <Copy size={14}/>} 
                    {copySuccess === 'address' ? 'Copiado!' : 'Copiar Morada CTT'}
                </button>
            </div>
        </div>
        <div className="flex flex-col gap-2">
            <button 
                onClick={() => setIsPackagingModalOpen(true)}
                className="w-full bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-sm border border-indigo-200 dark:border-indigo-800"
            >
                <Package size={16} /> Embalar / Dividir Volumes {order.packages && order.packages.length > 1 ? `(${order.packages.length} Caixas)` : ''}
            </button>
            <button 
                onClick={handlePrintShippingLabel}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
                <Printer size={16} /> Imprimir Etiqueta de Envio
            </button>
        </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2"><div className="space-y-1"><h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-2">Cliente</h4><p className="text-sm text-gray-600 dark:text-gray-400">{order.shippingInfo.name}</p><p className="text-sm text-gray-600 dark:text-gray-400">{order.shippingInfo.email}</p><p className="text-sm text-gray-600 dark:text-gray-400">{order.shippingInfo.phone}</p><p className="text-sm text-gray-600 dark:text-gray-400">{order.shippingInfo.nif && `NIF: ${order.shippingInfo.nif}`}</p></div><div className="space-y-1"><h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-2">Morada de Envio</h4><p className="text-sm text-gray-600 dark:text-gray-400">{order.shippingInfo.street}, {order.shippingInfo.doorNumber}</p>{order.shippingInfo.addressExtra && <p className="text-sm text-gray-600 dark:text-gray-400">{order.shippingInfo.addressExtra}</p>}<p className="text-sm text-gray-600 dark:text-gray-400">{order.shippingInfo.zip} {order.shippingInfo.city}</p></div></div>    <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-3">Artigos</h4>
        
        {order.packages && order.packages.length > 0 ? (
            <div className="space-y-4">
                {order.packages.map((pkg, pkgIdx) => (
                    <div key={pkg.id} className="bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="bg-gray-100 dark:bg-slate-700/50 p-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                            <h5 className="font-bold text-gray-800 dark:text-gray-200 text-xs uppercase flex items-center gap-2">
                                <Package size={14} /> Volume {pkgIdx + 1}
                            </h5>
                            {pkg.trackingNumber && (
                                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-600">
                                    {pkg.trackingNumber}
                                </span>
                            )}
                        </div>
                        <div className="p-3 space-y-3">
                            {pkg.items.map((item, idx) => {
                                const itemName = item.name || inventoryProducts.find(p => p.publicProductId === item.productId)?.name || `Produto ${item.productId}`;
                                const itemVariant = item.selectedVariant ? `(${item.selectedVariant})` : '';
                                const itemSerials = item.serialNumbers;
                                const itemImage = item.image || inventoryProducts.find(p => p.publicProductId === item.productId)?.images?.[0] || LOGO_URL;
                                
                                return (
                                    <div key={idx} className="flex justify-between items-center text-sm bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <img src={itemImage} alt={itemName} className="w-10 h-10 object-cover rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700" />
                                            <span className="bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full">{item.quantity}x</span>
                                            <div>
                                                <p className="font-medium text-gray-800 dark:text-gray-200">{itemName} {itemVariant}</p>
                                                {itemSerials && itemSerials.length > 0 && (
                                                    <div className="text-[10px] text-green-700 dark:text-green-400 font-mono mt-1 flex items-center gap-1">
                                                        <QrCode size={12}/> {itemSerials.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="space-y-3">
                {getSafeItems(order.items).map((item, idx) => {
                    const isObject = typeof item === 'object' && item !== null;
                    const itemName = isObject ? (item as OrderItem).name : item as string;
                    const itemQty = isObject ? (item as OrderItem).quantity : 1;
                    const itemPrice = isObject ? (item as OrderItem).price : 0;
                    const itemVariant = isObject && (item as OrderItem).selectedVariant ? `(${(item as OrderItem).selectedVariant})` : '';
                    const itemSerials = isObject && (item as OrderItem).serialNumbers;
                    const itemImage = isObject ? ((item as OrderItem).image || inventoryProducts.find(p => p.publicProductId === (item as OrderItem).productId)?.images?.[0] || LOGO_URL) : LOGO_URL;
                    
                    return (
                        <div key={idx} className="flex justify-between items-center text-sm p-3 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors">
                            <div className="flex items-center gap-3">
                                <img src={itemImage} alt={itemName} className="w-10 h-10 object-cover rounded-md bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600" />
                                <span className="bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full">{itemQty}x</span>
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{itemName} {itemVariant}</p>
                                    {itemSerials && itemSerials.length > 0 && (
                                        <div className="text-[10px] text-green-700 dark:text-green-400 font-mono mt-1 flex items-center gap-1">
                                            <QrCode size={12}/> {itemSerials.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(itemPrice * itemQty)}</span>
                        </div>
                    );
                })}
            </div>
        )}

        {order.discountValue && order.discountValue > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800 transition-colors">
                <div className="flex items-center gap-2 font-bold text-sm">
                    <TicketPercent size={16} />
                    <span>Desconto Aplicado {order.couponCode ? `(${order.couponCode})` : ''}</span>
                </div>
                <span className="font-bold text-lg">-{formatCurrency(order.discountValue)}</span>
            </div>
        )}
    </div><div className="pt-6 border-t border-gray-100 dark:border-slate-800"><h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-3 flex items-center gap-2"><Truck size={16}/> Rastreio CTT</h4>
    {order.packages && order.packages.length > 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
            Esta encomenda tem múltiplos volumes. O rastreio é gerido individualmente para cada caixa na secção "Embalar / Dividir Volumes".
        </div>
    ) : (
        <div className="flex gap-2"><input type="text" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Ex: EA123456789PT" className="flex-1 p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" /><button onClick={handleSaveTracking} disabled={isSavingTracking} className={`px-4 rounded-lg font-bold transition-all flex items-center gap-2 ${trackingSaved ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{isSavingTracking ? <Loader2 size={16} className="animate-spin" /> : trackingSaved ? <><CheckCircle size={16} /> Guardado</> : 'Guardar'}</button></div>
    )}
    </div><div className="border-t border-gray-100 dark:border-slate-800 pt-4"><h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2"><Coins size={16} className="text-yellow-500"/> Gestão de Pontos de Lealdade</h4><div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 space-y-4 transition-colors"><p className="text-sm text-gray-600 dark:text-gray-400">Estado: {order.pointsAwarded ? <span className="font-bold text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle size={14}/> Pontos Atribuídos</span> : <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1"><AlertTriangle size={14}/> Pontos Pendentes</span>}</p>{order.pointsAwarded && (<button onClick={handleRevokePoints} disabled={isUpdatingPoints} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-bold px-4 py-2 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 flex items-center gap-2 transition-colors">{isUpdatingPoints ? <Loader2 className="animate-spin" /> : <><XCircle size={14}/>Anular Pontos Atribuídos</>}</button>)}<div className="space-y-2 pt-4 border-t border-gray-200 dark:border-slate-700"><label className="text-sm font-bold text-gray-600 dark:text-gray-400 block">Atribuição Manual</label><div className="flex gap-2"><input type="number" value={manualPoints === 0 ? '' : manualPoints} onChange={(e) => setManualPoints(Number(e.target.value))} className="w-32 p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" placeholder="Ex: 45" /><button onClick={handleManualPointsAward} disabled={isUpdatingPoints} className={`font-bold px-4 py-2 rounded-lg disabled:opacity-50 transition-all flex items-center gap-2 ${pointsAwardedSuccess ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>{isUpdatingPoints ? <Loader2 size={16} className="animate-spin" /> : pointsAwardedSuccess ? <><CheckCircle size={16}/> Atribuído</> : 'Atribuir'}</button></div><p className="text-xs text-gray-500 dark:text-gray-400">Use para corrigir ou dar pontos extra. Isto irá marcar a encomenda como "pontos atribuídos".</p></div></div></div></div></div>
    
    {isPackagingModalOpen && (
        <OrderPackagingModal
            order={order}
            inventoryProducts={inventoryProducts}
            onClose={() => setIsPackagingModalOpen(false)}
            onSuccess={(updatedOrder) => {
                onUpdateOrder(order.id, { packages: updatedOrder.packages, trackingNumber: updatedOrder.trackingNumber });
                setIsPackagingModalOpen(false);
            }}
        />
    )}
    
    </div>);
};

export default OrderDetailsModal;
