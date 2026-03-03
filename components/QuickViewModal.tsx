import React, { useState, useEffect } from 'react';
import { Product, ProductVariant } from '../types';
import { X, ShoppingCart } from 'lucide-react';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  getStock: (productId: number, variant?: string) => number;
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({ product, onClose, onAddToCart, getStock }) => {
  const [selectedVariantName, setSelectedVariantName] = useState<string | undefined>();
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    if (product) {
      setSelectedVariantName(undefined);
      setSelectedImage(product.image);
    }
  }, [product]);

  if (!product) return null;

  const selectedVariant = product.variants?.find(v => v.name === selectedVariantName);
  const currentPrice = selectedVariant?.price || product.price;
  const currentStock = getStock(product.id, selectedVariantName);
  const isOutOfStock = currentStock <= 0 && currentStock !== 999 && !product.comingSoon;
  const hasVariants = product.variants && product.variants.length > 0;
  const isVariantSelected = !!selectedVariantName;

  const handleAddToCart = () => {
      if (isOutOfStock || (hasVariants && !isVariantSelected)) return;
      if (selectedVariant) onAddToCart(product, selectedVariant);
      else onAddToCart(product);
      onClose();
  };

  const handleVariantChange = (variant: ProductVariant) => {
      setSelectedVariantName(variant.name);
      if (variant.image) setSelectedImage(variant.image);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[600px] border border-gray-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        
        {/* Image Section */}
        <div className="w-full md:w-1/2 bg-gray-50 dark:bg-slate-900 p-8 flex items-center justify-center relative">
            <img src={selectedImage} alt={product.name} className="max-w-full max-h-[300px] md:max-h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
            {isOutOfStock && <span className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">ESGOTADO</span>}
        </div>

        {/* Details Section */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">{product.category}</span>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-1 leading-tight">{product.name}</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-slate-400 transition-colors">
                    <X size={24} />
                </button>
            </div>

            <p className="text-gray-600 dark:text-slate-300 text-sm mb-6 line-clamp-3">{product.description}</p>

            <div className="mt-auto">
                <div className="flex items-baseline gap-3 mb-6">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice)}</span>
                    {product.originalPrice && product.originalPrice > currentPrice && (
                        <span className="text-lg text-gray-400 line-through">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.originalPrice)}</span>
                    )}
                </div>

                {hasVariants && (
                   <div className="mb-6">
                       <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Opções:</label>
                       <div className="flex flex-wrap gap-2">
                           {product.variants?.map((v) => {
                               const variantStock = getStock(product.id, v.name);
                               const isSoldOut = variantStock <= 0 && variantStock !== 999;
                               return (
                                   <button 
                                       key={v.name} 
                                       onClick={() => !isSoldOut && handleVariantChange(v)}
                                       disabled={isSoldOut}
                                       className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all
                                           ${selectedVariantName === v.name 
                                               ? 'border-primary bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-300' 
                                               : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300'}
                                           ${isSoldOut ? 'opacity-50 cursor-not-allowed line-through' : 'hover:border-gray-300 dark:hover:border-slate-600'}
                                       `}
                                   >
                                       {v.name}
                                   </button>
                               );
                           })}
                       </div>
                   </div>
                )}

                <button 
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || (hasVariants && !isVariantSelected)}
                    className={`w-full py-3 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95
                        ${isOutOfStock || (hasVariants && !isVariantSelected)
                            ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 cursor-not-allowed' 
                            : 'bg-primary hover:bg-blue-600 text-white'}
                    `}
                >
                    <ShoppingCart size={20} />
                    {isOutOfStock ? 'Indisponível' : 'Adicionar ao Carrinho'}
                </button>
                
                <a href={`#product/${product.id}`} onClick={onClose} className="block text-center mt-4 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors">
                    Ver detalhes completos
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;
