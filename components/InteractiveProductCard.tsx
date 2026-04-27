
import React from 'react';
import { motion } from 'framer-motion';
import { Product } from '../types';
import { ShoppingCart, Eye, Heart, Scale, Plus, Loader2, Star } from 'lucide-react';

interface InteractiveProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  isProcessing: boolean;
  isOutOfStock: boolean;
  badge: any;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  compareList: number[];
  onToggleCompare: (id: number) => void;
  handleProductClick: (id: number) => (e: React.MouseEvent) => void;
  setQuickViewProduct: (product: Product) => void;
  displayPrice: number;
  pricePrefix: string | null;
  showPromo: boolean | number;
}

const InteractiveProductCard: React.FC<InteractiveProductCardProps> = ({
  product,
  onAddToCart,
  isProcessing,
  isOutOfStock,
  badge,
  wishlist,
  onToggleWishlist,
  compareList,
  onToggleCompare,
  handleProductClick,
  setQuickViewProduct,
  displayPrice,
  pricePrefix,
  showPromo
}) => {
  // Determine a color based on the product category or name
  const getBrandColor = () => {
    const name = product.name.toLowerCase();
    if (name.includes('xiaomi') || name.includes('box')) return 'bg-orange-500';
    if (name.includes('apple') || name.includes('iphone')) return 'bg-gray-800';
    if (name.includes('samsung')) return 'bg-blue-600';
    return 'bg-primary';
  };

  const brandColor = getBrandColor();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full h-[480px] lg:h-[450px] bg-white dark:bg-[#0f172a] rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-slate-800 group flex flex-col"
    >
      {/* Background Circle Animation (The "Pepsi" effect) - Only visible/animating on large screens */}
      <div
        className={`hidden lg:block absolute top-[-10%] left-[-10%] w-40 h-40 rounded-full z-0 opacity-10 group-hover:opacity-100 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[8] origin-center ${!product.cardHoverColor ? brandColor : ''}`}
        style={product.cardHoverColor ? { backgroundColor: product.cardHoverColor } : {}}
      />

      {/* Badges */}
      <div className="absolute top-6 left-6 z-20">
        {badge && (
          <div className={`${badge.color} text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5`}>
            {badge.icon} {badge.text}
          </div>
        )}
      </div>

      {/* Top Actions: Always visible on mobile, appear on hover on desktop */}
      <div className="absolute top-6 right-6 z-20 flex flex-col gap-3 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 lg:translate-x-4 lg:group-hover:translate-x-0">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }} 
          className="p-2.5 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg hover:scale-110 transition-all text-gray-400 hover:text-red-500"
        >
          <Heart size={20} className={wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : ''} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleCompare(product.id); }} 
          className={`p-2.5 rounded-full shadow-lg hover:scale-110 transition-all backdrop-blur-sm ${compareList.includes(product.id) ? 'bg-primary text-white' : 'bg-white/90 dark:bg-slate-800/90 text-gray-400 hover:text-primary'}`}
        >
          <Scale size={20} />
        </button>
      </div>

      {/* Product Image Container */}
      <div className="relative h-56 lg:h-64 flex items-center justify-center p-6 lg:p-8 z-10 transition-transform duration-500 lg:group-hover:scale-110 lg:group-hover:-rotate-6 lg:group-hover:-translate-y-4 lg:group-hover:translate-x-4">
        <img
          src={product.image}
          alt={product.name}
          className={`max-w-full max-h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.2)] ${isOutOfStock ? 'grayscale opacity-50' : ''}`}
        />
        
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <span className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-black uppercase transform -rotate-12 border-2 border-white shadow-2xl">Esgotado</span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="px-6 lg:px-8 pb-6 lg:pb-8 relative z-10 flex flex-col flex-1 transition-transform duration-500 lg:group-hover:-translate-y-4">
        <div>
          <span className="text-[10px] font-black text-primary lg:group-hover:text-white/80 uppercase tracking-[0.2em] mb-1 block transition-colors">
            {product.category}
          </span>
          <a href={`#product/${product.id}`} onClick={handleProductClick(product.id)}>
            <h3 className="text-xl lg:text-2xl font-black text-gray-900 dark:text-white lg:group-hover:text-white mb-2 line-clamp-2 lg:line-clamp-1 transition-colors">
              {product.name}
            </h3>
          </a>
          <p className="text-sm text-gray-500 dark:text-slate-400 lg:group-hover:text-white/70 line-clamp-2 mb-4 transition-colors">
            {product.description}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between">
          <div className="flex flex-col">
            {showPromo && (
              <span className="text-sm text-gray-400 lg:group-hover:text-white/50 line-through font-bold transition-colors">
                {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.originalPrice!)}
              </span>
            )}
            <span className={`text-2xl lg:text-3xl font-black ${showPromo ? 'text-red-600 lg:group-hover:text-white' : 'text-gray-900 dark:text-white lg:group-hover:text-white'} transition-colors`}>
              {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(displayPrice)}
            </span>
            <span className="text-xs text-gray-500 lg:group-hover:text-white/60 font-medium mt-1 transition-colors">
              {product.stock > 0 ? `${product.stock} disponíveis` : 'Esgotado'}
            </span>
          </div>

          <div className="hidden lg:flex gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 lg:translate-y-4 lg:group-hover:translate-y-0">
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewProduct(product); }}
              className="p-3 bg-white/20 hover:bg-white/40 text-white rounded-2xl backdrop-blur-md transition-all border border-white/30"
              title="Vista Rápida"
            >
              <Eye size={24} />
            </button>
            <button 
              onClick={() => onAddToCart(product)} 
              disabled={isOutOfStock || isProcessing}
              className={`p-3 rounded-2xl shadow-xl active:scale-95 transition-all ${isOutOfStock ? 'bg-gray-200 text-gray-400' : 'bg-white text-primary hover:bg-gray-100'}`}
            >
              {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
            </button>
          </div>
        </div>
        
        {/* Mobile Buy Button - hidden on desktop, visible on mobile */}
        <div className="mt-4 lg:hidden w-full flex gap-2">
          <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewProduct(product); }}
              className="px-4 py-3 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Eye size={20} />
          </button>
          <button 
            onClick={() => onAddToCart(product)} 
            disabled={isOutOfStock || isProcessing}
            className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl font-bold transition-all ${isOutOfStock ? 'bg-gray-200 text-gray-400' : 'bg-primary text-white hover:bg-primary/90'}`}
          >
            {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <><ShoppingCart size={18} /> Adicionar</>}
          </button>
        </div>
      </div>

      {/* "Shop Now" Style Button - Desktop only overlay on hover */}
      <div
        className="hidden lg:block absolute bottom-8 left-8 z-20 pointer-events-none opacity-0 translate-y-10 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-100"
      >
        <button 
          onClick={handleProductClick(product.id)}
          className="bg-white text-gray-900 px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl pointer-events-auto hover:bg-gray-100 transition-colors"
        >
          Ver Detalhes
        </button>
      </div>
    </motion.div>
  );
};

export default InteractiveProductCard;
