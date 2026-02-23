import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Send, MessageCircle, MousePointer2 } from 'lucide-react';

interface OrderTutorialProps {
  message: string;
  platform: 'wa' | 'tg';
  actionUrl: string;
  onComplete: () => void;
  isLoading?: boolean;
}

const OrderTutorial: React.FC<OrderTutorialProps> = ({ message, platform, actionUrl, onComplete, isLoading = false }) => {
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(0); // 0: Copy, 1: Open, 2: Send

  const platformName = platform === 'wa' ? 'WhatsApp' : 'Telegram';
  const platformColor = platform === 'wa' ? 'bg-green-500' : 'bg-blue-500';
  const platformIcon = platform === 'wa' ? <MessageCircle size={32} /> : <Send size={32} />;

  // Looping Animation
  useEffect(() => {
    const interval = setInterval(() => {
        setStep((prev) => (prev + 1) % 3);
    }, 3500); // 3.5 seconds per step
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenApp = () => {
    window.open(actionUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 text-center shrink-0">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Finalizar Pedido</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Siga os passos para enviar o pedido.</p>
      </div>

      {/* Animation Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
        
        {/* Phone Mockup Animation */}
        <div className="relative w-64 h-[320px] bg-white dark:bg-gray-900 rounded-[2rem] border-4 border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden flex flex-col">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded-b-xl z-10"></div>
            
            {/* Screen Content */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                
                {/* Step 0: Copy */}
                <div className={`absolute inset-0 p-4 pt-12 transition-all duration-500 flex flex-col items-center justify-center bg-white dark:bg-gray-900 ${step === 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'}`}>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded text-[8px] text-gray-500 mb-2 font-mono leading-tight overflow-hidden h-20 border border-gray-200 dark:border-gray-700 relative">
                        {message.slice(0, 100)}...
                        <div className="absolute inset-0 bg-black/5 dark:bg-white/5 animate-pulse"></div>
                    </div>
                    <div className="animate-bounce mt-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                            <Copy size={14} />
                        </div>
                    </div>
                    <p className="text-xs font-bold mt-2 text-blue-500">1. Copiar Texto</p>
                </div>

                {/* Step 1: Open App (Platform Specific) */}
                <div className={`absolute inset-0 transition-all duration-500 flex flex-col ${step === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}`}>
                    {platform === 'tg' ? (
                        // Telegram Specific Visual
                        <div className="w-full h-full bg-[#E0E4E8] dark:bg-[#1c242d] relative flex flex-col">
                            {/* Fake Channel Header */}
                            <div className="h-12 bg-white dark:bg-[#242f3d] flex items-center px-4 shadow-sm">
                                <div className="w-8 h-8 rounded-full bg-blue-400"></div>
                                <div className="ml-2 w-20 h-3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                            </div>
                            {/* Fake Messages */}
                            <div className="flex-1 p-4 space-y-2">
                                <div className="w-3/4 h-10 bg-white dark:bg-[#242f3d] rounded-tr-xl rounded-bl-xl rounded-br-xl shadow-sm"></div>
                                <div className="w-1/2 h-8 bg-white dark:bg-[#242f3d] rounded-tr-xl rounded-bl-xl rounded-br-xl shadow-sm"></div>
                            </div>
                            {/* Bottom Bar with Arrow */}
                            <div className="h-12 bg-white dark:bg-[#242f3d] flex items-center justify-between px-4 border-t border-gray-200 dark:border-gray-700 relative">
                                <div className="flex items-center gap-4 text-blue-500">
                                    <div className="relative">
                                        <MessageCircle size={24} />
                                        {/* Cursor Animation */}
                                        <div className="absolute -bottom-4 -right-4 text-gray-900 dark:text-white animate-bounce">
                                            <MousePointer2 size={24} className="fill-black dark:fill-white stroke-white dark:stroke-black" />
                                        </div>
                                    </div>
                                    <div className="w-32 h-2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                                </div>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-black/70 text-white px-3 py-1 rounded-full text-[10px] font-bold">
                                    2. Abrir Chat
                                </div>
                            </div>
                        </div>
                    ) : (
                        // WhatsApp Visual
                        <div className="w-full h-full flex flex-col items-center justify-center bg-white dark:bg-gray-900">
                            <div className={`w-16 h-16 ${platformColor} rounded-2xl flex items-center justify-center text-white shadow-lg mb-4 animate-pulse`}>
                                {platformIcon}
                            </div>
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-300">2. Abrir {platformName}</p>
                        </div>
                    )}
                </div>

                {/* Step 2: Paste & Send */}
                <div className={`absolute inset-0 p-4 pt-12 transition-all duration-500 flex flex-col items-center justify-center bg-white dark:bg-gray-900 ${step === 2 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}`}>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-2 flex items-center gap-2">
                        <div className="w-0.5 h-4 bg-blue-500 animate-pulse"></div>
                        <span className="text-[10px] text-gray-400">Colar mensagem...</span>
                    </div>
                    <div className={`w-10 h-10 ${platformColor} rounded-full flex items-center justify-center text-white shadow-lg mt-2 scale-110 transition-transform`}>
                        <Send size={16} />
                    </div>
                    <p className="text-xs font-bold mt-2 text-gray-600 dark:text-gray-300">3. Enviar</p>
                </div>
            </div>

            {/* Home Bar */}
            <div className="h-1 w-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2 shrink-0"></div>
        </div>

        {/* Step Indicators */}
        <div className="flex gap-2 mt-4">
            {[0, 1, 2].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${step === i ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
            ))}
        </div>

      </div>

      {/* Controls */}
      <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 space-y-3 shrink-0">
        
        {/* Message Preview (Hidden but accessible for copy) */}
        <textarea 
            className="w-full h-20 p-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            readOnly
            value={message}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />

        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={handleCopy}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${copied ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado!' : 'Copiar Texto'}
            </button>

            <button 
                onClick={handleOpenApp}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all ${platformColor} hover:opacity-90 shadow-lg shadow-blue-500/20`}
            >
                <ExternalLink size={18} />
                Abrir App
            </button>
        </div>

        <button 
            onClick={onComplete}
            disabled={isLoading}
            className="w-full py-3 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? 'A confirmar...' : 'Já enviei o pedido'}
        </button>
      </div>
    </div>
  );
};

export default OrderTutorial;
