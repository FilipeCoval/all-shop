

import React, { useState, useEffect } from 'react';
import { Product, Review, User, ProductVariant } from '../types';
import { ShoppingCart, ArrowLeft, Check, Share2, ShieldCheck, Truck, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';
import ReviewSection from './ReviewSection';

interface ProductDetailsProps {
  product: Product;
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  reviews: Review[];
  onAddReview: (review: Review) => void;
  currentUser: User | null;
  // Alteração: Agora recebe a função getStock em vez de um número fixo
  getStock: (productId: number, variant?: string) => number; 
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onAddToCart, reviews, onAddReview, currentUser, getStock }) => {
  // Determine the list of images to show (fallback to single image if array is missing)
  const galleryImages = product.images && product.images.length > 0 
    ? product.images 
    : [product.image];

  const [mainImage, setMainImage] = useState(galleryImages[0]);
  
  // State for Variants
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Reset main image and variant when product changes
  useEffect(() => {
    setMainImage(galleryImages[0]);
    // Selecionar a primeira variante por defeito se existirem
    if (product.variants && product.variants.length > 0) {
        setSelectedVariant(product.variants[0]);
    } else {
        setSelectedVariant(null);
    }
  }, [product]);

  // Effect to change main image when variant changes (if variant has specific image)
  useEffect(() => {
      if (selectedVariant && selectedVariant.image) {
          setMainImage(selectedVariant.image);
      }
  }, [selectedVariant]);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = '/';
  };

  // Calcular Stock dinâmico com base na variante selecionada
  const currentStock = getStock(product.id, selectedVariant?.name);

  const isOutOfStock = currentStock <= 0 && currentStock !== 999;
  const isLowStock = currentStock > 0 && currentStock <= 3 && currentStock !== 999;
  
  // Calculate current price based on variant
  const currentPrice = selectedVariant?.price ?? product.price;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 animate-fade-in">
      <a href="#/" onClick={handleBack} className="inline-flex items-center text-gray-500 hover:text-primary mb-6 transition-colors font-medium">
        <ArrowLeft size={20} className="mr-2" />
        Voltar para a loja
      </a>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Image Section */}
          <div className="bg-gray-100 p-8 flex flex-col items-center justify-center relative min-h-[400px]">
            <img 
              src={mainImage} 
              alt={product.name} 
              className={`w-full max-w-md object-contain mix-blend-multiply transition-all duration-500 mb-4 ${isOutOfStock ? 'grayscale opacity-60' : 'hover:scale-105'}`}
            />
            
            {isOutOfStock && (
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <span className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider shadow-2xl text-xl border-4 border-white transform -rotate-12">
                        Esgotado
                    </span>
                 </div>
            )}
            
            {/* Gallery Thumbnails */}
            {galleryImages.length > 1 && (
                <div className="flex gap-3 mt-4 overflow-x-auto pb-2 w-full justify-center">
                    {galleryImages.map((img, idx) => (
                        <button 
                            key={idx}
                            onClick={() => setMainImage(img)}
                            className={`w-16 h-16 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all ${mainImage === img ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-gray-300'}`}
                        >
                            <img src={img} alt={`${product.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
          </div>

          {/* Info Section */}
          <div className="p-8 md:p-12 flex flex-col justify-center">
            <div className="flex justify-between items-start mb-2">
              <span className="bg-blue-50 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {product.category}
              </span>
              
              {/* Stock Status Detail */}
              {currentStock !== 999 && (
                  <div className="text-sm font-medium">
                      {isOutOfStock ? (
                          <span className="text-red-600 flex items-center gap-1"><XCircle size={16}/> Indisponível</span>
                      ) : isLowStock ? (
                          <span className="text-orange-600 flex items-center gap-1 animate-pulse"><AlertTriangle size={16}/> Restam {currentStock} unidades</span>
                      ) : (
                          <span className="text-green-600 flex items-center gap-1"><Check size={16}/> Em Stock ({currentStock})</span>
                      )}
                  </div>
              )}
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{product.name}</h1>
            
            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl font-bold text-primary animate-fade-in">
                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice)}
              </span>
              <span className="text-sm text-gray-500 line-through">
                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice * 1.2)}
              </span>
            </div>

            <p className="text-gray-600 text-lg leading-relaxed mb-6">
              {product.description}
            </p>

            {/* VARIANT SELECTOR */}
            {product.variants && product.variants.length > 0 && (
                <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                        {product.variantLabel || "Escolha uma Opção"}:
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {product.variants.map((v, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedVariant(v)}
                                className={`px-4 py-2 rounded-lg font-medium border-2 transition-all flex items-center gap-2
                                    ${selectedVariant?.name === v.name 
                                        ? 'border-primary bg-white text-primary shadow-sm' 
                                        : 'border-transparent bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    }
                                `}
                            >
                                {v.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4 mb-8">
              <h3 className="font-bold text-gray-900">Destaques:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {product.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center text-gray-600 bg-gray-50 p-2 rounded-lg">
                    <Check size={18} className="text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-auto">
              <button 
                onClick={() => !isOutOfStock && onAddToCart(product, selectedVariant || undefined)}
                disabled={isOutOfStock}
                className={`flex-1 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95
                    ${isOutOfStock 
                        ? 'bg-gray-400 cursor-not-allowed hover:shadow-none' 
                        : 'bg-secondary hover:bg-primary hover:shadow-xl'
                    }
                `}
              >
                {isOutOfStock ? (
                    <>Esgotado</>
                ) : (
                    <>
                        <ShoppingCart size={24} />
                        Adicionar ao Carrinho
                    </>
                )}
              </button>
              <button className="sm:w-16 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-colors">
                <Share2 size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-100">
                <div className="flex items-center gap-3 text-gray-500 text-sm">
                    <ShieldCheck size={20} className="text-green-600" />
                    <span>Garantia de 2 Anos</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500 text-sm">
                    <Truck size={20} className="text-blue-600" />
                    <span>Entrega Rápida & Grátis</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Section */}
      <ReviewSection 
        productId={product.id}
        reviews={reviews}
        onAddReview={onAddReview}
        currentUser={currentUser}
      />
    </div>
  );
};

export default ProductDetails;
