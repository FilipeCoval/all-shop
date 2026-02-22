import React from 'react';
import { X, Search, User, LogIn, LogOut, Sun, Moon, ShoppingBag } from 'lucide-react';
import { STORE_NAME, LOGO_URL } from '../constants';
import { User as UserType } from '../types';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onResetHome: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ 
    isOpen, onClose, user, onOpenLogin, onLogout, searchTerm, onSearchChange, onResetHome,
    isDarkMode, onToggleTheme
}) => {
  
  const handleNav = (path: string) => {
    window.location.hash = path;
    onClose();
  };

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onResetHome();
    onClose();
  };

  const handleLoginClick = () => {
    onOpenLogin();
    onClose();
  };

  const handleLogoutClick = () => {
    onLogout();
    onClose();
  };

  // Previne scroll no body quando o menu está aberto
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop Escuro */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      
      {/* Menu Drawer */}
      <div 
        className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col border-r border-gray-100 dark:border-gray-800 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
          <a href="#/" onClick={handleHomeClick} className="flex items-center gap-2">
            {LOGO_URL ? (
                <img src={LOGO_URL} alt={STORE_NAME} className="h-10 w-auto object-contain" />
            ) : (
                <span className="text-xl font-bold text-gray-900 dark:text-white">{STORE_NAME}</span>
            )}
          </a>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="relative">
            <input 
              type="text"
              placeholder="O que procura?"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>

          <nav className="flex flex-col space-y-1">
            <button onClick={handleHomeClick} className="text-left px-4 py-3 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-3">
                <ShoppingBag size={20} /> Início
            </button>
            <button onClick={() => { handleNav('/'); setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="text-left px-4 py-3 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-3">
                Produtos
            </button>
            <button onClick={() => handleNav('allpoints')} className="text-left px-4 py-3 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-3">
                AllPoints
            </button>
            <button onClick={() => handleNav('about')} className="text-left px-4 py-3 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-3">
                Sobre Nós
            </button>
            <button onClick={() => handleNav('contact')} className="text-left px-4 py-3 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-3">
                Contactos
            </button>
          </nav>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
             <button 
                onClick={onToggleTheme} 
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
             >
                 <span className="flex items-center gap-3">{isDarkMode ? <Moon size={20} /> : <Sun size={20} />} Tema {isDarkMode ? 'Escuro' : 'Claro'}</span>
                 <div className={`w-10 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-primary' : 'bg-gray-300'}`}>
                     <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 ${isDarkMode ? 'left-6' : 'left-1'}`}></div>
                 </div>
             </button>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          {user ? (
            <div className="space-y-3">
              <button onClick={() => handleNav('account')} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-white bg-primary shadow-lg shadow-blue-200 dark:shadow-none hover:scale-[1.02] transition-transform">
                <User size={20} />
                <span>Minha Conta</span>
              </button>
              <button onClick={handleLogoutClick} className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm">
                <LogOut size={16} /> Terminar Sessão
              </button>
            </div>
          ) : (
            <button onClick={handleLoginClick} className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-white bg-secondary dark:bg-gray-700 shadow-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-all">
              <LogIn size={20} />
              <span>Entrar / Registar</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
