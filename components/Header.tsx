
import React from 'react';
import { ShoppingCart, ShoppingBag, Menu, User as UserIcon, LogIn, LogOut } from 'lucide-react';
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
  onLogout 
  onLogout,
  searchTerm,
  onSearchChange
}) => {
  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = path;
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/95 border-b border-gray-200 shadow-sm transition-all">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* Logo Section - Maximized Size */}
        <div className="flex items-center gap-4 h-full py-1">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-4">
        {/* Logo Section */}
        <div className="flex items-center gap-4 h-full py-1 shrink-0">
            <button className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg" onClick={onOpenMobileMenu}>
                <Menu size={28} />
            </button>
            <a href="#/" onClick={handleNav('/')} className="flex items-center h-full group">
                {LOGO_URL ? (
                    <img 
                      src={LOGO_URL} 
                      alt={STORE_NAME} 
                      className="h-full w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
                      style={{ maxHeight: '72px' }}
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={32} fill="currentColor" className="text-primary" />
                        <span className="text-2xl font-bold text-gray-900 tracking-tight">{STORE_NAME}</span>
                    </div>
                )}
            </a>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-8 text-base font-medium text-gray-600">
          <a href="#/" onClick={handleNav('/')} className="hover:text-primary transition-colors py-2">Início</a>
          <a href="#/" onClick={(e) => { e.preventDefault(); window.location.hash = '/'; setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-primary transition-colors py-2">Produtos</a>
          <a href="#about" onClick={handleNav('about')} className="hover:text-primary transition-colors py-2">Sobre</a>
          <a href="#contact" onClick={handleNav('contact')} className="hover:text-primary transition-colors py-2">Contato</a>
        </nav>

        {/* Search Bar (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-sm relative">
            <input 
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
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

        {/* Actions */}
        <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 shrink-0">
          {/* User/Login Button */}
          {user ? (
            <div className="relative group hidden sm:block">
              <button 
                onClick={handleNav('account')}
                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700 font-medium border border-transparent hover:border-gray-200"
              >
                <div className="w-8 h-8 bg-blue-100 text-primary rounded-full flex items-center justify-center border border-blue-200">
                  <UserIcon size={18} />
                </div>
                <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
              </button>
              {/* Dropdown hint */}
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0">
                <a href="#account" onClick={handleNav('account')} className="block px-4 py-3 hover:bg-gray-50 text-sm text-gray-700">Minha Conta</a>
                <button onClick={onLogout} className="w-full text-left px-4 py-3 hover:bg-red-50 text-sm text-red-600 flex items-center gap-2">
                  <LogOut size={14} /> Sair
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={onOpenLogin}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              <LogIn size={20} />
              <span>Entrar</span>
            </button>
          )}

          {/* Cart Button */}
          <button 
            onClick={onOpenCart}
            className="relative p-3 text-gray-600 hover:text-primary hover:bg-blue-50 rounded-full transition-all"
            aria-label="Carrinho"
          >
            <ShoppingCart size={28} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full border-2 border-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
export default Header;
