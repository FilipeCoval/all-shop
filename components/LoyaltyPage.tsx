import React, { useState, useEffect } from 'react';
import { User, Coupon, PointHistory } from '../types';
import { db, firebase } from '../services/firebaseConfig';
import { Coins, Gift, Calendar, Star, ArrowRight, Loader2, CheckCircle, AlertTriangle, Lock, Share2, Ticket, Copy } from 'lucide-react';
import { LOYALTY_TIERS, SHARE_URL } from '../constants';

interface AllPointsProps {
  user: User | null;
  onUpdateUser: (user: Partial<User>) => void;
  onOpenLogin: () => void;
  isEmbedded?: boolean;
}

const AllPoints: React.FC<AllPointsProps> = ({ user, onUpdateUser, onOpenLogin, isEmbedded = false }) => {
  const [loading, setLoading] = useState(false);
  const [generatedCoupon, setGeneratedCoupon] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    if (user?.uid) {
        const unsubscribe = db.collection('coupons')
            .where('userId', '==', user.uid)
            .onSnapshot(snapshot => {
                const coupons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
                // Sort in memory: Active first
                coupons.sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1));
                setMyCoupons(coupons);
            }, err => {
                console.error("Erro ao carregar cupões:", err);
            });
        return () => unsubscribe();
    }
  }, [user]);

  // Recompensas Disponíveis
  const REWARDS = [
    { id: 'voucher_5', points: 200, label: 'Voucher 5%', desc: 'Desconto máx. 5€', value: 5, type: 'PERCENTAGE', maxDiscount: 5 },
    { id: 'voucher_7', points: 500, label: 'Voucher 7%', desc: 'Desconto máx. 15€', value: 7, type: 'PERCENTAGE', maxDiscount: 15 },
    { id: 'voucher_10', points: 1000, label: 'Voucher 10%', desc: 'Desconto máx. 30€', value: 10, type: 'PERCENTAGE', maxDiscount: 30 },
    { id: 'free_shipping', points: 400, label: 'Portes Grátis', desc: 'Envio nacional até 2kg', value: 4.99, type: 'FIXED', maxDiscount: 4.99 },
  ];

  const handleRedeem = async (reward: any) => {
    if (!user) return;
    if ((user.loyaltyPoints || 0) < reward.points) return;
    
    setLoading(true);
    setError(null);
    setGeneratedCoupon(null);

    try {
        const code = `ALL-${reward.value}${reward.type === 'PERCENTAGE' ? 'P' : 'E'}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        
        const newCoupon: Coupon = {
            code,
            type: reward.type,
            value: reward.value,
            minPurchase: 0,
            isActive: true,
            usageCount: 0,
            maxUsages: 1,
            userId: user.uid,
            maxDiscount: reward.maxDiscount
        };

        const pointsCost = Number(reward.points);
        if (isNaN(pointsCost) || pointsCost <= 0) {
            throw new Error("Custo de pontos inválido");
        }

        await db.runTransaction(async (transaction) => {
            // 1. Ler dados do utilizador para garantir consistência
            const userRef = db.collection('users').doc(user.uid);
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists) throw new Error("Utilizador não encontrado.");
            
            const userData = userDoc.data() as User;
            const currentPoints = userData.loyaltyPoints || 0;

            if (currentPoints < pointsCost) {
                throw new Error("Pontos insuficientes.");
            }

            // 2. Criar Cupão
            const couponRef = db.collection('coupons').doc();
            transaction.set(couponRef, newCoupon);

            // 3. Deduzir Pontos
            const newHistory: PointHistory = {
                id: `redeem-${Date.now()}`,
                date: new Date().toISOString(),
                amount: -pointsCost,
                reason: `Troca por ${reward.label}`
            };

            transaction.update(userRef, {
                loyaltyPoints: currentPoints - pointsCost,
                pointsHistory: firebase.firestore.FieldValue.arrayUnion(newHistory)
            });
        });

        setGeneratedCoupon(code);

    } catch (err: any) {
        console.error("Erro ao trocar pontos:", err);
        setError(err.message || "Ocorreu um erro ao gerar o seu voucher. Por favor, tente novamente ou contacte o suporte.");
    } finally {
        setLoading(false);
    }
  };

  const nextTier = !user ? LOYALTY_TIERS.SILVER : 
                   user.tier === 'Bronze' ? LOYALTY_TIERS.SILVER : 
                   user.tier === 'Prata' ? LOYALTY_TIERS.GOLD : null;
  
  const progress = !user || !nextTier ? 0 : Math.min(100, ((user.totalSpent || 0) / nextTier.threshold) * 100);

  const handleShare = async () => {
    const shareData = {
      title: 'AllPoints - Clube de Fidelidade',
      text: 'Ganhe pontos em todas as compras e troque por descontos exclusivos!',
      url: `${SHARE_URL}/allpoints`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(shareData.url);
      alert('Link copiado para a área de transferência!');
    }
  };

  return (
    <div className={isEmbedded ? "animate-fade-in" : "container mx-auto px-4 py-12 animate-fade-in"}>
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 text-white shadow-2xl mb-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="relative z-10 max-w-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-500 p-2 rounded-lg text-gray-900">
                            <Coins size={24} />
                        </div>
                        <span className="font-bold tracking-wider text-yellow-500 uppercase text-sm">Clube AllPoints</span>
                    </div>
                    <button onClick={handleShare} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors" title="Partilhar">
                        <Share2 size={20} />
                    </button>
                </div>
                <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
                    Transforme as suas compras em <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">recompensas reais.</span>
                </h1>
                <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                    Ganhe pontos por cada euro gasto, avaliações e muito mais. Troque por descontos exclusivos e portes grátis.
                </p>
                
                {!user ? (
                    <button onClick={onOpenLogin} className="bg-white text-gray-900 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow-lg flex items-center gap-2">
                        Entrar para ver o meu saldo <ArrowRight size={20} />
                    </button>
                ) : (
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 inline-block min-w-[300px]">
                        <p className="text-gray-400 text-sm font-bold uppercase mb-1">O seu saldo atual</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-yellow-400">{user.loyaltyPoints || 0}</span>
                            <span className="text-sm font-bold text-gray-300">pontos</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="flex justify-between text-xs font-bold mb-1">
                                <span className={user.tier === 'Bronze' ? 'text-yellow-500' : 'text-gray-500'}>Bronze</span>
                                <span className={user.tier === 'Prata' ? 'text-gray-200' : 'text-gray-500'}>Prata</span>
                                <span className={user.tier === 'Ouro' ? 'text-yellow-400' : 'text-gray-500'}>Ouro</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                            </div>
                            {nextTier && (
                                <p className="text-xs text-gray-400 mt-2 text-center">
                                    Faltam {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(nextTier.threshold - (user.totalSpent || 0))} para nível {nextTier.label}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Como Ganhar */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Como ganhar pontos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-primary mb-4">
                        <Gift size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Faça Compras</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">Ganhe 1 ponto por cada 1€ gasto. Membros Ouro ganham 1.5x mais!</p>
                </div>
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                        <Star size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Avalie Produtos</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">Ganhe <span className="font-bold text-purple-600">30 pontos</span> por review simples ou <span className="font-bold text-purple-600">80 pontos</span> se incluir foto.</p>
                </div>
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center text-pink-600 mb-4">
                        <Calendar size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Aniversário</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">Receba um presente de <span className="font-bold text-pink-600">100 pontos</span> no dia do seu aniversário.</p>
                </div>
                <div className="bg-white dark:bg-[#0f172a] p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 mb-4">
                        <Share2 size={24} />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Partilhar Produtos</h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm">Ganhe <span className="font-bold text-green-600">5 pontos</span> por cada partilha diária de produtos nas redes sociais.</p>
                </div>
            </div>
        </div>

        {/* Níveis de Fidelidade */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Níveis de Fidelidade</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Bronze */}
                <div className={`p-6 rounded-2xl border-2 transition-all ${user?.tier === 'Bronze' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10 shadow-lg scale-105' : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] opacity-80'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-yellow-600 text-white p-2 rounded-lg font-bold text-xs uppercase">Bronze</div>
                        {user?.tier === 'Bronze' && <span className="text-xs font-bold text-yellow-600 flex items-center gap-1"><CheckCircle size={12}/> Nível Atual</span>}
                    </div>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-2">Iniciante</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">O ponto de partida para todos os membros.</p>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2 text-gray-700 dark:text-slate-300"><CheckCircle size={14} className="text-green-500"/> 1 ponto por cada 1€ gasto</li>
                        <li className="flex items-center gap-2 text-gray-700 dark:text-slate-300"><CheckCircle size={14} className="text-green-500"/> Acesso a recompensas básicas</li>
                    </ul>
                </div>

                {/* Silver */}
                <div className={`p-6 rounded-2xl border-2 transition-all ${user?.tier === 'Prata' ? 'border-gray-400 bg-gray-50 dark:bg-gray-700/30 shadow-lg scale-105' : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] opacity-80'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-gray-400 text-white p-2 rounded-lg font-bold text-xs uppercase">Prata</div>
                        {user?.tier === 'Prata' && <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><CheckCircle size={12}/> Nível Atual</span>}
                    </div>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-2">Membro Prata</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Ao atingir {LOYALTY_TIERS.SILVER.threshold}€ em compras.</p>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2 text-gray-700 dark:text-slate-300"><CheckCircle size={14} className="text-green-500"/> <strong>{LOYALTY_TIERS.SILVER.multiplier}x pontos</strong> por compra</li>
                        <li className="flex items-center gap-2 text-gray-700 dark:text-slate-300"><CheckCircle size={14} className="text-green-500"/> Ofertas exclusivas</li>
                    </ul>
                </div>

                {/* Gold */}
                <div className={`p-6 rounded-2xl border-2 transition-all ${user?.tier === 'Ouro' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 shadow-lg scale-105' : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] opacity-80'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-yellow-400 text-black p-2 rounded-lg font-bold text-xs uppercase">Ouro</div>
                        {user?.tier === 'Ouro' && <span className="text-xs font-bold text-yellow-500 flex items-center gap-1"><CheckCircle size={12}/> Nível Atual</span>}
                    </div>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-2">Membro VIP</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Ao atingir {LOYALTY_TIERS.GOLD.threshold}€ em compras.</p>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2 text-gray-700 dark:text-slate-300"><CheckCircle size={14} className="text-green-500"/> <strong>{LOYALTY_TIERS.GOLD.multiplier}x pontos</strong> por compra</li>
                        <li className="flex items-center gap-2 text-gray-700 dark:text-slate-300"><CheckCircle size={14} className="text-green-500"/> Atendimento prioritário</li>
                        <li className="flex items-center gap-2 text-gray-700 dark:text-slate-300"><CheckCircle size={14} className="text-green-500"/> Acesso antecipado a promoções</li>
                    </ul>
                </div>
            </div>
        </div>

        {/* Meus Vouchers */}
        {myCoupons.length > 0 && (
            <div className="mb-16 animate-fade-in">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center flex items-center justify-center gap-2">
                    <Ticket className="text-indigo-600" /> Os Meus Vouchers
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myCoupons.map(coupon => (
                        <div key={coupon.id} className={`relative p-4 rounded-xl border-2 flex items-center justify-between gap-4 transition-all ${coupon.isActive ? 'bg-white dark:bg-[#0f172a] border-indigo-100 dark:border-indigo-900 shadow-sm hover:border-indigo-300' : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 opacity-60'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${coupon.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                                    <Ticket size={20} />
                                </div>
                                <div>
                                    <p className="font-mono font-bold text-lg tracking-wider text-gray-900 dark:text-white">{coupon.code}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">
                                        {coupon.type === 'PERCENTAGE' ? `${coupon.value}% Desconto` : `€${coupon.value} Desconto`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${coupon.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                    {coupon.isActive ? 'Ativo' : 'Usado'}
                                </span>
                                {coupon.isActive && (
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(coupon.code);
                                            alert("Código copiado!");
                                        }}
                                        className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50 transition-colors"
                                        title="Copiar Código"
                                    >
                                        <Copy size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Loja de Recompensas */}
        <div id="rewards" className="scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Trocar Pontos</h2>
            
            {generatedCoupon && (
                <div className="max-w-md mx-auto mb-12 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-2xl text-center animate-bounce-slow">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 dark:text-green-400">
                        <CheckCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">Voucher Gerado!</h3>
                    <p className="text-green-700 dark:text-green-400 mb-4 text-sm">Copie o código abaixo e use no checkout.</p>
                    
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <div 
                            className="bg-white dark:bg-gray-900 border-2 border-dashed border-green-300 dark:border-green-700 p-3 rounded-xl font-mono text-xl font-bold text-gray-800 dark:text-white tracking-widest select-all cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors" 
                            onClick={() => {
                                navigator.clipboard.writeText(generatedCoupon);
                                alert("Código copiado!");
                            }}
                        >
                            {generatedCoupon}
                        </div>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(generatedCoupon);
                                alert("Código copiado!");
                            }}
                            className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-md"
                            title="Copiar Código"
                        >
                            <Copy size={20} />
                        </button>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-2">Toque no código ou no botão para copiar.</p>
                </div>
            )}

            {error && (
                <div className="max-w-md mx-auto mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-center text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {REWARDS.map((reward) => {
                    const canAfford = user && (user.loyaltyPoints || 0) >= reward.points;
                    return (
                        <div key={reward.id} className={`relative bg-white dark:bg-[#0f172a] rounded-2xl border-2 p-6 flex flex-col transition-all ${canAfford ? 'border-gray-100 dark:border-slate-800 hover:border-yellow-400 hover:shadow-lg' : 'border-gray-100 dark:border-slate-800 opacity-60 grayscale'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-bold px-3 py-1 rounded-full text-xs">
                                    {reward.points} pts
                                </div>
                                {!canAfford && <Lock size={16} className="text-gray-400" />}
                            </div>
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-1">{reward.label}</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">{reward.desc}</p>
                            
                            <button 
                                onClick={() => handleRedeem(reward)}
                                disabled={!canAfford || loading}
                                className={`mt-auto w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                                    ${canAfford 
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:scale-[1.02] shadow-lg' 
                                        : 'bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed'}
                                `}
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Trocar'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};

export default AllPoints;
