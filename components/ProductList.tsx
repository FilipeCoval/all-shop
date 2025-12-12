
import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductVariant } from '../types';
import { Plus, Eye, AlertTriangle, ArrowRight, Search, Heart, ArrowUpDown, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductListProps {
  products: Product[];
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  getStock: (productId: number) => number;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  searchTerm: string;
}

const ProductList: React.FC<ProductListProps> = ({ products, onAddToCart, getStock, wishlist, onToggleWishlist, searchTerm }) => {
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc'>('default');
  
  // NOVOS ESTADOS: Grelha vs Lista e Paginação
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9; 

  const handleProductClick = (id: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = `product/${id}`;
  };

  // Reset da página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, sortOption]);

  const categories = useMemo(() => {
    const cats = products.map(p => p.category);
    return ['Todas', ...new Set(cats)];
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
      let result = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              product.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Todas' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      if (sortOption === 'price-asc') {
          result.sort((a, b) => a.price - b.price);
      } else if (sortOption === 'price-desc') {
          result.sort((a, b) => b.price - a.price);
      }

      return result;
  }, [products, searchTerm, selectedCategory, sortOption]);

  // Lógica Paginação
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

  return (
    <section id="products" className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Nossos Produtos</h2>
          <p className="text-gray-600 text-sm max-w-2xl mx-auto mb-6">
            A melhor tecnologia selecionada para si.
          </p>

          <div className="max-w-6xl mx-auto space-y-4">
            
            {/* Toolbar: Filtros e Modos de Visualização */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border
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

                <div className="flex items-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto justify-between md:justify-end">
                    <div className="relative group min-w-[150px]">
                        <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select 
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as any)}
                            className="w-full pl-8 pr-4 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary outline-none cursor-pointer text-gray-700 font-medium"
                        >
                            <option value="default">Relevância</option>
                            <option value="price-asc">Preço: Menor para Maior</option>
                            <option value="price-desc">Preço: Maior para Menor</option>
                        </select>
                    </div>

                    {/* Botões Grid / List */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Grelha"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Lista"
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-between items-center px-2 text-xs text-gray-500">
                <span>
                    A mostrar <strong>{paginatedProducts.length}</strong> de <strong>{filteredAndSortedProducts.length}</strong>
                </span>
                {searchTerm && (
                    <span className="bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                        Pesquisa: "{searchTerm}"
                    </span>
                )}
            </div>
          </div>
        </div>

        {/* PRODUCTS AREA */}
        {filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm max-w-4xl mx-auto">
                <Search size={32} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900">Sem resultados</h3>
                <p className="text-gray-500 text-sm">Tente limpar os filtros.</p>
                <button onClick={() => { setSelectedCategory('Todas'); setSortOption('default'); }} className="mt-4 text-primary text-sm font-bold hover:underline">Limpar filtros</button>
            </div>
        ) : (
            <div className={`max-w-6xl mx-auto transition-all duration-300 ${viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' 
                : 'flex flex-col gap-3'
            }`}>
            {paginatedProducts.map((product) => {
                const stock = getStock(product.id);
                const isOutOfStock = stock <= 0 && stock !== 999;
                const isLowStock = stock > 0 && stock <= 3 && stock !== 999;
                const hasVariants = product.variants && product.variants.length > 0;
                const isFavorite = wishlist.includes(product.id);

                // --- MODO LISTA (Compacto) ---
                if (viewMode === 'list') {
                    return (
                        <div key={product.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 flex group animate-fade-in">
                            <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="w-32 sm:w-48 h-32 sm:h-auto bg-gray-50 relative shrink-0 p-2 flex items-center justify-center">
                                <img 
                                    src={product.image} 
                                    alt={product.name} 
                                    className={`max-w-full max-h-full object-contain ${isOutOfStock ? 'grayscale opacity-70' : ''}`}
                                />
                                {isOutOfStock && <span className="absolute top-1 left-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">ESGOTADO</span>}
                            </a>
                            
                            <div className="flex-1 p-4 flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] font-bold text-primary uppercase tracking-wider">{product.category}</div>
                                        <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }} className="text-gray-300 hover:text-red-500">
                                            <Heart size={16} className={isFavorite ? "fill-red-500 text-red-500" : ""} />
                                        </button>
                                    </div>
                                    <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block hover:text-primary transition-colors">
                                        <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-1">{product.name}</h3>
                                    </a>
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{product.description}</p>
                                    
                                    <div className="flex flex-wrap gap-1">
                                        {product.features.slice(0, 2).map((feat, idx) => (
                                            <span key={idx} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{feat}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-row sm:flex-col justify-between items-end sm:items-end gap-2 min-w-[120px] sm:border-l border-gray-100 sm:pl-4">
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-gray-900">
                                            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}
                                        </div>
                                    </div>

                                    {hasVariants ? (
                                        <button onClick={handleProductClick(product.id)} className="px-3 py-1.5 bg-white border border-primary text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-colors">
                                            Opções
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => !isOutOfStock && onAddToCart(product)}
                                            disabled={isOutOfStock}
                                            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1
                                                ${isOutOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-secondary hover:bg-primary text-white'}
                                            `}
                                        >
                                            {isOutOfStock ? 'Esgotado' : <><Plus size={14} /> Comprar</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                // --- MODO GRELHA (Clássico) ---
                return (
                <div key={product.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col group relative animate-fade-in">
                    <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }} className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 shadow-sm hover:scale-110 transition-all">
                        <Heart size={18} className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
                    </button>

                    <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block relative h-56 overflow-hidden bg-gray-200">
                        <img src={product.image} alt={product.name} className={`w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-70' : ''}`} />
                        {isOutOfStock && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                                <span className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold uppercase transform -rotate-12 border border-white">Esgotado</span>
                            </div>
                        )}
                        {!isOutOfStock && (
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="bg-white/90 text-gray-900 px-3 py-1.5 rounded-full font-medium text-xs shadow flex items-center gap-1"><Eye size={14} /> Ver</span>
                            </div>
                        )}
                    </a>
                    
                    <div className="p-4 flex flex-col flex-grow">
                        <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block hover:text-primary transition-colors">
                            <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-1">{product.name}</h3>
                        </a>
                        <p className="text-xs text-gray-500 mb-3 flex-grow line-clamp-2">{product.description}</p>
                        
                        <div className="mb-3 h-4">
                            {isLowStock ? <div className="text-[10px] font-bold text-orange-600 flex items-center gap-1"><AlertTriangle size={10} /> Últimas {stock} un!</div> : null}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                            <div>
                                <span className="text-xl font-bold text-primary">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}</span>
                                {hasVariants && <span className="text-[9px] text-gray-400 block -mt-1">a partir de</span>}
                            </div>
                            {hasVariants ? (
                                <button onClick={handleProductClick(product.id)} className="p-2 bg-white border border-secondary text-secondary hover:bg-secondary hover:text-white rounded-full transition-colors"><ArrowRight size={18} /></button>
                            ) : (
                                <button onClick={() => !isOutOfStock && onAddToCart(product)} disabled={isOutOfStock} className={`p-2 rounded-full shadow-md active:scale-95 ${isOutOfStock ? 'bg-gray-200 text-gray-400' : 'bg-secondary hover:bg-primary text-white'}`}><Plus size={18} /></button>
                            )}
                        </div>
                    </div>
                </div>
                );
            })}
            </div>
        )}

        {/* PAGINAÇÃO */}
        {filteredAndSortedProducts.length > itemsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-12 animate-fade-in-up">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={18} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                        pageNum = currentPage - 2 + i;
                        if (pageNum > totalPages) pageNum = pageNum - (pageNum - totalPages);
                    }
                    if (pageNum <= 0 || pageNum > totalPages) return null;
                    return (
                        <button key={pageNum} onClick={() => handlePageChange(pageNum)} className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === pageNum ? 'bg-primary text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{pageNum}</button>
                    );
                })}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={18} /></button>
            </div>
        )}
      </div>
    </section>
  );
};

export default ProductList;
