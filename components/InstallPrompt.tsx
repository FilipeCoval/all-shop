
import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detetar se é iOS (iPhone/iPad) pois eles não suportam o evento automático
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // Ouvir o evento do Chrome/Android
    const handler = (e: any) => {
      // Impedir que o Chrome mostre a barra padrão feia automaticamente
      e.preventDefault();
      // Guardar o evento para podermos disparar quando o utilizador clicar no botão
      setDeferredPrompt(e);
      // Mostrar o nosso botão bonito
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Se for iOS e estiver no navegador (não instalado), mostrar ajuda
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isIosDevice && !isStandalone) {
        // No iOS mostramos sempre por alguns segundos ou deixamos fixo
        setIsVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    // Fluxo Android / PC
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Resultado da instalação: ${outcome}`);
        setDeferredPrompt(null);
        setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] bg-white p-4 rounded-xl shadow-2xl border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-2.5 rounded-xl text-primary shrink-0">
            <Smartphone size={24} />
        </div>
        <div>
            <h3 className="font-bold text-gray-900 leading-tight">Instalar App Allshop</h3>
            <p className="text-xs text-gray-500 mt-0.5">Acesso rápido, notificações e modo offline.</p>
        </div>
      </div>
      
      {isIOS ? (
          // Instruções específicas para iPhone (que não tem botão nativo via JS)
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-200">
              <span>Toque em <strong>Partilhar</strong> <span className="inline-block border border-gray-300 rounded px-1">⎋</span> e <strong>Adicionar ao Ecrã Principal</strong> <span className="inline-block border border-gray-300 rounded px-1">+</span></span>
              <button onClick={() => setIsVisible(false)} className="p-2 text-gray-400 hover:text-gray-600 ml-2"><X size={18} /></button>
          </div>
      ) : (
          // Botão real para Android/PC
          <div className="flex items-center gap-2 w-full md:w-auto">
              <button 
                onClick={() => setIsVisible(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Agora não
              </button>
              <button 
                onClick={handleInstallClick}
                className="flex-1 md:flex-none bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-blue-600 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Download size={18} /> Instalar
              </button>
          </div>
      )}
    </div>
  );
};

export default InstallPrompt;
