
import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, BrainCircuit, Camera, Zap, ZapOff, ZoomIn, Send, Key as KeyIcon, WifiOff, AlertCircle } from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/library';
import { extractSerialNumberFromImage } from '../services/geminiService';

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
            if (mode === 'serial') formats = [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.CODABAR, BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE];
            else formats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.QR_CODE];
            hints.set(2, formats); hints.set(3, true); codeReaderRef.current = new BrowserMultiFormatReader(hints, 300);
            try {
                // ALTERADO: Baixado de 4K (3840) para 1080p (1920) para melhor performance em Android
                const constraints = { 
                    video: { 
                        facingMode: 'environment', 
                        width: { ideal: 1920 }, 
                        height: { ideal: 1080 }, 
                        focusMode: 'continuous' 
                    } 
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints as any); streamRef.current = stream;
                const track = stream.getVideoTracks()[0]; trackRef.current = track;
                const capabilities = track.getCapabilities() as any;
                if (capabilities.zoom) { setHasZoom(true); setMaxZoom(capabilities.zoom.max); if (mode === 'serial' && capabilities.zoom.max >= 1.5) { track.applyConstraints({ advanced: [{ zoom: 1.5 }] } as any).catch(console.warn); setZoom(1.5); } }
                if (videoRef.current) { await codeReaderRef.current.decodeFromStream(stream, videoRef.current, (result, err) => { if (result) onCodeSubmit(result.getText().trim().toUpperCase()); }); }
            } catch (err) { console.error("Scanner init error:", err); setError("Câmara indisponível. Verifique as permissões."); }
        };
        startScanner(); return () => { if (codeReaderRef.current) codeReaderRef.current.reset(); if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); };
    }, [onCodeSubmit, mode]);

    const toggleTorch = async () => { if (trackRef.current) { try { await trackRef.current.applyConstraints({ advanced: [{ torch: !isTorchOn } as any] }); setIsTorchOn(!isTorchOn); } catch(e) { console.warn(e); } } };
    const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const newZoom = parseFloat(e.target.value); setZoom(newZoom); if (trackRef.current && hasZoom) { try { await trackRef.current.applyConstraints({ advanced: [{ zoom: newZoom } as any] }); } catch (err) { console.warn(err); } } };
    const handleManualSubmit = (e: React.FormEvent) => { e.preventDefault(); if (manualCode.trim()) onCodeSubmit(manualCode.trim().toUpperCase()); };
    const handleAiScan = async () => {
        if (!videoRef.current || isAiProcessing) return; if (videoRef.current.readyState < 2) { setError("A câmara ainda está a iniciar..."); return; } setIsAiProcessing(true); setError(null);
        try { const canvas = document.createElement('canvas'); canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error("Erro ao criar imagem."); ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; const code = await extractSerialNumberFromImage(base64Image);
            if (code) { const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); beep.play().catch(() => {}); onCodeSubmit(code.toUpperCase()); setAiStatus('ready'); } else { setError("A IA não conseguiu ler. Tente focar e limpar a etiqueta."); }
        } catch (error: any) { console.error("AI Scan Error:", error); const msg = error.message || JSON.stringify(error); setAiStatus('offline'); if (msg.includes("API key not valid")) { setError("API_KEY_INVALID"); } else if (msg.includes("referer") || msg.includes("PERMISSION_DENIED") || msg.includes("403")) { setError("API_KEY_RESTRICTED"); } else if (msg.includes("API key is missing")) { setError("API_KEY_MISSING"); } else { setError(`Erro IA: ${msg}`); } } finally { setIsAiProcessing(false); }
    };
    const renderErrorContent = () => { if (error === 'API_KEY_INVALID') return (<div className="flex flex-col items-center w-full"><KeyIcon size={48} className="text-red-500 mb-4" /><h3 className="text-lg font-bold mb-2">Chave API Inválida</h3></div>); else if (error === 'API_KEY_RESTRICTED') return (<div className="flex flex-col items-center w-full"><WifiOff size={48} className="text-yellow-500 mb-4" /><h3 className="text-lg font-bold mb-2">Acesso Bloqueado</h3></div>); return (<><AlertCircle size={40} className="text-red-500 mb-4" /><p className="text-sm font-bold mb-6">{error}</p></>); };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <button onClick={onClose} className="absolute top-6 right-6 bg-white/10 p-3 rounded-full text-white z-[110] border border-white/20 active:scale-90 transition-all shadow-2xl"><X size={24}/></button>
            <div className="w-full max-w-sm relative">
                <div className="absolute top-4 left-4 z-[110] flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md"><div className={`w-2 h-2 rounded-full animate-pulse ${aiStatus === 'ready' ? 'bg-green-500' : 'bg-red-500'}`}></div><span className="text-[10px] font-bold text-white uppercase tracking-wider">{aiStatus === 'ready' ? 'IA Online' : 'IA Offline'}</span></div>
                <div className="relative aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl"><video ref={videoRef} className="w-full h-full object-cover scale-110" muted playsInline /><div className="absolute inset-0 pointer-events-none flex items-center justify-center"><div className={`w-[90%] max-w-[300px] border-2 border-white/20 rounded-2xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.7)] ${mode === 'serial' ? 'h-[60px]' : 'h-[150px]'} transition-all duration-300`}>{!isAiProcessing && !error && <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse"></div>}{isAiProcessing && <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl"><Loader2 size={32} className="text-white animate-spin" /></div>}</div></div><div className="absolute bottom-4 right-4 z-[60]"><button onClick={handleAiScan} disabled={isAiProcessing} className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg border-2 border-white/20 flex items-center gap-2 transition-all active:scale-90 disabled:opacity-50">{isAiProcessing ? <BrainCircuit size={24} className="animate-pulse" /> : <Camera size={24} />} <span className="text-xs font-bold hidden sm:inline">IA Scan</span></button></div>{error && (<div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 text-white p-6 text-center z-50 animate-fade-in">{renderErrorContent()}<button onClick={() => { setError(null); setAiStatus('ready'); }} className="mt-2 bg-white/10 px-6 py-2 rounded-full font-bold text-xs pointer-events-auto hover:bg-white/20">Tentar de Novo</button></div>)}</div>
                <div className="mt-6 flex flex-col items-center gap-4"><div className="flex gap-4 items-center w-full justify-center"><button onClick={toggleTorch} className={`w-12 h-12 rounded-full transition-all shadow-lg flex flex-col items-center justify-center border-2 ${isTorchOn ? 'bg-yellow-400 text-black border-white' : 'bg-white/5 text-white border-white/20'}`}>{isTorchOn ? <Zap size={20} fill="currentColor" /> : <ZapOff size={20} />}</button>{hasZoom && (<div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10"><ZoomIn size={16} className="text-white/70"/><input type="range" min="1" max={Math.min(maxZoom, 5)} step="0.1" value={zoom} onChange={handleZoomChange} className="w-24 accent-indigo-500 h-1"/><span className="text-xs text-white font-mono w-8 text-right">{zoom.toFixed(1)}x</span></div>)}</div></div>
                <div className="text-center text-gray-400 text-xs font-bold my-6">OU DIGITE MANUALMENTE</div>
                <form onSubmit={handleManualSubmit} className="flex gap-2"><input type="tel" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Digite o código aqui" className="flex-1 bg-white/5 border border-white/20 text-white rounded-lg px-4 py-3 text-center tracking-widest focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"/><button type="submit" className="bg-indigo-600 text-white font-bold px-4 rounded-lg hover:bg-indigo-700 transition-colors"><Send size={20} /></button></form>
            </div>
        </div>
    );
};

export default BarcodeScanner;
