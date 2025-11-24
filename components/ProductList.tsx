import React from 'react';
import { Product } from '../types';
import { Plus, Eye } from 'lucide-react';

interface ProductListProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, onAddToCart }) => {
  const handleProductClick = (id: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = `product/${id}`;
  };

  return (
    <section id="products" className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Nossos Produtos</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            A melhor tecnologia selecionada para si. Encontre o que precisa com o melhor preço do mercado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col group">
              <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block relative h-64 overflow-hidden bg-gray-200 cursor-pointer">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-gray-700">
                  {product.category}
                </div>
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-white/90 text-gray-900 px-4 py-2 rounded-full font-medium text-sm shadow-lg flex items-center gap-2">
                        <Eye size={16} /> Ver Detalhes
                    </span>
                </div>
              </a>
              
              <div className="p-6 flex flex-col flex-grow">
                <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)} className="block hover:text-primary transition-colors">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{product.name}</h3>
                </a>
                <p className="text-sm text-gray-500 mb-4 flex-grow line-clamp-3">{product.description}</p>
                
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {product.features.slice(0, 2).map((feat, idx) => (
                        <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                            {feat}
                        </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-2xl font-bold text-primary">
                      {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}
                    </span>
                    <button 
                      onClick={() => onAddToCart(product)}
                      className="bg-secondary hover:bg-primary text-white p-3 rounded-full transition-colors flex items-center justify-center shadow-lg active:scale-95"
                      aria-label="Adicionar ao carrinho"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductList;