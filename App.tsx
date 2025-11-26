
import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import AIChat from './components/AIChat';
import Home from './components/Home';
import ProductDetails from './components/ProductDetails';
import About from './components/About';
import Contact from './components/Contact';
import LoginModal from './components/LoginModal';
import ClientArea from './components/ClientArea';
import { PRODUCTS } from './constants';
import { Product, CartItem, User, Order, Review } from './types';
import { auth, db } from './services/firebaseConfig';
// import { onAuthStateChanged, signOut } from 'firebase/auth'; // v9 removed
// import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'; // v9 removed

const App: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Login and User State
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Reviews State
  const [reviews, setReviews] = useState<Review[]>([]);

  // Simple Hash Router State
  const [route, setRoute] = useState(window.location.hash || '#/');

  // Initialization & Auth Listener
  useEffect(() => {
    // Escutar mudanças no estado de autenticação REAL do Firebase (v8 syntax)
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
            // Utilizador está logado
            try {
                // 1. Buscar perfil do utilizador
                const docRef = db.collection("users").doc(firebaseUser.uid);
                const docSnap = await docRef.get();
                
                if (docSnap.exists) {
                    setUser(docSnap.data() as User);
                } else {
                    const basicUser: User = {
                        uid: firebaseUser.uid,
                        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Cliente',
                        email: firebaseUser.email || '',
                        addresses: []
                    };
                    setUser(basicUser);
                }

                // 2. Buscar Encomendas Reais deste utilizador no Firestore
                const ordersRef = db.collection("orders");
                const q = ordersRef.where("userId", "==", firebaseUser.uid);
                const querySnapshot = await q.get();
                
                const userOrders: Order[] = [];
                querySnapshot.forEach((doc) => {
                    userOrders.push(doc.data() as Order);
                });
                
                // Ordenar por data (mais recente primeiro)
                userOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setOrders(userOrders);

            } catch (err) {
                console.error("Erro ao carregar dados do utilizador:", err);
            }
        } else {
            // Utilizador saiu
            setUser(null);
            setOrders([]); // Limpa encomendas da sessão
        }
    });

    const storedReviews = localStorage.getItem('allshop_reviews');
    if (storedReviews) {
        try { setReviews(JSON.parse(storedReviews)); } catch (e) { console.error(e); }
    }

    const handleHashChange = () => {
      setRoute(window.location.hash || '#/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Cleanup
    return () => {
        unsubscribe();
        window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: number) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleLoginSuccess = (incomingUser: User) => {
    setUser(incomingUser);
    setIsLoginOpen(false);
    window.location.hash = 'account';
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
      // 1. Atualiza estado local (visual imediato)
      const updatedOrders = [newOrder, ...orders];
      setOrders(updatedOrders);
      setCartItems([]); // Limpa carrinho

      // 2. Se utilizador logado, grava na BD com ID dele
      if (user && user.uid) {
          try {
              newOrder.userId = user.uid; // Garante que a encomenda tem dono
              // Grava na coleção 'orders' (acessível ao admin e ao user)
              await db.collection("orders").doc(newOrder.id).set(newOrder);
          } catch (e) {
              console.error("Erro ao gravar encomenda no Firestore", e);
          }
      } else {
          // Se for anónimo, grava na mesma (para o admin ver), mas sem userId
          try {
             await db.collection("orders").doc(newOrder.id).set(newOrder);
          } catch (e) { console.error(e); }
      }
  };

  const handleAddReview = (newReview: Review) => {
      const updatedReviews = [newReview, ...reviews];
      setReviews(updatedReviews);
      try {
          localStorage.setItem('allshop_reviews', JSON.stringify(updatedReviews));
      } catch (e) {
          console.error("Storage limit reached", e);
      }
  };

  const cartTotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cartItems]);

  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const renderContent = () => {
    // Route Guard for Account
    if (route === '#account') {
      if (!user) {
        setTimeout(() => {
            window.location.hash = '/';
            setIsLoginOpen(true);
        }, 0);
        return <Home products={PRODUCTS} onAddToCart={addToCart} />; 
      }
      return <ClientArea user={user} orders={orders} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
    }

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
                />
            );
        }
    }

    switch (route) {
        case '#about':
            return <About />;
        case '#contact':
            return <Contact />;
        case '#/':
        default:
            return <Home products={PRODUCTS} onAddToCart={addToCart} />;
    }
  };

  const handleMobileNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = path;
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-gray-50">
      <Header 
        cartCount={cartCount} 
        onOpenCart={() => setIsCartOpen(true)} 
        onOpenMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 p-4 space-y-4 animate-fade-in-down shadow-lg relative z-50">
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

      <main className="flex-grow">
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
                    <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-primary">Termos de Uso</a></li>
                    <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-primary">Política de Privacidade</a></li>
                </ul>
            </div>
            <div>
                <h4 className="text-white font-bold mb-4">Atendimento</h4>
                <ul className="space-y-2 text-sm">
                    <li><a href="#contact" onClick={(e) => {e.preventDefault(); window.location.hash = 'contact';}} className="hover:text-primary">Fale Conosco</a></li>
                    <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-primary">Trocas e Devoluções</a></li>
                    <li><a href="#" onClick={e => e.preventDefault()} className="hover:text-primary">FAQ</a></li>
                </ul>
            </div>
            <div>
                <h4 className="text-white font-bold mb-4">Pagamento</h4>
                <div className="flex gap-2">
                    <div className="w-10 h-6 bg-gray-700 rounded"></div>
                    <div className="w-10 h-6 bg-gray-700 rounded"></div>
                    <div className="w-10 h-6 bg-gray-700 rounded"></div>
                </div>
            </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-gray-800 text-center text-xs">
            &copy; 2024 Allshop Store. Todos os direitos reservados.
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
