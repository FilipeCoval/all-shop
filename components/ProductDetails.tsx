import React, { useState, useEffect, useMemo } from 'react';
import { Product, Review, User, ProductVariant } from '../types';
import { ShoppingCart, ArrowLeft, Check, Share2, ShieldCheck, Truck, AlertTriangle, XCircle, Heart, ArrowRight, Eye, CreditCard } from 'lucide-react';
import ReviewSection from './ReviewSection';
import { PRODUCTS } from '../constants';

interface ProductDetailsProps {
  product: Product;
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  reviews: Review[];
  onAddReview: (review: Review) => void;
  currentUser: User | null;
  getStock: (productId: number, variant?: string) => number;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ 
  product, onAddToCart, reviews, onAddReview, currentUser, getStock, wishlist, onToggleWishlist 
}) => {
  const [selectedImage, setSelectedImage] = useState(product.image);
  const [selectedVariantName, setSelectedVariantName] = useState<string | undefined>(
    product.variants && product.variants.length > 0 ? product.variants[0].name : undefined
  );
  
  useEffect(() => {
    setSelectedImage(product.image);
    if (product.variants && product.variants.length > 0) {
        setSelectedVariantName(product.variants[0].name);
    } else {
        setSelectedVariantName(undefined);
    }
    window.scrollTo(0, 0);
  }, [product]);

  const uniqueImages = useMemo(() => {
    const imgs = new Set<string>();
    if (product.image) imgs.add(product.image);
    if (product.images) product.images.forEach(img => imgs.add(img));
    if (product.variants) product.variants.forEach(v => {
        if (v.image) imgs.add(v.image);
    });
    return Array.from(imgs);
  }, [product]);

  const selectedVariant = product.variants?.find(v => v.name === selectedVariantName);
  const currentPrice = selectedVariant?.price || product.price;
  const currentStock = getStock(product.id, selectedVariantName);
  const isOutOfStock = currentStock <= 0 && currentStock !== 999;
  const isLowStock = currentStock > 0 && currentStock <= 3 && currentStock !== 999;
  const isFavorite = wishlist.includes(product.id);

  const relatedProducts = PRODUCTS
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleVariantChange = (variant: ProductVariant) => {
      setSelectedVariantName(variant.name);
      if (variant.image) setSelectedImage(variant.image);
  };

  const handleAddToCart = () => {
      if (selectedVariant) onAddToCart(product, selectedVariant);
      else onAddToCart(product);
  };

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = '/';
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in pb-32 md:pb-8">
      <button onClick={handleBack} className="flex items-center gap-2 text-gray-500 hover:text-primary mb-8 font-medium transition-colors"><ArrowLeft size={20} /> Voltar à Loja</button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-4">
          <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative group">
            <img src={selectedImage} alt={product.name} className={`w-full h-full object-contain p-4 transition-all duration-300 ${isOutOfStock ? 'grayscale opacity-50' : ''}`} />
            {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center"><span className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-xl shadow-lg transform -rotate-12 border-4 border-white">ESGOTADO</span></div>}
            <button onClick={() => onToggleWishlist(product.id)} className="absolute top-4 right-4 p-3 bg-white/80 backdrop-blur rounded-full shadow-sm hover:scale-110 transition-transform text-gray-400 hover:text-red-500"><Heart size={24} className={isFavorite ? "fill-red-500 text-red-500" : ""} /></button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
             {uniqueImages.map((img, idx) => {
                 const variantName = product.variants?.find(v => v.image === img)?.name;
                 return (
                    <button key={idx} onClick={() => { setSelectedImage(img); if (variantName) setSelectedVariantName(variantName); }} className={`w-20 h-20 rounded-xl border-2 overflow-hidden flex-shrink-0 bg-white transition-all duration-200 ${selectedImage === img ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-gray-100 hover:border-gray-300'}`} title={variantName || `Imagem ${idx + 1}`}><img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-contain p-1" /></button>
                 );
             })}
          </div>
        </div>

        <div className="flex flex-col">
           <div className="flex items-start justify-between">
                <div>
                    <span className="text-sm font-bold text-primary tracking-wider uppercase">{product.category}</span>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4 leading-tight">{product.name}</h1>
                </div>
                <button className="p-2 text-gray-400 hover:text-primary transition-colors" title="Partilhar"><Share2 size={24} /></button>
           </div>

           <div className="flex items-end gap-3 mb-6">
               <span className="text-4xl font-bold text-gray-900">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice)}</span>
               {isOutOfStock && <span className="text-red-500 font-bold mb-2">Indisponível</span>}
           </div>

           {product.variants && product.variants.length > 0 && (
               <div className="mb-8">
                   <label className="block text-sm font-bold text-gray-700 mb-3">{product.variantLabel || 'Escolha uma opção:'}</label>
                   <div className="flex flex-wrap gap-3">
                       {product.variants.map((v) => {
                           const vStock = getStock(product.id, v.name);
                           const vOutOfStock = vStock <= 0 && vStock !== 999;
                           return (
                               <button key={v.name} onClick={() => !vOutOfStock && handleVariantChange(v)} disabled={vOutOfStock} className={`px-4 py-3 rounded-lg border-2 text-sm font-bold transition-all relative ${selectedVariantName === v.name ? 'border-primary bg-blue-50 text-primary' : vOutOfStock ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed decoration-slice line-through' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>{v.name}{v.price && v.price !== product.price && (<span className="block text-xs font-normal opacity-80">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v.price)}</span>)}{vOutOfStock && (<span className="absolute -top-2 -right-2 bg-red-100 text-red-600 text-[9px] px-1.5 py-0.5 rounded-full no-underline">Esgotado</span>)}</button>
                           );
                       })}
                   </div>
               </div>
           )}

           <div className="mb-8">
               {isOutOfStock ? (
                   <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100"><XCircle size={20} /><span className="font-bold">Esgotado Temporariamente</span></div>
               ) : (
                   <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg border border-green-100 w-fit">
                       <Check size={20} /><span className="font-bold">Em Stock</span>
                       {isLowStock && <span className="ml-2 text-orange-600 text-sm font-normal flex items-center gap-1"><AlertTriangle size={14} /> Restam apenas {currentStock} unidades</span>}
                   </div>
               )}
           </div>

           <div className="flex gap-4 mb-4">
               <button onClick={handleAddToCart} disabled={isOutOfStock} className={`flex-1 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 ${isOutOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-blue-600 text-white shadow-blue-500/30'}`}><ShoppingCart size={24} /> {isOutOfStock ? 'Indisponível' : 'Adicionar ao Carrinho'}</button>
               <button onClick={() => onToggleWishlist(product.id)} className={`px-6 rounded-xl border-2 flex items-center justify-center transition-colors ${isFavorite ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 hover:border-red-200 hover:text-red-500 text-gray-400'}`}><Heart size={28} className={isFavorite ? "fill-current" : ""} /></button>
           </div>

           {/* Pagamentos Aceites (Confiança - OTIMIZADOS PARA LEITURA) */}
           {!isOutOfStock && (
               <div className="mb-8 p-4 border border-gray-100 rounded-xl bg-gray-50 flex flex-col items-center gap-3 shadow-inner">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Pagamento 100% Seguro</p>
                   <div className="flex gap-3 items-center flex-wrap justify-center">
                        {/* Contentores uniformes: h-10 w-16 com preenchimento total da imagem */}
                        <div className="bg-white p-0.5 rounded-lg shadow-sm border border-gray-200 flex items-center justify-center h-10 w-16 overflow-hidden">
                            <img src="https://gestplus.pt/imgs/mbway.png" alt="MBWay" className="h-full w-full object-contain" />
                        </div>
                        <div className="bg-white p-0.5 rounded-lg shadow-sm border border-gray-200 flex items-center justify-center h-10 w-16 overflow-hidden">
                            <img src="https://tse2.mm.bing.net/th/id/OIP.pnNR_ET5AlZNDtMd2n1m5wHaHa?cb=ucfimg2&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3" alt="Multibanco" className="h-full w-full object-contain" />
                        </div>
                        <div className="bg-white p-0.5 rounded-lg shadow-sm border border-gray-200 flex items-center justify-center h-10 w-16 overflow-hidden">
                            <img src="https://tse1.mm.bing.net/th/id/OIP.ygZGQKeZ0aBwHS7e7wbJVgHaDA?cb=ucfimg2&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3" alt="Visa" className="h-full w-full object-contain" />
                        </div>
                        <div className="bg-white p-0.5 rounded-lg shadow-sm border border-gray-200 flex items-center justify-center h-10 w-16 overflow-hidden">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png" alt="Mastercard" className="h-full w-full object-contain" />
                        </div>
                   </div>
               </div>
           )}

           <div className="space-y-6 text-gray-600 leading-relaxed">
               <p className="text-lg">{product.description}</p>
               <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                   <h3 className="font-bold text-gray-900 mb-4">Destaques</h3>
                   <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">{product.features.map((feat, idx) => (<li key={idx} className="flex items-center gap-2 text-sm"><div className="w-1.5 h-1.5 bg-primary rounded-full"></div>{feat}</li>))}</ul>
               </div>
               <div className="flex flex-col sm:flex-row gap-6 pt-4 border-t border-gray-100 text-sm font-medium">
                   <div className="flex items-center gap-2 text-gray-500"><Truck size={20} className="text-primary" /> Entrega 1-3 dias (Grátis acima de 50€)</div>
                   <div className="flex items-center gap-2 text-gray-500"><ShieldCheck size={20} className="text-green-600" /> Garantia de 3 Anos</div>
               </div>
           </div>
        </div>
      </div>

      <ReviewSection productId={product.id} reviews={reviews} onAddReview={onAddReview} currentUser={currentUser} />

      {relatedProducts.length > 0 && (
          <div className="mt-20 border-t border-gray-100 pt-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Produtos Relacionados</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {relatedProducts.map(rel => (
                      <div key={rel.id} onClick={() => window.location.hash = `product/${rel.id}`} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer">
                          <div className="aspect-square bg-gray-100 relative overflow-hidden">
                              <img src={rel.image} alt={rel.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"><span className="bg-white text-gray-900 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-md"><Eye size={12} /> Ver</span></div>
                          </div>
                          <div className="p-4">
                              <h3 className="font-bold text-gray-900 text-sm line-clamp-2 group-hover:text-primary transition-colors">{rel.name}</h3>
                              <p className="text-primary font-bold mt-2">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(rel.price)}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-40 md:hidden shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] flex items-center justify-between animate-fade-in-up">
           <div className="flex flex-col">
              <span className="text-xs text-gray-500 line-clamp-1 max-w-[150px]">{product.name}</span>
              <span className="font-bold text-lg text-primary">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice)}</span>
           </div>
           <button onClick={handleAddToCart} disabled={isOutOfStock} className={`px-6 py-2.5 rounded-lg font-bold shadow-md transition-colors flex items-center gap-2 ${isOutOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-blue-600 text-white'}`}>{isOutOfStock ? 'Esgotado' : <><ShoppingCart size={18} /> Comprar</>}</button>
      </div>
    </div>
  );
};

export default ProductDetails;
