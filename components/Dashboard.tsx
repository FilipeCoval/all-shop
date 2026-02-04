
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, ShoppingCart, User as UserIcon, MapPin, BarChart2, TicketPercent, ToggleLeft, ToggleRight, Save, Bell, Truck, Globe, FileText, CheckCircle, Copy, Bot, Send, Users, Eye, AlertTriangle, Camera, Zap, ZapOff, QrCode, Home, ArrowLeft, RefreshCw, ClipboardEdit, MinusCircle, Calendar, Info, Database, UploadCloud, Tag, Image as ImageIcon, AlignLeft, ListPlus, ArrowRight as ArrowRightIcon, Layers, Lock, Unlock, CalendarClock, Upload, Loader2, ChevronDown, ChevronUp, ShieldAlert, XCircle, Mail, ScanBarcode, ShieldCheck, ZoomIn, BrainCircuit, Wifi, WifiOff, ExternalLink, Key as KeyIcon, Coins, Combine, Printer
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord, Order, Coupon, User as UserType, PointHistory, UserTier, ProductUnit, Product, OrderItem, StatusHistory } from '../types';
import { getInventoryAnalysis, extractSerialNumberFromImage } from '../services/geminiService';
import { INITIAL_PRODUCTS, LOYALTY_TIERS, STORE_NAME } from '../constants';
import { db, storage, firebase } from '../services/firebaseConfig';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/library';
import Barcode from 'react-barcode';
import ProfitCalculatorModal from './ProfitCalculatorModal';

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

