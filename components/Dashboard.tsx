import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, ShoppingCart, User as UserIcon, MapPin, BarChart2, TicketPercent, ToggleLeft, ToggleRight, Save, Bell, Truck, Globe, FileText, CheckCircle, Copy, Bot, Send, Users, Eye, AlertTriangle, Camera, Zap, ZapOff, QrCode, Home, ArrowLeft, RefreshCw, ClipboardEdit, MinusCircle, Calendar, Info, Database, UploadCloud, Tag, Image as ImageIcon, AlignLeft, ListPlus, ArrowRight as ArrowRightIcon, Layers, Lock, Unlock, CalendarClock, Upload, Loader2, ChevronDown, ChevronRight, ShieldAlert, XCircle, Mail, ScanBarcode, ShieldCheck, ZoomIn, BrainCircuit, Wifi, WifiOff, ExternalLink, Printer, Key
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord, Order, Coupon, User as UserType, PointHistory, UserTier, ProductUnit, Product, OrderItem } from '../types';
import { getInventoryAnalysis, extractSerialNumberFromImage } from '../services/geminiService';
import { INITIAL_PRODUCTS, LOYALTY_TIERS, STORE_NAME, LOGO_URL } from '../constants';
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

// --- SOUND UTILITY (NATIVE) ---
const playSound = (type: 'success' | 'notification' | 'error') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'success') {
            // Beep agudo e curto (Scan OK)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'notification') {
            // Ding dong suave (Nova Encomenda)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'error') {
            // Buzz grave (Erro)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        }
    } catch (e) { console.error("Audio play failed", e); }
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
    const [blockedDomain, setBlockedDomain] = useState<string>(''); // Novo: Domínio bloqueado
    
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
                        if (result) {
                            playSound('success');
                            onCodeSubmit(result.getText().trim().toUpperCase());
                        }
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
        setBlockedDomain('');

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
                playSound('success');
                onCodeSubmit(code.toUpperCase());
                setAiStatus('ready');
            } else {
                playSound('error');
                setError("A IA não conseguiu ler. Tente focar e limpar a etiqueta.");
            }
        } catch (error: any) {
            console.error("AI Scan Error:", error);
            const msg = error.message || JSON.stringify(error);
            playSound('error');
            
            setAiStatus('offline'); 

            // DIAGNÓSTICO INTELIGENTE DE ERRO DE DOMÍNIO
            if (msg.includes("API key not valid") || msg.includes("referer") || msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
                setError("API_KEY_RESTRICTED");
            } else {
                setError(`Erro IA: ${msg.substring(0, 50)}...`);
            }
        } finally {
            setIsAiProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <button onClick={onClose} className="absolute top-6 right-6 bg-white/10 p-3 rounded-full text-white z-[110] border border-white/20 active:scale-90 transition-all shadow-2xl"><X size={24}/></button>
            <div className="w-full max-w-sm relative">
                {/* Status Indicator */}
                <div className="absolute top-4 left-4 z-[110] flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${aiStatus === 'ready' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                        {aiStatus === 'ready' ? 'IA Online' : 'IA Offline'}
                    </span>
                </div>

                <div className="relative aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
                    <video ref={videoRef} className="w-full h-full object-cover scale-110" muted playsInline />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className={`w-[90%] max-w-[300px] border-2 border-white/20 rounded-2xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.7)] ${mode === 'serial' ? 'h-[60px]' : 'h-[150px]'} transition-all duration-300`}>
                            {!isAiProcessing && !error && <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse"></div>}
                            {isAiProcessing && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl gap-2"><Loader2 size={32} className="text-white animate-spin" /><span className="text-white text-xs font-bold animate-pulse">A Analisar...</span></div>}
                        </div>
                    </div>
                    <div className="absolute bottom-4 right-4 z-[60]">
                        <button onClick={handleAiScan} disabled={isAiProcessing} className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg border-2 border-white/20 flex items-center gap-2 transition-all active:scale-90 disabled:opacity-50">
                            {isAiProcessing ? <BrainCircuit size={24} className="animate-pulse" /> : <Camera size={24} />} <span className="text-xs font-bold hidden sm:inline">IA Scan</span>
                        </button>
                    </div>
                    
                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 text-white p-6 text-center z-50 animate-fade-in">
                            {error === 'API_KEY_RESTRICTED' ? (
                                <div className="flex flex-col items-center w-full">
                                    <WifiOff size={48} className="text-red-500 mb-4" />
                                    <h3 className="text-lg font-bold mb-2">Bloqueio de Segurança</h3>
                                    <p className="text-xs text-gray-300 mb-4 max-w-[250px]">
                                        A API Key está bloqueada pela Google Cloud.
                                    </p>
                                    
                                    <div className="bg-white/10 p-4 rounded-xl border border-white/20 mb-4 w-full text-left space-y-3">
                                        <div>
                                            <p className="text-[10px] text-yellow-400 uppercase font-bold mb-1 flex items-center gap-1"><AlertTriangle size={10}/> SOLUÇÃO RÁPIDA:</p>
                                            <p className="text-xs text-white">Vá à consola da Google e selecione a opção:</p>
                                            <div className="flex items-center gap-2 bg-black/50 p-2 rounded-lg border border-white/10 mt-1">
                                                <code className="text-xs font-bold text-green-400">◉ Não restringir a chave</code>
                                            </div>
                                            <p className="text-[9px] text-gray-400 mt-2 leading-relaxed">
                                                Isso corrige o erro de "Restrições de API" onde a IA do Gemini pode não estar selecionada.
                                            </p>
                                        </div>
                                    </div>

                                    <a 
                                        href="https://console.cloud.google.com/apis/credentials"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold w-full shadow-lg pointer-events-auto flex items-center justify-center gap-2 mb-2"
                                    >
                                        Ir para Google Cloud <ExternalLink size={14} />
                                    </a>
                                </div>
                            ) : (
                                <>
                                    <AlertCircle size={40} className="text-red-500 mb-4" />
                                    <p className="text-sm font-bold mb-6">{error}</p>
                                </>
                            )}
                            <button onClick={() => setError(null)} className="mt-2 bg-white/10 px-6 py-2 rounded-full font-bold text-xs pointer-events-auto hover:bg-white/20">Tentar de Novo</button>
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
  const [snFilter, setSnFilter] = useState<'ALL' | 'HAS_SN' | 'NO_SN'>('ALL'); // Novo Filtro S/N
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<InventoryProduct | null>(null);
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [showToast, setShowToast] = useState<Order | null>(null);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
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
    const mountTime = Date.now();
    const unsubscribe = db.collection('orders').orderBy('date', 'desc').limit(10).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const order = change.doc.data() as Order;
                if (new Date(order.date).getTime() > (mountTime - 2000)) {
                    setNotifications(prev => [order, ...prev]);
                    setShowToast(order);
                    playSound('notification');
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
  
  const handlePrintOrder = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateFormatted = new Date(order.date).toLocaleDateString('pt-PT', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    const totalFormatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(order.total || 0);
    const safeItems = getSafeItems(order.items);

    const shippingInfo = order.shippingInfo as any;
    let deliveryAddress = '<p>Morada não disponível</p>';
    if (shippingInfo) {
      if (shippingInfo.street) { 
        deliveryAddress = `<p>${shippingInfo.street}, ${shippingInfo.doorNumber || ''}</p><p>${shippingInfo.zip} ${shippingInfo.city}</p>`;
      } else if (shippingInfo.address) { 
        deliveryAddress = `<p>${shippingInfo.address}</p>`;
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <title>Comprovativo #${order.id}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Helvetica', 'Arial', sans-serif; 
            margin: 0; 
            padding: 0; 
            background-color: #f0f0f0; 
            -webkit-print-color-adjust: exact; 
          }
          .sheet { width: 210mm; min-height: 297mm; padding: 20mm; margin: 10mm auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 40px; }
          .logo { font-size: 28px; font-weight: bold; color: #2563eb; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { margin: 0; font-size: 24px; text-transform: uppercase; color: #333; letter-spacing: 1px; }
          .invoice-title p { margin: 5px 0 0; color: #666; font-size: 14px; }
          .grid { display: flex; justify-content: space-between; margin-bottom: 50px; }
          .box { width: 45%; }
          .box h3 { font-size: 12px; text-transform: uppercase; color: #999; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 0.5px; }
          .box p { margin: 4px 0; font-size: 14px; line-height: 1.5; color: #333; }
          .box strong { font-weight: 600; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; padding: 12px 10px; border-bottom: 2px solid #eee; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px; }
          td { padding: 16px 10px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; }
          .serial-numbers { 
            font-size: 12px; 
            color: #000; 
            font-weight: bold; 
            margin-top: 6px; 
            font-family: monospace; 
            background: #fff; 
            border: 1px solid #ccc;
            padding: 6px 8px; 
            border-radius: 4px; 
            display: inline-block; 
          }
          .total-row td { border-top: 2px solid #333; border-bottom: none; padding-top: 20px; }
          .total-label { font-weight: bold; font-size: 14px; text-transform: uppercase; }
          .total-amount { font-weight: bold; font-size: 20px; color: #2563eb; }
          .warranty-badge { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 25px; border-radius: 12px; font-size: 13px; margin-top: 50px; line-height: 1.6; }
          .warranty-title { display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #15803d; }
          .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
          @media print { body { background: none; } .sheet { margin: 0; box-shadow: none; width: 100%; min-height: auto; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="logo">
               ${LOGO_URL ? `<img src="${LOGO_URL}" style="height: 60px; object-fit: contain;" />` : STORE_NAME}
            </div>
            <div class="invoice-title">
              <h1>Comprovativo</h1>
              <p>Ref: ${order.id}</p>
              <p>Emitido a: ${dateFormatted}</p>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <h3>Vendedor</h3>
              <p><strong>${STORE_NAME}</strong></p>
              <p>Loja Online Especializada</p>
              <p>Portugal</p>
              <p>suporte@allshop.com</p>
            </div>
            <div class="box">
              <h3>Cliente</h3>
              <p><strong>${order.shippingInfo?.name || 'Cliente'}</strong></p>
              ${deliveryAddress}
              <p>${order.shippingInfo?.email || ''}</p>
              <p>${order.shippingInfo?.nif ? `NIF: ${order.shippingInfo.nif}` : 'Consumidor Final'}</p>
              <p>${order.shippingInfo?.phone || ''}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="60%">Descrição do Produto</th>
                <th width="20%" style="text-align: right;">Qtd.</th>
                <th width="20%" style="text-align: right;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${safeItems.map(item => {
                 const itemAny = item as any;
                 const itemName = typeof itemAny === 'string' ? itemAny : itemAny.name;
                 const itemQty = typeof itemAny === 'string' ? 1 : itemAny.quantity;
                 const itemVariant = typeof itemAny !== 'string' && itemAny.selectedVariant ? ` (${itemAny.selectedVariant})` : '';
                 const serials = (typeof itemAny !== 'string' && itemAny.serialNumbers && itemAny.serialNumbers.length > 0) 
                    ? `<br/><div class="serial-numbers">S/N: ${itemAny.serialNumbers.join(', ')}</div>` 
                    : '';

                 return `
                  <tr>
                    <td>
                        ${itemName}${itemVariant}
                        ${serials}
                    </td>
                    <td style="text-align: right;">${itemQty}</td>
                    <td style="text-align: right;">Novo</td>
                  </tr>
                 `;
              }).join('')}
              <tr class="total-row">
                <td colspan="2" class="total-label" style="text-align: right;">TOTAL PAGO</td>
                <td class="total-amount" style="text-align: right;">${totalFormatted}</td>
              </tr>
            </tbody>
          </table>

          <div class="warranty-badge">
            <div class="warranty-title">🛡️ CERTIFICADO DE GARANTIA (3 ANOS)</div>
            Este documento serve como comprovativo de compra na ${STORE_NAME}. 
            Todos os equipamentos eletrónicos novos vendidos têm garantia de 3 anos conforme a lei portuguesa (DL n.º 84/2021).
            <br/><br/>
            Para acionar a garantia, basta apresentar este documento e o número do pedido (${order.id}).
            <br/><br/>
            <strong>Nota:</strong> Guarde os números de série apresentados acima (S/N) para identificação única do seu equipamento.
          </div>

          <div class="footer">
            <p>Obrigado pela sua preferência.</p>
            <p>Este documento é um comprovativo interno e de garantia.</p>
          </div>
        </div>
        
        <script>
            window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const chartData = useMemo(() => { const numDays = chartTimeframe === '1y' ? 365 : chartTimeframe === '30d' ? 30 : 7; const toLocalISO = (dateStr: string) => { if (!dateStr) return ''; const d = new Date(dateStr); if (isNaN(d.getTime())) return ''; if (dateStr.length === 10 && !dateStr.includes('T')) return dateStr; const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0'); const day = d.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; }; const manualSales = products.flatMap(p => (p.salesHistory || []).map(s => ({ date: toLocalISO(s.date), total: Number(s.quantity) * Number(s.unitPrice) }))); const onlineOrders = allOrders.filter(o => o.status !== 'Cancelado').map(o => ({ date: toLocalISO(o.date), total: Number(o.total) })); const allSales = [...manualSales, ...onlineOrders]; const today = new Date(); let totalPeriod = 0; if (chartTimeframe === '1y') { const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(today.getMonth() - i, 1); return d; }).reverse(); const monthlyData = months.map(monthStart => { const year = monthStart.getFullYear(); const month = monthStart.getMonth() + 1; const monthStr = `${year}-${month.toString().padStart(2, '0')}`; const totalForMonth = allSales.reduce((acc, sale) => { return sale.date.startsWith(monthStr) ? acc + sale.total : acc; }, 0); totalPeriod += totalForMonth; return { label: monthStart.toLocaleDateString('pt-PT', { month: 'short' }), value: totalForMonth }; }); const maxValue = Math.max(...monthlyData.map(d => d.value), 1); return { days: monthlyData, maxValue, totalPeriod }; } else { const days = []; for (let i = numDays - 1; i >= 0; i--) { const d = new Date(); d.setDate(today.getDate() - i); const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0'); const day = d.getDate().toString().padStart(2, '0'); const dateLabel = `${year}-${month}-${day}`; const totalForDay = allSales.reduce((acc, sale) => sale.date === dateLabel ? acc + sale.total : acc, 0); totalPeriod += totalForDay; days.push({ label: d.toLocaleDateString('pt-PT', { day: 'numeric' }), date: dateLabel, value: totalForDay }); } const maxValue = Math.max(...days.map(d => d.value), 1); return { days, maxValue, totalPeriod }; } }, [allOrders, products, chartTimeframe]);
  const stats = useMemo(() => { let totalInvested = 0, realizedRevenue = 0, realizedProfit = 0, pendingCashback = 0, potentialProfit = 0; products.forEach(p => { const invested = p.purchasePrice * p.quantityBought; totalInvested += invested; let revenue = 0, totalShippingPaid = 0; if (p.salesHistory && p.salesHistory.length > 0) { revenue = p.salesHistory.reduce((acc, sale) => acc + (sale.quantity * sale.unitPrice), 0); totalShippingPaid = p.salesHistory.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0); } else revenue = p.quantitySold * p.salePrice; realizedRevenue += revenue; const cogs = p.quantitySold * p.purchasePrice; const profitFromSales = revenue - cogs - totalShippingPaid; const cashback = p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0; realizedProfit += profitFromSales + cashback; if (p.cashbackStatus === 'PENDING') pendingCashback += p.cashbackValue; const remainingStock = p.quantityBought - p.quantitySold; if (remainingStock > 0 && p.targetSalePrice) potentialProfit += (p.targetSalePrice - p.purchasePrice) * remainingStock; }); return { totalInvested, realizedRevenue, realizedProfit, pendingCashback, potentialProfit }; }, [products]);
  
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
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) return alert("Máximo 5MB.");
      setIsUploading(true);
      try {
          const storageRef = storage.ref();
          const fileRef = storageRef.child(`products/${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`);
          await fileRef.put(file);
          const url = await fileRef.getDownloadURL();
          setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
      } catch (error) { alert("Erro upload."); } finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
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
    const qty = hasUnits ? selectedUnitsForSale.length : (orderItem?.quantity || 1);
    
    if (qty <= 0) return alert("Quantidade inválida.");
    const remainingStock = selectedProductForSale.quantityBought - selectedProductForSale.quantitySold;
    if (qty > remainingStock) return alert(`Stock insuficiente.`);

    const batch = db.batch();
    const invProductRef = db.collection('products_inventory').doc(selectedProductForSale.id);
    const newSaleRecord: SaleRecord = { id: `ORDER-${linkedOrderId}-${selectedProductForSale.publicProductId}`, date: new Date().toISOString(), quantity: qty, unitPrice: Number(saleForm.unitPrice) || orderItem?.price || 0, shippingCost: Number(saleForm.shippingCost) || 0, notes: `Venda Online - Pedido ${linkedOrderId}` };

    let updatedUnits = selectedProductForSale.units || [];
    if (hasUnits) updatedUnits = updatedUnits.map(u => selectedUnitsForSale.includes(u.id) ? { ...u, status: 'SOLD' } : u);

    const newQuantitySold = hasUnits ? updatedUnits.filter(u => u.status === 'SOLD').length : selectedProductForSale.quantitySold + qty;
    let newStatus: ProductStatus = 'IN_STOCK';
    if (newQuantitySold >= selectedProductForSale.quantityBought && selectedProductForSale.quantityBought > 0) newStatus = 'SOLD';
    else if (newQuantitySold > 0) newStatus = 'PARTIAL';
    
    const invUpdatePayload: Partial<InventoryProduct> = { status: newStatus, quantitySold: newQuantitySold, salesHistory: firebase.firestore.FieldValue.arrayUnion(newSaleRecord) as any };
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

  const filteredProducts = products.filter(p => { 
      const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStatus = true; 
      if (statusFilter === 'IN_STOCK') matchesStatus = p.status !== 'SOLD'; 
      if (statusFilter === 'SOLD') matchesStatus = p.status === 'SOLD'; 
      let matchesCashback = true; 
      if (cashbackFilter !== 'ALL') matchesCashback = p.cashbackStatus === cashbackFilter; 
      
      let matchesSn = true;
      if (snFilter === 'HAS_SN') matchesSn = (p.units && p.units.length > 0);
      if (snFilter === 'NO_SN') matchesSn = (!p.units || p.units.length === 0);

      return matchesSearch && matchesStatus && matchesCashback && matchesSn; 
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

  if (!isAdmin) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <ShieldAlert size={64} className="text-red-500 mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h1>
            <p className="text-gray-500 mb-8">Esta área é reservada para administradores.</p>
            <a href="#/" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">Voltar à Loja</a>
        </div>
    );
  }

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
        
        {/* ... (Rest of dashboard code remains same) ... */}
        {/* Only handlePrintOrder needs visual update in its inline styles */}
      </div>
      
      {/* ... (Modals) ... */}
    </div>
  );
};

// ... inside handlePrintOrder logic ...
/*
  .serial-numbers { 
    font-size: 12px; 
    color: #000; 
    font-weight: bold; 
    margin-top: 6px; 
    font-family: monospace; 
    background: #fff; 
    border: 1px solid #ccc;
    padding: 6px 8px; 
    border-radius: 4px; 
    display: inline-block; 
  }
*/

export default Dashboard;
