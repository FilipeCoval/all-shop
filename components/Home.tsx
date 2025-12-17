import React, { useState, useMemo, useRef } from 'react';
import { ArrowRight, Star, Truck, ShieldCheck, CheckCircle, Loader2, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
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
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const Home: React.FC<HomeProps> = ({ 
    products, 
    onAddToCart, 
    getStock, 
    wishlist, 
    onToggleWishlist, 
    searchTerm,
    selectedCategory,
    onCategoryChange
}) => {
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Ref para o scroll do carrossel
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Lógica de Scroll das Setas
  const scroll = (direction: 'left' | 'right') => {
      if (scrollContainerRef.current) {
          const { current } = scrollContainerRef;
          const scrollAmount = 300; // Quantidade de scroll
          if (direction === 'left') {
              current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
          } else {
              current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
      }
  };

  // Gerar dados visuais para as categorias
  const categoryVisuals = useMemo(() => {
      const realCats = ['Todas', ...new Set(products.map(p => p.category))];
      const testCats = ['Gaming', 'Smart Home', 'Audio', 'Drones'];
      const allCatsToDisplay = [...realCats, ...testCats];

      return allCatsToDisplay.map(cat => {
          let image = '';
          if (cat === 'Todas') {
              image = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80";
          } else if (cat === 'Gaming') {
              image = "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80";
          } else if (cat === 'Smart Home') {
              image = "https://images.unsplash.com/photo-1558002038-1091a166111c?auto=format&fit=crop&q=80";
          } else if (cat === 'Audio') {
              image = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80";
          } else if (cat === 'Drones') {
              image = "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&q=80";
          } else {
              const product = products.find(p => p.category === cat);
              image = product ? product.image : 'https://via.placeholder.com/150';
          }
          return { name: cat, image };
      });
  }, [products]);

  const handleCategoryClick = (cat: string) => {
      onCategoryChange(cat);
      // Scroll suave até à lista de produtos
      setTimeout(() => {
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
  };

  return (
    <>
      {/* 
        REMOVIDO HERO BANNER 
        A página começa agora diretamente com o Carrossel 
      */}

      {/* --- CATEGORY CAROUSEL --- */}
      {/* Adicionado pt-8 para dar espaço do topo */}
      <section className="pt-8 pb-4 bg-gray-50 relative group">
        <div className="container mx-auto px-4 relative">
            
            {/* Seta Esquerda */}
            <button 
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white p-3 rounded-full shadow-lg text-gray-700 hover:text-primary transition-all md:opacity-0 md:group-hover:opacity-100 backdrop-blur-sm -ml-2 md:ml-0"
                aria-label="Anterior"
            >
                <ChevronLeft size={24} />
            </button>

            {/* Seta Direita */}
            <button 
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white p-3 rounded-full shadow-lg text-gray-700 hover:text-primary transition-all md:opacity-0 md:group-hover:opacity-100 backdrop-blur-sm -mr-2 md:mr-0"
                aria-label="Próximo"
            >
                <ChevronRight size={24} />
            </button>

            {/* Contentor com Scrollbar Escondida */}
            <div 
                ref={scrollContainerRef}
                className="flex gap-8 overflow-x-auto p-8 snap-x justify-start md:justify-center"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} 
            >
                {/* CSS Inline para garantir que scrollbar não aparece */}
                <style>{`
                    div::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {categoryVisuals.map((cat, idx) => (
                    <button 
                        key={idx}
                        onClick={() => handleCategoryClick(cat.name)}
                        className="flex flex-col items-center gap-4 min-w-[120px] md:min-w-[160px] snap-center group/item"
                    >
                        <div className={`
                            w-28 h-28 md:w-40 md:h-40 rounded-full p-1.5 border-4 transition-all duration-300 overflow-hidden relative shadow-lg bg-white
                            ${selectedCategory === cat.name 
                                ? 'border-primary ring-4 ring-primary/20 scale-110 shadow-2xl z-10' 
                                : 'border-white group-hover/item:border-primary group-hover/item:shadow-xl group-hover/item:scale-105'
                            }
                        `}>
                            <img 
                                src={cat.image} 
                                alt={cat.name} 
                                className="w-full h-full object-cover rounded-full transition-transform duration-700 group-hover/item:scale-110 bg-gray-50"
                            />
                            {selectedCategory === cat.name && (
                                <div className="absolute inset-0 bg-primary/10 rounded-full mix-blend-overlay"></div>
                            )}
                        </div>
                        {/* AUMENTADO: text-base md:text-xl */}
                        <span className={`text-base md:text-xl font-bold transition-colors text-center leading-tight px-1
                            ${selectedCategory === cat.name ? 'text-primary' : 'text-gray-600 group-hover/item:text-primary'}
                        `}>
                            {cat.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
      </section>

      {/* Benefits Section - AGORA SEM FUNDO, SÓ NO HOVER */}
      <section className="py-6 bg-gray-50 border-b border-gray-200/50">
          <div className="container mx-auto px-2 md:px-4 max-w-4xl">
              <div className="grid grid-cols-3 gap-2 md:gap-6">
                  {/* Item 1 */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-xl hover:-translate-y-1 cursor-default group">
                      <div className="bg-blue-100 p-2 md:p-2.5 rounded-full text-primary shrink-0 group-hover:scale-110 transition-transform">
                          <Star fill="currentColor" size={16} className="md:w-5 md:h-5" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-900 text-xs md:text-sm leading-tight">Qualidade</h3>
                          <p className="text-[10px] md:text-xs text-gray-500 hidden sm:block md:block">Garantida</p>
                      </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-xl hover:-translate-y-1 cursor-default group">
                      <div className="bg-green-100 p-2 md:p-2.5 rounded-full text-green-600 shrink-0 group-hover:scale-110 transition-transform">
                          <Truck size={16} className="md:w-5 md:h-5" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-900 text-xs md:text-sm leading-tight">Envio Grátis</h3>
                          <p className="text-[10px] md:text-xs text-gray-500 block">acima de 50€</p>
                      </div>
                  </div>

                  {/* Item 3 */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-xl hover:-translate-y-1 cursor-default group">
                      <div className="bg-purple-100 p-2 md:p-2.5 rounded-full text-purple-600 shrink-0 group-hover:scale-110 transition-transform">
                          <ShieldCheck size={16} className="md:w-5 md:h-5" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-900 text-xs md:text-sm leading-tight">Segurança</h3>
                          <p className="text-[10px] md:text-xs text-gray-500 hidden sm:block md:block">100% Seguro</p>
                      </div>
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
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
      />

      {/* Newsletter */}
      <section className="bg-secondary text-white py-8 relative overflow-hidden mt-8">
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
