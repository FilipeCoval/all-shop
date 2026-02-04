

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, ShoppingCart, User as UserIcon, MapPin, BarChart2, TicketPercent, ToggleLeft, ToggleRight, Save, Bell, Truck, Globe, FileText, CheckCircle, Copy, Bot, Send, Users, Eye, AlertTriangle, Camera, Zap, ZapOff, QrCode, Home, ArrowLeft, RefreshCw, ClipboardEdit, MinusCircle, Calendar, Info, Database, UploadCloud, Tag, Image as ImageIcon, AlignLeft, ListPlus, ArrowRight as ArrowRightIcon, Layers, Lock, Unlock, CalendarClock, Upload, Loader2, ChevronDown, ChevronUp, ShieldAlert, XCircle, Mail, ScanBarcode, ShieldCheck, ZoomIn, BrainCircuit, Wifi, WifiOff, ExternalLink, Key as KeyIcon, Coins, Combine, Printer, BellRing
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord, Order, Coupon, User as UserType, PointHistory, UserTier, ProductUnit, Product, OrderItem, StatusHistory, DashboardNotification } from '../types';
import { getInventoryAnalysis, extractSerialNumberFromImage } from '../services/geminiService';
import { INITIAL_PRODUCTS, LOYALTY_TIERS, STORE_NAME } from '../constants';
import { db, storage, firebase } from '../services/firebaseConfig';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/library';
import Barcode from 'react-barcode';
import ProfitCalculatorModal from './ProfitCalculatorModal';

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
                if (userDoc.exists) {
                    userRef = potentialUserRef;
                }
            }

            if (!userRef && order.shippingInfo?.email) {
                const userQuery = await db.collection('users')
                    .where('email', '==', order.shippingInfo.email.trim().toLowerCase())
                    .limit(1)
                    .get();
                
                if (!userQuery.empty) {
                    userRef = userQuery.docs[0].ref;
                }
            }
            
            if (!userRef) {
                throw new Error("Utilizador não encontrado (nem por ID, nem por email). Verifique se o cliente tem conta criada.");
            }

            const orderRef = db.collection('orders').doc(order.id);

            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef!);
                if (!userDoc.exists) throw new Error("Utilizador não encontrado na base de dados.");

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
            console.error("Erro ao atribuir pontos manualmente:", error);
            alert(`Ocorreu um erro ao atribuir os pontos: ${error.message}`);
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
                      <div className="space-y-1"><h4 className="font-bold text-gray-800 text-sm mb-2">Cliente</h4><p className="text-sm">{order.shippingInfo?.name || 'N/A'}</p><p className="text-sm">{order.shippingInfo?.email || 'N/A'}</p><p className="text-sm">{order.shippingInfo?.phone || 'N/A'}</p><p className="text-sm">{order.shippingInfo?.nif && `NIF: ${order.shippingInfo.nif}`}</p></div>
                      <div className="space-y-1"><h4 className="font-bold text-gray-800 text-sm mb-2">Morada de Envio</h4><p className="text-sm">{order.shippingInfo?.street || 'N/A'}, {order.shippingInfo?.doorNumber}</p><p className="text-sm">{order.shippingInfo?.zip} {order.shippingInfo?.city}</p></div>
                    </div>

                    <div className="pt-6 border-t"><h4 className="font-bold text-gray-800 text-sm mb-3">Artigos</h4><div className="space-y-3">{getSafeItems(order.items).map((item, idx) => { const isObject = typeof item === 'object' && item !== null; const itemName = isObject ? (item as OrderItem).name : item as string; const itemQty = isObject ? (item as OrderItem).quantity : 1; const itemPrice = isObject ? (item as OrderItem).price : 0; const itemVariant = isObject && (item as OrderItem).selectedVariant ? `(${(item as OrderItem).selectedVariant})` : ''; const itemSerials = isObject && (item as OrderItem).serialNumbers; return (<div key={idx} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><span className="bg-gray-200 text-gray-700 font-bold text-xs w-6 h-6 flex items-center justify-center rounded-full">{itemQty}x</span><div><p className="font-medium text-gray-800">{itemName} {itemVariant}</p>{itemSerials && itemSerials.length > 0 && (<div className="text-[10px] text-green-700 font-mono mt-1 flex items-center gap-1"><QrCode size={12}/> {itemSerials.join(', ')}</div>)}</div></div><span className="font-bold text-gray-900">{formatCurrency(itemPrice * itemQty)}</span></div>); })}</div></div>

                    <div className="pt-6 border-t"><h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2"><Truck size={16}/> Rastreio CTT</h4><div className="flex gap-2"><input type="text" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Ex: EA123456789PT" className="flex-1 p-2 border border-gray-300 rounded-lg" /><button onClick={() => onUpdateTracking(order.id, tracking)} className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-700">Guardar</button></div></div>
                    
                    <div className="border-t pt-4">
                        <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Coins size={16} className="text-yellow-500"/> Gestão de Pontos de Lealdade</h4>
                        <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
                            <p className="text-sm">Estado: {order.pointsAwarded ? <span className="font-bold text-green-600 flex items-center gap-1"><CheckCircle size={14}/> Pontos Atribuídos</span> : <span className="font-bold text-orange-600 flex items-center gap-1"><AlertTriangle size={14}/> Pontos Pendentes</span>}</p>
                            
                            {order.pointsAwarded && (
                                <button onClick={handleRevokePoints} disabled={isUpdatingPoints} className="bg-red-100 text-red-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center gap-2">
                                    {isUpdatingPoints ? <Loader2 className="animate-spin" /> : <><XCircle size={14}/>Anular Pontos Atribuídos</>}
                                </button>
                            )}

                            <div className="space-y-2 pt-4 border-t">
                                <label className="text-sm font-bold text-gray-600 block">Atribuição Manual</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        value={manualPoints === 0 ? '' : manualPoints}
                                        onChange={(e) => setManualPoints(Number(e.target.value))}
                                        className="w-32 p-2 border rounded-lg"
                                        placeholder="Ex: 45"
                                    />
                                    <button onClick={handleManualPointsAward} disabled={isUpdatingPoints} className="bg-blue-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50">
                                        {isUpdatingPoints ? <Loader2 className="animate-spin" /> : 'Atribuir'}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500">Use para corrigir ou dar pontos extra. Isto irá marcar a encomenda como "pontos atribuídos".</p>
                            </div>
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
  const [cashbackFilter, setCashbackFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'NONE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<InventoryProduct | null>(null);
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [claimNotifications, setClaimNotifications] = useState<DashboardNotification[]>([]);
  const [isClaimDropdownOpen, setIsClaimDropdownOpen] = useState(false);
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
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [clientsSearchTerm, setClientsSearchTerm] = useState('');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generateQty, setGenerateQty] = useState(1);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  
  // States para modal de detalhes do cliente
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserType | null>(null);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [isRecalculatingClient, setIsRecalculatingClient] = useState(false);

  // Estados para a ferramenta de fusão de contas
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

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = db.collection('dashboard_notifications')
      .orderBy('date', 'desc')
      .onSnapshot(snapshot => {
        setClaimNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DashboardNotification)));
      });
    return () => unsubscribe();
  }, [isAdmin]);

  const unreadClaimsCount = useMemo(() => claimNotifications.filter(n => !n.read).length, [claimNotifications]);

  const handleNotificationClick = async (notification: DashboardNotification) => {
    const orderToOpen = allOrders.find(o => o.id === notification.orderId);
    if (orderToOpen) {
      setSelectedOrderDetails(orderToOpen);
    } else {
      alert(`Encomenda ${notification.orderId} não encontrada.`);
    }
    
    if (!notification.read) {
      await db.collection('dashboard_notifications').doc(notification.id).update({ read: true });
    }
    setIsClaimDropdownOpen(false);
  };
  
  const handleMarkAllAsRead = async () => {
    const unreadIds = claimNotifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    const batch = db.batch();
    unreadIds.forEach(id => {
      batch.update(db.collection('dashboard_notifications').doc(id), { read: true });
    });
    await batch.commit();
  };

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
                if (!idMatch) return false;

                const inventoryHasVariant = !!selectedProductForSale.variant;
                const orderHasVariant = !!item.selectedVariant;

                if (inventoryHasVariant && orderHasVariant) {
                    return item.selectedVariant === selectedProductForSale.variant;
                }
                if (!inventoryHasVariant && !orderHasVariant) {
                    return true;
                }
                if (!inventoryHasVariant && orderHasVariant) {
                    return false;
                }
                if (inventoryHasVariant && !orderHasVariant) {
                    return true;
                }

                return false;
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
      if (activeTab === 'clients' && isAdmin) {
          setIsUsersLoading(true);
          const unsubscribe = db.collection('users').onSnapshot(snapshot => {
              setAllUsers(snapshot.docs.map(doc => ({ 
                uid: doc.id,
                ...doc.data() 
              } as UserType)));
              setIsUsersLoading(false);
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

  // Efeito para buscar encomendas do cliente selecionado
  useEffect(() => {
    const fetchClientData = async () => {
        if (selectedUserDetails) {
            const [userOrdersSnap, guestOrdersSnap] = await Promise.all([
                db.collection("orders").where("userId", "==", selectedUserDetails.uid).get(),
                db.collection('orders').where('shippingInfo.email', '==', selectedUserDetails.email.toLowerCase()).where('userId', '==', null).get()
            ]);
            const allClientOrders: Order[] = [];
            userOrdersSnap.forEach(doc => allClientOrders.push({ id: doc.id, ...doc.data() } as Order));
            guestOrdersSnap.forEach(doc => allClientOrders.push({ id: doc.id, ...doc.data() } as Order));
            setClientOrders(allClientOrders);

            setMergeSearchEmail(selectedUserDetails.email);
            setFoundDuplicate(null);
            setDuplicateOrdersCount(0);
            setDuplicateOrdersTotal(0);
        } else {
            setClientOrders([]);
        }
    };
    fetchClientData();
  }, [selectedUserDetails]);

  const calculatedTotalSpent = useMemo(() => {
      if (!selectedUserDetails) return 0;
      return clientOrders
          .filter(o => o.status !== 'Cancelado')
          .reduce((sum, order) => sum + (order.total || 0), 0);
  }, [clientOrders, selectedUserDetails]);

  const handleRecalculateClientData = async () => {
    if (!selectedUserDetails) return;

    setIsRecalculatingClient(true);
    try {
        const userRef = db.collection('users').doc(selectedUserDetails.uid);

        const totalSpent = calculatedTotalSpent;
        
        let correctTier: UserTier = 'Bronze';
        if (totalSpent >= LOYALTY_TIERS.GOLD.threshold) correctTier = 'Ouro';
        else if (totalSpent >= LOYALTY_TIERS.SILVER.threshold) correctTier = 'Prata';
        
        const ordersToAwardPoints = clientOrders.filter(o => o.status === 'Entregue' && !o.pointsAwarded);
        
        let missingPoints = 0;
        const newHistoryItems: PointHistory[] = [];
        if (ordersToAwardPoints.length > 0) {
            const multiplier = LOYALTY_TIERS[correctTier.toUpperCase() as keyof typeof LOYALTY_TIERS].multiplier;
            ordersToAwardPoints.forEach(o => {
                const pointsForThisOrder = Math.floor((o.total || 0) * multiplier);
                if (pointsForThisOrder > 0) {
                    missingPoints += pointsForThisOrder;
                    newHistoryItems.push({ id: `recalc-${o.id}`, date: new Date().toISOString(), amount: pointsForThisOrder, reason: `Compra #${o.id.slice(-6)} (Recálculo)`, orderId: o.id });
                }
            });
        }
        
        const batch = db.batch();
        const userUpdateData: any = {
            totalSpent: totalSpent,
            tier: correctTier
        };
        
        if (missingPoints > 0) {
            userUpdateData.loyaltyPoints = firebase.firestore.FieldValue.increment(missingPoints);
            userUpdateData.pointsHistory = firebase.firestore.FieldValue.arrayUnion(...newHistoryItems);
        }
        
        batch.update(userRef, userUpdateData);

        // Migrar encomendas de convidado
        clientOrders.filter(o => !o.userId).forEach(o => {
            batch.update(db.collection('orders').doc(o.id), { userId: selectedUserDetails.uid });
        });
        
        // Marcar pontos como atribuídos
        ordersToAwardPoints.forEach(order => {
            batch.update(db.collection('orders').doc(order.id), { pointsAwarded: true });
        });
        
        await batch.commit();

        // Atualizar estado local para refletir a mudança
        const updatedUserDoc = await userRef.get();
        if (updatedUserDoc.exists) {
            setSelectedUserDetails(updatedUserDoc.data() as UserType);
        }

        alert("Dados do cliente recalculados e sincronizados com sucesso!");

    } catch (error) {
        console.error("Erro ao recalcular dados do cliente:", error);
        alert("Ocorreu um erro. Verifique a consola.");
    } finally {
        setIsRecalculatingClient(false);
    }
  };


  const handleUpdateOrderState = (orderId: string, updates: Partial<Order>) => {
    setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
    if (selectedOrderDetails && selectedOrderDetails.id === orderId) {
        setSelectedOrderDetails(prev => prev ? { ...prev, ...updates } : null);
    }
  };

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
          batch.update(orderRef, { status: newStatus, statusHistory: firebase.firestore.FieldValue.arrayUnion({ status: newStatus as StatusHistory['status'], date: new Date().toISOString() }) });

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

  // --- MERGE ACCOUNTS LOGIC (FIXED) ---
  const handleSearchDuplicate = async () => {
    if (!selectedUserDetails) return;
    const emailToSearch = mergeSearchEmail.trim().toLowerCase();
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', emailToSearch).get();
        
        if (snapshot.docs.length < 2) {
            setFoundDuplicate(null);
            setDuplicateOrdersCount(0);
            setDuplicateOrdersTotal(0);
            alert("Nenhuma conta duplicada encontrada com este email.");
            return;
        }

        const duplicateDoc = snapshot.docs.find(doc => doc.id !== selectedUserDetails.uid);

        if (!duplicateDoc) {
             setFoundDuplicate(null);
             setDuplicateOrdersCount(0);
             setDuplicateOrdersTotal(0);
             alert("Nenhuma conta duplicada (diferente da atual) encontrada.");
             return;
        }

        const duplicateData = { uid: duplicateDoc.id, ...duplicateDoc.data() } as UserType;
        setFoundDuplicate(duplicateData);
        
        const ordersSnapshot = await db.collection('orders').where('userId', '==', duplicateData.uid).get();
        const totalToSum = ordersSnapshot.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
        setDuplicateOrdersCount(ordersSnapshot.size);
        setDuplicateOrdersTotal(totalToSum);

    } catch (error) {
        console.error("Erro ao procurar duplicado:", error);
        alert("Ocorreu um erro ao procurar. Verifique a consola.");
    }
  };

  const handleConfirmMerge = async () => {
    if (!selectedUserDetails || !foundDuplicate) return;
    if (!window.confirm(`Tem a CERTEZA ABSOLUTA que quer fundir a conta de ${foundDuplicate.name} na conta de ${selectedUserDetails.name}? Esta ação é irreversível.`)) return;

    setIsMerging(true);
    try {
        const targetUserRef = db.collection('users').doc(selectedUserDetails.uid);
        const sourceUserRef = db.collection('users').doc(foundDuplicate.uid);

        const targetUserOrdersSnap = await db.collection('orders').where('userId', '==', selectedUserDetails.uid).get();
        const sourceUserOrdersSnap = await db.collection('orders').where('userId', '==', foundDuplicate.uid).get();
        
        const batch = db.batch();
        sourceUserOrdersSnap.forEach(doc => {
            batch.update(doc.ref, { userId: selectedUserDetails.uid });
        });

        const allMergedOrders = [
            ...targetUserOrdersSnap.docs.map(d => d.data() as Order),
            ...sourceUserOrdersSnap.docs.map(d => d.data() as Order)
        ];

        const newTotalSpent = allMergedOrders
            .filter(o => o.status !== 'Cancelado')
            .reduce((sum, o) => sum + (o.total || 0), 0);
        
        const newPoints = (selectedUserDetails.loyaltyPoints || 0) + (foundDuplicate.loyaltyPoints || 0);
        const mergedHistory = [...(selectedUserDetails.pointsHistory || []), ...(foundDuplicate.pointsHistory || [])]
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        batch.update(targetUserRef, {
            loyaltyPoints: newPoints,
            totalSpent: newTotalSpent,
            pointsHistory: mergedHistory
        });

        batch.delete(sourceUserRef);
        
        await batch.commit();

        alert("Fusão concluída com sucesso! Os dados foram combinados e as encomendas reatribuídas.");
        setSelectedUserDetails(null);
    } catch (error) {
        console.error("Erro na fusão de contas:", error);
        alert("Ocorreu um erro crítico durante a fusão. Verifique a consola.");
    } finally {
        setIsMerging(false);
    }
  };


  const handleUpdateTracking = async (orderId: string, tracking: string) => { try { await db.collection('orders').doc(orderId).update({ trackingNumber: tracking, statusHistory: firebase.firestore.FieldValue.arrayUnion({ status: 'Enviado', date: new Date().toISOString(), notes: `CTT: ${tracking}` }) }); if (selectedOrderDetails) setSelectedOrderDetails({...selectedOrderDetails, trackingNumber: tracking}); handleUpdateOrderState(orderId, { trackingNumber: tracking, status: 'Enviado' }); } catch (e) { alert("Erro ao gravar rastreio"); } };
  const handleCopy = (text: string) => { if (!copyToClipboard(text)) alert("Não foi possível copiar."); };
  const handleAskAi = async () => { if (!aiQuery.trim()) return; setIsAiLoading(true); setAiResponse(null); try { setAiResponse(await getInventoryAnalysis(products, aiQuery)); } catch (e) { setAiResponse("Não foi possível processar o pedido."); } finally { setIsAiLoading(false); } };
  
  const chartData = useMemo(() => { const numDays = chartTimeframe === '1y' ? 365 : chartTimeframe === '30d' ? 30 : 7; const toLocalISO = (dateStr: string) => { if (!dateStr) return ''; const d = new Date(dateStr); if (isNaN(d.getTime())) return ''; if (dateStr.length === 10 && !dateStr.includes('T')) return dateStr; const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0'); const day = d.getDate().toString().padStart(2, '0'); return `${year}-${month}-${day}`; }; 
  const manualSales = products.flatMap(p => 
        (p.salesHistory || [])
            .filter(s => !s.id.startsWith('ORDER-')) // IGNORA VENDAS LIGADAS A ENCOMENDAS ONLINE
            .map(s => ({ date: toLocalISO(s.date), total: (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0) }))
    );
  const onlineOrders = allOrders.filter(o => o.status !== 'Cancelado').map(o => ({ date: toLocalISO(o.date), total: (Number(o.total) || 0) })); const allSales = [...manualSales, ...onlineOrders]; const today = new Date(); let totalPeriod = 0; if (chartTimeframe === '1y') { const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(today.getMonth() - i, 1); return d; }).reverse(); const monthlyData = months.map(monthStart => { const year = monthStart.getFullYear(); const month = monthStart.getMonth() + 1; const monthStr = `${year}-${month.toString().padStart(2, '0')}`; const totalForMonth = allSales.reduce((acc, sale) => { return sale.date.startsWith(monthStr) ? acc + sale.total : acc; }, 0); totalPeriod += totalForMonth; return { label: monthStart.toLocaleDateString('pt-PT', { month: 'short' }), value: totalForMonth }; }); const maxValue = Math.max(...monthlyData.map(d => d.value), 1); return { days: monthlyData, maxValue, totalPeriod }; } else { const days = []; for (let i = numDays - 1; i >= 0; i--) { const d = new Date(); d.setDate(today.getDate() - i); const year = d.getFullYear(); const month = (d.getMonth() + 1).toString().padStart(2, '0'); const day = d.getDate().toString().padStart(2, '0'); const dateLabel = `${year}-${month}-${day}`; const totalForDay = allSales.reduce((acc, sale) => sale.date === dateLabel ? acc + sale.total : acc, 0); totalPeriod += totalForDay; days.push({ label: d.toLocaleDateString('pt-PT', { day: 'numeric' }), date: dateLabel, value: totalForDay }); } const maxValue = Math.max(...days.map(d => d.value), 1); return { days, maxValue, totalPeriod }; } }, [allOrders, products, chartTimeframe]);
  const stats = useMemo(() => { let totalInvested = 0, realizedRevenue = 0, realizedProfit = 0, pendingCashback = 0, potentialProfit = 0; products.forEach(p => { const invested = (p.purchasePrice || 0) * (p.quantityBought || 0); totalInvested += invested; let revenue = 0, totalShippingPaid = 0; if (p.salesHistory && p.salesHistory.length > 0) { revenue = p.salesHistory.reduce((acc, sale) => acc + ((sale.quantity || 0) * (sale.unitPrice || 0)), 0); totalShippingPaid = p.salesHistory.reduce((acc, sale) => acc + (sale.shippingCost || 0), 0); } else { revenue = (p.quantitySold || 0) * (p.salePrice || 0); } realizedRevenue += revenue; const cogs = (p.quantitySold || 0) * (p.purchasePrice || 0); const profitFromSales = revenue - cogs - totalShippingPaid; const cashback = p.cashbackStatus === 'RECEIVED' ? (p.cashbackValue || 0) : 0; realizedProfit += profitFromSales + cashback; if (p.cashbackStatus === 'PENDING') { pendingCashback += (p.cashbackValue || 0); } const remainingStock = (p.quantityBought || 0) - (p.quantitySold || 0); if (remainingStock > 0 && p.targetSalePrice) { potentialProfit += ((p.targetSalePrice || 0) - (p.purchasePrice || 0)) * remainingStock; } }); return { totalInvested, realizedRevenue, realizedProfit, pendingCashback, potentialProfit }; }, [products]);
  
  const handleEdit = (product: InventoryProduct) => { 
      setEditingId(product.id); 
      setFormData({ 
          name: product.name, description: product.description || '', category: product.category, publicProductId: product.publicProductId ? product.publicProductId.toString() : '', variant: product.variant || '', purchaseDate: product.purchaseDate, supplierName: product.supplierName || '', supplierOrderId: product.supplierOrderId || '', quantityBought: product.quantityBought.toString(), purchasePrice: product.purchasePrice.toString(), salePrice: product.salePrice ? product.salePrice.toString() : '', targetSalePrice: product.targetSalePrice ? product.targetSalePrice.toString() : '', cashbackValue: product.cashbackValue.toString(), cashbackStatus: product.cashbackStatus, badges: product.badges || [], images: product.images || [], newImageUrl: '', features: product.features || [], newFeature: '', comingSoon: product.comingSoon || false
      }); 
      setModalUnits(product.units || []); setGeneratedCodes([]); setIsPublicIdEditable(false); setIsModalOpen(true); 
  };

  const handleAddNew = () => { 
      setEditingId(null); 
      setFormData({ 
          name: '', description: '', category: 'TV & Streaming', publicProductId: '', variant: '', purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', cashbackValue: '', cashbackStatus: 'NONE', badges: [], images: [], newImageUrl: '', features: [], newFeature: '', comingSoon: false
      }); 
      setModalUnits([]); setGeneratedCodes([]); setIsPublicIdEditable(false); setIsModalOpen(true); 
  };

  const handleCreateVariant = (parentProduct: InventoryProduct) => {
      setEditingId(null); 
      setFormData({ 
          name: parentProduct.name, description: parentProduct.description || '', category: parentProduct.category, publicProductId: parentProduct.publicProductId ? parentProduct.publicProductId.toString() : '', variant: '', purchaseDate: new Date().toISOString().split('T')[0], supplierName: parentProduct.supplierName || '', supplierOrderId: '', quantityBought: '', purchasePrice: parentProduct.purchasePrice.toString(), salePrice: parentProduct.salePrice ? parentProduct.salePrice.toString() : '', targetSalePrice: parentProduct.targetSalePrice ? parentProduct.targetSalePrice.toString() : '', cashbackValue: '', cashbackStatus: 'NONE', badges: parentProduct.badges || [], images: parentProduct.images || [], newImageUrl: '', features: parentProduct.features || [], newFeature: '', comingSoon: parentProduct.comingSoon || false
      }); 
      setModalUnits([]); setGeneratedCodes([]); setIsPublicIdEditable(false); setIsModalOpen(true);
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
  const handleAddFeature = () => { if (formData.newFeature && formData.newFeature.trim()) { setFormData(prev => ({ ...prev, features: [...prev.features, formData.newFeature.trim()], newFeature: '' })); } };
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
    if (!window.confirm(`Apagar grupo "${items?.[0]?.name}" e ${items.length} lotes?`)) return;
    try {
        const batch = db.batch();
        items.forEach(item => batch.delete(db.collection('products_inventory').doc(item.id)));
        if (items?.[0]?.publicProductId) batch.delete(db.collection('products_public').doc(items[0].publicProductId.toString()));
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
  const handleManualOrderSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (manualOrderItems.length === 0) return alert("Adicione produtos."); try { await db.runTransaction(async (transaction) => { let userId: string | null = null; if (manualOrderCustomer.email) { const userQuery = await db.collection('users').where('email', '==', manualOrderCustomer.email.trim().toLowerCase()).limit(1).get(); if (!userQuery.empty) userId = userQuery.docs[0].id; } const total = manualOrderItems.reduce((acc, item) => acc + item.finalPrice * item.quantity, 0); const newOrder: Order = { id: `MANUAL-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), total, status: 'Processamento', statusHistory: [{ status: 'Processamento', date: new Date().toISOString() }], items: manualOrderItems.map(item => ({ productId: item.id, name: item.name, price: item.finalPrice, quantity: item.quantity, selectedVariant: item.selectedVariant || '', addedAt: new Date().toISOString() })), userId: userId, shippingInfo: { name: manualOrderCustomer.name, email: manualOrderCustomer.email, street: manualOrderShipping, doorNumber: '', city: '', zip: '', phone: '', paymentMethod: manualOrderPayment as any, } }; const orderRef = db.collection('orders').doc(newOrder.id); transaction.set(orderRef, newOrder); for (const item of manualOrderItems) { const invQuery = db.collection('products_inventory').where('publicProductId', '==', item.id); const finalQuery = item.selectedVariant ? invQuery.where('variant', '==', item.selectedVariant) : invQuery; const invSnapshot = await finalQuery.get(); if (!invSnapshot.empty) { const invDoc = invSnapshot.docs[0]; const invData = invDoc.data() as InventoryProduct; const newQuantitySold = invData.quantitySold + item.quantity; let newStatus: ProductStatus = invData.status; if (newQuantitySold >= invData.quantityBought) newStatus = 'SOLD'; transaction.update(invDoc.ref, { quantitySold: newQuantitySold, status: newStatus }); } } }); alert('Encomenda manual criada!'); setIsManualOrderModalOpen(false); setManualOrderItems([]); } catch (error) { console.error(error); alert("Erro ao criar."); } };
  
  const handleOpenInvestedModal = () => { setDetailsModalData({ title: "Detalhe do Investimento", data: products.map(p => ({ id: p.id, name: p.name, qty: p.quantityBought, cost: p.purchasePrice, total: p.quantityBought * p.purchasePrice })).filter(i => i.total > 0).sort((a,b) => b.total - a.total), total: stats.totalInvested, columns: [{ header: "Produto", accessor: "name" }, { header: "Qtd. Comprada", accessor: "qty" }, { header: "Custo Unit.", accessor: (i) => formatCurrency(i.cost) }, { header: "Total", accessor: (i) => formatCurrency(i.total) }] }); };
  const handleOpenRevenueModal = () => { setDetailsModalData({ title: "Receita Realizada", data: products.flatMap(p => (p.salesHistory || []).map(s => ({ id: s.id, name: p.name, date: s.date, qty: s.quantity, val: s.quantity * s.unitPrice }))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), total: stats.realizedRevenue, columns: [{ header: "Data", accessor: (i) => new Date(i.date).toLocaleDateString() }, { header: "Produto", accessor: "name" }, { header: "Qtd", accessor: "qty" }, { header: "Valor", accessor: (i) => formatCurrency(i.val) }] }); };
  const handleOpenProfitModal = () => { setDetailsModalData({ title: "Lucro Líquido por Produto", data: products.map(p => { const revenue = (p.salesHistory || []).reduce((acc, s) => acc + (s.quantity * s.unitPrice), 0); const cogs = p.quantitySold * p.purchasePrice; const cashback = p.cashbackStatus === 'RECEIVED' ? p.cashbackValue : 0; return { id: p.id, name: p.name, profit: revenue - cogs + cashback }; }).filter(p => p.profit !== 0).sort((a,b) => b.profit - a.profit), total: stats.realizedProfit, columns: [{ header: "Produto", accessor: "name" }, { header: "Lucro", accessor: (i) => <span className={i.profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{formatCurrency(i.profit)}</span> }] }); };
  const handleOpenCashbackModal = () => { setDetailsModalData({ title: "Cashback Pendente", data: products.filter(p => p.cashbackStatus === 'PENDING').map(p => ({ id: p.id, name: p.name, val: p.cashbackValue })), total: stats.pendingCashback, columns: [{ header: "Produto", accessor: "name" }, { header: "Valor", accessor: (i) => formatCurrency(i.val) }] }); };
  const handleImportProducts = async () => { if (!window.confirm("Importar produtos?")) return; setIsImporting(true); try { for (const p of INITIAL_PRODUCTS) await addProduct({ name: p.name, category: p.category, description: p.description, publicProductId: p.id, variant: null, purchaseDate: new Date().toISOString(), quantityBought: p.stock || 10, quantitySold: 0, purchasePrice: p.price * 0.6, salePrice: p.price, status: (p.stock || 0) > 0 ? 'IN_STOCK' : 'SOLD', images: p.images || (p.image ? [p.image] : []), features: p.features || [], comingSoon: p.comingSoon || false, cashbackStatus: 'NONE', cashbackValue: 0 }); alert("Importação concluída."); } catch (e) { alert("Erro."); } finally { setIsImporting(false); } };

  const handleGenerateCodes = () => {
    if (!formData.publicProductId) {
      alert("Ligue primeiro a um 'Produto da Loja' para gerar códigos associados.");
      return;
    }
    const newCodes: string[] = [];
    for (let i = 0; i < generateQty; i++) {
        const code = `AS-${formData.publicProductId}-${(Date.now() + i).toString().slice(-6)}`;
        newCodes.push(code);
    }
    
    const uniqueNewCodes = newCodes.filter(code => !modalUnits.some(unit => unit.id === code));
    setGeneratedCodes(prev => [...prev, ...uniqueNewCodes]);

    const newUnits: ProductUnit[] = uniqueNewCodes.map(code => ({
        id: code,
        status: 'AVAILABLE' as const,
        addedAt: new Date().toISOString()
    }));
    setModalUnits(prev => [...prev, ...newUnits]);
  };

  const PrintableLabels = ({ codes }: { codes: string[] }) => {
    useEffect(() => {
        window.print();
    }, []);

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '20px',
            padding: '20px'
        }}>
            {codes.map(code => (
                <div key={code} style={{
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    padding: '10px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    breakInside: 'avoid'
                }}>
                    <Barcode value={code} format="CODE128" width={2} height={50} fontSize={12} />
                </div>
            ))}
        </div>
    );
  };

  const handlePrintLabels = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up bloqueado. Por favor, autorize pop-ups para este site.");
        return;
    }

    const printDocument = printWindow.document;
    printDocument.write('<html><head><title>Etiquetas</title><style>@media print { body { -webkit-print-color-adjust: exact; } @page { margin: 10mm; } }</style></head><body><div id="print-root"></div></body></html>');
    
    const printRoot = printDocument.getElementById('print-root');
    if (printRoot) {
      const root = ReactDOM.createRoot(printRoot);
      root.render(<PrintableLabels codes={generatedCodes} />);
    }
  };

  const filteredClients = useMemo(() => {
    if (!clientsSearchTerm) return allUsers;
    return allUsers.filter(u => 
        (u.name || '').toLowerCase().includes(clientsSearchTerm.toLowerCase()) || 
        (u.email || '').toLowerCase().includes(clientsSearchTerm.toLowerCase())
    );
  }, [allUsers, clientsSearchTerm]);

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
                <button onClick={() => setActiveTab('clients')} className={`w-full md:w-auto px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'clients' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Users size={16} /> Clientes</button>
                <button onClick={() => setActiveTab('coupons')} className={`w-full md:w-auto px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'coupons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><TicketPercent size={16} /> Cupões</button>
            </div>
            <div className="hidden md:flex items-center gap-3">
                <div className="relative"><button onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative transition-colors"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{notifications.length}</span>}</button>{isNotifDropdownOpen && <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"><div className="p-3 border-b border-gray-100 bg-gray-50"><h4 className="text-sm font-bold text-gray-700">Novas Encomendas</h4></div><div className="max-h-64 overflow-y-auto">{notifications.map((n, idx) => <div key={idx} className="p-3 border-b border-gray-100 hover:bg-gray-50 last:border-0"><div className="flex justify-between items-start"><span className="font-bold text-xs text-indigo-600">{n.id.startsWith('#') ? '' : '#'}{n.id.toUpperCase()}</span></div><p className="text-sm font-medium mt-1">Venda: {formatCurrency(n.total)}</p></div>)}</div></div>}</div>
                
                <div className="relative">
                    <button onClick={() => setIsClaimDropdownOpen(!isClaimDropdownOpen)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-full relative transition-colors">
                        <BellRing size={20} />
                        {unreadClaimsCount > 0 && <span className="absolute top-1 right-1 bg-orange-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">{unreadClaimsCount}</span>}
                    </button>
                    {isClaimDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                            <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h4 className="text-sm font-bold text-gray-700">Alertas de Clientes</h4>
                                {unreadClaimsCount > 0 && <button onClick={handleMarkAllAsRead} className="text-xs font-medium text-blue-600 hover:underline">Marcar todas como lidas</button>}
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {claimNotifications.length === 0 ? (
                                    <p className="p-4 text-center text-sm text-gray-400">Nenhum alerta.</p>
                                ) : (
                                    claimNotifications.map(n => (
                                        <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-3 border-b border-gray-100 last:border-0 cursor-pointer ${n.read ? 'bg-white' : 'bg-orange-50 hover:bg-orange-100'}`}>
                                            <div className="flex justify-between items-start">
                                                <span className={`font-bold text-xs ${n.type === 'claim' ? 'text-red-600' : 'text-orange-600'}`}>{n.type === 'claim' ? 'GARANTIA' : 'DEVOLUÇÃO'}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(n.date).toLocaleDateString()}</span>
                                            </div>
                                            <p className={`text-sm mt-1 ${n.read ? 'text-gray-500' : 'text-gray-800'}`}>{n.message}</p>
                                            <p className="text-xs text-gray-400">Cliente: {n.customerName}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                <button onClick={() => window.location.hash = '/'} className="text-gray-500 hover:text-gray-700 font-medium px-3 py-2 text-sm">Voltar à Loja</button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        
        {activeTab === 'inventory' && <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <KpiCard title="Total Investido" value={stats.totalInvested} icon={<Package size={18} />} color="blue" onClick={handleOpenInvestedModal} />
                <KpiCard title="Vendas Reais" value={stats.realizedRevenue} icon={<DollarSign size={18} />} color="indigo" onClick={handleOpenRevenueModal} />
                <KpiCard title="Lucro Líquido" value={stats.realizedProfit} icon={<TrendingUp size={18} />} color={stats.realizedProfit >= 0 ? "green" : "red"} onClick={handleOpenProfitModal} />
                <KpiCard title="Cashback Pendente" value={stats.pendingCashback} icon={<AlertCircle size={18} />} color="yellow" onClick={handleOpenCashbackModal} />
                <KpiCard title="Online" value={onlineUsers.length} icon={<Users size={18} />} color="yellow" onClick={() => setIsOnlineDetailsOpen(true)} />
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 mb-8 animate-fade-in"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Bot size={20} /></div><div><h3 className="font-bold text-gray-900">Consultor Estratégico IA</h3><p className="text-xs text-gray-500">Pergunte sobre promoções, bundles ou como vender stock parado.</p></div></div><div className="flex flex-col sm:flex-row gap-2"><input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Ex: Como posso vender as TV Boxes H96 mais rápido sem perder dinheiro? Sugere bundles." className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAskAi()} /><button onClick={handleAskAi} disabled={isAiLoading || !aiQuery.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">{isAiLoading ? 'A pensar...' : <><Sparkles size={18} /> Gerar</>}</button></div>{aiResponse && <div className="mt-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-gray-700 text-sm leading-relaxed whitespace-pre-line animate-fade-in-down">{aiResponse}</div>}</div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex gap-4 text-xs font-medium text-gray-500"><span>Total: {products.length}</span><span className="w-px h-4 bg-gray-300"></span><span className="text-green-600">Stock: {products.filter(p => p.status !== 'SOLD').length}</span><span className="w-px h-4 bg-gray-300"></span><span className="text-red-600">Esgotados: {products.filter(p => p.status === 'SOLD').length}</span></div><div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4"><div className="flex gap-2 w-full lg:w-auto"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Estados</option><option value="IN_STOCK">Em Stock</option><option value="SOLD">Esgotado</option></select><select value={cashbackFilter} onChange={(e) => setCashbackFilter(e.target.value as any)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"><option value="ALL">Todos os Cashbacks</option><option value="PENDING">Pendente</option><option value="RECEIVED">Recebido</option></select></div><div className="flex gap-2 w-full lg:w-auto"><div className="relative flex-1"><input type="text" placeholder="Pesquisar ou escanear..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/></div>
            <button onClick={() => { setScannerMode('search'); setIsScannerOpen(true); }} className="bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors" title="Escanear Código de Barras"><Camera size={18} /></button>
            <button onClick={() => setIsCalculatorOpen(true)} className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1" title="Calculadora de Lucro"><BrainCircuit size={18} /></button>
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
                          <td className="px-6 py-4"><button onClick={() => toggleGroup(groupId)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">{isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button></td>
                          <td className="px-6 py-4"><div className="flex items-center gap-3">{mainItem.images && mainItem.images[0] && (<img src={mainItem.images[0]} className="w-10 h-10 object-cover rounded bg-white border border-gray-200" alt="" />)}<div><div className="font-bold text-gray-900">{mainItem.name}</div><div className="text-xs text-gray-500">{mainItem.category} • {items.length} Lote(s)</div></div></div></td>
                          <td className="px-4 py-4 text-center"><span className={`font-bold px-2 py-1 rounded ${totalStock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{totalStock} un.</span></td>
                          <td className="px-4 py-4 text-center">{mainItem.comingSoon ? (<span className="text-purple-600 font-bold text-xs uppercase bg-purple-100 px-2 py-1 rounded">Em Breve</span>) : (<span className={`text-xs font-bold uppercase ${totalStock > 0 ? 'text-green-600' : 'text-red-500'}`}>{totalStock > 0 ? 'Disponível' : 'Esgotado'}</span>)}</td>
                          <td className="px-4 py-4 text-right font-medium">{formatCurrency(mainItem.salePrice || mainItem.targetSalePrice || 0)}</td>
                          <td className="px-4 py-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => handleEdit(mainItem)} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"><Edit2 size={14} /> Editar Loja</button><button onClick={() => handleCreateVariant(mainItem)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Layers size={16} /></button><button onClick={() => handleDeleteGroup(groupId, items)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div></td>
                        </tr>
                        {isExpanded && (
                            <tr className="bg-gray-50/50 border-b border-gray-200"><td colSpan={6} className="px-4 py-4"><div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm ml-10"><table className="w-full text-xs"><thead className="bg-gray-100 text-gray-500 uppercase"><tr><th className="px-4 py-2 text-left">Lote / Variante</th><th className="px-4 py-2 text-left">Origem</th><th className="px-4 py-2 text-center">Stock</th><th className="px-4 py-2 text-right">Compra</th><th className="px-4 py-2 text-right">Venda (Estimada)</th><th className="px-4 py-2 text-center">Lucro Unitário</th><th className="px-4 py-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map(p => { const batchStock = (p.quantityBought || 0) - (p.quantitySold || 0); const salePrice = p.salePrice || p.targetSalePrice || 0; const purchasePrice = p.purchasePrice || 0; const cashbackValue = p.cashbackValue || 0; const finalProfit = salePrice - purchasePrice + cashbackValue; const hasLossBeforeCashback = salePrice < purchasePrice; const profitColor = finalProfit > 0 ? 'text-green-600' : finalProfit < 0 ? 'text-red-600' : 'text-gray-500'; return ( <tr key={p.id} className="hover:bg-blue-50 transition-colors"><td className="px-4 py-3"><div className="font-bold whitespace-normal">{new Date(p.purchaseDate).toLocaleDateString()}</div>{p.variant && <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1 rounded">{p.variant}</span>}<div className="text-[10px] text-gray-400 mt-0.5">{p.description?.substring(0, 30)}...</div></td>
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
<td className="px-4 py-3 text-right">{formatCurrency(p.purchasePrice)}</td><td className="px-4 py-3 text-right text-gray-500">{p.targetSalePrice ? formatCurrency(p.targetSalePrice) : '-'}</td>
<td className="px-4 py-3 text-center">
    {salePrice > 0 ? (
        <div title={`Cálculo: Venda (${formatCurrency(salePrice)}) - Compra (${formatCurrency(purchasePrice)}) ${cashbackValue > 0 ? `+ Cashback (${formatCurrency(cashbackValue)})` : ''}`}>
            <div className={`font-bold text-sm ${profitColor}`}>
                {finalProfit >= 0 ? '+' : ''}{formatCurrency(finalProfit)}
            </div>
            {cashbackValue > 0 && (
                <div className={`text-[10px] font-medium mt-0.5 ${p.cashbackStatus === 'PENDING' ? 'text-yellow-600' : 'text-green-700'}`}>
                    Cashback {p.cashbackStatus === 'PENDING' ? 'Pendente' : 'Recebido'}
                </div>
            )}
            {hasLossBeforeCashback && cashbackValue > 0 && finalProfit > 0 && (
                <div className="text-[10px] font-bold text-orange-500 mt-0.5" title="O preço de venda é inferior ao de compra, mas o cashback compensa.">
                    Lucro c/ Cashback
                </div>
            )}
        </div>
    ) : (
        <span className="text-gray-400 text-xs">-</span>
    )}
</td>
<td className="px-4 py-3 text-right flex justify-end gap-1">{batchStock > 0 && <button onClick={() => openSaleModal(p)} className="text-green-600 hover:bg-green-50 p-1.5 rounded bg-white border border-green-200 shadow-sm" title="Vender deste lote"><DollarSign size={14}/></button>}<button onClick={() => handleEdit(p)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded bg-white border border-gray-200 shadow-sm" title="Editar este lote"><Edit2 size={14}/></button><button onClick={() => handleDelete(p.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded bg-white border border-red-200 shadow-sm" title="Apagar lote"><Trash2 size={14}/></button></td></tr> ); })}</tbody></table></div></td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div></div></>}
        
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><div className="flex justify-between items-center mb-6"><div className="flex items-center gap-4"><h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart2 className="text-indigo-600" /> Faturação Geral</h3><div className="bg-gray-100 p-1 rounded-lg flex gap-1 text-xs font-medium"><button onClick={() => setChartTimeframe('7d')} className={`px-2 py-1 rounded ${chartTimeframe === '7d' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>7D</button><button onClick={() => setChartTimeframe('30d')} className={`px-2 py-1 rounded ${chartTimeframe === '30d' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>30D</button><button onClick={() => setChartTimeframe('1y')} className={`px-2 py-1 rounded ${chartTimeframe === '1y' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>1A</button></div></div><span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Total: {formatCurrency(chartData.totalPeriod)}</span></div><div className="flex items-stretch h-64 gap-4"><div className="flex flex-col justify-between text-xs font-medium text-gray-400 py-2 min-w-[30px] text-right"><span>{formatCurrency(chartData.maxValue)}</span><span>{formatCurrency(chartData.maxValue / 2)}</span><span>0€</span></div><div className="flex items-end flex-1 gap-2 md:gap-4 relative border-l border-b border-gray-200"><div className="absolute w-full border-t border-dashed border-gray-100 top-2 left-0 z-0"></div><div className="absolute w-full border-t border-dashed border-gray-100 top-1/2 left-0 z-0"></div>{chartData.days.map((day, idx) => { const heightPercent = (day.value / chartData.maxValue) * 100; const isZero = day.value === 0; return <div key={idx} className="flex-1 flex flex-col justify-end h-full group relative z-10"><div className={`w-full rounded-t-md transition-all duration-700 ease-out relative group-hover:brightness-110 ${isZero ? 'bg-gray-100' : 'bg-gradient-to-t from-blue-500 to-indigo-600 shadow-lg shadow-indigo-200'}`} style={{ height: isZero ? '4px' : `${heightPercent}%`, minHeight: '4px' }}>{!isZero && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-20">{formatCurrency(day.value)}<div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div></div>}</div><span className="text-[10px] md:text-xs text-gray-500 font-medium mt-2 text-center uppercase tracking-wide">{day.label}</span></div>})}</div></div></div>
              <div className="flex justify-end"><button onClick={() => setIsManualOrderModalOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-bold shadow-md"><ClipboardEdit size={18} /> Registar Encomenda Manual</button></div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase"><tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Total</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100 text-sm">{allOrders.map(order => <tr key={order.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold text-indigo-700">{order.id}</td><td className="px-6 py-4">{order.shippingInfo?.name || 'N/A'}</td><td className="px-6 py-4 font-bold">{formatCurrency(order.total)}</td><td className="px-6 py-4"><select value={order.status} onChange={(e) => handleOrderStatusChange(order.id, e.target.value)} className={`text-xs font-bold px-2 py-1 rounded-full border-none cursor-pointer ${order.status === 'Entregue' ? 'bg-green-100 text-green-800' : order.status === 'Enviado' ? 'bg-blue-100 text-blue-800' : order.status === 'Pago' ? 'bg-cyan-100 text-cyan-800' : order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}><option value="Processamento">Processamento</option><option value="Pago">Pago</option><option value="Enviado">Enviado</option><option value="Entregue">Entregue</option><option value="Cancelado">Cancelado</option></select></td><td className="px-6 py-4 text-right flex justify-end items-center gap-2"><button onClick={() => setSelectedOrderDetails(order)} className="text-indigo-600 font-bold text-xs hover:underline">Detalhes</button>{isAdmin && order.status === 'Cancelado' && (<button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Apagar Encomenda"><Trash2 size={16} /></button>)}</td></tr>)}</tbody></table></div></div>
          </div>
        )}
        
        {activeTab === 'clients' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Gestão de Clientes ({allUsers.length})</h3>
                    <div className="relative"><input type="text" placeholder="Pesquisar cliente..." value={clientsSearchTerm} onChange={e => setClientsSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/></div>
                </div>
                <div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase"><tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Nível</th><th className="px-6 py-4">Total Gasto</th><th className="px-6 py-4">Pontos</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100 text-sm">{filteredClients.map(client => <tr key={client.uid} className="hover:bg-gray-50"><td className="px-6 py-4"><div className="font-bold">{client.name}</div><div className="text-gray-500 text-xs">{client.email}</div></td><td className="px-6 py-4"><span className={`font-bold text-xs px-2 py-1 rounded-full ${client.tier === 'Ouro' ? 'bg-yellow-100 text-yellow-700' : client.tier === 'Prata' ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>{client.tier || 'Bronze'}</span></td><td className="px-6 py-4">{formatCurrency(client.totalSpent || 0)}</td><td className="px-6 py-4 font-bold text-blue-600">{client.loyaltyPoints || 0}</td><td className="px-6 py-4 text-right"><button onClick={() => setSelectedUserDetails(client)} className="text-indigo-600 font-bold text-xs hover:underline">Ver Detalhes</button></td></tr>)}</tbody></table></div>
            </div>
        )}

        {activeTab === 'coupons' && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><h3 className="font-bold text-gray-800 mb-4">Adicionar Novo Cupão</h3><form onSubmit={handleAddCoupon} className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end"><input type="text" placeholder="CÓDIGO" value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value})} className="p-2 border rounded-lg" required /><select value={newCoupon.type} onChange={e => setNewCoupon({...newCoupon, type: e.target.value as any})} className="p-2 border rounded-lg bg-white"><option value="PERCENTAGE">%</option><option value="FIXED">€</option></select><input type="number" placeholder="Valor" value={newCoupon.value} onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})} className="p-2 border rounded-lg" required /><input type="number" placeholder="Compra Mínima" value={newCoupon.minPurchase} onChange={e => setNewCoupon({...newCoupon, minPurchase: Number(e.target.value)})} className="p-2 border rounded-lg" /><button type="submit" className="bg-indigo-600 text-white p-2 rounded-lg font-bold hover:bg-indigo-700">Adicionar</button></form></div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase"><tr><th className="px-6 py-4">Código</th><th className="px-6 py-4">Valor</th><th className="px-6 py-4">Compra Mínima</th><th className="px-6 py-4">Usos</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100 text-sm">{coupons.map(coupon => <tr key={coupon.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold text-indigo-700">{coupon.code}</td><td className="px-6 py-4">{coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : formatCurrency(coupon.value)}</td><td className="px-6 py-4">{formatCurrency(coupon.minPurchase)}</td><td className="px-6 py-4">{coupon.usageCount}</td><td className="px-6 py-4"><button onClick={() => handleToggleCoupon(coupon)} className={`flex items-center gap-1.5 font-bold text-xs ${coupon.isActive ? 'text-green-600' : 'text-red-600'}`}>{coupon.isActive ? <ToggleRight/> : <ToggleLeft/>} {coupon.isActive ? 'Ativo' : 'Inativo'}</button></td><td className="px-6 py-4 text-right"><button onClick={() => handleDeleteCoupon(coupon.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Apagar cupão"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div></div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {isModalOpen && (null /* ... JSX for Product Edit Modal ... */ )}
      {isSaleModalOpen && (null /* ... JSX for Sale Registration Modal ... */ )}
      {isManualOrderModalOpen && (null /* ... JSX for Manual Order Modal ... */ )}
      {selectedOrderDetails && <OrderDetailsModal order={selectedOrderDetails} onClose={() => setSelectedOrderDetails(null)} onUpdateOrder={handleUpdateOrderState} onUpdateTracking={handleUpdateTracking} onCopy={handleCopy} />}
      {notificationModalData && (null /* ... JSX for Stock Alert Notification Modal ... */ )}
      {detailsModalData && (null /* ... JSX for Details Modal (KPIs) ... */ )}
      {isCalculatorOpen && <ProfitCalculatorModal isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />}
      {isScannerOpen && <BarcodeScanner onClose={() => setIsScannerOpen(false)} onCodeSubmit={(code) => { if(scannerMode === 'search') setSearchTerm(code); else if (scannerMode === 'add_unit') handleAddUnit(code); else if (scannerMode === 'sell_unit') handleSelectUnitForSale(code); else if (scannerMode === 'verify_product') handleVerifyProduct(code); setIsScannerOpen(false); }} mode={scannerMode === 'search' ? 'product' : 'serial'} />}
      {selectedUserDetails && (null /* ... JSX for Client Details Modal ... */ )}
      {isOnlineDetailsOpen && (null /* ... JSX for Online Users Modal ... */ )}
    </div>
  );
};

export default Dashboard;
