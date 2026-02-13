
import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle, MessageCircle } from 'lucide-react';
import { TELEGRAM_LINK, SELLER_PHONE } from '../constants';

const Contact: React.FC = () => {
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    // Simulate API call
    setTimeout(() => {
        setFormStatus('success');
    }, 1500);
  };

  return (
    <div className="container mx-auto px-4 py-16 animate-fade-in">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Entre em Contacto</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
            Tem alguma dúvida sobre um produto ou o seu pedido? Estamos aqui para ajudar.
            A nossa equipa responde geralmente em menos de 2 horas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
        {/* Info Cards */}
        <div className="space-y-6">
            {/* Telegram Card - Clickable */}
            <a 
                href={TELEGRAM_LINK} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer group"
            >
                <div className="bg-blue-50 p-3 rounded-full text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <MessageCircle size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 mb-1">Telegram</h3>
                    <p className="text-gray-600 mb-1">Canal Oficial All-Shop</p>
                    <p className="text-sm text-blue-500 font-medium flex items-center gap-1">
                        Clique para entrar <span className="text-xs">↗</span>
                    </p>
                </div>
            </a>

            {/* WhatsApp Card - Clickable */}
            <a 
                href={`https://wa.me/${SELLER_PHONE}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-lg hover:border-green-400 transition-all cursor-pointer group"
            >
                <div className="bg-green-50 p-3 rounded-full text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <Phone size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 mb-1">WhatsApp</h3>
                    <p className="text-gray-600 mb-1">+351 933 865 907</p>
                    <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                        Clique para falar <span className="text-xs">↗</span>
                    </p>
                </div>
            </a>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition-shadow">
                <div className="bg-gray-50 p-3 rounded-full text-gray-600">
                    <Mail size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 mb-1">E-mail</h3>
                    <p className="text-gray-600 mb-1">suporte@all-shop.net</p>
                    <p className="text-sm text-gray-400">Resposta em até 24h</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition-shadow">
                <div className="bg-red-50 p-3 rounded-full text-red-500">
                    <MapPin size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 mb-1">Escritório</h3>
                    <p className="text-gray-600 mb-1">Av. da Liberdade, 100</p>
                    <p className="text-gray-600">Lisboa, Portugal</p>
                </div>
            </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-8 md:p-10">
            {formStatus === 'success' ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 animate-fade-in">
                    <div className="bg-green-100 p-4 rounded-full text-green-600 mb-6">
                        <CheckCircle size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Mensagem Enviada!</h3>
                    <p className="text-gray-600 mb-8">Obrigado pelo contacto. Retornaremos em breve.</p>
                    <button 
                        onClick={() => setFormStatus('idle')}
                        className="text-primary font-medium hover:underline"
                    >
                        Enviar outra mensagem
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-6">Envie uma mensagem</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                            <input type="text" required className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="O seu nome" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                            <input type="email" required className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="seu@email.com" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assunto</label>
                        <select className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-gray-50 focus:bg-white">
                            <option>Dúvida sobre produto</option>
                            <option>Estado do pedido</option>
                            <option>Trocas e devoluções</option>
                            <option>Outros assuntos</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
                        <textarea required rows={5} className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Como podemos ajudar?"></textarea>
                    </div>

                    <button 
                        type="submit" 
                        disabled={formStatus === 'submitting'}
                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                    >
                        {formStatus === 'submitting' ? (
                            'A enviar...'
                        ) : (
                            <>
                                Enviar Mensagem <Send size={20} />
                            </>
                        )}
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default Contact;
