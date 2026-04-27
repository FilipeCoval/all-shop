
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Package, AlertCircle, 
  Plus, Search, Edit2, Trash2, X, Sparkles, Link as LinkIcon,
  History, ShoppingCart, User as UserIcon, MapPin, BarChart2, TicketPercent, ToggleLeft, ToggleRight, Save, Bell, Truck, Globe, FileText, CheckCircle, Copy, Bot, Send, Users, Eye, AlertTriangle, Camera, Zap, ZapOff, QrCode, Home, ArrowLeft, RefreshCw, ClipboardEdit, MinusCircle, Calendar, Info, Database, UploadCloud, Tag, Image as ImageIcon, AlignLeft, ListPlus, ArrowRight as ArrowRightIcon, Layers, Lock, Unlock, CalendarClock, Upload, Loader2, ChevronDown, ChevronRight, ShieldAlert, XCircle, Mail, ScanBarcode, ShieldCheck, ZoomIn, BrainCircuit, Wifi, WifiOff, ExternalLink, Key as KeyIcon, Coins, Combine, Printer, Headphones, Wallet, AtSign, Scale, Calculator, Store, Settings, Megaphone, Smartphone, Timer, Volume2, VolumeX, BellRing, Wand2, Star
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useStockReservations } from '../hooks/useStockReservations';
import { InventoryProduct, ProductStatus, CashbackStatus, SaleRecord, Order, Coupon, User as UserType, PointHistory, UserTier, ProductUnit, Product, OrderItem, SupportTicket, ProductVariant, StockReservation } from '../types';
import { extractSerialNumberFromImage, generateProductContent } from '../services/geminiService';
import { INITIAL_PRODUCTS, LOYALTY_TIERS, STORE_NAME } from '../constants';
import { db, storage, firebase } from '../services/firebaseConfig';
import ClientDetailsModal from './ClientDetailsModal';
import ProfitCalculatorModal from './ProfitCalculatorModal';

import BarcodeScanner from './BarcodeScanner';

import OrderDetailsModal from './OrderDetailsModal';
import KpiCard from './KpiCard';
import InventoryTab from './InventoryTab';
import CatalogTab from './CatalogTab';
import CatalogModal from './CatalogModal';
import OrdersTab from './OrdersTab';
import ManualOrderModal from './ManualOrderModal';
import OrderFulfillmentModal from './OrderFulfillmentModal';
import ReportsTab from './ReportsTab';
import { ImportsTab } from './ImportsTab';
import SupportTicketModal from './SupportTicketModal';
import AnalyticsModal from './AnalyticsModal';
import CategoriesTab from './CategoriesTab';
import { useStoreCategories } from '../hooks/useStoreCategories';

// --- HELPERS ---

// Extracted logic to limit rendering loop sizes and avoid crashes:
const getSafeItems = (items: any): (OrderItem | string)[] => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') return [items];
    return [];
};

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

