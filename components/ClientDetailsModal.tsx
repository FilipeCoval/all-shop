import React, { useState, useMemo } from 'react';
import { X, User as UserIcon, ShoppingCart, TicketPercent, Combine, RefreshCw, AlertTriangle, Loader2, Coins, Search, CheckCircle, TrendingUp, Star } from 'lucide-react';
import { User, Order, PointHistory } from '../types';
import { db, firebase } from '../services/firebaseConfig';
import { LOYALTY_TIERS } from '../constants';

interface ClientDetailsModalProps {
    user: User;
    orders: Order[];
    onClose: () => void;
    onUpdateUser: (userId: string, data: Partial<User>) => void;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({ user, orders, onClose, onUpdateUser }) => {
    const [isRecalculatingClient, setIsRecalculatingClient] = useState(false);
    
    // Merge States
    const [mergeSearchEmail, setMergeSearchEmail] = useState('');
    const [foundDuplicate, setFoundDuplicate] = useState<User | null>(null);
    const [duplicateOrdersTotal, setDuplicateOrdersTotal] = useState(0);
    const [duplicateOrdersCount, setDuplicateOrdersCount] = useState(0);
    const [isMerging, setIsMerging] = useState(false);

    // Manual Points
    const [manualPointAmount, setManualPointAmount] = useState('');
    const [manualPointReason, setManualPointReason] = useState('');
    const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);

    // Derived Data
    const clientOrders = useMemo(() => orders.filter(o => o.userId === user.uid || o.shippingInfo.email === user.email), [orders, user]);
    const calculatedTotalSpent = useMemo(() => clientOrders.filter(o => o.status !== 'Cancelado' && o.status !== 'Devolvido').reduce((acc, o) => acc + o.total, 0), [clientOrders]);
    const averageOrderValue = useMemo(() => clientOrders.length > 0 ? calculatedTotalSpent / clientOrders.length : 0, [calculatedTotalSpent, clientOrders]);

    // Favorite Products (Top 3)
    const favoriteProducts = useMemo(() => {
        const productCounts: Record<string, { name: string, count: number, image?: string }> = {};
        clientOrders.forEach(order => {
            order.items.forEach(item => {
                if (typeof item === 'string') return;
                const key = item.productId.toString();
                if (!productCounts[key]) {
                    productCounts[key] = { name: item.name, count: 0, image: item.image };
                }
                productCounts[key].count += item.quantity;
            });
        });
        return Object.values(productCounts).sort((a, b) => b.count - a.count).slice(0, 3);
    }, [clientOrders]);

    // 1. Recalculate Logic
    const handleRecalculateClientData = async () => {
        if (!window.confirm("Isto irá recalcular o total gasto e o nível de lealdade com base no histórico de encomendas. Continuar?")) return;
        setIsRecalculatingClient(true);
        try {
            let newTier = 'Bronze';
            if (calculatedTotalSpent >= LOYALTY_TIERS.GOLD.threshold) newTier = 'Ouro';
            else if (calculatedTotalSpent >= LOYALTY_TIERS.SILVER.threshold) newTier = 'Prata';

            await db.collection('users').doc(user.uid).update({
                totalSpent: calculatedTotalSpent,
                tier: newTier as any
            });

            onUpdateUser(user.uid, { totalSpent: calculatedTotalSpent, tier: newTier as any });
            alert(`Dados atualizados!\nTotal Gasto: ${formatCurrency(calculatedTotalSpent)}\nNovo Nível: ${newTier}`);
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar dados.");
        } finally {
            setIsRecalculatingClient(false);
        }
    };

