import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, ShoppingCart, User as UserIcon, MapPin, BarChart2, TicketPercent, ToggleLeft, ToggleRight, Save, Bell, Truck, Globe, FileText, CheckCircle, Copy, Bot, Send, Users, Eye, AlertTriangle, Camera, Zap, ZapOff, QrCode, Home, ArrowLeft, RefreshCw, ClipboardEdit, MinusCircle, Calendar, Info, Database, UploadCloud, Tag, Image as ImageIcon, AlignLeft, ListPlus, ArrowRight as ArrowRightIcon, Layers, Lock, Unlock, CalendarClock, Upload, Loader2, ChevronDown, ChevronRight, ShieldAlert, XCircle, Mail, ScanBarcode, ShieldCheck, ZoomIn, BrainCircuit, Wifi, WifiOff, ExternalLink, Key as KeyIcon
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord, Order, Coupon, User as UserType, PointHistory, UserTier, ProductUnit, Product, OrderItem } from '../types';
import { getInventoryAnalysis, extractSerialNumberFromImage } from '../services/geminiService';
import { INITIAL_PRODUCTS, LOYALTY_TIERS, STORE_NAME } from '../constants';
import { db, storage, firebase } from '../services/firebaseConfig';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/library';

// --- TYPES HELPERS ---

// Helper function to safely handle old and new order item formats
const getSafeItems = (items: any): (OrderItem | string)[] => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') return [items];
    return [];
};

// --- Tipos Locais para o Dashboard ---
interface ManualOrderItem extends Product {
    quantity: number;
    selectedVariant: string; // Vazio se não houver variante
    finalPrice: number;
}

// Utility para formatação de moeda
const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const KpiCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; onClick?: () => void; }> = ({ title, value, icon, color, onClick }) => {
  const colorClasses: { [key: string]: string } = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };
  const colorClass = colorClasses[color] || 'bg-gray-50 text-gray-600';
  const displayValue = typeof value === 'number' ? formatCurrency(value) : value;
  const isClickable = !!onClick;

  return (
    <div 
      onClick={onClick} 
      className={`p-4 rounded-xl border bg-white shadow-sm flex flex-col justify-between h-full transition-all duration-300 ${isClickable ? 'cursor-pointer hover:border-indigo-300 hover:shadow-lg hover:scale-[1.02]' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-500 text-xs font-bold uppercase flex items-center gap-1">{title}</span>
        <div className={`p-1.5 rounded-lg ${colorClass}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold">{displayValue}</div>
    </div>
  );
};

