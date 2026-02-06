
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
import { Product, CartItem, User, Order, Review, ProductVariant, UserTier, PointHistory, InventoryProduct, ProductStatus } from './types';
import { auth, db, firebase } from './services/firebaseConfig';
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
  
  const isAdmin = useMemo(() => {
    if (!user || !user.email) return false;
    const userEmail = user.email.trim().toLowerCase();
    return ADMIN_EMAILS.some(adminEmail => adminEmail.trim().toLowerCase() === userEmail);
  }, [user]);

  const { getStockForProduct: getAdminStock, loading: stockLoading } = useStock(isAdmin);
  const { products: dbProducts, loading: productsLoading } = usePublicProducts();

  const getStockForProduct = (productId: number, variantName?: string): number => {
    if (isAdmin) {
      return getAdminStock(productId, variantName);
    }
    
    const product = dbProducts.find(p => p.id === productId);
    if (!product) return 0;
    
    // For variants, we currently rely on the total product stock from the public collection.
    // This is a safe fallback that prevents overselling.
    return product.stock || 0;
  };

  const sessionId = useMemo(() => {
      let id = sessionStorage.getItem('as_session_id');
      if (!id) {
          id = 'sess_' + Math.random().toString(36).substring(2, 15);
          sessionStorage.setItem('as_session_id', id);
      }
      return id;
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/p/') || path.startsWith('/product/')) {
        const parts = path.split('/');
        const id = parts[parts.length - 1];
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
                    
                    const ordersToAwardPoints = allUserOrders.filter(o => o.status === 'Entregue' && !o.pointsAwarded);
                    let missingPoints = 0;
                    const newHistoryItems: PointHistory[] = [];

                    if (ordersToAwardPoints.length > 0) {
                        const tierMap: Record<UserTier, keyof typeof LOYALTY_TIERS> = {
                            'Bronze': 'BRONZE',
                            'Prata': 'SILVER',
                            'Ouro': 'GOLD'
                        };
                        const tierKey = tierMap[correctTier];
                        const multiplier = LOYALTY_TIERS[tierKey].multiplier;
                        
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
                console.error("Erro crítico na autenticação:", error);
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

  const addToCart = async (product: Product, variant?: ProductVariant) => {
    const currentAvailable = getStockForProduct(product.id, variant?.name);
    if (currentAvailable <= 0) {
        alert("Desculpe, este produto acabou de esgotar ou foi reservado!");
        return;
    }

    if (currentAvailable <= 2) {
        try {
            await db.collection('stock_reservations').add({
                productId: product.id,
                variantName: variant?.name || null,
                quantity: 1,
                sessionId,
                expiresAt: Date.now() + (15 * 60 * 1000)
            });
        } catch (e) { console.debug("Erro reserva temporária."); }
    }

    const cartItemId = variant?.name ? `${product.id}-${variant.name}` : `${product.id}`;
    const reservedUntil = currentAvailable <= 2 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : undefined;

    setCartItems(prev => {
      const existing = prev.find(item => item.cartItemId === cartItemId);
      if (existing) {
        if (existing.quantity + 1 > currentAvailable) {
            alert(`Apenas ${currentAvailable} unidades disponíveis.`);
            return prev;
        }
        return prev.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, price: variant?.price ?? product.price, selectedVariant: variant?.name, cartItemId, quantity: 1, reservedUntil }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = async (cartItemId: string) => {
    const item = cartItems.find(i => i.cartItemId === cartItemId);
    setCartItems(prev => prev.filter(i => i.cartItemId !== cartItemId));
    
    if (item && item.reservedUntil) {
        try {
            const snap = await db.collection('stock_reservations')
                .where('sessionId', '==', sessionId)
                .where('productId', '==', item.id)
                .get();
            const batch = db.batch();
            snap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (e) {}
    }
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCartItems(prev => 
      prev.map(item => {
        if (item.cartItemId === cartItemId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity < 1) return item;

          const stock = getStockForProduct(item.id, item.selectedVariant);
          if (newQuantity > stock) {
            alert(`Apenas ${stock} unidades disponíveis.`);
            return item;
          }
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };
  
  const handleCheckout = async (order: Order): Promise<boolean> => {
    try {
      await db.collection('orders').doc(order.id).set(order);

      const reservationQuery = await db.collection('stock_reservations').where('sessionId', '==', sessionId).get();
      if (!reservationQuery.empty) {
        const batch = db.batch();
        reservationQuery.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      
      setCartItems([]);
      await notifyNewOrder(order, order.shippingInfo.name);
      return true;
    } catch (error) {
      console.error("Erro no checkout:", error);
      if (error instanceof Error && error.message) {
        alert("Ocorreu um erro ao registar a sua encomenda:\n" + error.message);
      } else {
        alert("Ocorreu um erro ao registar a sua encomenda. Por favor, tente novamente.");
      }
      return false;
    }
  };

  const handleUpdateUser = (updatedData: Partial<User>) => {
    if (user?.uid) {
        db.collection('users').doc(user.uid).update(updatedData)
            .catch(err => console.error("Update failed:", err));
    }
  };
  
  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsLoginOpen(false);
  };
  
  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    setOrders([]);
    window.location.hash = '#/';
  };
  
  const handleAddReview = async (review: Review) => {
    try {
        await db.collection('reviews').doc(review.id).set(review);
        setReviews(prev => [review, ...prev]);
    } catch(err) {
        alert("Não foi possível adicionar a sua avaliação.");
    }
  };

  const cartTotal = useMemo(() => cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0), [cartItems]);
  
  const renderContent = () => {
    if (route.startsWith('#product/')) {
      const productId = parseInt(route.split('/')[1]);
      const product = dbProducts.find(p => p.id === productId);
      if (product) {
        return <ProductDetails 
          product={product} 
          allProducts={dbProducts}
          onAddToCart={addToCart}
          reviews={reviews}
          onAddReview={handleAddReview}
          currentUser={user}
          getStock={getStockForProduct}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
        />;
      }
    }
    
    switch (route) {
      case '#about': return <About />;
      case '#contact': return <Contact />;
      case '#terms': return <Terms />;
      case '#privacy': return <Privacy />;
      case '#faq': return <FAQ />;
      case '#returns': return <Returns />;
      case '#account':
        if (authLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" size={48} /></div>;
        if (user) return <ClientArea 
            user={user} 
            orders={orders} 
            onLogout={handleLogout} 
            onUpdateUser={handleUpdateUser}
            wishlist={wishlist}
            onToggleWishlist={toggleWishlist}
            onAddToCart={addToCart}
            publicProducts={dbProducts}
        />;
        return <Home products={dbProducts} onAddToCart={addToCart} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} searchTerm={searchTerm} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />;
      case '#dashboard':
        if (authLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" size={48} /></div>;
        if (isAdmin) return <Dashboard user={user} isAdmin={isAdmin} />;
        return <Home products={dbProducts} onAddToCart={addToCart} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} searchTerm={searchTerm} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />;
      default:
        return <Home products={dbProducts} onAddToCart={addToCart} getStock={getStockForProduct} wishlist={wishlist} onToggleWishlist={toggleWishlist} searchTerm={searchTerm} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />;
    }
  };

  if (authLoading || productsLoading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4">
        <img src={LOGO_URL} alt={STORE_NAME} className="w-48 h-auto animate-pulse" />
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        cartCount={cartItems.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onResetHome={() => {
            setSearchTerm('');
            setSelectedCategory('Todas');
            window.location.hash = '/';
        }}
      />
      <main className="flex-grow">
        {renderContent()}
      </main>
      
      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onRemoveItem={removeFromCart}
        onUpdateQuantity={updateQuantity}
        total={cartTotal}
        onCheckout={handleCheckout}
        user={user}
        onOpenLogin={() => {
            setIsCartOpen(false);
            setIsLoginOpen(true);
        }}
      />

      <AIChat products={dbProducts} />

      {isLoginOpen && <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={handleLoginSuccess} />}
      {resetCode && <ResetPasswordModal oobCode={resetCode} onClose={() => setResetCode(null)} />}
      
      <footer className="bg-gray-800 text-white mt-auto">
        <div className="container mx-auto px-4 py-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} {STORE_NAME}. Todos os direitos reservados.</p>
            <div className="flex justify-center gap-4 mt-4">
                <a href="#terms" className="hover:underline">Termos</a>
                <a href="#privacy" className="hover:underline">Privacidade</a>
                <a href="#faq" className="hover:underline">FAQ</a>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
