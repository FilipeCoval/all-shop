import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductVariant } from '../types';
import { Plus, Eye, AlertTriangle, ArrowRight, Search, Heart, ArrowUpDown, LayoutGrid, List, ChevronLeft, ChevronRight, Zap, Flame, Sparkles, Star, CalendarClock } from 'lucide-react';

interface ProductListProps {
  products: Product[];
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  getStock: (productId: number) => number;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  searchTerm: string;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const ProductList: React.FC<ProductListProps> = ({ 
    products = [], 
    onAddToCart, 
    getStock, 
    wishlist = [], 
    onToggleWishlist, 
    searchTerm = '',
    selectedCategory,
    onCategoryChange
}) => {
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc'>('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
      let result = products.filter(product => {
        // FIX: Add null checks to prevent crashes if name or description are missing
        const name = product.name || '';
        const description = product.description || '';
        const category = product.category || 'Outros';

        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Todas' || category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      if (sortOption === 'price-asc') {
          result.sort((a, b) => a.price - b.price);
      } else if (sortOption === 'price-desc') {
          result.sort((a, b) => b.price - a.price);
      }
      return result;
  }, [products, searchTerm, selectedCategory, sortOption]);

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
      // Prioridade máxima para "Em Breve"
      if (product.comingSoon) return { text: 'EM BREVE', color: 'bg-purple-600', icon: <CalendarClock size={10} /> };
      
      if (product.id === 6) return { text: 'NOVIDADE', color: 'bg-indigo-600', icon: <Sparkles size={10} /> };
      if (product.id === 1 || product.id === 8) return { text: 'MAIS VENDIDO', color: 'bg-orange-500', icon: <Flame size={10} /> };
      if (product.id === 7) return { text: 'PROMOÇÃO', color: 'bg-red-600', icon: <Zap size={10} /> };
      if (product.category === 'Cabos' || product.category === 'Adaptadores') return { text: 'ESSENCIAL', color: 'bg-blue-600', icon: <Star size={10} /> };
      return null;
  };

  return (
    <section id="products" className="pt-2 pb-12 bg-gray-50 min-h-[600px]">
      <div className="container mx-auto px-4">
        
        <div className="max-w-6xl mx-auto space-y-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => onCategoryChange(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border
                                ${selectedCategory === cat 
                                    ? 'bg-primary text-white border-primary shadow-sm' 
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }
                            `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0 w-full md:w-auto justify-between md:justify-end">
                    <div className="relative group min-w-[180px]">
                        <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select 
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as any)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary outline-none cursor-pointer text-gray-700 font-medium"
                        >
                            <option value="default">Relevância</option>
                            <option value="price-asc">Preço: Menor para Maior</option>
                            <option value="price-desc">Preço: Maior para Menor</option>
                        </select>
                    </div>

                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Grelha"><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="Lista"><List size={18} /></button>
                    </div>
                </div>
            </div>
        </div>

        {filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm max-w-4xl mx-auto">
                <Search size={48} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900">Sem resultados</h3>
                <p className="text-gray-500">Tente limpar os filtros ou ajustar a pesquisa.</p>
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
                const badge = getProductBadge(product);

                if (viewMode === 'list') {
                    return (
                        <div key={product.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 flex group animate-fade-in relative">
                            <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="w-32 sm:w-56 h-32 sm:h-auto bg-gray-50 relative shrink-0 p-4 flex items-center justify-center">
                                <img src={product.image} alt={product.name} className={`max-w-full max-h-full object-contain ${isOutOfStock ? 'grayscale opacity-70' : ''}`} />
                                {isOutOfStock && <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">ESGOTADO</span>}
                                {badge && <span className={`absolute top-2 left-2 ${badge.color} text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 shadow-sm`}>{badge.icon}{badge.text}</span>}
                            </a>
                            <div className="flex-1 p-6 flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs font-bold text-primary uppercase tracking-wider">{product.category}</div>
                                        <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }} className="text-gray-300 hover:text-red-500">
                                            <Heart size={20} className={wishlist.includes(product.id) ? "fill-red-500 text-red-500" : ""} />
                                        </button>
                                    </div>
                                    <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block hover:text-primary transition-colors">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">{product.name}</h3>
                                    </a>
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{product.description}</p>
                                </div>
                                <div className="flex flex-row sm:flex-col justify-between items-end sm:items-end gap-4 min-w-[140px] sm:border-l border-gray-100 sm:pl-6">
                                    <div className="text-right"><div className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}</div></div>
                                    {product.comingSoon ? (
                                        <button onClick={handleProductClick(product.id)} className="px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-bold transition-colors">Ver Detalhes</button>
                                    ) : (
                                        <button onClick={() => !isOutOfStock && onAddToCart(product)} disabled={isOutOfStock} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${isOutOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-secondary hover:bg-primary text-white'}`}>{isOutOfStock ? 'Esgotado' : <><Plus size={16} /> Comprar</>}</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col group relative animate-fade-in">
                    {badge && (
                        <div className={`absolute top-4 left-4 z-10 ${badge.color} text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1.5`}>
                            {badge.icon} {badge.text}
                        </div>
                    )}
                    
                    <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 shadow-sm hover:scale-110 transition-all">
                        <Heart size={20} className={wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
                    </button>

                    <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block relative h-64 overflow-hidden bg-gray-100">
                        <img src={product.image} alt={product.name} className={`w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-70' : ''}`} />
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
                        <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block hover:text-primary transition-colors mb-2"><h3 className="text-lg font-bold text-gray-900 line-clamp-1">{product.name}</h3></a>
                        <p className="text-sm text-gray-500 mb-4 flex-grow line-clamp-2">{product.description}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <div>
                                <span className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}</span>
                                {product.comingSoon && <span className="text-xs text-purple-600 font-bold block uppercase">Em Breve</span>}
                            </div>
                            {product.comingSoon ? (
                                <button onClick={handleProductClick(product.id)} className="p-2.5 bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white rounded-full transition-colors"><ArrowRight size={20} /></button>
                            ) : (
                                <button onClick={() => !isOutOfStock && onAddToCart(product)} disabled={isOutOfStock} className={`p-2.5 rounded-full shadow-md active:scale-95 transition-all ${isOutOfStock ? 'bg-gray-200 text-gray-400' : 'bg-secondary hover:bg-primary text-white'}`}><Plus size={20} /></button>
                            )}
                        </div>
                    </div>
                </div>
                );
            })}
            </div>
        )}

        {filteredAndSortedProducts.length > itemsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-16 animate-fade-in-up">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={20} /></button>
                {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => handlePageChange(i + 1)} className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-md transform scale-105' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{i + 1}</button>
                ))}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={20} /></button>
            </div>
        )}
      </div>
    </section>
  );
};

export default ProductList;
