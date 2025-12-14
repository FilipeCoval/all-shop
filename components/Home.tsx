import React, { useState } from 'react';
import { ArrowRight, Star, Truck, ShieldCheck, CheckCircle, Loader2, Mail } from 'lucide-react';
import ProductList from './ProductList';
import { Product, ProductVariant } from '../types';
import { db } from '../services/firebaseConfig';

interface HomeProps {
  products: Product[];
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  getStock: (productId: number) => number;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  searchTerm: string;
}

const Home: React.FC<HomeProps> = ({ products, onAddToCart, getStock, wishlist, onToggleWishlist, searchTerm }) => {
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
      await db.collection('newsletter_subscriptions').add({
        email: email,
        date: new Date().toISOString(),
        source: 'website_home'
      });

      setSubStatus('success');
      setEmail('');
      setTimeout(() => setSubStatus('idle'), 5000);

    } catch (error) {
      console.error("Erro ao subscrever newsletter:", error);
      setSubStatus('error');
    }
  };

  return (
    <>
      {/* Hero Section - Super Compacta Mobile */}
      <section className="relative bg-secondary text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20"></div>
        <div className="container mx-auto px-4 py-8 md:py-16 relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8">
          <div className="flex-1 space-y-3 md:space-y-4 text-center md:text-left">
            <div className="inline-block bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-3 py-1 text-[10px] md:text-xs font-semibold text-blue-300 mb-1">
              🚀 Novas ofertas chegaram
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Tecnologia do <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                Futuro Hoje
              </span>
            </h1>
            <p className="text-gray-300 text-sm md:text-lg max-w-lg mx-auto md:mx-0">
              Descubra os eletrônicos mais desejados com preços imbatíveis.
            </p>
            <div className="flex flex-row gap-3 justify-center md:justify-start pt-2">
              <a 
                href="#/"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-primary hover:bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold transition-all flex items-center justify-center gap-2 group cursor-pointer text-xs md:text-sm"
              >
                Ver Ofertas
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#about" onClick={handleNav('about')} className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white px-5 py-2.5 rounded-full font-medium transition-all text-center text-xs md:text-sm">
                Saiba Mais
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section - Layout Horizontal Mobile (Compacto) */}
      <section className="py-4 bg-white border-b border-gray-100">
          <div className="container mx-auto px-2 md:px-4 grid grid-cols-3 gap-2 md:gap-6">
              {/* Item 1 */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-center">
                  <div className="bg-blue-100 p-2 md:p-2.5 rounded-full text-primary shrink-0">
                      <Star fill="currentColor" size={16} className="md:w-5 md:h-5" />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-xs md:text-sm leading-tight">Qualidade</h3>
                      <p className="text-[10px] md:text-xs text-gray-500 hidden sm:block md:block">Garantida</p>
                  </div>
              </div>

              {/* Item 2 */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-center border-l border-r border-gray-50 md:border-0">
                  <div className="bg-green-100 p-2 md:p-2.5 rounded-full text-green-600 shrink-0">
                      <Truck size={16} className="md:w-5 md:h-5" />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-xs md:text-sm leading-tight">Envio Grátis</h3>
                      <p className="text-[10px] md:text-xs text-gray-500 block">Acima de 50€</p>
                  </div>
              </div>

              {/* Item 3 */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-center">
                  <div className="bg-purple-100 p-2 md:p-2.5 rounded-full text-purple-600 shrink-0">
                      <ShieldCheck size={16} className="md:w-5 md:h-5" />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-xs md:text-sm leading-tight">Segurança</h3>
                      <p className="text-[10px] md:text-xs text-gray-500 hidden sm:block md:block">100% Seguro</p>
                  </div>
              </div>
          </div>
      </section>

      <ProductList 
        products={products} 
        onAddToCart={onAddToCart} 
        getStock={getStock} 
        wishlist={wishlist} 
        onToggleWishlist={onToggleWishlist}
        searchTerm={searchTerm}
      />

      {/* Newsletter */}
      <section className="bg-secondary text-white py-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="container mx-auto px-4 text-center relative z-10">
              <div className="inline-flex items-center justify-center p-2 bg-white/10 rounded-full mb-3">
                 <Mail className="text-primary" size={18} />
              </div>
              <h2 className="text-xl font-bold mb-2">Fique a par das novidades</h2>
              <p className="text-gray-300 mb-4 max-w-xl mx-auto text-xs md:text-sm">
                  Inscreva-se para receber ofertas exclusivas e cupões de desconto.
              </p>
              
              {subStatus === 'success' ? (
                <div className="max-w-md mx-auto bg-green-500/20 border border-green-500/50 rounded-xl p-3 flex flex-col items-center animate-fade-in-up">
                    <CheckCircle className="text-green-400 mb-1" size={20} />
                    <h3 className="text-base font-bold text-white mb-0.5">Inscrição Confirmada!</h3>
                    <p className="text-green-200 text-xs">Obrigado.</p>
                </div>
              ) : (
                <form className="max-w-md mx-auto flex flex-col sm:flex-row gap-2" onSubmit={handleSubscribe}>
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="O seu email" 
                        className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all backdrop-blur-sm text-sm"
                        disabled={subStatus === 'loading'}
                    />
                    <button 
                        type="submit" 
                        disabled={subStatus === 'loading'}
                        className="bg-primary hover:bg-blue-600 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 text-sm"
                    >
                        {subStatus === 'loading' ? <Loader2 className="animate-spin" size={16} /> : 'Assinar'}
                    </button>
                </form>
              )}
          </div>
      </section>
    </>
  );
};

export default Home;
