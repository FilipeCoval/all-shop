import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  
  // --- HERO BANNER STATE ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      id: 1,
      title: "Nova Xiaomi TV Box S (2ª Gen)",
      subtitle: "A revolução 8K chegou. Google TV e Processador Rápido.",
      cta: "Comprar Agora",
      // Imagem 4K Original
      image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=2500&auto=format&fit=crop",
      linkProductId: 1
    },
    {
      id: 2,
      title: "Envios Grátis > 50€",
      subtitle: "Entrega rápida em 24h/48h para Portugal Continental.",
      cta: "Ver Catálogo",
      // Imagem Original
      image: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?q=80&w=2500&auto=format&fit=crop",
      action: () => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })
    },
    {
      id: 3,
      title: "Acessórios Premium",
      subtitle: "Cabos e Hubs de alta performance para o seu setup.",
      cta: "Explorar",
      // Imagem Original
      image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2500&auto=format&fit=crop",
      category: "Acessórios"
    }
  ];

  // Auto-play do Banner
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 6000); // 6 segundos por slide
    return () => clearInterval(timer);
  }, [slides.length]);

  // Ref para o scroll do carrossel
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Refs para a lógica de Drag-to-Scroll (Arrastar com o rato)
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
      console.error("Erro ao subscrever newsletter:", error);
      setSubStatus('error');
    }
  };

  // Gerar dados visuais para as categorias
  // LÓGICA DE INFINITO: Criamos 3 cópias da lista para permitir o loop
  const categoryVisuals = useMemo(() => {
      const realCats = ['Todas', ...new Set(products.map(p => p.category))];
      // Categorias de teste para garantir que temos volume suficiente para o scroll funcionar bem
      const testCats = ['Gaming', 'Smart Home', 'Audio', 'Drones'];
      const uniqueCats = [...realCats, ...testCats];

      const mapCats = (list: string[]) => list.map(cat => {
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

      // Retornamos 3 conjuntos: [PREV_SET] [CURRENT_SET] [NEXT_SET]
      // Isto permite fazer scroll "infinito"
      return [
        ...mapCats(uniqueCats), // Set 1 (Cópia Esquerda)
        ...mapCats(uniqueCats), // Set 2 (Principal/Centro)
        ...mapCats(uniqueCats)  // Set 3 (Cópia Direita)
      ];
  }, [products]);

  // Posicionar o scroll no MEIO ao carregar a página
  useEffect(() => {
    if (scrollContainerRef.current) {
        const scrollWidth = scrollContainerRef.current.scrollWidth;
        // Posiciona no início do Set 2 (o do meio)
        scrollContainerRef.current.scrollLeft = scrollWidth / 3;
    }
  }, [categoryVisuals]);

  // Lógica de Scroll Infinito "Teletransporte"
  const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      
      const container = scrollContainerRef.current;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const scrollPos = container.scrollLeft;
      
      const oneSetWidth = scrollWidth / 3;

      // Se chegarmos muito perto do início (Set 1), saltamos para o Set 2
      if (scrollPos < 50) {
          container.scrollLeft = scrollPos + oneSetWidth;
      }
      // Se chegarmos muito perto do fim (Set 3), saltamos para o Set 2
      else if (scrollPos >= (oneSetWidth * 2) - clientWidth) {
          container.scrollLeft = scrollPos - oneSetWidth;
      }
  };

  // Lógica de Scroll das Setas
  const scroll = (direction: 'left' | 'right') => {
      if (scrollContainerRef.current) {
          const { current } = scrollContainerRef;
          const scrollAmount = 300; 
          if (direction === 'left') {
              current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
          } else {
              current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
      }
  };

  // --- EVENTOS DO RATO PARA ARRASTAR (DRAG SCROLL) ---
  const handleMouseDown = (e: React.MouseEvent) => {
      if (!scrollContainerRef.current) return;
      isDown.current = true;
      isDragging.current = false;
      scrollContainerRef.current.classList.add('cursor-grabbing');
      scrollContainerRef.current.classList.remove('cursor-grab');
      startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
      scrollLeft.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
      if (!scrollContainerRef.current) return;
      isDown.current = false;
      scrollContainerRef.current.classList.remove('cursor-grabbing');
      scrollContainerRef.current.classList.add('cursor-grab');
  };

  const handleMouseUp = () => {
      if (!scrollContainerRef.current) return;
      isDown.current = false;
      scrollContainerRef.current.classList.remove('cursor-grabbing');
      scrollContainerRef.current.classList.add('cursor-grab');
      
      setTimeout(() => { isDragging.current = false; }, 50);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDown.current || !scrollContainerRef.current) return;
      e.preventDefault();
      
      const x = e.pageX - scrollContainerRef.current.offsetLeft;
      const walk = (x - startX.current) * 2; 
      
      if (Math.abs(x - startX.current) > 5) {
          isDragging.current = true;
      }
      
      scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleCategoryClick = (cat: string) => {
      if (isDragging.current) {
          return;
      }

      onCategoryChange(cat);
      setTimeout(() => {
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
  };

  // Click do Banner
  const handleBannerClick = (slide: any) => {
    if (slide.linkProductId) {
        window.location.hash = `#product/${slide.linkProductId}`;
    } else if (slide.category) {
        onCategoryChange(slide.category);
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    } else if (slide.action) {
        slide.action();
    }
  };

  return (
    <>
      {/* --- HERO BANNER (IMG TAG REAL - SEM OVERLAY) --- */}
      {/* Altura: 250px mobile, 450px desktop */}
      <section className="relative w-full h-[250px] md:h-[450px] overflow-hidden bg-gray-900 group shadow-lg">
        {slides.map((slide, index) => (
          <div 
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
             {/* IMAGEM REAL - SEM EFEITOS */}
             <img 
               src={slide.image} 
               alt={slide.title}
               className="absolute inset-0 w-full h-full object-cover transition-transform duration-[12000ms] ease-linear transform"
               style={{ 
                   transform: index === currentSlide ? 'scale(1.05)' : 'scale(1)'
                }} 
             />
             
             {/* Gradient Overlay removido para deixar imagem original. Apenas um gradiente muito subtil em baixo para os dots */}
             <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
             
             {/* Content */}
             <div className="relative z-20 container mx-auto px-6 h-full flex flex-col justify-center items-start text-white max-w-6xl">
                <div className="flex flex-col gap-3 md:gap-4 max-w-xl">
                    <span className="inline-block px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider w-fit border border-white/20 shadow-sm">
                        Destaque
                    </span>
                    <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {slide.title}
                    </h1>
                    <p className="text-sm md:text-xl text-white font-medium drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] max-w-lg">
                        {slide.subtitle}
                    </p>
                    <div className="mt-4">
                        <button 
                            onClick={() => handleBannerClick(slide)}
                            className="bg-white text-gray-900 hover:bg-gray-100 px-6 py-3 rounded-full font-bold text-sm md:text-base transition-all transform hover:scale-105 shadow-xl flex items-center gap-2 border border-gray-100"
                        >
                            {slide.cta} <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
             </div>
          </div>
        ))}

        {/* Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
            {slides.map((_, idx) => (
                <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 shadow-md ${idx === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/60 hover:bg-white'}`}
                />
            ))}
        </div>

        {/* Navigation Arrows */}
        <button 
            onClick={() => setCurrentSlide(curr => curr === 0 ? slides.length - 1 : curr - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/30 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/50 backdrop-blur-sm hidden md:block border border-white/10"
        >
            <ChevronLeft size={24} />
        </button>
        <button 
            onClick={() => setCurrentSlide(curr => curr === slides.length - 1 ? 0 : curr + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/30 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/50 backdrop-blur-sm hidden md:block border border-white/10"
        >
            <ChevronRight size={24} />
        </button>
      </section>

      {/* --- CATEGORY CAROUSEL --- */}
      <section className="pt-6 pb-2 bg-gray-50 relative group overflow-hidden select-none border-b border-gray-100">
        <div className="w-full relative">
            
            {/* Seta Esquerda */}
            <button 
                onClick={() => scroll('left')}
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white p-2 md:p-3 rounded-full shadow-lg text-gray-700 hover:text-primary transition-all md:opacity-0 md:group-hover:opacity-100 backdrop-blur-sm"
                aria-label="Anterior"
            >
                <ChevronLeft size={20} />
            </button>

            {/* Seta Direita */}
            <button 
                onClick={() => scroll('right')}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white p-2 md:p-3 rounded-full shadow-lg text-gray-700 hover:text-primary transition-all md:opacity-0 md:group-hover:opacity-100 backdrop-blur-sm"
                aria-label="Próximo"
            >
                <ChevronRight size={20} />
            </button>

            {/* Contentor com Infinite Loop & Drag */}
            <div 
                ref={scrollContainerRef}
                className="flex gap-4 md:gap-8 overflow-x-auto py-4 md:py-8 px-4 md:px-12 justify-start w-full cursor-grab active:cursor-grabbing no-scrollbar snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onScroll={handleScroll} 
            >
                <style>{`
                    .no-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .no-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}</style>

                {categoryVisuals.map((cat, idx) => (
                    <div 
                        key={idx}
                        onClick={(e) => {
                             e.preventDefault();
                             handleCategoryClick(cat.name);
                        }}
                        draggable={false} 
                        className="flex flex-col items-center gap-3 min-w-[100px] md:min-w-[140px] group/item flex-shrink-0 cursor-pointer transition-transform active:scale-95 snap-center"
                    >
                        <div className={`
                            w-20 h-20 md:w-32 md:h-32 rounded-full p-1 border-4 transition-all duration-300 overflow-hidden relative shadow-md bg-white pointer-events-none
                            ${selectedCategory === cat.name 
                                ? 'border-primary ring-4 ring-primary/20 scale-105 shadow-xl z-10' 
                                : 'border-white group-hover/item:border-primary group-hover/item:shadow-lg group-hover/item:scale-105'
                            }
                        `}>
                            <img 
                                src={cat.image} 
                                alt={cat.name} 
                                draggable={false}
                                className="w-full h-full object-cover rounded-full transition-transform duration-700 group-hover/item:scale-110 bg-gray-50 select-none"
                            />
                            {selectedCategory === cat.name && (
                                <div className="absolute inset-0 bg-primary/10 rounded-full mix-blend-overlay"></div>
                            )}
                        </div>
                        <span className={`text-xs md:text-base font-bold transition-colors text-center leading-tight px-1 whitespace-nowrap pointer-events-none select-none
                            ${selectedCategory === cat.name ? 'text-primary' : 'text-gray-600 group-hover/item:text-primary'}
                        `}>
                            {cat.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-4 bg-gray-50 border-b border-gray-200/50">
          <div className="container mx-auto px-2 md:px-4 max-w-4xl">
              <div className="grid grid-cols-3 gap-2 md:gap-6">
                  {/* Item 1 */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-lg cursor-default group">
                      <div className="bg-blue-100 p-1.5 md:p-2.5 rounded-full text-primary shrink-0 group-hover:scale-110 transition-transform">
                          <Star fill="currentColor" size={14} className="md:w-5 md:h-5" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-900 text-[10px] md:text-sm leading-tight">Qualidade</h3>
                          <p className="text-[9px] md:text-xs text-gray-500 hidden sm:block md:block">Garantida</p>
                      </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-lg cursor-default group">
                      <div className="bg-green-100 p-1.5 md:p-2.5 rounded-full text-green-600 shrink-0 group-hover:scale-110 transition-transform">
                          <Truck size={14} className="md:w-5 md:h-5" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-900 text-[10px] md:text-sm leading-tight">Envio Grátis</h3>
                          <p className="text-[9px] md:text-xs text-gray-500 block">acima de 50€</p>
                      </div>
                  </div>

                  {/* Item 3 */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-lg cursor-default group">
                      <div className="bg-purple-100 p-1.5 md:p-2.5 rounded-full text-purple-600 shrink-0 group-hover:scale-110 transition-transform">
                          <ShieldCheck size={14} className="md:w-5 md:h-5" />
                      </div>
                      <div>
                          <h3 className="font-bold text-gray-900 text-[10px] md:text-sm leading-tight">Segurança</h3>
                          <p className="text-[9px] md:text-xs text-gray-500 hidden sm:block md:block">100% Seguro</p>
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
