
import React, { useState } from 'react';
import { FileText, X, Truck, Scale, CheckCircle, Copy, AlertTriangle, Loader2, XCircle, Coins, QrCode } from 'lucide-react';
import { Order, InventoryProduct, OrderItem, User as UserType, PointHistory } from '../types';
import { db, firebase } from '../services/firebaseConfig';
import { LOYALTY_TIERS } from '../constants';

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

    const handleRevokePoints = async () => { if (!window.confirm("Tem a certeza que quer anular os pontos desta encomenda? Isto irá permitir que sejam re-atribuídos.")) return; setIsUpdatingPoints(true); try { await db.collection('orders').doc(order.id).update({ pointsAwarded: false }); onUpdateOrder(order.id, { pointsAwarded: false }); alert("Selo de pontos removido! Agora pode alterar o estado para 'Entregue' para re-atribuir os pontos corretamente."); } catch (error) { console.error("Erro ao anular pontos:", error); alert("Ocorreu um erro. Tente novamente."); } finally { setIsUpdatingPoints(false); } };
    const handleManualPointsAward = async () => { if (manualPoints <= 0) { alert("Insira um valor de pontos válido."); return; } if (!window.confirm(`Atribuir ${manualPoints} pontos ao cliente desta encomenda (${order.id})?`)) return; setIsUpdatingPoints(true); try { let userRef: firebase.firestore.DocumentReference | null = null; if (order.userId) { const potentialUserRef = db.collection('users').doc(order.userId); const userDoc = await potentialUserRef.get(); if (userDoc.exists) { userRef = potentialUserRef; } } if (!userRef && order.shippingInfo.email) { const userQuery = await db.collection('users').where('email', '==', order.shippingInfo.email.trim().toLowerCase()).limit(1).get(); if (!userQuery.empty) { userRef = userQuery.docs[0].ref; } } if (!userRef) { throw new Error("Utilizador não encontrado (nem por ID, nem por email). Verifique se o cliente tem conta criada."); } const orderRef = db.collection('orders').doc(order.id); await db.runTransaction(async (transaction) => { const userDoc = await transaction.get(userRef!); if (!userDoc.exists) throw new Error("Utilizador não encontrado na base de dados."); const userData = userDoc.data() as UserType; const newPointsTotal = (userData.loyaltyPoints || 0) + manualPoints; const newHistoryEntry: PointHistory = { id: `manual-${order.id}-${Date.now()}`, date: new Date().toISOString(), amount: manualPoints, reason: `Ajuste manual (Encomenda ${order.id})`, orderId: order.id }; const newHistory = [newHistoryEntry, ...(userData.pointsHistory || [])]; transaction.update(userRef!, { loyaltyPoints: newPointsTotal, pointsHistory: newHistory }); transaction.update(orderRef, { pointsAwarded: true }); }); onUpdateOrder(order.id, { pointsAwarded: true }); alert("Pontos atribuídos com sucesso!"); } catch (error: any) { console.error("Erro ao atribuir pontos manualmente:", error); alert(`Ocorreu um erro ao atribuir os pontos: ${error.message}`); } finally { setIsUpdatingPoints(false); } };
    
    // Cálculo do peso total
    const totalWeight = getSafeItems(order.items).reduce((acc, item) => {
        if (typeof item === 'string') return acc;
        const itemObj = item as OrderItem;
        const product = inventoryProducts.find(p => p.publicProductId === itemObj.productId);
        const itemWeight = product?.weight || 0;
        return acc + (itemWeight * itemObj.quantity);
    }, 0);

    const handleCopyAddress = () => {
        const text = `${order.shippingInfo.name}\n${order.shippingInfo.street}, ${order.shippingInfo.doorNumber}\n${order.shippingInfo.zip} ${order.shippingInfo.city}\n${order.shippingInfo.phone}`;
        navigator.clipboard.writeText(text);
        setCopySuccess('address');
        setTimeout(() => setCopySuccess(''), 2000);
    };

    return (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"><div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10"><h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><FileText size={20} className="text-indigo-600"/> Detalhes da Encomenda</h3><button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button></div><div className="flex-1 overflow-y-auto p-6 space-y-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center"><div><p className="text-xs text-gray-500 font-bold uppercase">ID Encomenda</p><p className="font-bold text-indigo-700 text-sm mt-1">{order.id}</p></div><div><p className="text-xs text-gray-500 font-bold uppercase">Estado</p><p className="font-bold text-sm mt-1">{order.status}</p></div><div><p className="text-xs text-gray-500 font-bold uppercase">Data</p><p className="font-bold text-sm mt-1">{new Date(order.date).toLocaleDateString()}</p></div><div><p className="text-xs text-gray-500 font-bold uppercase">Total</p><p className="font-bold text-sm mt-1">{formatCurrency(order.total)}</p></div></div>
    
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-bold text-blue-900 text-sm mb-3 flex items-center gap-2"><Truck size={16} /> Logística & Envio</h4>
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <div className="bg-white p-2 rounded-lg border border-blue-100 text-blue-600">
                    <Scale size={20} />
                </div>
                <div>
                    <p className="text-xs text-blue-600 font-bold uppercase">Peso Total Estimado</p>
                    <p className="font-bold text-lg text-gray-900">{totalWeight.toFixed(3)} kg</p>
                </div>
            </div>
            <div className="text-right">
                <button 
                    onClick={handleCopyAddress} 
                    className="bg-white hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 shadow-sm flex items-center gap-1 transition-colors"
                >
                    {copySuccess === 'address' ? <CheckCircle size={14}/> : <Copy size={14}/>} 
                    {copySuccess === 'address' ? 'Copiado!' : 'Copiar Morada CTT'}
                </button>
            </div>
        </div>
        <button disabled className="w-full bg-gray-200 text-gray-500 font-bold py-2 rounded-lg text-sm cursor-not-allowed flex items-center justify-center gap-2">
            <Truck size={16} /> Gerar Etiqueta Automática (Brevemente)
        </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2"><div className="space-y-1"><h4 className="font-bold text-gray-800 text-sm mb-2">Cliente</h4><p className="text-sm">{order.shippingInfo.name}</p><p className="text-sm">{order.shippingInfo.email}</p><p className="text-sm">{order.shippingInfo.phone}</p><p className="text-sm">{order.shippingInfo.nif && `NIF: ${order.shippingInfo.nif}`}</p></div><div className="space-y-1"><h4 className="font-bold text-gray-800 text-sm mb-2">Morada de Envio</h4><p className="text-sm">{order.shippingInfo.street}, {order.shippingInfo.doorNumber}</p><p className="text-sm">{order.shippingInfo.zip} {order.shippingInfo.city}</p></div></div><div className="pt-6 border-t"><h4 className="font-bold text-gray-800 text-sm mb-3">Artigos</h4><div className="space-y-3">{getSafeItems(order.items).map((item, idx) => { const isObject = typeof item === 'object' && item !== null; const itemName = isObject ? (item as OrderItem).name : item as string; const itemQty = isObject ? (item as OrderItem).quantity : 1; const itemPrice = isObject ? (item as OrderItem).price : 0; const itemVariant = isObject && (item as OrderItem).selectedVariant ? `(${(item as OrderItem).selectedVariant})` : ''; const itemSerials = isObject && (item as OrderItem).serialNumbers; return (<div key={idx} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><span className="bg-gray-200 text-gray-700 font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full">{itemQty}x</span><div><p className="font-medium text-gray-800">{itemName} {itemVariant}</p>{itemSerials && itemSerials.length > 0 && (<div className="text-[10px] text-green-700 font-mono mt-1 flex items-center gap-1"><QrCode size={12}/> {itemSerials.join(', ')}</div>)}</div></div><span className="font-bold text-gray-900">{formatCurrency(itemPrice * itemQty)}</span></div>); })}</div></div><div className="pt-6 border-t"><h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2"><Truck size={16}/> Rastreio CTT</h4><div className="flex gap-2"><input type="text" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Ex: EA123456789PT" className="flex-1 p-2 border border-gray-300 rounded-lg" /><button onClick={() => onUpdateTracking(order.id, tracking)} className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-700">Guardar</button></div></div><div className="border-t pt-4"><h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Coins size={16} className="text-yellow-500"/> Gestão de Pontos de Lealdade</h4><div className="bg-gray-50 p-4 rounded-lg border space-y-4"><p className="text-sm">Estado: {order.pointsAwarded ? <span className="font-bold text-green-600 flex items-center gap-1"><CheckCircle size={14}/> Pontos Atribuídos</span> : <span className="font-bold text-orange-600 flex items-center gap-1"><AlertTriangle size={14}/> Pontos Pendentes</span>}</p>{order.pointsAwarded && (<button onClick={handleRevokePoints} disabled={isUpdatingPoints} className="bg-red-100 text-red-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center gap-2">{isUpdatingPoints ? <Loader2 className="animate-spin" /> : <><XCircle size={14}/>Anular Pontos Atribuídos</>}</button>)}<div className="space-y-2 pt-4 border-t"><label className="text-sm font-bold text-gray-600 block">Atribuição Manual</label><div className="flex gap-2"><input type="number" value={manualPoints === 0 ? '' : manualPoints} onChange={(e) => setManualPoints(Number(e.target.value))} className="w-32 p-2 border rounded-lg" placeholder="Ex: 45" /><button onClick={handleManualPointsAward} disabled={isUpdatingPoints} className="bg-blue-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50">{isUpdatingPoints ? <Loader2 className="animate-spin" /> : 'Atribuir'}</button></div><p className="text-xs text-gray-500">Use para corrigir ou dar pontos extra. Isto irá marcar a encomenda como "pontos atribuídos".</p></div></div></div></div></div></div>);
};

export default OrderDetailsModal;
