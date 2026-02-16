
import React, { useState, useRef } from 'react';
import { Star, Upload, Image as ImageIcon, X, ThumbsUp, CheckCircle, Loader2, Coins } from 'lucide-react';
import { Review, User, PointHistory } from '../types';
import { storage, db, firebase } from '../services/firebaseConfig';

interface ReviewSectionProps {
  productId: number;
  reviews: Review[];
  onAddReview: (review: Review) => void;
  currentUser: User | null;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({ productId, reviews = [], onAddReview, currentUser }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtra reviews apenas deste produto
  const productReviews = (reviews || []).filter(r => r.productId === productId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const averageRating = productReviews.length 
    ? (productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length).toFixed(1) 
    : null;

  // Função para proteger a identidade do utilizador (Ex: "João Silva" -> "João S.")
  const formatDisplayName = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      // Pega o primeiro nome e a primeira letra do último nome
      return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
    }
    return name; // Se for só um nome (ex: "Maria"), mostra normal
  };

  // Função para comprimir imagem antes de enviar
  const processAndUploadImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Redimensionar para poupar dados
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Converter para Data URL (JPEG qualidade 0.8)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          try {
              // Upload para Firebase Storage
              const filename = `reviews/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
              const storageRef = storage.ref().child(filename);
              
              await storageRef.putString(dataUrl, 'data_url');
              const downloadUrl = await storageRef.getDownloadURL();
              resolve(downloadUrl);
          } catch (error) {
              console.error("Upload failed:", error);
              reject(error);
          }
        };
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsSubmitting(true); // Bloqueia UI
      // FIX: Cast `file` to `File`. The type inference from `Array.from(e.target.files)`
      // appears to be failing in this project's setup, resulting in `file` being `unknown`.
      const files = Array.from(e.target.files) as File[];
      const remainingSlots = 3 - images.length;
      const filesToProcess = files.slice(0, remainingSlots);

      let processedCount = 0;
      const newImageUrls: string[] = [];

      try {
          for (const file of filesToProcess) {
              const url = await processAndUploadImage(file);
              newImageUrls.push(url);
              processedCount++;
              setUploadProgress((processedCount / filesToProcess.length) * 100);
          }
          setImages(prev => [...prev, ...newImageUrls]);
      } catch (error) {
          alert("Erro ao fazer upload da imagem. Tente novamente.");
      } finally {
          setIsSubmitting(false);
          setUploadProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment || !rating) return;
    setIsSubmitting(true);

    const newReview: Review = {
      id: Date.now().toString(),
      productId,
      userName: userName || 'Cliente Anónimo',
      rating,
      comment,
      date: new Date().toISOString(),
      images
    };

    // GAMIFICAÇÃO: Dar pontos pela review
    if (currentUser) {
        try {
            const points = 50;
            const newHistory: PointHistory = {
                id: `review-${newReview.id}`,
                date: new Date().toISOString(),
                amount: points,
                reason: 'Avaliação de Produto'
            };

            await db.collection('users').doc(currentUser.uid).update({
                loyaltyPoints: firebase.firestore.FieldValue.increment(points),
                pointsHistory: firebase.firestore.FieldValue.arrayUnion(newHistory)
            });
            setPointsEarned(true);
        } catch(e) {
            console.error("Erro ao atribuir pontos de review", e);
        }
    }

    onAddReview(newReview);
    
    setTimeout(() => {
        // Reset Form
        setComment('');
        setImages([]);
        setRating(5);
        setIsSubmitting(false);
        setIsFormOpen(false);
        setPointsEarned(false);
    }, 2000);
  };

  return (
    <div className="mt-16 border-t border-gray-100 dark:border-gray-700 pt-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Avaliações dos Clientes</h2>
          <div className="flex items-center gap-2 mt-2">
             {averageRating ? (
                 <>
                    <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                            <Star key={i} size={20} fill={i < Math.round(Number(averageRating)) ? "currentColor" : "none"} />
                        ))}
                    </div>
                    <span className="text-gray-600 dark:text-gray-300 font-medium">{averageRating} de 5</span>
                    <span className="text-gray-400 text-sm">({productReviews.length} avaliações)</span>
                 </>
             ) : (
                 <span className="text-gray-500 dark:text-gray-400">Ainda não existem avaliações.</span>
             )}
          </div>
        </div>
        
        {!isFormOpen && (
            <button 
                onClick={() => setIsFormOpen(true)}
                className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-full font-bold transition-colors shadow-md flex items-center gap-2"
            >
                <Star size={18} fill="currentColor"/> Avaliar (+50 Pontos)
            </button>
        )}
      </div>

      {/* Formulário de Avaliação */}
      {isFormOpen && (
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in-down">
            {pointsEarned ? (
                <div className="text-center py-8">
                    <div className="inline-flex p-4 rounded-full bg-yellow-100 text-yellow-600 mb-3 animate-bounce">
                        <Coins size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Avaliação Enviada!</h3>
                    <p className="text-green-600 font-bold">+50 Pontos adicionados à sua conta.</p>
                </div>
            ) : (
            <>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg dark:text-white">Partilhe a sua experiência</h3>
                    <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Nome */}
                    {!currentUser && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">O seu nome</label>
                            <input 
                                type="text" 
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="Ex: João Silva"
                            />
                        </div>
                    )}

                    {/* Estrelas */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Classificação</label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    type="button"
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(star)}
                                    className="focus:outline-none transition-transform hover:scale-110"
                                >
                                    <Star 
                                        size={32} 
                                        className={star <= (hoverRating || rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600"} 
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Comentário */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">O seu comentário</label>
                        <textarea 
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            required
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white h-24 resize-none"
                            placeholder="O que achou do produto? A qualidade correspondeu?"
                        />
                    </div>

                    {/* Upload de Fotos */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fotos (Opcional - Máx 3)</label>
                        <div className="flex flex-wrap gap-4">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 group bg-white dark:bg-gray-700">
                                    <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                    <button 
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ))}
                            
                            {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="w-20 h-20 border border-gray-200 rounded-lg flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700">
                                    <Loader2 size={24} className="animate-spin text-primary" />
                                    <span className="text-[10px] mt-1 text-gray-500">{Math.round(uploadProgress)}%</span>
                                </div>
                            )}

                            {images.length < 3 && !isSubmitting && (
                                <button 
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors bg-white dark:bg-gray-700"
                                >
                                    <ImageIcon size={24} />
                                    <span className="text-[10px] mt-1">Adicionar</span>
                                </button>
                            )}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isSubmitting || !comment}
                        className="w-full bg-secondary hover:bg-gray-800 text-white font-bold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'A enviar...' : 'Publicar Avaliação'}
                    </button>
                </form>
            </>
            )}
        </div>
      )}

      {/* Lista de Avaliações */}
      <div className="space-y-6">
        {productReviews.map((review) => (
            <div key={review.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-primary dark:text-blue-300 font-bold flex-shrink-0">
                            {review.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white leading-tight">
                                {formatDisplayName(review.userName)}
                            </h4>
                            <div className="flex items-center gap-2">
                                <div className="flex text-yellow-400 text-xs">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} />
                                    ))}
                                </div>
                                <span className="text-xs text-gray-400">
                                    {new Date(review.date).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    {review.rating >= 4 && (
                        <div className="hidden sm:flex items-center gap-1 text-green-600 dark:text-green-400 text-xs bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full font-medium">
                            <CheckCircle size={14} /> Compra Verificada
                        </div>
                    )}
                </div>

                <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                    {review.comment}
                </p>

                {/* Galeria de Imagens da Review */}
                {review.images && review.images.length > 0 && (
                    <div className="flex gap-2 mt-3">
                        {review.images.map((img, idx) => (
                            <img 
                                key={idx} 
                                src={img} 
                                alt="Foto do cliente" 
                                className="w-24 h-24 object-cover rounded-lg border border-gray-100 dark:border-gray-700 cursor-zoom-in hover:opacity-90 transition-opacity bg-gray-50 dark:bg-gray-700"
                                onClick={() => {
                                    const w = window.open("");
                                    w?.document.write(`<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#000;"><img src="${img}" style="max-width:100%;max-height:100%"/></body>`);
                                }}
                            />
                        ))}
                    </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-400">
                    <button className="flex items-center gap-1 hover:text-primary transition-colors">
                        <ThumbsUp size={16} /> Útil
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewSection;
