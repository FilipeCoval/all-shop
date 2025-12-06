
import React, { useState, useMemo } from 'react';
import { Product, ProductVariant } from '../types';
import { Plus, Eye, AlertTriangle, ArrowRight, Search, Heart, ArrowUpDown } from 'lucide-react';

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

  const handleProductClick = (id: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = `product/${id}`;
  };

  // Extrair categorias únicas dos produtos
  const categories = useMemo(() => {
    const cats = products.map(p => p.category);
    return ['Todas', ...new Set(cats)];
  }, [products]);

  // Filtrar e Ordenar produtos
  const filteredAndSortedProducts = useMemo(() => {
      let result = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              product.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Todas' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      // Ordenação
      if (sortOption === 'price-asc') {
          result.sort((a, b) => a.price - b.price);
      } else if (sortOption === 'price-desc') {
          result.sort((a, b) => b.price - a.price);
      }

      return result;
  }, [products, searchTerm, selectedCategory, sortOption]);

  return (
    <section id="products" className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Nossos Produtos</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            A melhor tecnologia selecionada para si. Encontre o que precisa com o melhor preço do mercado.
          </p>

          {/* FILTERS CONTAINER */}
          <div className="max-w-4xl mx-auto space-y-6">
            
            <div className="flex flex-col md:flex-row justify-center items-center gap-4">
                {/* Category Pills */}
                <div className="flex flex-wrap justify-center gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 border
                                ${selectedCategory === cat 
                                    ? 'bg-primary text-white border-primary shadow-md transform scale-105' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                }
                            `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Sort Dropdown */}
                <div className="relative group">
                    <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select 
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value as any)}
                        className="pl-9 pr-8 py-2 border border-gray-200 rounded-full text-sm bg-white focus:ring-2 focus:ring-primary outline-none cursor-pointer hover:border-gray-300 appearance-none text-gray-700 font-medium shadow-sm"
                    >
                        <option value="default">Relevância</option>
                        <option value="price-asc">Preço: Menor para Maior</option>
                        <option value="price-desc">Preço: Maior para Menor</option>
                    </select>
                </div>
            </div>
            
            {/* Active Filters Display */}
            {searchTerm && (
                <div className="flex justify-center items-center gap-2 animate-fade-in">
                    <span className="text-sm text-gray-500">Resultados para: <strong className="text-gray-900">"{searchTerm}"</strong></span>
                </div>
            )}
          </div>
        </div>

        {/* RESULTS GRID */}
        {filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-16">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={32} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                <p className="text-gray-500">
                    Não encontrámos nada para "{searchTerm}" na categoria "{selectedCategory}".
                </p>
                <button 
                    onClick={() => { setSelectedCategory('Todas'); setSortOption('default'); }}
                    className="mt-6 text-primary font-bold hover:underline"
                >
                    Limpar filtros
                </button>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAndSortedProducts.map((product) => {
                const stock = getStock(product.id);
                const isOutOfStock = stock <= 0 && stock !== 999;
                const isLowStock = stock > 0 && stock <= 3 && stock !== 999;
                const hasVariants = product.variants && product.variants.length > 0;
                const isFavorite = wishlist.includes(product.id);

                return (
                <div key={product.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col group relative animate-fade-in">
                    
                    {/* Wishlist Button */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }}
                        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:scale-110 transition-all group/heart"
                    >
                        <Heart 
                            size={20} 
                            className={`transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 group-hover/heart:text-red-400'}`} 
                        />
                    </button>

                    <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block relative h-64 overflow-hidden bg-gray-200 cursor-pointer">
                    <img 
                        src={product.image} 
                        alt={product.name} 
                        className={`w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-70' : ''}`}
                    />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-gray-700">
                        {product.category}
                    </div>
                    
                    {/* Stock Badges */}
                    {isOutOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                            <span className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider shadow-lg transform -rotate-12 border-2 border-white">
                                Esgotado
                            </span>
                        </div>
                    )}

                    {!isOutOfStock && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="bg-white/90 text-gray-900 px-4 py-2 rounded-full font-medium text-sm shadow-lg flex items-center gap-2">
                                <Eye size={16} /> Ver Detalhes
                            </span>
                        </div>
                    )}
                    </a>
                    
                    <div className="p-6 flex flex-col flex-grow">
                    <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block hover:text-primary transition-colors">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{product.name}</h3>
                    </a>
                    <p className="text-sm text-gray-500 mb-4 flex-grow line-clamp-3">{product.description}</p>
                    
                    {/* Stock Indicator */}
                    <div className="mb-4 h-6">
                        {isLowStock ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600 animate-pulse">
                                <AlertTriangle size={14} /> Últimas {stock} unidades!
                            </div>
                        ) : stock === 999 ? (
                            <div className="h-2 w-20 bg-gray-200 rounded animate-pulse"></div> // Loading
                        ) : !isOutOfStock ? (
                            <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span> Em Stock
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                        {product.features.slice(0, 2).map((feat, idx) => (
                            <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                                {feat}
                            </span>
                        ))}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-primary">
                            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}
                            </span>
                            {hasVariants && <span className="text-[10px] text-gray-400">a partir de</span>}
                        </div>

                        {hasVariants ? (
                            <button 
                                onClick={handleProductClick(product.id)}
                                className="p-3 bg-white border border-secondary text-secondary hover:bg-secondary hover:text-white rounded-full transition-colors flex items-center justify-center shadow-sm active:scale-95 group"
                                aria-label="Ver opções"
                                title="Ver Opções"
                            >
                                <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        ) : (
                            <button 
                                onClick={() => !isOutOfStock && onAddToCart(product)}
                                disabled={isOutOfStock}
                                className={`p-3 rounded-full transition-colors flex items-center justify-center shadow-lg active:scale-95
                                ${isOutOfStock 
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                                        : 'bg-secondary hover:bg-primary text-white cursor-pointer'
                                }
                                `}
                                aria-label="Adicionar ao carrinho"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                        </div>
                    </div>
                    </div>
                </div>
                );
            })}
            </div>
        )}
      </div>
    </section>
  );
};

export default ProductList;
