import React from 'react';
import { Product } from '../types';
import { X, Check, Minus, ShoppingCart, Trash2 } from 'lucide-react';

interface ProductComparatorProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onAddToCart: (product: Product) => void;
    onRemoveProduct: (productId: number) => void;
}

const ProductComparator: React.FC<ProductComparatorProps> = ({ isOpen, onClose, products, onAddToCart, onRemoveProduct }) => {
    if (!isOpen) return null;

    if (products.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Comparador Vazio</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Selecione produtos na loja para comparar as suas características.</p>
                    <button onClick={onClose} className="bg-primary text-white px-6 py-2 rounded-xl font-bold">Voltar à Loja</button>
                </div>
            </div>
        );
    }

    // Extract all unique specs keys from all products
    const allSpecs = Array.from(new Set(products.flatMap(p => p.specs ? Object.keys(p.specs) : [])));

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 overflow-y-auto animate-fade-in flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center z-10">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    Comparar Produtos <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">{products.length} itens</span>
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Comparison Table */}
            <div className="flex-1 overflow-x-auto p-4 md:p-8">
                <div className="min-w-[800px] mx-auto max-w-7xl">
                    <div className="grid" style={{ gridTemplateColumns: `200px repeat(${products.length}, minmax(250px, 1fr))` }}>
                        
                        {/* Row: Product Info (Image, Name, Price, Actions) */}
                        <div className="p-4 font-bold text-gray-400 dark:text-gray-500 flex items-end pb-8 border-b border-gray-100 dark:border-gray-800">Produto</div>
                        {products.map(product => (
                            <div key={product.id} className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-4 relative group">
                                <button 
                                    onClick={() => onRemoveProduct(product.id)}
                                    className="absolute top-2 right-2 p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remover da comparação"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="h-40 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                                    <img src={product.image} alt={product.name} className="max-h-full max-w-full object-contain" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2 h-14">{product.name}</h3>
                                    <p className="text-2xl font-bold text-primary mt-2">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}</p>
                                </div>
                                <button 
                                    onClick={() => onAddToCart(product)}
                                    className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg"
                                >
                                    <ShoppingCart size={18} /> Adicionar
                                </button>
                            </div>
                        ))}

                        {/* Row: Description */}
                        <div className="p-4 font-bold text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">Descrição</div>
                        {products.map(product => (
                            <div key={product.id} className="p-4 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                                {product.description}
                            </div>
                        ))}

                        {/* Row: Category */}
                        <div className="p-4 font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">Categoria</div>
                        {products.map(product => (
                            <div key={product.id} className="p-4 text-sm font-medium text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800">
                                {product.category}
                            </div>
                        ))}

                        {/* Dynamic Specs Rows */}
                        {allSpecs.map(specKey => (
                            <React.Fragment key={specKey}>
                                <div className="p-4 font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 capitalize bg-gray-50/30 dark:bg-gray-800/30">
                                    {specKey.replace(/([A-Z])/g, ' $1').trim()}
                                </div>
                                {products.map(product => (
                                    <div key={product.id} className="p-4 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/30 flex items-center">
                                        {product.specs && product.specs[specKey] ? (
                                            product.specs[specKey] === true ? <Check size={18} className="text-green-500"/> : 
                                            product.specs[specKey] === false ? <Minus size={18} className="text-gray-300"/> :
                                            product.specs[specKey]
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductComparator;
