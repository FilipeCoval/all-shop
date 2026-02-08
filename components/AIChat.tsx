
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { ChatMessage, Product, Order } from '../types';
import { sendMessageToGemini, resetChatSession } from '../services/geminiService';
import { STORE_NAME, BOT_NAME, BOT_AVATAR_URL } from '../constants';

interface AIChatProps {
  products: Product[];
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  userOrders?: Order[]; // Nova Prop para saber o histórico
}

const AIChat: React.FC<AIChatProps> = ({ products, isOpen, onToggle, userOrders = [] }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Olá! Sou a ${BOT_NAME}, a assistente virtual da ${STORE_NAME}. 😊\nPosso ajudar a encontrar o produto ideal ou resolver problemas técnicos?`,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  // Efeito para resetar a sessão se o utilizador fizer login/logout (número de encomendas muda)
  // Isto garante que a IA recebe o contexto novo (com ou sem encomendas)
  useEffect(() => {
      resetChatSession();
      // Opcional: Limpar mensagens antigas se mudar de utilizador drasticamente, 
      // mas por agora mantemos o histórico visual para UX suave.
  }, [userOrders.length]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Passamos userOrders para o serviço
      const responseText = await sendMessageToGemini(userMsg.text, products, userOrders);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante (Silhueta Grande) */}
      {!isOpen && (
        <button
          onClick={() => onToggle(true)}
          className="fixed bottom-4 right-4 z-40 w-24 h-24 hover:scale-110 transition-all duration-300 animate-bounce-slow flex items-center justify-center bg-transparent border-none outline-none focus:outline-none"
          aria-label="Abrir chat"
        >
          <img 
            src={BOT_AVATAR_URL} 
            alt={BOT_NAME} 
            className="w-full h-full object-contain drop-shadow-2xl filter" 
          />
        </button>
      )}

      {/* Janela do Chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-[350px] sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-[500px] animate-fade-in-up">
          
          {/* Header */}
          <div className="bg-primary p-4 flex items-center justify-between text-white relative overflow-hidden">
            <div className="flex items-center gap-2 relative z-10">
              {/* Avatar no Header (Silhueta Média) */}
              <div className="w-14 h-14 flex items-center justify-center -my-2">
                <img 
                    src={BOT_AVATAR_URL} 
                    alt={BOT_NAME} 
                    className="w-full h-full object-contain drop-shadow-lg"
                />
              </div>
              <div>
                <h3 className="font-bold text-sm">{BOT_NAME}</h3>
                <span className="text-xs text-blue-100 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Online
                </span>
              </div>
            </div>
            <button 
              onClick={() => onToggle(false)}
              className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded transition-colors z-10"
            >
              <X size={20} />
            </button>
            
            {/* Decoração de fundo */}
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-end gap-1'}`}
              >
                {/* Avatar nas Mensagens (AUMENTADO) */}
                {msg.role === 'model' && (
                    <div className="w-12 h-12 flex-shrink-0 flex items-end -mb-1">
                        <img 
                            src={BOT_AVATAR_URL} 
                            alt="Bot" 
                            className="w-full h-full object-contain drop-shadow-sm transform scale-110 origin-bottom-left" 
                        />
                    </div>
                )}

                <div 
                  className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            
            {/* Indicador de Loading (AUMENTADO TAMBÉM) */}
            {isLoading && (
              <div className="flex justify-start items-end gap-1">
                 <div className="w-12 h-12 flex-shrink-0 flex items-end -mb-1">
                    <img src={BOT_AVATAR_URL} alt="Bot" className="w-full h-full object-contain drop-shadow-sm transform scale-110 origin-bottom-left" />
                </div>
                <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Área de Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite sua dúvida..."
              className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none"
            />
            <button 
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="bg-primary text-white p-2 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIChat;
