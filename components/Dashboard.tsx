
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, ShoppingCart, User as UserIcon, MapPin, BarChart2, TicketPercent, ToggleLeft, ToggleRight, Save, Bell, Truck, Globe, FileText, CheckCircle, Copy, Bot, Send, Users, Eye, AlertTriangle, Camera, Zap, ZapOff, QrCode, Home, ArrowLeft, RefreshCw, ClipboardEdit, MinusCircle, Calendar, Info, Database, UploadCloud, Tag, Image as ImageIcon, AlignLeft, ListPlus, ArrowRight as ArrowRightIcon, Layers, Lock, Unlock, CalendarClock, Upload, Loader2, ChevronDown, ChevronRight, ShieldAlert, XCircle, Mail, ScanBarcode, ShieldCheck, ZoomIn, BrainCircuit, Wifi, WifiOff, ExternalLink, Key as KeyIcon, Coins, Combine, Printer
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
        if (!window.confirm("Tem a certeza que quer anular os pontos desta encomenda?")) return;
        setIsUpdatingPoints(true);
        try {
            await db.collection('orders').doc(order.id).update({ pointsAwarded: false });
            onUpdateOrder(order.id, { pointsAwarded: false });
            alert("Selo de pontos removido!");
        } catch (error) { alert("Erro ao anular pontos."); } finally { setIsUpdatingPoints(false); }
    };
    
    const handleManualPointsAward = async () => {
        if (manualPoints <= 0) { alert("Insira um valor válido."); return; }
        setIsUpdatingPoints(true);
        try {
            let userRef = order.userId ? db.collection('users').doc(order.userId) : null;
            if (!userRef && order.shippingInfo.email) {
                const userQuery = await db.collection('users').where('email', '==', order.shippingInfo.email.trim().toLowerCase()).limit(1).get();
                if (!userQuery.empty) userRef = userQuery.docs[0].ref;
            }
            if (!userRef) throw new Error("Utilizador não encontrado.");
            const orderRef = db.collection('orders').doc(order.id);
            await db.runTransaction(async (t) => {
                const userDoc = await t.get(userRef!);
                if (!userDoc.exists) return;
                const userData = userDoc.data() as UserType;
                const newPoints = (userData.loyaltyPoints || 0) + manualPoints;
                t.update(userRef!, { loyaltyPoints: newPoints, pointsHistory: firebase.firestore.FieldValue.arrayUnion({ id: `man-${Date.now()}`, date: new Date().toISOString(), amount: manualPoints, reason: `Ajuste manual (#${order.id.slice(-4)})`, orderId: order.id }) });
                t.update(orderRef, { pointsAwarded: true });
            });
            onUpdateOrder(order.id, { pointsAwarded: true });
            alert("Pontos atribuídos!");
        } catch (error: any) { alert("Erro: " + error.message); } finally { setIsUpdatingPoints(false); }
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
                      <div className="space-y-1"><h4 className="font-bold text-gray-800 text-sm mb-2">Cliente</h4><p className="text-sm">{order.shippingInfo.name}</p><p className="text-sm">{order.shippingInfo.email}</p><p className="text-sm font-bold text-indigo-600 cursor-pointer hover:underline" onClick={() => onCopy(order.shippingInfo.phone)}>{order.shippingInfo.phone}</p></div>
                      <div className="space-y-1"><h4 className="font-bold text-gray-800 text-sm mb-2">Morada de Envio</h4><p className="text-sm">{order.shippingInfo.street}</p><p className="text-sm">{order.shippingInfo.zip} {order.shippingInfo.city}</p></div>
                    </div>

                    <div className="pt-6 border-t"><h4 className="font-bold text-gray-800 text-sm mb-3">Artigos</h4><div className="space-y-2">{getSafeItems(order.items).map((item, idx) => ( <div key={idx} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><span className="bg-white px-1.5 rounded font-bold text-indigo-600 border border-indigo-100">{typeof item === 'object' ? item.quantity : 1}x</span><p className="font-medium text-gray-800">{typeof item === 'object' ? item.name : item}</p></div><span className="font-bold">{typeof item === 'object' ? formatCurrency(item.price * item.quantity) : '-'}</span></div> ))}</div></div>

                    <div className="pt-6 border-t">
                        <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2"><History size={16} className="text-indigo-600"/> Histórico de Atividade / Reclamações</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {(order.statusHistory && order.statusHistory.length > 0) ? (
                                [...order.statusHistory].reverse().map((h, i) => (
                                    <div key={i} className={`p-3 rounded-lg border text-xs leading-relaxed ${h.status.includes('Reclamação') || h.status.includes('Garantia') ? 'bg-red-50 border-red-100 shadow-sm' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className="flex justify-between font-bold mb-1">
                                            <span className={h.status.includes('Reclamação') ? 'text-red-700' : 'text-gray-700'}>{h.status.toUpperCase()}</span>
                                            <span className="text-gray-400 font-normal">{new Date(h.date).toLocaleString('pt-PT')}</span>
                                        </div>
                                        {h.notes ? <p className="text-gray-800 whitespace-pre-wrap">{h.notes}</p> : <p className="text-gray-400 italic">Sem notas adicionais.</p>}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-sm italic">Nenhum evento registado.</p>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 border-t"><h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2"><Truck size={16}/> Rastreio CTT</h4><div className="flex gap-2"><input type="text" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Ex: EA123456789PT" className="flex-1 p-2 border border-gray-300 rounded-lg text-sm" /><button onClick={() => onUpdateTracking(order.id, tracking)} className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-700 text-sm">Guardar</button></div></div>
                    
                    <div className="border-t pt-4">
                        <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Coins size={16} className="text-yellow-500"/> Gestão de Pontos</h4>
                        <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
                            <p className="text-sm">Estado: {order.pointsAwarded ? <span className="font-bold text-green-600">✓ Atribuídos</span> : <span className="font-bold text-orange-600">⚠ Pendentes</span>}</p>
                            <div className="flex gap-2">
                                <input type="number" value={manualPoints || ''} onChange={e => setManualPoints(Number(e.target.value))} className="w-24 p-2 border rounded text-sm" placeholder="Pts" />
                                <button onClick={handleManualPointsAward} disabled={isUpdatingPoints} className="bg-blue-600 text-white px-4 rounded font-bold text-xs hover:bg-blue-700 disabled:opacity-50">Atribuir Manualmente</button>
                                {order.pointsAwarded && <button onClick={handleRevokePoints} className="text-red-500 text-xs font-bold hover:underline">Anular</button>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* FIX: Restored the missing Dashboard component and integrated improvements from both provided versions. */
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
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
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [clientsSearchTerm, setClientsSearchTerm] = useState('');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generateQty, setGenerateQty] = useState(1);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserType | null>(null);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [isRecalculatingClient, setIsRecalculatingClient] = useState(false);

  const [isMerging, setIsMerging] = useState(false);
  const [mergeSearchEmail, setMergeSearchEmail] = useState('');
  const [foundDuplicate, setFoundDuplicate] = useState<UserType | null>(null);
  const [duplicateOrdersCount, setDuplicateOrdersCount] = useState(0);
  const [duplicateOrdersTotal, setDuplicateOrdersTotal] = useState(0);

  const [formData, setFormData] = useState({
    name: '', description: '', category: '', publicProductId: '' as string, variant: '',
    purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', 
    quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', cashbackValue: '',
    cashbackStatus: 'NONE' as CashbackStatus, badges: [] as string[], newImageUrl: '', 
    images: [] as string[], features: [] as string[], newFeature: '', comingSoon: false
  });

  const [saleForm, setSaleForm] = useState({
    quantity: '1', unitPrice: '', shippingCost: '', date: new Date().toISOString().split('T')[0], notes: '', supplierName: '', supplierOrderId: ''
  });

  const pendingOrders = useMemo(() => allOrders.filter(o => ['Processamento', 'Pago'].includes(o.status)), [allOrders]);

  useEffect(() => {
    if(!isAdmin) return;
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    const unsubscribe = db.collection('orders').orderBy('date', 'desc').limit(10).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const order = change.doc.data() as Order;
                if (new Date(order.date).getTime() > Date.now() - 5000) {
                    setNotifications(prev => [order, ...prev]);
                    setShowToast(order);
                    audioRef.current?.play().catch(() => {});
                    setTimeout(() => setShowToast(null), 5000);
                }
            }
        });
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
    setIsOrdersLoading(true);
    const unsubscribe = db.collection('orders').orderBy('date', 'desc').onSnapshot(snapshot => {
        setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
        setIsOrdersLoading(false);
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

  const stats = useMemo(() => { 
    let totalInvested = 0, realizedRevenue = 0, realizedProfit = 0, pendingCashback = 0, potentialProfit = 0; 
    products.forEach(p => { 
      totalInvested += (p.purchasePrice || 0) * (p.quantityBought || 0); 
      let revenue = (p.salesHistory || []).reduce((acc, s) => acc + ((s.quantity || 0) * (s.unitPrice || 0)), 0); 
      realizedRevenue += revenue; 
      realizedProfit += revenue - (p.quantitySold * p.purchasePrice) + (p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0); 
      if (p.cashbackStatus === 'PENDING') pendingCashback += p.cashbackValue; 
    }); 
    return { totalInvested, realizedRevenue, realizedProfit, pendingCashback, potentialProfit }; 
  }, [products]);

  const chartData = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const label = d.toLocaleDateString('pt-PT', { day: 'numeric' });
        const val = allOrders.filter(o => new Date(o.date).toDateString() === d.toDateString() && o.status !== 'Cancelado').reduce((acc, o) => acc + o.total, 0);
        days.push({ label, value: val });
    }
    const maxValue = Math.max(...days.map(d => d.value), 1);
    const totalPeriod = days.reduce((acc, d) => acc + d.value, 0);
    return { days, maxValue, totalPeriod };
  }, [allOrders]);

  const groupedInventory = useMemo(() => {
      const groups: { [key: string]: InventoryProduct[] } = {};
      products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).forEach(p => { 
          const key = p.publicProductId ? p.publicProductId.toString() : `local-${p.id}`; 
          if (!groups[key]) groups[key] = []; 
          groups[key].push(p); 
      });
      return Object.entries(groups);
  }, [products, searchTerm]);

  const handleEdit = (product: InventoryProduct) => { setEditingId(product.id); setFormData({ ...formData, name: product.name, publicProductId: product.publicProductId?.toString() || '', purchasePrice: product.purchasePrice.toString(), salePrice: product.salePrice.toString() }); setIsModalOpen(true); };
  const handleAddNew = () => { setEditingId(null); setFormData({ ...formData, name: '', publicProductId: '', purchasePrice: '', salePrice: '' }); setIsModalOpen(true); };
  
  const handleProductSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const payload = { ...formData, purchasePrice: Number(formData.purchasePrice), salePrice: Number(formData.salePrice), publicProductId: Number(formData.publicProductId) };
          if (editingId) await updateProduct(editingId, payload);
          else await addProduct(payload as any);
          setIsModalOpen(false);
      } catch (err) { alert("Erro ao guardar."); }
  };

  const handleOrderStatusChange = async (orderId: string, newStatus: string) => {
    try {
        await db.collection('orders').doc(orderId).update({ status: newStatus });
    } catch (e) { alert("Erro ao atualizar estado."); }
  };

  const handleUpdateTracking = async (orderId: string, tracking: string) => {
      try { await db.collection('orders').doc(orderId).update({ trackingNumber: tracking }); }
      catch (e) { alert("Erro ao guardar rastreio."); }
  };

  const handleAskAi = async () => {
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    try {
        const res = await getInventoryAnalysis(products, aiQuery);
        setAiResponse(res);
    } catch (e) { setAiResponse("Erro ao consultar IA."); }
    finally { setIsAiLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 animate-fade-in relative">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg text-white"><LayoutDashboard size={24} /></div>
              <h1 className="text-xl font-bold text-gray-900">Backoffice</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Inventário</button>
                <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Encomendas</button>
                <button onClick={() => setActiveTab('clients')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'clients' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Clientes</button>
                <button onClick={() => setActiveTab('coupons')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'coupons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Cupões</button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard title="Investido" value={stats.totalInvested} icon={<Package size={18} />} color="blue" />
                <KpiCard title="Receita" value={stats.realizedRevenue} icon={<DollarSign size={18} />} color="indigo" />
                <KpiCard title="Lucro" value={stats.realizedProfit} icon={<TrendingUp size={18} />} color="green" />
                <KpiCard title="Online" value={onlineUsers.length} icon={<Users size={18} />} color="yellow" onClick={() => setIsOnlineDetailsOpen(true)} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-4"><Bot size={20} className="text-indigo-600" /> <h3 className="font-bold">Consultor IA</h3></div>
                <div className="flex gap-2">
                    <input type="text" value={aiQuery} onChange={e => setAiQuery(e.target.value)} className="flex-1 p-2 border rounded-lg" placeholder="Pergunte sobre o stock..." />
                    <button onClick={handleAskAi} disabled={isAiLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">{isAiLoading ? '...' : 'Analisar'}</button>
                </div>
                {aiResponse && <div className="mt-4 p-4 bg-indigo-50 rounded-lg text-sm whitespace-pre-line">{aiResponse}</div>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b flex justify-between">
                    <div className="relative w-64"><input type="text" placeholder="Filtrar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/></div>
                    <button onClick={handleAddNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={18}/> Novo Lote</button>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                        <tr><th className="px-6 py-3">Produto</th><th className="px-6 py-3">Stock</th><th className="px-6 py-3 text-right">Preço</th><th className="px-6 py-3 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {groupedInventory.map(([id, items]) => (
                            <tr key={id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-bold">{items[0].name}</td>
                                <td className="px-6 py-4">{items.reduce((acc, i) => acc + (i.quantityBought - i.quantitySold), 0)} un.</td>
                                <td className="px-6 py-4 text-right">{formatCurrency(items[0].salePrice)}</td>
                                <td className="px-6 py-4 text-right"><button onClick={() => handleEdit(items[0])} className="text-indigo-600 hover:underline">Editar</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border shadow-sm h-64 flex flex-col">
                  <h3 className="font-bold mb-4">Vendas da Semana</h3>
                  <div className="flex-1 flex items-end gap-4 border-b border-l">
                      {chartData.days.map((d, i) => (
                          <div key={i} className="flex-1 bg-indigo-500 rounded-t" style={{ height: `${(d.value / chartData.maxValue) * 100}%` }} title={formatCurrency(d.value)} />
                      ))}
                  </div>
              </div>
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                          <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Valor</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Ações</th></tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                          {allOrders.map(o => (
                              <tr key={o.id}>
                                  <td className="px-6 py-4 font-bold text-indigo-600">{o.id}</td>
                                  <td className="px-6 py-4">{o.shippingInfo.name}</td>
                                  <td className="px-6 py-4 font-bold">{formatCurrency(o.total)}</td>
                                  <td className="px-6 py-4">
                                      <select value={o.status} onChange={e => handleOrderStatusChange(o.id, e.target.value)} className="p-1 border rounded text-xs">
                                          <option value="Processamento">Processamento</option>
                                          <option value="Pago">Pago</option>
                                          <option value="Enviado">Enviado</option>
                                          <option value="Entregue">Entregue</option>
                                          <option value="Cancelado">Cancelado</option>
                                      </select>
                                  </td>
                                  <td className="px-6 py-4 text-right"><button onClick={() => setSelectedOrderDetails(o)} className="text-indigo-600 font-bold">Detalhes</button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
        )}
      </div>

      <OrderDetailsModal order={selectedOrderDetails} onClose={() => setSelectedOrderDetails(null)} onUpdateOrder={(id, up) => setAllOrders(prev => prev.map(o => o.id === id ? {...o, ...up} : o))} onUpdateTracking={handleUpdateTracking} onCopy={text => navigator.clipboard.writeText(text)} />
      <ProfitCalculatorModal isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
                  <h3 className="text-xl font-bold mb-4">{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
                  <form onSubmit={handleProductSubmit} className="space-y-4">
                      <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded" placeholder="Nome" />
                      <input type="number" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} className="w-full p-2 border rounded" placeholder="Preço Compra" />
                      <input type="number" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} className="w-full p-2 border rounded" placeholder="Preço Venda" />
                      <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2 rounded">Guardar</button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="w-full text-gray-500 py-2">Cancelar</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
