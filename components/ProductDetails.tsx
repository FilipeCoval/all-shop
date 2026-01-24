import React, { useState, useEffect, useMemo } from 'react';
import { Product, Review, User, ProductVariant } from '../types';
import { 
    ShoppingCart, ArrowLeft, Check, Share2, ShieldCheck, 
    Truck, AlertTriangle, XCircle, Heart, ArrowRight, 
    Eye, Info, X, CalendarClock, Copy, Mail, Loader2, CheckCircle
} from 'lucide-react';
import ReviewSection from './ReviewSection';
import { STORE_NAME, PUBLIC_URL } from '../constants';
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
  const [selectedImage, setSelectedImage] = useState(product.image);
  const [selectedVariantName, setSelectedVariantName] = useState<string | undefined>(
    product.variants && product.variants.length > 0 ? product.variants[0].name : undefined
  );
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied' | 'shared'>('idle');
  
  const [alertEmail, setAlertEmail] = useState(currentUser?.email || '');
  const [alertStatus, setAlertStatus] = useState<'idle' | 'loading' | 'success'>('idle');


  useEffect(() => {
    setSelectedImage(product.image);
    if (product.variants && product.variants.length > 0) {
        setSelectedVariantName(product.variants[0].name);
    } else {
        setSelectedVariantName(undefined);
    }
    setAlertStatus('idle');
    setAlertEmail(currentUser?.email || '');
    window.scrollTo(0, 0);

    // --- SEO & TAB TITLE UPDATE ---
    document.title = `${product.name} | ${STORE_NAME}`;
    
    // Reset title on unmount
    return () => {
        document.title = STORE_NAME;
    };
  }, [product, currentUser]);

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
  const isUnavailable = isOutOfStock || !!product.comingSoon;
  const isLowStock = currentStock > 0 && currentStock <= 3 && currentStock !== 999 && !product.comingSoon;
  const isFavorite = wishlist.includes(product.id);

  const relatedProducts = (allProducts || [])
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleVariantChange = (variant: ProductVariant) => {
      setSelectedVariantName(variant.name);
      if (variant.image) setSelectedImage(variant.image);
  };

  const handleAddToCart = () => {
      if (isUnavailable) return;
      if (selectedVariant) onAddToCart(product, selectedVariant);
      else onAddToCart(product);
  };

  const handleShare = async () => {
    // --- LÓGICA DE PARTILHA DEFINITIVA ---
    // Em vez de usar um link "bonito" (/product/id) que depende de reescrita,
    // usamos um link DIRETO para a função que gera a pré-visualização.
    // Isto é mais robusto e garante que o bot do WhatsApp/Facebook vê sempre os dados corretos.
    const shareUrl = `${PUBLIC_URL}/api/og?id=${product.id}`;
    
    // Dados para partilha nativa (Mobile)
    const shareData: ShareData = {
      title: product.name,
      text: `Olha o que encontrei na ${STORE_NAME} por apenas ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice)}!`,
      url: shareUrl, 
    };

    try {
      // Tentar Web Share API (Menu Nativo do Android/iOS)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        setShareFeedback('shared');
      } else {
        throw new Error("Web Share API unavailable");
      }
    } catch (err) {
      // Fallback: Copiar link direto
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('copied');
      } catch (clipboardErr) {
        console.warn("Share fallback failed", clipboardErr);
        prompt("Copie o link:", shareUrl);
      }
    }

    setTimeout(() => setShareFeedback('idle'), 3000);
  };

  const handleStockAlertSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!alertEmail) return;
      setAlertStatus('loading');
      try {
          await db.collection('stock_alerts').add({
              email: alertEmail,
              productId: product.id,
              productName: product.name,
              variantName: selectedVariantName || null,
              date: new Date().toISOString()
          });
          setAlertStatus('success');
      } catch (error) {
          console.error("Erro ao subscrever alerta de stock:", error);
          setAlertStatus('idle'); // Permite tentar de novo
      }
  };


  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in pb-32 md:pb-8">
      <a 
        href="#/" 
        onClick={(e) => { e.preventDefault(); window.location.hash = '/'; }}
        className="flex items-center gap-2 text-gray-500 hover:text-primary mb-8 font-medium transition-colors"
      >
        <ArrowLeft size={20} /> Voltar à Loja
      </a>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-4">
          <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative group">
            <img 
                src={selectedImage} 
                alt={product.name} 
                className={`w-full h-full object-contain p-4 transition-all duration-300 ${isUnavailable ? 'grayscale opacity-50' : ''}`} 
            />
            {isOutOfStock && !product.comingSoon && <div className="absolute inset-0 flex items-center justify-center"><span className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-xl shadow-lg transform -rotate-12 border-4 border-white">ESGOTADO</span></div>}
            {product.comingSoon && <div className="absolute inset-0 flex items-center justify-center bg-purple-900/10"><span className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold text-xl shadow-lg transform rotate-3 border-4 border-white">EM BREVE</span></div>}
            <button onClick={() => onToggleWishlist(product.id)} className="absolute top-4 right-4 p-3 bg-white/80 backdrop-blur rounded-full shadow-sm hover:scale-110 transition-transform text-gray-400 hover:text-red-500"><Heart size={24} className={isFavorite ? "fill-red-500 text-red-500" : ""} /></button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
             {uniqueImages.map((img, idx) => (
                <button key={idx} onClick={() => setSelectedImage(img)} className={`w-20 h-20 rounded-xl border-2 overflow-hidden flex-shrink-0 bg-white transition-all duration-200 ${selectedImage === img ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-gray-100 hover:border-gray-300'}`}><img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-contain p-1" /></button>
             ))}
          </div>
        </div>

        <div className="flex flex-col">
           <div className="flex items-start justify-between">
                <div>
                    <span className="text-sm font-bold text-primary tracking-wider uppercase">{product.category}</span>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4 leading-tight">{product.name}</h1>
                </div>
                <button 
                    onClick={handleShare} 
                    className={`p-3 rounded-full transition-all flex items-center justify-center
                        ${shareFeedback === 'idle' ? 'bg-gray-50 text-gray-400 hover:text-primary' : 
                          shareFeedback === 'copied' ? 'bg-green-100 text-green-600' : 
                          'bg-blue-100 text-blue-600'}
                    `}
                    title={shareFeedback === 'copied' ? 'Link Copiado' : 'Partilhar'}
                >
                    {shareFeedback === 'idle' && <Share2 size={24} />}
                    {shareFeedback === 'copied' && <Check size={24} />}
                    {shareFeedback === 'shared' && <Check size={24} />}
                </button>
           </div>

           <div className="flex items-end gap-3 mb-6">
               <span className="text-4xl font-bold text-gray-900">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(currentPrice)}</span>
               {isOutOfStock && !product.comingSoon && <span className="text-red-500 font-bold mb-2">Indisponível</span>}
               {product.comingSoon && <span className="text-purple-600 font-bold mb-2 uppercase tracking-wide">Pré-Lançamento</span>}
           </div>

           {product.variants && product.variants.length > 0 && (
               <div className="mb-8">
                   <label className="block text-sm font-bold text-gray-700 mb-3">{product.variantLabel || 'Escolha uma opção:'}</label>
                   <div className="flex flex-wrap gap-3">
                       {product.variants.map((v) => (
                           <button key={v.name} onClick={() => handleVariantChange(v)} className={`px-4 py-3 rounded-lg border-2 text-sm font-bold transition-all ${selectedVariantName === v.name ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>{v.name}</button>
                       ))}
                   </div>
               </div>
           )}

           <div className="mb-8">
               {isUnavailable ? (
                    <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200 animate-fade-in">
                        {alertStatus === 'success' ? (
                            <div className="text-center">
                                <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                                <h4 className="font-bold text-green-800 text-lg">Inscrição confirmada!</h4>
                                <p className="text-sm text-green-700">Será notificado em <span className="font-semibold">{alertEmail}</span> assim que houver stock.</p>
                            </div>
                        ) : (
                            <>
                                <h4 className="font-bold text-yellow-900 text-lg mb-2 flex items-center gap-2">
                                    <Mail size={20}/> 
                                    {product.comingSoon ? 'Seja o primeiro a saber!' : 'Avise-me quando chegar!'}
                                </h4>
                                <p className="text-sm text-yellow-800 mb-4">
                                    {product.comingSoon ? 'Deixe o seu email para ser notificado assim que este produto for lançado.' : 'Deixe o seu email para ser notificado assim que este produto estiver disponível.'}
                                </p>
                                <form onSubmit={handleStockAlertSubmit} className="flex flex-col sm:flex-row gap-2">
                                    <input 
                                        type="email" 
                                        required 
                                        value={alertEmail}
                                        onChange={(e) => setAlertEmail(e.target.value)}
                                        placeholder="O seu melhor email" 
                                        className="flex-1 px-4 py-2 rounded-lg border border-yellow-300 bg-white focus:ring-2 focus:ring-yellow-500 outline-none"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={alertStatus === 'loading'}
                                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                                    >
                                        {alertStatus === 'loading' ? <Loader2 className="animate-spin" size={16}/> : 'Notificar'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
               ) : (
                   <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg border border-green-100 w-fit">
                       <Check size={20} /><span className="font-bold">Em Stock</span>
                       {isLowStock && <span className="ml-2 text-orange-600 text-sm font-normal flex items-center gap-1"><AlertTriangle size={14} /> Restam apenas {currentStock}</span>}
                   </div>
               )}
           </div>

           <div className="flex gap-4 mb-8">
               <button 
                onClick={handleAddToCart} 
                disabled={isUnavailable} 
                className={`flex-1 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 
                    ${isUnavailable 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-primary hover:bg-blue-600 text-white'
                    }`}
               >
                   <ShoppingCart size={24} /> 
                   {isUnavailable ? (product.comingSoon ? 'Brevemente Disponível' : 'Indisponível') : 'Comprar Agora'}
               </button>
           </div>
           
           <div className="space-y-6 text-gray-600 leading-relaxed">
               <p className="text-lg">{product.description}</p>
               <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                   <h3 className="font-bold text-gray-900 mb-4">Destaques</h3>
                   <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">{product.features.map((feat, idx) => (<li key={idx} className="flex items-center gap-2 text-sm"><div className="w-1.5 h-1.5 bg-primary rounded-full"></div>{feat}</li>))}</ul>
               </div>
               <div className="flex flex-col sm:flex-row gap-6 pt-4 border-t border-gray-100 text-sm font-medium">
                   <div className="flex items-center gap-2 text-gray-500"><Truck size={20} className="text-primary" /> Entrega 1-3 dias</div>
                   <div className="flex items-center gap-2 text-gray-500"><ShieldCheck size={20} className="text-green-600" /> Garantia de 3 Anos</div>
               </div>
           </div>
        </div>
      </div>

      <ReviewSection productId={product.id} reviews={reviews} onAddReview={onAddReview} currentUser={currentUser} />

      {product.category === 'TV & Streaming' && (
          <div className="mt-20 border-t border-gray-100 pt-16">
              <div className="text-center mb-10">
                  <h2 className="text-3xl font-extrabold text-gray-900">Qual a Box ideal para si?</h2>
                  <p className="text-gray-500 mt-2">Compare as gerações da Xiaomi com a potência da H96 Max.</p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-xl bg-white">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-gray-50">
                              <th className="p-4 md:p-6 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">Specs</th>
                              <th className="p-4 md:p-6 border-b border-gray-200 text-center"><span className="block font-bold text-gray-900 text-sm">Xiaomi S (3ª Gen)</span><span className="text-[10px] text-primary font-bold">A MAIS RECENTE</span></th>
                              <th className="p-4 md:p-6 border-b border-gray-200 text-center"><span className="block font-bold text-gray-900 text-sm">Xiaomi S (2ª Gen)</span><span className="text-[10px] text-gray-400 font-bold">EQUILIBRADA</span></th>
                              <th className="p-4 md:p-6 border-b border-gray-200 text-center"><span className="block font-bold text-gray-900 text-sm">H96 Max M2</span><span className="text-[10px] text-orange-500 font-bold">POTÊNCIA/APK</span></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs md:text-sm">
                          <tr><td className="p-4 md:p-6 font-bold text-gray-700 bg-gray-50/30">Ideal Para</td><td className="p-4 md:p-6 text-center text-blue-700">Netflix & Disney+ 8K</td><td className="p-4 md:p-6 text-center">Netflix & Disney+ 4K</td><td className="p-4 md:p-6 text-center text-orange-700">IPTV & Apps Externos</td></tr>
                          <tr><td className="p-4 md:p-6 font-bold text-gray-700 bg-gray-50/30">RAM / ROM</td><td className="p-4 md:p-6 text-center">2GB / 32GB (Novo)</td><td className="p-4 md:p-6 text-center">2GB / 8GB</td><td className="p-4 md:p-6 text-center font-bold">4GB / 64GB</td></tr>
                          <tr><td className="p-4 md:p-6 font-bold text-gray-700 bg-gray-50/30">Netflix Oficial</td><td className="p-4 md:p-6 text-center text-green-600 font-bold">Sim</td><td className="p-4 md:p-6 text-center text-green-600 font-bold">Sim</td><td className="p-4 md:p-6 text-center text-red-400 font-bold">Não</td></tr>
                          <tr><td className="p-4 md:p-6 font-bold text-gray-700 bg-indigo-50/30">Escolha se...</td><td className="p-4 md:p-6 text-center italic">Quer o melhor processador.</td><td className="p-4 md:p-6 text-center italic">Quer o melhor preço oficial.</td><td className="p-4 md:p-6 text-center italic">Instala apps externas/IPTV.</td></tr>
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {relatedProducts.length > 0 && (
          <div className="mt-20 border-t border-gray-100 pt-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Outras opções para si</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {relatedProducts.map(rel => (
                      <a href={`#product/${rel.id}`} key={rel.id} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer">
                          <div className="aspect-square bg-gray-100 relative overflow-hidden">
                              <img src={rel.image} alt={rel.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          </div>
                          <div className="p-4">
                              <h3 className="font-bold text-gray-900 text-sm line-clamp-2 group-hover:text-primary transition-colors">{rel.name}</h3>
                              <p className="text-primary font-bold mt-2">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(rel.price)}</p>
                          </div>
                      </a>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default ProductDetails;
