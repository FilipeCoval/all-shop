import React from 'react';
import { ShoppingCart, ShoppingBag, Menu, User as UserIcon, LogIn, LogOut, Search, X, Award, Moon, Sun, ChevronLeft, ArrowRight } from 'lucide-react';
import { STORE_NAME, LOGO_URL, LOYALTY_TIERS } from '../constants';
import { User, Product } from '../types';

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenMobileMenu: () => void;
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onResetHome: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  products: Product[];
}

const LoyaltyProgressBar: React.FC<{ user: User }> = ({ user }) => {
    const currentTotalSpent = user.totalSpent || 0;
    const currentTier = user.tier || 'Bronze';
    
    let nextTierLabel: string | null = null;
    let progress = 0;
    let remaining = 0;

    if (currentTier === 'Bronze') {
        const limit = LOYALTY_TIERS.SILVER.threshold;
        nextTierLabel = LOYALTY_TIERS.SILVER.label;
        progress = (currentTotalSpent / limit) * 100;
        remaining = limit - currentTotalSpent;
    } else if (currentTier === 'Prata') {
        const lowerLimit = LOYALTY_TIERS.SILVER.threshold;
        const upperLimit = LOYALTY_TIERS.GOLD.threshold;
        nextTierLabel = LOYALTY_TIERS.GOLD.label;
        progress = ((currentTotalSpent - lowerLimit) / (upperLimit - lowerLimit)) * 100;
        remaining = upperLimit - currentTotalSpent;
    } else { // Ouro
        progress = 100;
    }

    if(remaining <= 0) return null;

    return (
        <div className="w-full text-center">
            <p className="text-xs text-gray-500 mb-1 px-4">
                Faltam <strong>{remaining.toFixed(2)}€</strong> para o nível <strong className="text-primary">{nextTierLabel}</strong>!
            </p>
            <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
                <div className="bg-primary h-1" style={{ width: `${Math.min(100, progress)}%` }}></div>
            </div>
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({ 
  cartCount, 
  onOpenCart, 
  onOpenMobileMenu, 
  user, 
  onOpenLogin, 
  onLogout,
  searchTerm,
  onSearchChange,
  onResetHome,
  isDarkMode = false,
  onToggleTheme,
  products = []
}) => {
  
  const [showResults, setShowResults] = React.useState(false);
  
  const searchResults = React.useMemo(() => {
      if (!searchTerm || searchTerm.length < 2) return [];
      return products.filter(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          p.description.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5);
  }, [searchTerm, products]);

  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (path === '/') {
        onResetHome();
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

    const [isHome, setIsHome] = React.useState(true);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);

    React.useEffect(() => {
        const checkHome = () => {
            setIsHome(window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#');
        };
        checkHome();
        window.addEventListener('hashchange', checkHome);
        return () => window.removeEventListener('hashchange', checkHome);
    }, []);

    const handleBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            onResetHome();
        }
    };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/95 dark:bg-[#020617]/90 border-b border-gray-200 dark:border-slate-800 shadow-sm transition-all pt-[env(safe-area-inset-top)]">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between relative">
        
        {/* MOBILE SEARCH OVERLAY */}
        {isMobileSearchOpen ? (
            <div className="absolute inset-0 z-50 flex items-center px-4 bg-white dark:bg-[#020617] animate-fade-in">
                <Search className="text-gray-400 mr-3" size={20} />
                <input 
                    type="text"
                    placeholder="Pesquisar produtos..."
                    value={searchTerm}
                    onChange={(e) => { onSearchChange(e.target.value); setShowResults(true); }}
                    autoFocus
                    className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white text-base h-full"
                />
                <button onClick={() => { setIsMobileSearchOpen(false); onSearchChange(''); }} className="p-2 text-gray-500">
                    <X size={20} />
                </button>
                
                {/* MOBILE SMART SEARCH RESULTS */}
                {showResults && searchTerm.length >= 2 && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 w-full bg-white dark:bg-[#0f172a] shadow-2xl border-t border-gray-100 dark:border-slate-800 max-h-[60vh] overflow-y-auto">
                        {searchResults.map(product => (
                            <a 
                                key={product.id} 
                                href={`#product/${product.id}`} 
                                onClick={(e) => { e.preventDefault(); window.location.hash = `product/${product.id}`; setShowResults(false); setIsMobileSearchOpen(false); onSearchChange(''); }}
                                className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-slate-800 active:bg-gray-50 dark:active:bg-slate-800"
                            >
                                <img src={product.image} alt={product.name} className="w-12 h-12 object-contain bg-white rounded-lg p-1 border border-gray-100 dark:border-slate-700" />
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{product.name}</p>
                                    <p className="text-primary font-bold text-sm">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}</p>
                                </div>
                                <ChevronLeft className="rotate-180 text-gray-300" size={20} />
                            </a>
                        ))}
                        <button 
                            onClick={() => { setShowResults(false); setIsMobileSearchOpen(false); window.location.hash = '/'; setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                            className="w-full p-4 text-center text-sm font-bold text-primary uppercase tracking-wider"
                        >
                            Ver todos os resultados
                        </button>
                    </div>
                )}
            </div>
        ) : (
            <>
                {/* ESQUERDA: Menu (Mobile) + Logo (Desktop) + Nav (Desktop) */}
                <div className="flex items-center gap-2 flex-1 justify-start">
                    {!isHome && (
                        <button 
                            className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" 
                            onClick={handleBack}
                            aria-label="Voltar"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <button 
                        className={`md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${!isHome ? '' : '-ml-2'}`} 
                        onClick={onOpenMobileMenu}
                        aria-label="Menu"
                    >
                        <Menu size={24} />
                    </button>

                    {/* LOGO DESKTOP (Esquerda - Original) - Oculto em Mobile */}
                    <a href="#/" onClick={(e) => { e.preventDefault(); onResetHome(); }} className="hidden md:block group mr-4">
                        {LOGO_URL ? (
                            <img 
                            src={LOGO_URL} 
                            alt={STORE_NAME} 
                            className="h-[65px] w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
                            />
                        ) : (
                            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                                <ShoppingBag size={28} className="text-primary" />
                                <span className="text-xl font-bold tracking-tight">{STORE_NAME}</span>
                            </div>
                        )}
                    </a>

                    {/* Links Desktop */}
                    <nav className="hidden md:flex items-center gap-6 text-base font-medium text-gray-600 dark:text-gray-300">
                        <a href="#/" onClick={(e) => { e.preventDefault(); onResetHome(); }} className="hover:text-primary dark:hover:text-white transition-colors">Início</a>
                        <a href="#/" onClick={(e) => { e.preventDefault(); window.location.hash = '/'; setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-primary dark:hover:text-white transition-colors">Produtos</a>
                        <a href="#allpoints" onClick={handleNav('allpoints')} className="hover:text-primary dark:hover:text-white transition-colors flex items-center gap-1"><Award size={16} className="text-yellow-500" /> AllPoints</a>
                        <a href="#about" onClick={handleNav('about')} className="hover:text-primary dark:hover:text-white transition-colors">Sobre</a>
                        <a href="#contact" onClick={handleNav('contact')} className="hover:text-primary dark:hover:text-white transition-colors">Contato</a>
                    </nav>
                </div>

                {/* LOGO MOBILE (Centralizado Absoluto) - Oculto em Desktop */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden z-10">
                    <a href="#/" onClick={(e) => { e.preventDefault(); onResetHome(); }} className="block">
                        {LOGO_URL ? (
                            <img 
                            src={LOGO_URL} 
                            alt={STORE_NAME} 
                            className="h-[65px] w-auto object-contain" 
                            />
                        ) : (
                            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{STORE_NAME}</span>
                        )}
                    </a>
                </div>

                {/* DIREITA: Pesquisa & Ações */}
                <div className="flex items-center justify-end gap-2 md:gap-4 flex-1">
                    
                    {/* MOBILE SEARCH TRIGGER */}
                    <button 
                        className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        onClick={() => setIsMobileSearchOpen(true)}
                    >
                        <Search size={24} />
                    </button>

                    {/* Barra de Pesquisa (Desktop) */}
                    <div className="hidden md:flex relative w-40 lg:w-64 transition-all focus-within:w-64 lg:focus-within:w-80 group">
                        <input 
                            type="text"
                            placeholder="Pesquisar..."
                            value={searchTerm}
                            onChange={(e) => { onSearchChange(e.target.value); setShowResults(true); }}
                            onFocus={() => setShowResults(true)}
                            onBlur={() => setTimeout(() => setShowResults(false), 200)}
                            className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#0f172a] focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-base"
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

                        {/* SMART SEARCH DROPDOWN (DESKTOP) */}
                        {showResults && searchTerm.length >= 2 && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-[#0f172a] shadow-2xl rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden z-50 animate-fade-in-down">
                                <div className="max-h-[300px] overflow-y-auto">
                                    {searchResults.map(product => (
                                        <a 
                                            key={product.id} 
                                            href={`#product/${product.id}`} 
                                            onClick={(e) => { e.preventDefault(); window.location.hash = `product/${product.id}`; setShowResults(false); onSearchChange(''); }}
                                            className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0 group/item"
                                        >
                                            <div className="w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center border border-gray-100 dark:border-slate-700 shrink-0">
                                                <img src={product.image} alt={product.name} className="max-w-full max-h-full object-contain" />
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="font-bold text-sm text-gray-900 dark:text-white truncate group-hover/item:text-primary transition-colors">{product.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-primary font-bold">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(product.price)}</p>
                                                    {product.stock > 0 ? (
                                                        <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">Em stock</span>
                                                    ) : (
                                                        <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">Esgotado</span>
                                                    )}
                                                </div>
                                            </div>
                                            <ArrowRight size={14} className="text-gray-300 group-hover/item:text-primary opacity-0 group-hover/item:opacity-100 transition-all -translate-x-2 group-hover/item:translate-x-0" />
                                        </a>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => { setShowResults(false); window.location.hash = '/'; setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                                    className="w-full p-2 text-center text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 uppercase tracking-wider border-t border-gray-100 dark:border-slate-800"
                                >
                                    Ver todos os resultados ({searchResults.length}+)
                                </button>
                            </div>
                        )}
                    </div>

                    {/* TOGGLE DARK MODE - AGORA VISÍVEL EM MOBILE */}
                    {onToggleTheme && (
                        <button
                            onClick={onToggleTheme}
                            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors hidden sm:block"
                            title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
                        >
                            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    )}

                    <div className="flex items-center gap-2">
                        {user ? (
                            <div className="relative group hidden sm:block">
                                <button 
                                    onClick={handleNav('account')}
                                    className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-gray-200 font-medium border border-transparent hover:border-gray-200 dark:hover:border-slate-700"
                                >
                                    <UserIcon size={20} />
                                    <span className="text-base max-w-[100px] truncate hidden lg:block">{getFirstName()}</span>
                                </button>
                                {/* Dropdown Menu */}
                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#0f172a] rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 p-1 z-50">
                                    <div className="p-3 border-b border-gray-100 dark:border-slate-800">
                                        <LoyaltyProgressBar user={user} />
                                    </div>
                                    <a href="#account" onClick={handleNav('account')} className="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-gray-200 font-medium">Minha Conta</a>
                                    <button onClick={onLogout} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm text-red-600 flex items-center gap-2 font-medium">
                                        <LogOut size={14} /> Sair
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={onOpenLogin}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-base"
                            >
                                Entrar
                            </button>
                        )}

                        <button 
                            onClick={onOpenCart}
                            className="relative p-2.5 text-gray-700 dark:text-gray-200 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-all"
                            aria-label="Carrinho"
                        >
                            <ShoppingCart size={24} />
                            {cartCount > 0 && (
                                <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-600 rounded-full border border-white dark:border-[#020617] animate-bounce-slow">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </>
        )}

      </div>
    </header>
  );
};

export default Header;