// --- COMPONENTE DE SCANNER OTIMIZADO ---
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
                formats = [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.CODABAR, BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE];
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
            setAiStatus('offline');
            if (msg.includes("API key not valid")) setError("API_KEY_INVALID");
            else if (msg.includes("referer") || msg.includes("PERMISSION_DENIED") || msg.includes("403")) setError("API_KEY_RESTRICTED");
            else setError(`Erro IA: ${msg}`);
        } finally {
            setIsAiProcessing(false);
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
                            <AlertCircle size={40} className="text-red-500 mb-4" />
                            <p className="text-sm font-bold mb-6">{error}</p>
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

// --- MODAL DE DETALHES DA ENCOMENDA ---
const OrderDetailsModal: React.FC<{
  order: Order | null;
  onClose: () => void;
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
  onUpdateTracking: (orderId: string, tracking: string) => void;
  onCopy: (text: string) => void;
}> = ({ order, onClose, onUpdateOrder, onUpdateTracking, onCopy }) => {
    if (!order) return null;

    const [tracking, setTracking] = useState(order.trackingNumber || '');
    const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);
    const [manualPoints, setManualPoints] = useState(0);

    const handleRevokePoints = async () => {
        if (!window.confirm("Tem a certeza que quer anular os pontos desta encomenda? Isto irá permitir que sejam re-atribuídos.")) return;
        setIsUpdatingPoints(true);
        try {
            await db.collection('orders').doc(order.id).update({ pointsAwarded: false });
            onUpdateOrder(order.id, { pointsAwarded: false });
            alert("Selo de pontos removido! Agora pode alterar o estado para 'Entregue' para re-atribuir os pontos corretamente.");
        } catch (error) {
            console.error("Erro ao anular pontos:", error);
            alert("Ocorreu um erro. Tente novamente.");
        } finally {
            setIsUpdatingPoints(false);
        }
    };
    
    const handleManualPointsAward = async () => {
        if (manualPoints <= 0) { alert("Insira um valor de pontos válido."); return; }
        if (!window.confirm(`Atribuir ${manualPoints} pontos ao cliente desta encomenda (${order.id})?`)) return;

        setIsUpdatingPoints(true);
        try {
            let userRef: firebase.firestore.DocumentReference | null = null;
            if (order.userId) {
                const potentialUserRef = db.collection('users').doc(order.userId);
                const userDoc = await potentialUserRef.get();
                if (userDoc.exists) userRef = potentialUserRef;
            }

            if (!userRef && order.shippingInfo.email) {
                const userQuery = await db.collection('users')
                    .where('email', '==', order.shippingInfo.email.trim().toLowerCase())
                    .limit(1)
                    .get();
                if (!userQuery.empty) userRef = userQuery.docs[0].ref;
            }
            
            if (!userRef) throw new Error("Utilizador não encontrado.");

            const orderRef = db.collection('orders').doc(order.id);
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef!);
                if (!userDoc.exists) throw new Error("Utilizador não encontrado.");
                const userData = userDoc.data() as UserType;
                const newPointsTotal = (userData.loyaltyPoints || 0) + manualPoints;
                const newHistoryEntry: PointHistory = {
                    id: `manual-${order.id}-${Date.now()}`,
                    date: new Date().toISOString(),
                    amount: manualPoints,
                    reason: `Ajuste manual (Encomenda ${order.id})`,
                    orderId: order.id
                };
                const newHistory = [newHistoryEntry, ...(userData.pointsHistory || [])];
                transaction.update(userRef!, { loyaltyPoints: newPointsTotal, pointsHistory: newHistory });
                transaction.update(orderRef, { pointsAwarded: true });
            });
            onUpdateOrder(order.id, { pointsAwarded: true });
            alert("Pontos atribuídos com sucesso!");
        } catch (error: any) {
            alert(`Erro: ${error.message}`);
        } finally {
            setIsUpdatingPoints(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><FileText size={20} className="text-indigo-600"/> Detalhes da Encomenda</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div><p className="text-xs text-gray-500 font-bold uppercase">ID Encomenda</p><p className="font-bold text-indigo-700 text-sm mt-1">{order.id}</p></div>
                      <div><p className="text-xs text-gray-500 font-bold uppercase">Estado</p><p className="font-bold text-sm mt-1">{order.status}</p></div>
                      <div><p className="text-xs text-gray-500 font-bold uppercase">Data</p><p className="font-bold text-sm mt-1">{new Date(order.date).toLocaleDateString()}</p></div>
                      <div><p className="text-xs text-gray-500 font-bold uppercase">Total</p><p className="font-bold text-sm mt-1">{formatCurrency(order.total)}</p></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                      <div className="space-y-1"><h4 className="font-bold text-gray-800 text-sm mb-2">Cliente</h4><p className="text-sm">{order.shippingInfo.name}</p><p className="text-sm">{order.shippingInfo.email}</p><p className="text-sm">{order.shippingInfo.phone}</p></div>
                      <div className="space-y-1"><h4 className="font-bold text-gray-800 text-sm mb-2">Morada</h4><p className="text-sm">{order.shippingInfo.street}, {order.shippingInfo.doorNumber}</p><p className="text-sm">{order.shippingInfo.zip} {order.shippingInfo.city}</p></div>
                    </div>

                    <div className="pt-6 border-t">
                        <h4 className="font-bold text-gray-800 text-sm mb-3">Artigos</h4>
                        <div className="space-y-3">
                            {getSafeItems(order.items).map((item, idx) => {
                                const isObject = typeof item === 'object' && item !== null;
                                const itemName = isObject ? (item as OrderItem).name : item as string;
                                const itemQty = isObject ? (item as OrderItem).quantity : 1;
                                const itemPrice = isObject ? (item as OrderItem).price : 0;
                                return (
                                    <div key={idx} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-gray-200 text-gray-700 font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full">{itemQty}x</span>
                                            <p className="font-medium text-gray-800">{itemName}</p>
                                        </div>
                                        <span className="font-bold text-gray-900">{formatCurrency(itemPrice * itemQty)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="pt-6 border-t">
                        <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2"><Truck size={16}/> Rastreio CTT</h4>
                        <div className="flex gap-2">
                            <input type="text" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="EA123456789PT" className="flex-1 p-2 border border-gray-300 rounded-lg" />
                            <button onClick={() => onUpdateTracking(order.id, tracking)} className="bg-indigo-600 text-white px-4 rounded-lg font-bold">Guardar</button>
                        </div>
                    </div>
                </div>
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
  
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'coupons' | 'clients'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'SOLD'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [newCoupon, setNewCoupon] = useState<Coupon>({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0 });
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<'7d' | '30d' | '1y'>('7d');
  const [allUsers, setAllUsers] = useState<UserType[]>([]);

  const [formData, setFormData] = useState({
    name: '', description: '', category: 'TV Box', publicProductId: '', variant: '',
    purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', 
    quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', cashbackValue: '',
    cashbackStatus: 'NONE' as CashbackStatus, badges: [] as string[], images: [] as string[], features: [] as string[]
  });

  useEffect(() => {
    if(!isAdmin) return;
    const unsubOrders = db.collection('orders').orderBy('date', 'desc').onSnapshot(snap => {
        setAllOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });
    const unsubCoupons = db.collection('coupons').onSnapshot(snap => {
        setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon)));
    });
    const unsubUsers = db.collection('users').onSnapshot(snap => {
        setAllUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserType)));
    });
    return () => { unsubOrders(); unsubCoupons(); unsubUsers(); };
  }, [isAdmin]);

  const stats = useMemo(() => {
      let totalInvested = 0, realizedRevenue = 0, realizedProfit = 0, pendingCashback = 0;
      products.forEach(p => {
          totalInvested += (p.purchasePrice || 0) * (p.quantityBought || 0);
          const revenue = (p.salesHistory || []).reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0);
          realizedRevenue += revenue;
          const cogs = p.quantitySold * p.purchasePrice;
          realizedProfit += (revenue - cogs + (p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0));
          if (p.cashbackStatus === 'PENDING') pendingCashback += p.cashbackValue;
      });
      return { totalInvested, realizedRevenue, realizedProfit, pendingCashback };
  }, [products]);

  const handleUpdateTracking = async (orderId: string, tracking: string) => {
      try {
          await db.collection('orders').doc(orderId).update({ trackingNumber: tracking });
          alert("Rastreio guardado.");
      } catch (e) { alert("Erro ao guardar."); }
  };

  const handleAskAi = async () => {
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    try {
        const response = await getInventoryAnalysis(products, aiQuery);
        setAiResponse(response);
    } catch (e) { setAiResponse("Erro na análise."); }
    finally { setIsAiLoading(false); }
  };

  const handleAddNew = () => {
      setEditingId(null);
      setFormData({
          name: '', description: '', category: 'TV Box', publicProductId: '', variant: '',
          purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', 
          quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', cashbackValue: '',
          cashbackStatus: 'NONE', badges: [], images: [], features: []
      });
      setIsModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
        ...formData,
        quantityBought: Number(formData.quantityBought),
        purchasePrice: Number(formData.purchasePrice),
        salePrice: Number(formData.salePrice),
        cashbackValue: Number(formData.cashbackValue),
        publicProductId: formData.publicProductId ? Number(formData.publicProductId) : undefined
    };
    try {
        if (editingId) await updateProduct(editingId, payload as any);
        else await addProduct(payload as any);
        setIsModalOpen(false);
    } catch (e) { alert("Erro ao guardar."); }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        await db.collection('coupons').add({ ...newCoupon, code: newCoupon.code.toUpperCase().trim() });
        setNewCoupon({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0 });
        alert("Cupão criado.");
    } catch (e) { alert("Erro."); }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="text-indigo-600" />
            <h1 className="font-bold text-lg">Painel Admin</h1>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {(['inventory', 'orders', 'clients', 'coupons'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
            ))}
          </div>
          <button onClick={() => window.location.hash = '/'} className="text-sm text-gray-500 hover:text-gray-800">Sair</button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {activeTab === 'inventory' && (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard title="Investido" value={stats.totalInvested} icon={<Package size={18}/>} color="blue" />
                    <KpiCard title="Vendas" value={stats.realizedRevenue} icon={<DollarSign size={18}/>} color="indigo" />
                    <KpiCard title="Lucro" value={stats.realizedProfit} icon={<TrendingUp size={18}/>} color="green" />
                    <KpiCard title="Cashback Pend." value={stats.pendingCashback} icon={<AlertCircle size={18}/>} color="yellow" />
                </div>

                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-2 mb-4"><Bot size={20} className="text-indigo-600"/><h3 className="font-bold">Consultor IA</h3></div>
                    <div className="flex gap-2">
                        <input type="text" value={aiQuery} onChange={e => setAiQuery(e.target.value)} placeholder="Como aumentar as vendas?" className="flex-1 p-2 border rounded-lg" />
                        <button onClick={handleAskAi} disabled={isAiLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">{isAiLoading ? <Loader2 size={18} className="animate-spin"/> : 'Analisar'}</button>
                    </div>
                    {aiResponse && <div className="mt-4 p-4 bg-indigo-50 rounded-lg text-sm whitespace-pre-wrap">{aiResponse}</div>}
                </div>

                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center">
                        <button onClick={handleAddNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={18}/> Novo Lote</button>
                        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Filtrar produtos..." className="pl-10 pr-4 py-2 border rounded-lg text-sm" /></div>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500"><tr><th className="px-6 py-4">Produto</th><th className="px-6 py-4">Stock</th><th className="px-6 py-4">Venda</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
                        <tbody className="divide-y text-sm">
                            {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium">{p.name} {p.variant && <span className="text-gray-400">({p.variant})</span>}</td>
                                    <td className="px-6 py-4">{p.quantityBought - p.quantitySold} / {p.quantityBought}</td>
                                    <td className="px-6 py-4">{formatCurrency(p.salePrice)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => { setEditingId(p.id); setFormData({ ...p, publicProductId: p.publicProductId?.toString() || '', quantityBought: p.quantityBought.toString(), purchasePrice: p.purchasePrice.toString(), salePrice: p.salePrice.toString(), cashbackValue: p.cashbackValue.toString() } as any); setIsModalOpen(true); }} className="text-indigo-600 hover:underline">Editar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'orders' && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b"><h3 className="font-bold">Encomendas Recentes</h3></div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500"><tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Valor</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y text-sm">
                        {allOrders.map(o => (
                            <tr key={o.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-mono text-xs">{o.id}</td>
                                <td className="px-6 py-4">{o.shippingInfo.name}</td>
                                <td className="px-6 py-4 font-bold">{formatCurrency(o.total)}</td>
                                <td className="px-6 py-4"><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{o.status}</span></td>
                                <td className="px-6 py-4 text-right"><button onClick={() => setSelectedOrderDetails(o)} className="text-indigo-600 font-bold hover:underline">Detalhes</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'coupons' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <form onSubmit={handleAddCoupon} className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                        <h3 className="font-bold">Novo Cupão</h3>
                        <input type="text" value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value})} placeholder="CÓDIGO" className="w-full p-2 border rounded-lg" required />
                        <div className="flex gap-2">
                            <select value={newCoupon.type} onChange={e => setNewCoupon({...newCoupon, type: e.target.value as any})} className="p-2 border rounded-lg flex-1">
                                <option value="PERCENTAGE">%</option><option value="FIXED">€</option>
                            </select>
                            <input type="number" value={newCoupon.value} onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})} className="p-2 border rounded-lg w-20" required />
                        </div>
                        <input type="number" value={newCoupon.minPurchase} onChange={e => setNewCoupon({...newCoupon, minPurchase: Number(e.target.value)})} placeholder="Compra mínima (€)" className="w-full p-2 border rounded-lg" />
                        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">Criar Cupão</button>
                    </form>
                </div>
                <div className="md:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500"><tr><th className="px-6 py-4">Código</th><th className="px-6 py-4">Desconto</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
                        <tbody className="divide-y text-sm">
                            {coupons.map(c => (
                                <tr key={c.id}>
                                    <td className="px-6 py-4 font-mono font-bold">{c.code}</td>
                                    <td className="px-6 py-4">{c.type === 'FIXED' ? `${c.value}€` : `${c.value}%`}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={async () => await db.collection('coupons').doc(c.id).delete()} className="text-red-500"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <form onSubmit={handleProductSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0">
                      <h3 className="font-bold">{editingId ? 'Editar Produto' : 'Novo Lote de Inventário'}</h3>
                      <button type="button" onClick={() => setIsModalOpen(false)}><X size={24}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2"><label className="text-xs font-bold text-gray-500 block mb-1">Nome do Produto</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded" required /></div>
                          <div><label className="text-xs font-bold text-gray-500 block mb-1">Qtd. Comprada</label><input type="number" value={formData.quantityBought} onChange={e => setFormData({...formData, quantityBought: e.target.value})} className="w-full p-2 border rounded" required /></div>
                          <div><label className="text-xs font-bold text-gray-500 block mb-1">Preço Compra (€)</label><input type="number" step="0.01" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} className="w-full p-2 border rounded" required /></div>
                          <div><label className="text-xs font-bold text-gray-500 block mb-1">Preço Venda (€)</label><input type="number" step="0.01" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} className="w-full p-2 border rounded" required /></div>
                          <div><label className="text-xs font-bold text-gray-500 block mb-1">Cashback (€)</label><input type="number" step="0.01" value={formData.cashbackValue} onChange={e => setFormData({...formData, cashbackValue: e.target.value})} className="w-full p-2 border rounded" /></div>
                      </div>
                  </div>
                  <div className="p-6 border-t bg-gray-50 flex justify-end gap-2">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded font-bold">Cancelar</button>
                      <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded font-bold shadow-lg">Guardar</button>
                  </div>
              </form>
          </div>
      )}

      {selectedOrderDetails && (
          <OrderDetailsModal 
            order={selectedOrderDetails} 
            onClose={() => setSelectedOrderDetails(null)} 
            onUpdateOrder={(id, up) => setAllOrders(prev => prev.map(o => o.id === id ? {...o, ...up} : o))} 
            onUpdateTracking={handleUpdateTracking} 
            onCopy={text => navigator.clipboard.writeText(text)} 
          />
      )}
    </div>
  );
};

export default Dashboard;