// --- DASHBOARD COMPONENT ---
interface DashboardProps {
    user: UserType | null;
    isAdmin: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ user, isAdmin }) => {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useInventory(isAdmin);
  const { reservations } = useStockReservations();
  const { categories: storeCategories } = useStoreCategories();
  
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'coupons' | 'clients' | 'support' | 'marketing' | 'reports' | 'store_products' | 'imports' | 'catalog' | 'categories'>('inventory');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<InventoryProduct | null>(null);
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [showToast, setShowToast] = useState<Order | null>(null);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isOnlineDetailsOpen, setIsOnlineDetailsOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isFulfillmentModalOpen, setIsFulfillmentModalOpen] = useState(false);
  const [selectedOrderForFulfillment, setSelectedOrderForFulfillment] = useState<Order | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isCouponsLoading, setIsCouponsLoading] = useState(false);
  const [newCoupon, setNewCoupon] = useState<Coupon>({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0, validProductId: undefined });
  const [publicProductsList, setPublicProductsList] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'add_unit' | 'sell_unit' | 'tracking' | 'verify_product'>('search');
  const [modalUnits, setModalUnits] = useState<ProductUnit[]>([]);
  const [manualUnitCode, setManualUnitCode] = useState('');
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // AI Generation State
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  
  // Sound State
  const [isSoundEnabled, setIsSoundEnabled] = useState(user?.notificationsEnabled || false);

  useEffect(() => {
      if (user && user.notificationsEnabled !== undefined) {
          setIsSoundEnabled(user.notificationsEnabled);
      }
  }, [user?.notificationsEnabled]);

  const toggleSound = async () => {
      const newValue = !isSoundEnabled;
      setIsSoundEnabled(newValue);
      if (user) {
          try {
              await db.collection('users').doc(user.uid).update({
                  notificationsEnabled: newValue
              });
          } catch (e) {
              console.error("Erro ao guardar preferência de som:", e);
          }
      }
  };
  
  // Notification Modal Data Updated Type
  const [notificationModalData, setNotificationModalData] = useState<{
      productName: string; 
      productId: number;
      subject: string; 
      body: string; 
      bcc: string; 
      alertsToDelete: any[];
      targetUserIds: string[]; // Lista de IDs de utilizadores para push
  } | null>(null);

  const [copySuccess, setCopySuccess] = useState('');
  const [linkedOrderId, setLinkedOrderId] = useState<string>('');
  const [selectedOrderForSaleDetails, setSelectedOrderForSaleDetails] = useState<Order | null>(null);
  const [selectedUnitsForSale, setSelectedUnitsForSale] = useState<string[]>([]);
  const [manualUnitSelect, setManualUnitSelect] = useState('');
  const [orderMismatchWarning, setOrderMismatchWarning] = useState<string | null>(null);
  const [securityCheckPassed, setSecurityCheckPassed] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Marketing / Push Form State
  const [pushForm, setPushForm] = useState({ title: '', body: '', target: 'all', image: '' });
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Manual Order Modal State
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [detailsModalData, setDetailsModalData] = useState<{ title: string; data: any[]; columns: { header: string; accessor: string | ((item: any) => React.ReactNode); }[]; total: number } | null>(null);
  const [isPublicIdEditable, setIsPublicIdEditable] = useState(false);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [clientsSearchTerm, setClientsSearchTerm] = useState('');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generateQty, setGenerateQty] = useState(1);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  
  const [isCashbackManagerOpen, setIsCashbackManagerOpen] = useState(false);
  const [cashbackManagerFilter, setCashbackManagerFilter] = useState<'ALL' | 'PENDING'>('PENDING');
  const [expandedCashbackAccounts, setExpandedCashbackAccounts] = useState<string[]>([]);

  const [selectedUserDetails, setSelectedUserDetails] = useState<UserType | null>(null);
  const [isSyncingStock, setIsSyncingStock] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const [inventorySearchTerm, setInventorySearchTerm] = useState('');

  // Coupon Calculator State
  const [couponCalcOriginal, setCouponCalcOriginal] = useState('');
  const [couponCalcTarget, setCouponCalcTarget] = useState('');

  const couponCalcResult = useMemo(() => {
      const orig = parseFloat(couponCalcOriginal);
      const target = parseFloat(couponCalcTarget);
      if (isNaN(orig) || isNaN(target) || orig <= 0) return null;
      const diff = orig - target;
      if (diff <= 0) return { fixed: 0, percent: 0 };
      const percent = (diff / orig) * 100;
      return { fixed: diff, percent: percent };
  }, [couponCalcOriginal, couponCalcTarget]);

  const [formData, setFormData] = useState({
    name: '', description: '', category: '', publicProductId: '' as string, variant: '',
    purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', 
    quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', originalPrice: '', promoEndsAt: '',
    cashbackValue: '', cashbackStatus: 'NONE' as CashbackStatus, cashbackPlatform: '', cashbackAccount: '', cashbackExpectedDate: '',
    badges: [] as string[], newImageUrl: '', 
    images: [] as string[], features: [] as string[], newFeature: '', comingSoon: false,
    weight: '', specs: {} as Record<string, string | boolean>, newSpecKey: '', newSpecValue: ''
  });

  const selectedPublicProductVariants = useMemo(() => { if (!formData.publicProductId) return []; const prod = publicProductsList.find(p => p.id === Number(formData.publicProductId)); return prod?.variants || []; }, [formData.publicProductId, publicProductsList]);
  const [saleForm, setSaleForm] = useState({ quantity: '1', unitPrice: '', shippingCost: '', date: new Date().toISOString().split('T')[0], notes: '', supplierName: '', supplierOrderId: '' });
  const pendingOrders = useMemo(() => allOrders.filter(o => {
    const orderDate = new Date(o.date);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    const isExplicitlyPending = o.stockDeducted === false;
    const isOldButStuck = o.stockDeducted === undefined && 
                         ['Processamento', 'Pago'].includes(o.status) && 
                         orderDate > thirtyDaysAgo;
    
    return isExplicitlyPending || isOldButStuck;
  }), [allOrders]);
  
  const groupedCashback = useMemo(() => {
      const pendingItems = products.filter(p => p.cashbackValue > 0 && (cashbackManagerFilter === 'ALL' || p.cashbackStatus === cashbackManagerFilter));
      
      const groups: Record<string, { total: number, items: InventoryProduct[] }> = {};
      
      pendingItems.forEach(item => {
          const account = item.cashbackAccount || 'Sem Conta Definida';
          if (!groups[account]) groups[account] = { total: 0, items: [] };
          groups[account].items.push(item);
          groups[account].total += item.cashbackValue;
      });

      return groups;
  }, [products, cashbackManagerFilter]);


  const [editingStoreProduct, setEditingStoreProduct] = useState<Product | null>(null);





  // EFFECTS
  useEffect(() => { if (activeTab === 'support' && isAdmin) { setIsTicketsLoading(true); const unsubscribe = db.collection('support_tickets').orderBy('createdAt', 'desc').onSnapshot(snapshot => { setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket))); setIsTicketsLoading(false); }); return () => unsubscribe(); } }, [activeTab, isAdmin]);
  
  useEffect(() => { if (linkedOrderId) { const order = allOrders.find(o => o.id === linkedOrderId); setSelectedOrderForSaleDetails(order || null); if (selectedProductForSale && order) { const safeItems = getSafeItems(order.items); const isCompatible = safeItems.some(item => { if (typeof item === 'string') return false; const idMatch = item.productId === selectedProductForSale.publicProductId; if (!idMatch) return false; const inventoryHasVariant = !!selectedProductForSale.variant; const orderHasVariant = !!item.selectedVariant; if (inventoryHasVariant && orderHasVariant) return item.selectedVariant === selectedProductForSale.variant; if (!inventoryHasVariant && !orderHasVariant) return true; if (!inventoryHasVariant && orderHasVariant) return false; if (inventoryHasVariant && !orderHasVariant) return true; return false; }); if (!isCompatible) setOrderMismatchWarning("ATENÇÃO: Este produto NÃO consta na encomenda selecionada!"); else setOrderMismatchWarning(null); if (order) { const item = safeItems.find(i => typeof i !== 'string' && i.productId === selectedProductForSale.publicProductId) as OrderItem | undefined; if (item) { setSaleForm(prev => ({ ...prev, unitPrice: item.price.toString(), shippingCost: (order.total - (item.price * item.quantity)).toFixed(2) })); } } } } else { setSelectedOrderForSaleDetails(null); setOrderMismatchWarning(null); } }, [linkedOrderId, allOrders, selectedProductForSale]);
  
  // --- ORDER NOTIFICATION LISTENER ---
  useEffect(() => { 
      if(!isAdmin) return; 
      
      const mountTime = Date.now(); 
      const unsubscribe = db.collection('orders').orderBy('date', 'desc').limit(10).onSnapshot(snapshot => { 
          snapshot.docChanges().forEach(change => { 
              if (change.type === 'added') { 
                  const order = change.doc.data() as Order; 
                  // Só notifica encomendas criadas depois de abrir o dashboard (margem de 2s) e que não estejam Pendentes
                  if (new Date(order.date).getTime() > (mountTime - 2000) && order.status !== 'Pendente') { 
                      setNotifications(prev => [order, ...prev]); 
                      setShowToast(order); 
                      
                      // Tocar som se ativado
                      if (isSoundEnabled) {
                          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                          audio.volume = 1.0;
                          audio.play().catch(e => console.warn("Audio play blocked (user needs to interact first):", e));
                      }

                      setTimeout(() => setShowToast(null), 8000); 
                  } 
              } 
          }); 
      }); 

      return () => unsubscribe(); 
  }, [isAdmin, isSoundEnabled]);

  useEffect(() => { if (!isAdmin) return; const unsubscribe = db.collection('products_public').onSnapshot(snap => { const loadedProducts: Product[] = []; snap.forEach(doc => { const id = parseInt(doc.id, 10); const data = doc.data(); if (!isNaN(id)) loadedProducts.push({ ...data, id: data.id || id } as Product); }); setPublicProductsList(loadedProducts); }); return () => unsubscribe(); }, [isAdmin]);
  useEffect(() => { if(!isAdmin) return; const unsubscribe = db.collection('online_users').onSnapshot(snapshot => { const now = Date.now(); const activeUsers: any[] = []; snapshot.forEach(doc => { const data = doc.data(); if (data && typeof data.lastActive === 'number' && (now - data.lastActive < 30000)) { activeUsers.push({ id: doc.id, ...data }); } }); setOnlineUsers(activeUsers); }); return () => unsubscribe(); }, [isAdmin]);
  useEffect(() => { if(!isAdmin) return; const unsubscribe = db.collection('orders').orderBy('date', 'desc').onSnapshot(snapshot => { setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)).filter(o => o.status !== 'Pendente')); setIsOrdersLoading(false); }); return () => unsubscribe(); }, [isAdmin]);
  
  useEffect(() => { 
      // Carregar utilizadores sempre que precisarmos de dados para notificações ou gestão
      if (isAdmin) { 
          setIsUsersLoading(true); 
          const unsubscribeUsers = db.collection('users').onSnapshot(snapshot => { 
              setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserType))); 
              setIsUsersLoading(false); 
          }); 
          
          let unsubscribeCoupons = () => {};
          if(activeTab === 'coupons') {
              setIsCouponsLoading(true);
              unsubscribeCoupons = db.collection('coupons').onSnapshot(snapshot => { 
                  const allCoupons = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})) as Coupon[];
                  // Filtrar cupões de clientes (que têm userId) para mostrar apenas campanhas
                  const adminCoupons = allCoupons.filter(c => !c.userId);
                  setCoupons(adminCoupons); 
                  setIsCouponsLoading(false); 
              });
          }
          
          return () => { unsubscribeUsers(); unsubscribeCoupons(); };
      } 
  }, [activeTab, isAdmin]);
  
  useEffect(() => { if (!isAdmin) return; const unsubscribe = db.collection('stock_alerts').onSnapshot(snapshot => { const alerts: any[] = []; snapshot.forEach(doc => alerts.push({ id: doc.id, ...doc.data() })); setStockAlerts(alerts); }); return () => unsubscribe(); }, [isAdmin]);

  // HANDLERS
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); return true; };
  const handleCopy = (text: string) => { if (copyToClipboard(text)) { setCopySuccess('Copied'); setTimeout(() => setCopySuccess(''), 2000); } else alert("Não foi possível copiar."); };
  const handleCopyToClipboard = (text: string, type: string) => { if (copyToClipboard(text)) { setCopySuccess(type); setTimeout(() => setCopySuccess(''), 2000); } else alert("Não foi possível copiar."); };

  // ... (Manual Order & Push Functions remain the same) ...
  const handleManualOrderConfirm = async (order: Order, deductions: { batchId: string, quantity: number, saleRecord: SaleRecord }[]) => {
      try {
        await db.collection('orders').doc(order.id).set(order);
        for (const ded of deductions) {
            const product = products.find(p => p.id === ded.batchId);
            if (product) {
                const newSold = (product.quantitySold || 0) + ded.quantity;
                const status: ProductStatus = newSold >= product.quantityBought ? 'SOLD' : 'PARTIAL';
                await updateProduct(product.id, { quantitySold: newSold, status: status, salesHistory: [...(product.salesHistory || []), ded.saleRecord] });
            }
        }
        setIsManualOrderModalOpen(false);
        alert("Encomenda manual registada com sucesso!");
      } catch (error) { console.error("Erro ao criar encomenda manual:", error); alert("Erro ao processar a encomenda."); }
  };

  const handleSendPush = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!pushForm.title || !pushForm.body) return alert("Preencha título e mensagem.");
      setIsSendingPush(true); setPushResult(null);
      try {
          const response = await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pushForm) });
          const data = await response.json();
          if (response.ok && data.success) { 
              let msg = `Sucesso! Enviado para ${data.sentCount} dispositivos.`;
              if (data.failureCount > 0) msg += ` (${data.failureCount} falhas: ${data.failedTokens.join(', ')})`;
              setPushResult({ success: true, msg }); 
              setPushForm({ title: '', body: '', target: 'all', image: '' }); 
          } else { 
              setPushResult({ success: false, msg: data.error || data.details || 'Erro desconhecido ao enviar.' }); 
          }
      } catch (err) { console.error(err); setPushResult({ success: false, msg: 'Erro de comunicação com o servidor.' }); } finally { setIsSendingPush(false); }
  };

  const handleSendPushToWaitingList = async () => {
      if (!notificationModalData || notificationModalData.targetUserIds.length === 0) return;
      setIsSendingPush(true);
      try {
          const response = await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Produto Disponível! 📦', body: `${notificationModalData.productName} acabou de chegar ao stock! Compre antes que esgote.`, target: 'segment', userIds: notificationModalData.targetUserIds, link: `https://www.all-shop.net/#product/${notificationModalData.productId}` }) });
          const data = await response.json();
          if(data.success) { 
              let msg = `Enviado para ${data.sentCount} utilizadores interessados!`;
              if (data.failureCount > 0) msg += ` (${data.failureCount} falhas).`;
              alert(msg);
          } else { alert("Erro ao enviar: " + (data.error || 'Desconhecido')); }
      } catch (e) { alert("Erro de comunicação."); } finally { setIsSendingPush(false); }
  };

  // ... (Other handlers like stock alerts and product submit remain the same) ...
  const checkAndProcessStockAlerts = async (publicProductId: number | null, productName: string, newStock: number) => {
      if (!publicProductId) return;
      try {
          const snapshot = await db.collection('stock_alerts').where('productId', '==', publicProductId).get();
          if (snapshot.empty) { if (newStock === 999) alert("Não existem clientes na lista de espera para este produto."); return; }
          const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const emails = alerts.map((a: any) => a.email);
          const uniqueEmails = [...new Set(emails)];
          let targetUserIds: string[] = [];
          if (allUsers.length > 0) { targetUserIds = allUsers.filter(u => uniqueEmails.includes(u.email)).map(u => u.uid); } else { const limitEmails = uniqueEmails.slice(0, 10); if (limitEmails.length > 0) { const usersQuery = await db.collection('users').where('email', 'in', limitEmails).get(); usersQuery.forEach(doc => targetUserIds.push(doc.id)); } }
          const bccString = uniqueEmails.join(', ');
          setNotificationModalData({ productName: productName, productId: publicProductId, subject: `Chegou: ${productName} já disponível na All-Shop!`, body: `Olá,\n\nO produto que aguardava (${productName}) acabou de chegar ao nosso stock!\n\nPode comprar agora em: https://www.all-shop.net/#product/${publicProductId}\n\nObrigado,\nEquipa All-Shop`, bcc: bccString, alertsToDelete: alerts, targetUserIds: targetUserIds });
      } catch (error) { console.error("Erro ao processar alertas de stock:", error); }
  };

  const handleGenerateDescription = async () => {
      if (!formData.name || !formData.category) {
          alert("Preencha o Nome e Categoria primeiro.");
          return;
      }
      setIsGeneratingContent(true);
      const content = await generateProductContent(formData.name, formData.category);
      if (content) {
          setFormData(prev => ({
              ...prev,
              description: content.description,
              features: [...prev.features, ...content.features]
          }));
      } else {
          alert("Não foi possível gerar a descrição. Tente novamente.");
      }
      setIsGeneratingContent(false);
  };

  // Store Product Management Helpers


  const handleProductSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (selectedPublicProductVariants.length > 0 && !formData.variant) return alert("Selecione a variante."); 
      const qBought = Number(formData.quantityBought) || 0; 
      const existingProduct = products.find(p => p.id === editingId); 
      const currentSold = existingProduct ? existingProduct.quantitySold : 0; 
      const availableStock = Math.max(0, qBought - currentSold);
      const currentSalePrice = formData.salePrice ? Number(formData.salePrice) : 0; 
      let productStatus: ProductStatus = 'IN_STOCK'; 
      if (currentSold >= qBought && qBought > 0) productStatus = 'SOLD'; 
      else if (currentSold > 0) productStatus = 'PARTIAL'; 
      
      const payload: any = { name: formData.name, description: formData.description, category: formData.category, publicProductId: formData.publicProductId !== '' && formData.publicProductId !== null ? Number(formData.publicProductId) : null, variant: formData.variant || null, purchaseDate: formData.purchaseDate, supplierName: formData.supplierName, supplierOrderId: formData.supplierOrderId, quantityBought: qBought, quantitySold: currentSold, salesHistory: (existingProduct && Array.isArray(existingProduct.salesHistory)) ? existingProduct.salesHistory : [], purchasePrice: Number(formData.purchasePrice) || 0, targetSalePrice: formData.targetSalePrice ? Number(formData.targetSalePrice) : null, salePrice: currentSalePrice, originalPrice: formData.originalPrice ? Number(formData.originalPrice) : null, promoEndsAt: formData.promoEndsAt || null, cashbackValue: Number(formData.cashbackValue) || 0, cashbackStatus: formData.cashbackStatus, cashbackPlatform: formData.cashbackPlatform, cashbackAccount: formData.cashbackAccount, cashbackExpectedDate: formData.cashbackExpectedDate, units: modalUnits, status: productStatus, badges: formData.badges, images: formData.images, features: formData.features, comingSoon: formData.comingSoon, weight: formData.weight ? parseFloat(formData.weight) : 0, specs: formData.specs }; 
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]); 
      
      try { 
          if (editingId) {
              await updateProduct(editingId, payload);
          } else {
              await addProduct(payload); 
          }
          setIsModalOpen(false); 
          if (payload.publicProductId && availableStock > 0 && !payload.comingSoon) { await checkAndProcessStockAlerts(payload.publicProductId, payload.name, availableStock); }
      } catch (err) { alert('Erro ao guardar.'); } 
  };
  
  // Generic Helpers
  const toggleBadge = (badge: string) => { setFormData(prev => { const badges = prev.badges || []; if (badges.includes(badge)) return { ...prev, badges: badges.filter(b => b !== badge) }; else return { ...prev, badges: [...badges, badge] }; }); };
  const handleEdit = (product: InventoryProduct) => { 
    setEditingId(product.id); 
    setFormData({ 
        name: product.name, description: product.description || '', category: product.category, 
        publicProductId: product.publicProductId ? product.publicProductId.toString() : '', 
        variant: product.variant || '', purchaseDate: product.purchaseDate, 
        supplierName: product.supplierName || '', supplierOrderId: product.supplierOrderId || '', 
        quantityBought: product.quantityBought.toString(), purchasePrice: product.purchasePrice.toString(), 
        salePrice: product.salePrice ? product.salePrice.toString() : '', 
        targetSalePrice: product.targetSalePrice ? product.targetSalePrice.toString() : '', 
        originalPrice: product.originalPrice ? product.originalPrice.toString() : '', 
        promoEndsAt: product.promoEndsAt || '', cashbackValue: product.cashbackValue.toString(), 
        cashbackStatus: product.cashbackStatus, cashbackPlatform: product.cashbackPlatform || '', 
        cashbackAccount: product.cashbackAccount || '', cashbackExpectedDate: product.cashbackExpectedDate || '', 
        badges: product.badges || [], images: product.images || [], newImageUrl: '', 
        features: product.features || [], newFeature: '', comingSoon: product.comingSoon || false, 
        weight: product.weight ? product.weight.toString() : '', specs: product.specs || {}, 
        newSpecKey: '', newSpecValue: '' 
    }); 
    
    if (product.publicProductId) {
        const publicProd = publicProductsList.find(p => p.id === Number(product.publicProductId));
        if (publicProd) setEditingStoreProduct(publicProd);
        else setEditingStoreProduct(null);
    } else {
        setEditingStoreProduct(null);
    }

    setModalUnits(product.units || []); 
    setGeneratedCodes([]); 
    setIsPublicIdEditable(false); 
    setIsModalOpen(true); 
  };
  const handleAddNew = () => { setEditingId(null); setFormData({ name: '', description: '', category: 'TV Box', publicProductId: '', variant: '', purchaseDate: new Date().toISOString().split('T')[0], supplierName: '', supplierOrderId: '', quantityBought: '', purchasePrice: '', salePrice: '', targetSalePrice: '', originalPrice: '', promoEndsAt: '', cashbackValue: '', cashbackStatus: 'NONE', cashbackPlatform: '', cashbackAccount: '', cashbackExpectedDate: '', badges: [], images: [], newImageUrl: '', features: [], newFeature: '', comingSoon: false, weight: '', specs: {}, newSpecKey: '', newSpecValue: '' }); setModalUnits([]); setGeneratedCodes([]); setIsPublicIdEditable(false); setIsModalOpen(true); };
  const handleCreateVariant = (parentProduct: InventoryProduct) => { setEditingId(null); setFormData({ name: parentProduct.name, description: parentProduct.description || '', category: parentProduct.category, publicProductId: parentProduct.publicProductId ? parentProduct.publicProductId.toString() : '', variant: '', purchaseDate: new Date().toISOString().split('T')[0], supplierName: parentProduct.supplierName || '', supplierOrderId: '', quantityBought: '', purchasePrice: parentProduct.purchasePrice.toString(), salePrice: parentProduct.salePrice ? parentProduct.salePrice.toString() : '', targetSalePrice: parentProduct.targetSalePrice ? parentProduct.targetSalePrice.toString() : '', originalPrice: parentProduct.originalPrice ? parentProduct.originalPrice.toString() : '', promoEndsAt: parentProduct.promoEndsAt || '', cashbackValue: '', cashbackStatus: 'NONE', cashbackPlatform: '', cashbackAccount: '', cashbackExpectedDate: '', badges: parentProduct.badges || [], images: parentProduct.images || [], newImageUrl: '', features: parentProduct.features || [], newFeature: '', comingSoon: parentProduct.comingSoon || false, weight: parentProduct.weight ? parentProduct.weight.toString() : '', specs: parentProduct.specs || {}, newSpecKey: '', newSpecValue: '' }); setModalUnits([]); setGeneratedCodes([]); setIsPublicIdEditable(false); setIsModalOpen(true); };
  const handleDelete = async (id: string) => { if (!id) return; if (window.confirm('Apagar registo?')) { try { await deleteProduct(id); } catch (error: any) { alert("Erro: " + error.message); } } };
  const handleDeleteGroup = async (groupId: string, items: InventoryProduct[]) => { 
      if (!window.confirm(`Apagar grupo "${items[0].name}" e ${items.length} lotes?`)) return; 
      try { 
          const batch = db.batch(); 
          items.forEach(item => batch.delete(db.collection('products_inventory').doc(item.id))); 
          if (items[0].publicProductId) {
              const publicQuery = await db.collection('products_public').where('id', '==', Number(items[0].publicProductId)).limit(1).get();
              if (!publicQuery.empty) {
                  batch.delete(publicQuery.docs[0].ref);
              }
          }
          await batch.commit(); 
      } catch (e) { alert("Erro ao apagar grupo."); } 
  };
  const openSaleModal = (product: InventoryProduct) => { setSelectedProductForSale(product); setSaleForm({ quantity: '1', unitPrice: product.salePrice ? product.salePrice.toString() : product.targetSalePrice ? product.targetSalePrice.toString() : '', shippingCost: '', date: new Date().toISOString().split('T')[0], notes: '', supplierName: product.supplierName || '', supplierOrderId: product.supplierOrderId || '' }); setSelectedUnitsForSale([]); setLinkedOrderId(''); setSelectedOrderForSaleDetails(null); setOrderMismatchWarning(null); setSecurityCheckPassed(false); setVerificationCode(''); setIsSaleModalOpen(true); };
  const handleDeleteSale = async (saleId: string, isOnline: boolean = false) => { 
    if(!editingId || !window.confirm("Anular venda e repor stock?")) return; 
    
    try {
      await db.runTransaction(async (transaction) => {
        const productRef = db.collection('products_inventory').doc(editingId);
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists) throw new Error("Produto não encontrado.");
        
        const product = { id: productDoc.id, ...productDoc.data() } as InventoryProduct;
        let newSold = product.quantitySold || 0;
        let newHistory = product.salesHistory || [];
        let newUnits = [...(product.units || [])];
        let quantityToRestock = 0;

        if (!isOnline) {
          const sale = product.salesHistory?.find(s => s.id === saleId);
          if(!sale) throw new Error("Registo de venda manual não encontrado.");
          quantityToRestock = sale.quantity;
          newHistory = newHistory.filter(s => s.id !== saleId);
          
          if (sale.serialNumbers && sale.serialNumbers.length > 0) {
            newUnits = newUnits.map(u => sale.serialNumbers?.includes(u.id) ? { ...u, status: 'AVAILABLE' as const } : u);
          }
        } else {
          const orderRef = db.collection('orders').doc(saleId);
          const orderDoc = await transaction.get(orderRef);
          if (!orderDoc.exists) throw new Error("Encomenda não encontrada no sistema.");
          const order = { id: orderDoc.id, ...orderDoc.data() } as Order;
          
          const safeItems = getSafeItems(order.items);
          const relevantItems = safeItems.filter(item => 
            typeof item !== 'string' && 
            item.productId?.toString() === product.publicProductId?.toString() && 
            (!product.variant || item.selectedVariant === product.variant)
          ) as OrderItem[];

          quantityToRestock = relevantItems.reduce((acc, i) => acc + i.quantity, 0);
          
          const serialsToRevert: string[] = [];
          relevantItems.forEach(i => {
              if (i.serialNumbers) serialsToRevert.push(...i.serialNumbers);
              if (i.unitIds) serialsToRevert.push(...i.unitIds);
          });
          
          if (serialsToRevert.length > 0) {
            newUnits = newUnits.map(u => serialsToRevert.includes(u.id) ? { ...u, status: 'AVAILABLE' as const } : u);
          }

          transaction.update(orderRef, {
              status: 'Pago',
              stockDeducted: false,
              fulfilledAt: null,
              fulfilledBy: null,
              fulfillmentStatus: 'PENDING',
              serialNumbersUsed: [],
              pointsAwarded: false,
              items: order.items.map(item => {
                  if (typeof item === 'string') return item;
                  if (item.productId?.toString() === product.publicProductId?.toString() && (!product.variant || item.selectedVariant === product.variant)) {
                      return { ...item, serialNumbers: [], unitIds: [] };
                  }
                  return item;
              })
          });
        }

        newSold = Math.max(0, newSold - quantityToRestock);
        const newStatus = newSold >= (product.quantityBought || 0) ? 'SOLD' : newSold > 0 ? 'PARTIAL' : 'IN_STOCK'; 
        
        transaction.update(productRef, { 
          quantitySold: newSold, 
          salesHistory: newHistory, 
          status: newStatus as ProductStatus, 
          units: newUnits 
        });
      });
      
      alert("Venda anulada e stock reposto com sucesso!");
    } catch(e: any) { 
        console.error("Erro ao anular:", e);
        alert("Erro ao anular venda: " + e.message); 
    } 
  };
  const handleSaleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!selectedProductForSale) return; const qty = parseInt(saleForm.quantity) || 1; const price = parseFloat(saleForm.unitPrice) || 0; const shipping = parseFloat(saleForm.shippingCost) || 0; const newSale: SaleRecord = { id: `MANUAL-${Date.now()}`, date: saleForm.date, quantity: qty, unitPrice: price, shippingCost: shipping, notes: saleForm.notes, serialNumbers: selectedUnitsForSale };    try { 
        const currentSold = (selectedProductForSale.quantitySold || 0) + qty; 
        const status = currentSold >= selectedProductForSale.quantityBought ? 'SOLD' : 'PARTIAL'; 
        let updatedUnits = selectedProductForSale.units || []; 
        if (selectedUnitsForSale.length > 0) { 
            updatedUnits = updatedUnits.map(u => selectedUnitsForSale.includes(u.id) ? { ...u, status: 'SOLD' as const } : u); 
        } 
        await updateProduct(selectedProductForSale.id, { quantitySold: currentSold, salesHistory: [...(selectedProductForSale.salesHistory || []), newSale], status: status as ProductStatus, units: updatedUnits }); 
        if (linkedOrderId) { 
            const orderRef = db.collection('orders').doc(linkedOrderId); 
            const orderDoc = await orderRef.get(); 
            if (orderDoc.exists) { 
                const orderData = orderDoc.data() as Order; 
                const updatedItems = orderData.items.map((item: any) => { 
                    const isMatch = item.productId === selectedProductForSale.publicProductId && ((!item.selectedVariant && !selectedProductForSale.variant) || (item.selectedVariant === selectedProductForSale.variant)); 
                    if (isMatch && selectedUnitsForSale.length > 0) { 
                        const currentSn = item.serialNumbers || []; 
                        return { ...item, serialNumbers: [...new Set([...currentSn, ...selectedUnitsForSale])] }; 
                    } 
                    return item; 
                }); 
                const additionalCost = qty * (selectedProductForSale.purchasePrice || 0);
                const newTotalCost = (orderData.totalProductCost || 0) + additionalCost;
                await orderRef.update({ items: updatedItems, stockDeducted: true, totalProductCost: newTotalCost }); 
            } 
        } 
        setIsSaleModalOpen(false); 
        // Sincronização automática silenciosa
        setTimeout(() => handleSyncPublicStock(true), 1000);
    } catch(e) { 
        console.error(e); 
        alert("Erro ao registar venda."); 
    } 
  };
  
  // Other small handlers (rest of file remains)
  const handlePublicProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => { 
    const selectedId = e.target.value; 
    setFormData(prev => ({ ...prev, publicProductId: selectedId, variant: '' })); 
    if (selectedId) { 
        const publicProd = publicProductsList.find(p => p.id === Number(selectedId)); 
        if (publicProd) {
            setFormData(prev => ({ ...prev, publicProductId: selectedId, name: publicProd.name, category: publicProd.category })); 
            setEditingStoreProduct(publicProd);
        } else {
            setEditingStoreProduct(null);
        }
    } else {
        setEditingStoreProduct(null);
    }
  };
  const handleAddImage = () => { if (formData.newImageUrl && formData.newImageUrl.trim()) { setFormData(prev => ({ ...prev, images: [...prev.images, prev.newImageUrl.trim()], newImageUrl: '' })); } };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (!file) return; 

    console.log("Iniciando upload de imagem de inventário:", file.name);
    setIsUploading(true); 
    setUploadProgress(0); 

    const storageRef = storage.ref(`products/${Date.now()}_${file.name}`); 
    let uploadTask: firebase.storage.UploadTask;
    try {
      uploadTask = storageRef.put(file); 
    } catch (putError) {
      console.error("Erro ao iniciar put no storage:", putError);
      setIsUploading(false);
      setUploadProgress(null);
      alert("Erro ao iniciar o carregamento. Verifique as permissões.");
      return;
    }

    uploadTask.on('state_changed', 
      (snapshot) => { 
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; 
        setUploadProgress(progress); 
        console.log(`Upload progress (inventário): ${Math.round(progress)}%`);
      }, 
      (error) => { 
        console.error("Erro no upload de inventário:", error); 
        setIsUploading(false); 
        setUploadProgress(null); 
        alert("Erro ao carregar imagem. Tente novamente."); 
      }, 
      async () => { 
        try {
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL(); 
          console.log("Upload de inventário concluído:", downloadURL);
          setFormData(prev => {
              const updated = { ...prev, images: [...prev.images, downloadURL] };
              return updated;
          }); 
          setIsUploading(false); 
          setUploadProgress(null); 
          if (fileInputRef.current) fileInputRef.current.value = ''; 
        } catch (err) {
          console.error("Erro ao obter URL de download (inventário):", err);
          setIsUploading(false);
          setUploadProgress(null);
        }
      } 
    ); 
  };
  const handleRemoveImage = (indexToRemove: number) => { setFormData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== indexToRemove) })); };
  const handleMoveImage = (index: number, direction: 'left' | 'right') => { if ((direction === 'left' && index === 0) || (direction === 'right' && index === formData.images.length - 1)) return; const newImages = [...formData.images]; const targetIndex = direction === 'left' ? index - 1 : index + 1; [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]]; setFormData(prev => ({ ...prev, images: newImages })); };
  const handleAddFeature = () => { if (formData.newFeature && formData.newFeature.trim()) { setFormData(prev => ({ ...prev, features: [...prev.features, formData.newFeature.trim()], newFeature: '' })); } };
  const handleRemoveFeature = (indexToRemove: number) => { setFormData(prev => ({ ...prev, features: prev.features.filter((_, idx) => idx !== indexToRemove) })); };



  const handleAddSpec = () => {
    if (formData.newSpecKey && formData.newSpecValue) {
      setFormData(prev => ({
        ...prev,
        specs: { ...(prev.specs || {}), [prev.newSpecKey]: prev.newSpecValue },
        newSpecKey: '',
        newSpecValue: ''
      }));
    }
  };

  const handleRemoveSpec = (key: string) => {
    setFormData(prev => {
      const newSpecs = { ...(prev.specs || {}) };
      delete newSpecs[key];
      return { ...prev, specs: newSpecs };
    });
  };


  const handleSyncPublicStock = async (silent = false) => {
    if (products.length === 0) {
      if (!silent) alert("O inventário parece estar vazio ou ainda a carregar.");
      return;
    }
    if (!silent && !window.confirm("Isto irá recalcular o stock da loja pública.\n\nContinuar?")) return;
    
    setIsSyncingStock(true);
    try {
      const publicIds = [...new Set(products.map(p => p.publicProductId).filter(id => id !== undefined && id !== null))];
      
      for (const pid of publicIds) {
          const response = await fetch('/api/update-stock-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicProductId: Number(pid) })
          });
          if (!response.ok) console.warn("Failed to update stock for", pid);
      }
      
      if (!silent) alert("Stock sincronizado com sucesso!");
      
    } catch (err) {
      console.error("Erro ao sincronizar stock:", err);
      if (!silent) alert("Erro ao sincronizar stock.");
    } finally {
      setIsSyncingStock(false);
    }
  };
  const handleOrderStatusChange = async (orderId: string, newStatus: string) => { 
      try { 
          const orderRef = db.collection('orders').doc(orderId); 
          const orderDoc = await orderRef.get(); 
          if(!orderDoc.exists) return; 
          const currentOrder = orderDoc.data() as Order; 
          const updates: any = { 
              status: newStatus, 
              statusHistory: firebase.firestore.FieldValue.arrayUnion({ 
                  status: newStatus, 
                  date: new Date().toISOString(), 
                  notes: 'Estado alterado via Backoffice' 
              }) 
          }; 

          await db.runTransaction(async (transaction) => {
              // 1. Atribuir pontos se for entregue
              if (newStatus === 'Entregue' && !currentOrder.pointsAwarded && currentOrder.userId) { 
                  const userRef = db.collection('users').doc(currentOrder.userId); 
                  const userDoc = await transaction.get(userRef); 
                  if (userDoc.exists) { 
                      const userData = userDoc.data() as UserType; 
                      const tier = userData.tier || 'Bronze'; 
                      let multiplier = 1; 
                      if (tier === 'Prata') multiplier = LOYALTY_TIERS.SILVER.multiplier; 
                      if (tier === 'Ouro') multiplier = LOYALTY_TIERS.GOLD.multiplier; 
                      const pointsToAward = Math.floor(currentOrder.total * multiplier); 
                      if (pointsToAward > 0) { 
                          const newHistory: PointHistory = { 
                              id: `earn-${orderId}`, 
                              date: new Date().toISOString(), 
                              amount: pointsToAward, 
                              reason: `Compra #${orderId} (Nível ${tier})`, 
                              orderId: orderId 
                          }; 
                          transaction.update(userRef, { 
                              loyaltyPoints: (userData.loyaltyPoints || 0) + pointsToAward, 
                              pointsHistory: [newHistory, ...(userData.pointsHistory || [])] 
                          }); 
                          updates.pointsAwarded = true; 
                      } 
                  } 
              }

              // 2. Repor stock se for cancelada
              if (newStatus === 'Cancelado' && currentOrder.status !== 'Cancelado') {
                  for (const item of currentOrder.items) {
                      if (typeof item !== 'object' || item === null) continue;
                      const productQuery = await transaction.get(db.collection('products_public').where('id', '==', item.productId).limit(1));
                      if (!productQuery.empty) {
                          const productDoc = productQuery.docs[0];
                          const productData = productDoc.data() as Product;
                          
                          let updatedVariants = productData.variants;
                          if (item.selectedVariant && productData.variants) {
                              const vIndex = productData.variants.findIndex(v => v.name === item.selectedVariant);
                              if (vIndex !== -1) {
                                  updatedVariants = [...productData.variants];
                                  updatedVariants[vIndex] = {
                                      ...updatedVariants[vIndex],
                                      stock: (updatedVariants[vIndex].stock || 0) + item.quantity
                                  };
                              }
                          }
                          
                          const updateData: any = { stock: (productData.stock || 0) + item.quantity };
                          if (updatedVariants) updateData.variants = updatedVariants;
                          
                          transaction.update(productDoc.ref, Object.fromEntries(Object.entries(updateData).filter(([_,v]) => v !== undefined)));
                      }
                  }

                  // 3. Remover pontos se já tinham sido atribuídos
                  if (currentOrder.pointsAwarded && currentOrder.userId) {
                      const userRef = db.collection('users').doc(currentOrder.userId);
                      const userDoc = await transaction.get(userRef);
                      if (userDoc.exists) {
                          const userData = userDoc.data() as UserType;
                          const tier = userData.tier || 'Bronze';
                          let multiplier = 1;
                          if (tier === 'Prata') multiplier = LOYALTY_TIERS.SILVER.multiplier;
                          if (tier === 'Ouro') multiplier = LOYALTY_TIERS.GOLD.multiplier;
                          const pointsToRemove = Math.floor(currentOrder.total * multiplier);
                          
                          if (pointsToRemove > 0) {
                              const newHistory: PointHistory = {
                                  id: `refund-${orderId}`,
                                  date: new Date().toISOString(),
                                  amount: -pointsToRemove,
                                  reason: `Cancelamento da Compra #${orderId}`,
                                  orderId: orderId
                              };
                              transaction.update(userRef, {
                                  loyaltyPoints: Math.max(0, (userData.loyaltyPoints || 0) - pointsToRemove),
                                  pointsHistory: [newHistory, ...(userData.pointsHistory || [])]
                              });
                              updates.pointsAwarded = false;
                          }
                      }
                  }
              }

              transaction.update(orderRef, updates);
          });

          setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); 
          if (selectedOrderDetails?.id === orderId) { 
              setSelectedOrderDetails(prev => prev ? { ...prev, ...updates } : null); 
          } 
      } catch (error) { 
          console.error("Erro ao mudar estado:", error); 
          alert("Erro ao atualizar estado da encomenda."); 
      } 
  };
  const handleDeleteOrder = async (orderId: string) => { 
      if(!window.confirm("ATENÇÃO: Apagar a encomenda é irreversível. Deseja continuar?")) return; 
      try { 
          const orderRef = db.collection('orders').doc(orderId);
          const orderDoc = await orderRef.get();
          if (orderDoc.exists) {
              const orderData = orderDoc.data() as Order;
              if (orderData.status !== 'Cancelado' && orderData.fulfillmentStatus !== 'COMPLETED') {
                  await db.runTransaction(async (transaction) => {
                      for (const item of orderData.items) {
                          if (typeof item !== 'object' || item === null) continue;
                          const productQuery = await transaction.get(db.collection('products_public').where('id', '==', item.productId).limit(1));
                          if (!productQuery.empty) {
                              const productDoc = productQuery.docs[0];
                              const productData = productDoc.data() as Product;
                              
                              let updatedVariants = productData.variants;
                              if (item.selectedVariant && productData.variants) {
                                  const vIndex = productData.variants.findIndex(v => v.name === item.selectedVariant);
                                  if (vIndex !== -1) {
                                      updatedVariants = [...productData.variants];
                                      updatedVariants[vIndex] = {
                                          ...updatedVariants[vIndex],
                                          stock: (updatedVariants[vIndex].stock || 0) + item.quantity
                                      };
                                  }
                              }
                              
                              const updateData: any = { stock: (productData.stock || 0) + item.quantity };
                              if (updatedVariants) updateData.variants = updatedVariants;
                              
                              transaction.update(productDoc.ref, Object.fromEntries(Object.entries(updateData).filter(([_,v]) => v !== undefined)));
                          }
                      }

                      // Remover pontos se já tinham sido atribuídos
                      if (orderData.pointsAwarded && orderData.userId) {
                          const userRef = db.collection('users').doc(orderData.userId);
                          const userDoc = await transaction.get(userRef);
                          if (userDoc.exists) {
                              const userData = userDoc.data() as UserType;
                              const tier = userData.tier || 'Bronze';
                              let multiplier = 1;
                              if (tier === 'Prata') multiplier = LOYALTY_TIERS.SILVER.multiplier;
                              if (tier === 'Ouro') multiplier = LOYALTY_TIERS.GOLD.multiplier;
                              const pointsToRemove = Math.floor(orderData.total * multiplier);
                              
                              if (pointsToRemove > 0) {
                                  const newHistory: PointHistory = {
                                      id: `delete-${orderId}`,
                                      date: new Date().toISOString(),
                                      amount: -pointsToRemove,
                                      reason: `Remoção da Compra #${orderId}`,
                                      orderId: orderId
                                  };
                                  transaction.update(userRef, {
                                      loyaltyPoints: Math.max(0, (userData.loyaltyPoints || 0) - pointsToRemove),
                                      pointsHistory: [newHistory, ...(userData.pointsHistory || [])]
                                  });
                              }
                          }
                      }

                      transaction.delete(orderRef);
                  });
              } else {
                  await orderRef.delete();
              }
          }
          setAllOrders(prev => prev.filter(o => o.id !== orderId)); 
      } catch(e) { 
          alert("Erro ao apagar encomenda."); 
      } 
  };
  const handleUpdateTracking = async (orderId: string, tracking: string) => { try { await db.collection('orders').doc(orderId).update({ trackingNumber: tracking }); if (selectedOrderDetails) setSelectedOrderDetails({...selectedOrderDetails, trackingNumber: tracking}); } catch (e) { alert("Erro ao gravar rastreio"); } };
  const handleAddUnit = (code: string) => { if (modalUnits.some(u => u.id === code)) return alert("Este código já foi adicionado."); setModalUnits(prev => [...prev, { id: code, status: 'AVAILABLE', addedAt: new Date().toISOString() }]); };
  const handleRemoveUnit = (id: string) => setModalUnits(prev => prev.filter(u => u.id !== id));
  const handleGenerateCodes = () => { const newCodes: string[] = []; for(let i=0; i < generateQty; i++) { const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase(); newCodes.push(`INT-${randomPart}`); } setGeneratedCodes(prev => [...prev, ...newCodes]); if (isModalOpen) { const newUnits = newCodes.map(code => ({ id: code, status: 'AVAILABLE' as const, addedAt: new Date().toISOString() })); setModalUnits(prev => [...prev, ...newUnits]); } };
  const handleSelectUnitForSale = (code: string) => { if (!selectedProductForSale) return; const unit = selectedProductForSale.units?.find(u => u.id === code); if (!unit) return alert("Erro: Este S/N não pertence a este lote de produto."); if (unit.status !== 'AVAILABLE') return alert("Erro: Este S/N já foi vendido ou está reservado."); if (selectedUnitsForSale.includes(code)) return alert("Aviso: Este S/N já foi adicionado a esta venda."); setSelectedUnitsForSale(prev => [...prev, code]); setSecurityCheckPassed(true); };
  const handleVerifyProduct = (code: string) => { if (!selectedProductForSale) return; const cleanCode = code.trim().toUpperCase(); if (cleanCode === selectedProductForSale.publicProductId?.toString() || selectedProductForSale.units?.some(u => u.id.toUpperCase() === cleanCode)) { setSecurityCheckPassed(true); setVerificationCode(code); } else { alert(`Código ${code} NÃO corresponde a este produto! Verifique se pegou na caixa correta.`); setSecurityCheckPassed(false); } };
  
  const handleNotifySubscribers = (productId: number, productName: string, variantName?: string) => { /* ... */ };
  const handleClearSentAlerts = async () => { if (!notificationModalData) return; if (!window.confirm("Isto irá apagar os alertas da base de dados. Confirma que já enviou o email?")) return; try { const batch = db.batch(); notificationModalData.alertsToDelete.forEach(alert => { batch.delete(db.collection('stock_alerts').doc(alert.id)); }); await batch.commit(); setNotificationModalData(null); alert("Lista de espera limpa com sucesso!"); } catch(e) { alert("Erro ao limpar alertas."); } };
  
  const handleAddCoupon = async (e: React.FormEvent) => { 
      e.preventDefault();
      try {
          await db.collection('coupons').add(newCoupon);
          setNewCoupon({ code: '', type: 'PERCENTAGE', value: 10, minPurchase: 0, isActive: true, usageCount: 0, validProductId: undefined });
          alert("Cupão criado!");
      } catch(e) { alert("Erro ao criar cupão."); }
  };
  
  const handleToggleCoupon = async (coupon: Coupon) => { if(!coupon.id) return; try { await db.collection('coupons').doc(coupon.id).update({ isActive: !coupon.isActive }); } catch(e) { alert("Erro ao atualizar cupão."); } };
  const handleDeleteCoupon = async (id?: string) => { if (!id || !window.confirm("Apagar cupão permanentemente?")) return; try { await db.collection('coupons').doc(id).delete(); setCoupons(prevCoupons => prevCoupons.filter(coupon => coupon.id !== id)); } catch (e) { alert("Erro ao apagar o cupão."); console.error("Delete coupon error:", e); } };
  const handleOpenInvestedModal = () => { setDetailsModalData({ title: "Detalhe do Investimento", data: products.map(p => ({ id: p.id, name: p.name, qty: p.quantityBought, cost: (p.purchasePrice || 0), total: (p.purchasePrice || 0) * (p.quantityBought || 1) })).filter(i => i.total > 0).sort((a,b) => b.total - a.total), total: stats.totalInvested, columns: [{ header: "Produto", accessor: "name" }, { header: "Qtd. Comprada", accessor: "qty" }, { header: "Custo Unit.", accessor: (i) => formatCurrency(i.cost) }, { header: "Total", accessor: (i) => formatCurrency(i.total) }] }); };
  const handleOpenRevenueModal = () => { setDetailsModalData({ title: "Receita Realizada", data: products.flatMap(p => { const manualSales = (p.salesHistory || []).map(s => ({ id: s.id, name: p.name, date: s.date, qty: s.quantity, val: s.quantity * s.unitPrice })); const manualQty = manualSales.reduce((acc, s) => acc + s.qty, 0); const onlineQty = Math.max(0, (p.quantitySold || 0) - manualQty); const onlineSales = onlineQty > 0 ? [{ id: `online-${p.id}`, name: `${p.name} (Online)`, date: new Date().toISOString().split('T')[0], qty: onlineQty, val: onlineQty * (p.salePrice || 0) }] : []; return [...manualSales, ...onlineSales]; }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), total: stats.realizedRevenue, columns: [{ header: "Data", accessor: (i) => new Date(i.date).toLocaleDateString() }, { header: "Produto", accessor: "name" }, { header: "Qtd", accessor: "qty" }, { header: "Valor", accessor: (i) => formatCurrency(i.val) }] }); };
  const handleOpenProfitModal = () => { setDetailsModalData({ title: "Lucro Líquido por Produto", data: products.map(p => { const manualQty = (p.salesHistory || []).reduce((acc, s) => acc + (s.quantity || 0), 0); const onlineQty = Math.max(0, (p.quantitySold || 0) - manualQty); const revenue = (p.salesHistory || []).reduce((acc, s) => acc + ((s.quantity || 0) * (s.unitPrice || 0)), 0) + (onlineQty * (p.salePrice || 0)); const cogs = (p.quantitySold || 0) * (p.purchasePrice || 0); const cashback = p.cashbackStatus === 'RECEIVED' ? ((p.cashbackValue || 0) / (p.quantityBought || 1)) * (p.quantitySold || 0) : 0; return { id: p.id, name: p.name, profit: revenue - cogs + cashback }; }).filter(p => p.profit !== 0).sort((a,b) => b.profit - a.profit), total: stats.realizedProfit, columns: [{ header: "Produto", accessor: "name" }, { header: "Lucro", accessor: (i) => <span className={i.profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{formatCurrency(i.profit)}</span> }] }); };
  const handleOpenCashbackManager = () => { setIsCashbackManagerOpen(true); };
  
  // --- HANDLE PRINT LABELS COM BARCODE REAL ---
  const handlePrintLabels = () => {
    if (generatedCodes.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // HTML Template para impressão com JsBarcode
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir Etiquetas</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 10px; margin: 0; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
            .label { border: 1px dashed #ccc; padding: 10px; text-align: center; height: 100px; display: flex; flex-direction: column; justify-content: center; align-items: center; page-break-inside: avoid; }
            .barcode { width: 100%; max-height: 80px; }
            @media print { .no-print { display: none; } .label { border: none; } }
            .no-print { padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; margin-bottom: 20px; display: block; }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()">🖨️ Imprimir Agora</button>
          <div class="grid">
            ${generatedCodes.map(code => `
              <div class="label">
                <svg class="barcode" jsbarcode-format="CODE128" jsbarcode-value="${code}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold" jsbarcode-height="50" jsbarcode-width="2" jsbarcode-displayValue="true" jsbarcode-fontSize="14"></svg>
              </div>
            `).join('')}
          </div>
          <script>JsBarcode(".barcode").init();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const toggleCashbackAccount = (account: string) => { setExpandedCashbackAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]); };
  const handleMarkBatchReceived = async (itemsToUpdate: InventoryProduct[]) => { if(!window.confirm(`Marcar ${itemsToUpdate.length} itens como RECEBIDO?`)) return; try { const batch = db.batch(); itemsToUpdate.forEach(item => { const ref = db.collection('products_inventory').doc(item.id); batch.update(ref, { cashbackStatus: 'RECEIVED' }); }); await batch.commit(); alert("Cashback atualizado com sucesso!"); } catch(e) { alert("Erro ao atualizar cashback."); } };
  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => { try { await db.collection('support_tickets').doc(ticketId).update({ status: newStatus }); if(selectedTicket) setSelectedTicket({...selectedTicket, status: newStatus} as any); } catch (error) { alert("Erro ao atualizar ticket."); } };
  const handleDeleteTicket = async (ticketId: string) => { if(!window.confirm("Apagar ticket permanentemente?")) return; try { await db.collection('support_tickets').doc(ticketId).delete(); setSelectedTicket(null); } catch (error) { alert("Erro ao apagar."); } };

  const filteredClients = useMemo(() => { 
      // 1. Começar com os utilizadores registados
      const combinedClients: UserType[] = [...allUsers];
      const registeredEmails = new Set(allUsers.map(u => (u.email || '').toLowerCase().trim()));

      // 2. Procurar nas encomendas por clientes convidados (sem conta registada)
      const guestMap = new Map<string, UserType>();

      allOrders.forEach(order => {
          const email = (order.shippingInfo?.email || '').toLowerCase().trim();
          
          // Se este email NÃO pertence a um utilizador registado
          if (email && !registeredEmails.has(email)) {
              if (!guestMap.has(email)) {
                  // Criar um perfil de "Convidado" temporário
                  guestMap.set(email, {
                      uid: `guest-${email}`,
                      name: order.shippingInfo.name || 'Convidado',
                      email: email,
                      totalSpent: 0,
                      tier: 'Bronze', // Convidados são sempre Bronze
                      loyaltyPoints: 0,
                      isGuest: true // Flag para identificar visualmente
                  } as UserType);
              }

              // Atualizar totais do convidado
              const guest = guestMap.get(email)!;
              if (order.status !== 'Cancelado') {
                  guest.totalSpent = (guest.totalSpent || 0) + order.total;
              }
          }
      });

      // 3. Adicionar convidados à lista final
      combinedClients.push(...Array.from(guestMap.values()));

      // 4. Filtragem por pesquisa
      if (!clientsSearchTerm) return combinedClients;
      
      const lowerTerm = clientsSearchTerm.toLowerCase();
      return combinedClients.filter(u => 
          (u.name && u.name.toLowerCase().includes(lowerTerm)) || 
          (u.email && u.email.toLowerCase().includes(lowerTerm))
      ); 
  }, [allUsers, allOrders, clientsSearchTerm]);
  const stats = useMemo(() => { let totalInvested = 0, realizedRevenue = 0, realizedProfit = 0, pendingCashback = 0, potentialProfit = 0; products.forEach(p => { const invested = (p.purchasePrice || 0) * (p.quantityBought || 1); totalInvested += invested; let revenue = 0, totalShippingPaid = 0; const manualQtySold = (p.salesHistory || []).reduce((acc, sale) => acc + (sale.quantity || 0), 0); const onlineQtySold = Math.max(0, (p.quantitySold || 0) - manualQtySold); revenue = (p.salesHistory || []).reduce((acc, sale) => acc + ((sale.quantity || 0) * (sale.unitPrice || 0)), 0) + (onlineQtySold * (p.salePrice || 0)); totalShippingPaid = (p.salesHistory || []).reduce((acc, sale) => acc + (sale.shippingCost || 0), 0); realizedRevenue += revenue; const cogs = (p.quantitySold || 0) * (p.purchasePrice || 0); const profitFromSales = revenue - cogs - totalShippingPaid; const cashback = p.cashbackStatus === 'RECEIVED' ? ((p.cashbackValue || 0) / (p.quantityBought || 1)) * (p.quantitySold || 0) : 0; realizedProfit += profitFromSales + cashback; if (p.cashbackStatus === 'PENDING') { pendingCashback += (p.cashbackValue || 0); } const remainingStock = (p.quantityBought || 0) - (p.quantitySold || 0); if (remainingStock > 0 && p.targetSalePrice) { potentialProfit += ((p.targetSalePrice || 0) - (p.purchasePrice || 0)) * remainingStock; } }); return { totalInvested, realizedRevenue, realizedProfit, pendingCashback, potentialProfit }; }, [products]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 pb-20 animate-fade-in relative">
      {showToast && (
          <div className="fixed top-24 right-4 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-blue-100 dark:border-slate-700 p-4 z-[60] max-w-sm animate-slide-in-right flex items-start gap-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400"><CheckCircle size={24} /></div>
              <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Nova Encomenda!</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{showToast.shippingInfo?.name} acabou de comprar.</p>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1">{formatCurrency(showToast.total)}</p>
              </div>
              <button onClick={() => setShowToast(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18}/></button>
          </div>
      )}

      {/* Header, Tabs, etc are same as previous Dashboard.tsx */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm transition-colors duration-300">
        {/* ... (Header content) ... */}
        <div className="container mx-auto px-4 flex flex-col md:flex-row md:h-20 items-center justify-between gap-4 md:gap-0 py-4 md:py-0">
          <div className="flex items-center gap-3 w-full justify-between md:w-auto">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 dark:bg-indigo-500 p-2 rounded-lg text-white"><LayoutDashboard size={24} /></div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Backoffice</h1>
              </div>
              
              {/* TOGGLE SOUND & MOBILE MENU */}
              <div className="flex items-center gap-2">
                <button 
                    onClick={toggleSound} 
                    className={`p-2 rounded-full transition-colors relative ${isSoundEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                    title={isSoundEnabled ? "Silenciar notificações" : "Ativar som de encomendas"}
                >
                    {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>

                <div className="md:hidden relative">
                    <button onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full relative transition-colors"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{notifications.length}</span>}</button>
                </div>
                 <button onClick={() => window.location.hash = '/'} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full md:hidden" title="Voltar à Loja"><Home size={20} /></button>
              </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full flex-1 justify-end min-w-0">
            {/* TABS E RESTO DO HEADER MANTIDOS */}
            <div 
                className="w-full md:w-auto flex flex-row bg-gray-100 dark:bg-slate-800 p-1 pb-2 rounded-lg gap-1 overflow-x-auto transition-colors z-10"
                onWheel={(e) => {
                    if (e.currentTarget) {
                        e.currentTarget.scrollLeft += e.deltaY;
                    }
                }}
            >
                <button onClick={() => setActiveTab('catalog')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'catalog' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><Globe size={16} /> Catálogo</button>
                <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'inventory' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><Package size={16} /> Stock/Lotes</button>

                <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'orders' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><ShoppingCart size={16} /> Encomendas</button>
                <button onClick={() => setActiveTab('clients')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'clients' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><Users size={16} /> Clientes</button>
                <button onClick={() => setActiveTab('support')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'support' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><Headphones size={16} /> Suporte</button>
                <button onClick={() => setActiveTab('coupons')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'coupons' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><TicketPercent size={16} /> Cupões</button>
                <button onClick={() => setActiveTab('marketing')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'marketing' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><Megaphone size={16} /> Marketing</button>
                <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'reports' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><BarChart2 size={16} /> Relatórios</button>
                <button onClick={() => setActiveTab('imports')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'imports' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><Truck size={16} /> Importações</button>
                <button onClick={() => setActiveTab('categories')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'categories' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}><Layers size={16} /> Categorias</button>
            </div>
            
            {/* DESKTOP SOUND TOGGLE (Visible on Desktop) */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
                <button 
                    onClick={toggleSound} 
                    className={`p-2 rounded-full transition-colors relative ${isSoundEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                    title={isSoundEnabled ? "Silenciar Campainha" : "Ativar Campainha de Encomendas"}
                >
                    {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                
                <div className="relative"><button onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full relative transition-colors"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{notifications.length}</span>}</button></div>
                <button onClick={() => window.location.hash = '/'} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full" title="Voltar à Loja"><Home size={20} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* ... Tab Contents ... */}
        {activeTab === 'catalog' && (
            <CatalogTab 
                products={publicProductsList}
                onEdit={(product) => {
                    setEditingStoreProduct(product);
                    setIsCatalogModalOpen(true);
                }}
                onAddNew={() => {
                    setEditingStoreProduct({
                        id: Date.now(),
                        name: '',
                        category: '',
                        price: 0,
                        description: '',
                        stock: 0,
                        features: [],
                        images: [],
                        image: '',
                    });
                    setIsCatalogModalOpen(true);
                }}
                onDelete={async (id) => {
                    try {
                        const publicQuery = await db.collection('products_public').where('id', '==', id).limit(1).get();
                        if (!publicQuery.empty) {
                            await publicQuery.docs[0].ref.delete();
                        }
                        setPublicProductsList(prev => prev.filter(p => p.id !== id));
                    } catch (error) {
                        console.error("Erro ao apagar produto público:", error);
                        alert("Erro ao apagar produto.");
                    }
                }}
            />
        )}
        {activeTab === 'inventory' && (
            <InventoryTab 
                products={products} 
                catalogProducts={publicProductsList}
                pendingOrders={pendingOrders}
                reservations={reservations}
                stats={stats} 
                onlineUsersCount={onlineUsers.length} 
                stockAlerts={stockAlerts} 
                onEdit={handleEdit} 
                onEditProduct={(inventoryItem) => {
                    const prod = publicProductsList.find(p => p.id === inventoryItem.publicProductId);
                    if (prod) {
                        setEditingStoreProduct(prod);
                        setIsCatalogModalOpen(true);
                    } else {
                        alert('Este lote não está associado a um produto do catálogo. Associe-o primeiro editando o lote.');
                    }
                }}
                onCreateVariant={handleCreateVariant} 
                onDeleteGroup={handleDeleteGroup} 
                onSale={openSaleModal} 
                onDelete={handleDelete} 
                onSyncStock={handleSyncPublicStock} 
                isSyncingStock={isSyncingStock} 
                onOpenScanner={(mode) => { setScannerMode(mode); setIsScannerOpen(true); }} 
                onOpenCalculator={() => setIsCalculatorOpen(true)} 
                onAddNew={handleAddNew} 
                onOpenInvestedModal={handleOpenInvestedModal} 
                onOpenRevenueModal={handleOpenRevenueModal} 
                onOpenProfitModal={handleOpenProfitModal} 
                onOpenCashbackManager={handleOpenCashbackManager} 
                onOpenOnlineDetails={() => setIsAnalyticsModalOpen(true)} 
                onOpenStockAlerts={(p) => checkAndProcessStockAlerts(p.publicProductId || null, p.name, 999)} 
                copyToClipboard={copyToClipboard} 
                searchTerm={inventorySearchTerm} 
                onSearchChange={setInventorySearchTerm}

            />
        )}


        
        {activeTab === 'orders' && (
            <OrdersTab 
                orders={allOrders} 
                inventoryProducts={products} 
                isAdmin={isAdmin} 
                onStatusChange={handleOrderStatusChange} 
                onDeleteOrder={handleDeleteOrder} 
                onViewDetails={setSelectedOrderDetails} 
                onOpenManualOrder={() => setIsManualOrderModalOpen(true)}
                onOpenFulfillment={(order) => {
                    setSelectedOrderForFulfillment(order);
                    setIsFulfillmentModalOpen(true);
                }}
            />
        )}
        
        {activeTab === 'clients' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden animate-fade-in transition-colors">
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center"><h3 className="font-bold text-gray-800 dark:text-white">Gestão de Clientes ({filteredClients.length})</h3><div className="relative"><input type="text" placeholder="Pesquisar cliente..." value={clientsSearchTerm} onChange={e => setClientsSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/></div></div><div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead className="bg-gray-50 dark:bg-slate-700 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase"><tr><th className="px-6 py-4">Nome</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Total Gasto</th><th className="px-6 py-4">Nível</th><th className="px-6 py-4">AllPoints</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-sm">{filteredClients.map(client => (<tr key={client.uid} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">{client.name} {client.isGuest && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-600 text-gray-500 dark:text-gray-300 text-[10px] uppercase font-bold border border-gray-200 dark:border-slate-500">Convidado</span>}</td><td className="px-6 py-4 text-gray-600 dark:text-gray-300">{client.email}</td><td className="px-6 py-4 text-gray-900 dark:text-gray-100">{formatCurrency(client.totalSpent || 0)}</td><td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">{client.tier || 'Bronze'}</td><td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400">{client.loyaltyPoints || 0}</td><td className="px-6 py-4 text-right"><button onClick={() => setSelectedUserDetails(client)} className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline">Ver Detalhes</button></td></tr>))}</tbody></table></div>
            </div>
        )}

        {/* MARKETING TAB */}
        {activeTab === 'marketing' && (
            <div className="animate-fade-in space-y-8">
                {/* Stats Card */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-xl">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold flex items-center gap-3"><Megaphone size={32}/> Central de Campanhas</h2>
                        <p className="text-blue-100 max-w-lg">Envie notificações push para todos os seus clientes em segundos. Alcance todos os dispositivos (PC, iPhone, Android) onde o cliente tenha a app instalada.</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20 text-center min-w-[200px]">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-200 mb-1">Alcance Potencial</p>
                        <div className="text-4xl font-black">{allUsers.reduce((acc, u) => acc + (u.deviceTokens?.length || (u.fcmToken ? 1 : 0)), 0)}</div>
                        <p className="text-xs text-blue-200 mt-1">Dispositivos registados</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Formulário de Envio REAL */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><Send size={20} className="text-blue-600 dark:text-blue-400"/> Enviar Nova Notificação</h3>
                        
                        <form onSubmit={handleSendPush} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Título da Notificação</label>
                                <input 
                                    type="text" 
                                    required 
                                    placeholder="Ex: Promoção Relâmpago ⚡️" 
                                    value={pushForm.title}
                                    onChange={e => setPushForm({...pushForm, title: e.target.value})}
                                    className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Mensagem</label>
                                <textarea 
                                    required 
                                    rows={3}
                                    placeholder="Ex: Descontos até 50% em TV Boxes só hoje!" 
                                    value={pushForm.body}
                                    onChange={e => setPushForm({...pushForm, body: e.target.value})}
                                    className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="target" 
                                        value="all" 
                                        checked={pushForm.target === 'all'} 
                                        onChange={() => setPushForm({...pushForm, target: 'all'})}
                                        className="w-5 h-5 text-blue-600"
                                    />
                                    <div>
                                        <span className="font-bold text-gray-900 dark:text-white block">Enviar para TODOS</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Alcança todos os utilizadores com notificações ativas.</span>
                                    </div>
                                </label>
                            </div>

                            {pushResult && (
                                <div className={`p-4 rounded-xl flex items-start gap-3 ${pushResult.success ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                                    {pushResult.success ? <CheckCircle size={20} className="mt-0.5"/> : <AlertCircle size={20} className="mt-0.5"/>}
                                    <p className="text-sm font-medium">{pushResult.msg}</p>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={isSendingPush || !pushForm.title || !pushForm.body}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSendingPush ? <Loader2 className="animate-spin" size={20} /> : <><Smartphone size={20}/> Enviar Agora</>}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2"><Info size={18}/> Como funciona?</h4>
                            <p className="text-sm text-indigo-800 dark:text-indigo-400 leading-relaxed mb-4">
                                Esta funcionalidade usa uma API segura para comunicar com o Firebase. Quando clica em enviar:
                            </p>
                            <ol className="list-decimal pl-5 space-y-2 text-sm text-indigo-800 dark:text-indigo-400">
                                <li>O sistema recolhe todos os tokens de todos os utilizadores (PC, Android, iPhone).</li>
                                <li>Remove duplicados para não enviar 2x para o mesmo aparelho.</li>
                                <li>Envia a mensagem instantaneamente.</li>
                            </ol>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Sparkles size={18} className="text-yellow-500"/> Dicas de Conversão</h4>
                            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                                <li className="flex gap-2"><CheckCircle size={16} className="text-green-500 shrink-0"/> <strong>Seja breve:</strong> Títulos curtos funcionam melhor.</li>
                                <li className="flex gap-2"><CheckCircle size={16} className="text-green-500 shrink-0"/> <strong>Use Emojis:</strong> Aumentam a taxa de abertura. 🚀</li>
                                <li className="flex gap-2"><CheckCircle size={16} className="text-green-500 shrink-0"/> <strong>Call to Action:</strong> Diga o que fazer (ex: "Toque para ver").</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ... (Coupons, Support Tabs) ... */}

        {activeTab === 'coupons' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                {/* Create Coupon Card */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-fit space-y-6 transition-colors">
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Plus size={20} className="text-green-600 dark:text-green-400" /> Novo Cupão</h3>
                        <form onSubmit={handleAddCoupon} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Código</label>
                                <input type="text" required value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded uppercase font-bold tracking-wider bg-white dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="NATAL20" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Tipo</label>
                                    <select value={newCoupon.type} onChange={e => setNewCoupon({...newCoupon, type: e.target.value as any})} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                                        <option value="PERCENTAGE">Percentagem (%)</option>
                                        <option value="FIXED">Valor Fixo (€)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Valor</label>
                                    <input type="number" required min="1" value={newCoupon.value} onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Produto Específico (Opcional)</label>
                                <select 
                                    className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                                    value={newCoupon.validProductId || ''} 
                                    onChange={(e) => setNewCoupon({...newCoupon, validProductId: e.target.value ? Number(e.target.value) : undefined})}
                                >
                                    <option value="">-- Válido em Toda a Loja --</option>
                                    {publicProductsList.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Mínimo Compra (€)</label>
                                <input type="number" min="0" value={newCoupon.minPurchase} onChange={e => setNewCoupon({...newCoupon, minPurchase: Number(e.target.value)})} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                            </div>
                            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition-colors">Criar Cupão</button>
                        </form>
                    </div>

                    {/* Simple Coupon Calculator */}
                    <div className="pt-6 border-t border-gray-100 dark:border-slate-700">
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-3 flex items-center gap-2"><Calculator size={16} /> Calculadora de Promoção</h4>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <input type="number" placeholder="Preço Original" className="p-2 border border-gray-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white" value={couponCalcOriginal} onChange={e => setCouponCalcOriginal(e.target.value)} />
                            <input type="number" placeholder="Preço Final" className="p-2 border border-gray-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white" value={couponCalcTarget} onChange={e => setCouponCalcTarget(e.target.value)} />
                        </div>
                        {couponCalcResult && (
                            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded text-xs text-blue-800 dark:text-blue-300">
                                Para vender a <strong>{formatCurrency(parseFloat(couponCalcTarget))}</strong>, crie um cupão de:
                                <ul className="list-disc pl-4 mt-1 font-bold">
                                    <li>Valor Fixo: {formatCurrency(couponCalcResult.fixed)}</li>
                                    <li>Percentagem: {couponCalcResult.percent.toFixed(1)}%</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                    {isCouponsLoading ? <p className="text-gray-500 dark:text-gray-400">A carregar...</p> : coupons.map(c => {
                        const productRestriction = c.validProductId ? publicProductsList.find(p => p.id === c.validProductId)?.name : null;
                        return (
                            <div key={c.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border flex items-center justify-between transition-colors ${c.isActive ? 'border-gray-200 dark:border-slate-700' : 'border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 opacity-75'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-lg ${c.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}><TicketPercent size={24} /></div>
                                    <div>
                                        <h4 className="font-bold text-lg tracking-wider text-gray-900 dark:text-white">{c.code}</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{c.type === 'PERCENTAGE' ? `${c.value}% Desconto` : `${formatCurrency(c.value)} Desconto`}{c.minPurchase > 0 && ` (Min. ${formatCurrency(c.minPurchase)})`}</p>
                                        {productRestriction && <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mt-0.5">Exclusivo: {productRestriction}</p>}
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Usado {c.usageCount} vezes</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleToggleCoupon(c)} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${c.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                                        {c.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}{c.isActive ? 'Ativo' : 'Inativo'}
                                    </button>
                                    <button onClick={() => handleDeleteCoupon(c.id)} className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        );
                    })}
                    {coupons.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 mt-10">Não há cupões criados.</p>}
                </div>
            </div>
        )}

        {activeTab === 'reports' && (
            <ReportsTab orders={allOrders} inventoryProducts={products} />
        )}

        {activeTab === 'imports' && (
            <ImportsTab />
        )}

        {activeTab === 'categories' && (
            <CategoriesTab />
        )}

        {/* ... (Support Tab) ... */}
        {activeTab === 'support' && (
            <div className="space-y-6 animate-fade-in">
                {/* ... (Keep existing support content) ... */}
                <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Headphones className="text-indigo-600 dark:text-indigo-400"/> Tickets de Suporte</h3>
                    <div className="flex gap-2">
                        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-xs font-bold border border-red-100">Abertos: {tickets.filter(t => t.status === 'Aberto').length}</span>
                        <span className="bg-yellow-50 text-yellow-600 px-3 py-1 rounded-lg text-xs font-bold border border-yellow-100">Em Análise: {tickets.filter(t => t.status === 'Em Análise').length}</span>
                        <span className="bg-green-50 text-green-600 px-3 py-1 rounded-lg text-xs font-bold border border-green-100">Resolvidos: {tickets.filter(t => t.status === 'Resolvido').length}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase transition-colors">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Assunto</th>
                                    <th className="px-6 py-4">Categoria</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-sm transition-colors">
                                {isTicketsLoading ? (<tr><td colSpan={7} className="text-center py-8"><Loader2 className="animate-spin mx-auto text-indigo-500"/></td></tr>) : 
                                tickets.length === 0 ? (<tr><td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">Sem tickets de suporte.</td></tr>) :
                                tickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors" onClick={() => setSelectedTicket(ticket)}>
                                        <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-300">{ticket.id}</td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-900 dark:text-white">{ticket.customerName}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{ticket.customerEmail}</p>
                                        </td>
                                        <td className="px-6 py-4 truncate max-w-xs text-gray-700 dark:text-gray-300">{ticket.subject}</td>
                                        <td className="px-6 py-4"><span className="bg-gray-100 dark:bg-slate-600 px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-200">{ticket.category}</span></td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${ticket.status === 'Aberto' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : ticket.status === 'Em Análise' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline">Ver</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>
      
      {/* ... (Keep existing modals) ... */}
      <ProfitCalculatorModal isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      <ManualOrderModal isOpen={isManualOrderModalOpen} onClose={() => setIsManualOrderModalOpen(false)} publicProducts={publicProductsList} inventoryProducts={products} onConfirm={async (order, deductions) => { try { await db.collection('orders').doc(order.id).set(order); for (const ded of deductions) { const product = products.find(p => p.id === ded.batchId); if (product) { const newSold = (product.quantitySold || 0) + ded.quantity; const status: ProductStatus = newSold >= product.quantityBought ? 'SOLD' : 'PARTIAL'; await updateProduct(product.id, { quantitySold: newSold, status: status, salesHistory: [...(product.salesHistory || []), ded.saleRecord] }); } } setIsManualOrderModalOpen(false); alert("Encomenda manual registada com sucesso!"); setTimeout(() => handleSyncPublicStock(true), 1000); } catch (error) { console.error("Erro ao criar encomenda manual:", error); alert("Erro ao processar a encomenda."); } }} />
      {isFulfillmentModalOpen && selectedOrderForFulfillment && (
          <OrderFulfillmentModal 
              order={selectedOrderForFulfillment}
              inventoryProducts={products}
              onClose={() => setIsFulfillmentModalOpen(false)}
              onSuccess={() => {
                  setIsFulfillmentModalOpen(false);
                  alert("Encomenda expedida com sucesso!");
              }}
          />
      )}
      <OrderDetailsModal order={selectedOrderDetails} inventoryProducts={products} onClose={() => setSelectedOrderDetails(null)} onUpdateOrder={(id, u) => setAllOrders(prev => prev.map(o => o.id === id ? {...o, ...u} : o))} onUpdateTracking={handleUpdateTracking} onCopy={handleCopy} />
      
      {/* Catalog Modal */}
      <CatalogModal 
        isOpen={isCatalogModalOpen} 
        onClose={() => setIsCatalogModalOpen(false)} 
        product={editingStoreProduct} 
        onSave={async (updatedProduct) => {
          try {
            const cleanProduct = JSON.parse(JSON.stringify(updatedProduct));
            const id = Number(cleanProduct.id);
            // Ensure id is stored in the document data, as it's required for queries and loading
            cleanProduct.id = id;
            await db.collection('products_public').doc(id.toString()).set(cleanProduct, { merge: true });
            setPublicProductsList(prev => {
              const exists = prev.find(p => p.id === id);
              if (exists) return prev.map(p => p.id === id ? { ...updatedProduct, id } : p);
              return [...prev, { ...updatedProduct, id }];
            });
            setIsCatalogModalOpen(false);
          } catch (error) {
            console.error("Erro ao guardar produto no catálogo:", error);
            alert("Erro ao guardar produto.");
          }
        }} 
      />

      {isModalOpen && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transition-colors"><div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10 transition-colors"><h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">{editingId ? <Edit2 size={20} /> : <Plus size={20} />} {editingId ? 'Editar Lote / Produto' : 'Novo Lote de Stock'}</h2><button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400"><X size={24}/></button></div><div className="p-6"><form onSubmit={handleProductSubmit} className="space-y-6">        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30">
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase mb-4 flex items-center gap-2">
                <LinkIcon size={16} /> Passo 1: Ligar a Produto da Loja (Opcional)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Produto da Loja</label>
                    <select 
                        className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        value={formData.publicProductId} 
                        onChange={handlePublicProductSelect}
                    >
                        <option value="">-- Nenhum (Apenas Backoffice) --</option>
                        {publicProductsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Ao selecionar, o nome e categoria são preenchidos automaticamente.</p>
                </div>
                
                {selectedPublicProductVariants.length > 0 && (
                    <div className="animate-fade-in-down">
                        <label className="block text-xs font-bold text-gray-900 dark:text-white uppercase mb-1 bg-yellow-100 dark:bg-yellow-900/40 w-fit px-1 rounded">Passo 2: Escolha a Variante</label>
                        <select 
                            className="w-full p-3 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white dark:bg-slate-800 font-bold text-gray-900 dark:text-white"
                            value={formData.variant} 
                            onChange={(e) => setFormData({...formData, variant: e.target.value})}
                            required
                        >
                            <option value="">-- Selecione uma Opção --</option>
                            {selectedPublicProductVariants.map((v, idx) => <option key={idx} value={v.name}>{v.name}</option>)}
                        </select>
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 font-medium">⚠ Obrigatório: Este produto tem várias opções.</p>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800/30">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center gap-2">
                        <LinkIcon size={12}/> Ligação Manual (Avançado)
                    </label>
                    <button type="button" onClick={() => setIsPublicIdEditable(!isPublicIdEditable)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        {isPublicIdEditable ? <Unlock size={10}/> : <Lock size={10}/>} {isPublicIdEditable ? 'Bloquear' : 'Editar ID'}
                    </button>
                </div>
                <div className="flex gap-2 items-center">
                    <input 
                        type="text" 
                        value={formData.publicProductId} 
                        onChange={(e) => setFormData({...formData, publicProductId: e.target.value})} 
                        disabled={!isPublicIdEditable}
                        placeholder="ID numérico do produto público"
                        className={`w-full p-2 border rounded-lg text-sm font-mono ${isPublicIdEditable ? 'bg-white dark:bg-slate-800 border-blue-300 dark:border-blue-700 text-gray-900 dark:text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700'}`}
                    />
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 w-full">
                        Para agrupar variantes (ex: cores), use o mesmo ID Público em todos.
                    </div>
                </div>
            </div>
        </div> {!formData.publicProductId && (<div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4"><div>
      
      <div className="flex justify-between items-center mb-1">
          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><AlignLeft size={16} /> Descrição Completa</h4>
          <button 
            type="button" 
            onClick={handleGenerateDescription}
            disabled={isGeneratingContent}
            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors"
          >
              {isGeneratingContent ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>} Gerar com IA
          </button>
      </div>
      
      <textarea rows={4} className="w-full p-3 border border-gray-300 rounded-lg text-sm" placeholder="Descreva o produto com detalhes..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}/></div><div><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-2"><ImageIcon size={16} /> Galeria de Imagens</h4>{formData.images.length > 0 && (<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">{formData.images.map((img, idx) => (<div key={idx} className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col"><div className="aspect-square relative"><img src={img} alt={`Img ${idx}`} className="w-full h-full object-contain p-1" /><div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">{idx + 1}</div></div><div className="flex border-t border-gray-100 divide-x divide-gray-100"><button type="button" disabled={idx === 0} onClick={() => handleMoveImage(idx, 'left')} className="flex-1 p-1.5 hover:bg-gray-100 disabled:opacity-30 flex justify-center"><ArrowLeft size={14} /></button><button type="button" onClick={() => handleRemoveImage(idx)} className="flex-1 p-1.5 hover:bg-red-50 text-red-500 flex justify-center"><Trash2 size={14} /></button><button type="button" disabled={idx === formData.images.length - 1} onClick={() => handleMoveImage(idx, 'right')} className="flex-1 p-1.5 hover:bg-gray-100 disabled:opacity-30 flex justify-center"><ArrowRightIcon size={14} /></button></div></div>))}</div>)}    <div className="flex gap-2">
      <div className="relative flex-1">
        <input 
          type="url" 
          placeholder="Cole o link da imagem (ex: imgur.com/...)" 
          className="w-full p-3 border border-gray-300 rounded-lg text-sm pr-20" 
          value={formData.newImageUrl} 
          onChange={e => setFormData({...formData, newImageUrl: e.target.value})} 
        />
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()} 
          disabled={isUploading} 
          className="absolute right-1 top-1 bottom-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 rounded-md text-xs font-bold flex items-center gap-1 transition-colors" 
          title="Upload do PC"
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <span>Upload</span>
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange}/>
      </div>
      <button 
        type="button" 
        onClick={handleAddImage} 
        disabled={isUploading || !formData.newImageUrl?.trim()}
        className={`px-4 rounded-lg font-bold transition-colors ${isUploading || !formData.newImageUrl?.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
      >
        Adicionar Link
      </button>
    </div>
    <p className="text-[10px] text-gray-400 mt-1 italic">* O upload de ficheiros é automático após a seleção.</p>
{isUploading && uploadProgress !== null && (<div className="mt-2"><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div></div><p className="text-xs text-center text-gray-500 mt-1">A carregar... {Math.round(uploadProgress)}%</p></div>)}</div><div><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><ListPlus size={16} /> Destaques / Características Principais</h4>{formData.features.length > 0 && (<div className="space-y-2 mb-3">{formData.features.map((feat, idx) => (<div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200 text-sm"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div><span className="flex-1 text-gray-700">{feat}</span><button type="button" onClick={() => handleRemoveFeature(idx)} className="text-gray-400 hover:text-red-500"><X size={14} /></button></div>))}</div>)}<div className="flex gap-2"><input type="text" placeholder="Ex: Bateria de 24h, WiFi 6..." className="flex-1 p-3 border border-gray-300 rounded-lg text-sm" value={formData.newFeature} onChange={e => setFormData({...formData, newFeature: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}/><button type="button" onClick={handleAddFeature} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 rounded-lg font-bold transition-colors">+ Item</button></div></div>
<div className="mt-4">
    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-2"><Settings size={16} /> Especificações Técnicas (Comparador)</h4>
    {formData.specs && Object.keys(formData.specs).length > 0 && (
        <div className="space-y-2 mb-3">
            {Object.entries(formData.specs).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200 text-sm">
                    <span className="font-bold text-gray-600">{key}:</span>
                    <span className="flex-1 text-gray-800">{value.toString()}</span>
                    <button type="button" onClick={() => handleRemoveSpec(key)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                </div>
            ))}
        </div>
    )}
    <div className="flex gap-2">
        <input type="text" placeholder="Característica (Ex: RAM)" className="w-1/3 p-3 border border-gray-300 rounded-lg text-sm" value={formData.newSpecKey} onChange={e => setFormData({...formData, newSpecKey: e.target.value})} />
        <input type="text" placeholder="Valor (Ex: 8GB)" className="flex-1 p-3 border border-gray-300 rounded-lg text-sm" value={formData.newSpecValue} onChange={e => setFormData({...formData, newSpecValue: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSpec())} />
        <button type="button" onClick={handleAddSpec} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 rounded-lg font-bold transition-colors">+</button>
    </div>
</div>
</div>)} <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Lote</label><input required type="text" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label><select className="w-full p-3 border border-gray-300 rounded-lg" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}><option value="" disabled>Selecione uma categoria</option>{storeCategories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}</select></div></div> <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200"><div className="md:col-span-2"><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Globe size={16} /> Rastreabilidade do Fornecedor</h4><p className="text-[10px] text-gray-500 mb-3">Preencha para saber a origem deste produto em caso de garantia.</p></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Fornecedor (Ex: Temu)</label><input type="text" placeholder="Temu, AliExpress, Amazon..." className="w-full p-3 border border-gray-300 rounded-lg" value={formData.supplierName} onChange={e => setFormData({...formData, supplierName: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Encomenda Origem</label><input type="text" placeholder="Ex: PO-2023-9999" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.supplierOrderId} onChange={e => setFormData({...formData, supplierOrderId: e.target.value})} /></div></div> <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Compra</label><input required type="date" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd. Comprada</label><input required type="number" min="1" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.quantityBought} onChange={e => setFormData({...formData, quantityBought: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Compra (Unitário)</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input required type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} /></div></div></div> <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100"><h4 className="font-bold text-yellow-800 mb-3 text-sm flex items-center gap-2"><Wallet size={16}/> Detalhes do Cashback</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Total</label><input type="number" step="0.01" className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackValue} onChange={e => setFormData({...formData, cashbackValue: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label><select className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackStatus} onChange={e => setFormData({...formData, cashbackStatus: e.target.value as any})}><option value="NONE">Sem Cashback</option><option value="PENDING">Pendente</option><option value="RECEIVED">Recebido</option></select></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plataforma</label><input placeholder="Ex: Temu" type="text" className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackPlatform} onChange={e => setFormData({...formData, cashbackPlatform: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conta Usada</label><input placeholder="email@exemplo.com" type="text" className="w-full p-2 border border-yellow-200 rounded" value={formData.cashbackAccount} onChange={e => setFormData({...formData, cashbackAccount: e.target.value})} /></div></div><div className="mt-2"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Prevista (Opcional)</label><input type="date" className="w-full md:w-1/2 p-2 border border-yellow-200 rounded" value={formData.cashbackExpectedDate} onChange={e => setFormData({...formData, cashbackExpectedDate: e.target.value})} /></div></div> <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mb-4"><label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Variante / Opção (Opcional)</label><input type="text" placeholder="Ex: Azul, XL, 64GB" className="w-full p-3 border border-indigo-200 rounded-lg text-indigo-900 font-bold" value={formData.variant} onChange={e => setFormData({...formData, variant: e.target.value})} /><p className="text-[10px] text-indigo-600 mt-1">Preencha apenas se este produto for uma opção específica (ex: Cor ou Tamanho).</p></div> <div className="bg-green-50/50 p-5 rounded-xl border border-green-100"><h3 className="text-sm font-bold text-green-900 uppercase mb-4 flex items-center gap-2"><QrCode size={16} /> Unidades Individuais / Nº de Série</h3><div className="flex gap-2 mb-4"><button type="button" onClick={() => { setScannerMode('add_unit'); setIsScannerOpen(true); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"><Camera size={16}/> Escanear Unidade</button></div><div className="flex gap-2 items-center text-xs text-gray-500 mb-4"><span className="font-bold">OU</span><input value={manualUnitCode} onChange={e => setManualUnitCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if(manualUnitCode.trim()) handleAddUnit(manualUnitCode.trim()); setManualUnitCode(''); } }} type="text" placeholder="Inserir código manualmente" className="flex-1 p-2 border border-gray-300 rounded-lg" /><button type="button" onClick={() => { if(manualUnitCode.trim()) handleAddUnit(manualUnitCode.trim()); setManualUnitCode(''); }} className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"><Plus size={16} /></button></div><div><p className="text-xs font-bold text-gray-600 mb-2">{modalUnits.length} / {formData.quantityBought || 0} unidades registadas</p><div className="flex flex-wrap gap-2">{modalUnits.map(unit => <div key={unit.id} className="bg-white border border-gray-200 text-gray-700 text-xs font-mono px-2 py-1 rounded flex items-center gap-2"><span>{unit.id}</span><button type="button" onClick={() => handleRemoveUnit(unit.id)} className="text-red-400 hover:text-red-600"><X size={12} /></button></div>)}</div></div></div> <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 mt-4"><h4 className="text-sm font-bold text-gray-800 mb-3">Gerador de Etiquetas Internas</h4><p className="text-[10px] text-gray-500 mb-3">Use para produtos sem código de barras. Os códigos gerados são adicionados automaticamente a este lote.</p><div className="flex gap-2"><input type="number" min="1" value={generateQty} onChange={(e) => setGenerateQty(Number(e.target.value))} className="w-20 p-2 border border-gray-300 rounded-lg" /><button type="button" onClick={handleGenerateCodes} className="flex-1 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors">Gerar e Adicionar</button></div>{generatedCodes.length > 0 && (<div className="mt-4 pt-4 border-t border-gray-200"><div className="flex justify-between items-center mb-2"><h5 className="font-bold text-xs text-gray-600">{generatedCodes.length} Códigos na Fila de Impressão:</h5><button type="button" onClick={() => setGeneratedCodes([])} className="text-xs text-red-500 hover:underline">Limpar Fila</button></div><div className="max-h-24 overflow-y-auto bg-white p-2 rounded border border-gray-200 space-y-1">{generatedCodes.map(code => <p key={code} className="text-xs font-mono text-gray-800">{code}</p>)}</div><button type="button" onClick={handlePrintLabels} className="w-full mt-3 bg-indigo-500 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-600"><Printer size={16}/> Imprimir Etiquetas</button></div>)}</div> 
      {/* SEÇÃO DE PROMOÇÕES (NOVA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6 border-gray-100">
          <div>
              <label className="block text-xs font-bold text-green-700 uppercase mb-1 bg-green-50 w-fit px-1 rounded">Preço Venda (Loja)</label>
              <div className="relative"><span className="absolute left-3 top-3 text-green-600 font-bold">€</span><input type="number" step="0.01" className="w-full pl-8 p-3 border-2 border-green-400 rounded-lg font-bold text-green-800" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} placeholder="Valor Final" /></div>
              <p className="text-[10px] text-gray-500 mt-1">Este é o preço que aparecerá no site.</p>
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Original (Riscado)</label>
              <div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg text-gray-500" value={formData.originalPrice} onChange={e => setFormData({...formData, originalPrice: e.target.value})} placeholder="Ex: 49.90" /></div>
              <p className="text-[10px] text-gray-500 mt-1">Se preenchido, aparecerá riscado ao lado do preço de venda.</p>
          </div>
          <div className="md:col-span-2">
              <label className="block text-xs font-bold text-red-500 uppercase mb-1 flex items-center gap-1"><Timer size={14}/> Fim da Promoção (Countdown)</label>
              <input type="datetime-local" className="w-full p-3 border border-gray-300 rounded-lg" value={formData.promoEndsAt} onChange={e => setFormData({...formData, promoEndsAt: e.target.value})} />
              <p className="text-[10px] text-gray-500 mt-1">Define uma data para mostrar um contador decrescente na página do produto.</p>
          </div>
      </div>
      {/* (Fim Seção Promoções) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Alvo (Estimado)</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">€</span><input type="number" step="0.01" className="w-full pl-8 p-3 border border-gray-300 rounded-lg text-gray-500" value={formData.targetSalePrice} onChange={e => setFormData({...formData, targetSalePrice: e.target.value})} /></div></div></div> <div className="border-t pt-4 border-gray-100"><h4 className="font-bold text-gray-800 text-sm flex items-center gap-2 mb-3"><Scale size={16} /> Logística & Peso</h4><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Peso Unitário (kg)</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400 text-xs font-bold">KG</span><input type="number" step="0.001" className="w-full pl-10 p-3 border border-gray-300 rounded-lg" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} placeholder="Ex: 0.350" /></div><p className="text-[10px] text-gray-500 mt-1">Essencial para calcular portes de envio automáticos no futuro.</p></div></div> {editingId && (() => {
    const p = products.find(prod => prod.id === editingId);
    let history: any[] = [];
    if (p?.salesHistory && Array.isArray(p.salesHistory)) {
        history = p.salesHistory.map((s: any) => ({
            id: s.id,
            date: s.date,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            isOnline: false,
            source: 'Venda Manual / Baixa'
        }));
    }
    if (p?.publicProductId) {
        allOrders.forEach(order => {
            if (['Cancelado', 'Reclamação', 'Pendente'].includes(order.status)) return;
            const relevantItems = order.items.filter((item) => {
                if (typeof item === 'string') return false;
                const orderItem = item as OrderItem;
                return orderItem.productId?.toString() === p.publicProductId?.toString() && 
                       (!p.variant || orderItem.selectedVariant === p.variant);
            });
            if (relevantItems.length > 0) {
                const quantity = relevantItems.reduce((sum: number, item: any) => sum + ((item as OrderItem).quantity || 1), 0);
                const unitPrice = (relevantItems[0] as OrderItem).price || 0;
                history.push({
                    id: order.id,
                    date: order.date.split('T')[0],
                    quantity,
                    unitPrice,
                    isOnline: true,
                    orderStatus: order.status,
                    source: `Online (${order.id.slice(-5)})`
                });
            }
        });
    }
    history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="border-t pt-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><History size={20} /> Histórico de Vendas deste Lote</h3>
            {history.length > 0 ? (
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
                            <tr>
                                <th className="px-4 py-2">Data</th>
                                <th className="px-4 py-2">Origem</th>
                                <th className="px-4 py-2">Qtd</th>
                                <th className="px-4 py-2">Valor</th>
                                <th className="px-4 py-2 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {history.map((sale, idx) => (
                                <tr key={`${sale.id}-${idx}`}>
                                    <td className="px-4 py-2">{sale.date}</td>
                                    <td className="px-4 py-2 text-xs font-medium text-gray-600">{sale.source}</td>
                                    <td className="px-4 py-2 font-bold">{sale.quantity}</td>
                                    <td className="px-4 py-2">{formatCurrency(sale.unitPrice * sale.quantity)}</td>
                                    <td className="px-4 py-2 text-right">
                                        <button type="button" onClick={() => handleDeleteSale(sale.id, sale.isOnline)} className="text-red-500 hover:text-red-700 text-xs font-bold border border-red-200 px-2 py-1 rounded hover:bg-red-50">
                                            {sale.isOnline ? 'Anular Envio' : 'Anular'}
                                        </button>
                                        {sale.isOnline && (
                                            <div className="text-[10px] text-gray-400 mt-0.5">{sale.orderStatus}</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-500 text-sm italic">Nenhuma venda registada para este lote ainda.</p>
            )}
        </div>
    );
})()} <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">Cancelar</button><button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center gap-2"><Save size={20} /> Guardar Lote</button></div></form></div></div></div>)}
      {/* Sale Modal */}
      {isSaleModalOpen && selectedProductForSale && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transition-colors"><div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 transition-colors"><h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><DollarSign size={20} className="text-green-600 dark:text-green-400"/> Registar Venda / Baixa</h3><button onClick={() => setIsSaleModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={24}/></button></div><form onSubmit={handleSaleSubmit} className="p-6 space-y-6"><div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Produto</p><p className="font-bold text-gray-900 dark:text-white">{selectedProductForSale.name}</p><p className="text-xs text-blue-600 dark:text-blue-400">{selectedProductForSale.variant}</p></div><div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Passo 1: Encomenda Online (Obrigatório)</label><select required value={linkedOrderId} onChange={(e) => setLinkedOrderId(e.target.value)} className={`w-full p-2 border rounded-lg focus:ring-2 outline-none transition-colors dark:bg-slate-800 dark:text-white ${orderMismatchWarning ? 'border-red-300 focus:ring-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-slate-600 focus:ring-green-500'}`}><option value="">-- Selecione uma encomenda --</option>{pendingOrders.map(o => (<option key={o.id} value={o.id}>{o.id} - {o.shippingInfo?.name} ({formatCurrency(o.total)})</option>))}</select></div>{orderMismatchWarning && (<div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-400 p-4 rounded animate-shake flex items-start gap-2"><ShieldAlert size={20} className="shrink-0 mt-0.5" /><div><p className="font-bold text-sm">PRODUTO ERRADO!</p><p className="text-xs">{orderMismatchWarning}</p></div></div>)}{linkedOrderId && !orderMismatchWarning && (<div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 p-4 animate-fade-in-down space-y-4"><h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2 border-b border-blue-200 dark:border-blue-800/30 pb-2"><FileText size={14}/> Conferência de Valores</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Preço Venda (Real)</label><input type="number" step="0.01" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm font-bold text-gray-800 dark:text-white" value={saleForm.unitPrice} onChange={e => setSaleForm({...saleForm, unitPrice: e.target.value})}/></div><div><label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Portes Envio (Cliente)</label><input type="number" step="0.01" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-800 dark:text-white" value={saleForm.shippingCost} onChange={e => setSaleForm({...saleForm, shippingCost: e.target.value})}/></div></div><div className="border-t border-blue-200 dark:border-blue-800/30 pt-4"><h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2 mb-3"><ShieldCheck size={14}/> Verificação de Segurança</h4><div className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${securityCheckPassed ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>{securityCheckPassed ? (<><CheckCircle size={32} className="text-green-600 dark:text-green-400"/><div className="text-center"><p className="font-bold text-green-800 dark:text-green-300">Produto Confirmado!</p><p className="text-xs text-green-700 dark:text-green-400">Pode finalizar a venda.</p></div></>) : (<><div className="w-full flex gap-2"><button type="button" onClick={() => { setScannerMode('verify_product'); setIsScannerOpen(true); }} className="bg-gray-800 dark:bg-slate-700 text-white p-2 rounded-lg hover:bg-black dark:hover:bg-slate-600 transition-colors"><Camera size={20}/></button><input type="text" placeholder="Escanear produto para libertar..." className="flex-1 p-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-center font-mono uppercase focus:ring-2 focus:ring-red-500 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVerifyProduct((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}/></div><p className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1"><Lock size={12}/> Venda Bloqueada: Confirme o produto físico.</p></>)}</div></div></div>)}{selectedProductForSale.units && selectedProductForSale.units.length > 0 ? (<div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Selecionar Unidades (S/N) a vender</label><div className="flex gap-2 mb-2"><button type="button" onClick={() => { setScannerMode('sell_unit'); setIsScannerOpen(true); }} className="bg-gray-200 dark:bg-slate-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-white"><Camera size={14}/> Escanear S/N</button><select value={manualUnitSelect} onChange={(e) => { if(e.target.value) handleSelectUnitForSale(e.target.value); setManualUnitSelect(''); }} className="flex-1 p-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-white"><option value="">-- Selecionar Manualmente --</option>{selectedProductForSale.units.filter(u => u.status === 'AVAILABLE' && !selectedUnitsForSale.includes(u.id)).map(u => (<option key={u.id} value={u.id}>{u.id}</option>))}</select></div><div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">{selectedUnitsForSale.map(sn => (<div key={sn} className="bg-white dark:bg-slate-700 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-mono px-2 py-1 rounded flex items-center gap-1 shadow-sm">{sn} <button type="button" onClick={() => setSelectedUnitsForSale(prev => prev.filter(s => s !== sn))} className="text-red-400 hover:text-red-600"><X size={12}/></button></div>))}{selectedUnitsForSale.length === 0 && <span className="text-gray-400 text-xs italic">Nenhuma unidade selecionada.</span>}</div><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Quantidade será calculada com base nas unidades selecionadas.</p></div>) : (<div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Quantidade</label><input type="number" min="1" max={selectedProductForSale.quantityBought - selectedProductForSale.quantitySold} required value={saleForm.quantity} onChange={(e) => setSaleForm({...saleForm, quantity: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white" /></div>)}<button type="submit" disabled={!!orderMismatchWarning || !securityCheckPassed} className={`w-full font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors ${orderMismatchWarning || !securityCheckPassed ? 'bg-gray-400 dark:bg-slate-600 cursor-not-allowed text-gray-200 dark:text-gray-400' : 'bg-green-600 hover:bg-green-700 text-white'}`}>{!securityCheckPassed ? <Lock size={18}/> : <CheckCircle size={18}/>} {orderMismatchWarning ? 'Bloqueado: Produto Errado' : !securityCheckPassed ? 'Bloqueado: Verificação Pendente' : 'Confirmar Venda'}</button></form></div></div>)}
      {detailsModalData && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col transition-colors"><div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 transition-colors"><h3 className="text-xl font-bold text-gray-900 dark:text-white">{detailsModalData.title}</h3><button onClick={() => setDetailsModalData(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors"><X size={24}/></button></div><div className="flex-1 overflow-y-auto p-0"><table className="w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-slate-800 text-xs uppercase text-gray-500 dark:text-gray-400 sticky top-0 transition-colors"><tr>{detailsModalData.columns.map((col, idx) => <th key={idx} className="px-6 py-3">{col.header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-slate-800">{detailsModalData.data.map((item, rowIdx) => (<tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-gray-300">{detailsModalData.columns.map((col, colIdx) => (<td key={colIdx} className="px-6 py-3">{typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor]}</td>))}</tr>))}</tbody></table></div><div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 rounded-b-2xl flex justify-between items-center transition-colors"><span className="font-bold text-gray-500 dark:text-gray-400">TOTAL</span><span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(detailsModalData.total)}</span></div></div></div>)}
      {isScannerOpen && (<BarcodeScanner mode={(scannerMode === 'add_unit' || scannerMode === 'sell_unit' || scannerMode === 'verify_product') ? 'serial' : 'product'} onClose={() => setIsScannerOpen(false)} onCodeSubmit={(code) => { if (scannerMode === 'add_unit') { handleAddUnit(code); setIsScannerOpen(false); } else if (scannerMode === 'sell_unit') { handleSelectUnitForSale(code); setIsScannerOpen(false); } else if (scannerMode === 'search') { setInventorySearchTerm(code); setIsScannerOpen(false); } else if (scannerMode === 'verify_product') { handleVerifyProduct(code); setIsScannerOpen(false); }}} />)}
      
      {/* NOTIFICATION MODAL UPDATED */}
      {notificationModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transition-colors">
                <div className="bg-green-600 p-6 text-white flex justify-between items-center">
                    <h3 className="font-bold text-xl flex items-center gap-2"><Mail size={24}/> Notificar Clientes</h3>
                    <button onClick={() => setNotificationModalData(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={24}/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 transition-colors">
                        <div className="bg-white dark:bg-blue-800 p-2 rounded-full text-blue-600 dark:text-blue-300 shadow-sm"><Users size={20}/></div>
                        <div>
                            <p className="text-blue-900 dark:text-blue-300 font-bold">Interesse Detetado</p>
                            <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">Existem <strong>{notificationModalData.alertsToDelete.length} emails</strong> na lista de espera. Destes, <strong>{notificationModalData.targetUserIds.length}</strong> têm a app instalada e podem receber notificação Push.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-bold text-gray-800 dark:text-white text-sm uppercase flex items-center gap-2"><Smartphone size={16}/> Opção 1: Notificação Push (Recomendado)</h4>
                        <button 
                            onClick={handleSendPushToWaitingList}
                            disabled={isSendingPush || notificationModalData.targetUserIds.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSendingPush ? <Loader2 className="animate-spin" size={20}/> : <Send size={18} />}
                            {notificationModalData.targetUserIds.length > 0 
                                ? `Enviar para ${notificationModalData.targetUserIds.length} Clientes` 
                                : 'Nenhum cliente com app instalada'}
                        </button>
                    </div>

                    <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-3">
                        <h4 className="font-bold text-gray-800 dark:text-white text-sm uppercase flex items-center gap-2"><Mail size={16}/> Opção 2: Email Manual (Backup)</h4>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-3 rounded text-xs text-yellow-800 dark:text-yellow-300 mb-2 transition-colors">Copie os dados abaixo e envie do seu email.</div>
                        <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Emails (BCC)</label><div className="flex gap-2"><input readOnly value={notificationModalData.bcc} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-xs text-gray-900 dark:text-white" /><button onClick={() => handleCopyToClipboard(notificationModalData.bcc, 'emails')} className="bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 p-2 rounded text-gray-700 dark:text-gray-300 font-bold text-xs transition-colors">{copySuccess === 'emails' ? 'Copiado!' : 'Copiar'}</button></div></div>
                        <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Assunto</label><div className="flex gap-2"><input readOnly value={notificationModalData.subject} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-xs text-gray-900 dark:text-white" /><button onClick={() => handleCopyToClipboard(notificationModalData.subject, 'subject')} className="bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 p-2 rounded text-gray-700 dark:text-gray-300 font-bold text-xs transition-colors">{copySuccess === 'subject' ? 'Copiado!' : 'Copiar'}</button></div></div>
                        <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Mensagem</label><div className="flex gap-2 items-start"><textarea readOnly value={notificationModalData.body} className="w-full h-24 p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-xs resize-none text-gray-900 dark:text-white" /><button onClick={() => handleCopyToClipboard(notificationModalData.body, 'body')} className="bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 p-2 rounded text-gray-700 dark:text-gray-300 font-bold text-xs h-full transition-colors">{copySuccess === 'body' ? 'Copiado!' : 'Copiar'}</button></div></div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
                        <button onClick={() => setNotificationModalData(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancelar</button>
                        <button onClick={handleClearSentAlerts} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2 transition-colors"><CheckCircle size={18} /> Limpar Lista de Espera</button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {isCashbackManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transition-colors">
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2"><Wallet size={20} className="text-yellow-600 dark:text-yellow-400"/> Gestor Financeiro de Cashback</h3>
                    <button onClick={() => setIsCashbackManagerOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-slate-950 transition-colors">
                    <div className="flex gap-2 mb-6">
                        <button onClick={() => setCashbackManagerFilter('PENDING')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${cashbackManagerFilter === 'PENDING' ? 'bg-yellow-500 text-white shadow' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700'}`}>A Receber</button>
                        <button onClick={() => setCashbackManagerFilter('ALL')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${cashbackManagerFilter === 'ALL' ? 'bg-gray-800 dark:bg-slate-700 text-white shadow' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700'}`}>Histórico Completo</button>
                    </div>
                    <div className="space-y-4">
                        {(Object.entries(groupedCashback) as [string, { total: number, items: InventoryProduct[] }][]).map(([account, data]) => {
                            const isExpanded = expandedCashbackAccounts.includes(account);
                            return (
                                <div key={account} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors">
                                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => toggleCashbackAccount(account)}>
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-full text-blue-600 dark:text-blue-400"><AtSign size={20} /></div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">{account}</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{data.items[0]?.cashbackPlatform || 'Plataforma Desconhecida'} • {data.items.length} itens</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(data.total)}</span>
                                            {isExpanded ? <ChevronDown size={20} className="text-gray-400"/> : <ChevronRight size={20} className="text-gray-400"/>}
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50 p-4 transition-colors">
                                            <table className="w-full text-left text-sm mb-4">
                                                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-slate-800">
                                                    <tr>
                                                        <th className="p-2 rounded-l">Produto</th>
                                                        <th className="p-2">Data Compra</th>
                                                        <th className="p-2">Previsão</th>
                                                        <th className="p-2">Valor</th>
                                                        <th className="p-2 rounded-r">Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                                                    {data.items.map(item => (
                                                        <tr key={item.id} className="hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{item.name} <span className="text-xs text-gray-500 dark:text-gray-400 block">{item.variant}</span></td>
                                                            <td className="py-2 text-gray-500 dark:text-gray-400 text-xs">{new Date(item.purchaseDate).toLocaleDateString()}</td>
                                                            <td className="py-2 text-gray-500 dark:text-gray-400 text-xs font-bold">{item.cashbackExpectedDate ? new Date(item.cashbackExpectedDate).toLocaleDateString() : '-'}</td>
                                                            <td className="py-2 font-bold text-gray-900 dark:text-white">{formatCurrency(item.cashbackValue)}</td>
                                                            <td className="py-2">
                                                                <span className={`text-[10px] px-2 py-1 rounded font-bold ${item.cashbackStatus === 'RECEIVED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'}`}>
                                                                    {item.cashbackStatus === 'RECEIVED' ? 'Recebido' : 'Pendente'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {cashbackManagerFilter === 'PENDING' && (
                                                <div className="flex justify-end">
                                                    <button onClick={() => handleMarkBatchReceived(data.items)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors">
                                                        <CheckCircle size={16}/> Marcar {formatCurrency(data.total)} como Recebido
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {Object.keys(groupedCashback).length === 0 && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Nenhum registo de cashback encontrado.</div>}
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {selectedTicket && user && (
          <SupportTicketModal 
              ticket={selectedTicket} 
              user={user} 
              variant="admin"
              onClose={() => setSelectedTicket(null)} 
          />
      )}

      <AnalyticsModal isOpen={isAnalyticsModalOpen} onClose={() => setIsAnalyticsModalOpen(false)} />



      {selectedUserDetails && (
        <ClientDetailsModal 
            user={selectedUserDetails}
            orders={allOrders}
            onClose={() => setSelectedUserDetails(null)}
            onUpdateUser={(userId, data) => {
                setAllUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...data } : u));
                setSelectedUserDetails(prev => prev ? { ...prev, ...data } : null);
            }}
        />
      )}
    </div>
  );
};

export default Dashboard;
