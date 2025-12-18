import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowRight, Star, Truck, ShieldCheck, CheckCircle, Loader2, Mail, ChevronLeft, ChevronRight, Check, X, Info, Zap, Smartphone } from 'lucide-react';
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
  
  // --- HERO BANNER STATE ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      id: 1,
      title: "Nova Xiaomi TV Box S (2ª Gen)",
      subtitle: "A revolução 8K chegou. Google TV e Processador Rápido.",
      cta: "Comprar Agora",
      image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=2500&auto=format&fit=crop",
      linkProductId: 1
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const isDragging = useRef(false); 

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
      console.error(error);
      setSubStatus('error');
    }
  };

  const categoryVisuals = useMemo(() => {
      const realCats = ['Todas', ...new Set(products.map(p => p.category))];
      const testCats = ['Gaming', 'Smart Home', 'Audio', 'Drones'];
      const uniqueCats = [...realCats, ...testCats];
      const mapCats = (list: string[]) => list.map(cat => {
          let image = '';
          if (cat === 'Todas') image = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80";
          else if (cat === 'Gaming') image = "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80";
          else if (cat === 'Smart Home') image = "https://images.unsplash.com/photo-1558002038-1091a166111c?auto=format&fit=crop&q=80";
          else if (cat === 'Audio') image = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80";
          else if (cat === 'Drones') image = "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&q=80";
          else {
              const product = products.find(p => p.category === cat);
              image = product ? product.image : 'https://via.placeholder.com/150';
          }
          return { name: cat, image };
      });
      return [...mapCats(uniqueCats), ...mapCats(uniqueCats), ...mapCats(uniqueCats)];
  }, [products]);

  useEffect(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth / 3;
    }
  }, [categoryVisuals]);

  const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const scrollPos = container.scrollLeft;
      const oneSetWidth = scrollWidth / 3;
      if (scrollPos < 50) container.scrollLeft = scrollPos + oneSetWidth;
      else if (scrollPos >= (oneSetWidth * 2) - clientWidth) container.scrollLeft = scrollPos - oneSetWidth;
  };

  const scroll = (direction: 'left' | 'right') => {
      if (scrollContainerRef.current) {
          const scrollAmount = 300; 
          scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
      }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!scrollContainerRef.current) return;
      isDown.current = true;
      isDragging.current = false;
      scrollContainerRef.current.classList.add('cursor-grabbing');
      startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
      scrollLeft.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseUp = () => {
      if (!scrollContainerRef.current) return;
      isDown.current = false;
      scrollContainerRef.current.classList.remove('cursor-grabbing');
      setTimeout(() => { isDragging.current = false; }, 50);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDown.current || !scrollContainerRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollContainerRef.current.offsetLeft;
      const walk = (x - startX.current) * 2; 
      if (Math.abs(x - startX.current) > 5) isDragging.current = true;
      scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleCategoryClick = (cat: string) => {
      if (isDragging.current) return;
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
      {/* --- HERO BANNER --- */}
      <section className="relative w-full h-[250px] md:h-[450px] overflow-hidden bg-gray-900 group shadow-lg">
        {slides.map((slide, index) => (
          <div key={slide.id} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
             <img src={slide.image} alt={slide.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[12000ms] ease-linear transform" style={{ transform: index === currentSlide ? 'scale(1.05)' : 'scale(1)' }} />
             <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
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
        <button onClick={() => setCurrentSlide(curr => curr === 0 ? slides.length - 1 : curr - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/30 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/50 backdrop-blur-sm hidden md:block border border-white/10"><ChevronLeft size={24} /></button>
        <button onClick={() => setCurrentSlide(curr => curr === slides.length - 1 ? 0 : curr + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/30 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/50 backdrop-blur-sm hidden md:block border border-white/10"><ChevronRight size={24} /></button>
      </section>

      {/* --- CATEGORY CAROUSEL --- */}
      <section className="pt-6 pb-2 bg-gray-50 relative group overflow-hidden select-none border-b border-gray-100">
        <div className="w-full relative">
            <button onClick={() => scroll('left')} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white p-2 md:p-3 rounded-full shadow-lg text-gray-700 hover:text-primary transition-all md:opacity-0 md:group-hover:opacity-100 backdrop-blur-sm" aria-label="Anterior"><ChevronLeft size={20} /></button>
            <button onClick={() => scroll('right')} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white p-2 md:p-3 rounded-full shadow-lg text-gray-700 hover:text-primary transition-all md:opacity-0 md:group-hover:opacity-100 backdrop-blur-sm" aria-label="Próximo"><ChevronRight size={20} /></button>
            <div ref={scrollContainerRef} className="flex gap-4 md:gap-8 overflow-x-auto py-4 md:py-8 px-4 md:px-12 justify-start w-full cursor-grab active:cursor-grabbing no-scrollbar snap-x snap-mandatory" onMouseDown={handleMouseDown} onMouseLeave={() => isDown.current = false} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} onScroll={handleScroll}>
                <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
                {categoryVisuals.map((cat, idx) => (
                    <div key={idx} onClick={(e) => { e.preventDefault(); handleCategoryClick(cat.name); }} draggable={false} className="flex flex-col items-center gap-3 min-w-[100px] md:min-w-[140px] group/item flex-shrink-0 cursor-pointer transition-transform active:scale-95 snap-center">
                        <div className={`w-20 h-20 md:w-32 md:h-32 rounded-full p-1 border-4 transition-all duration-300 overflow-hidden relative shadow-md bg-white pointer-events-none ${selectedCategory === cat.name ? 'border-primary ring-4 ring-primary/20 scale-105 shadow-xl z-10' : 'border-white group-hover/item:border-primary group-hover/item:shadow-lg group-hover/item:scale-105'}`}>
                            <img src={cat.image} alt={cat.name} draggable={false} className="w-full h-full object-cover rounded-full transition-transform duration-700 group-hover/item:scale-110 bg-gray-50 select-none" />
                            {selectedCategory === cat.name && <div className="absolute inset-0 bg-primary/10 rounded-full mix-blend-overlay"></div>}
                        </div>
                        <span className={`text-xs md:text-base font-bold transition-colors text-center leading-tight px-1 whitespace-nowrap pointer-events-none select-none ${selectedCategory === cat.name ? 'text-primary' : 'text-gray-600 group-hover/item:text-primary'}`}>{cat.name}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-4 bg-gray-50 border-b border-gray-200/50">
          <div className="container mx-auto px-2 md:px-4 max-w-4xl">
              <div className="grid grid-cols-3 gap-2 md:gap-6">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-lg cursor-default group"><div className="bg-blue-100 p-1.5 md:p-2.5 rounded-full text-primary shrink-0 group-hover:scale-110 transition-transform"><Star fill="currentColor" size={14} className="md:w-5 md:h-5" /></div><div><h3 className="font-bold text-gray-900 text-[10px] md:text-sm leading-tight">Qualidade</h3><p className="text-[9px] md:text-xs text-gray-500 hidden sm:block md:block">Garantida</p></div></div>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-lg cursor-default group"><div className="bg-green-100 p-1.5 md:p-2.5 rounded-full text-green-600 shrink-0 group-hover:scale-110 transition-transform"><Truck size={14} className="md:w-5 md:h-5" /></div><div><h3 className="font-bold text-gray-900 text-[10px] md:text-sm leading-tight">Envio Grátis</h3><p className="text-[9px] md:text-xs text-gray-500 block">acima de 50€</p></div></div>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-lg cursor-default group"><div className="bg-purple-100 p-1.5 md:p-2.5 rounded-full text-purple-600 shrink-0 group-hover:scale-110 transition-transform"><ShieldCheck size={14} className="md:w-5 md:h-5" /></div><div><h3 className="font-bold text-gray-900 text-[10px] md:text-sm leading-tight">Segurança</h3><p className="text-[9px] md:text-xs text-gray-500 hidden sm:block md:block">100% Seguro</p></div></div>
              </div>
          </div>
      </section>

      <ProductList products={products} onAddToCart={onAddToCart} getStock={getStock} wishlist={wishlist} onToggleWishlist={onToggleWishlist} searchTerm={searchTerm} selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} />

      {/* --- TABELA DE COMPARAÇÃO DE TV BOXES --- */}
      <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
              <div className="text-center mb-10">
                  <span className="text-primary font-bold text-sm tracking-widest uppercase">Guia de Compra</span>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2">Qual a Box ideal para si?</h2>
                  <p className="text-gray-500 mt-4 max-w-2xl mx-auto">Compare os nossos modelos mais vendidos e escolha a que melhor se adapta ao seu uso.</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-xl">
                  <table className="w-full text-left border-collapse bg-white">
                      <thead>
                          <tr className="bg-gray-50">
                              <th className="p-6 text-sm font-bold text-gray-500 uppercase border-b border-gray-200">Características</th>
                              <th className="p-6 border-b border-gray-200 min-w-[200px]">
                                  <div className="flex flex-col items-center">
                                      <img src="https://imiland.ir/wp-content/uploads/2025/05/1748368235_68_Xiaomi-TV-Box-S-3rd-Gen-%F0%9F%93%BA-This-is-the-best-cheap-TV-box-of-2025-_-Review-0-1-screenshot.png" alt="Xiaomi" className="h-16 w-auto object-contain mb-2" />
                                      <span className="font-bold text-gray-900">Xiaomi TV Box S</span>
                                      <span className="text-xs text-primary font-bold">CERTIFICADA</span>
                                  </div>
                              </th>
                              <th className="p-6 border-b border-gray-200 min-w-[200px]">
                                  <div className="flex flex-col items-center">
                                      <img src="https://img.kwcdn.com/product/fancy/d53c3efc-59aa-4ac2-bd40-201b43f0cc98.jpg?imageView2/2/w/800/q/70/format/avif" alt="H96 Max" className="h-16 w-auto object-contain mb-2" />
                                      <span className="font-bold text-gray-900">H96 Max M2</span>
                                      <span className="text-xs text-orange-500 font-bold">POTÊNCIA / LIBERDADE</span>
                                  </div>
                              </th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          <tr>
                              <td className="p-6 font-bold text-gray-700 bg-gray-50/30">Ideal Para</td>
                              <td className="p-6 text-sm text-gray-600 text-center"><span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">Netflix & Disney+ 4K</span></td>
                              <td className="p-6 text-sm text-gray-600 text-center"><span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-bold">IPTV & Apps Externos</span></td>
                          </tr>
                          <tr>
                              <td className="p-6 font-bold text-gray-700 bg-gray-50/30">Sistema Operativo</td>
                              <td className="p-6 text-sm text-center">Google TV (Fluído)</td>
                              <td className="p-6 text-sm text-center">Android 13 (Puro)</td>
                          </tr>
                          <tr>
                              <td className="p-6 font-bold text-gray-700 bg-gray-50/30">Memória RAM</td>
                              <td className="p-6 text-sm text-center">2GB (Otimizado)</td>
                              <td className="p-6 text-sm text-center">4GB (Multitasking)</td>
                          </tr>
                          <tr>
                              <td className="p-6 font-bold text-gray-700 bg-gray-50/30">Qualidade Netflix</td>
                              <td className="p-6 text-center"><Check className="text-green-500 mx-auto" size={24} /> <span className="text-[10px] font-bold text-green-600">4K OFICIAL</span></td>
                              <td className="p-6 text-center"><X className="text-red-400 mx-auto" size={24} /> <span className="text-[10px] font-bold text-red-400">QUALIDADE MÓVEL</span></td>
                          </tr>
                          <tr>
                              <td className="p-6 font-bold text-gray-700 bg-gray-50/30">Instalação APKs</td>
                              <td className="p-6 text-center text-xs text-gray-400">Limitada/Restrita</td>
                              <td className="p-6 text-center text-xs text-green-600 font-bold">Totalmente Aberta</td>
                          </tr>
                          <tr>
                              <td className="p-6 font-bold text-gray-700 bg-gray-50/30">Comando de Voz</td>
                              <td className="p-6 text-center text-green-500 font-bold">Sim (Google Assistant)</td>
                              <td className="p-6 text-center text-gray-400">Opcional</td>
                          </tr>
                          <tr className="bg-indigo-50/20">
                              <td className="p-6 font-bold text-indigo-900 bg-indigo-50/30">Veredito</td>
                              <td className="p-6 text-center">
                                  <p className="text-xs text-gray-600 leading-tight mb-3">Se quer ligar e ver os seus filmes oficiais com a melhor qualidade sem chatices.</p>
                                  <button onClick={() => window.location.hash = 'product/6'} className="text-white bg-primary px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-600 transition-all">Ver Xiaomi</button>
                              </td>
                              <td className="p-6 text-center">
                                  <p className="text-xs text-gray-600 leading-tight mb-3">Se quer liberdade total para instalar apps de TV, browsers e emuladores.</p>
                                  <button onClick={() => window.location.hash = 'product/2'} className="text-white bg-secondary px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition-all">Ver H96 Max</button>
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              
              <div className="mt-8 bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                  <Info className="text-primary shrink-0" size={20} />
                  <p className="text-sm text-blue-800"><strong>Dica de Especialista:</strong> Se o seu foco for usar aplicações oficiais de streaming (Netflix, HBO, Disney+), a <strong>Xiaomi</strong> é a única que garante a resolução 4K. Para tudo o resto, a <strong>H96</strong> oferece mais potência pelo preço.</p>
              </div>
          </div>
      </section>

      {/* Newsletter */}
      <section className="bg-secondary text-white py-8 relative overflow-hidden mt-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="container mx-auto px-4 text-center relative z-10">
              <div className="inline-flex items-center justify-center p-2 bg-white/10 rounded-full mb-3"><Mail className="text-primary" size={18} /></div>
              <h2 className="text-xl font-bold mb-2">Fique a par das novidades</h2>
              <p className="text-gray-300 mb-4 max-w-xl mx-auto text-xs md:text-sm">Inscreva-se para receber ofertas exclusivas e cupões de desconto.</p>
              {subStatus === 'success' ? (
                <div className="max-w-md mx-auto bg-green-500/20 border border-green-500/50 rounded-xl p-3 flex flex-col items-center animate-fade-in-up">
                    <CheckCircle className="text-green-400 mb-1" size={20} /><h3 className="text-base font-bold text-white mb-0.5">Inscrição Confirmada!</h3><p className="text-green-200 text-xs">Obrigado.</p>
                </div>
              ) : (
                <form className="max-w-md mx-auto flex flex-col sm:flex-row gap-2" onSubmit={handleSubscribe}>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="O seu email" className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all backdrop-blur-sm text-sm" disabled={subStatus === 'loading'} />
                    <button type="submit" disabled={subStatus === 'loading'} className="bg-primary hover:bg-blue-600 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 text-sm">{subStatus === 'loading' ? <Loader2 className="animate-spin" size={16} /> : 'Assinar'}</button>
                </form>
              )}
          </div>
      </section>
    </>
  );
};

export default Home;
