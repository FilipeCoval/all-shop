

import React, { useState, useMemo, useEffect } from 'react';
import { Smartphone, Landmark, Banknote, Search, Loader2 } from 'lucide-react';
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
import ResetPasswordModal from './components/ResetPasswordModal'; 
import ClientArea from './components/ClientArea';
import Dashboard from './components/Dashboard'; 
import { ADMIN_EMAILS, STORE_NAME, LOYALTY_TIERS, LOGO_URL } from './constants';
import { Product, CartItem, User, Order, Review, ProductVariant, UserTier, PointHistory } from './types';
import { auth, db } from './services/firebaseConfig';
import { useStock } from './hooks/useStock'; 
import { usePublicProducts } from './hooks/usePublicProducts';
import { notifyNewOrder } from './services/telegramNotifier';

const App: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [wishlist, setWishlist] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [resetCode, setResetCode] = useState<string | null>(null); 
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [route, setRoute] = useState(window.location.hash || '#/');
  
  // Hooks
  const { getStockForProduct } = useStock();
  const { products: dbProducts, loading: productsLoading } = usePublicProducts();

  const isAdmin = useMemo(() => {
    if (!user || !user.email) return false;
    const userEmail = user.email.trim().toLowerCase();
    return ADMIN_EMAILS.some(adminEmail => adminEmail.trim().toLowerCase() === userEmail);
  }, [user]);

  // --- REDIRECT LOGIC FOR SHARED LINKS ---
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/product/')) {
        const id = path.split('/')[2];
        if (id) {
            window.history.replaceState(null, '', '/');
            window.location.hash = `#product/${id}`;
            setRoute(`#product/${id}`);
        }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode === 'resetPassword' && oobCode) setResetCode(oobCode);
  }, []);

  useEffect(() => {
    const originalTitle = document.title;
    const handleBlur = () => { document.title = STORE_NAME + " - Volte aqui! 🛒"; };
    const handleFocus = () => { 
        if (!window.location.hash.startsWith('#product/')) {
            document.title = originalTitle; 
        }
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (route.includes('dashboard')) return;
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('session_id', sessionId);
    }
    const updatePresence = () => {
        if (!sessionId) return;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        db.collection('online_users').doc(sessionId).set({
            lastActive: Date.now(),
            page: route,
            userName: user ? user.name : 'Visitante',
            device: isMobile ? 'Mobile' : 'Desktop',
            userId: user?.uid || null
        }).catch(err => {
            console.debug("Presence sync failed:", err);
        });
    };
    updatePresence();
    const interval = setInterval(updatePresence, 20000);
    return () => clearInterval(interval);
  }, [route, user]);

  useEffect(() => {
    const loadReviews = async () => {
        try {
            const snapshot = await db.collection('reviews').get();
            const loadedReviews: Review[] = [];
            snapshot.forEach(doc => { loadedReviews.push(doc.data() as Review); });
            loadedReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setReviews(loadedReviews);
        } catch (error) { 
            console.debug("Reviews access restricted."); 
        }
    };
    loadReviews();

    const handleHashChange = () => {
      setRoute(window.location.hash || '#/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', handleHashChange);
    
    let userUnsubscribe = () => {};
    let ordersUnsubscribe = () => {};

    const authUnsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        userUnsubscribe();
        ordersUnsubscribe();

        if (firebaseUser && firebaseUser.email) {
            setAuthLoading(true);
            try {
                const userDocRef = db.collection("users").doc(firebaseUser.uid);

                // PASSO 1: Sincronização de dados de login (corrige contas de convidados, pontos, etc.)
                const userDoc = await userDocRef.get();
                if (!userDoc.exists) {
                    const basicUser: User = { uid: firebaseUser.uid, name: firebaseUser.displayName || 'Cliente', email: firebaseUser.email, addresses: [], wishlist: [], totalSpent: 0, tier: 'Bronze', loyaltyPoints: 0, pointsHistory: [] };
                    await userDocRef.set(basicUser);
                }
                const [userOrdersSnap, guestOrdersSnap] = await Promise.all([
                    db.collection("orders").where("userId", "==", firebaseUser.uid).get(),
                    db.collection('orders').where('shippingInfo.email', '==', firebaseUser.email.toLowerCase()).where('userId', '==', null).get()
                ]);
                const allUserOrders: Order[] = [];
                const orderIds = new Set<string>();
                userOrdersSnap.forEach(doc => { if (!orderIds.has(doc.id)) { allUserOrders.push({ id: doc.id, ...doc.data() } as Order); orderIds.add(doc.id); }});
                guestOrdersSnap.forEach(doc => { if (!orderIds.has(doc.id)) { allUserOrders.push({ id: doc.id, ...doc.data() } as Order); orderIds.add(doc.id); }});
                const freshUserDoc = await userDocRef.get();
                if (freshUserDoc.exists) {
                    const userData = freshUserDoc.data() as User;
                    const historicalTotalSpent = allUserOrders.filter(o => o.status !== 'Cancelado').reduce((sum, order) => sum + (order.total || 0), 0);
                    let correctTier: UserTier = 'Bronze';
                    if (historicalTotalSpent >= LOYALTY_TIERS.GOLD.threshold) correctTier = 'Ouro';
                    else if (historicalTotalSpent >= LOYALTY_TIERS.SILVER.threshold) correctTier = 'Prata';
                    const ordersToAwardPoints = allUserOrders.filter(o => o.status === 'Entregue' && !o.pointsAwarded);
                    let missingPoints = 0;
                    const newHistoryItems: PointHistory[] = [];
                    if (ordersToAwardPoints.length > 0) {
                        const multiplier = LOYALTY_TIERS[correctTier.toUpperCase() as keyof typeof LOYALTY_TIERS].multiplier;
                        ordersToAwardPoints.forEach(o => {
                            const pointsForThisOrder = Math.floor((o.total || 0) * multiplier);
                            if (pointsForThisOrder > 0) {
                                missingPoints += pointsForThisOrder;
                                newHistoryItems.push({ id: `sync-${o.id}`, date: new Date().toISOString(), amount: pointsForThisOrder, reason: `Compra #${o.id.slice(-6)} (Sinc. Nível ${correctTier})`, orderId: o.id });
                            }
                        });
                    }
                    const ordersToMigrate = guestOrdersSnap.docs;
                    const needsUpdate = ( (userData.totalSpent || 0).toFixed(2) !== historicalTotalSpent.toFixed(2) || (userData.tier || 'Bronze') !== correctTier || missingPoints > 0 || ordersToMigrate.length > 0 );
                    if (needsUpdate) {
                        const batch = db.batch();
                        const userUpdateData: any = {};
                        if ((userData.totalSpent || 0).toFixed(2) !== historicalTotalSpent.toFixed(2)) userUpdateData.totalSpent = historicalTotalSpent;
                        if ((userData.tier || 'Bronze') !== correctTier) userUpdateData.tier = correctTier;
                        if (missingPoints > 0) {
                            userUpdateData.loyaltyPoints = (userData.loyaltyPoints || 0) + missingPoints;
                            userUpdateData.pointsHistory = [...newHistoryItems, ...(userData.pointsHistory || [])];
                        }
                        if (Object.keys(userUpdateData).length > 0) batch.update(userDocRef, userUpdateData);
                        ordersToMigrate.forEach(doc => batch.update(doc.ref, { userId: firebaseUser.uid }));
                        
                        // A LINHA ABAIXO FOI REMOVIDA
                        // Esta lógica é agora da responsabilidade do admin no dashboard para evitar falhas de segurança/lógica.
                        // ordersToAwardPoints.forEach(order => batch.update(db.collection('orders').doc(order.id), { pointsAwarded: true }));
                        
                        await batch.commit();
                    }
                }
                
                // PASSO 2: Ativar listeners para atualizações em tempo real

                // Listener do perfil do utilizador
                userUnsubscribe = userDocRef.onSnapshot((docSnap) => {
                    if (docSnap.exists) {
                        const userData = docSnap.data() as User;
                        setUser(userData);
                        if (userData.wishlist) {
                            setWishlist(userData.wishlist);
                            localStorage.setItem('wishlist', JSON.stringify(userData.wishlist));
                        }
                    }
                });
                
                // Listener de encomendas (SIMPLIFICADO E CORRIGIDO)
                ordersUnsubscribe = db.collection("orders")
                    .where("userId", "==", firebaseUser.uid)
                    //.orderBy('date', 'desc') // Removido para evitar a necessidade de um índice composto. A ordenação é feita no cliente.
                    .onSnapshot((snap) => {
                        const fetchedOrders = snap.docs.map(doc => ({id: doc.id, ...doc.data() } as Order));
                        // Ordenar no cliente
                        fetchedOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        setOrders(fetchedOrders);
                    }, (error) => {
                        console.error("Erro ao carregar encomendas:", error);
                        setOrders([]); // Garante que a lista fica vazia em caso de erro de permissão
                    });

            } catch (error) {
                console.error("Erro crítico durante a autenticação/sincronização do utilizador:", error);
                const fallbackUser: User = { uid: firebaseUser.uid, name: firebaseUser.displayName || 'Cliente', email: firebaseUser.email, addresses: [], wishlist: [] };
                setUser(fallbackUser);
            } finally {
                setAuthLoading(false);
            }
        } else {
            setUser(null);
            setOrders([]);
            setAuthLoading(false);
        }
    });

    return () => {
        authUnsubscribe();
        userUnsubscribe();
        ordersUnsubscribe();
        window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const toggleWishlist = async (productId: number) => {
    let newWishlist = wishlist.includes(productId) ? wishlist.filter(id => id !== productId) : [...wishlist, productId];
    setWishlist(newWishlist);
    localStorage.setItem('wishlist', JSON.stringify(newWishlist));
    if (user?.uid) {
        try { await db.collection("users").doc(user.uid).update({ wishlist: newWishlist }); }
        catch (error) { console.debug("Wishlist update restricted."); }
    }
  };

  const addToCart = (product: Product, variant?: ProductVariant) => {
    const currentStock = getStockForProduct(product.id, variant?.name);
    if (currentStock <= 0) {
        alert("Desculpe, este produto acabou de esgotar!");
        return;
    }
    const cartItemId = variant?.name ? `${product.id}-${variant.name}` : `${product.id}`;

    setCartItems(prev => {
      const existing = prev.find(item => item.cartItemId === cartItemId);
      if (existing) {
        if (existing.quantity + 1 > currentStock) {
            alert(`Apenas ${currentStock} unidades disponíveis.`);
            return prev;
        }
        return prev.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, price: variant?.price ?? product.price, selectedVariant: variant?.name, cartItemId, quantity: 1 }];
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
                alert(`Máximo: ${currentStock}`); 
                return item; 
            }
        }
        return { ...item, quantity: Math.max(1, newQty) };
      }
      return item;
    }));
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    if (updatedUser.uid) {
        try { await db.collection("users").doc(updatedUser.uid).set(updatedUser); }
        catch (err) { console.error("Save error", err); }
    }
  };

  const handleLogout = async () => {
    try { await auth.signOut(); setUser(null); window.location.hash = '/'; }
    catch (error) { console.error("Logout error", error); }
  };

  const handleCheckout = async (newOrder: Order): Promise<boolean> => {
      try {
          await db.collection("orders").doc(newOrder.id).set(newOrder);
          
          setOrders(prev => [newOrder, ...prev]);
          setCartItems([]);
          
          notifyNewOrder(newOrder, user ? user.name : newOrder.shippingInfo.name);
          
          if (user?.uid) {
            const userRef = db.collection("users").doc(user.uid);
            await db.runTransaction(async (transaction) => {
              const userDoc = await transaction.get(userRef);
              if (!userDoc.exists) return;
              
              const userData = userDoc.data() as User;
              const newTotalSpent = (userData.totalSpent || 0) + newOrder.total;
              
              let newTier: UserTier = userData.tier || 'Bronze';
              if (newTotalSpent >= LOYALTY_TIERS.GOLD.threshold) newTier = 'Ouro';
              else if (newTotalSpent >= LOYALTY_TIERS.SILVER.threshold) newTier = 'Prata';
              
              transaction.update(userRef, { totalSpent: newTotalSpent, tier: newTier });
            });
          }
          return true;
      } catch (e) {
          console.error("Erro CRÍTICO no checkout:", e);
          alert("Ocorreu um erro ao guardar a sua encomenda. Por favor, tente novamente ou contacte o suporte se o erro persistir.");
          return false;
      }
  };

  const handleAddReview = async (newReview: Review) => {
      setReviews(prev => [newReview, ...prev]);
      try { await db.collection("reviews").doc(newReview.id).set(newReview); }
      catch (e) { console.error("Erro review:", e); }
  };

  const cartTotal = useMemo(() => cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cartItems]);
  const cartCount = useMemo(() => cartItems.reduce((acc, item) => acc + item.quantity, 0), [cartItems]);

  const handleSearchChange = (term: string) => {
      setSearchTerm(term);
      if (term && route !== '#/') window.location.hash = '/';
      if (term) setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleResetHome = () => {
    setSearchTerm('');
    setSelectedCategory('Todas');
    window.location.hash = '/';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    if (authLoading || (productsLoading && route !== '#dashboard')) {
        return (
            <div className="flex-grow flex items-center justify-center h-screen">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }
      
    if (route === '#dashboard') {
        return <Dashboard user={user} isAdmin={isAdmin} />;
    }
    if (route === '#account') {
      if (!user) { setTimeout(() => { window.location.hash = '/'; setIsLoginOpen(true); }, 0); return null; }
      return <ClientArea user={user} orders={orders} onLogout={handleLogout} onUpdateUser={handleUpdateUser} wishlist={wishlist} onToggleWishlist={toggleWishlist} onAddToCart={addToCart} publicProducts={dbProducts} />;
    }
    if (route.startsWith('#product/')) {
        const id = parseInt(route.split('/')[1]);
        const product = dbProducts.find(p => p.id === id);
        if (product) return <ProductDetails product={product} allProducts={dbProducts} onAddToCart={addToCart} reviews={reviews} onAddReview={handleAddReview} currentUser={user} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} />;
    }
    switch (route) {
        case '#about': return <About />;
        case '#contact': return <Contact />;
        case '#terms': return <Terms />;
        case '#privacy': return <Privacy />;
        case '#faq': return <FAQ />;
        case '#returns': return <Returns />;
        default: return <Home products={dbProducts} onAddToCart={addToCart} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} searchTerm={searchTerm} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans text-gray-900 bg-gray-50">
      <Header cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} onOpenMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} user={user} onOpenLogin={() => setIsLoginOpen(true)} onLogout={handleLogout} searchTerm={searchTerm} onSearchChange={handleSearchChange} onResetHome={handleResetHome} />
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 p-4 space-y-4 animate-fade-in-down shadow-lg relative z-50">
          <div className="relative">
             <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <a href="#/" onClick={(e) => { e.preventDefault(); handleResetHome(); setIsMobileMenuOpen(false); }} className="block py-2 text-gray-600 font-medium">Início</a>
          <a href="#about" onClick={(e) => { e.preventDefault(); window.location.hash = 'about'; setIsMobileMenuOpen(false); }} className="block py-2 text-gray-600 font-medium">Sobre</a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); window.location.hash = 'contact'; setIsMobileMenuOpen(false); }} className="block py-2 text-gray-600 font-medium">Contato</a>
          <div className="pt-4 border-t border-gray-100">
            {user ? (
                <button onClick={() => { window.location.hash = 'account'; setIsMobileMenuOpen(false); }} className="w-full text-left py-2 text-primary font-bold">A Minha Conta</button>
            ) : (
                <button onClick={() => { setIsLoginOpen(true); setIsMobileMenuOpen(false); }} className="w-full bg-secondary text-white py-3 rounded-lg font-bold">Entrar / Registar</button>
            )}
          </div>
        </div>
      )}
      <main className="flex-grow w-full flex flex-col">{renderContent()}</main>
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800 mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 text-center md:text-left">
            <div className="flex flex-col items-center md:items-start"><div className="flex items-center gap-2 mb-4">{LOGO_URL ? <img src={LOGO_URL} alt={STORE_NAME} className="h-10 invert brightness-0" /> : <h3 className="text-xl font-bold text-white">{STORE_NAME}</h3>}</div><p className="text-sm max-w-[200px]">A sua loja de confiança para os melhores gadgets e eletrônicos do mercado nacional.</p></div>
            <div><h4 className="text-white font-bold mb-4">Links Úteis</h4><ul className="space-y-2 text-sm"><li><a href="#about" onClick={(e) => {e.preventDefault(); window.location.hash = 'about';}} className="hover:text-primary">Sobre Nós</a></li><li><a href="#terms" onClick={(e) => {e.preventDefault(); window.location.hash = 'terms';}} className="hover:text-primary">Termos</a></li><li><a href="#privacy" onClick={(e) => {e.preventDefault(); window.location.hash = 'privacy';}} className="hover:text-primary">Privacidade</a></li></ul></div>
            <div><h4 className="text-white font-bold mb-4">Atendimento</h4><ul className="space-y-2 text-sm"><li><a href="#contact" onClick={(e) => {e.preventDefault(); window.location.hash = 'contact';}} className="hover:text-primary">Fale Conosco</a></li><li><a href="#returns" onClick={(e) => {e.preventDefault(); window.location.hash = 'returns';}} className="hover:text-primary">Garantia</a></li><li><a href="#faq" onClick={(e) => {e.preventDefault(); window.location.hash = 'faq';}} className="hover:text-primary">Dúvidas</a></li></ul></div>
            <div className="flex flex-col items-center md:items-start">
                <h4 className="text-white font-bold mb-4">Pagamento Seguro</h4>
                <div className="flex gap-2 items-center flex-wrap justify-center md:justify-start">
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm">
                        <img src="https://gestplus.pt/imgs/mbway.png" alt="MBWay" className="h-full w-full object-contain" />
                    </div>
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm">
                        <img src="https://tse2.mm.bing.net/th/id/OIP.pnNR_ET5AlZNDtMd2n1m5wHaHa?cb=ucfimg2&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3" alt="Multibanco" className="h-full w-full object-contain" />
                    </div>
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm">
                        <img src="https://tse1.mm.bing.net/th/id/OIP.ygZGQKeZ0aBwHS7e7wbJVgHaDA?cb=ucfimg2&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3" alt="Visa" className="h-full w-full object-contain" />
                    </div>
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/200px-Mastercard-logo.svg.png" alt="Mastercard" className="h-full w-full object-contain" />
                    </div>
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm">
                        <img src="https://www.oservidor.pt/img/s/166.jpg" alt="Cobrança" className="h-full w-full object-contain" />
                    </div>
                </div>
            </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center text-[10px]">
            <span>&copy; {new Date().getFullYear()} Allshop Store.</span>
            {isAdmin && <a href="#dashboard" onClick={(e) => { e.preventDefault(); window.location.hash = 'dashboard'; }} className="mt-2 md:mt-0 text-gray-600 hover:text-white transition-colors">Painel Admin</a>}
        </div>
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cartItems={cartItems} onRemoveItem={removeFromCart} onUpdateQuantity={updateQuantity} total={cartTotal} onCheckout={handleCheckout} user={user} onOpenLogin={() => setIsLoginOpen(true)} />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={(u) => { setUser(u); setIsLoginOpen(false); }} />
      {resetCode && <ResetPasswordModal oobCode={resetCode} onClose={() => setResetCode(null)} />}
      <AIChat products={dbProducts} />
    </div>
  );
};

export default App;
