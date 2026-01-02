import React, { useState } from 'react';
import { User, Order, Address, Product, ProductVariant, PointHistory, UserTier, Coupon, OrderItem } from '../types';
import { Package, User as UserIcon, LogOut, MapPin, CreditCard, Save, Plus, Trash2, CheckCircle, Printer, FileText, Heart, ShoppingCart, Truck, XCircle, Award, Gift, ArrowRight, Coins, DollarSign, LayoutDashboard, QrCode } from 'lucide-react';
import { STORE_NAME, LOGO_URL, LOYALTY_TIERS, LOYALTY_REWARDS } from '../constants';
import { db } from '../services/firebaseConfig';

interface ClientAreaProps {
  user: User;
  orders: Order[];
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  publicProducts: Product[];
}

type ActiveTab = 'overview' | 'orders' | 'profile' | 'addresses' | 'wishlist' | 'points';

const CircularProgress: React.FC<{ progress: number; size: number; strokeWidth: number }> = ({ progress, size, strokeWidth }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle
                className="text-gray-200"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
            <circle
                className="text-blue-500 transition-all duration-1000 ease-out"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
        </svg>
    );
};

const ClientArea: React.FC<ClientAreaProps> = ({ user, orders, onLogout, onUpdateUser, wishlist, onToggleWishlist, onAddToCart, publicProducts }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  
  // State for Profile Form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    nif: user?.nif || ''
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // State for Address Form
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<Address>({
    id: '', alias: '', street: '', city: '', zip: ''
  });

  // State for Rewards
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null);

  // --- FUNÇÃO AUXILIAR DE SEGURANÇA (A VACINA ANTI-CRASH) ---
  const getSafeItems = (items: any): any[] => {
      if (!items) return [];
      // Se já for array, devolve o array
      if (Array.isArray(items)) return items;
      // Se for string (encomenda antiga), converte num array com 1 item string
      if (typeof items === 'string') return [items];
      // Se for outra coisa, devolve vazio para não crashar
      return [];
  };

  // Handlers
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
        ...user,
        ...profileForm
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    const addressToAdd = { ...newAddress, id: Date.now().toString() };
    const updatedAddresses = [...(user.addresses || []), addressToAdd];
    onUpdateUser({ ...user, addresses: updatedAddresses });
    setIsAddingAddress(false);
    setNewAddress({ id: '', alias: '', street: '', city: '', zip: '' });
  };

  const handleDeleteAddress = (id: string) => {
    const updatedAddresses = (user.addresses || []).filter(a => a.id !== id);
    onUpdateUser({ ...user, addresses: updatedAddresses });
  };

  const handleCancelOrder = async (orderId: string) => {
      if(!window.confirm("Tem a certeza que deseja cancelar esta encomenda?")) return;
      try {
          await db.collection('orders').doc(orderId).update({ status: 'Cancelado' });
      } catch (e) {
          console.error(e);
          alert("Não foi possível cancelar. Tente novamente ou contacte o suporte.");
      }
  };

  // --- LOYALTY LOGIC ---
  const handleRedeemReward = async (reward: typeof LOYALTY_REWARDS[0]) => {
      const currentPoints = user.loyaltyPoints || 0;
      
      if (currentPoints < reward.cost) {
          alert("Pontos insuficientes.");
          return;
      }

      if (!window.confirm(`Trocar ${reward.cost} pontos por um vale de ${reward.value}€?`)) return;

      setIsRedeeming(reward.id);

      try {
          // 1. Gerar Código Único
          const code = `REWARD-${user.uid?.substring(0,4).toUpperCase()}-${Date.now().toString().substring(7)}`;
          
          const newCoupon: Coupon = {
              code,
              type: 'FIXED',
              value: reward.value,
              minPurchase: reward.minPurchase,
              isActive: true,
              usageCount: 0
          };

          // 2. Registar Cupão
          await db.collection('coupons').add(newCoupon);

          // 3. Atualizar User (Deduzir pontos e adicionar histórico)
          const newHistoryItem: PointHistory = {
              id: Date.now().toString(),
              date: new Date().toISOString(),
              amount: -reward.cost,
              reason: `Resgate: ${reward.title}`
          };

          const updatedPoints = currentPoints - reward.cost;
          const updatedHistory = [newHistoryItem, ...(user.pointsHistory || [])];
          
          await db.collection('users').doc(user.uid).update({
              loyaltyPoints: updatedPoints,
              pointsHistory: updatedHistory
          });

          onUpdateUser({
              ...user,
              loyaltyPoints: updatedPoints,
              pointsHistory: updatedHistory
          });

          alert(`Parabéns! O seu código é: ${code}\n(Pode encontrá-lo no checkout)`);

      } catch (error) {
          console.error(error);
          alert("Erro ao resgatar recompensa. Tente novamente.");
      } finally {
          setIsRedeeming(null);
      }
  };

  // --- DATA FOR DASHBOARD ---
  const currentPoints = user.loyaltyPoints || 0;
  const currentTotalSpent = user.totalSpent || 0;
  const currentTier = user.tier || 'Bronze';
  
  // Tier Progress
  let nextTierLabel = null;
  let tierProgress = 0;
  let tierLimit = 0;

  if (currentTier === 'Bronze') {
      nextTierLabel = 'Prata';
      tierLimit = LOYALTY_TIERS.SILVER.threshold;
      tierProgress = (currentTotalSpent / tierLimit) * 100;
  } else if (currentTier === 'Prata') {
      nextTierLabel = 'Ouro';
      tierLimit = LOYALTY_TIERS.GOLD.threshold;
      tierProgress = (currentTotalSpent / tierLimit) * 100;
  } else {
      tierProgress = 100;
  }

  // Reward Progress
  const sortedRewards = [...LOYALTY_REWARDS].sort((a, b) => a.cost - b.cost);
  const nextReward = sortedRewards.find(r => r.cost > currentPoints);
  const affordableRewards = sortedRewards.filter(r => r.cost <= currentPoints);
  const highestAffordableReward = affordableRewards.length > 0 ? affordableRewards[affordableRewards.length - 1] : null;

  let rewardProgress = 0;
  let rewardGoalText = "Recompensa Máxima!";
  
  if (nextReward) {
      rewardProgress = (currentPoints / nextReward.cost) * 100;
      rewardGoalText = `${currentPoints} / ${nextReward.cost} pts para Vale de ${nextReward.value}€`;
  } else if (highestAffordableReward) {
      rewardProgress = 100;
      rewardGoalText = `Pode resgatar o Vale de ${highestAffordableReward.value}€!`;
  }

  // Stats
  const safeOrders = orders || [];
  const totalSpent = safeOrders.reduce((acc, order) => acc + (order.status !== 'Cancelado' ? (order.total || 0) : 0), 0);
  const totalOrders = safeOrders.filter(o => o.status !== 'Cancelado').length;

  const displayOrderId = (id: string) => {
      if (!id) return '#???';
      if (id.startsWith('#')) return id;
      return `#${id.slice(-6).toUpperCase()}`;
  };

  // Wishlist Products Logic
  const favoriteProducts = publicProducts.filter(p => (wishlist || []).includes(p.id));

  // Função para Gerar o Documento de Garantia/Comprovativo
  const handlePrintOrder = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateFormatted = new Date(order.date).toLocaleDateString('pt-PT', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    const totalFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total || 0);

    // Defensive check using the helper
    const safeItems = getSafeItems(order.items);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <title>Comprovativo #${order.id}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Helvetica', 'Arial', sans-serif; 
            margin: 0; 
            padding: 0; 
            background-color: #f0f0f0; 
            -webkit-print-color-adjust: exact; 
          }
          /* ... (estilos omitidos para brevidade, iguais ao anterior) ... */
          .sheet { width: 210mm; min-height: 297mm; padding: 20mm; margin: 10mm auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 40px; }
          .logo { font-size: 28px; font-weight: bold; color: #2563eb; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { margin: 0; font-size: 24px; text-transform: uppercase; color: #333; letter-spacing: 1px; }
          .invoice-title p { margin: 5px 0 0; color: #666; font-size: 14px; }
          .grid { display: flex; justify-content: space-between; margin-bottom: 50px; }
          .box { width: 45%; }
          .box h3 { font-size: 12px; text-transform: uppercase; color: #999; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 0.5px; }
          .box p { margin: 4px 0; font-size: 14px; line-height: 1.5; color: #333; }
          .box strong { font-weight: 600; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; padding: 12px 10px; border-bottom: 2px solid #eee; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px; }
          td { padding: 16px 10px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; }
          .serial-numbers { font-size: 11px; color: #666; margin-top: 4px; font-family: monospace; background: #f9f9f9; padding: 4px; border-radius: 4px; display: inline-block; }
          .total-row td { border-top: 2px solid #333; border-bottom: none; padding-top: 20px; }
          .total-label { font-weight: bold; font-size: 14px; text-transform: uppercase; }
          .total-amount { font-weight: bold; font-size: 20px; color: #2563eb; }
          .warranty-badge { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 25px; border-radius: 12px; font-size: 13px; margin-top: 50px; line-height: 1.6; }
          .warranty-title { display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #15803d; }
          .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
          @media print { body { background: none; } .sheet { margin: 0; box-shadow: none; width: 100%; min-height: auto; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="logo">
               ${LOGO_URL ? `<img src="${LOGO_URL}" style="height: 60px; object-fit: contain;" />` : STORE_NAME}
            </div>
            <div class="invoice-title">
              <h1>Comprovativo</h1>
              <p>Ref: ${order.id}</p>
              <p>Emitido a: ${dateFormatted}</p>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <h3>Vendedor</h3>
              <p><strong>${STORE_NAME}</strong></p>
              <p>Loja Online Especializada</p>
              <p>Portugal</p>
              <p>suporte@allshop.com</p>
            </div>
            <div class="box">
              <h3>Cliente</h3>
              <p><strong>${user.name}</strong></p>
              <p>${user.email}</p>
              <p>${user.nif ? `NIF: ${user.nif}` : 'Consumidor Final'}</p>
              <p>${user.phone || ''}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="60%">Descrição do Produto</th>
                <th width="20%" style="text-align: right;">Qtd.</th>
                <th width="20%" style="text-align: right;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${safeItems.map(item => {
                 const itemAny = item as any;
                 const itemName = typeof itemAny === 'string' ? itemAny : itemAny.name;
                 const itemQty = typeof itemAny === 'string' ? 1 : itemAny.quantity;
                 const itemVariant = typeof itemAny !== 'string' && itemAny.selectedVariant ? ` (${itemAny.selectedVariant})` : '';
                 const serials = (typeof itemAny !== 'string' && itemAny.serialNumbers && itemAny.serialNumbers.length > 0) 
                    ? `<br/><div class="serial-numbers">S/N: ${itemAny.serialNumbers.join(', ')}</div>` 
                    : '';

                 return `
                  <tr>
                    <td>
                        ${itemName}${itemVariant}
                        ${serials}
                    </td>
                    <td style="text-align: right;">${itemQty}</td>
                    <td style="text-align: right;">Novo</td>
                  </tr>
                 `;
              }).join('')}
              <tr class="total-row">
                <td colspan="2" class="total-label" style="text-align: right;">TOTAL PAGO</td>
                <td class="total-amount" style="text-align: right;">${totalFormatted}</td>
              </tr>
            </tbody>
          </table>

          <div class="warranty-badge">
            <div class="warranty-title">🛡️ CERTIFICADO DE GARANTIA (3 ANOS)</div>
            Este documento serve como comprovativo de compra na ${STORE_NAME}. 
            Todos os equipamentos eletrónicos novos vendidos têm garantia de 3 anos conforme a lei portuguesa (DL n.º 84/2021).
            <br/><br/>
            Para acionar a garantia, basta apresentar este documento e o número do pedido (${order.id}).
            <br/><br/>
            <strong>Nota:</strong> Guarde os números de série apresentados acima (S/N) para identificação única do seu equipamento.
          </div>

          <div class="footer">
            <p>Obrigado pela sua preferência.</p>
            <p>Este documento é um comprovativo interno e de garantia.</p>
          </div>
        </div>
        
        <script>
            window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <aside className="w-full md:w-1/4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="w-24 h-24 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-bold border-4 border-white shadow-sm relative">
              {(user.name || 'C').charAt(0).toUpperCase()}
              
              <div className={`absolute -bottom-2 -right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm text-white text-xs font-bold
                ${currentTier === 'Ouro' ? 'bg-yellow-500' : currentTier === 'Prata' ? 'bg-gray-400' : 'bg-orange-600'}
              `} title={`Nível ${currentTier}`}>
                  {currentTier === 'Ouro' ? 'G' : currentTier === 'Prata' ? 'S' : 'B'}
              </div>
            </div>
            
            <h2 className="font-bold text-xl text-gray-900">{user.name || 'Cliente'}</h2>
            <div className="inline-block px-3 py-1 rounded-full bg-blue-50 text-primary text-xs font-bold mt-1 mb-4">
                {user.loyaltyPoints || 0} AllPoints
            </div>
            
            <button 
              onClick={onLogout}
              className="w-full py-2 px-4 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <LogOut size={16} /> Sair da Conta
            </button>
          </div>

          <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left ${activeTab === 'overview' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}>
              <LayoutDashboard size={20} /> Resumo
            </button>
            <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left ${activeTab === 'orders' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}>
              <Package size={20} /> Encomendas
            </button>
            <button onClick={() => setActiveTab('points')} className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left ${activeTab === 'points' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}>
              <Award size={20} /> Pontos
            </button>
            <button onClick={() => setActiveTab('wishlist')} className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left ${activeTab === 'wishlist' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}>
              <Heart size={20} /> Favoritos
            </button>
            <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left ${activeTab === 'profile' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}>
              <UserIcon size={20} /> Perfil
            </button>
            <button onClick={() => setActiveTab('addresses')} className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left ${activeTab === 'addresses' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}>
              <MapPin size={20} /> Moradas
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          
          {/* --- OVERVIEW TAB --- */}
          {activeTab === 'overview' && (
            <div className="animate-fade-in space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">Olá, {user.name ? user.name.split(' ')[0] : 'Cliente'}! 👋</h2>
                
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><DollarSign size={12}/>Total Gasto</p><p className="text-xl font-bold text-gray-800 mt-1">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalSpent)}</p></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Package size={12}/>Encomendas</p><p className="text-xl font-bold text-gray-800 mt-1">{totalOrders}</p></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Award size={12}/>Nível</p><p className="text-xl font-bold text-gray-800 mt-1">{currentTier}</p></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Coins size={12}/>AllPoints</p><p className="text-xl font-bold text-blue-600 mt-1">{currentPoints}</p></div>
                </div>

                {/* Loyalty & Rewards Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-gray-800 mb-1">Próxima Recompensa</h3>
                            <p className="text-sm text-gray-500 mb-4">Troque os seus AllPoints por vales de desconto!</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <CircularProgress progress={rewardProgress} size={80} strokeWidth={8} />
                                <div className="absolute inset-0 flex items-center justify-center text-blue-600 font-bold text-lg">
                                    <Gift size={24} />
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className={`font-bold ${highestAffordableReward ? 'text-green-600' : 'text-gray-800'}`}>{highestAffordableReward ? `Vale de ${highestAffordableReward.value}€ Disponível!` : nextReward ? `Vale de ${nextReward.value}€` : 'Nível Máximo'}</p>
                                <p className="text-xs text-gray-500">{rewardGoalText}</p>
                            </div>
                        </div>
                        <button onClick={() => setActiveTab('points')} className="mt-4 w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-sm py-2 rounded-lg transition-colors">Ver Recompensas</button>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-1">Próximo Nível: <span className="text-primary">{nextTierLabel || 'Máximo'}</span></h3>
                        <p className="text-sm text-gray-500 mb-4">Clientes Prata e Ouro ganham mais pontos por cada euro gasto.</p>
                        {nextTierLabel ? (
                            <>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${tierProgress}%` }}></div>
                                </div>
                                <p className="text-xs text-gray-500 text-right">Faltam <strong>{(tierLimit - currentTotalSpent).toFixed(2)}€</strong></p>
                            </>
                        ) : (
                            <div className="bg-green-100 text-green-800 text-sm font-bold p-3 rounded-lg text-center">Parabéns! Já atingiu o nível mais alto.</div>
                        )}
                    </div>
                </div>

                {/* Last Order Panel */}
                {orders && orders.length > 0 && (
                     <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4">Última Encomenda</h3>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <p className="font-bold text-primary">{displayOrderId(orders[0].id)}</p>
                                {/* VACINA ANTI-CRASH APLICADA AQUI: getSafeItems */}
                                <p className="text-sm text-gray-500">
                                    {getSafeItems(orders[0].items).map(item => {
                                        const itemAny = item as any;
                                        const name = typeof itemAny === 'string' ? itemAny : itemAny.name;
                                        const qty = typeof itemAny === 'string' ? 1 : itemAny.quantity;
                                        return `${qty}x ${name}`;
                                    }).join(', ')}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-lg">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(orders[0].total || 0)}</span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                    ${orders[0].status === 'Entregue' ? 'bg-green-100 text-green-800' : 
                                    orders[0].status === 'Enviado' ? 'bg-blue-100 text-blue-800' : 
                                    orders[0].status === 'Cancelado' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'}`}>
                                    {orders[0].status}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setActiveTab('orders')} className="mt-4 text-primary font-bold text-sm hover:underline flex items-center gap-1">Ver todas as encomendas <ArrowRight size={14}/></button>
                     </div>
                )}
            </div>
          )}

          {/* --- ORDERS TAB --- */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8 animate-fade-in">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <Package className="text-primary" /> Histórico de Encomendas
                </h3>
                </div>
                
                <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                        <th className="px-6 py-4 font-medium">ID / Data</th>
                        <th className="px-6 py-4 font-medium">Itens</th>
                        <th className="px-6 py-4 font-medium">Estado</th>
                        <th className="px-6 py-4 font-medium">Rastreio</th>
                        <th className="px-6 py-4 font-medium">Total</th>
                        <th className="px-6 py-4 font-medium text-right">Ações</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                    {(orders || []).map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                            <span className="font-bold text-gray-900 block">{displayOrderId(order.id)}</span>
                            <span className="text-xs text-gray-500">{new Date(order.date).toLocaleDateString()}</span>
                        </td>
                        <td className="px-6 py-4 max-w-md">
                           <div className="text-xs text-gray-600 space-y-2">
                               {/* VACINA ANTI-CRASH APLICADA AQUI TAMBÉM */}
                               {getSafeItems(order.items).slice(0, 3).map((item, idx) => {
                                   
                                   // Renderização segura de String vs Objeto
                                   if (typeof item === 'string') {
                                       return (
                                           <div key={idx} className="flex items-center gap-2 border-b border-gray-100 pb-1 last:border-0">
                                               <div className="bg-gray-100 px-1.5 rounded font-bold text-[10px]">1x</div>
                                               <span>{item}</span>
                                           </div>
                                       );
                                   }
                                   
                                   const itemObject = item as OrderItem;
                                   return (
                                       <div key={idx} className="flex flex-col border-b border-gray-100 pb-1 last:border-0">
                                           <div className="flex items-center gap-2">
                                               <div className="bg-indigo-50 text-indigo-700 px-1.5 rounded font-bold text-[10px]">{itemObject.quantity}x</div>
                                               <span className="font-semibold">{itemObject.name}</span>
                                               {itemObject.selectedVariant && <span className="text-gray-400 text-[10px]">({itemObject.selectedVariant})</span>}
                                           </div>
                                           {itemObject.serialNumbers && itemObject.serialNumbers.length > 0 && (
                                               <div className="ml-6 mt-0.5 flex items-center gap-1 text-[10px] text-green-600 bg-green-50 w-fit px-1.5 py-0.5 rounded border border-green-100">
                                                   <QrCode size={10} /> S/N: {itemObject.serialNumbers.join(', ')}
                                               </div>
                                           )}
                                       </div>
                                   );
                               })}
                               {getSafeItems(order.items).length > 3 && <div className="text-gray-400 italic pl-1">+ {getSafeItems(order.items).length - 3} outros itens...</div>}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : 
                                order.status === 'Enviado' ? 'bg-blue-100 text-blue-800' : 
                                order.status === 'Cancelado' ? 'bg-red-100 text-red-800 line-through' :
                                'bg-yellow-100 text-yellow-800'}`}>
                            {order.status}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            {order.trackingNumber ? (
                                <a 
                                    href={`https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${order.trackingNumber}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs font-bold hover:bg-blue-100 transition-colors"
                                >
                                    <Truck size={12} /> Rastrear
                                </a>
                            ) : (
                                <span className="text-gray-400 text-xs">-</span>
                            )}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total || 0)}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                            {order.status !== 'Cancelado' && (
                                <button 
                                    onClick={() => handlePrintOrder(order)}
                                    className="inline-flex items-center gap-1 text-primary hover:text-blue-700 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                                    title="Imprimir Comprovativo e Garantia"
                                >
                                    <Printer size={16} />
                                </button>
                            )}
                            {order.status === 'Processamento' && (
                                <button 
                                    onClick={() => handleCancelOrder(order.id)}
                                    className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 font-medium text-xs bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
                                    title="Cancelar Encomenda"
                                >
                                    <XCircle size={16} />
                                </button>
                            )}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
                
                {(!orders || orders.length === 0) && (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                    <div className="bg-gray-100 p-4 rounded-full mb-4">
                        <Package size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Sem encomendas</h3>
                    <p className="text-gray-500 max-w-sm">
                        Ainda não fez nenhuma compra. Explore a nossa loja e encontre os melhores produtos.
                    </p>
                    <a href="#/" onClick={(e) => { e.preventDefault(); window.location.hash = '/'; }} className="mt-6 text-primary font-medium hover:underline">
                        Ir para a Loja
                    </a>
                </div>
                )}
            </div>
          )}

          {/* ... [RESTO DO CÓDIGO PERMANECE IGUAL] ... */}
          {/* Omitido o resto do componente por brevidade, já que não sofreu alterações funcionais relevantes para esta task, apenas o bloco de tabs 'points', 'wishlist', 'profile', 'addresses' */}
          {activeTab === 'points' && (
              <div className="animate-fade-in space-y-8">
                  {/* ... Conteúdo Points ... */}
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-white relative overflow-hidden">
                      <div className="relative z-10">
                          <div className="flex justify-between items-start mb-6">
                              <div>
                                  <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-1">Nível Atual</p>
                                  <h2 className="text-3xl font-bold flex items-center gap-2">
                                      <Award className={currentTier === 'Ouro' ? 'text-yellow-400' : currentTier === 'Prata' ? 'text-gray-300' : 'text-orange-400'} />
                                      {currentTier}
                                  </h2>
                              </div>
                              <div className="text-right">
                                  <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-1">Saldo Disponível</p>
                                  <h2 className="text-3xl font-bold text-blue-400">{user.loyaltyPoints || 0} pts</h2>
                              </div>
                          </div>

                          {nextTierLabel && (
                              <div>
                                  <div className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                      <span>Progresso para {nextTierLabel}</span>
                                      <span>{currentTotalSpent.toFixed(0)}€ / {tierLimit}€</span>
                                  </div>
                                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                                      <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, tierProgress)}%` }}></div>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-2">
                                      Faltam apenas <strong>{(tierLimit - currentTotalSpent).toFixed(2)}€</strong> para desbloquear <strong>{nextTierLabel === 'Prata' ? '3x' : '5x'} mais pontos</strong> por compra!
                                  </p>
                              </div>
                          )}
                          {!nextTierLabel && <p className="text-yellow-400 font-bold text-sm">👑 Você é um cliente VIP Ouro! Ganha o máximo de pontos possível.</p>}
                      </div>
                      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Gift className="text-primary" /> Recompensas Disponíveis
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {LOYALTY_REWARDS.map(reward => {
                              const canAfford = (user.loyaltyPoints || 0) >= reward.cost;
                              return (
                                  <div key={reward.id} className={`bg-white border rounded-xl p-5 flex flex-col justify-between transition-all ${canAfford ? 'border-gray-200 hover:border-blue-300 hover:shadow-md' : 'border-gray-100 opacity-70 grayscale'}`}>
                                      <div>
                                          <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center text-primary font-bold text-lg mb-3">€</div>
                                          <h4 className="font-bold text-gray-900 text-lg">{reward.title}</h4>
                                          <p className="text-sm text-gray-500 mb-4">Custo: <strong>{reward.cost} pontos</strong></p>
                                          <p className="text-xs text-gray-400 mb-4">Min. compra: {reward.minPurchase}€</p>
                                      </div>
                                      <button 
                                          onClick={() => canAfford && handleRedeemReward(reward)}
                                          disabled={!canAfford || isRedeeming === reward.id}
                                          className={`w-full py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2
                                              ${canAfford 
                                                  ? 'bg-primary hover:bg-blue-600 text-white' 
                                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                              }
                                          `}
                                      >
                                          {isRedeeming === reward.id ? 'A processar...' : canAfford ? 'Resgatar' : `Faltam ${reward.cost - (user.loyaltyPoints || 0)}`}
                                      </button>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                          <h4 className="font-bold text-gray-800 text-sm">Histórico de Pontos</h4>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                          {user.pointsHistory && user.pointsHistory.length > 0 ? (
                              <table className="w-full text-left text-sm">
                                  <tbody className="divide-y divide-gray-100">
                                      {user.pointsHistory.map((item) => (
                                          <tr key={item.id} className="hover:bg-gray-50">
                                              <td className="px-4 py-3 text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                                              <td className="px-4 py-3 font-medium text-gray-900">{item.reason}</td>
                                              <td className={`px-4 py-3 text-right font-bold ${item.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                  {item.amount > 0 ? '+' : ''}{item.amount}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          ) : (
                              <p className="p-6 text-center text-gray-500 text-sm">Sem histórico de movimentos.</p>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'wishlist' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8 animate-fade-in">
                 <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        <Heart className="text-primary" /> Os Meus Favoritos
                    </h3>
                </div>
                
                {favoriteProducts.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-500 mb-4">Ainda não guardou nenhum produto.</p>
                        <button onClick={() => window.location.hash = '/'} className="text-primary font-bold hover:underline">
                            Explorar Loja
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
                        {favoriteProducts.map(product => (
                            <div key={product.id} className="border border-gray-200 rounded-xl p-4 flex gap-4 items-center relative group hover:border-blue-200 transition-colors">
                                <img src={product.image} alt={product.name} className="w-20 h-20 object-cover rounded-lg bg-gray-100" />
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-900 line-clamp-1">{product.name}</h4>
                                    <p className="text-primary font-bold text-lg">
                                        {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}
                                    </p>
                                    <button 
                                        onClick={() => onAddToCart(product)}
                                        className="mt-2 text-xs bg-secondary text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary transition-colors"
                                    >
                                        <ShoppingCart size={12} /> Adicionar
                                    </button>
                                </div>
                                <button 
                                    onClick={() => onToggleWishlist(product.id)}
                                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                    title="Remover"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8 animate-fade-in">
                 <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        <UserIcon className="text-primary" /> Dados Pessoais
                    </h3>
                </div>
                <div className="p-8">
                    <form onSubmit={handleProfileSubmit} className="space-y-6 max-w-2xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                <input 
                                    type="text" 
                                    value={profileForm.name}
                                    onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                <input 
                                    type="email" 
                                    value={profileForm.email}
                                    disabled
                                    className="w-full p-3 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telemóvel</label>
                                <input 
                                    type="tel" 
                                    value={profileForm.phone}
                                    onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                                    placeholder="ex: 912 345 678"
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">NIF (Para Faturação)</label>
                                <input 
                                    type="text" 
                                    value={profileForm.nif}
                                    onChange={e => setProfileForm({...profileForm, nif: e.target.value})}
                                    placeholder="ex: 123456789"
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button type="submit" className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-md">
                                <Save size={18} /> Guardar Alterações
                            </button>
                            {profileSaved && (
                                <span className="text-green-600 font-medium flex items-center gap-2 animate-fade-in">
                                    <CheckCircle size={18} /> Guardado com sucesso!
                                </span>
                            )}
                        </div>
                    </form>
                </div>
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8 animate-fade-in">
                 <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        <MapPin className="text-primary" /> As Minhas Moradas
                    </h3>
                    {!isAddingAddress && (
                        <button 
                            onClick={() => setIsAddingAddress(true)}
                            className="bg-secondary hover:bg-gray-800 text-white text-sm px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                            <Plus size={16} /> Nova Morada
                        </button>
                    )}
                </div>

                <div className="p-8">
                    {isAddingAddress ? (
                        <form onSubmit={handleAddAddress} className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6">
                            <h4 className="font-bold text-gray-900 mb-4">Adicionar Nova Morada</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Local (Alias)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: Casa, Trabalho"
                                        required
                                        value={newAddress.alias}
                                        onChange={e => setNewAddress({...newAddress, alias: e.target.value})}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rua / Avenida</label>
                                    <input 
                                        type="text" 
                                        required
                                        value={newAddress.street}
                                        onChange={e => setNewAddress({...newAddress, street: e.target.value})}
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={newAddress.zip}
                                            onChange={e => setNewAddress({...newAddress, zip: e.target.value})}
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={newAddress.city}
                                            onChange={e => setNewAddress({...newAddress, city: e.target.value})}
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setIsAddingAddress(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-600">Guardar Morada</button>
                            </div>
                        </form>
                    ) : (
                        <>
                            {user.addresses && user.addresses.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {user.addresses.map(addr => (
                                        <div key={addr.id} className="border border-gray-200 rounded-xl p-4 relative group hover:shadow-md transition-shadow">
                                            <div className="flex items-start gap-3">
                                                <div className="bg-blue-50 p-2 rounded-full text-primary">
                                                    <MapPin size={20} />
                                                </div>
                                                <div>
                                                    <h5 className="font-bold text-gray-900">{addr.alias}</h5>
                                                    <p className="text-gray-600 text-sm mt-1">{addr.street}</p>
                                                    <p className="text-gray-500 text-sm">{addr.zip} {addr.city}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteAddress(addr.id)}
                                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                                title="Remover morada"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    <p>Ainda não tem moradas guardadas.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientArea;
