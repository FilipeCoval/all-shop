
import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductVariant } from '../types';
import { Plus, Eye, AlertTriangle, ArrowRight, Search, Heart, ArrowUpDown, LayoutGrid, List, ChevronLeft, ChevronRight, Zap, Flame, Sparkles, Star, CalendarClock, Loader2, Scale } from 'lucide-react';
import QuickViewModal from './QuickViewModal';

interface ProductListProps {
  products: Product[];
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  getStock: (productId: number, variant?: string) => number;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  searchTerm: string;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  processingProductIds?: number[];
  compareList: number[];
  onToggleCompare: (id: number) => void;
  onOpenComparator: () => void;
}

const ProductList: React.FC<ProductListProps> = ({ 
    products = [], 
    onAddToCart, 
    getStock, 
    wishlist = [], 
    onToggleWishlist, 
    searchTerm = '',
    selectedCategory,
    onCategoryChange,
    processingProductIds = [],
    compareList = [],
    onToggleCompare,
    onOpenComparator
}) => {
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc'>('default');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  
  // --- LÓGICA INTELIGENTE DE VISUALIZAÇÃO ---
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
      try {
          const savedMode = localStorage.getItem('view_mode_pref');
          if (savedMode === 'grid' || savedMode === 'list') return savedMode;
          // Deteção de Mobile vs Desktop
          return window.innerWidth < 768 ? 'list' : 'grid';
      } catch {
          return 'grid';
      }
  });

  useEffect(() => {
      localStorage.setItem('view_mode_pref', viewMode);
  }, [viewMode]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9; 

  const handleProductClick = (id: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = `product/${id}`;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, sortOption]);

  const categories = useMemo(() => {
    if (!products) return ['Todas'];
    const cats = products.map(p => p.category || 'Outros').filter(c => c);
    return ['Todas', ...new Set(cats)];
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
      if (!products) return [];
      
      // 1. Filtragem
      let result = products.filter(product => {
        const name = product.name || '';
        const description = product.description || '';
        const category = product.category || 'Outros';

        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Todas' || category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      // 2. Ordenação
      result.sort((a, b) => {
          // Helper para obter o menor preço (se tiver variantes)
          const getPrice = (p: Product) => p.variants && p.variants.length > 0 ? Math.min(...p.variants.map(v => v.price)) : p.price;

          if (sortOption === 'price-asc') {
              return getPrice(a) - getPrice(b);
          } else if (sortOption === 'price-desc') {
              return getPrice(b) - getPrice(a);
          } else {
              // --- ORDENAÇÃO PADRÃO (Stock > Novidade Tag > Recentes) ---
              
              const stockA = getStock(a.id);
              const stockB = getStock(b.id);
              
              // Define o que é "Visível/Prioritário": Tem Stock OU é infinito (999) OU está marcado como "Em Breve"
              const isAvailableA = stockA > 0 || stockA === 999 || a.comingSoon;
              const isAvailableB = stockB > 0 || stockB === 999 || b.comingSoon;

              // 1º Critério: Disponibilidade (Stock aparece antes de Esgotado)
              if (isAvailableA && !isAvailableB) return -1; // A sobe
              if (!isAvailableA && isAvailableB) return 1;  // B sobe

              // 2º Critério: Tag "NOVIDADE"
              // Se ambos têm a mesma disponibilidade, verifica a tag
              const isNovidadeA = a.badges?.includes('NOVIDADE');
              const isNovidadeB = b.badges?.includes('NOVIDADE');

              if (isNovidadeA && !isNovidadeB) return -1; // A (Novidade) sobe
              if (!isNovidadeA && isNovidadeB) return 1;  // B (Novidade) sobe

              // 3º Critério: ID Decrescente (Mais recentes/adicionados por último aparecem primeiro)
              return b.id - a.id;
          }
      });

      return result;
  }, [products, searchTerm, selectedCategory, sortOption, getStock]); // getStock é dependência para reagir a mudanças de inventário

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);
  const paginatedProducts = filteredAndSortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          setCurrentPage(newPage);
          document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
      }
  };

  const getProductBadge = (product: Product) => {
      if (product.comingSoon) return { text: 'EM BREVE', color: 'bg-purple-600', icon: <CalendarClock size={10} /> };
      if (product.promoEndsAt && new Date(product.promoEndsAt) > new Date()) return { text: 'PROMOÇÃO', color: 'bg-red-600', icon: <Zap size={10} /> };
      if (product.badges) {
          if (product.badges.includes('NOVIDADE')) return { text: 'NOVIDADE', color: 'bg-indigo-600', icon: <Sparkles size={10} /> };
          if (product.badges.includes('MAIS VENDIDO')) return { text: 'MAIS VENDIDO', color: 'bg-orange-500', icon: <Flame size={10} /> };
          if (product.badges.includes('PROMOÇÃO')) return { text: 'PROMOÇÃO', color: 'bg-red-600', icon: <Zap size={10} /> };
          if (product.badges.includes('ESSENCIAL')) return { text: 'ESSENCIAL', color: 'bg-blue-600', icon: <Star size={10} /> };
      }
      return null;
  };
  
  const getDisplayPrice = (product: Product) => {
      const hasVariants = product.variants && product.variants.length > 0;
      if (hasVariants && product.variants) {
          const minPrice = Math.min(...product.variants.map(v => v.price));
          return { price: minPrice, prefix: "A partir de" };
      }
      return { price: product.price, prefix: null };
  };

  return (
    <section id="products" className="pt-2 pb-12 bg-gray-50 dark:bg-[#020617] min-h-[600px] transition-colors duration-300">
      <div className="container mx-auto px-4">
        
        <div className="max-w-6xl mx-auto space-y-6 mb-8">
            {/* ... (Keep existing category filter UI) ... */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#0f172a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors">
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => onCategoryChange(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border
                                ${selectedCategory === cat 
                                    ? 'bg-primary text-white border-primary shadow-sm' 
                                    : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                                }
                            `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 border-t dark:border-slate-800 md:border-t-0 pt-4 md:pt-0 w-full md:w-auto justify-between md:justify-end">
                    <div className="relative group min-w-[180px]">
                        <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select 
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as any)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none cursor-pointer text-gray-700 dark:text-slate-200 font-medium"
                        >
                            <option value="default" className="dark:bg-slate-800">Relevância (Novidades)</option>
                            <option value="price-asc" className="dark:bg-slate-800">Preço: Menor para Maior</option>
                            <option value="price-desc" className="dark:bg-slate-800">Preço: Maior para Menor</option>
                        </select>
                    </div>

                    <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-slate-700">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`} title="Grelha"><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`} title="Lista"><List size={18} /></button>
                    </div>
                </div>
            </div>
        </div>

        {/* FLOATING COMPARATOR BUTTON */}
        {compareList.length > 0 && (
            <button 
                onClick={onOpenComparator}
                className="fixed bottom-6 left-6 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 animate-bounce-slow hover:scale-105 transition-transform border-2 border-white dark:border-gray-900"
            >
                <Scale size={20} />
                Comparar ({compareList.length})
            </button>
        )}

        {filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#0f172a] rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm max-w-4xl mx-auto transition-colors">
                <Search size={48} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sem resultados</h3>
                <p className="text-gray-500 dark:text-slate-400">Tente limpar os filtros ou ajustar a pesquisa.</p>
                <button onClick={() => { onCategoryChange('Todas'); setSortOption('default'); }} className="mt-4 text-primary font-bold hover:underline">Limpar filtros</button>
            </div>
        ) : (
            <div className={`max-w-6xl mx-auto transition-all duration-300 ${viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8' 
                : 'flex flex-col gap-4'
            }`}>
            {paginatedProducts.map((product) => {
                const stock = getStock(product.id);
                const isOutOfStock = stock <= 0 && stock !== 999 && !product.comingSoon;
                
                const promoEnded = product.promoEndsAt ? new Date(product.promoEndsAt) <= new Date() : false;
                const badge = !promoEnded ? getProductBadge(product) : null; // Don't show promo badge if ended

                // Calculate Display Price (Revert to original if promo ended)
                let displayPrice = product.price;
                let pricePrefix = null;
                
                const hasVariants = product.variants && product.variants.length > 0;
                
                if (promoEnded && product.originalPrice) {
                    displayPrice = product.originalPrice;
                } else if (hasVariants && product.variants) {
                    const minPrice = Math.min(...product.variants.map(v => v.price));
                    displayPrice = minPrice;
                    pricePrefix = "A partir de";
                }

                const isProcessing = processingProductIds.includes(product.id);
                const showPromo = !promoEnded && product.originalPrice && product.originalPrice > displayPrice;

                if (viewMode === 'list') {
                    return (
                        <div key={product.id} className="bg-white dark:bg-[#0f172a] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-slate-800 flex group animate-fade-in relative">
                            <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="w-32 sm:w-56 h-32 sm:h-auto bg-gray-50 dark:bg-slate-900 relative shrink-0 p-4 flex items-center justify-center">
                                <img src={product.image} alt={product.name} className={`max-w-full max-h-full object-contain ${isOutOfStock ? 'grayscale opacity-70' : ''}`} />
                                {isOutOfStock && <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">ESGOTADO</span>}
                                {badge && <span className={`absolute top-2 left-2 ${badge.color} text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm`}>{badge.icon}{badge.text}</span>}
                            </a>
                            <div className="flex-1 p-6 flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs font-bold text-primary uppercase tracking-wider">{product.category}</div>
                                        <div className="flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); onToggleCompare(product.id); }} className={`p-1.5 rounded-full transition-colors ${compareList.includes(product.id) ? 'bg-primary text-white' : 'text-gray-300 hover:text-primary dark:text-slate-500 dark:hover:text-primary'}`} title="Comparar">
                                                <Scale size={18} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }} className="text-gray-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-500">
                                                <Heart size={20} className={wishlist.includes(product.id) ? "fill-red-500 text-red-500" : ""} />
                                            </button>
                                        </div>
                                    </div>
                                    <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block hover:text-primary transition-colors">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{product.name}</h3>
                                    </a>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 mb-3">{product.description}</p>
                                </div>
                                <div className="flex flex-row sm:flex-col justify-between items-end sm:items-end gap-4 min-w-[140px] sm:border-l border-gray-100 dark:border-slate-800 sm:pl-6">
                                    <div className="text-right">
                                        {pricePrefix && <div className="text-xs text-gray-500 dark:text-slate-400">{pricePrefix}</div>}
                                        {showPromo && <div className="text-sm text-gray-400 line-through font-medium">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.originalPrice!)}</div>}
                                        <div className={`text-2xl font-bold ${showPromo ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(displayPrice)}</div>
                                    </div>
                                    {hasVariants ? (
                                        <button onClick={handleProductClick(product.id)} className="px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bg-secondary hover:bg-primary text-white"><Eye size={16} /> Ver Opções</button>
                                    ) : product.comingSoon ? (
                                        <button onClick={handleProductClick(product.id)} className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg text-sm font-bold transition-colors">Ver Detalhes</button>
                                    ) : (
                                        <button onClick={() => onAddToCart(product)} disabled={isOutOfStock || isProcessing} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${isOutOfStock ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 cursor-not-allowed' : 'bg-secondary hover:bg-primary text-white'}`}>
                                            {isProcessing ? <Loader2 size={16} className="animate-spin"/> : isOutOfStock ? 'Esgotado' : <><Plus size={16} /> Comprar</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                <div key={product.id} className="bg-white dark:bg-[#0f172a] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-slate-800 flex flex-col group relative animate-fade-in">
                    {badge && (
                        <div className={`absolute top-4 left-4 z-10 ${badge.color} text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1.5`}>
                            {badge.icon} {badge.text}
                        </div>
                    )}
                    
                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                        <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }} className="p-2 rounded-full bg-white/90 dark:bg-[#020617]/80 shadow-sm hover:scale-110 transition-all group/btn">
                            <Heart size={20} className={wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-slate-500 group-hover/btn:text-red-500'} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onToggleCompare(product.id); }} className={`p-2 rounded-full shadow-sm hover:scale-110 transition-all group/btn ${compareList.includes(product.id) ? 'bg-primary text-white' : 'bg-white/90 dark:bg-[#020617]/80 text-gray-400 dark:text-slate-500'}`} title="Comparar">
                            <Scale size={20} className={compareList.includes(product.id) ? 'text-white' : 'group-hover/btn:text-primary'} />
                        </button>
                    </div>

                    <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block relative h-64 overflow-hidden bg-gray-100 dark:bg-slate-900 group/image">
                        <img src={product.image} alt={product.name} className={`w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-70' : ''}`} />
                        
                        {/* Quick View Button - Visible on Hover */}
                        {!isOutOfStock && !product.comingSoon && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px]">
                                <button 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewProduct(product); }}
                                    className="bg-white text-gray-900 px-4 py-2 rounded-full font-bold shadow-lg transform translate-y-4 group-hover/image:translate-y-0 transition-all flex items-center gap-2 hover:bg-primary hover:text-white"
                                >
                                    <Eye size={16} /> Vista Rápida
                                </button>
                            </div>
                        )}

                        {isOutOfStock && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                                <span className="bg-red-600 text-white px-4 py-1 rounded text-sm font-bold uppercase transform -rotate-12 border border-white">Esgotado</span>
                            </div>
                        )}
                    </a>
                    
                    <div className="p-5 flex flex-col flex-grow">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">{product.category}</span>
                        </div>
                        <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block hover:text-primary transition-colors mb-2"><h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">{product.name}</h3></a>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 flex-grow line-clamp-2">{product.description}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-800">
                            <div>
                                {pricePrefix && <span className="text-xs text-gray-500 dark:text-slate-400 block">{pricePrefix}</span>}
                                {showPromo && <span className="text-xs text-gray-400 line-through font-medium block">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.originalPrice!)}</span>}
                                <span className={`text-2xl font-bold ${showPromo ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(displayPrice)}</span>
                                {product.comingSoon && <span className="text-xs text-purple-600 dark:text-purple-400 font-bold block uppercase">Em Breve</span>}
                            </div>
                            {hasVariants ? (
                                <button onClick={handleProductClick(product.id)} className="p-2.5 bg-secondary text-white hover:bg-primary rounded-full transition-colors shadow-md" title="Ver Opções"><Eye size={20} /></button>
                            ) : product.comingSoon ? (
                                <button onClick={handleProductClick(product.id)} className="p-2.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full" title="Ver Detalhes"><CalendarClock size={20} /></button>
                            ) : (
                                <button onClick={() => onAddToCart(product)} disabled={isOutOfStock || isProcessing} className={`p-2.5 rounded-full shadow-md active:scale-95 transition-all ${isOutOfStock ? 'bg-gray-200 dark:bg-slate-700 text-gray-400' : 'bg-secondary hover:bg-primary text-white'}`}>
                                    {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                );
            })}
            </div>
        )}

        {/* ... (Pagination controls remain the same) ... */}
        {filteredAndSortedProducts.length > itemsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-16 animate-fade-in-up">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"><ChevronLeft size={20} /></button>
                {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => handlePageChange(i + 1)} className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-md transform scale-105' : 'bg-white dark:bg-[#0f172a] text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>{i + 1}</button>
                ))}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"><ChevronRight size={20} /></button>
            </div>
        )}

        {/* Quick View Modal */}
        {quickViewProduct && (
            <QuickViewModal 
                product={quickViewProduct} 
                onClose={() => setQuickViewProduct(null)} 
                onAddToCart={onAddToCart} 
                getStock={getStock}
            />
        )}
      </div>
    </section>
  );
};

export default ProductList;

