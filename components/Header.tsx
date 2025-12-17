import React from 'react';
import { ShoppingCart, ShoppingBag, Menu, User as UserIcon, LogIn, LogOut, Search, X } from 'lucide-react';
import { STORE_NAME, LOGO_URL } from '../constants';
import { User } from '../types';

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenMobileMenu: () => void;
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  cartCount, 
  onOpenCart, 
  onOpenMobileMenu, 
  user, 
  onOpenLogin, 
  onLogout,
  searchTerm,
  onSearchChange
}) => {
  
  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (path === '/') {
        window.location.hash = '/';
    } else if (path.startsWith('#')) {
        window.location.hash = path;
    } else {
        window.location.hash = `#${path}`;
    }
  };

  const getFirstName = () => {
      if (!user || !user.name) return 'Conta';
      return user.name.split(' ')[0];
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/95 border-b border-gray-200 shadow-sm transition-all">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between relative">
        
        {/* ESQUERDA: Menu (Mobile) + Logo (Desktop) + Nav (Desktop) */}
        <div className="flex items-center gap-4 flex-1 justify-start">
            <button 
                className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" 
                onClick={onOpenMobileMenu}
                aria-label="Menu"
            >
                <Menu size={24} />
            </button>

            {/* LOGO DESKTOP (Esquerda - Original) - Oculto em Mobile */}
            <a href="#/" onClick={handleNav('/')} className="hidden md:block group mr-4">
                {LOGO_URL ? (
                    <img 
                      src={LOGO_URL} 
                      alt={STORE_NAME} 
                      className="h-[65px] w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
                    />
                ) : (
                    <div className="flex items-center gap-2 text-gray-900">
                        <ShoppingBag size={28} className="text-primary" />
                        <span className="text-xl font-bold tracking-tight">{STORE_NAME}</span>
                    </div>
                )}
            </a>

            {/* Links Desktop - AUMENTADO PARA TEXT-BASE */}
            <nav className="hidden md:flex items-center gap-6 text-base font-medium text-gray-600">
                <a href="#/" onClick={handleNav('/')} className="hover:text-primary transition-colors">Início</a>
                <a href="#/" onClick={(e) => { e.preventDefault(); window.location.hash = '/'; setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-primary transition-colors">Produtos</a>
                <a href="#about" onClick={handleNav('about')} className="hover:text-primary transition-colors">Sobre</a>
                <a href="#contact" onClick={handleNav('contact')} className="hover:text-primary transition-colors">Contato</a>
            </nav>
        </div>

        {/* LOGO MOBILE (Centralizado Absoluto) - Oculto em Desktop */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden z-10">
            <a href="#/" onClick={handleNav('/')} className="block">
                {LOGO_URL ? (
                    <img 
                      src={LOGO_URL} 
                      alt={STORE_NAME} 
                      className="h-[65px] w-auto object-contain" 
                    />
                ) : (
                    <span className="text-xl font-bold tracking-tight">{STORE_NAME}</span>
                )}
            </a>
        </div>

        {/* DIREITA: Pesquisa & Ações */}
        <div className="flex items-center justify-end gap-2 md:gap-4 flex-1">
            
            {/* Barra de Pesquisa (Desktop) - AUMENTADO PARA TEXT-BASE */}
            <div className="hidden md:flex relative w-40 lg:w-64 transition-all focus-within:w-64 lg:focus-within:w-80">
                <input 
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-base"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                {searchTerm && (
                    <button 
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2">
                {user ? (
                    <div className="relative group hidden sm:block">
                        <button 
                            onClick={handleNav('account')}
                            className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700 font-medium border border-transparent hover:border-gray-200"
                        >
                            <UserIcon size={20} />
                            {/* AUMENTADO PARA TEXT-BASE */}
                            <span className="text-base max-w-[100px] truncate hidden lg:block">{getFirstName()}</span>
                        </button>
                        {/* Dropdown Menu */}
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 p-1 z-50">
                            <a href="#account" onClick={handleNav('account')} className="block px-4 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 font-medium">Minha Conta</a>
                            <button onClick={onLogout} className="w-full text-left px-4 py-2 hover:bg-red-50 rounded-lg text-sm text-red-600 flex items-center gap-2 font-medium">
                                <LogOut size={14} /> Sair
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={onOpenLogin}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-gray-700 font-bold hover:bg-gray-100 transition-colors text-base"
                    >
                        Entrar
                    </button>
                )}

                <button 
                    onClick={onOpenCart}
                    className="relative p-2.5 text-gray-700 hover:text-primary hover:bg-blue-50 rounded-full transition-all"
                    aria-label="Carrinho"
                >
                    <ShoppingCart size={24} />
                    {cartCount > 0 && (
                        <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-600 rounded-full border border-white animate-bounce-slow">
                            {cartCount}
                        </span>
                    )}
                </button>
            </div>
        </div>

      </div>
    </header>
  );
};

export default Header;
