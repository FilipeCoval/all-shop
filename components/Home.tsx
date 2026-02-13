import { Product, ProductVariant } from '../types';
import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRight, Star, Truck, ShieldCheck, CheckCircle, Loader2, Mail, Zap, Flame, Sparkles, Star as StarIcon, CalendarClock, AlertTriangle } from 'lucide-react';
import ProductList from './ProductList';
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
  processingProductIds?: number[];
}

const Home: React.FC<HomeProps> = ({ 
    products, 
    onAddToCart, 
    getStock, 
    wishlist, 
    onToggleWishlist, 
    searchTerm, 
    selectedCategory, 
    onCategoryChange,
    processingProductIds = []
}) => {
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // --- HERO BANNER STATE ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      id: 1,
      title: "Nova Xiaomi TV Box S (3ª Gen)",
      subtitle: "A revolução 8K chegou. Google TV e Processador Rápido.",
      cta: "Comprar Agora",
      image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=2500&auto=format&fit=crop",
      linkProductId: 6
    },
    {
      id: 2,
      title: "Envios Grátis > 50€",
      subtitle: "Entrega rápida em 24h/48h para Portugal Continental.",
      cta: "Ver Catálogo",
      image: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?q=80&w=2500&auto=format&fit=crop",
      action: () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })
    },
    {
      id: 3,
      title: "Acessórios Premium",
      subtitle: "Cabos e Hubs de alta performance para o seu setup.",
      cta: "Explorar",
      image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2500&auto=format&fit=crop",
      category: "Acessórios"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);


  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubStatus('loading');
    
    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      await db.collection('newsletter_subscriptions').add({
        email: normalizedEmail,
        date: new Date().toISOString(),
        source: 'website_home'
      });

      setSubStatus('success');
      setEmail(''); 
    
    } catch (error) {
      console.error(error);
      setSubStatus('error');
      setTimeout(() => setSubStatus('idle'), 4000); 
    }
  };

  const categoryVisuals = useMemo(() => {
      const realCats: string[] = ['Todas', ...Array.from(new Set<string>(products.map(p => p.category)))];
      const testCats = ['Gaming', 'Smart Home', 'Audio', 'Drones'];
      const uniqueCats: string[] = Array.from(new Set([...realCats, ...testCats]));
      
      const mapCats = (list: string[]) => list.map(cat => {
          let image = '';
          if (cat === 'Todas') image = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80";
          else if (cat === 'Gaming') image = "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80";
          else if (cat === 'Smart Home') image = "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80";
          else if (cat === 'Audio') image = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80";
          else if (cat === 'Drones') image = "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&q=80";
          else {
              const product = products.find(p => p.category === cat);
              image = product ? product.image : 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80';
          }
          return { name: cat, image };
      });
      
      const uniqueFinal = mapCats(uniqueCats);
      return [...uniqueFinal, ...uniqueFinal];
  }, [products]);


  const handleCategoryClick = (cat: string) => {
      onCategoryChange(cat);
      setTimeout(() => {
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
  };

  const handleBannerClick = (slide: any) => {
    if (slide.linkProductId) window.location.hash = `#product/${slide.linkProductId}`;
    else if (slide.category) {
        onCategoryChange(slide.category);
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    } else if (slide.action) slide.action();
  };

  return (
    <>
      <section className="relative w-full h-[250px] md:h-[450px] overflow-hidden bg-gray-900 group shadow-lg">
        {slides.map((slide, index) => (
          <div key={slide.id} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
             <img src={slide.image} alt={slide.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[12000ms] ease-linear transform" style={{ transform: index === currentSlide ? 'scale(1.05)' : 'scale(1)' }} />
             <div className="relative z-20 container mx-auto px-6 h-full flex flex-col justify-center items-start text-white max-w-6xl">
                <div className="flex flex-col gap-3 md:gap-4 max-w-xl">
                    <span className="inline-block px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider w-fit border border-white/20 shadow-sm">Destaque</span>
                    <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{slide.title}</h1>
                    <p className="text-sm md:text-xl text-white font-medium drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] max-w-lg">{slide.subtitle}</p>
                    <div className="mt-4"><button onClick={() => handleBannerClick(slide)} className="bg-white text-gray-900 hover:bg-gray-100 px-6 py-3 rounded-full font-bold text-sm md:text-base transition-all transform hover:scale-105 shadow-xl flex items-center gap-2 border border-gray-100">{slide.cta} <ArrowRight size={18} /></button></div>
                </div>
             </div>
          </div>
        ))}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
            {slides.map((_, i) => (
                <button 
                    key={i} 
                    onClick={() => setCurrentSlide(i)} 
                    className={`w-2 h-2 rounded-full transition-all ${currentSlide === i ? 'bg-white w-6' : 'bg-white/40'}`}
                />
            ))}
        </div>
      </section>

      {/* MARQUEE CAROUSEL (CATEGORIAS) */}
      <section className="py-8 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 select-none overflow-hidden group transition-colors duration-300">
          <div 
            className="flex gap-4 md:gap-8 animate-marquee group-hover:[animation-play-state:paused]"
            style={{ willChange: 'transform' }}
          >
              {categoryVisuals.map((cat, idx) => (
                  <div key={idx} onClick={() => handleCategoryClick(cat.name)} className="flex flex-col items-center gap-3 min-w-[100px] md:min-w-[140px] group/item flex-shrink-0 cursor-pointer transition-transform active:scale-95">
                      <div className={`w-20 h-20 md:w-32 md:h-32 rounded-full p-1 border-4 transition-all duration-300 overflow-hidden relative shadow-md bg-white dark:bg-gray-800 ${selectedCategory === cat.name ? 'border-primary ring-4 ring-primary/20 scale-105 shadow-xl z-10' : 'border-white dark:border-gray-700 group-hover/item:border-primary group-hover/item:shadow-lg group-hover/item:scale-105'}`}>
                          <img src={cat.image} alt={cat.name} draggable={false} className="w-full h-full object-cover rounded-full transition-transform duration-700 group-hover/item:scale-110 bg-gray-50 dark:bg-gray-700 select-none" />
                      </div>
                      <span className={`text-xs md:text-base font-bold transition-colors text-center leading-tight px-1 whitespace-nowrap ${selectedCategory === cat.name ? 'text-primary' : 'text-gray-600 dark:text-gray-200 group-hover/item:text-primary'}`}>{cat.name}</span>
                  </div>
              ))}
          </div>
      </section>

      {/* DESTAQUES (QUALIDADE, ENVIO, SEGURANÇA) */}
      <section className="py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200/50 dark:border-gray-800 transition-colors duration-300">
          <div className="container mx-auto px-2 md:px-4 max-w-4xl">
              <div className="grid grid-cols-3 gap-2 md:gap-6">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg cursor-default group">
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 md:p-2.5 rounded-full text-primary shrink-0 group-hover:scale-110 transition-transform"><StarIcon fill="currentColor" size={14} className="md:w-5 md:h-5" /></div>
                      <div><h3 className="font-bold text-gray-900 dark:text-gray-100 text-[10px] md:text-sm leading-tight">Qualidade</h3><p className="text-[9px] md:text-xs text-gray-500 dark:text-gray-400 hidden sm:block md:block">Garantida</p></div>
                  </div>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg cursor-default group">
                      <div className="bg-green-100 dark:bg-green-900/30 p-1.5 md:p-2.5 rounded-full text-green-600 dark:text-green-400 shrink-0 group-hover:scale-110 transition-transform"><Truck size={14} className="md:w-5 md:h-5" /></div>
                      <div><h3 className="font-bold text-gray-900 dark:text-gray-100 text-[10px] md:text-sm leading-tight">Envio Grátis</h3><p className="text-[9px] md:text-xs text-gray-500 dark:text-gray-400 block">acima de 50€</p></div>
                  </div>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg cursor-default group">
                      <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 md:p-2.5 rounded-full text-purple-600 dark:text-purple-400 shrink-0 group-hover:scale-110 transition-transform"><ShieldCheck size={14} className="md:w-5 md:h-5" /></div>
                      <div><h3 className="font-bold text-gray-900 dark:text-gray-100 text-[10px] md:text-sm leading-tight">Segurança</h3><p className="text-[9px] md:text-xs text-gray-500 dark:text-gray-400 hidden sm:block md:block">100% Seguro</p></div>
                  </div>
              </div>
          </div>
      </section>

      <ProductList products={products} onAddToCart={onAddToCart} getStock={getStock} wishlist={wishlist} onToggleWishlist={onToggleWishlist} searchTerm={searchTerm} selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} processingProductIds={processingProductIds} />

      {/* NEWSLETTER SECTION */}
      <section className="bg-secondary dark:bg-gray-900 text-white py-8 relative overflow-hidden mt-8 border-t border-transparent dark:border-gray-800 transition-colors duration-300">
          <div className="container mx-auto px-4 text-center relative z-10">
              <div className="inline-flex items-center justify-center p-2 bg-white/10 rounded-full mb-3"><Mail className="text-primary" size={18} /></div>
              <h2 className="text-xl font-bold mb-2 text-white">Fique a par das novidades</h2>
              <p className="text-gray-300 mb-4 max-w-xl mx-auto text-xs md:text-sm">Inscreva-se para receber ofertas exclusivas e cupões de desconto.</p>
              
              <div className="max-w-md mx-auto">
                {subStatus === 'success' ? (
                  <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-3 flex flex-col items-center animate-fade-in-up">
                      <CheckCircle className="text-green-400 mb-1" size={20} />
                      <h3 className="text-base font-bold text-white mb-0.5">Inscrição Confirmada!</h3>
                      <p className="text-green-200 text-xs">Obrigado.</p>
                  </div>
                ) : (
                  <>
                    <form className="flex flex-col sm:flex-row gap-2" onSubmit={handleSubscribe}>
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
                    {subStatus === 'error' && (
                        <p className="text-red-400 text-xs mt-2 animate-fade-in flex items-center justify-center gap-1">
                            <AlertTriangle size={12} /> Ocorreu um erro. Tente novamente.
                        </p>
                    )}
                  </>
                )}
              </div>
          </div>
      </section>
    </>
  );
};

export default Home;