    // 2. Merge Logic
    const handleSearchDuplicate = async () => {
        if (!mergeSearchEmail) return;
        try {
            const snap = await db.collection('users').where('email', '==', mergeSearchEmail).get();
            if (snap.empty) {
                alert("Nenhum utilizador encontrado com esse email.");
                setFoundDuplicate(null);
                return;
            }
            const duplicateUser = snap.docs[0].data() as User;
            if (duplicateUser.uid === user.uid) {
                alert("Não pode fundir o utilizador com ele próprio.");
                setFoundDuplicate(null);
                return;
            }

            const dupOrders = orders.filter(o => o.userId === duplicateUser.uid);
            setDuplicateOrdersCount(dupOrders.length);
            setDuplicateOrdersTotal(dupOrders.reduce((acc, o) => acc + o.total, 0));
            setFoundDuplicate(duplicateUser);
        } catch (error) {
            console.error(error);
            alert("Erro ao procurar utilizador.");
        }
    };

    const handleConfirmMerge = async () => {
        if (!foundDuplicate) return;
        if (!window.confirm(`ATENÇÃO: Esta ação é irreversível!\n\nVai transferir ${duplicateOrdersCount} encomendas e ${foundDuplicate.loyaltyPoints || 0} pontos de "${foundDuplicate.name}" para "${user.name}".\n\nA conta antiga (${foundDuplicate.email}) será APAGADA.\n\nDeseja continuar?`)) return;

        setIsMerging(true);
        try {
            const batch = db.batch();

            // 1. Transferir Encomendas
            const dupOrders = orders.filter(o => o.userId === foundDuplicate.uid);
            dupOrders.forEach(order => {
                const orderRef = db.collection('orders').doc(order.id);
                batch.update(orderRef, { userId: user.uid });
            });

            // 2. Somar Pontos e Histórico
            const newPoints = (user.loyaltyPoints || 0) + (foundDuplicate.loyaltyPoints || 0);
            const combinedHistory = [...(user.pointsHistory || []), ...(foundDuplicate.pointsHistory || [])];
            
            const userRef = db.collection('users').doc(user.uid);
            batch.update(userRef, {
                loyaltyPoints: newPoints,
                pointsHistory: combinedHistory,
                // Opcional: fundir outros dados se necessário
            });

            // 3. Apagar conta antiga (Soft delete ou hard delete? Aqui faremos hard delete do documento user, mas auth permanece se não usarmos Admin SDK)
            // Nota: Só conseguimos apagar o documento do Firestore. O Auth user precisa ser apagado via Admin SDK ou manualmente.
            const dupRef = db.collection('users').doc(foundDuplicate.uid);
            batch.delete(dupRef);

            await batch.commit();
            
            alert("Fusão concluída com sucesso!");
            setFoundDuplicate(null);
            setMergeSearchEmail('');
            onClose(); // Fechar para atualizar tudo
        } catch (error) {
            console.error(error);
            alert("Erro ao fundir contas: " + error);
        } finally {
            setIsMerging(false);
        }
    };

