
import React, { useState } from 'react';
import { User, Order, Address } from '../types';
import { Package, User as UserIcon, LogOut, MapPin, CreditCard, Save, Plus, Trash2, CheckCircle, Printer, FileText } from 'lucide-react';
import { STORE_NAME, LOGO_URL } from '../constants';

interface ClientAreaProps {
  user: User;
  orders: Order[];
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
}

type ActiveTab = 'orders' | 'profile' | 'addresses';

const ClientArea: React.FC<ClientAreaProps> = ({ user, orders, onLogout, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('orders');
  
  // State for Profile Form
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    nif: user.nif || ''
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // State for Address Form
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<Address>({
    id: '', alias: '', street: '', city: '', zip: ''
  });

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
    const updatedAddresses = user.addresses.filter(a => a.id !== id);
    onUpdateUser({ ...user, addresses: updatedAddresses });
  };

  // Stats
  const totalSpent = orders.reduce((acc, order) => acc + order.total, 0);
  const totalOrders = orders.length;

  const displayOrderId = (id: string) => {
      if (id.startsWith('#')) return id;
      return `#${id.slice(-6).toUpperCase()}`;
  };

  // Função para Gerar o Documento de Garantia/Comprovativo
  const handlePrintOrder = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateFormatted = new Date(order.date).toLocaleDateString('pt-PT', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    const totalFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <title>Comprovativo #${order.id}</title>
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { margin: 0; font-size: 18px; text-transform: uppercase; color: #555; }
          .invoice-title p { margin: 0; color: #888; font-size: 14px; }
          
          .grid { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .box { width: 45%; }
          .box h3 { font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
          .box p { margin: 0; font-size: 14px; }
          
          table { w-full; width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; font-size: 12px; text-transform: uppercase; color: #888; }
          td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 14px; }
          .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #333; border-bottom: none; }
          
          .warranty-badge { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 15px; border-radius: 8px; font-size: 13px; margin-top: 40px; }
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
             ${LOGO_URL ? `<img src="${LOGO_URL}" style="height: 50px;" />` : STORE_NAME}
          </div>
          <div class="invoice-title">
            <h1>Comprovativo de Compra</h1>
            <p>Ref: ${order.id}</p>
            <p>Data: ${dateFormatted}</p>
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
              <th>Descrição do Produto</th>
              <th style="text-align: right;">Quantidade</th>
              <th style="text-align: right;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item}</td>
                <td style="text-align: right;">1</td>
                <td style="text-align: right;">Novo</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2" style="text-align: right;">TOTAL PAGO</td>
              <td style="text-align: right;">${totalFormatted}</td>
            </tr>
          </tbody>
        </table>

        <div class="warranty-badge">
          <strong>🛡️ CERTIFICADO DE GARANTIA (3 ANOS)</strong><br/><br/>
          Este documento serve como comprovativo de compra na ${STORE_NAME}. 
          Todos os equipamentos eletrónicos novos vendidos têm garantia de 3 anos conforme a lei portuguesa (DL n.º 84/2021).
          <br/><br/>
          Para acionar a garantia, basta apresentar este documento e o número do pedido (${order.id}).
          A garantia cobre defeitos de fabrico. Não cobre danos por mau uso, humidade ou alterações de software não oficiais.
        </div>

        <div class="footer">
          <p>Obrigado pela sua preferência.</p>
          <p>Este documento é um comprovativo interno e de garantia. Para efeitos fiscais, por favor solicite a fatura oficial enviada separadamente.</p>
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
            <div className="w-24 h-24 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-bold border-4 border-white shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="font-bold text-xl text-gray-900">{user.name}</h2>
            <p className="text-sm text-gray-500 mb-6">{user.email}</p>
            <button 
              onClick={onLogout}
              className="w-full py-2 px-4 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <LogOut size={16} /> Sair da Conta
            </button>
          </div>

          <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <button 
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left
                ${activeTab === 'orders' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}
            >
              <Package size={20} /> Minhas Encomendas
            </button>
            <button 
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left
                ${activeTab === 'profile' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}
            >
              <UserIcon size={20} /> Dados Pessoais
            </button>
            <button 
                onClick={() => setActiveTab('addresses')}
                className={`flex items-center gap-3 px-6 py-4 font-medium transition-colors text-left
                ${activeTab === 'addresses' ? 'bg-blue-50 text-primary border-l-4 border-primary' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'}`}
            >
              <MapPin size={20} /> Moradas
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          
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
                        <th className="px-6 py-4 font-medium">Estado</th>
                        <th className="px-6 py-4 font-medium">Total</th>
                        <th className="px-6 py-4 font-medium text-right">Ações</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                    {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                            <span className="font-bold text-gray-900 block">{displayOrderId(order.id)}</span>
                            <span className="text-xs text-gray-500">{new Date(order.date).toLocaleDateString()}</span>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : 
                                order.status === 'Enviado' ? 'bg-blue-100 text-blue-800' : 
                                'bg-yellow-100 text-yellow-800'}`}>
                            {order.status}
                            </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total)}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <button 
                                onClick={() => handlePrintOrder(order)}
                                className="inline-flex items-center gap-1 text-primary hover:text-blue-700 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                                title="Imprimir Comprovativo e Garantia"
                            >
                                <Printer size={16} />
                                <span className="hidden sm:inline">Comprovativo</span>
                            </button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
                
                {orders.length === 0 && (
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

          {/* --- PROFILE TAB --- */}
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

          {/* --- ADDRESSES TAB --- */}
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

          {/* Quick Stats (Visible only on Orders Tab) */}
          {activeTab === 'orders' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Gasto</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(totalSpent)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Pedidos</p>
                            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                        </div>
                    </div>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ClientArea;
