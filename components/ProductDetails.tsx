
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Review, User, ProductVariant } from '../types';
import { 
    ShoppingCart, ArrowLeft, Check, Share2, ShieldCheck, 
    Truck, AlertTriangle, XCircle, Heart, ArrowRight, 
    Eye, Info, X, CalendarClock, Copy, Mail, Loader2, CheckCircle
} from 'lucide-react';
import ReviewSection from './ReviewSection';
import { STORE_NAME, SHARE_URL } from '../constants';
import { db } from '../services/firebaseConfig';

interface ProductDetailsProps {
  product: Product;
  allProducts: Product[];
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  reviews: Review[];
  onAddReview: (review: Review) => void;
  currentUser: User | null;
  getStock: (productId: number, variant?: string) => number;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ 
  product, allProducts, onAddToCart, reviews, onAddReview, currentUser, getStock, wishlist, onToggleWishlist
}) => {
  const [selectedImage, setSelectedImage] = useState<string>(product.image);
  const [selectedVariantName, setSelectedVariantName] = useState<string | undefined>();
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    setSelectedVariantName(undefined);
    setSelectedImage(product.image);
    window.scrollTo(0, 0);
  }, [product]);

  const currentPrice = product.variants?.find(v => v.name === selectedVariantName)?.price || product.price;
  const isFavorite = wishlist.includes(product.id);

  const handleShare = async () => {
    const shareUrl = `${SHARE_URL}/p/${product.id}`;
    try {
        if (navigator.share) {
            await navigator.share({ title: product.name, url: shareUrl });
        } else {
            await navigator.clipboard.writeText(shareUrl);
            setShareFeedback('copied');
            setTimeout(() => setShareFeedback('idle'), 2000);
        }
    } catch (e) { console.warn(e); }
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in pb-20">
      <button onClick={() => window.location.hash = '/'} className="flex items-center gap-2 text-gray-500 hover:text-primary mb-6"><ArrowLeft size={18}/> Voltar</button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="bg-white rounded-2xl p-6 border flex items-center justify-center relative">
            <img src={selectedImage} alt={product.name} className="max-h-96 object-contain" />
            <button onClick={() => onToggleWishlist(product.id)} className="absolute top-4 right-4 p-3 bg-white shadow-md rounded-full"><Heart className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-300'}/></button>
        </div>
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <div className="text-4xl font-bold text-gray-900">{formatCurrency(currentPrice)}</div>
            
            {product.variants && product.variants.length > 0 && (
                <div className="space-y-3">
                    <p className="font-bold text-sm text-gray-700">Opções:</p>
                    <div className="flex flex-wrap gap-2">
                        {product.variants.map(v => (
                            <button key={v.name} onClick={() => { setSelectedVariantName(v.name); if(v.image) setSelectedImage(v.image); }} className={`px-4 py-2 border-2 rounded-lg font-bold text-sm ${selectedVariantName === v.name ? 'border-primary text-primary bg-blue-50' : 'border-gray-200'}`}>{v.name}</button>
                        ))}
                    </div>
                </div>
            )}

            <button 
                onClick={() => onAddToCart(product, product.variants?.find(v => v.name === selectedVariantName))} 
                className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
            >
                <ShoppingCart/> Adicionar ao Carrinho
            </button>

            <button onClick={handleShare} className="w-full border py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50">
                <Share2 size={18}/> {shareFeedback === 'copied' ? 'Link Copiado!' : 'Partilhar Produto'}
            </button>

            <div className="pt-6 border-t space-y-4">
                <p className="text-gray-600 leading-relaxed">{product.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-500">
                    <div className="flex items-center gap-2"><Truck size={18}/> Envio Rápido</div>
                    <div className="flex items-center gap-2"><ShieldCheck size={18}/> 3 Anos Garantia</div>
                </div>
            </div>
        </div>
      </div>
      <ReviewSection productId={product.id} reviews={reviews} onAddReview={onAddReview} currentUser={currentUser} />
    </div>
  );
};

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export default ProductDetails;