// --- COMPONENTE DE SCANNER OTIMIZADO (COM CORREÇÃO DE ERRO GOOGLE CLOUD) ---
interface BarcodeScannerProps { 
    onCodeSubmit: (code: string) => void; 
    onClose: () => void;
    mode: 'serial' | 'product'; 
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onCodeSubmit, onClose, mode }) => {
    const [error, setError] = useState<string | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [zoom, setZoom] = useState(1);
    const [maxZoom, setMaxZoom] = useState(1);
    const [hasZoom, setHasZoom] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    
    // Auto-diagnóstico
    const [aiStatus, setAiStatus] = useState<'ready' | 'offline'>('ready');
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);

    useEffect(() => {
        const startScanner = async () => {
            if (!videoRef.current) return;
            const hints = new Map();
            let formats;

            if (mode === 'serial') {
                formats = [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.CODABAR, BarcodeFormat.DATA_MATRIX];
            } else {
                formats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.QR_CODE];
            }

            hints.set(2, formats);
            hints.set(3, true);

            codeReaderRef.current = new BrowserMultiFormatReader(hints, 300);

            try {
                const constraints = { video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 }, focusMode: 'continuous' } };
                const stream = await navigator.mediaDevices.getUserMedia(constraints as any);
                streamRef.current = stream;
                const track = stream.getVideoTracks()[0];
                trackRef.current = track;

                const capabilities = track.getCapabilities() as any;
                if (capabilities.zoom) {
                    setHasZoom(true);
                    setMaxZoom(capabilities.zoom.max);
                    if (mode === 'serial' && capabilities.zoom.max >= 1.5) {
                        track.applyConstraints({ advanced: [{ zoom: 1.5 }] } as any).catch(console.warn);
                        setZoom(1.5);
                    }
                }
                
                if (videoRef.current) {
                    await codeReaderRef.current.decodeFromStream(stream, videoRef.current, (result, err) => {
                        if (result) onCodeSubmit(result.getText().trim().toUpperCase());
                    });
                }
            } catch (err) {
                console.error("Scanner init error:", err);
                setError("Câmara indisponível. Verifique as permissões.");
            }
        };
        startScanner();
        return () => {
            if (codeReaderRef.current) codeReaderRef.current.reset();
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        };
    }, [onCodeSubmit, mode]);

    const toggleTorch = async () => {
        if (trackRef.current) {
            try {
                await trackRef.current.applyConstraints({ advanced: [{ torch: !isTorchOn } as any] });
                setIsTorchOn(!isTorchOn);
            } catch(e) { console.warn(e); }
        }
    };

    const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newZoom = parseFloat(e.target.value);
        setZoom(newZoom);
        if (trackRef.current && hasZoom) {
            try { await trackRef.current.applyConstraints({ advanced: [{ zoom: newZoom } as any] }); } catch (err) { console.warn(err); }
        }
    };
    
    const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (manualCode.trim()) onCodeSubmit(manualCode.trim().toUpperCase());
    };

    const handleAiScan = async () => {
        if (!videoRef.current || isAiProcessing) return;
        if (videoRef.current.readyState < 2) { setError("A câmara ainda está a iniciar..."); return; }

        setIsAiProcessing(true);
        setError(null);

        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Erro ao criar imagem.");
            
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

            const code = await extractSerialNumberFromImage(base64Image);

            if (code) {
                const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                beep.play().catch(() => {});
                onCodeSubmit(code.toUpperCase());
                setAiStatus('ready');
            } else {
                setError("A IA não conseguiu ler. Tente focar e limpar a etiqueta.");
            }
        } catch (error: any) {
            console.error("AI Scan Error:", error);
            const msg = error.message || JSON.stringify(error);
            
            setAiStatus('offline'); // Marca visualmente como offline

            // DIAGNÓSTICO INTELIGENTE DE ERRO
            if (msg.includes("API key not valid")) {
                setError("API_KEY_INVALID");
            } else if (msg.includes("referer") || msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
                setError("API_KEY_RESTRICTED");
            } else if (msg.includes("API key is missing")) {
                setError("API_KEY_MISSING");
            } else {
                setError(`Erro IA: ${msg}`);
            }
        } finally {
            setIsAiProcessing(false);
        }
    };

    const renderErrorContent = () => {
        switch (error) {
            case 'API_KEY_INVALID':
                return (
                    <div className="flex flex-col items-center w-full">
                        <KeyIcon size={48} className="text-red-500 mb-4" />
                        <h3 className="text-lg font-bold mb-2">Chave API Inválida</h3>
                        <p className="text-xs text-gray-300 mb-6 max-w-[280px]">
                            A chave API configurada para o Google AI é inválida ou foi revogada.
                        </p>
                        <div className="bg-white/10 p-4 rounded-xl border border-white/20 w-full text-left">
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-2 flex items-center gap-1"><CheckCircle size={10}/> Solução (Admin):</p>
                            <p className="text-xs text-gray-300">
                                1. Verifique a chave API na <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">Google AI Studio</a>.
                                <br/>2. Atualize a variável de ambiente `API_KEY` nas definições do seu projeto na Vercel.
                            </p>
                        </div>
                    </div>
                );
            case 'API_KEY_RESTRICTED':
                 return (
                    <div className="flex flex-col items-center w-full">
                        <WifiOff size={48} className="text-yellow-500 mb-4" />
                        <h3 className="text-lg font-bold mb-2">Acesso Bloqueado pela Google</h3>
                        <p className="text-xs text-gray-300 mb-4 max-w-[250px]">
                            A sua Chave API tem restrições que impedem este site de a usar.
                        </p>
                        <div className="bg-white/10 p-4 rounded-xl border border-white/20 mb-4 w-full text-left">
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-2 flex items-center gap-1"><CheckCircle size={10}/> Solução: Adicione este link</p>
                            <div className="flex items-center gap-2 bg-black/50 p-2 rounded-lg border border-white/10">
                                <Globe size={14} className="text-blue-400" />
                                <code className="text-xs font-mono text-yellow-400 flex-1 truncate select-all">{window.location.hostname}</code>
                                <button onClick={() => navigator.clipboard.writeText(window.location.hostname)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded text-white transition-colors" title="Copiar"><Copy size={14} /></button>
                            </div>
                        </div>
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold w-full shadow-lg pointer-events-auto flex items-center justify-center gap-2 mb-2">
                            Ir para Google Cloud <ExternalLink size={14} />
                        </a>
                    </div>
                );
            default:
                return (
                    <>
                        <AlertCircle size={40} className="text-red-500 mb-4" />
                        <p className="text-sm font-bold mb-6">{error}</p>
                    </>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <button onClick={onClose} className="absolute top-6 right-6 bg-white/10 p-3 rounded-full text-white z-[110] border border-white/20 active:scale-90 transition-all shadow-2xl"><X size={24}/></button>
            <div className="w-full max-w-sm relative">
                <div className="absolute top-4 left-4 z-[110] flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${aiStatus === 'ready' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{aiStatus === 'ready' ? 'IA Online' : 'IA Offline'}</span>
                </div>
                <div className="relative aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
                    <video ref={videoRef} className="w-full h-full object-cover scale-110" muted playsInline />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className={`w-[90%] max-w-[300px] border-2 border-white/20 rounded-2xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.7)] ${mode === 'serial' ? 'h-[60px]' : 'h-[150px]'} transition-all duration-300`}>
                            {!isAiProcessing && !error && <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse"></div>}
                            {isAiProcessing && <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl"><Loader2 size={32} className="text-white animate-spin" /></div>}
                        </div>
                    </div>
                    <div className="absolute bottom-4 right-4 z-[60]">
                        <button onClick={handleAiScan} disabled={isAiProcessing} className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg border-2 border-white/20 flex items-center gap-2 transition-all active:scale-90 disabled:opacity-50">
                            {isAiProcessing ? <BrainCircuit size={24} className="animate-pulse" /> : <Camera size={24} />} <span className="text-xs font-bold hidden sm:inline">IA Scan</span>
                        </button>
                    </div>
                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 text-white p-6 text-center z-50 animate-fade-in">
                            {renderErrorContent()}
                            <button onClick={() => { setError(null); setAiStatus('ready'); }} className="mt-2 bg-white/10 px-6 py-2 rounded-full font-bold text-xs pointer-events-auto hover:bg-white/20">Tentar de Novo</button>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex flex-col items-center gap-4">
                    <div className="flex gap-4 items-center w-full justify-center">
                        <button onClick={toggleTorch} className={`w-12 h-12 rounded-full transition-all shadow-lg flex flex-col items-center justify-center border-2 ${isTorchOn ? 'bg-yellow-400 text-black border-white' : 'bg-white/5 text-white border-white/20'}`}>{isTorchOn ? <Zap size={20} fill="currentColor" /> : <ZapOff size={20} />}</button>
                        {hasZoom && (
                            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                                <ZoomIn size={16} className="text-white/70"/>
                                <input type="range" min="1" max={Math.min(maxZoom, 5)} step="0.1" value={zoom} onChange={handleZoomChange} className="w-24 accent-indigo-500 h-1"/>
                                <span className="text-xs text-white font-mono w-8 text-right">{zoom.toFixed(1)}x</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-center text-gray-400 text-xs font-bold my-6">OU DIGITE MANUALMENTE</div>
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <input type="tel" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Digite o código aqui" className="flex-1 bg-white/5 border border-white/20 text-white rounded-lg px-4 py-3 text-center tracking-widest focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"/>
                    <button type="submit" className="bg-indigo-600 text-white font-bold px-4 rounded-lg hover:bg-indigo-700 transition-colors"><Send size={20} /></button>
                </form>
            </div>
        </div>
    );
};

// --- DASHBOARD COMPONENT ---
interface DashboardProps {
    user: UserType | null;
    isAdmin: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ user, isAdmin }) => {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory(isAdmin);
  
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'coupons'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'SOLD'>('ALL');
  const [cashbackFilter, setCashbackFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'NONE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<InventoryProduct | null>(null);
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [showToast, setShowToast] = useState<Order | null>(null);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isOnlineDetailsOpen, setIsOnlineDetailsOpen] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isCouponsLoading, setIsCouponsLoading] = useState(false);
  const [newCoupon, setNewCoupon] = useState<Coupon>({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0 });
  const [publicProductsList, setPublicProductsList] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'add_unit' | 'sell_unit' | 'tracking' | 'verify_product'>('search');
  const [modalUnits, setModalUnits] = useState<ProductUnit[]>([]);
  const [manualUnitCode, setManualUnitCode] = useState('');
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // UPLOAD PROGRESS STATE
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [notificationModalData, setNotificationModalData] = useState<{productName: string; subject: string; body: string; bcc: string; alertsToDelete: any[];} | null>(null);
  const [copySuccess, setCopySuccess] = useState('');
  const [linkedOrderId, setLinkedOrderId] = useState<string>('');
  const [selectedOrderForSaleDetails, setSelectedOrderForSaleDetails] = useState<Order | null>(null);
  const [selectedUnitsForSale, setSelectedUnitsForSale] = useState<string[]>([]);
  const [manualUnitSelect, setManualUnitSelect] = useState('');
  const [orderMismatchWarning, setOrderMismatchWarning] = useState<string | null>(null);
  const [securityCheckPassed, setSecurityCheckPassed] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [manualOrderItems, setManualOrderItems] = useState<ManualOrderItem[]>([]);
  const [manualOrderCustomer, setManualOrderCustomer] = useState({ name: '', email: '' });
  const [manualOrderShipping, setManualOrderShipping] = useState('');
  const [manualOrderPayment, setManualOrderPayment] = useState('MB Way');
  const [chartTimeframe, setChartTimeframe] = useState<'7d' | '30d' | '1y'>('7d');
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [detailsModalData, setDetailsModalData] = useState<{ title: string; data: any[]; columns: { header: string; accessor: string | ((item: any) => React.ReactNode); }[]; total: number } | null>(null);
  const [isPublicIdEditable, setIsPublicIdEditable] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const [formData, setFormData] = useState({
    name: '', description: '', category: '', publicProductId: '' as string, variant: '',
    purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', 
    quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', cashbackValue: '',
    cashbackStatus: 'NONE' as CashbackStatus, badges: [] as string[], newImageUrl: '', 
    images: [] as string[], features: [] as string[], newFeature: '', comingSoon: false
  });

  const selectedPublicProductVariants = useMemo(() => {
      if (!formData.publicProductId) return [];
      const prod = publicProductsList.find(p => p.id === Number(formData.publicProductId));
      return prod?.variants || [];
  }, [formData.publicProductId, publicProductsList]);

  const [saleForm, setSaleForm] = useState({
    quantity: '1', unitPrice: '', shippingCost: '', date: new Date().toISOString().split('T')[0], notes: '', supplierName: '', supplierOrderId: ''
  });

  const pendingOrders = useMemo(() => allOrders.filter(o => ['Processamento', 'Pago'].includes(o.status)), [allOrders]);
  
  useEffect(() => {
      if (linkedOrderId) {
          const order = allOrders.find(o => o.id === linkedOrderId);
          setSelectedOrderForSaleDetails(order || null);
          if (selectedProductForSale && order) {
              const safeItems = getSafeItems(order.items);
              const isCompatible = safeItems.some(item => {
                  if (typeof item === 'string') return false; 
                  const idMatch = item.productId === selectedProductForSale.publicProductId;
                  const variantMatch = !selectedProductForSale.variant || (item.selectedVariant === selectedProductForSale.variant);
                  return idMatch && variantMatch;
              });
              if (!isCompatible) setOrderMismatchWarning("ATENÇÃO: Este produto NÃO consta na encomenda selecionada!");
              else setOrderMismatchWarning(null);

              if (order) {
                  const item = safeItems.find(i => typeof i !== 'string' && i.productId === selectedProductForSale.publicProductId) as OrderItem | undefined;
                  if (item) {
                      setSaleForm(prev => ({
                          ...prev, unitPrice: item.price.toString(), shippingCost: (order.total - (item.price * item.quantity)).toFixed(2)
                      }));
                  }
              }
          }
      } else {
          setSelectedOrderForSaleDetails(null);
          setOrderMismatchWarning(null);
      }
  }, [linkedOrderId, allOrders, selectedProductForSale]);

  useEffect(() => {
    if(!isAdmin) return;
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    const mountTime = Date.now();
    const unsubscribe = db.collection('orders').orderBy('date', 'desc').limit(10).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const order = change.doc.data() as Order;
                if (new Date(order.date).getTime() > (mountTime - 2000)) {
                    setNotifications(prev => [order, ...prev]);
                    setShowToast(order);
                    if (audioRef.current) audioRef.current.play().catch(() => {});
                    setTimeout(() => setShowToast(null), 5000);
                }
            }
        });
    });
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
      if (!isAdmin) return;
      const unsubscribe = db.collection('products_public').onSnapshot(snap => {
          const loadedProducts: Product[] = [];
          snap.forEach(doc => {
              const id = parseInt(doc.id, 10);
              if (!isNaN(id)) loadedProducts.push({ ...doc.data(), id } as Product);
          });
          setPublicProductsList(loadedProducts);
      });
      return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if(!isAdmin) return;
    const unsubscribe = db.collection('online_users').onSnapshot(snapshot => {
        const now = Date.now();
        const activeUsers: any[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data && typeof data.lastActive === 'number' && (now - data.lastActive < 30000)) {
                 activeUsers.push({ id: doc.id, ...data });
            }
        });
        setOnlineUsers(activeUsers);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if(!isAdmin) return;
    const unsubscribe = db.collection('orders').orderBy('date', 'desc').onSnapshot(snapshot => {
        setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
        setIsOrdersLoading(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
      if (activeTab === 'coupons' && isAdmin) {
          setIsCouponsLoading(true);
          const unsubscribe = db.collection('coupons').onSnapshot(snapshot => {
              setCoupons(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})) as Coupon[]);
              setIsCouponsLoading(false);
          });
          return () => unsubscribe();
      }
  }, [activeTab, isAdmin]);
  
  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = db.collection('stock_alerts').onSnapshot(snapshot => {
        const alerts: any[] = [];
        snapshot.forEach(doc => alerts.push({ id: doc.id, ...doc.data() }));
        setStockAlerts(alerts);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  const handleAddUnit = (code: string) => {
      if (modalUnits.some(u => u.id === code)) return alert("Este código já foi adicionado.");
      setModalUnits(prev => [...prev, { id: code, status: 'AVAILABLE', addedAt: new Date().toISOString() }]);
  };
  const handleRemoveUnit = (id: string) => setModalUnits(prev => prev.filter(u => u.id !== id));

  const handleSelectUnitForSale = (code: string) => {
    if (!selectedProductForSale) return;
    const unit = selectedProductForSale.units?.find(u => u.id === code);
    if (!unit) return alert("Erro: Este S/N não pertence a este lote de produto.");
    if (unit.status !== 'AVAILABLE') return alert("Erro: Este S/N já foi vendido ou está reservado.");
    if (selectedUnitsForSale.includes(code)) return alert("Aviso: Este S/N já foi adicionado a esta venda.");
    setSelectedUnitsForSale(prev => [...prev, code]);
    setSecurityCheckPassed(true);
  };
  
  const handleVerifyProduct = (code: string) => {
      if (!selectedProductForSale) return;
      const cleanCode = code.trim().toUpperCase();
      if (cleanCode === selectedProductForSale.publicProductId?.toString() || selectedProductForSale.units?.some(u => u.id.toUpperCase() === cleanCode)) {
          setSecurityCheckPassed(true);
          setVerificationCode(code);
      } else {
          alert(`Código ${code} NÃO corresponde a este produto! Verifique se pegou na caixa correta.`);
          setSecurityCheckPassed(false);
      }
  };

  const handleNotifySubscribers = (productId: number, productName: string, variantName?: string) => {
    const alertsForProduct = stockAlerts.filter(a => a.productId === productId && (variantName ? a.variantName === variantName : !a.variantName));
    if (alertsForProduct.length === 0) return alert("Nenhum cliente para notificar.");
    const emails = alertsForProduct.map(a => a.email);
    setNotificationModalData({
        productName: `${productName}${variantName ? ` (${variantName})` : ''}`,
        subject: `Temos novidades! O produto ${productName} está de volta!`,
        body: `Olá!\n\nBoas notícias! O produto "${productName}${variantName ? ` (${variantName})` : ''}" pelo qual mostrou interesse está novamente disponível na nossa loja.\n\nPode encontrá-lo aqui: ${window.location.origin}/#product/${productId}\n\nSeja rápido, o stock é limitado!\n\nCumprimentos,\nA equipa ${STORE_NAME}`,
        bcc: emails.join(', '),
        alertsToDelete: alertsForProduct
    });
  };
  
  const handleClearSentAlerts = async () => {
    if (!notificationModalData) return;
    try {
        const batch = db.batch();
        notificationModalData.alertsToDelete.forEach(alert => batch.delete(db.collection('stock_alerts').doc(alert.id)));
        await batch.commit();
    } catch (error) { alert("Ocorreu um erro ao limpar os alertas."); } finally { setNotificationModalData(null); }
  };
  
  const copyToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed'; textArea.style.top = '-9999px'; textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    let successful = false;
    try { successful = document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(textArea);
    return successful;
  };

  const handleCopyToClipboard = (text: string, type: string) => {
    if (copyToClipboard(text)) { setCopySuccess(type); setTimeout(() => setCopySuccess(''), 2000); } 
    else alert("Não foi possível copiar.");
  };

  const handleAddCoupon = async (e: React.FormEvent) => { e.preventDefault(); if (!newCoupon.code) return; try { await db.collection('coupons').add({ ...newCoupon, code: newCoupon.code.toUpperCase().trim() }); setNewCoupon({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0 }); alert("Cupão criado!"); } catch (err) { alert("Erro ao criar cupão"); } };
  const handleToggleCoupon = async (coupon: Coupon) => { if (!coupon.id) return; try { await db.collection('coupons').doc(coupon.id).update({ isActive: !coupon.isActive }); } catch(err) { console.error(err); } };
  const handleDeleteCoupon = async (id?: string) => { if (!id || !window.confirm("Apagar cupão?")) return; try { await db.collection('coupons').doc(id).delete(); } catch(err) { console.error(err); } };
  
  const handleOrderStatusChange = async (orderId: string, newStatus: string) => { 
      const order = allOrders.find(o => o.id === orderId);
      if (!order) return;
      if (newStatus === 'Cancelado' && !window.confirm("Tem a certeza que quer cancelar esta encomenda?")) return;
      try {
          const batch = db.batch();
          const orderRef = db.collection('orders').doc(orderId);
          batch.update(orderRef, { status: newStatus });

          if (newStatus === 'Cancelado' && order.status !== 'Cancelado') {
              for (const item of getSafeItems(order.items)) {
                  if (typeof item === 'object' && item.serialNumbers && item.serialNumbers.length > 0) {
                      const saleRecordId = `ORDER-${order.id}-${item.productId}`;
                      const invQuery = await db.collection('products_inventory').where('publicProductId', '==', item.productId).get();
                      for (const doc of invQuery.docs) {
                          const invProd = { id: doc.id, ...doc.data() } as InventoryProduct;
                          if ((invProd.units || []).some(u => item.serialNumbers!.includes(u.id))) {
                              const newUnits = (invProd.units || []).map(u => item.serialNumbers!.includes(u.id) ? { ...u, status: 'AVAILABLE' as const } : u);
                              const newSalesHistory = (invProd.salesHistory || []).filter(s => s.id !== saleRecordId);
                              const newQuantitySold = newUnits.filter(u => u.status === 'SOLD').length;
                              let newProdStatus: ProductStatus = 'IN_STOCK';
                              if (invProd.quantityBought > 0 && newQuantitySold >= invProd.quantityBought) newProdStatus = 'SOLD';
                              else if (newQuantitySold > 0) newProdStatus = 'PARTIAL';
                              batch.update(doc.ref, { units: newUnits, salesHistory: newSalesHistory, quantitySold: newQuantitySold, status: newProdStatus });
                              break; 
                          }
                      }
                  }
              }
          }
          if (newStatus === 'Entregue' && order && !order.pointsAwarded && order.userId) { 
              const userRef = db.collection('users').doc(order.userId); 
              const userSnap = await userRef.get(); 
              if (userSnap.exists) { 
                  const userData = userSnap.data() as UserType; 
                  const currentTier = userData.tier || 'Bronze'; 
                  let multiplier = LOYALTY_TIERS.BRONZE.multiplier; 
                  if (currentTier === 'Prata') multiplier = LOYALTY_TIERS.SILVER.multiplier; 
                  if (currentTier === 'Ouro') multiplier = LOYALTY_TIERS.GOLD.multiplier; 
                  const pointsEarned = Math.floor(order.total * multiplier); 
                  const newHistoryItem: PointHistory = { id: Date.now().toString(), date: new Date().toISOString(), amount: pointsEarned, reason: `Compra ${order.id} (${multiplier}x)`, orderId: order.id }; 
                  batch.update(userRef, { loyaltyPoints: firebase.firestore.FieldValue.increment(pointsEarned), pointsHistory: firebase.firestore.FieldValue.arrayUnion(newHistoryItem) });
                  batch.update(orderRef, { pointsAwarded: true }); 
                  alert(`Pontos atribuídos!\nCliente ganhou ${pointsEarned} pontos.\nNível atual: ${currentTier}`); 
              } 
          }
          await batch.commit();
          if (newStatus === 'Enviado' && !order.trackingNumber) setSelectedOrderDetails(order);
      } catch (error) { alert("Erro ao atualizar (Verifique consola)."); } 
  };

  const handleDeleteOrder = (orderId: string) => {
    if (!orderId) return;
    if (window.confirm(`Tem a certeza que quer APAGAR PERMANENTEMENTE a encomenda ${orderId}?`)) {
      db.collection('orders').doc(orderId).delete().then(() => alert('Encomenda apagada.')).catch((error: any) => alert("Erro ao apagar: " + error.message));
    }
  };

  const handleUpdateTracking = async (orderId: string, tracking: string) => { try { await db.collection('orders').doc(orderId).update({ trackingNumber: tracking }); if (selectedOrderDetails) setSelectedOrderDetails({...selectedOrderDetails, trackingNumber: tracking}); } catch (e) { alert("Erro ao gravar rastreio"); } };
  const handleCopy = (text: string) => { if (!copyToClipboard(text)) alert("Não foi possível copiar."); };
  const handleAskAi = async () => { if (!aiQuery.trim()) return; setIsAiLoading(true); setAiResponse(null); try { setAiResponse(await getInventoryAnalysis(products, aiQuery)); } catch (e) { setAiResponse("Não foi possível processar o pedido."); } finally { setIsAiLoading(false); } };
  
  const chartData = useMemo(() => { const numDays = chartTimeframe === '1y' ? 365 : chartTimeframe === '30d' ? 30 : 7; const toLocalISO = (dateStr: string) => { if (!dateStr) return ''; const d = new Date(dateStr); if (isNaN(d.getTime())) return ''; if (dateStr.length === 10 && !dateStr.includes('T')) return dateStr; const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0'); const day = d.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; }; const manualSales = products.flatMap(p => (p.salesHistory || []).map(s => ({ date: toLocalISO(s.date), total: (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0) }))); const onlineOrders = allOrders.filter(o => o.status !== 'Cancelado').map(o => ({ date: toLocalISO(o.date), total: (Number(o.total) || 0) })); const allSales = [...manualSales, ...onlineOrders]; const today = new Date(); let totalPeriod = 0; if (chartTimeframe === '1y') { const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(today.getMonth() - i, 1); return d; }).reverse(); const monthlyData = months.map(monthStart => { const year = monthStart.getFullYear(); const month = monthStart.getMonth() + 1; const monthStr = `${year}-${month.toString().padStart(2, '0')}`; const totalForMonth = allSales.reduce((acc, sale) => { return sale.date.startsWith(monthStr) ? acc + sale.total : acc; }, 0); totalPeriod += totalForMonth; return { label: monthStart.toLocaleDateString('pt-PT', { month: 'short' }), value: totalForMonth }; }); const maxValue = Math.max(...monthlyData.map(d => d.value), 1); return { days: monthlyData, maxValue, totalPeriod }; } else { const days = []; for (let i = numDays - 1; i >= 0; i--) { const d = new Date(); d.setDate(today.getDate() - i); const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0'); const day = d.getDate().toString().padStart(2, '0'); const dateLabel = `${year}-${month}-${day}`; const totalForDay = allSales.reduce((acc, sale) => sale.date === dateLabel ? acc + sale.total : acc, 0); totalPeriod += totalForDay; days.push({ label: d.toLocaleDateString('pt-PT', { day: 'numeric' }), date: dateLabel, value: totalForDay }); } const maxValue = Math.max(...days.map(d => d.value), 1); return { days, maxValue, totalPeriod }; } }, [allOrders, products, chartTimeframe]);
  const stats = useMemo(() => { let totalInvested = 0, realizedRevenue = 0, realizedProfit = 0, pendingCashback = 0, potentialProfit = 0; products.forEach(p => { const invested = (p.purchasePrice || 0) * (p.quantityBought || 0); totalInvested += invested; let revenue = 0, totalShippingPaid = 0; if (p.salesHistory && p.salesHistory.length > 0) { revenue = p.salesHistory.reduce((acc, sale) => acc + ((sale.quantity || 0) * (sale.unitPrice || 0)), 0); totalShippingPaid = p.salesHistory.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0); } else { revenue = (p.quantitySold || 0) * (p.salePrice || 0); } realizedRevenue += revenue; const cogs = (p.quantitySold || 0) * (p.purchasePrice || 0); const profitFromSales = revenue - cogs - totalShippingPaid; const cashback = p.cashbackStatus === 'RECEIVED' ? (p.cashbackValue || 0) : 0; realizedProfit += profitFromSales + cashback; if (p.cashbackStatus === 'PENDING') { pendingCashback += (p.cashbackValue || 0); } const remainingStock = (p.quantityBought || 0) - (p.quantitySold || 0); if (remainingStock > 0 && p.targetSalePrice) { potentialProfit += ((p.targetSalePrice || 0) - (p.purchasePrice || 0)) * remainingStock; } }); return { totalInvested, realizedRevenue, realizedProfit, pendingCashback, potentialProfit }; }, [products]);
  
  const handleEdit = (product: InventoryProduct) => { 
      setEditingId(product.id); 
      setFormData({ 
          name: product.name, description: product.description || '', category: product.category, publicProductId: product.publicProductId ? product.publicProductId.toString() : '', variant: product.variant || '', purchaseDate: product.purchaseDate, supplierName: product.supplierName || '', supplierOrderId: product.supplierOrderId || '', quantityBought: product.quantityBought.toString(), purchasePrice: product.purchasePrice.toString(), salePrice: product.salePrice ? product.salePrice.toString() : '', targetSalePrice: product.targetSalePrice ? product.targetSalePrice.toString() : '', cashbackValue: product.cashbackValue.toString(), cashbackStatus: product.cashbackStatus, badges: product.badges || [], images: product.images || [], newImageUrl: '', features: product.features || [], newFeature: '', comingSoon: product.comingSoon || false
      }); 
      setModalUnits(product.units || []); setIsPublicIdEditable(false); setIsModalOpen(true); 
  };

  const handleAddNew = () => { 
      setEditingId(null); 
      setFormData({ 
          name: '', description: '', category: 'TV Box', publicProductId: '', variant: '', purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', cashbackValue: '', cashbackStatus: 'NONE', badges: [], images: [], newImageUrl: '', features: [], newFeature: '', comingSoon: false
      }); 
      setModalUnits([]); setIsPublicIdEditable(false); setIsModalOpen(true); 
  };

  const handleCreateVariant = (parentProduct: InventoryProduct) => {
      setEditingId(null); 
      setFormData({ 
          name: parentProduct.name, description: parentProduct.description || '', category: parentProduct.category, publicProductId: parentProduct.publicProductId ? parentProduct.publicProductId.toString() : '', variant: '', purchaseDate: new Date().toISOString().split('T')[0], supplierName: parentProduct.supplierName || '', supplierOrderId: '', quantityBought: '', purchasePrice: parentProduct.purchasePrice.toString(), salePrice: parentProduct.salePrice ? parentProduct.salePrice.toString() : '', targetSalePrice: parentProduct.targetSalePrice ? parentProduct.targetSalePrice.toString() : '', cashbackValue: '', cashbackStatus: 'NONE', badges: parentProduct.badges || [], images: parentProduct.images || [], newImageUrl: '', features: parentProduct.features || [], newFeature: '', comingSoon: parentProduct.comingSoon || false
      }); 
      setModalUnits([]); setIsPublicIdEditable(false); setIsModalOpen(true);
  };

  const handlePublicProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => { 
      const selectedId = e.target.value; 
      setFormData(prev => ({ ...prev, publicProductId: selectedId, variant: '' })); 
      if (selectedId) { 
          const publicProd = publicProductsList.find(p => p.id === Number(selectedId)); 
          if (publicProd) setFormData(prev => ({ ...prev, publicProductId: selectedId, name: publicProd.name, category: publicProd.category })); 
      } 
  };
  
  const handleAddImage = () => { if (formData.newImageUrl && formData.newImageUrl.trim()) { setFormData(prev => ({ ...prev, images: [...prev.images, prev.newImageUrl.trim()], newImageUrl: '' })); } };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
          alert("O ficheiro é demasiado grande. Máximo 5MB.");
          return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      const fileExtension = file.name.split('.').pop() || 'jpg';
      const storageRef = storage.ref();
      const fileRef = storageRef.child(`products/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`);
      
      const uploadTask = fileRef.put(file);

      uploadTask.on(
          'state_changed',
          (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
          },
          (error) => {
              console.error("Firebase Storage Upload Error:", error);
              let userMessage = `Erro no upload: ${error.code}`;
              
              if (error.code === 'storage/unauthorized') {
                  userMessage = "ERRO DE PERMISSÃO (REGRAS): Verifique se está logado como administrador e se as 'storage.rules' no seu projeto permitem escrita no caminho 'products/'.";
              } else if (error.code === 'storage/unknown' && navigator.onLine) {
                   userMessage = "ERRO DE CORS: O seu domínio (www.all-shop.net) não está autorizado a fazer uploads. Isto é uma configuração de segurança no Google Cloud, não no código. Contacte o suporte para saber como configurar o CORS do seu bucket do Firebase Storage.";
              } else if (!navigator.onLine) {
                  userMessage = "ERRO DE REDE: Verifique a sua ligação à internet.";
              }

              alert(userMessage);
              setIsUploading(false);
              setUploadProgress(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
          },
          () => {
              uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                  setFormData(prev => ({ ...prev, images: [...prev.images, downloadURL] }));
                  setIsUploading(false);
                  setUploadProgress(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
              }).catch(urlError => {
                   console.error("Error getting download URL:", urlError);
                   alert("Upload concluído, mas falhou ao obter o link da imagem.");
                   setIsUploading(false);
                   setUploadProgress(null);
              });
          }
      );
  };

  const handleRemoveImage = (indexToRemove: number) => { setFormData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== indexToRemove) })); };
  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
      if ((direction === 'left' && index === 0) || (direction === 'right' && index === formData.images.length - 1)) return;
      const newImages = [...formData.images]; const targetIndex = direction === 'left' ? index - 1 : index + 1;
      [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
      setFormData(prev => ({ ...prev, images: newImages }));
  };
  const handleAddFeature = () => { if (formData.newFeature && formData.newFeature.trim()) { setFormData(prev => ({ ...prev, features: [...prev.features, prev.newFeature.trim()], newFeature: '' })); } };
  const handleRemoveFeature = (indexToRemove: number) => { setFormData(prev => ({ ...prev, features: prev.features.filter((_, idx) => idx !== indexToRemove) })); };

  const handleProductSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (selectedPublicProductVariants.length > 0 && !formData.variant) return alert("Selecione a variante.");
      
      const qBought = Number(formData.quantityBought) || 0; 
      const existingProduct = products.find(p => p.id === editingId); 
      const currentSold = existingProduct ? existingProduct.quantitySold : 0; 
      const currentSalePrice = formData.salePrice ? Number(formData.salePrice) : 0; 
      
      let productStatus: ProductStatus = 'IN_STOCK';
      if (currentSold >= qBought && qBought > 0) productStatus = 'SOLD';
      else if (currentSold > 0) productStatus = 'PARTIAL';
      
      const payload: any = { 
          name: formData.name, description: formData.description, category: formData.category, publicProductId: formData.publicProductId ? Number(formData.publicProductId) : null, variant: formData.variant || null, purchaseDate: formData.purchaseDate, supplierName: formData.supplierName, supplierOrderId: formData.supplierOrderId, quantityBought: qBought, quantitySold: currentSold, salesHistory: (existingProduct && Array.isArray(existingProduct.salesHistory)) ? existingProduct.salesHistory : [], purchasePrice: Number(formData.purchasePrice) || 0, targetSalePrice: formData.targetSalePrice ? Number(formData.targetSalePrice) : null, salePrice: currentSalePrice, cashbackValue: Number(formData.cashbackValue) || 0, cashbackStatus: formData.cashbackStatus, units: modalUnits, status: productStatus, badges: formData.badges, images: formData.images, features: formData.features, comingSoon: formData.comingSoon
      }; 
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]); 
      try { 
          if (editingId) await updateProduct(editingId, payload); else await addProduct(payload); setIsModalOpen(false); 
      } catch (err) { alert('Erro ao guardar.'); } 
  };
  
  const toggleBadge = (badge: string) => { setFormData(prev => { const badges = prev.badges || []; if (badges.includes(badge)) return { ...prev, badges: badges.filter(b => b !== badge) }; else return { ...prev, badges: [...badges, badge] }; }); };

  const openSaleModal = (product: InventoryProduct) => { 
    setSelectedProductForSale(product); 
    setSaleForm({ quantity: '1', unitPrice: product.salePrice ? product.salePrice.toString() : product.targetSalePrice ? product.targetSalePrice.toString() : '', shippingCost: '', date: new Date().toISOString().split('T')[0], notes: '', supplierName: product.supplierName || '', supplierOrderId: product.supplierOrderId || '' });
    setSelectedUnitsForSale([]); setLinkedOrderId(''); setSelectedOrderForSaleDetails(null); setOrderMismatchWarning(null); setSecurityCheckPassed(false); setVerificationCode(''); setIsSaleModalOpen(true); 
  };
  
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForSale || !linkedOrderId) return alert("Associe a uma encomenda.");
    if (orderMismatchWarning) return alert("SEGURANÇA: Produto errado.");
    if (!securityCheckPassed) return alert("SEGURANÇA: Scan obrigatório.");

    const linkedOrder = allOrders.find(o => o.id === linkedOrderId);
    if (!linkedOrder) return alert("Encomenda não encontrada.");

    const hasUnits = selectedProductForSale.units && selectedProductForSale.units.length > 0;
    const orderItem = getSafeItems(linkedOrder.items).find(item => typeof item === 'object' && item.productId === selectedProductForSale.publicProductId) as OrderItem | undefined;
    const qty = hasUnits ? selectedUnitsForSale.length : (Number(saleForm.quantity) || orderItem?.quantity || 1);
    
    if (qty <= 0) return alert("Quantidade inválida.");
    const remainingStock = (selectedProductForSale.quantityBought || 0) - (selectedProductForSale.quantitySold || 0);
    if (qty > remainingStock) return alert(`Stock insuficiente.`);

    const batch = db.batch();
    const invProductRef = db.collection('products_inventory').doc(selectedProductForSale.id);
    const newSaleRecord: SaleRecord = { 
        id: `ORDER-${linkedOrderId}-${selectedProductForSale.publicProductId}`, 
        date: new Date().toISOString(), 
        quantity: qty, 
        unitPrice: Number(saleForm.unitPrice) || orderItem?.price || 0, 
        shippingCost: Number(saleForm.shippingCost) || 0, 
        notes: `Venda Online - Pedido ${linkedOrderId}` 
    };

    const existingHistory = selectedProductForSale.salesHistory || [];
    const newHistory = existingHistory.filter(s => s.id !== newSaleRecord.id);
    newHistory.push(newSaleRecord);

    let updatedUnits = selectedProductForSale.units || [];
    if (hasUnits) updatedUnits = updatedUnits.map(u => selectedUnitsForSale.includes(u.id) ? { ...u, status: 'SOLD' } : u);

    const newQuantitySold = hasUnits ? updatedUnits.filter(u => u.status === 'SOLD').length : (selectedProductForSale.quantitySold || 0) + qty;
    
    let newStatus: ProductStatus = 'IN_STOCK';
    if (newQuantitySold >= selectedProductForSale.quantityBought && selectedProductForSale.quantityBought > 0) {
        newStatus = 'SOLD';
    } else if (newQuantitySold > 0) {
        newStatus = 'PARTIAL';
    }
    
    const invUpdatePayload: Partial<InventoryProduct> = { 
        status: newStatus, 
        quantitySold: newQuantitySold, 
        salesHistory: newHistory 
    };
    if (hasUnits) invUpdatePayload.units = updatedUnits;
    
    batch.update(invProductRef, invUpdatePayload);
    
    const orderRef = db.collection('orders').doc(linkedOrderId);
    const updatedItems = getSafeItems(linkedOrder.items).map(item => {
        if (typeof item === 'object' && item.productId === selectedProductForSale.publicProductId && (!item.selectedVariant || item.selectedVariant === selectedProductForSale.variant)) {
            return { ...item, serialNumbers: [...(item.serialNumbers || []), ...selectedUnitsForSale] };
        }
        return item;
    });
    batch.update(orderRef, { items: updatedItems, status: 'Enviado' });
    
    try { await batch.commit(); setIsSaleModalOpen(false); alert("Baixa registada!"); } catch (err) { alert("Erro ao registar."); }
  };

  const handleDeleteSale = async (saleId: string) => { if (!editingId) return; const product = products.find(p => p.id === editingId); if (!product || !product.salesHistory) return; const saleToDelete = product.salesHistory.find(s => s.id === saleId); if (!saleToDelete) return; if (!window.confirm(`Anular venda?`)) return; const newHistory = product.salesHistory.filter(s => s.id !== saleId); const newQuantitySold = product.quantitySold - saleToDelete.quantity; const totalRevenue = newHistory.reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0); const totalUnitsSold = newHistory.reduce((acc, s) => acc + s.quantity, 0); const newAverageSalePrice = totalUnitsSold > 0 ? totalRevenue / totalUnitsSold : 0; let newStatus: ProductStatus = 'IN_STOCK'; if (newQuantitySold >= product.quantityBought && product.quantityBought > 0) newStatus = 'SOLD'; else if (newQuantitySold > 0) newStatus = 'PARTIAL'; try { await updateProduct(product.id, { salesHistory: newHistory, quantitySold: Math.max(0, newQuantitySold), salePrice: newAverageSalePrice, status: newStatus }); alert("Venda anulada!"); } catch (err) { alert("Erro ao anular."); } };
  const handleDelete = async (id: string) => { if (!id) return; if (window.confirm('Apagar registo?')) { try { await deleteProduct(id); } catch (error: any) { alert("Erro: " + error.message); } } };
  
  const handleDeleteGroup = async (groupId: string, items: InventoryProduct[]) => {
    if (!window.confirm(`Apagar grupo "${items[0].name}" e ${items.length} lotes?`)) return;
    try {
        const batch = db.batch();
        items.forEach(item => batch.delete(db.collection('products_inventory').doc(item.id)));
        if (items[0].publicProductId) batch.delete(db.collection('products_public').doc(items[0].publicProductId.toString()));
        await batch.commit();
    } catch (e) { alert("Erro ao apagar grupo."); }
  };
  
  const handleRecalculateData = async () => {
    if (!window.confirm("Esta ação irá verificar todos os produtos, remover registos de vendas duplicados e corrigir os totais de stock vendido. É recomendado para corrigir erros de dados. Deseja continuar?")) return;

    setIsRecalculating(true);
    let correctedCount = 0;
    try {
      for (const product of products) {
        if (!product.salesHistory || product.salesHistory.length === 0) continue;

        // 1. Remover vendas duplicadas (baseado no ID da venda)
        const uniqueSales = new Map<string, SaleRecord>();
        for (const sale of product.salesHistory) {
          uniqueSales.set(sale.id, sale);
        }
        const newSalesHistory = Array.from(uniqueSales.values());

        // 2. Recalcular 'quantitySold' a partir do histórico limpo
        const newQuantitySold = newSalesHistory.reduce((acc, sale) => acc + (sale.quantity || 0), 0);

        // 3. Recalcular o 'status' do produto
        let newStatus: ProductStatus = 'IN_STOCK';
        if (product.quantityBought > 0 && newQuantitySold >= product.quantityBought) {
          newStatus = 'SOLD';
        } else if (newQuantitySold > 0) {
          newStatus = 'PARTIAL';
        }

        // 4. Verificar se houve alguma alteração
        const hasChanges = (
          newSalesHistory.length !== product.salesHistory.length ||
          newQuantitySold !== product.quantitySold ||
          newStatus !== product.status
        );

        if (hasChanges) {
          correctedCount++;
          await updateProduct(product.id, {
            salesHistory: newSalesHistory,
            quantitySold: newQuantitySold,
            status: newStatus,
          });
        }
      }
      if (correctedCount > 0) {
        alert(`Verificação concluída! ${correctedCount} produto(s) foram corrigidos.`);
      } else {
        alert("Verificação concluída. Não foram encontrados erros de dados.");
      }
    } catch (error) {
      alert("Ocorreu um erro durante a verificação. Verifique a consola.");
      console.error("Data recalculation error:", error);
    } finally {
      setIsRecalculating(false);
    }
  };

  const filteredProducts = products.filter(p => { 
      const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = true; 
      if (statusFilter === 'IN_STOCK') matchesStatus = p.status !== 'SOLD'; 
      if (statusFilter === 'SOLD') matchesStatus = p.status === 'SOLD'; 
      let matchesCashback = true; 
      if (cashbackFilter !== 'ALL') matchesCashback = p.cashbackStatus === cashbackFilter; 
      return matchesSearch && matchesStatus && matchesCashback; 
  });

  const groupedInventory = useMemo(() => {
      const groups: { [key: string]: InventoryProduct[] } = {};
      filteredProducts.forEach(p => { const key = p.publicProductId ? p.publicProductId.toString() : `local-${p.id}`; if (!groups[key]) groups[key] = []; groups[key].push(p); });
      return Object.entries(groups).sort(([, itemsA], [, itemsB]) => (itemsA[0]?.name || '').localeCompare(itemsB[0]?.name || ''));
  }, [filteredProducts]);

  const toggleGroup = (groupId: string) => { setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]); };
  
  const productsForSelect = useMemo(() => publicProductsList.filter(p => !p.comingSoon).flatMap(p => { if (p.variants?.length) return p.variants.map(v => ({ value: `${p.id}|${v.name}`, label: `${p.name} - ${v.name}` })); return { value: `${p.id}|`, label: p.name }; }), [publicProductsList]);

  const addProductToManualOrder = (value: string) => { if (!value) return; const [idStr, variantName] = value.split('|'); const product = publicProductsList.find(p => p.id === Number(idStr)); if (!product) return; const key = `${product.id}|${variantName}`; setManualOrderItems(prev => { const existing = prev.find(item => `${item.id}|${item.selectedVariant}` === key); if (existing) return prev.map(item => (`${item.id}|${item.selectedVariant}` === key) ? { ...item, quantity: item.quantity + 1 } : item); let finalPrice = product.price; if (variantName) { const variant = product.variants?.find(v => v.name === variantName); if (variant) finalPrice = variant.price; } return [...prev, { ...product, quantity: 1, selectedVariant: variantName, finalPrice: finalPrice }]; }); };
  const updateManualOrderItemQuantity = (key: string, delta: number) => { setManualOrderItems(prev => prev.map(item => { if (`${item.id}|${item.selectedVariant}` === key) { const newQuantity = item.quantity + delta; return newQuantity > 0 ? { ...item, quantity: newQuantity } : item; } return item; }).filter(item => item.quantity > 0)); };
  const handleManualOrderSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (manualOrderItems.length === 0) return alert("Adicione produtos."); try { await db.runTransaction(async (transaction) => { let userId: string | null = null; if (manualOrderCustomer.email) { const userQuery = await db.collection('users').where('email', '==', manualOrderCustomer.email.trim().toLowerCase()).limit(1).get(); if (!userQuery.empty) userId = userQuery.docs[0].id; } const total = manualOrderItems.reduce((acc, item) => acc + item.finalPrice * item.quantity, 0); const newOrder: Order = { id: `MANUAL-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), total, status: 'Processamento', items: manualOrderItems.map(item => ({ productId: item.id, name: item.name, price: item.finalPrice, quantity: item.quantity, selectedVariant: item.selectedVariant || '', addedAt: new Date().toISOString() })), userId: userId, shippingInfo: { name: manualOrderCustomer.name, email: manualOrderCustomer.email, street: manualOrderShipping, doorNumber: '', city: '', zip: '', phone: '', paymentMethod: manualOrderPayment as any, } }; const orderRef = db.collection('orders').doc(newOrder.id); transaction.set(orderRef, newOrder); for (const item of manualOrderItems) { const invQuery = db.collection('products_inventory').where('publicProductId', '==', item.id); const finalQuery = item.selectedVariant ? invQuery.where('variant', '==', item.selectedVariant) : invQuery; const invSnapshot = await finalQuery.get(); if (!invSnapshot.empty) { const invDoc = invSnapshot.docs[0]; const invData = invDoc.data() as InventoryProduct; const newQuantitySold = invData.quantitySold + item.quantity; let newStatus: ProductStatus = invData.status; if (newQuantitySold >= invData.quantityBought) newStatus = 'SOLD'; transaction.update(invDoc.ref, { quantitySold: newQuantitySold, status: newStatus }); } } }); alert('Encomenda manual criada!'); setIsManualOrderModalOpen(false); setManualOrderItems([]); } catch (error) { console.error(error); alert("Erro ao criar."); } };
  
  const handleOpenInvestedModal = () => { setDetailsModalData({ title: "Detalhe do Investimento", data: products.map(p => ({ id: p.id, name: p.name, qty: p.quantityBought, cost: p.purchasePrice, total: p.quantityBought * p.purchasePrice })).filter(i => i.total > 0).sort((a,b) => b.total - a.total), total: stats.totalInvested, columns: [{ header: "Produto", accessor: "name" }, { header: "Qtd. Comprada", accessor: "qty" }, { header: "Custo Unit.", accessor: (i) => formatCurrency(i.cost) }, { header: "Total", accessor: (i) => formatCurrency(i.total) }] }); };
  const handleOpenRevenueModal = () => { setDetailsModalData({ title: "Receita Realizada", data: products.flatMap(p => (p.salesHistory || []).map(s => ({ id: s.id, name: p.name, date: s.date, qty: s.quantity, val: s.quantity * s.unitPrice }))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), total: stats.realizedRevenue, columns: [{ header: "Data", accessor: (i) => new Date(i.date).toLocaleDateString() }, { header: "Produto", accessor: "name" }, { header: "Qtd", accessor: "qty" }, { header: "Valor", accessor: (i) => formatCurrency(i.val) }] }); };
  const handleOpenProfitModal = () => { setDetailsModalData({ title: "Lucro Líquido por Produto", data: products.map(p => { const revenue = (p.salesHistory || []).reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0); const cogs = p.quantitySold * p.purchasePrice; const cashback = p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0; return { id: p.id, name: p.name, profit: revenue - cogs + cashback }; }).filter(p => p.profit !== 0).sort((a,b) => b.profit - a.profit), total: stats.realizedProfit, columns: [{ header: "Produto", accessor: "name" }, { header: "Lucro", accessor: (i) => <span className={i.profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{formatCurrency(i.profit)}</span> }] }); };
  const handleOpenCashbackModal = () => { setDetailsModalData({ title: "Cashback Pendente", data: products.filter(p => p.cashbackStatus === 'PENDING').map(p => ({ id: p.id, name: p.name, val: p.cashbackValue })), total: stats.pendingCashback, columns: [{ header: "Produto", accessor: "name" }, { header: "Valor", accessor: (i) => formatCurrency(i.val) }] }); };
  const handleImportProducts = async () => { if (!window.confirm("Importar produtos?")) return; setIsImporting(true); try { for (const p of INITIAL_PRODUCTS) await addProduct({ name: p.name, category: p.category, description: p.description, publicProductId: p.id, variant: null, purchaseDate: new Date().toISOString(), quantityBought: p.stock || 10, quantitySold: 0, purchasePrice: p.price * 0.6, salePrice: p.price, status: (p.stock || 0) > 0 ? 'IN_STOCK' : 'SOLD', images: p.images || (p.image ? [p.image] : []), features: p.features || [], comingSoon: p.comingSoon || false, cashbackStatus: 'NONE', cashbackValue: 0 }); alert("Importação concluída."); } catch (e) { alert("Erro."); } finally { setIsImporting(false); } };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 animate-fade-in relative">
      {showToast && <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right"><div className="bg-white border-l-4 border-green-500 shadow-2xl rounded-r-lg p-4 flex items-start gap-3 w-80"><div className="text-green-500 bg-green-50 p-2 rounded-full"><DollarSign size={24} /></div><div className="flex-1"><h4 className="font-bold text-gray-900">Nova Venda Online!</h4><p className="text-sm text-gray-600 mt-1">Pedido {showToast.id.startsWith('#') ? '' : '#'}{showToast.id.toUpperCase()}</p><p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(showToast.total)}</p></div><button onClick={() => setShowToast(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div></div>}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 flex flex-col md:flex-row md:h-20 items-center justify-between gap-4 md:gap-0 py-4 md:py-0">
          <div className="flex items-center gap-3 w-full justify-between md:w-auto">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg text-white"><LayoutDashboard size={24} /></div>
                <h1 className="text-xl font-bold text-gray-900">Backoffice</h1>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <div className="relative"><button onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{notifications.length}</span>}</button></div>
                 <button onClick={() => window.location.hash = '/'} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Voltar à Loja"><Home size={20} /></button>
              </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="w-full md:w-auto flex flex-col md:flex-row bg-gray-100 p-1 rounded-lg gap-1 md:gap-0">
                <button onClick={() => setActiveTab('inventory')} className={`w-full md:w-auto px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Package size={16} /> Inventário</button>
                <button onClick={() => setActiveTab('orders')} className={`w-full md:w-auto px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><ShoppingCart size={16} /> Encomendas</button>
                <button onClick={() => setActiveTab('coupons')} className={`w-full md:w-auto px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'coupons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><TicketPercent size={16} /> Cupões</button>
            </div>
            <div className="hidden md:flex items-center gap-3">
                <div className="relative"><button onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{notifications.length}</span>}</button>{isNotifDropdownOpen && <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"><div className="p-3 border-b border-gray-100 bg-gray-50"><h4 className="text-sm font-bold text-gray-700">Notificações</h4></div><div className="max-h-64 overflow-y-auto">{notifications.map((n, idx) => <div key={idx} className="p-3 border-b border-gray-100 hover:bg-gray-50 last:border-0"><div className="flex justify-between items-start"><span className="font-bold text-xs text-indigo-600">{n.id.startsWith('#') ? '' : '#'}{n.id.toUpperCase()}</span></div><p className="text-sm font-medium mt-1">Venda: {formatCurrency(n.total)}</p></div>)}</div></div>}</div>
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                <button onClick={() => window.location.hash = '/'} className="text-gray-500 hover:text-gray-700 font-medium px-3 py-2 text-sm">Voltar à Loja</button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        
        {/* --- INVENTORY TAB --- */}
        {activeTab === 'inventory' && <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <KpiCard title="Total Investido" value={stats.totalInvested} icon={<Package size={18} />} color="blue" onClick={handleOpenInvestedModal} />
                <KpiCard title="Vendas Reais" value={stats.realizedRevenue} icon={<DollarSign size={18} />} color="indigo" onClick={handleOpenRevenueModal} />
                <KpiCard title="Lucro Líquido" value={stats.realizedProfit} icon={<TrendingUp size={18} />} color={stats.realizedProfit >= 0 ? "green" : "red"} onClick={handleOpenProfitModal} />
                <KpiCard title="Cashback Pendente" value={stats.pendingCashback} icon={<AlertCircle size={18} />} color="yellow" onClick={handleOpenCashbackModal} />
                <div onClick={() => setIsOnlineDetailsOpen(true)} className="p-4 rounded-xl border bg-white shadow-sm flex flex-col justify-between h-full cursor-pointer hover:border-green-300 transition-colors relative overflow-hidden"><div className="flex justify-between items-start mb-2"><span className="text-gray-500 text-xs font-bold uppercase flex items-center gap-1">Online Agora</span><div className="p-1.5 rounded-lg bg-green-50 text-green-600 relative"><Users size={18} /><span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span></div></div><div className="text-2xl font-bold text-green-600 flex items-end gap-2">{onlineUsers.length}<span className="text-xs text-gray-400 font-normal mb-1">visitantes</span></div></div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 mb-8 animate-fade-in"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Bot size={20} /></div><div><h3 className="font-bold text-gray-900">Consultor Estratégico IA</h3><p className="text-xs text-gray-500">Pergunte sobre promoções, bundles ou como vender stock parado.</p></div></div><div className="flex flex-col sm:flex-row gap-2"><input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Ex: Como posso vender as TV Boxes H96 mais rápido sem perder dinheiro? Sugere bundles." className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAskAi()} /><button onClick={handleAskAi} disabled={isAiLoading || !aiQuery.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">{isAiLoading ? 'A pensar...' : <><Sparkles size={18} /> Gerar</>}</button></div>{aiResponse && <div className="mt-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-gray-700 text-sm leading-relaxed whitespace-pre-line animate-fade-in-down">{aiResponse}</div>}</div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4 text-xs font-medium text-gray-500"><span>Total: {products.length}</span><span className="w-px h-4 bg-gray-300"></span><span className="text-green-600">Stock: {products.filter(p => p.status !== 'SOLD').length}</span><span className="w-px h-4 bg-gray-300"></span><span className="text-red-600">Esgotados: {products.filter(p => p.status === 'SOLD').length}</span></div><div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4"><div className="flex gap-2 w-full lg:w-auto"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Estados</option><option value="IN_STOCK">Em Stock</option><option value="SOLD">Esgotado</option></select><select value={cashbackFilter} onChange={(e) => setCashbackFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Cashbacks</option><option value="PENDING">Pendente</option><option value="RECEIVED">Recebido</option></select></div><div className="flex gap-2 w-full lg:w-auto"><div className="relative flex-1"><input type="text" placeholder="Pesquisar ou escanear..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/></div>
            <button onClick={() => { setScannerMode('search'); setIsScannerOpen(true); }} className="bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors" title="Escanear Código de Barras"><Camera size={18} /></button>
            <button onClick={handleImportProducts} disabled={isImporting} className="bg-yellow-500 text-white px-3 py-2 rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1" title="Importar e Corrigir Produtos">{isImporting ? '...' : <UploadCloud size={18} />}</button>
            <button onClick={handleRecalculateData} disabled={isRecalculating} className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1" title="Recalcular Stock e Vendas">{isRecalculating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
            <button onClick={handleAddNew} className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={18} /></button></div></div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr><th className="px-6 py-3 w-10"></th><th className="px-6 py-3">Produto (Loja)</th><th className="px-4 py-3 text-center">Stock Total</th><th className="px-4 py-3 text-center">Estado Geral</th><th className="px-4 py-3 text-right">Preço Loja</th><th className="px-4 py-3 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {groupedInventory.map(([groupId, items]) => {
                    const mainItem = items[0]; const isExpanded = expandedGroups.includes(groupId);
                    const totalStock = items.reduce((acc, i) => acc + Math.max(0, (i.quantityBought || 0) - (i.quantitySold || 0)), 0);
                    return (
                      <React.Fragment key={groupId}>
                        <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-6 py-4"><button onClick={() => toggleGroup(groupId)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">{isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}</button></td>
                          <td className="px-6 py-4"><div className="flex items-center gap-3">{mainItem.images && mainItem.images[0] && (<img src={mainItem.images[0]} className="w-10 h-10 object-cover rounded bg-white border border-gray-200" alt="" />)}<div><div className="font-bold text-gray-900">{mainItem.name}</div><div className="text-xs text-gray-500">{mainItem.category} • {items.length} Lote(s)</div></div></div></td>
                          <td className="px-4 py-4 text-center"><span className={`font-bold px-2 py-1 rounded ${totalStock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{totalStock} un.</span></td>
                          <td className="px-4 py-4 text-center">{mainItem.comingSoon ? (<span className="text-purple-600 font-bold text-xs uppercase bg-purple-100 px-2 py-1 rounded">Em Breve</span>) : (<span className={`text-xs font-bold uppercase ${totalStock > 0 ? 'text-green-600' : 'text-red-500'}`}>{totalStock > 0 ? 'Disponível' : 'Esgotado'}</span>)}</td>
                          <td className="px-4 py-4 text-right font-medium">{formatCurrency(mainItem.salePrice || mainItem.targetSalePrice || 0)}</td>
                          <td className="px-4 py-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => handleEdit(mainItem)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"><Edit2 size={14} /> Editar Loja</button><button onClick={() => handleCreateVariant(mainItem)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Layers size={16} /></button><button onClick={() => handleDeleteGroup(groupId, items)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div></td>
                        </tr>
                        {isExpanded && (
                            <tr className="bg-gray-50/50 border-b border-gray-200"><td colSpan={6} className="px-4 py-4"><div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm ml-10"><table className="w-full text-xs"><thead className="bg-gray-100 text-gray-500 uppercase"><tr><th className="px-4 py-2 text-left">Lote / Variante</th><th className="px-4 py-2 text-left">Origem</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-right">Compra</th><th className="px-4 py-2 text-right">Venda (Estimada)</th><th className="px-4 py-2 text-center">Cashback / Lucro</th><th className="px-4 py-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map(p => { const batchStock = (p.quantityBought || 0) - (p.quantitySold || 0); return ( <tr key={p.id} className="hover:bg-blue-50 transition-colors"><td className="px-4 py-3"><div className="font-bold whitespace-normal">{new Date(p.purchaseDate).toLocaleDateString()}</div>{p.variant && <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1 rounded">{p.variant}</span>}<div className="text-[10px] text-gray-400 mt-0.5">{p.description?.substring(0, 30)}...</div></td>
<td className="px-4 py-3">
    {p.supplierName ? (
        <div>
            <div className="flex items-center gap-1 font-bold text-gray-700 text-[10px]">
                <Globe size={10} className="text-indigo-500" /> {p.supplierName}
            </div>
            {p.supplierOrderId && (
                <div className="text-[10px] text-gray-500 flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded w-fit mt-1 group cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleCopy(p.supplierOrderId!)} title="Clique para copiar">
                    <FileText size={10} /> {p.supplierOrderId} <Copy size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            )}
        </div>
    ) : <span className="text-gray-400 text-xs">-</span>}
</td>
<td className="px-4 py-3 text-center">
    <div className="flex justify-center text-[10px] mb-1 font-medium text-gray-600"><span>{batchStock} un.</span></div>
    <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden mx-auto">
        <div className={`h-full rounded-full ${ (p.quantityBought || 0) > 0 && ((p.quantitySold || 0) / (p.quantityBought || 1)) >= 1 ? 'bg-gray-400' : 'bg-blue-500'}`} style={{ width: `${(p.quantityBought || 0) > 0 ? (((p.quantitySold || 0) / (p.quantityBought || 1)) * 100) : 0}%` }}></div>
    </div>
    {p.units && p.units.length > 0 && (
    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 max-w-[200px] mx-auto">
        {p.units.sort((a,b) => a.status.localeCompare(b.status)).map(unit => {
            const statusColor = unit.status === 'AVAILABLE' 
                ? 'bg-green-100 text-green-800' 
                : unit.status === 'SOLD' 
                ? 'bg-red-100 text-red-700' 
                : 'bg-yellow-100 text-yellow-800';
            const statusText = unit.status === 'AVAILABLE' ? 'Disponível' : unit.status === 'SOLD' ? 'Vendido' : 'Reservado';
            
            return (
                <div key={unit.id} className="flex justify-between items-center text-[10px] group">
                    <div className="flex items-center gap-2">
                        <span className={`font-mono ${unit.status !== 'AVAILABLE' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{unit.id}</span>
                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>{statusText}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">{new Date(unit.addedAt).toLocaleDateString('pt-PT')}</span>
                        <button onClick={() => handleCopy(unit.id)} title="Copiar S/N" className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Copy size={10} />
                        </button>
                    </div>
                </div>
            );
        })}
    </div>
)}
</td>
<td className="px-4 py-3 text-right">{formatCurrency(p.purchasePrice)}</td><td className="px-4 py-3 text-right text-gray-500">{p.targetSalePrice ? formatCurrency(p.targetSalePrice) : '-'}</td><td className="px-4 py-3 text-center">{p.cashbackValue > 0 ? (<div className="flex flex-col items-center gap-1"><div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${p.cashbackStatus === 'RECEIVED' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>{formatCurrency(p.cashbackValue)} {p.cashbackStatus === 'PENDING' && <AlertCircle size={8} />}</div></div>) : (<span className="text-gray-300 text-[10px]">-</span>)}</td><td className="px-4 py-3 text-right flex justify-end gap-1">{batchStock > 0 && <button onClick={() => openSaleModal(p)} className="text-green-600 hover:bg-green-50 p-1.5 rounded bg-white border border-green-200 shadow-sm" title="Vender deste lote"><DollarSign size={14}/></button>}<button onClick={() => handleEdit(p)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded bg-white border border-gray-200 shadow-sm" title="Editar este lote"><Edit2 size={14}/></button><button onClick={() => handleDelete(p.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded bg-white border border-red-200 shadow-sm" title="Apagar lote"><Trash2 size={14}/></button></td></tr> ); })}</tbody></table></div></td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div></div></>}
        
        {/* --- ORDERS TAB --- */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><div className="flex justify-between items-center mb-6"><div className="flex items-center gap-4"><h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart2 className="text-indigo-600" /> Faturação Geral</h3><div className="bg-gray-100 p-1 rounded-lg flex gap-1 text-xs font-medium"><button onClick={() => setChartTimeframe('7d')} className={`px-2 py-1 rounded ${chartTimeframe === '7d' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>7D</button><button onClick={() => setChartTimeframe('30d')} className={`px-2 py-1 rounded ${chartTimeframe === '30d' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>30D</button><button onClick={() => setChartTimeframe('1y')} className={`px-2 py-1 rounded ${chartTimeframe === '1y' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>1A</button></div></div><span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Total: {formatCurrency(chartData.totalPeriod)}</span></div><div className="flex items-stretch h-64 gap-4"><div className="flex flex-col justify-between text-xs font-medium text-gray-400 py-2 min-w-[30px] text-right"><span>{formatCurrency(chartData.maxValue)}</span><span>{formatCurrency(chartData.maxValue / 2)}</span><span>0€</span></div><div className="flex items-end flex-1 gap-2 md:gap-4 relative border-l border-b border-gray-200"><div className="absolute w-full border-t border-dashed border-gray-100 top-2 left-0 z-0"></div><div className="absolute w-full border-t border-dashed border-gray-100 top-1/2 left-0 z-0"></div>{chartData.days.map((day, idx) => { const heightPercent = (day.value / chartData.maxValue) * 100; const isZero = day.value === 0; return <div key={idx} className="flex-1 flex flex-col justify-end h-full group relative z-10"><div className={`w-full rounded-t-md transition-all duration-700 ease-out relative group-hover:brightness-110 ${isZero ? 'bg-gray-100' : 'bg-gradient-to-t from-blue-500 to-indigo-600 shadow-lg shadow-indigo-200'}`} style={{ height: isZero ? '4px' : `${heightPercent}%`, minHeight: '4px' }}>{!isZero && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-20">{formatCurrency(day.value)}<div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div></div>}</div><span className="text-[10px] md:text-xs text-gray-500 font-medium mt-2 text-center uppercase tracking-wide">{day.label}</span></div>})}</div></div></div>
              <div className="flex justify-end"><button onClick={() => setIsManualOrderModalOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-bold shadow-md"><ClipboardEdit size={18} /> Registar Encomenda Manual</button></div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase"><tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Total</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100 text-sm">{allOrders.map(order => <tr key={order.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold text-indigo-700">{order.id}</td><td className="px-6 py-4">{order.shippingInfo?.name || 'N/A'}</td><td className="px-6 py-4 font-bold">{formatCurrency(order.total)}</td><td className="px-6 py-4"><select value={order.status} onChange={(e) => handleOrderStatusChange(order.id, e.target.value)} className={`text-xs font-bold px-2 py-1 rounded-full border-none cursor-pointer ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : order.status === 'Enviado' ? 'bg-blue-100 text-blue-800' : order.status === 'Pago' ? 'bg-cyan-100 text-cyan-800' : order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}><option value="Processamento">Processamento</option><option value="Pago">Pago</option><option value="Enviado">Enviado</option><option value="Entregue">Entregue</option><option value="Cancelado">Cancelado</option></select></td><td className="px-6 py-4 text-right flex justify-end items-center gap-2"><button onClick={() => setSelectedOrderDetails(order)} className="text-indigo-600 font-bold text-xs hover:underline">Detalhes</button>{isAdmin && order.status === 'Cancelado' && (<button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Apagar Encomenda"><Trash2 size={16} /></button>)}</td></tr>)}</tbody></table></div></div>
          </div>
        )}
        
        {/* --- COUPONS TAB --- */}
        {activeTab === 'coupons' && <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit"><h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus size={20} className="text-green-600" /> Novo Cupão</h3><form onSubmit={handleAddCoupon} className="space-y-4"><div><label className="block text-xs font-bold text-gray-500 uppercase">Código</label><input type="text" required value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})} className="w-full p-2 border border-gray-300 rounded uppercase font-bold tracking-wider" placeholder="NATAL20" /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-gray-500 uppercase">Tipo</label><select value={newCoupon.type} onChange={e => setNewCoupon({...newCoupon, type: e.target.value as any})} className="w-full p-2 border border-gray-300 rounded"><option value="PERCENTAGE">Percentagem (%)</option><option value="FIXED">Valor Fixo (€)</option></select></div><div><label className="text-xs font-bold text-gray-500 uppercase">Valor</label><input type="number" required min="1" value={newCoupon.value} onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})} className="w-full p-2 border border-gray-300 rounded" /></div></div><div><label className="block text-xs font-bold text-gray-500 uppercase">Mínimo Compra (€)</label><input type="number" min="0" value={newCoupon.minPurchase} onChange={e => setNewCoupon({...newCoupon, minPurchase: Number(e.target.value)})} className="w-full p-2 border border-gray-300 rounded" /></div><button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700">Criar Cupão</button></form></div>
        <div className="md:col-span-2 space-y-4">{isCouponsLoading ? <p>A carregar...</p> : coupons.map(c => <div key={c.id} className={`bg-white p-4 rounded-xl border flex items-center justify-between ${c.isActive ? 'border-gray-200' : 'border-red-100 bg-red-50 opacity-75'}`}><div className="flex items-center gap-4"><div className={`p-3 rounded-lg ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}><TicketPercent size={24} /></div><div><h4 className="font-bold text-lg tracking-wider">{c.code}</h4><p className="text-sm text-gray-600">{c.type === 'PERCENTAGE' ? `${c.value}% Desconto` : `${formatCurrency(c.value)} Desconto`}{c.minPurchase > 0 && ` (Min. ${formatCurrency(c.minPurchase)})`}</p><p className="text-xs text-gray-400 mt-1">Usado {c.usageCount} vezes</p></div></div><div className="flex items-center gap-2"><button onClick={() => handleToggleCoupon(c)} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{c.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}{c.isActive ? 'Ativo' : 'Inativo'}</button><button onClick={() => handleDeleteCoupon(c.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button></div></div>)}{coupons.length === 0 && <p className="text-center text-gray-500 mt-10">Não há cupões criados.</p>}</div></div>}
      </div>
      
      {/* ... (Rest of component including Modals) ... */}
      {isModalOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"><div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10"><h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">{editingId ? <Edit2 size={20} /> : <Plus size={20} />} {editingId ? 'Editar Lote / Produto' : 'Novo Lote de Stock'}</h2><button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24} /></button></div><div className="p-6"><form onSubmit={handleProductSubmit} className="space-y-6"><div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100"><h3 className="text-sm font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><LinkIcon size={16} /> Passo 1: Ligar a Produto da Loja (Opcional)</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Produto da Loja</label><select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={formData.publicProductId} onChange={handlePublicProductSelect}><option value="">-- Nenhum (Apenas Backoffice) --</option>{
      publicProductsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="text-[10px] text-gray-500 mt-1">Ao selecionar, o nome e categoria são preenchidos automaticamente.</p></div>{selectedPublicProductVariants.length > 0 && <div className="animate-fade-in-down"><label className="block text-xs font-bold text-gray-900 uppercase mb-1 bg-yellow-100 w-fit px-1 rounded">Passo 2: Escolha a Variante</label><select className="w-full p-3 border-2 border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white font-bold" value={formData.variant} onChange={(e) => setFormData({...formData, variant: e.target.value})} required><option value="">-- Selecione uma Opção --</option>{selectedPublicProductVariants.map((v, idx) => <option key={idx} value={v.name}>{v.name}</option>)}</select><p className="text-xs text-yellow-700 mt-1 font-medium">⚠ Obrigatório: Este produto tem várias opções.</p></div>}</div>
      <div className="mt-4 pt-4 border-t border-blue-200"><div className="flex items-center justify-between mb-2"><label className="text-xs font-bold text-blue-800 uppercase flex items-center gap-2"><LinkIcon size={12}/> Ligação Manual (Avançado)</label><button type="button" onClick={() => setIsPublicIdEditable(!isPublicIdEditable)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">{isPublicIdEditable ? <Unlock size={10}/> : <Lock size={10}/>} {isPublicIdEditable ? 'Bloquear' : 'Editar ID'}</button></div><div className="flex gap-2 items-center"><input type="text" value={formData.publicProductId} onChange={(e) => setFormData({...formData, publicProductId: e.target.value})} disabled={!isPublicIdEditable} placeholder="ID numérico do produto público" className={`w-full p-2 border rounded-lg text-sm font-mono ${isPublicIdEditable ? 'bg-white border-blue-300' : 'bg-gray-100 text-gray-500'}`}/><div className="text-[10px] text-gray-500 w-full">Para agrupar variantes (ex: cores), use o mesmo ID Público em todos.</div></div></div></div>
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4"><div><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><AlignLeft size={16} /> Descrição Completa</h4><textarea rows={4} className="w-full p-3 border border-gray-300 rounded-lg text-sm" placeholder="Descreva o produto com detalhes..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}/></div><div><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-2"><ImageIcon size={16} /> Galeria de Imagens</h4>{formData.images.length > 0 && (<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">{formData.images.map((img, idx) => (<div key={idx} className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col"><div className="aspect-square relative"><img src={img} alt={`Img ${idx}`} className="w-full h-full object-contain p-1" /><div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">{idx + 1}</div></div><div className="flex border-t border-gray-100 divide-x divide-gray-100"><button type="button" disabled={idx === 0} onClick={() => handleMoveImage(idx, 'left')} className="flex-1 p-1.5 hover:bg-gray-100 disabled:opacity-30 flex justify-center"><ArrowLeft size={14} /></button><button type="button" onClick={() => handleRemoveImage(idx)} className="flex-1 p-1.5 hover:bg-red-50 text-red-500 flex justify-center"><Trash2 size={14} /></button><button type="button" disabled={idx === formData.images.length - 1} onClick={() => handleMoveImage(idx, 'right')} className="flex-1 p-1.5 hover:bg-gray-100 disabled:opacity-30 flex justify-center"><ArrowRightIcon size={14} /></button></div></div>))}</div>)}<div className="flex gap-2"><div className="relative flex-1"><input type="url" placeholder="Cole o link da imagem (ex: imgur.com/...)" className="w-full p-3 border border-gray-300 rounded-lg text-sm pr-20" value={formData.newImageUrl} onChange={e => setFormData({...formData, newImageUrl: e.target.value})} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="absolute right-1 top-1 bottom-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 rounded-md text-xs font-bold flex items-center gap-1 transition-colors" title="Upload do PC">{isUploading && uploadProgress === null ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}</button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange}/></div><button type="button" onClick={handleAddImage} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 rounded-lg font-bold transition-colors">Adicionar</button></div>
      {isUploading && uploadProgress !== null && (
          <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <p className="text-xs text-center text-gray-500 mt-1">A carregar... {Math.round(uploadProgress)}%</p>
          </div>
      )}
      </div><div><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><ListPlus size={16} /> Destaques / Características Principais</h4>{formData.features.length > 0 && (<div className="space-y-2 mb-3">{formData.features.map((feat, idx) => (<div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200 text-sm"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div><span className="flex-1 text-gray-700">{feat}</span><button type="button" onClick={() => handleRemoveFeature(idx)} className="text-gray-400 hover:text-red-500"><X size={14} /></button></div>))}</div>)}<div className="flex gap-2"><input type="text" placeholder="Ex: Bateria de 24h, WiFi 6..." className="flex-1 p-3 border border-gray-300 rounded-lg text-sm" value={formData.newFeature} onChange={e => setFormData({...formData, newFeature: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}/><button type="button" onClick={handleAddFeature} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 rounded-lg font-bold transition-colors">+ Item</button></div></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Lote</label><input required type="text" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label><select className="w-full p-3 border border-gray-300 rounded-lg" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}><option>TV Box</option><option>Cabos</option><option>Acessórios</option><option>Outros</option></select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200"><div className="md:col-span-2"><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Globe size={16} /> Rastreabilidade do Fornecedor</h4><p className="text-[10px] text-gray-500 mb-3">Preencha para saber a origem deste produto em caso de garantia.</p></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Fornecedor (Ex: Temu)</label><input type="text" placeholder="Temu, AliExpress, Amazon..." className="w-full p-3 border border-gray-300 rounded-lg" value={formData.supplierName} onChange={e => setFormData({...formData, supplierName: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Encomenda Origem</label><input type="text" placeholder="Ex: PO-2023-9999" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.supplierOrderId} onChange={e => setFormData({...formData, supplierOrderId: e.target.value})} /></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Compra</label><input required type="date" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd. Comprada</label><input required type="number" min="1" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.quantityBought} onChange={e => setFormData({...formData, quantityBought: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Compra (Unitário)</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input required type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} /></div></div></div>
      <div className="bg-white p-4 rounded-xl border border-purple-200 mb-6 flex items-center justify-between shadow-sm"><div><h4 className="font-bold text-purple-900 text-sm flex items-center gap-2"><CalendarClock size={16} /> Modo Pré-Lançamento (Em Breve)</h4><p className="text-[10px] text-gray-500 mt-1">Se ativo, o botão de compra muda para "Em Breve" e não permite encomendas, mesmo com stock.</p></div><button type="button" onClick={() => setFormData({...formData, comingSoon: !formData.comingSoon})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.comingSoon ? 'bg-purple-600' : 'bg-gray-200'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${formData.comingSoon ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
      <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-6"><h4 className="font-bold text-purple-900 text-sm mb-3 flex items-center gap-2"><Tag size={16} /> Etiquetas de Marketing</h4><div className="flex flex-wrap gap-2">{['NOVIDADE', 'MAIS VENDIDO', 'PROMOÇÃO', 'ESSENCIAL'].map(badge => (<button key={badge} type="button" onClick={() => toggleBadge(badge)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${formData.badges.includes(badge) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>{badge} {formData.badges.includes(badge) && <CheckCircle size={10} className="inline ml-1" />}</button>))}</div><p className="text-[10px] text-purple-700 mt-2">Selecione as etiquetas para destacar este produto na loja online.</p></div>
      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mb-4"><label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Variante / Opção (Opcional)</label><input type="text" placeholder="Ex: Azul, XL, 64GB" className="w-full p-3 border border-indigo-200 rounded-lg text-indigo-900 font-bold" value={formData.variant} onChange={e => setFormData({...formData, variant: e.target.value})} /><p className="text-[10px] text-indigo-600 mt-1">Preencha apenas se este produto for uma opção específica (ex: Cor ou Tamanho).</p></div>
      <div className="bg-green-50/50 p-5 rounded-xl border border-green-100"><h3 className="text-sm font-bold text-green-900 uppercase mb-4 flex items-center gap-2"><QrCode size={16} /> Unidades Individuais / Nº de Série</h3><div className="flex gap-2 mb-4"><button type="button" onClick={() => { setScannerMode('add_unit'); setIsScannerOpen(true); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"><Camera size={16}/> Escanear Unidade</button></div>
      <div className="flex gap-2 items-center text-xs text-gray-500 mb-4"><span className="font-bold">OU</span><input value={manualUnitCode} onChange={e => setManualUnitCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if(manualUnitCode.trim()) handleAddUnit(manualUnitCode.trim()); setManualUnitCode(''); } }} type="text" placeholder="Inserir código manualmente" className="flex-1 p-2 border border-gray-300 rounded-lg" /><button type="button" onClick={() => { if(manualUnitCode.trim()) handleAddUnit(manualUnitCode.trim()); setManualUnitCode(''); }} className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"><Plus size={16} /></button></div>
      <div><p className="text-xs font-bold text-gray-600 mb-2">{modalUnits.length} / {formData.quantityBought || 0} unidades registadas</p><div className="flex flex-wrap gap-2">{modalUnits.map(unit => <div key={unit.id} className="bg-white border border-gray-200 text-gray-700 text-xs font-mono px-2 py-1 rounded flex items-center gap-2"><span>{unit.id}</span><button type="button" onClick={() => handleRemoveUnit(unit.id)} className="text-red-400 hover:text-red-600"><X size={12} /></button></div>)}</div></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6 border-gray-100"><div><label className="block text-xs font-bold text-green-700 uppercase mb-1 bg-green-50 w-fit px-1 rounded">Preço Venda (Loja)</label><div className="relative"><span className="absolute left-3 top-3 text-green-600 font-bold">€</span><input type="number" step="0.01" className="w-full pl-8 p-3 border-2 border-green-400 rounded-lg font-bold text-green-800" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} placeholder="Valor Final" /></div><p className="text-[10px] text-gray-500 mt-1">Este é o preço que aparecerá no site.</p></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Alvo (Estimado)</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg text-gray-500" value={formData.targetSalePrice} onChange={e => setFormData({...formData, targetSalePrice: e.target.value})} /></div></div></div><div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100"><h4 className="font-bold text-yellow-800 mb-3 text-sm">Cashback / Reembolso</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Total</label><input type="number" step="0.01" className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackValue} onChange={e => setFormData({...formData, cashbackValue: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label><select className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackStatus} onChange={e => setFormData({...formData, cashbackStatus: e.target.value as any})}><option value="NONE">Sem Cashback</option><option value="PENDING">Pendente</option><option value="RECEIVED">Recebido</option></select></div></div></div>
      {editingId && <div className="border-t pt-6"><h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><History size={20} /> Histórico de Vendas deste Lote</h3>{products.find(p => p.id === editingId)?.salesHistory?.length ? <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-xs text-gray-500 uppercase"><tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Qtd</th><th className="px-4 py-2">Valor</th><th className="px-4 py-2 text-right">Ação</th></tr></thead><tbody className="divide-y divide-gray-200">{products.find(p => p.id === editingId)?.salesHistory?.map((sale) => <tr key={sale.id}><td className="px-4 py-2">{sale.date}</td><td className="px-4 py-2 font-bold">{sale.quantity}</td><td className="px-4 py-2">{formatCurrency(sale.unitPrice * sale.quantity)}</td><td className="px-4 py-2 text-right"><button type="button" onClick={() => handleDeleteSale(sale.id)} className="text-red-500 hover:text-red-700 text-xs font-bold border border-red-200 px-2 py-1 rounded hover:bg-red-50">Anular (Repor Stock)</button></td></tr>)}</tbody></table></div> : <p className="text-gray-500 text-sm italic">Nenhuma venda registada para este lote ainda.</p>}</div>}
      <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">Cancelar</button><button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center gap-2"><Save size={20} /> Guardar Lote</button></div></form></div></div></div>}
      
      {/* Sale Modal */}
      {isSaleModalOpen && selectedProductForSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"><div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0"><h3 className="font-bold text-gray-900 flex items-center gap-2"><DollarSign size={20} className="text-green-600"/> Registar Venda / Baixa</h3><button onClick={() => setIsSaleModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button></div><form onSubmit={handleSaleSubmit} className="p-6 space-y-6"><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><p className="text-xs font-bold text-gray-500 uppercase">Produto</p><p className="font-bold text-gray-900">{selectedProductForSale.name}</p><p className="text-xs text-blue-600">{selectedProductForSale.variant}</p></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Passo 1: Encomenda Online (Obrigatório)</label><select required value={linkedOrderId} onChange={(e) => setLinkedOrderId(e.target.value)} className={`w-full p-2 border rounded-lg focus:ring-2 outline-none transition-colors ${orderMismatchWarning ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`}><option value="">-- Selecione uma encomenda --</option>{pendingOrders.map(o => (<option key={o.id} value={o.id}>{o.id} - {o.shippingInfo?.name} ({formatCurrency(o.total)})</option>))}</select></div>{orderMismatchWarning && (<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded animate-shake flex items-start gap-2"><ShieldAlert size={20} className="shrink-0 mt-0.5" /><div><p className="font-bold text-sm">PRODUTO ERRADO!</p><p className="text-xs">{orderMismatchWarning}</p></div></div>)}{linkedOrderId && !orderMismatchWarning && (<div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 animate-fade-in-down space-y-4"><h4 className="text-sm font-bold text-blue-900 uppercase flex items-center gap-2 border-b border-blue-200 pb-2"><FileText size={14}/> Conferência de Valores</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-600 mb-1">Preço Venda (Real)</label><input type="number" step="0.01" className="w-full p-2 border border-gray-300 rounded bg-white text-sm font-bold text-gray-800" value={saleForm.unitPrice} onChange={e => setSaleForm({...saleForm, unitPrice: e.target.value})}/></div><div><label className="block text-xs font-bold text-gray-600 mb-1">Portes Envio (Cliente)</label><input type="number" step="0.01" className="w-full p-2 border border-gray-300 rounded bg-white text-sm text-gray-800" value={saleForm.shippingCost} onChange={e => setSaleForm({...saleForm, shippingCost: e.target.value})}/></div></div><div className="border-t border-blue-200 pt-4"><h4 className="text-sm font-bold text-blue-900 uppercase flex items-center gap-2 mb-3"><ShieldCheck size={14}/> Verificação de Segurança</h4><div className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${securityCheckPassed ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-200'}`}>{securityCheckPassed ? (<><CheckCircle size={32} className="text-green-600"/><div className="text-center"><p className="font-bold text-green-800">Produto Confirmado!</p><p className="text-xs text-green-700">Pode finalizar a venda.</p></div></>) : (<><div className="w-full flex gap-2"><button type="button" onClick={() => { setScannerMode('verify_product'); setIsScannerOpen(true); }} className="bg-gray-800 text-white p-2 rounded-lg hover:bg-black transition-colors"><Camera size={20}/></button><input type="text" placeholder="Escanear produto para libertar..." className="flex-1 p-2 border border-gray-300 rounded-lg text-sm text-center font-mono uppercase focus:ring-2 focus:ring-red-500 outline-none" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVerifyProduct((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}/></div><p className="text-xs text-red-600 font-bold flex items-center gap-1"><Lock size={12}/> Venda Bloqueada: Confirme o produto físico.</p></>)}</div></div></div>)}{selectedProductForSale.units && selectedProductForSale.units.length > 0 ? (<div><label className="block text-sm font-bold text-gray-700 mb-2">Selecionar Unidades (S/N) a vender</label><div className="flex gap-2 mb-2"><button type="button" onClick={() => { setScannerMode('sell_unit'); setIsScannerOpen(true); }} className="bg-gray-200 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-300"><Camera size={14}/> Escanear S/N</button><select value={manualUnitSelect} onChange={(e) => { if(e.target.value) handleSelectUnitForSale(e.target.value); setManualUnitSelect(''); }} className="flex-1 p-2 border border-gray-300 rounded-lg text-xs"><option value="">-- Selecionar Manualmente --</option>{selectedProductForSale.units.filter(u => u.status === 'AVAILABLE' && !selectedUnitsForSale.includes(u.id)).map(u => (<option key={u.id} value={u.id}>{u.id}</option>))}</select></div><div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-gray-50 rounded-lg border border-gray-200">{selectedUnitsForSale.map(sn => (<div key={sn} className="bg-white border border-green-200 text-green-700 text-xs font-mono px-2 py-1 rounded flex items-center gap-1 shadow-sm">{sn} <button type="button" onClick={() => setSelectedUnitsForSale(prev => prev.filter(s => s !== sn))} className="text-red-400 hover:text-red-600"><X size={12}/></button></div>))}{selectedUnitsForSale.length === 0 && <span className="text-gray-400 text-xs italic">Nenhuma unidade selecionada.</span>}</div><p className="text-xs text-gray-500 mt-1">Quantidade será calculada com base nas unidades selecionadas.</p></div>) : (<div><label className="block text-sm font-bold text-gray-700 mb-1">Quantidade</label><input type="number" min="1" max={selectedProductForSale.quantityBought - selectedProductForSale.quantitySold} required value={saleForm.quantity} onChange={(e) => setSaleForm({...saleForm, quantity: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" /></div>)}<button type="submit" disabled={!!orderMismatchWarning || !securityCheckPassed} className={`w-full font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors ${orderMismatchWarning || !securityCheckPassed ? 'bg-gray-400 cursor-not-allowed text-gray-200' : 'bg-green-600 hover:bg-green-700 text-white'}`}>{!securityCheckPassed ? <Lock size={18}/> : <CheckCircle size={18}/>} {orderMismatchWarning ? 'Bloqueado: Produto Errado' : !securityCheckPassed ? 'Bloqueado: Verificação Pendente' : 'Confirmar Venda'}</button></form></div></div>
      )}

      {/* Manual Order Modal */}
      {isManualOrderModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col"><div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10"><h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><ClipboardEdit size={20} className="text-purple-600"/> Criar Encomenda Manual</h3><button onClick={() => setIsManualOrderModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button></div><form onSubmit={handleManualOrderSubmit} className="p-6 space-y-6"><div className="bg-purple-50 p-4 rounded-xl border border-purple-100"><h4 className="font-bold text-purple-900 text-sm mb-3">1. Adicionar Produtos</h4><select onChange={(e) => { addProductToManualOrder(e.target.value); e.target.value = ''; }} className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white mb-4"><option value="">-- Pesquisar Produto --</option>{productsForSelect.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}</select><div className="space-y-2 max-h-40 overflow-y-auto">{manualOrderItems.map((item, idx) => (<div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-purple-100 shadow-sm"><div><p className="font-bold text-sm text-gray-800">{item.name}</p><p className="text-xs text-gray-500">{item.selectedVariant} | {formatCurrency(item.finalPrice)}</p></div><div className="flex items-center gap-3"><div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1"><button type="button" onClick={() => updateManualOrderItemQuantity(`${item.id}|${item.selectedVariant}`, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm hover:bg-gray-50 font-bold">-</button><span className="w-6 text-center text-sm font-bold">{item.quantity}</span><button type="button" onClick={() => updateManualOrderItemQuantity(`${item.id}|${item.selectedVariant}`, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm">+</button></div><p className="font-bold text-purple-700 w-16 text-right">{formatCurrency(item.finalPrice * item.quantity)}</p><button type="button" onClick={() => updateManualOrderItemQuantity(`${item.id}|${item.selectedVariant}`, -999)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div></div>))}{manualOrderItems.length === 0 && <p className="text-center text-gray-400 text-sm py-2">Nenhum produto adicionado.</p>}</div>{manualOrderItems.length > 0 && (<div className="mt-4 pt-4 border-t border-purple-200 flex justify-end"><p className="text-lg font-bold text-gray-900">Total: {formatCurrency(manualOrderItems.reduce((acc, i) => acc + i.finalPrice * i.quantity, 0))}</p></div>)}</div><div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><h4 className="font-bold text-gray-800 text-sm mb-3">2. Dados do Cliente</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label><input type="text" required value={manualOrderCustomer.name} onChange={e => setManualOrderCustomer({...manualOrderCustomer, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Nome do Cliente" /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (Opcional)</label><input type="email" value={manualOrderCustomer.email} onChange={e => setManualOrderCustomer({...manualOrderCustomer, email: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="email@exemplo.com" /></div></div><div className="mt-4"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Morada / Notas de Envio</label><textarea required value={manualOrderShipping} onChange={e => setManualOrderShipping(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" rows={2} placeholder="Morada completa ou 'Entrega em mão'" /></div><div className="mt-4"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Pagamento</label><select value={manualOrderPayment} onChange={e => setManualOrderPayment(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg"><option value="MB Way">MB Way</option><option value="Transferência">Transferência Bancária</option><option value="Cobrança">À Cobrança</option><option value="Dinheiro">Dinheiro (Em Mão)</option></select></div></div><button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"><Save size={20} /> Criar Encomenda e Deduzir Stock</button></form></div></div>
      )}
      {detailsModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"><div className="p-6 border-b border-gray-100 flex justify-between items-center"><h3 className="text-xl font-bold text-gray-900">{detailsModalData.title}</h3><button onClick={() => setDetailsModalData(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24} /></button></div><div className="flex-1 overflow-y-auto p-0"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0"><tr>{detailsModalData.columns.map((col, idx) => <th key={idx} className="px-6 py-3">{col.header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{detailsModalData.data.map((item, rowIdx) => (<tr key={rowIdx} className="hover:bg-gray-50">{detailsModalData.columns.map((col, colIdx) => (<td key={colIdx} className="px-6 py-3">{typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor]}</td>))}</tr>))}</tbody></table></div><div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center"><span className="font-bold text-gray-500">TOTAL</span><span className="text-xl font-bold text-gray-900">{formatCurrency(detailsModalData.total)}</span></div></div></div>
      )}
      {isScannerOpen && (<BarcodeScanner mode={(scannerMode === 'add_unit' || scannerMode === 'sell_unit' || scannerMode === 'verify_product') ? 'serial' : 'product'} onClose={() => setIsScannerOpen(false)} onCodeSubmit={(code) => { if (scannerMode === 'add_unit') { handleAddUnit(code); setIsScannerOpen(false); } else if (scannerMode === 'sell_unit') { handleSelectUnitForSale(code); setIsScannerOpen(false); } else if (scannerMode === 'search') { setSearchTerm(code); setIsScannerOpen(false); } else if (scannerMode === 'verify_product') { handleVerifyProduct(code); setIsScannerOpen(false); }}} />)}
      {notificationModalData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"><div className="bg-green-600 p-6 text-white flex justify-between items-center"><h3 className="font-bold text-xl flex items-center gap-2"><Mail size={24}/> Notificar Clientes</h3><button onClick={() => setNotificationModalData(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={24}/></button></div><div className="p-6 space-y-4"><p className="text-gray-600">Existem <strong>{notificationModalData.alertsToDelete.length} clientes</strong> à espera do produto <strong>{notificationModalData.productName}</strong>.</p><div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-sm text-yellow-800"><strong>Como enviar:</strong><br/>1. Copie os emails abaixo (BCC).<br/>2. Abra o seu email e cole no campo "BCC" (Cópia Oculta).<br/>3. Copie o Assunto e o Corpo da mensagem.</div><div className="space-y-3"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Emails (BCC)</label><div className="flex gap-2"><input readOnly value={notificationModalData.bcc} className="w-full p-2 bg-gray-50 border rounded text-xs" /><button onClick={() => handleCopyToClipboard(notificationModalData.bcc, 'emails')} className="bg-gray-200 hover:bg-gray-300 p-2 rounded text-gray-700 font-bold text-xs">{copySuccess === 'emails' ? 'Copiado!' : 'Copiar'}</button></div></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assunto</label><div className="flex gap-2"><input readOnly value={notificationModalData.subject} className="w-full p-2 bg-gray-50 border rounded text-xs" /><button onClick={() => handleCopyToClipboard(notificationModalData.subject, 'subject')} className="bg-gray-200 hover:bg-gray-300 p-2 rounded text-gray-700 font-bold text-xs">{copySuccess === 'subject' ? 'Copiado!' : 'Copiar'}</button></div></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mensagem</label><div className="flex gap-2 items-start"><textarea readOnly value={notificationModalData.body} className="w-full h-32 p-2 bg-gray-50 border rounded text-xs resize-none" /><button onClick={() => handleCopyToClipboard(notificationModalData.body, 'body')} className="bg-gray-200 hover:bg-gray-300 p-2 rounded text-gray-700 font-bold text-xs h-full">{copySuccess === 'body' ? 'Copiado!' : 'Copiar'}</button></div></div></div><div className="pt-4 border-t border-gray-100 flex justify-end gap-3"><button onClick={() => setNotificationModalData(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button><button onClick={handleClearSentAlerts} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2"><CheckCircle size={18} /> Já enviei, limpar lista</button></div></div></div></div>
      )}
    </div>
  );
};

export default Dashboard;
