
import React, { useState, useMemo, useEffect } from 'react';
import { Smartphone, Landmark, Banknote, Search } from 'lucide-react';
import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import AIChat from './components/AIChat';
import Home from './components/Home';
import ProductDetails from './components/ProductDetails';
import About from './components/About';
import Contact from './components/Contact';
import Terms from './components/Terms';
import Privacy from './components/Privacy';
import FAQ from './components/FAQ';
import Returns from './components/Returns';
import LoginModal from './components/LoginModal';
import ClientArea from './components/ClientArea';
import Dashboard from './components/Dashboard'; 
import { PRODUCTS, ADMIN_EMAILS } from './constants';
import { Product, CartItem, User, Order, Review, ProductVariant } from './types';
import { auth, db } from './services/firebaseConfig';
import { useStock } from './hooks/useStock'; 
import { notifyNewOrder } from './services/telegramNotifier';

const App: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Search State (Global)
  const [searchTerm, setSearchTerm] = useState('');

  // Wishlist State (Local + DB)
  const [wishlist, setWishlist] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Login and User State
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Reviews State
  const [reviews, setReviews] = useState<Review[]>([]);

  // Simple Hash Router State
  const [route, setRoute] = useState(window.location.hash || '#/');

  // Stock Hook
  const { getStockForProduct } = useStock();

  // Verifica se o utilizador atual é Admin (Case Insensitive e Trimmed)
  const isAdmin = useMemo(() => {
    if (!user || !user.email) return false;
    const userEmail = user.email.trim().toLowerCase();
    return ADMIN_EMAILS.some(adminEmail => adminEmail.trim().toLowerCase() === userEmail);
  }, [user]);

  // Função para gerir Wishlist (Local + DB)
  const toggleWishlist = async (productId: number) => {
    let newWishlist = [];
    if (wishlist.includes(productId)) {
        newWishlist = wishlist.filter(id => id !== productId);
    } else {
        newWishlist = [...wishlist, productId];
    }
    
    setWishlist(newWishlist);
    localStorage.setItem('wishlist', JSON.stringify(newWishlist));

    // Se estiver logado, atualiza também na BD
    if (user && user.uid) {
        try {
            await db.collection("users").doc(user.uid).update({
                wishlist: newWishlist
            });
        } catch (error) {
            console.error("Erro ao sincronizar wishlist:", error);
        }
    }
  };

  // Initialization & Auth Listener
  useEffect(() => {
    // 1. Carregar Reviews Públicas do Firestore
    const loadReviews = async () => {
        try {
            const snapshot = await db.collection('reviews').get();
            const loadedReviews: Review[] = [];
            snapshot.forEach(doc => {
                loadedReviews.push(doc.data() as Review);
            });
            loadedReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setReviews(loadedReviews);
        } catch (error) {
            console.error("Erro ao carregar reviews:", error);
        }
    };
    loadReviews();

    // 2. Escutar mudanças no estado de autenticação REAL do Firebase
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
            // Utilizador está logado
            try {
                // Buscar perfil do utilizador e WISHLIST
                const docRef = db.collection("users").doc(firebaseUser.uid);
                const docSnap = await docRef.get();
                
                if (docSnap.exists) {
                    const userData = docSnap.data() as User;
                    setUser(userData);
                    
                    // Sincronizar Wishlist da BD para o Estado Local
                    if (userData.wishlist && Array.isArray(userData.wishlist)) {
                        setWishlist(userData.wishlist);
                        localStorage.setItem('wishlist', JSON.stringify(userData.wishlist));
                    }
                } else {
                    const basicUser: User = {
                        uid: firebaseUser.uid,
                        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Cliente',
                        email: firebaseUser.email || '',
                        addresses: [],
                        wishlist: []
                    };
                    setUser(basicUser);
                }

                // Buscar Encomendas Reais deste utilizador no Firestore
                const ordersRef = db.collection("orders");
                const q = ordersRef.where("userId", "==", firebaseUser.uid);
                const querySnapshot = await q.get();
                
                const userOrders: Order[] = [];
                querySnapshot.forEach((doc) => {
                    userOrders.push(doc.data() as Order);
                });
                
                userOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setOrders(userOrders);

            } catch (err) {
                console.error("Erro ao carregar dados do utilizador:", err);
            }
        } else {
            // Utilizador saiu
            setUser(null);
            setOrders([]); 
        }
    });

    const handleHashChange = () => {
      setRoute(window.location.hash || '#/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
        unsubscribe();
        window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const addToCart = (product: Product, variant?: ProductVariant) => {
    const currentStock = getStockForProduct(product.id, variant?.name);
    
    if (currentStock <= 0) {
        alert("Desculpe, este produto acabou de esgotar!");
        return;
    }

    const finalPrice = variant?.price ?? product.price;
    const variantName = variant?.name;
    
    const cartItemId = variantName 
        ? `${product.id}-${variantName}` 
        : `${product.id}`;

    setCartItems(prev => {
      const existing = prev.find(item => item.cartItemId === cartItemId);
      if (existing) {
        if (existing.quantity + 1 > currentStock) {
            alert(`Apenas ${currentStock} unidades disponíveis.`);
            return prev;
        }
        return prev.map(item => 
          item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { 
          ...product, 
          price: finalPrice,
          selectedVariant: variantName,
          cartItemId: cartItemId,
          quantity: 1 
      }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = item.quantity + delta;
        if (delta > 0) {
            const currentStock = getStockForProduct(item.id, item.selectedVariant);
            if (newQty > currentStock) {
                alert(`Máximo disponível: ${currentStock}`);
                return item;
            }
        }
        const finalQty = Math.max(1, newQty);
        return { ...item, quantity: finalQty };
      }
      return item;
    }));
  };

  const handleLoginSuccess = (incomingUser: User) => {
    setUser(incomingUser);
    if (incomingUser.wishlist) {
        setWishlist(incomingUser.wishlist);
        localStorage.setItem('wishlist', JSON.stringify(incomingUser.wishlist));
    }
    setIsLoginOpen(false);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    if (updatedUser.uid) {
        try {
            await db.collection("users").doc(updatedUser.uid).set(updatedUser);
        } catch (err) {
            console.error("Erro ao guardar dados no Firestore:", err);
            alert("Erro ao guardar dados. Verifique a sua conexão.");
        }
    }
  };

  const handleLogout = async () => {
    try {
        await auth.signOut();
        setUser(null);
        window.location.hash = '/';
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
  };

  const handleCheckout = async (newOrder: Order) => {
      const updatedOrders = [newOrder, ...orders];
      setOrders(updatedOrders);
      setCartItems([]); 

      const customerName = user ? user.name : 'Cliente Anónimo';

      if (user && user.uid) {
          try {
              newOrder.userId = user.uid; 
              await db.collection("orders").doc(newOrder.id).set(newOrder);
              notifyNewOrder(newOrder, customerName);
          } catch (e) {
              console.error("Erro ao gravar encomenda", e);
          }
      } else {
          try {
             await db.collection("orders").doc(newOrder.id).set(newOrder);
             notifyNewOrder(newOrder, customerName);
          } catch (e) { console.error(e); }
      }
  };

  const handleAddReview = async (newReview: Review) => {
      const updatedReviews = [newReview, ...reviews];
      setReviews(updatedReviews);
      try {
          await db.collection("reviews").doc(newReview.id).set(newReview);
      } catch (e) {
          console.error("Erro ao gravar review", e);
      }
  };

  const cartTotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cartItems]);

  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Handle Search logic: Switch to Home/Products when searching
  const handleSearchChange = (term: string) => {
      setSearchTerm(term);
      if (term && route !== '#/') {
          window.location.hash = '/';
      }
      if (term) {
          setTimeout(() => {
             const productSection = document.getElementById('products');
             if (productSection) productSection.scrollIntoView({ behavior: 'smooth' });
          }, 100);
      }
  };

  const renderContent = () => {
    // DASHBOARD ADMIN
    if (route === '#dashboard') {
        if (isAdmin) {
            return <Dashboard />;
        } else {
            setTimeout(() => window.location.hash = '/', 0);
            return <div className="p-8 text-center">Acesso negado. A redirecionar...</div>;
        }
    }

    // ÁREA DE CLIENTE
    if (route === '#account') {
      if (!user) {
        setTimeout(() => {
            window.location.hash = '/';
            setIsLoginOpen(true);
        }, 0);
        return <Home products={PRODUCTS} onAddToCart={addToCart} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} searchTerm={searchTerm} />; 
      }
      return (
        <ClientArea 
            user={user} 
            orders={orders} 
            onLogout={handleLogout} 
            onUpdateUser={handleUpdateUser} 
            wishlist={wishlist}
            onToggleWishlist={toggleWishlist}
            onAddToCart={addToCart}
        />
      );
    }

    // DETALHE DO PRODUTO
    if (route.startsWith('#product/')) {
        const id = parseInt(route.split('/')[1]);
        const product = PRODUCTS.find(p => p.id === id);
        if (product) {
            return (
                <ProductDetails 
                    product={product} 
                    onAddToCart={addToCart} 
                    reviews={reviews}
                    onAddReview={handleAddReview}
                    currentUser={user}
                    getStock={getStockForProduct}
                    wishlist={wishlist}
                    onToggleWishlist={toggleWishlist}
                />
            );
        }
    }

    // PÁGINAS ESTÁTICAS
    switch (route) {
        case '#about': return <About />;
        case '#contact': return <Contact />;
        case '#terms': return <Terms />;
        case '#privacy': return <Privacy />;
        case '#faq': return <FAQ />;
        case '#returns': return <Returns />;
        // HOME (DEFAULT)
        case '#/':
        default:
            return <Home products={PRODUCTS} onAddToCart={addToCart} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} searchTerm={searchTerm} />;
    }
  };

  const handleMobileNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = path;
    setIsMobileMenuOpen(false);
  };

  // Se estiver no Dashboard, renderiza sem header/footer para ocupar o ecrã todo
  if (route === '#dashboard' && isAdmin) {
      return (
          <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
              <Dashboard />
          </div>
      );
  }

  // Renderização Padrão
  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-gray-50">
      <Header 
        cartCount={cartCount} 
        onOpenCart={() => setIsCartOpen(true)} 
        onOpenMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
      />

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 p-4 space-y-4 animate-fade-in-down shadow-lg relative z-50">
          <div className="relative">
             <input 
                type="text" 
                placeholder="Pesquisar produtos..." 
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
             />
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>

          <a href="#/" onClick={handleMobileNav('/')} className="block py-2 text-gray-600 font-medium">Início</a>
          <a href="#/" onClick={(e) => { e.preventDefault(); window.location.hash = '/'; setIsMobileMenuOpen(false); setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="block py-2 text-gray-600 font-medium">Produtos</a>
          <a href="#about" onClick={handleMobileNav('about')} className="block py-2 text-gray-600 font-medium">Sobre</a>
          <a href="#contact" onClick={handleMobileNav('contact')} className="block py-2 text-gray-600 font-medium">Contato</a>
          <div className="pt-4 border-t border-gray-100">
            {user ? (
                <button onClick={() => { window.location.hash = 'account'; setIsMobileMenuOpen(false); }} className="w-full text-left py-2 text-primary font-bold">
                    Minha Conta ({user.name.split(' ')[0]})
                </button>
            ) : (
                <button onClick={() => { setIsLoginOpen(true); setIsMobileMenuOpen(false); }} className="w-full bg-secondary text-white py-2 rounded-lg font-medium">
                    Entrar / Registar
                </button>
            )}
          </div>
        </div>
      )}

      <main className="flex-grow flex flex-col">
        {renderContent()}
      </main>

      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
                <h4 className="text-white font-bold text-lg mb-4">Allshop</h4>
                <p className="text-sm">A sua loja de confiança para os melhores gadgets e eletrônicos do mercado.</p>
            </div>
            <div>
                <h4 className="text-white font-bold mb-4">Links Úteis</h4>
                <ul className="space-y-2 text-sm">
                    <li><a href="#about" onClick={(e) => {e.preventDefault(); window.location.hash = 'about';}} className="hover:text-primary">Sobre Nós</a></li>
                    <li><a href="#terms" onClick={(e) => {e.preventDefault(); window.location.hash = 'terms';}} className="hover:text-primary">Termos de Uso</a></li>
                    <li><a href="#privacy" onClick={(e) => {e.preventDefault(); window.location.hash = 'privacy';}} className="hover:text-primary">Política de Privacidade</a></li>
                </ul>
            </div>
            <div>
                <h4 className="text-white font-bold mb-4">Atendimento</h4>
                <ul className="space-y-2 text-sm">
                    <li><a href="#contact" onClick={(e) => {e.preventDefault(); window.location.hash = 'contact';}} className="hover:text-primary">Fale Conosco</a></li>
                    <li><a href="#returns" onClick={(e) => {e.preventDefault(); window.location.hash = 'returns';}} className="hover:text-primary">Trocas e Devoluções</a></li>
                    <li><a href="#faq" onClick={(e) => {e.preventDefault(); window.location.hash = 'faq';}} className="hover:text-primary">FAQ</a></li>
                </ul>
            </div>
            <div>
                <h4 className="text-white font-bold mb-4">Pagamento</h4>
                <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 group cursor-default" title="MB Way">
                        <div className="w-10 h-8 bg-gray-800 rounded-md flex items-center justify-center text-gray-300 group-hover:bg-white group-hover:text-red-500 transition-all duration-300">
                            <Smartphone size={18} />
                        </div>
                        <span className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors">MB Way</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 group cursor-default" title="Transferência Bancária">
                        <div className="w-10 h-8 bg-gray-800 rounded-md flex items-center justify-center text-gray-300 group-hover:bg-white group-hover:text-blue-500 transition-all duration-300">
                            <Landmark size={18} />
                        </div>
                        <span className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors">Transf.</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 group cursor-default" title="Pagamento na Entrega">
                        <div className="w-10 h-8 bg-gray-800 rounded-md flex items-center justify-center text-gray-300 group-hover:bg-white group-hover:text-green-500 transition-all duration-300">
                            <Banknote size={18} />
                        </div>
                        <span className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors">Em Mão</span>
                    </div>
                </div>
            </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center text-xs">
            <span>&copy; 2024 Allshop Store. Todos os direitos reservados.</span>
            {isAdmin && (
              <a 
                href="#dashboard" 
                onClick={(e) => { e.preventDefault(); window.location.hash = 'dashboard'; }}
                className="mt-2 md:mt-0 text-gray-500 hover:text-white transition-colors"
              >
                Admin
              </a>
            )}
        </div>
      </footer>

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onRemoveItem={removeFromCart}
        onUpdateQuantity={updateQuantity}
        total={cartTotal}
        onCheckout={handleCheckout}
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLoginSuccess}
      />

      <AIChat />
    </div>
  );
};

export default App;
