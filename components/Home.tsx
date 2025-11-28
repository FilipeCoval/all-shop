
import React, { useState } from 'react';
import { ArrowRight, Star, Truck, ShieldCheck, CheckCircle, Loader2, Mail } from 'lucide-react';
import ProductList from './ProductList';
import { Product } from '../types';
import { db } from '../services/firebaseConfig';

interface HomeProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  getStock: (productId: number) => number; // Prop adicionada
}

const Home: React.FC<HomeProps> = ({ products, onAddToCart, getStock }) => {
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = path;
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubStatus('loading');

    try {
      // Gravar na coleção 'newsletter_subscriptions' no Firestore
      await db.collection('newsletter_subscriptions').add({
        email: email,
        date: new Date().toISOString(),
        source: 'website_home'
      });

      setSubStatus('success');
      setEmail('');
      
      // Reset da mensagem de sucesso após 5 segundos
      setTimeout(() => setSubStatus('idle'), 5000);

    } catch (error) {
      console.error("Erro ao subscrever newsletter:", error);
      setSubStatus('error');
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-secondary text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20"></div>
        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-block bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-4 py-1 text-sm font-semibold text-blue-300 mb-4">
              🚀 Novas ofertas chegaram
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
              Tecnologia do <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                Futuro Hoje
              </span>
            </h1>
            <p className="text-gray-300 text-lg md:text-xl max-w-lg mx-auto md:mx-0">
              Descubra os eletrônicos mais desejados com preços imbatíveis e entrega expressa para todo Portugal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <a 
                href="#/"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-full font-bold transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                Ver Ofertas
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#about" onClick={handleNav('about')} className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white px-8 py-3 rounded-full font-medium transition-all text-center">
                Saiba Mais
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="bg-blue-100 p-3 rounded-full text-primary">
                      <Star fill="currentColor" size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900">Qualidade Garantida</h3>
                      <p className="text-sm text-gray-500">Produtos originais com garantia</p>
                  </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="bg-green-100 p-3 rounded-full text-green-600">
                      <Truck size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900">Portes Grátis</h3>
                      <p className="text-sm text-gray-500">Oferta em todas as encomendas</p>
                  </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                      <ShieldCheck size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900">Compra Segura</h3>
                      <p className="text-sm text-gray-500">Os seus dados protegidos</p>
                  </div>
              </div>
          </div>
      </section>

      <ProductList products={products} onAddToCart={onAddToCart} getStock={getStock} />

      {/* Newsletter */}
      <section className="bg-secondary text-white py-16 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="container mx-auto px-4 text-center relative z-10">
              <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-6">
                 <Mail className="text-primary" size={24} />
              </div>
              <h2 className="text-3xl font-bold mb-4">Fique a par das novidades</h2>
              <p className="text-gray-300 mb-8 max-w-xl mx-auto">
                  Inscreva-se para receber ofertas exclusivas, cupões de desconto e novidades em primeira mão.
              </p>
              
              {subStatus === 'success' ? (
                <div className="max-w-md mx-auto bg-green-500/20 border border-green-500/50 rounded-xl p-6 flex flex-col items-center animate-fade-in-up">
                    <CheckCircle className="text-green-400 mb-2" size={32} />
                    <h3 className="text-xl font-bold text-white mb-1">Inscrição Confirmada!</h3>
                    <p className="text-green-200">Obrigado. Vai receber as nossas novidades em breve.</p>
                </div>
              ) : (
                <form className="max-w-md mx-auto flex flex-col sm:flex-row gap-3" onSubmit={handleSubscribe}>
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="O seu melhor e-mail" 
                        className="flex-1 px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all backdrop-blur-sm"
                        disabled={subStatus === 'loading'}
                    />
                    <button 
                        type="submit" 
                        disabled={subStatus === 'loading'}
                        className="bg-primary hover:bg-blue-600 px-8 py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {subStatus === 'loading' ? (
                            <>
                                <Loader2 className="animate-spin" size={20} /> A Subscrever...
                            </>
                        ) : (
                            'Assinar'
                        )}
                    </button>
                </form>
              )}
              
              {subStatus === 'error' && (
                  <p className="text-red-400 mt-4 text-sm animate-fade-in">Ocorreu um erro. Por favor tente novamente.</p>
              )}

              <p className="text-gray-500 text-xs mt-6">
                Ao assinar, concorda com a nossa política de privacidade. Não enviamos spam.
              </p>
          </div>
      </section>
    </>
  );
};

export default Home;
