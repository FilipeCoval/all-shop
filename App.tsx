import React, { useState, useMemo, useEffect } from 'react';
import { Smartphone, Landmark, Banknote, Search, Loader2, Sun, Moon } from 'lucide-react';
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
import InstallPrompt from './components/InstallPrompt';
import { ADMIN_EMAILS, STORE_NAME, LOYALTY_TIERS, LOGO_URL, INITIAL_PRODUCTS } from './constants';
import { Product, CartItem, User, Order, Review, ProductVariant, UserTier, PointHistory } from './types';
import { auth, db, firebase } from './services/firebaseConfig';
import { useStock } from './hooks/useStock'; 
import { usePublicProducts } from './hooks/usePublicProducts';
import { useStockReservations } from './hooks/useStockReservations';
import { notifyNewOrder } from './services/telegramNotifier';

const App: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false); 
  
  // DARK MODE STATE
  const [isDarkMode, setIsDarkMode] = useState(() => {
      try {
          const saved = localStorage.getItem('theme');
          return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
      } catch {
          return false;
      }
  });

  useEffect(() => {
      if (isDarkMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
      }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

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
  const [processingProductIds, setProcessingProductIds] = useState<number[]>([]); // Loading local por produto
  
  const isAdmin = useMemo(() => {
    if (!user || !user.email) return false;
    const userEmail = user.email.trim().toLowerCase();
    return ADMIN_EMAILS.some(adminEmail => adminEmail.trim().toLowerCase() === userEmail);
  }, [user]);

  // --- LÓGICA DE STOCK ---
  const { getStockForProduct: getAdminStock, loading: stockLoading } = useStock(isAdmin);
  const { products: dbProducts, loading: productsLoading } = usePublicProducts();
  const { reservations } = useStockReservations(); 

  const sessionId = useMemo(() => {
    let id = sessionStorage.getItem('session_id');
    if (!id) {
        id = 'sess_' + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('session_id', id);
    }
    return id;
  }, []);

  const getStockForProduct = (productId: number, variantName?: string): number => {
    if (isAdmin) return getAdminStock(productId, variantName);
    const product = dbProducts.find(p => p.id === productId);
    let availableStock = product?.stock ?? 0;
    const reservedQuantity = reservations
        .filter(r => r.productId === productId && (!variantName || r.variantName === variantName))
        .reduce((sum, r) => sum + r.quantity, 0);

    availableStock -= reservedQuantity;
    return Math.max(0, availableStock);
  };

  const getMyReservedQuantity = (productId: number, variantName?: string): number => {
      return reservations
        .filter(r => 
            (r.sessionId === sessionId || (user?.uid && r['userId'] === user.uid)) && 
            r.productId === productId && 
            (!variantName || r.variantName === variantName)
        )
        .reduce((sum, r) => sum + r.quantity, 0);
  };

  // --- REDIRECT LOGIC FOR SHARED LINKS ---
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/p/') || path.startsWith('/product/')) {
        const id = path.split('/').pop();
        if (id && !isNaN(Number(id))) {
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
  }, [route, user, sessionId]);

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
                    
                    const tierMap: Record<UserTier, keyof typeof LOYALTY_TIERS> = { 'Bronze': 'BRONZE', 'Prata': 'SILVER', 'Ouro': 'GOLD' };
                    const ordersToAwardPoints = allUserOrders.filter(o => o.status === 'Entregue' && !o.pointsAwarded);
                    let missingPoints = 0;
                    const newHistoryItems: PointHistory[] = [];
                    if (ordersToAwardPoints.length > 0) {
                        const multiplier = LOYALTY_TIERS[tierMap[correctTier]].multiplier;
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
                        await batch.commit();
                    }
                }
                
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
                
                ordersUnsubscribe = db.collection("orders")
                    .where("userId", "==", firebaseUser.uid)
                    .onSnapshot((snap) => {
                        const fetchedOrders = snap.docs.map(doc => ({id: doc.id, ...doc.data() } as Order));
                        fetchedOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        setOrders(fetchedOrders);
                    }, (error) => {
                        console.error("Erro ao carregar encomendas:", error);
                        setOrders([]);
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
  }, [sessionId]);

  const toggleWishlist = async (productId: number) => {
    let newWishlist = wishlist.includes(productId) ? wishlist.filter(id => id !== productId) : [...wishlist, productId];
    setWishlist(newWishlist);
    localStorage.setItem('wishlist', JSON.stringify(newWishlist));
    if (user?.uid) {
        try { await db.collection("users").doc(user.uid).update({ wishlist: newWishlist }); }
        catch (error) { console.debug("Wishlist update restricted."); }
    }
  };

  const updateReservationInFirebase = async (productId: number, variantName: string | undefined | null, newQuantity: number): Promise<boolean> => {
      if (isAdmin) return true; 
      await new Promise(resolve => setTimeout(resolve, 200));

      try {
          const productQuery = await db.collection('products_public').where('id', '==', productId).limit(1).get();
          
          if (productQuery.empty) {
              const isDemoProduct = INITIAL_PRODUCTS.some(p => p.id === productId);
              if (isDemoProduct) {
                  console.warn("Produto de demonstração (não sincronizado) adicionado ao carrinho.");
                  return true;
              }
              console.error("Produto não encontrado na base de dados pública:", productId);
              alert("Erro: Este produto parece não estar sincronizado com o sistema. Por favor, tente recarregar a página ou contacte o suporte.");
              return false;
          }

          const productDoc = productQuery.docs[0];
          const productData = productDoc.data() as Product;
          const totalStock = productData.stock || 0;

          const activeReservationsSnap = await db.collection('stock_reservations')
              .where('productId', '==', productId)
              .get();

          let reservedByOthers = 0;
          let myCurrentResDoc: any = null;
          const now = Date.now();

          activeReservationsSnap.forEach(doc => {
              const data = doc.data();
              if (data.expiresAt <= now) return;
              const isMine = (data.sessionId === sessionId) || (user?.uid && data.userId === user.uid);
              if (isMine && data.variantName === (variantName || null)) {
                  myCurrentResDoc = doc; 
              } else {
                  reservedByOthers += data.quantity; 
              }
          });

          const availableForMe = totalStock - reservedByOthers;
          
          if (newQuantity > availableForMe) {
              if (availableForMe <= 0) {
                  alert("Lamentamos, mas este artigo acabou de esgotar ou está reservado por outro cliente.");
              } else {
                  alert(`Stock insuficiente! Restam apenas ${availableForMe} unidades disponíveis.`);
              }
              return false;
          }

          const batch = db.batch();
          if (newQuantity <= 0) {
              if (myCurrentResDoc) batch.delete(myCurrentResDoc.ref);
          } else {
              const resData: any = {
                  productId,
                  variantName: variantName || null,
                  quantity: newQuantity,
                  sessionId,
                  expiresAt: Date.now() + (15 * 60 * 1000)
              };
              if (user?.uid) resData.userId = user.uid;

              if (myCurrentResDoc) {
                  batch.update(myCurrentResDoc.ref, resData);
              } else {
                  const newRef = db.collection('stock_reservations').doc();
                  batch.set(newRef, resData);
              }
          }

          await batch.commit();
          return true;

      } catch (e) {
          console.error("Erro crítico na transação de reserva:", e);
          alert("Ocorreu um erro de comunicação com o servidor. Verifique a sua internet.");
          return false;
      }
  };

  const addToCart = async (product: Product, variant?: ProductVariant) => {
    if (processingProductIds.includes(product.id)) return;
    setProcessingProductIds(prev => [...prev, product.id]);
    
    try {
        const cartItemId = variant?.name ? `${product.id}-${variant.name}` : `${product.id}`;
        const existingItem = cartItems.find(item => item.cartItemId === cartItemId);
        const newQty = existingItem ? existingItem.quantity + 1 : 1;

        const success = await updateReservationInFirebase(product.id, variant?.name, newQty);
        if (!success) return;

        const reservedUntil = !isAdmin ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : undefined;

        setCartItems(prev => {
          const existing = prev.find(item => item.cartItemId === cartItemId);
          if (existing) {
            return prev.map(item => {
                if (item.cartItemId === cartItemId) {
                    return { ...item, quantity: newQty, reservedUntil: item.reservedUntil || reservedUntil };
                }
                return item;
            });
          }
          return [...prev, { ...product, price: variant?.price ?? product.price, selectedVariant: variant?.name, cartItemId, quantity: 1, reservedUntil }];
        });
        setIsCartOpen(true);
    } catch (err) {
        console.error("Erro inesperado no carrinho:", err);
    } finally {
        setProcessingProductIds(prev => prev.filter(id => id !== product.id));
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    const item = cartItems.find(i => i.cartItemId === cartItemId);
    setCartItems(prev => prev.filter(i => i.cartItemId !== cartItemId));
    if (item) {
        updateReservationInFirebase(item.id, item.selectedVariant, 0);
    }
  };

  const updateQuantity = async (cartItemId: string, delta: number) => {
    const itemToUpdate = cartItems.find(i => i.cartItemId === cartItemId);
    if (!itemToUpdate) return;
    const newQty = itemToUpdate.quantity + delta;

    if (newQty < itemToUpdate.quantity) {
        setCartItems(prev => {
            if (newQty < 1) return prev.filter(i => i.cartItemId !== cartItemId);
            return prev.map(item => item.cartItemId === cartItemId ? { ...item, quantity: newQty } : item);
        });
        updateReservationInFirebase(itemToUpdate.id, itemToUpdate.selectedVariant, newQty);
        return;
    }

    const success = await updateReservationInFirebase(itemToUpdate.id, itemToUpdate.selectedVariant, newQty);
    if (!success) return;

    setCartItems(prev =>
        prev.map(item =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: newQty }
            : item
        )
    );
  };

  const handleUpdateUser = (updatedData: Partial<User>) => {
    if (user?.uid) {
        db.collection("users").doc(user.uid).update(updatedData)
            .catch(err => console.error("Update failed:", err));
    }
  };

  const handleLogout = async () => {
    try { await auth.signOut(); setUser(null); window.location.hash = '/'; }
    catch (error) { console.error("Logout error", error); }
  };

  const handleCheckout = async (newOrder: Order): Promise<boolean> => {
      try {
          await db.collection("orders").doc(newOrder.id).set(newOrder);
          const reservationQuery = await db.collection('stock_reservations').where('sessionId', '==', sessionId).get();
          if (!reservationQuery.empty) {
            const batch = db.batch();
            reservationQuery.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }
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
    if (route === '#dashboard') {
        return <Dashboard user={user} isAdmin={isAdmin} />;
    }
    if (route === '#account') {
      if (!user) { setTimeout(() => { window.location.hash = '/'; setIsLoginOpen(true); }, 0); return null; }
      return <ClientArea user={user} orders={orders} onLogout={handleLogout} onUpdateUser={handleUpdateUser} wishlist={wishlist} onToggleWishlist={toggleWishlist} onAddToCart={addToCart} publicProducts={dbProducts} onOpenSupportChat={() => setIsAIChatOpen(true)} />;
    }
    if (route.startsWith('#product/')) {
        const id = parseInt(route.split('/')[1]);
        const product = dbProducts.find(p => p.id === id);
        if (product) return <ProductDetails product={product} allProducts={dbProducts} onAddToCart={addToCart} reviews={reviews} onAddReview={handleAddReview} currentUser={user} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} isProcessing={processingProductIds.includes(product.id)} />;
    }
    switch (route) {
        case '#about': return <About />;
        case '#contact': return <Contact />;
        case '#terms': return <Terms />;
        case '#privacy': return <Privacy />;
        case '#faq': return <FAQ />;
        case '#returns': return <Returns />;
        default: return <Home products={dbProducts} onAddToCart={addToCart} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} searchTerm={searchTerm} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} processingProductIds={processingProductIds} />;
    }
  };

  if (authLoading || productsLoading || (isAdmin && stockLoading)) {
      return (
          <div className="fixed inset-0 bg-white dark:bg-gray-900 flex flex-col items-center justify-center gap-4">
              <img src={LOGO_URL} alt={STORE_NAME} className="w-48 h-auto animate-pulse" />
              <Loader2 className="animate-spin text-primary" size={32} />
          </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Header 
        cartCount={cartCount} 
        onOpenCart={() => setIsCartOpen(true)} 
        onOpenMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
        user={user} 
        onOpenLogin={() => setIsLoginOpen(true)} 
        onLogout={handleLogout} 
        searchTerm={searchTerm} 
        onSearchChange={handleSearchChange} 
        onResetHome={handleResetHome}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 space-y-4 animate-fade-in-down shadow-lg relative z-50">
          <div className="relative">
             <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400" />
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <a href="#/" onClick={(e) => { e.preventDefault(); handleResetHome(); setIsMobileMenuOpen(false); }} className="block py-2 text-gray-600 dark:text-gray-300 font-medium hover:text-primary dark:hover:text-white">Início</a>
          <a href="#about" onClick={(e) => { e.preventDefault(); window.location.hash = 'about'; setIsMobileMenuOpen(false); }} className="block py-2 text-gray-600 dark:text-gray-300 font-medium hover:text-primary dark:hover:text-white">Sobre</a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); window.location.hash = 'contact'; setIsMobileMenuOpen(false); }} className="block py-2 text-gray-600 dark:text-gray-300 font-medium hover:text-primary dark:hover:text-white">Contato</a>
          
          {/* TOGGLE DARK MODE NO MENU MOBILE */}
          <button onClick={toggleTheme} className="flex items-center gap-3 w-full py-2 text-gray-600 dark:text-gray-300 font-medium hover:text-primary dark:hover:text-white">
             {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            {user ? (
                <button onClick={() => { window.location.hash = 'account'; setIsMobileMenuOpen(false); }} className="w-full text-left py-2 text-primary font-bold">A Minha Conta</button>
            ) : (
                <button onClick={() => { setIsLoginOpen(true); setIsMobileMenuOpen(false); }} className="w-full bg-secondary dark:bg-gray-700 text-white py-3 rounded-lg font-bold">Entrar / Registar</button>
            )}
          </div>
        </div>
      )}
      <main className="flex-grow w-full flex flex-col">{renderContent()}</main>
      
      <InstallPrompt /> 

      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800 mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 text-center md:text-left">
            <div className="flex flex-col items-center md:items-start"><div className="flex items-center gap-2 mb-4">{LOGO_URL ? <img src={LOGO_URL} alt={STORE_NAME} className="h-10 invert brightness-0" /> : <h3 className="text-xl font-bold text-white">{STORE_NAME}</h3>}</div><p className="text-sm max-w-[200px]">A sua loja de confiança para os melhores gadgets e eletrônicos do mercado nacional.</p></div>
            <div><h4 className="text-white font-bold mb-4">Links Úteis</h4><ul className="space-y-2 text-sm"><li><a href="#about" onClick={(e) => {e.preventDefault(); window.location.hash = 'about';}} className="hover:text-primary">Sobre Nós</a></li><li><a href="#terms" onClick={(e) => {e.preventDefault(); window.location.hash = 'terms';}} className="hover:text-primary">Termos</a></li><li><a href="#privacy" onClick={(e) => {e.preventDefault(); window.location.hash = 'privacy';}} className="hover:text-primary">Privacidade</a></li></ul></div>
            <div><h4 className="text-white font-bold mb-4">Atendimento</h4><ul className="space-y-2 text-sm"><li><a href="#contact" onClick={(e) => {e.preventDefault(); window.location.hash = 'contact';}} className="hover:text-primary">Fale Conosco</a></li><li><a href="#returns" onClick={(e) => {e.preventDefault(); window.location.hash = 'returns';}} className="hover:text-primary">Garantia</a></li><li><a href="#faq" onClick={(e) => {e.preventDefault(); window.location.hash = 'faq';}} className="hover:text-primary">Dúvidas</a></li></ul></div>
            <div className="flex flex-col items-center md:items-start">
                <h4 className="text-white font-bold mb-4">Pagamento Seguro</h4>
                <div className="flex gap-2 items-center flex-wrap justify-center md:justify-start">
                    {/* Payment Icons */}
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm"><img src="https://gestplus.pt/imgs/mbway.png" alt="MBWay" className="h-full w-full object-contain" /></div>
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm"><img src="https://tse2.mm.bing.net/th/id/OIP.pnNR_ET5AlZNDtMd2n1m5wHaHa?cb=ucfimg2&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3" alt="Multibanco" className="h-full w-full object-contain" /></div>
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm"><img src="https://tse1.mm.bing.net/th/id/OIP.ygZGQKeZ0aBwHS7e7wbJVgHaDA?cb=ucfimg2&ucfimg=1&rs=1&pid=ImgDetMain&o=7&rm=3" alt="Visa" className="h-full w-full object-contain" /></div>
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/200px-Mastercard-logo.svg.png" alt="Mastercard" className="h-full w-full object-contain" /></div>
                    <div className="bg-white p-0.5 rounded h-8 w-12 flex items-center justify-center shadow-sm"><img src="https://www.oservidor.pt/img/s/166.jpg" alt="Cobrança" className="h-full w-full object-contain" /></div>
                </div>
            </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-center md:justify-between items-center text-[10px] relative">
            <span className="opacity-50">&copy; {new Date().getFullYear()} Allshop Store.</span>
            
            {isAdmin && (
                <div className="md:absolute md:left-1/2 md:-translate-x-1/2 mt-2 md:mt-0">
                    <a 
                        href="#dashboard" 
                        onClick={(e) => { e.preventDefault(); window.location.hash = 'dashboard'; }} 
                        className="px-4 py-2 bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-all font-bold shadow-md"
                    >
                        Painel Admin
                    </a>
                </div>
            )}
        </div>
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cartItems={cartItems} onRemoveItem={removeFromCart} onUpdateQuantity={updateQuantity} total={cartTotal} onCheckout={handleCheckout} user={user} onOpenLogin={() => { setIsCartOpen(false); setIsLoginOpen(true); }} />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={(u) => { setUser(u); setIsLoginOpen(false); }} />
      {resetCode && <ResetPasswordModal oobCode={resetCode} onClose={() => setResetCode(null)} />}
      <AIChat products={dbProducts} isOpen={isAIChatOpen} onToggle={setIsAIChatOpen} userOrders={orders} />
    </div>
  );
};

export default App;
