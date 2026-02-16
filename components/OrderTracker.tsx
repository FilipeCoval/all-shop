
import React, { useState } from 'react';
import { Search, Package, Truck, CheckCircle, Clock, AlertCircle, Copy, ArrowRight } from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { Order } from '../types';

const OrderTracker: React.FC = () => {
  const [searchId, setSearchId] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId || !email) {
        setError('Por favor preencha todos os campos.');
        return;
    }

    setLoading(true);
    setError('');
    setOrder(null);

    try {
        // Normalizar ID (adicionar # se faltar, uppercar)
        let normalizedId = searchId.trim();
        if (!normalizedId.startsWith('#')) normalizedId = '#' + normalizedId;
        normalizedId = normalizedId.toUpperCase();

        const snapshot = await db.collection('orders')
            .where('id', '==', normalizedId)
            .where('shippingInfo.email', '==', email.trim().toLowerCase())
            .limit(1)
            .get();

        if (snapshot.empty) {
            setError('Encomenda não encontrada. Verifique o ID e o email associado.');
        } else {
            const orderData = snapshot.docs[0].data() as Order;
            orderData.id = snapshot.docs[0].id;
            setOrder(orderData);
        }
    } catch (err) {
        console.error(err);
        setError('Ocorreu um erro ao procurar. Tente novamente.');
    } finally {
        setLoading(false);
    }
  };

  const copyTracking = (code: string) => {
      navigator.clipboard.writeText(code);
      setCopySuccess('Copiado!');
      setTimeout(() => setCopySuccess(''), 2000);
  };

  const getStatusStep = (status: string) => {
      const steps = ['Processamento', 'Pago', 'Enviado', 'Entregue'];
      // Mapear status especiais
      if (status === 'Reclamação' || status === 'Devolvido' || status === 'Cancelado') return -1;
      return steps.indexOf(status);
  };

  const currentStep = order ? getStatusStep(order.status) : 0;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl animate-fade-in">
        <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-4 bg-blue-50 rounded-full text-primary mb-4">
                <Truck size={32} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Rastrear Encomenda</h1>
            <p className="text-gray-500">Saiba exatamente onde está a sua tecnologia.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                <form onSubmit={handleTrack} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">ID da Encomenda</label>
                        <input 
                            type="text" 
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            placeholder="#AS-123456" 
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email de Compra</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com" 
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div className="flex items-end">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full md:w-auto bg-primary text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-600 transition-colors shadow-md disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {loading ? 'A procurar...' : <><Search size={20}/> Rastrear</>}
                        </button>
                    </div>
                </form>
                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg flex items-center gap-2 animate-shake">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}
            </div>

            {order && (
                <div className="p-8 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Encomenda {order.id}</h2>
                            <p className="text-sm text-gray-500">Realizada em {new Date(order.date).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-gray-100 px-4 py-2 rounded-lg">
                            <span className="text-xs text-gray-500 uppercase font-bold block">Estado Atual</span>
                            <span className={`font-bold ${order.status === 'Cancelado' ? 'text-red-600' : 'text-primary'}`}>{order.status}</span>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="relative mb-12">
                        {order.status === 'Cancelado' ? (
                            <div className="bg-red-50 border border-red-100 p-6 rounded-xl text-center text-red-700">
                                <AlertCircle size={32} className="mx-auto mb-2" />
                                <h3 className="font-bold">Encomenda Cancelada</h3>
                                <p className="text-sm mt-1">Se tiver dúvidas, entre em contacto com o suporte.</p>
                            </div>
                        ) : (
                            <div className="w-full">
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full hidden md:block"></div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-0 relative">
                                    {['Processamento', 'Pago', 'Enviado', 'Entregue'].map((step, idx) => {
                                        const isCompleted = currentStep >= idx;
                                        const isCurrent = currentStep === idx;
                                        
                                        return (
                                            <div key={step} className="flex flex-row md:flex-col items-center gap-4 md:gap-2 relative z-10">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isCompleted ? 'bg-primary border-blue-200 text-white' : 'bg-white border-gray-200 text-gray-300'}`}>
                                                    {idx === 0 && <Clock size={16} />}
                                                    {idx === 1 && <CheckCircle size={16} />}
                                                    {idx === 2 && <Truck size={16} />}
                                                    {idx === 3 && <Package size={16} />}
                                                </div>
                                                <div className="md:text-center">
                                                    <p className={`font-bold text-sm ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>{step}</p>
                                                    {isCurrent && <span className="text-[10px] text-primary font-medium animate-pulse">Em curso</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tracking Info */}
                    {order.trackingNumber && (
                        <div className="bg-green-50 border border-green-100 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="bg-green-100 p-3 rounded-full text-green-600">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-green-900">Encomenda em Trânsito</h3>
                                    <p className="text-green-700 text-sm">Operadora: CTT Expresso</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-green-200 shadow-sm w-full md:w-auto">
                                <span className="font-mono font-bold text-gray-700 flex-1">{order.trackingNumber}</span>
                                <button onClick={() => copyTracking(order.trackingNumber!)} className="text-gray-400 hover:text-primary transition-colors relative">
                                    {copySuccess ? <span className="text-xs text-green-600 font-bold absolute -left-12 top-0.5">{copySuccess}</span> : <Copy size={16} />}
                                </button>
                            </div>
                            <a 
                                href={`https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${order.trackingNumber}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow flex items-center gap-2"
                            >
                                Seguir no site CTT <ArrowRight size={16} />
                            </a>
                        </div>
                    )}

                    {/* Order Items Summary */}
                    <div>
                        <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Resumo do Pedido</h4>
                        <div className="space-y-3">
                            {order.items.map((item: any, idx) => {
                                const name = typeof item === 'string' ? item : item.name;
                                const variant = typeof item === 'object' && item.selectedVariant ? item.selectedVariant : null;
                                const qty = typeof item === 'object' ? item.quantity : 1;
                                
                                return (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-gray-100 text-gray-600 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs">{qty}x</span>
                                            <div>
                                                <span className="text-gray-700">{name}</span>
                                                {variant && <span className="text-gray-400 text-xs ml-2">({variant})</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default OrderTracker;
