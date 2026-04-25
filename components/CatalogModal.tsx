import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductVariant, Review } from '../types';
import { X, Save, Image as ImageIcon, Plus, Trash2, Star, Layers, ListPlus, Settings, Upload, Loader2, MessageSquare, Globe, ArrowRight as ArrowRightIcon } from 'lucide-react';
import { db, storage } from '../services/firebaseConfig';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSave: (product: Product) => Promise<void>;
}

const CatalogModal: React.FC<CatalogModalProps> = ({ isOpen, onClose, product, onSave }) => {
  const [formData, setFormData] = useState<Product | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'images' | 'features' | 'reviews' | 'premium'>('info');
  
  const [newFeature, setNewFeature] = useState('');
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  const handleAddBlock = () => {
    if (!formData) return;
    const newBlock = {
      id: Date.now().toString(),
      type: 'square' as any,
      title: 'Novo Bloco',
      description: '',
      image: '',
      textColor: '#ffffff',
      textAlign: 'center' as any,
      textVerticalAlign: 'center' as any,
      showIcon: true,
      iconType: 'none' as any
    };
    
    const currentBlocks = formData.premiumData?.blocks || [];
    setFormData({
      ...formData,
      premiumData: {
        ...(formData.premiumData || {}),
        blocks: [...currentBlocks, newBlock]
      }
    });
  };

  const handleUpdateBlock = (id: string, updates: any) => {
    if (!formData || !formData.premiumData?.blocks) return;
    const updatedBlocks = formData.premiumData.blocks.map(b => 
      b.id === id ? { ...b, ...updates } : b
    );
    setFormData({
      ...formData,
      premiumData: {
        ...formData.premiumData,
        blocks: updatedBlocks
      }
    });
  };

  const handleRemoveBlock = (id: string) => {
    if (!formData || !formData.premiumData?.blocks) return;
    const updatedBlocks = formData.premiumData.blocks.filter(b => b.id !== id);
    setFormData({
      ...formData,
      premiumData: {
        ...formData.premiumData,
        blocks: updatedBlocks
      }
    });
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!formData || !formData.premiumData?.blocks) return;
    const blocks = [...formData.premiumData.blocks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    
    [blocks[index], blocks[newIndex]] = [blocks[newIndex], blocks[index]];
    
    setFormData({
      ...formData,
      premiumData: {
        ...formData.premiumData,
        blocks
      }
    });
  };

  const migrateToBlocks = () => {
    if (!formData || !formData.premiumData) return;
    const p = formData.premiumData;
    const blocks: any[] = [];
    
    if (p.box1Title || p.box1Image) {
      blocks.push({
        id: 'box1',
        type: 'rectangle',
        title: p.box1Title,
        description: p.box1Desc,
        image: p.box1Image,
        textColor: p.box1TextColor || '#ffffff',
        textAlign: p.box1Align || 'left',
        textVerticalAlign: 'bottom',
        showIcon: false
      });
    }
    
    if (p.box2Title || p.box2Image) {
      blocks.push({
        id: 'box2',
        type: 'square',
        title: p.box2Title,
        description: p.box2Desc,
        image: p.box2Image,
        textColor: p.box2TextColor || '#000000',
        textAlign: p.box2Align || 'center',
        textVerticalAlign: 'center',
        showIcon: p.box2ShowIcon !== false,
        iconType: 'cpu'
      });
    }

    if (p.box3Title || p.box3Image) {
      blocks.push({
        id: 'box3',
        type: 'square',
        title: p.box3Title,
        description: p.box3Desc,
        image: p.box3Image,
        textColor: p.box3TextColor || '#000000',
        textAlign: p.box3Align || 'center',
        textVerticalAlign: 'center',
        showIcon: p.box3ShowIcon !== false,
        iconType: 'wifi'
      });
    }

    if (p.box4Title || p.box4Image) {
      blocks.push({
        id: 'box4',
        type: 'rectangle',
        title: p.box4Title,
        description: p.box4Desc,
        image: p.box4Image,
        textColor: p.box4TextColor || '#ffffff',
        textAlign: p.box4Align || 'left',
        textVerticalAlign: 'center',
        showIcon: p.box4ShowIcon !== false,
        iconType: 'play'
      });
    }

    setFormData({
      ...formData,
      premiumData: {
        ...p,
        blocks
      }
    });
  };

  useEffect(() => {
    if (isOpen && product) {
      setFormData(JSON.parse(JSON.stringify(product)));
      if (product.id) {
        loadReviews(product.id);
      }
    } else {
      setFormData(null);
      setReviews([]);
    }
  }, [isOpen, product]);

  const loadReviews = async (productId: number) => {
    setIsReviewsLoading(true);
    try {
      const snapshot = await db.collection('reviews').where('productId', '==', productId).get();
      const loadedReviews = snapshot.docs.map(doc => doc.data() as Review);
      setReviews(loadedReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error("Erro ao carregar avaliações:", error);
    } finally {
      setIsReviewsLoading(false);
    }
  };

  if (!isOpen || !formData) return null;

  const moveImage = (index: number, direction: 'left' | 'right') => {
    if (!formData || !formData.images) return;
    const images = [...formData.images];
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;
    
    [images[index], images[newIndex]] = [images[newIndex], images[index]];
    setFormData({ ...formData, images });
  };

  const handleSave = async () => {
    await onSave(formData);
    onClose();
  };

  const handleImageUpload = async (files: FileList | null, target: 'main' | 'gallery' | number) => {
      if (!files || files.length === 0) return;
      setIsUploading(true);
      setUploadProgress(0);

      const newImageUrls: string[] = [];
      const uploadPromises = Array.from(files).map(file => {
          return new Promise<string>((resolve, reject) => {
              const storageRef = storage.ref(`products_public/${Date.now()}_${file.name}`);
              const uploadTask = storageRef.put(file);

              uploadTask.on('state_changed', 
                  (snapshot) => {
                      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                      setUploadProgress(progress);
                  },
                  (error) => reject(error),
                  async () => {
                      try {
                          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                          resolve(downloadURL);
                      } catch (err) {
                          reject(err);
                      }
                  }
              );
          });
      });

      try {
          const urls = await Promise.all(uploadPromises);
          newImageUrls.push(...urls);
          
          setFormData(prev => {
              if (!prev) return null;
              const currentImages = prev.images || [];
              const uniqueNewImages = newImageUrls.filter(url => !currentImages.includes(url));
              const updatedImages = [...currentImages, ...uniqueNewImages];
              
              let updates: any = { images: updatedImages };

              if (target === 'main') {
                  updates.image = newImageUrls[0];
              } else if (typeof target === 'number') {
                  const newVariants = [...(prev.variants || [])];
                  if (newVariants[target]) {
                      newVariants[target] = { ...newVariants[target], image: newImageUrls[0] };
                      updates.variants = newVariants;
                  }
              } else if (target === 'gallery') {
                  if (!prev.image && newImageUrls.length > 0) {
                      updates.image = newImageUrls[0];
                  }
              }

              return { ...prev, ...updates };
          });
      } catch (error) {
          console.error("Erro no upload:", error);
          alert("Erro ao carregar imagem.");
      } finally {
          setIsUploading(false);
          setUploadProgress(null);
      }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Tem a certeza que deseja apagar esta avaliação?')) return;
    try {
      await db.collection('reviews').doc(reviewId).delete();
      setReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (error) {
      console.error("Erro ao apagar avaliação:", error);
      alert("Erro ao apagar avaliação.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col transition-colors">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="text-indigo-600 dark:text-indigo-400" />
            {product?.id ? 'Editar Produto do Catálogo' : 'Novo Produto do Catálogo'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
            <X size={24}/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-6 overflow-x-auto">
          <button onClick={() => setActiveTab('info')} className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>Informações Básicas</button>
          <button onClick={() => setActiveTab('images')} className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'images' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>Imagens & Variantes</button>
          <button onClick={() => setActiveTab('features')} className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'features' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>Destaques & Specs</button>
          <button onClick={() => setActiveTab('reviews')} className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'reviews' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>Avaliações ({reviews.length})</button>
          {formData.isPremium && (
            <button onClick={() => setActiveTab('premium')} className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'premium' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-purple-500/70 hover:text-purple-600 dark:text-purple-400/70 dark:hover:text-purple-300'}`}>
              <Star size={16} /> Layout Premium
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nome do Produto</label>
                  <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                  <input type="text" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Preço de Venda (€)</label>
                  <input type="number" step="0.01" value={formData.price || 0} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Preço Original (Riscado) (€)</label>
                  <input type="number" step="0.01" value={formData.originalPrice || ''} onChange={e => setFormData({...formData, originalPrice: e.target.value ? Number(e.target.value) : null as any})} className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Limite por Encomenda</label>
                  <input type="number" min="1" value={formData.maxQuantityPerOrder || ''} onChange={e => setFormData({...formData, maxQuantityPerOrder: e.target.value ? Number(e.target.value) : null as any})} placeholder="Ex: 1 (Opcional)" className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                  <p className="text-[10px] text-gray-500 mt-1">Deixe vazio para não ter limite.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Cor do Efeito Hover (Card)</label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.cardHoverColor || '#f97316'} onChange={e => setFormData({...formData, cardHoverColor: e.target.value})} className="h-12 w-20 p-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                    <input type="text" value={formData.cardHoverColor || ''} onChange={e => setFormData({...formData, cardHoverColor: e.target.value})} placeholder="#f97316" className="flex-1 p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Descrição Completa</label>
                <textarea rows={6} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white resize-none" />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.comingSoon || false} onChange={e => setFormData({...formData, comingSoon: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                  <span className="font-bold text-gray-700 dark:text-gray-300">Marcar como "Em Breve"</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isPremium || false} onChange={e => setFormData({...formData, isPremium: e.target.checked})} className="w-5 h-5 text-purple-600 rounded" />
                  <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"><Star size={16} className="text-purple-500" /> Layout Premium (Apple-style)</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 dark:text-white">Galeria de Imagens</h4>
                  <button type="button" onClick={() => document.getElementById('gallery-upload-modal')?.click()} disabled={isUploading} className="text-sm font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded-lg flex items-center gap-2">
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16}/>} Adicionar Fotos
                  </button>
                  <input type="file" id="gallery-upload-modal" multiple className="hidden" accept="image/*" onChange={(e) => { handleImageUpload(e.target.files, 'gallery'); e.target.value = ''; }} />
                </div>
                
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                  {formData.images?.map((img, idx) => (
                    <div key={idx} className={`relative group aspect-square rounded-lg border overflow-hidden bg-gray-50 dark:bg-slate-800 ${formData.image === img ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200 dark:border-slate-700'}`}>
                      <img src={img} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <button type="button" onClick={() => setFormData({...formData, image: img})} className={`p-2 rounded-full ${formData.image === img ? 'bg-yellow-400 text-white' : 'bg-white/20 text-white hover:bg-yellow-400'}`} title="Principal">
                          <Star size={16} fill={formData.image === img ? "currentColor" : "none"} />
                        </button>
                        <button type="button" onClick={() => setFormData({...formData, images: formData.images?.filter(i => i !== img)})} className="p-2 rounded-full bg-white/20 text-white hover:bg-red-500" title="Apagar">
                          <Trash2 size={16} />
                        </button>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => moveImage(idx, 'left')} disabled={idx === 0} className="p-1 px-2 rounded-lg bg-white/20 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed" title="Mover para Esquerda">
                            <ArrowRightIcon size={12} className="rotate-180" />
                          </button>
                          <button type="button" onClick={() => moveImage(idx, 'right')} disabled={idx === (formData.images?.length || 0) - 1} className="p-1 px-2 rounded-lg bg-white/20 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed" title="Mover para Direita">
                            <ArrowRightIcon size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-slate-700 pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 dark:text-white">Variantes (Cores, Tamanhos)</h4>
                  <button type="button" onClick={() => setFormData({...formData, variants: [...(formData.variants || []), { name: 'Nova Variante', price: formData.price, image: '' }]})} className="text-sm font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 px-4 py-2 rounded-lg flex items-center gap-2">
                    <Plus size={16}/> Adicionar Variante
                  </button>
                </div>
                
                <div className="space-y-4">
                  {formData.variants?.map((variant, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                      <div className="relative w-16 h-16 rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-900 group cursor-pointer" onClick={() => document.getElementById(`variant-upload-${idx}`)?.click()}>
                        {variant.image ? <img src={variant.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon size={20}/></div>}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><Upload size={16}/></div>
                        <input type="file" id={`variant-upload-${idx}`} className="hidden" accept="image/*" onChange={(e) => { handleImageUpload(e.target.files, idx); e.target.value = ''; }} />
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <input type="text" value={variant.name} onChange={e => { const newV = [...(formData.variants || [])]; newV[idx].name = e.target.value; setFormData({...formData, variants: newV}); }} placeholder="Nome (ex: Preto)" className="p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                        <input type="number" value={variant.price} onChange={e => { const newV = [...(formData.variants || [])]; newV[idx].price = Number(e.target.value); setFormData({...formData, variants: newV}); }} placeholder="Preço" className="p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                      </div>
                      <button type="button" onClick={() => { const newV = [...(formData.variants || [])]; newV.splice(idx, 1); setFormData({...formData, variants: newV}); }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={20}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-8">
              <div>
                <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><ListPlus size={20} /> Destaques (Features)</h4>
                <div className="space-y-2 mb-4">
                  {formData.features?.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="flex-1 text-gray-800 dark:text-gray-200">{feat}</span>
                      <button type="button" onClick={() => setFormData({...formData, features: formData.features?.filter((_, i) => i !== idx)})} className="text-red-500 hover:text-red-700"><X size={18}/></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newFeature.trim()) { setFormData({...formData, features: [...(formData.features || []), newFeature.trim()]}); setNewFeature(''); } } }} placeholder="Ex: Bateria de 24h..." className="flex-1 p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                  <button type="button" onClick={() => { if(newFeature.trim()) { setFormData({...formData, features: [...(formData.features || []), newFeature.trim()]}); setNewFeature(''); } }} className="bg-indigo-100 text-indigo-700 px-6 rounded-lg font-bold hover:bg-indigo-200">Adicionar</button>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-slate-700 pt-8">
                <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Settings size={20} /> Especificações Técnicas</h4>
                <div className="space-y-2 mb-4">
                  {Object.entries(formData.specs || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                      <span className="font-bold text-gray-600 dark:text-gray-400 w-1/3">{key}:</span>
                      <span className="flex-1 text-gray-800 dark:text-gray-200">{String(value)}</span>
                      <button type="button" onClick={() => { const newSpecs = {...formData.specs}; delete newSpecs[key]; setFormData({...formData, specs: newSpecs}); }} className="text-red-500 hover:text-red-700"><X size={18}/></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newSpecKey} onChange={e => setNewSpecKey(e.target.value)} placeholder="Propriedade (ex: Peso)" className="w-1/3 p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                  <input type="text" value={newSpecValue} onChange={e => setNewSpecValue(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newSpecKey && newSpecValue) { setFormData({...formData, specs: {...(formData.specs || {}), [newSpecKey]: newSpecValue}}); setNewSpecKey(''); setNewSpecValue(''); } } }} placeholder="Valor (ex: 200g)" className="flex-1 p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                  <button type="button" onClick={() => { if(newSpecKey && newSpecValue) { setFormData({...formData, specs: {...(formData.specs || {}), [newSpecKey]: newSpecValue}}); setNewSpecKey(''); setNewSpecValue(''); } }} className="bg-indigo-100 text-indigo-700 px-6 rounded-lg font-bold hover:bg-indigo-200">Adicionar</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {isReviewsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Ainda não existem avaliações para este produto.</p>
                </div>
              ) : (
                reviews.map(review => (
                  <div key={review.id} className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} />)}
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{review.userName}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(review.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm">{review.comment}</p>
                    </div>
                    <button onClick={() => handleDeleteReview(review.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'premium' && (
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-white">Configuração do Layout Premium</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Personalize os blocos que aparecem no layout estilo Apple.</p>
                  </div>
                  {!formData.premiumData?.blocks?.length && (
                    <button 
                      onClick={migrateToBlocks}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors"
                    >
                      Migrar Layout Antigo
                    </button>
                  )}
                </div>
                
                <div className="space-y-6">
                  {/* Hero Section */}
                  <div className="p-5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                    <h5 className="font-bold text-indigo-600 dark:text-indigo-400 mb-4">Secção Principal (Hero)</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Título Personalizado (Opcional)</label>
                        <input 
                          type="text" 
                          value={formData.premiumData?.heroTitle || ''} 
                          onChange={e => setFormData({...formData, premiumData: {...(formData.premiumData || {}), heroTitle: e.target.value}})} 
                          className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                          placeholder={formData.name}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">URL da Imagem Hero (Opcional)</label>
                        <input 
                          type="text" 
                          value={formData.premiumData?.heroImage || ''} 
                          onChange={e => setFormData({...formData, premiumData: {...(formData.premiumData || {}), heroImage: e.target.value}})} 
                          className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Subtítulo (Abaixo do nome do produto)</label>
                      <input 
                        type="text" 
                        value={formData.premiumData?.heroSubtitle || ''} 
                        onChange={e => setFormData({...formData, premiumData: {...(formData.premiumData || {}), heroSubtitle: e.target.value}})} 
                        className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                        placeholder="Ex: Entretenimento sem limites. Resolução 4K Ultra HD..."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Cor do Texto</label>
                        <input 
                          type="color" 
                          value={formData.premiumData?.heroTextColor || '#000000'} 
                          onChange={e => setFormData({...formData, premiumData: {...(formData.premiumData || {}), heroTextColor: e.target.value}})} 
                          className="w-full h-10 p-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Alinhamento</label>
                        <select 
                          value={formData.premiumData?.heroAlign || 'center'} 
                          onChange={e => setFormData({...formData, premiumData: {...(formData.premiumData || {}), heroAlign: e.target.value as any}})} 
                          className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                        >
                          <option value="left">Esquerda</option>
                          <option value="center">Centro</option>
                          <option value="right">Direita</option>
                        </select>
                      </div>
                      <div className="flex items-center pt-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={formData.premiumData?.showBuyButton !== false} 
                            onChange={e => setFormData({...formData, premiumData: {...(formData.premiumData || {}), showBuyButton: e.target.checked}})} 
                            className="w-4 h-4 text-indigo-600 rounded" 
                          />
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Mostrar Botão Comprar</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Blocks Section */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h5 className="font-bold text-gray-800 dark:text-white">Blocos de Conteúdo</h5>
                      <button 
                        onClick={handleAddBlock}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                      >
                        <Plus size={18} /> Adicionar Bloco
                      </button>
                    </div>

                    {formData.premiumData?.blocks?.map((block, index) => (
                      <div key={block.id} className="p-5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 relative group">
                        <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleMoveBlock(index, 'up')} disabled={index === 0} className="p-1.5 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-30">
                            <Plus size={16} className="rotate-180" />
                          </button>
                          <button onClick={() => handleMoveBlock(index, 'down')} disabled={index === (formData.premiumData?.blocks?.length || 0) - 1} className="p-1.5 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-30">
                            <Plus size={16} />
                          </button>
                          <button onClick={() => handleRemoveBlock(block.id)} className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded hover:bg-red-200 dark:hover:bg-red-900/50">
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tipo de Bloco</label>
                            <select 
                              value={block.type} 
                              onChange={e => handleUpdateBlock(block.id, { type: e.target.value })}
                              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            >
                              <option value="square">Quadrado (1/2)</option>
                              <option value="rectangle">Retângulo (2/2)</option>
                              <option value="tall">Vertical (Alto)</option>
                              <option value="full">Ecrã Inteiro (Hero)</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Título</label>
                            <input 
                              type="text" 
                              value={block.title || ''} 
                              onChange={e => handleUpdateBlock(block.id, { title: e.target.value })}
                              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                              placeholder="Título do bloco..."
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">URL da Imagem</label>
                            <input 
                              type="text" 
                              value={block.image || ''} 
                              onChange={e => handleUpdateBlock(block.id, { image: e.target.value })}
                              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                              placeholder="https://..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                            <input 
                              type="text" 
                              value={block.description || ''} 
                              onChange={e => handleUpdateBlock(block.id, { description: e.target.value })}
                              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                              placeholder="Descrição curta..."
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Cor do Texto</label>
                            <input 
                              type="color" 
                              value={block.textColor || '#ffffff'} 
                              onChange={e => handleUpdateBlock(block.id, { textColor: e.target.value })}
                              className="w-full h-10 p-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Alinh. Horiz.</label>
                            <select 
                              value={block.textAlign || 'center'} 
                              onChange={e => handleUpdateBlock(block.id, { textAlign: e.target.value })}
                              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            >
                              <option value="left">Esquerda</option>
                              <option value="center">Centro</option>
                              <option value="right">Direita</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Alinh. Vert.</label>
                            <select 
                              value={block.textVerticalAlign || 'center'} 
                              onChange={e => handleUpdateBlock(block.id, { textVerticalAlign: e.target.value })}
                              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            >
                              <option value="top">Topo</option>
                              <option value="center">Centro</option>
                              <option value="bottom">Base</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Ícone</label>
                            <select 
                              value={block.iconType || 'none'} 
                              onChange={e => handleUpdateBlock(block.id, { iconType: e.target.value, showIcon: e.target.value !== 'none' })}
                              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            >
                              <option value="none">Nenhum</option>
                              <option value="cpu">CPU</option>
                              <option value="wifi">Wi-Fi</option>
                              <option value="play">Play</option>
                              <option value="star">Estrela</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    {!formData.premiumData?.blocks?.length && (
                      <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
                        <p className="text-gray-500 dark:text-gray-400">Nenhum bloco dinâmico configurado.</p>
                        <button onClick={handleAddBlock} className="mt-4 text-indigo-600 font-bold hover:underline">Adicionar o primeiro bloco</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2">
            <Save size={20} /> Guardar Catálogo
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogModal;