    // 3. Manual Points Logic
    const handleManualPointAdjustment = async () => {
        const amount = parseInt(manualPointAmount);
        if (isNaN(amount) || amount === 0) return alert("Insira um valor válido.");
        if (!manualPointReason) return alert("Insira um motivo.");

        setIsAdjustingPoints(true);
        try {
            const newPoints = (user.loyaltyPoints || 0) + amount;
            const newHistory: PointHistory = {
                id: `manual-${Date.now()}`,
                date: new Date().toISOString(),
                amount: amount,
                reason: manualPointReason + " (Ajuste Manual)"
            };

            await db.collection('users').doc(user.uid).update({
                loyaltyPoints: newPoints,
                pointsHistory: firebase.firestore.FieldValue.arrayUnion(newHistory)
            });

            onUpdateUser(user.uid, { 
                loyaltyPoints: newPoints, 
                pointsHistory: [...(user.pointsHistory || []), newHistory] 
            });
            
            setManualPointAmount('');
            setManualPointReason('');
            alert("Pontos atualizados com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar pontos.");
        } finally {
            setIsAdjustingPoints(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transition-colors">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2"><UserIcon size={20} className="text-indigo-600 dark:text-indigo-400"/> Detalhes do Cliente</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-slate-900 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-primary dark:text-blue-400 rounded-full flex items-center justify-center text-2xl font-bold transition-colors">{user.name.charAt(0)}</div>
                        <div>
                            <h4 className="font-bold text-xl text-gray-900 dark:text-white">{user.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Push Tokens: {user.deviceTokens?.length || (user.fcmToken ? 1 : 0)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Total Gasto</p><p className="font-bold text-sm mt-1 text-gray-900 dark:text-white">{formatCurrency(calculatedTotalSpent)}</p></div>
                        <div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Média / Pedido</p><p className="font-bold text-sm mt-1 text-gray-900 dark:text-white">{formatCurrency(averageOrderValue)}</p></div>
                        <div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Nível</p><p className="font-bold text-sm mt-1 text-gray-900 dark:text-white">{user.tier || 'Bronze'}</p></div>
                        <div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">AllPoints</p><p className="font-bold text-blue-600 dark:text-blue-400 text-sm mt-1">{user.loyaltyPoints || 0}</p></div>
                    </div>

                    {/* Favorite Products */}
                    {favoriteProducts.length > 0 && (
                        <div className="pt-6 border-t border-gray-100 dark:border-slate-800 transition-colors">
                            <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Star size={16} className="text-yellow-500"/> Produtos Favoritos</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {favoriteProducts.map((prod, idx) => (
                                    <div key={idx} className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-slate-700 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-md flex items-center justify-center font-bold text-xs text-gray-500 border border-gray-200 dark:border-slate-600 overflow-hidden shrink-0">
                                            {prod.image ? <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" /> : `#${idx + 1}`}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-xs text-gray-900 dark:text-white truncate">{prod.name}</p>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{prod.count} unidades compradas</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
      
                    {/* Histórico de Encomendas */}
                    <div className="pt-6 border-t border-gray-100 dark:border-slate-800 transition-colors">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><ShoppingCart size={16} className="text-blue-500 dark:text-blue-400"/> Histórico de Encomendas ({clientOrders.length})</h4>
                        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden max-h-60 overflow-y-auto transition-colors">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 font-semibold uppercase sticky top-0 transition-colors">
                                    <tr>
                                        <th className="p-3">Data</th>
                                        <th className="p-3">ID</th>
                                        <th className="p-3">Estado</th>
                                        <th className="p-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700 transition-colors">
                                    {clientOrders.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(order => (
                                        <tr key={order.id} className="hover:bg-white dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="p-3 text-gray-700 dark:text-gray-300">{new Date(order.date).toLocaleDateString()}</td>
                                            <td className="p-3 font-mono text-gray-500 dark:text-gray-400">#{order.id.slice(-6)}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                    order.status === 'Entregue' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                    order.status === 'Cancelado' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(order.total)}</td>
                                        </tr>
                                    ))}
                                    {clientOrders.length === 0 && (
                                        <tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">Sem encomendas registadas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Histórico de Pontos */}
                    <div className="pt-6 border-t border-gray-100 dark:border-slate-800 transition-colors">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><TicketPercent size={16} className="text-purple-500 dark:text-purple-400"/> Histórico de Pontos</h4>
                        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden max-h-60 overflow-y-auto transition-colors">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 font-semibold uppercase sticky top-0 transition-colors">
                                    <tr>
                                        <th className="p-3">Data</th>
                                        <th className="p-3">Motivo</th>
                                        <th className="p-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700 transition-colors">
                                    {(user.pointsHistory || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((history, idx) => (
                                        <tr key={history.id || idx} className="hover:bg-white dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="p-3 text-gray-700 dark:text-gray-300">{new Date(history.date).toLocaleDateString()}</td>
                                            <td className="p-3 text-gray-700 dark:text-gray-300">{history.reason}</td>
                                            <td className={`p-3 text-right font-bold ${history.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {history.amount > 0 ? '+' : ''}{history.amount}
                                            </td>
                                        </tr>
                                    ))}
                                     {(!user.pointsHistory || user.pointsHistory.length === 0) && (
                                        <tr><td colSpan={3} className="p-4 text-center text-gray-400 italic">Sem histórico de pontos.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-dashed border-gray-200 dark:border-slate-700 transition-colors">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Combine size={16} className="text-orange-500 dark:text-orange-400"/> Ferramentas de Gestão</h4>
                        
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800/30 space-y-4 transition-colors">
                            <p className="text-sm font-bold text-orange-900 dark:text-orange-300">1. Recalcular Dados de Lealdade</p>
                            <p className="text-xs text-orange-800 dark:text-orange-400 -mt-2">Use esta função para corrigir o "Total Gasto", nível e pontos, com base em todas as encomendas associadas a este cliente.</p>
                            <button onClick={handleRecalculateClientData} disabled={isRecalculatingClient} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">{isRecalculatingClient ? <Loader2 className="animate-spin" /> : <><RefreshCw size={14}/> Sincronizar Agora</>}</button>
                        </div>

                        <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 space-y-4 mt-4 transition-colors">
                            <p className="text-sm font-bold text-gray-800 dark:text-white">2. Fundir Contas Duplicadas</p>
                            <div className="flex gap-2">
                                <input type="email" value={mergeSearchEmail} onChange={(e) => setMergeSearchEmail(e.target.value)} className="flex-1 p-2 border border-gray-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="Email da conta a fundir" />
                                <button onClick={handleSearchDuplicate} className="bg-gray-700 dark:bg-slate-600 text-white px-4 rounded font-bold text-sm hover:bg-gray-800 dark:hover:bg-slate-500 transition-colors">Procurar</button>
                            </div>
                            {foundDuplicate && (
                                <div className="bg-white dark:bg-slate-900 p-4 rounded border border-orange-300 dark:border-orange-700 animate-fade-in space-y-2 transition-colors">
                                    <h5 className="font-bold text-sm text-gray-900 dark:text-white">Conta duplicada encontrada:</h5>
                                    <p className="text-xs text-gray-700 dark:text-gray-300"><strong>Nome:</strong> {foundDuplicate.name}</p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300"><strong>UID:</strong> {foundDuplicate.uid}</p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300"><strong>Pontos a transferir:</strong> {foundDuplicate.loyaltyPoints || 0}</p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300"><strong>Total gasto a somar:</strong> {formatCurrency(duplicateOrdersTotal || 0)}</p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300"><strong>Encomendas a reatribuir:</strong> {duplicateOrdersCount}</p>
                                    <button onClick={handleConfirmMerge} disabled={isMerging} className="w-full mt-2 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">{isMerging ? <Loader2 className="animate-spin" /> : <><AlertTriangle size={14}/> Confirmar Fusão</>}</button>
                                </div>
                            )}
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/30 space-y-4 mt-4 transition-colors">
                            <p className="text-sm font-bold text-blue-900 dark:text-blue-300">3. Atribuição Manual de Pontos</p>
                            <p className="text-xs text-blue-800 dark:text-blue-400 -mt-2">Adicione ou remova pontos manualmente (ex: compensação por atraso).</p>
                            <div className="grid grid-cols-2 gap-2">
                                <input 
                                    type="number" 
                                    placeholder="Pontos (+/-)" 
                                    value={manualPointAmount} 
                                    onChange={e => setManualPointAmount(e.target.value)} 
                                    className="p-2 border border-blue-300 dark:border-blue-700 rounded text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                />
                                <input 
                                    type="text" 
                                    placeholder="Motivo (ex: Atraso)" 
                                    value={manualPointReason} 
                                    onChange={e => setManualPointReason(e.target.value)} 
                                    className="p-2 border border-blue-300 dark:border-blue-700 rounded text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                />
                            </div>
                            <button 
                                onClick={handleManualPointAdjustment} 
                                disabled={isAdjustingPoints || !manualPointAmount || !manualPointReason} 
                                className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                            >
                                {isAdjustingPoints ? <Loader2 className="animate-spin" size={14} /> : <><Coins size={14}/> Atualizar Pontos</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientDetailsModal;
