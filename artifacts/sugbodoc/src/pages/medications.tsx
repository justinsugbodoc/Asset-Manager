import { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/layout/app-shell';
import { 
  Search, ShoppingBag, Pill, Plus, Minus, Store, Truck, 
  MapPin, CheckCircle2, Clock, Activity, X, AlertCircle, ArrowRight,
  LockKeyhole
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  calculateInsuranceEstimate,
  createOrUpdateClaim,
} from '@/lib/insurance';
import {
  LEGACY_MEDICATION_ORDER_STORAGE_KEY,
  PHARMACY_ORDER_STORAGE_KEY,
  type AdminMedication,
} from '@/lib/admin';
import { getLatestPatientEncounter } from '@/lib/encounters';
import {
  serverConfirmPharmacyPayment,
  serverCreatePharmacyCheckout,
  serverMarkPharmacyOrderReceived,
  serverPharmacyCatalog,
  serverPharmacyOrders,
  serverUpdateMe,
} from '@/lib/server';

// Dummy catalog data
const LEGACY_MEDICATIONS_CATALOG = [
  { id: 'med-001', name: 'Biogesic', genericName: 'Paracetamol', category: 'Pain Relief', form: 'Tablet', dosage: '500mg', price: 7.50, stock: 150, partnerLocations: ['Sugbo Pharmacy Escario', 'Chong Hua Hospital Pharmacy'] },
  { id: 'med-002', name: 'Neozep Forte', genericName: 'Phenylephrine HCl + Chlorphenamine Maleate + Paracetamol', category: 'Cold & Flu', form: 'Tablet', dosage: '10mg/2mg/500mg', price: 8.25, stock: 200, partnerLocations: ['Sugbo Pharmacy Escario', 'Cebu Doctors Hospital Pharmacy'] },
  { id: 'med-003', name: 'Alaxan FR', genericName: 'Ibuprofen + Paracetamol', category: 'Pain Relief', form: 'Capsule', dosage: '200mg/325mg', price: 12.00, stock: 85, partnerLocations: ['Sugbo Pharmacy Escario', 'Southwestern University Medical Center Pharmacy'] },
  { id: 'med-004', name: 'Solmux', genericName: 'Carbocisteine', category: 'Cough', form: 'Capsule', dosage: '500mg', price: 15.50, stock: 120, partnerLocations: ['Sugbo Pharmacy IT Park', 'Chong Hua Hospital Pharmacy'] },
  { id: 'med-005', name: 'Amoxil', genericName: 'Amoxicillin', category: 'Antibiotics', form: 'Capsule', dosage: '500mg', price: 22.00, stock: 40, partnerLocations: ['Sugbo Pharmacy IT Park', 'Cebu Doctors Hospital Pharmacy'] },
  { id: 'med-006', name: 'Diatabs', genericName: 'Loperamide', category: 'Digestion', form: 'Capsule', dosage: '2mg', price: 10.00, stock: 0, partnerLocations: ['Sugbo Pharmacy Escario'] },
  { id: 'med-007', name: 'Kremil-S', genericName: 'Aluminum Hydroxide + Magnesium Hydroxide + Simeticone', category: 'Digestion', form: 'Tablet', dosage: '178mg/233mg/30mg', price: 11.50, stock: 95, partnerLocations: ['Sugbo Pharmacy Escario', 'Sugbo Pharmacy IT Park'] },
  { id: 'med-008', name: 'Ascorbic Acid', genericName: 'Vitamin C', category: 'Vitamins', form: 'Tablet', dosage: '500mg', price: 5.00, stock: 500, partnerLocations: ['Sugbo Pharmacy Escario', 'Chong Hua Hospital Pharmacy', 'Cebu Doctors Hospital Pharmacy'] },
  { id: 'med-009', name: 'Losartan', genericName: 'Losartan Potassium', category: 'Heart Health', form: 'Tablet', dosage: '50mg', price: 18.00, stock: 65, partnerLocations: ['Chong Hua Hospital Pharmacy'] },
];

const CATEGORIES = ['All', 'Pain Relief', 'Cold & Flu', 'Cough', 'Digestion', 'Vitamins', 'Heart Health', 'Antibiotics', 'Syringes', 'Wound Care', 'Protective Equipment', 'First Aid'];

const PARTNER_LOCATIONS = [
  'Sugbo Pharmacy Escario',
  'Sugbo Pharmacy IT Park',
  'Chong Hua Hospital Pharmacy',
  'Cebu Doctors Hospital Pharmacy',
  'Southwestern University Medical Center Pharmacy'
];

function safeJSONParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); }
  catch (e) { return fallback; }
}

export default function Medications() {
  const { toast } = useToast();
  const currentUser = useMemo(() => safeJSONParse<{
    id?: string;
    email?: string;
    name?: string;
    phone?: string;
    insurance?: Record<string, unknown> | null;
    claims?: Record<string, unknown>[];
  } | null>(sessionStorage.getItem('sugbodoc_current_user'), null), []);

  const [activeTab, setActiveTab] = useState<'shop' | 'cart' | 'orders'>('shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  const [cartItems, setCartItems] = useState<any[]>(() => safeJSONParse(sessionStorage.getItem('sugbodoc_medication_cart'), []));
  const [orders, setOrders] = useState<any[]>([]);
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isFulfillmentModalOpen, setIsFulfillmentModalOpen] = useState(false);

  const [fulfillmentMode, setFulfillmentMode] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryForm, setDeliveryForm] = useState(() => safeJSONParse(
    sessionStorage.getItem('sugbodoc_medication_checkout_details'),
    { recipientName: currentUser?.name || '', phone: currentUser?.phone || '', address: '' },
  ));
  const [pickupLocation, setPickupLocation] = useState(PARTNER_LOCATIONS[0]);
  const insurance = useMemo(() => currentUser?.insurance as Parameters<typeof calculateInsuranceEstimate>[1], [currentUser]);
  const [catalog, setCatalog] = useState<AdminMedication[]>([]);

  useEffect(() => {
    let active = true;
    void serverPharmacyCatalog().then(({ medications }) => {
      if (active) setCatalog(medications as AdminMedication[]);
    }).catch(() => undefined);
    const refreshCatalog = () => {
      void serverPharmacyCatalog().then(({ medications }) => {
        if (active) setCatalog(medications as AdminMedication[]);
      }).catch(() => undefined);
    };
    window.addEventListener('storage', refreshCatalog);
    return () => {
      active = false;
      window.removeEventListener('storage', refreshCatalog);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void serverPharmacyOrders().then(({ orders: remoteOrders }) => {
      if (active) setOrders(remoteOrders);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Cart and checkout details are temporary tab-local UI state.
  useEffect(() => {
    sessionStorage.setItem('sugbodoc_medication_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    // Orders are authoritative in PostgreSQL; do not mirror them into browser storage.
  }, [orders]);

  useEffect(() => {
    sessionStorage.setItem('sugbodoc_medication_checkout_details', JSON.stringify(deliveryForm));
  }, [deliveryForm]);

  // Payment Result Verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');
    
    if (!payment) return;

    if (payment === 'cancelled') {
      toast({ title: 'Payment Cancelled', description: 'Your order was not completed. Items are still in your cart.', variant: 'destructive' });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (payment === 'success' && sessionId) {
      const verifyPayment = async () => {
        setIsLoadingPayment(true);
        try {
          const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
          const response = await fetch(`${base}/api/stripe/checkout-session/${encodeURIComponent(sessionId)}`);
          const result = await response.json();
          
          if (!response.ok || result.status !== 'paid') {
            throw new Error(result.error ?? 'Payment has not been confirmed');
          }

          if ((result.orderType !== 'pharmacy' && result.orderType !== 'medication') || !result.medicationOrderId) {
            throw new Error('This payment session is not a pharmacy order.');
          }

          const draft = safeJSONParse<{
            items: any[];
            fulfillmentDetails: any;
            totals: {
              subtotal: number;
              estimatedInsuranceCoverage?: number;
              patientMedicationBalance?: number;
              deliveryFee: number;
              total: number;
            };
            createdAt: string;
            status: string;
          } | null>(sessionStorage.getItem('sugbodoc_medication_checkout_draft'), null);
          if (!draft) {
            throw new Error('Order details could not be recovered. Your payment was received; please contact support.');
          }
          if (result.amountTotal !== Math.round(draft.totals.total * 100)) {
            throw new Error('The paid amount does not match this order.');
          }

          setOrders(current => {
            const exists = current.some((o: any) => o.reference === result.medicationOrderId);
            if (exists) return current;
            const order = {
              ...draft,
              reference: result.medicationOrderId,
              paymentStatus: 'paid',
              paidAmount: result.amountTotal / 100,
              paymentSessionId: sessionId,
              encounterId: getLatestPatientEncounter(currentUser?.id, currentUser?.name)?.id,
              encounterReference: getLatestPatientEncounter(currentUser?.id, currentUser?.name)?.encounterReference,
            };
            void serverConfirmPharmacyPayment(result.medicationOrderId, sessionId)
              .then(({ order: confirmedOrder }) => setOrders(currentOrders => currentOrders.map(existing =>
                existing.reference === confirmedOrder.reference ? confirmedOrder : existing,
              )))
              .catch(error => toast({
                title: 'Order confirmation failed',
                description: error instanceof Error ? error.message : 'The payment was received, but the pharmacy order needs support review.',
                variant: 'destructive',
              }));
            return [order, ...current];
          });

          setCartItems([]);
          const existingClaims = (currentUser?.claims ?? []) as any[];
          const newClaim = createOrUpdateClaim({
            relatedType: 'medication',
            relatedId: result.medicationOrderId,
            relatedLabel: `Pharmacy order ${result.medicationOrderId}`,
            originalAmount: draft.totals.subtotal,
            estimatedCoverage: draft.totals.estimatedInsuranceCoverage ?? 0,
            patientBalance: draft.totals.patientMedicationBalance ?? draft.totals.total - draft.totals.deliveryFee,
            status: 'Processing',
            provider: insurance?.provider ?? 'Testing estimate',
          }, existingClaims);
          const nextClaims = existingClaims.some(claim => claim.relatedType === newClaim.relatedType && claim.relatedId === newClaim.relatedId)
            ? existingClaims
            : [newClaim, ...existingClaims];
          void serverUpdateMe({ claims: nextClaims });
          sessionStorage.removeItem('sugbodoc_medication_checkout_draft');
          setActiveTab('orders');
          toast({ title: 'Pharmacy order successful', description: 'Your pharmacy order has been placed and is now pending fulfillment.' });
          
        } catch (err) {
          toast({ title: 'Order Verification Failed', description: err instanceof Error ? err.message : 'Please check your orders tab or contact support.', variant: 'destructive' });
        } finally {
          setIsLoadingPayment(false);
          window.history.replaceState({}, '', window.location.pathname);
        }
      };
      
      void verifyPayment();
    }
  }, [toast]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(med => med.enabled && med.stock > 0).filter(med => {
      const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            med.genericName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === 'All' || med.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [catalog, searchQuery, categoryFilter]);

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const deliveryFee = fulfillmentMode === 'delivery' ? 99 : 0;
  const medicationEstimate = calculateInsuranceEstimate(subtotal, insurance, 'medication');
  const estimatedInsuranceCoverage = medicationEstimate.estimatedCoverage;
  const patientMedicationBalance = medicationEstimate.patientBalance;
  const total = patientMedicationBalance + deliveryFee;

  const MINIMUM_ORDER_PHP = 50;

  const isFulfillmentValid = useMemo(() => {
    if (fulfillmentMode === 'delivery') {
      return deliveryForm.recipientName.trim() !== '' && 
             deliveryForm.phone.trim() !== '' && 
             deliveryForm.address.trim() !== '';
    }
    return !!pickupLocation;
  }, [fulfillmentMode, deliveryForm, pickupLocation]);

  const isCheckoutValid = cartItems.length > 0 &&
    total >= MINIMUM_ORDER_PHP &&
    isFulfillmentValid;

  const addToCart = (med: any) => {
    setCartItems(current => {
      const existing = current.find(item => item.id === med.id);
      if (existing) {
        if (existing.quantity >= med.stock) {
          toast({ title: 'Stock limit reached', description: `Only ${med.stock} available.`, variant: 'destructive' });
          return current;
        }
        toast({ title: 'Cart updated', description: `Increased ${med.name} quantity.` });
        return current.map(item => item.id === med.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast({ title: 'Added to cart', description: `${med.name} added to your cart.` });
      return [...current, { ...med, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    setCartItems(current => {
      if (newQuantity <= 0) {
        return current.filter(item => item.id !== id);
      }
      const med = catalog.find(m => m.id === id);
      if (med && newQuantity > med.stock) {
        toast({ title: 'Stock limit reached', description: `Only ${med.stock} available.`, variant: 'destructive' });
        return current;
      }
      return current.map(item => item.id === id ? { ...item, quantity: newQuantity } : item);
    });
  };

  const handleCheckout = async () => {
    if (!isCheckoutValid) return;
    setIsCheckingOut(true);
    
    try {
      const latestEncounter = getLatestPatientEncounter(currentUser?.id, currentUser?.name);
      const orderPayload = {
        items: cartItems,
        encounterId: latestEncounter?.id,
        encounterReference: latestEncounter?.encounterReference,
        fulfillmentDetails: fulfillmentMode === 'delivery' ? {
          mode: 'delivery',
          ...deliveryForm
        } : {
          mode: 'pickup',
          location: pickupLocation
        },
        totals: {
          subtotal,
          estimatedInsuranceCoverage,
          patientMedicationBalance,
          deliveryFee,
          total,
        },
        createdAt: new Date().toISOString(),
        status: 'Pending',
      };
      sessionStorage.setItem('sugbodoc_medication_checkout_draft', JSON.stringify(orderPayload));

      const appBase = `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}`;
      
      const result = await serverCreatePharmacyCheckout({
        cartItems: cartItems.map(({ id, quantity }) => ({ id, quantity })),
        encounterId: latestEncounter?.id,
        insuranceCoverageAmount: estimatedInsuranceCoverage,
        fulfillmentDetails: orderPayload.fulfillmentDetails,
        successUrl: `${appBase}medications?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appBase}medications?payment=cancelled`,
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      toast({ title: 'Checkout Error', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
      setIsCheckingOut(false);
    }
  };

  const markOrderReceived = async (reference: string) => {
    try {
      const { order } = await serverMarkPharmacyOrderReceived(reference);
      setOrders(current => current.map(existing => existing.reference === reference ? order : existing));
      toast({
        title: 'Order marked as received',
        description: 'Thanks for confirming that your pharmacy order arrived.',
      });
    } catch (error) {
      toast({
        title: 'Could not update order',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <AppShell title="Pharmacy">
      {isLoadingPayment && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <h3 className="text-xl font-bold">Verifying Payment...</h3>
          <p className="text-muted-foreground mt-2 text-center">Please wait while we securely confirm your order.</p>
        </div>
      )}

      {/* Pharmacy navigation — cart stays easy to reach on the right on every screen */}
      <div className="mb-8 flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/50 p-1.5 shadow-sm">
          <button onClick={() => setActiveTab('shop')} className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${activeTab === 'shop' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Shop
          </button>
          <button onClick={() => setActiveTab('orders')} className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Pharmacy Orders
          </button>
        </div>
        <button
          onClick={() => setActiveTab('cart')}
          className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
            activeTab === 'cart'
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border/50 bg-card text-foreground shadow-sm hover:border-primary/40 hover:text-primary'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Cart</span>
          {cartItems.length > 0 && (
            <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] ${
              activeTab === 'cart' ? 'bg-primary-foreground text-primary' : 'bg-primary/15 text-primary'
            }`}>
              {cartItems.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'shop' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
          {/* Hero */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center justify-between overflow-hidden relative border border-primary/10 shadow-sm">
            <div className="relative z-10 max-w-xl">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-2">Pharmacy & Essentials</h2>
              <p className="text-muted-foreground font-medium text-sm md:text-base leading-relaxed">
                Get your prescribed and over-the-counter medicines delivered directly to your door or ready for quick pickup at our trusted partner pharmacies.
              </p>
            </div>
            <div className="absolute right-[-20%] md:-right-10 -bottom-10 opacity-10 pointer-events-none">
              <Activity className="w-64 h-64 text-primary" />
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search medicines or generic names..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm transition-shadow"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
              {CATEGORIES.map(cat => (
                 <button 
                   key={cat}
                   onClick={() => setCategoryFilter(cat)}
                   className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${categoryFilter === cat ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground shadow-sm'}`}
                 >
                   {cat}
                 </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {filteredCatalog.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredCatalog.map(med => (
                <div key={med.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all shadow-sm flex flex-col h-full group relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-primary/5 p-3 rounded-xl group-hover:bg-primary/10 transition-colors">
                      <Pill className="h-6 w-6 text-primary" />
                    </div>
                    <div className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${med.stock > 50 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : med.stock > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-red-400'}`}>
                      {med.stock > 50 ? 'In Stock' : med.stock > 0 ? `Low Stock` : 'Out of Stock'}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-foreground leading-tight text-lg">{med.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{med.genericName}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">{med.description}</p>
                  
                  <div className="mt-auto pt-4 flex items-end justify-between border-t border-border/50">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">{med.category} · {med.dosage} • {med.form}</div>
                      <div className="font-bold text-xl text-foreground">₱{med.price.toFixed(2)}</div>
                    </div>
                    <button 
                      disabled={med.stock === 0}
                      onClick={() => addToCart(med)}
                      className="bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground p-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:hover:bg-primary/10 disabled:hover:text-primary disabled:cursor-not-allowed active:scale-95"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-card border border-border border-dashed rounded-2xl">
              <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-1">No medicines found</h3>
              <p className="text-muted-foreground text-sm">Try adjusting your search or category filter.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'cart' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          {cartItems.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border border-dashed rounded-2xl max-w-2xl mx-auto shadow-sm">
              <div className="bg-primary/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
                <ShoppingBag className="h-10 w-10 text-primary/40" />
              </div>
              <h3 className="text-xl font-bold mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">Explore our catalog and find the medicines or essentials you need today.</p>
              <button onClick={() => setActiveTab('shop')} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg active:scale-95 inline-flex items-center gap-2">
                Browse Medicines
              </button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                
                {/* Cart List */}
                <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" /> Pharmacy Order Items
                  </h3>
                  <div className="space-y-4">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0 last:pb-0">
                        <div className="h-14 w-14 bg-primary/5 rounded-xl flex items-center justify-center shrink-0">
                          <Pill className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-foreground truncate">{item.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">{item.dosage} {item.form}</p>
                          <div className="text-sm font-bold mt-1.5 text-foreground">₱{(item.price * item.quantity).toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">(₱{item.price.toFixed(2)} ea)</span></div>
                        </div>
                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <button onClick={() => updateQuantity(item.id, 0)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors -mr-1.5">
                            <X className="h-4 w-4" />
                          </button>
                          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/50">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-background hover:shadow-sm rounded-md text-muted-foreground transition-all">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs font-bold w-6 text-center tabular-nums">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-background hover:shadow-sm rounded-md text-muted-foreground transition-all">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Summary */}
              <div className="lg:col-span-1">
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm sticky top-24">
                  <h3 className="font-bold text-lg mb-5">Order Summary</h3>
                  <div className="space-y-3 text-sm mb-6">
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <span>Original item amount ({cartItems.length} items)</span>
                      <span className="text-foreground">₱{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <span>Estimated insurance coverage</span>
                      <span className="text-emerald-600">−₱{estimatedInsuranceCoverage.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Patient medicine balance</span>
                      <span className="text-foreground">₱{patientMedicationBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <span>Delivery Fee</span>
                      <span className="text-foreground">{deliveryFee === 0 ? 'Free' : `₱${deliveryFee.toFixed(2)}`}</span>
                    </div>
                  </div>
                  <p className="mb-5 text-[11px] text-muted-foreground">
                    Testing estimate only · {insurance?.provider || 'No active provider'} · Delivery fees are not covered.
                  </p>
                  <div className="flex justify-between font-bold text-xl pt-5 border-t border-border border-dashed mb-6">
                    <span>Total</span>
                    <span className="text-primary">₱{total.toFixed(2)}</span>
                  </div>
                  
                  <button 
                    disabled={cartItems.length === 0 || total < MINIMUM_ORDER_PHP || isCheckingOut}
                    onClick={() => setIsFulfillmentModalOpen(true)}
                    className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-primary/90 shadow-md hover:shadow-lg active:scale-95"
                  >
                    {isCheckingOut ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Place Order • ₱{total.toFixed(2)} <ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                  
                  {total < MINIMUM_ORDER_PHP && cartItems.length > 0 && (
                    <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-4 font-medium flex items-center justify-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Minimum order is ₱{MINIMUM_ORDER_PHP.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          {sortedOrders.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border border-dashed rounded-2xl max-w-2xl mx-auto shadow-sm">
              <div className="bg-primary/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
                <Clock className="h-10 w-10 text-primary/40" />
              </div>
              <h3 className="text-xl font-bold mb-2">No pharmacy orders</h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">You haven't placed any pharmacy orders yet. Your order history will appear here.</p>
              <button onClick={() => setActiveTab('shop')} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg active:scale-95">
                Start an Order
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {sortedOrders.map((order, idx) => (
                <div key={`${order.reference}-${idx}`} className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5 pb-5 border-b border-border/50">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-foreground">Pharmacy Order #{order.reference.slice(-8).toUpperCase()}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${order.status === 'Pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> 
                        {new Date(order.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex w-full flex-col items-start gap-3 rounded-xl bg-primary/5 p-3 sm:w-auto sm:items-end sm:bg-transparent sm:p-0">
                      <div className="text-left sm:text-right">
                        <div className="font-bold text-xl text-primary">₱{order.totals.total.toFixed(2)}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground sm:justify-end">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Paid securely
                        </div>
                      </div>
                      {order.paymentStatus === 'paid' && order.status !== 'Received' && (
                        <button
                          type="button"
                          onClick={() => markOrderReceived(order.reference)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 active:scale-95"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Received
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Items</h4>
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="bg-muted px-2 py-0.5 rounded-md font-bold text-muted-foreground text-xs">{item.quantity}x</span>
                          <span className="font-medium text-foreground">{item.name} <span className="text-muted-foreground font-normal text-xs ml-1">({item.dosage})</span></span>
                        </div>
                        <span className="font-bold text-foreground">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mb-6 rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-bold text-primary">Payment breakdown</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estimate</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-muted-foreground">Original medicines</span><span>₱{order.totals.subtotal.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Estimated insurance coverage</span><span className="text-emerald-600">−₱{(order.totals.estimatedInsuranceCoverage ?? 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>₱{order.totals.deliveryFee.toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-primary/10 pt-1.5 font-bold"><span>Paid patient balance</span><span className="text-primary">₱{order.totals.total.toFixed(2)}</span></div>
                    </div>
                  </div>
                  
                  <div className="bg-background border border-border p-4 rounded-xl flex items-start gap-4">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                      {order.fulfillmentDetails.mode === 'delivery' ? <Truck className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {order.fulfillmentDetails.mode === 'delivery' ? 'Home Delivery' : 'Store Pickup'}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">
                        {order.fulfillmentDetails.mode === 'delivery' 
                          ? `${order.fulfillmentDetails.recipientName} • ${order.fulfillmentDetails.address}`
                          : `Pick up at ${order.fulfillmentDetails.location}`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isFulfillmentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsFulfillmentModalOpen(false);
          }}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fulfillment-modal-title"
          >
          <div className="px-6 pt-6 pb-5 border-b border-border bg-gradient-to-br from-primary/10 via-background to-background">
            <div className="flex items-start gap-3 pr-8">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h2 id="fulfillment-modal-title" className="text-xl font-semibold leading-none tracking-tight">How would you like to receive your order?</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Choose a fulfillment method and confirm your details before secure payment.
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close fulfillment options"
              onClick={() => setIsFulfillmentModalOpen(false)}
              className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[calc(85vh-190px)] overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/50 p-1.5 border border-border">
              <button
                type="button"
                onClick={() => setFulfillmentMode('delivery')}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                  fulfillmentMode === 'delivery'
                    ? 'bg-background text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Truck className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-bold">Delivery</span>
                  <span className="block text-[11px] font-medium opacity-75">To your address</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentMode('pickup')}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                  fulfillmentMode === 'pickup'
                    ? 'bg-background text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Store className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-bold">Store pickup</span>
                  <span className="block text-[11px] font-medium opacity-75">At a partner location</span>
                </span>
              </button>
            </div>

            {fulfillmentMode === 'delivery' ? (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Recipient name</label>
                  <input
                    type="text"
                    value={deliveryForm.recipientName}
                    onChange={e => setDeliveryForm(prev => ({ ...prev, recipientName: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm transition-shadow"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Phone number</label>
                  <input
                    type="tel"
                    value={deliveryForm.phone}
                    onChange={e => setDeliveryForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm transition-shadow"
                    placeholder="e.g. 0917 123 4567"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Complete delivery address</label>
                  <textarea
                    value={deliveryForm.address}
                    onChange={e => setDeliveryForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[100px] resize-none shadow-sm transition-shadow"
                    placeholder="House/Unit No., Street, Barangay, City, Province"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Select partner location</label>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {PARTNER_LOCATIONS.map(loc => (
                    <button
                      type="button"
                      key={loc}
                      onClick={() => setPickupLocation(loc)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                        pickupLocation === loc
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-background hover:border-primary/30'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        pickupLocation === loc ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <span className={`text-sm font-bold flex-1 ${
                        pickupLocation === loc ? 'text-primary' : 'text-foreground'
                      }`}>{loc}</span>
                      {pickupLocation === loc && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border bg-muted/20 px-6 py-4">
            {!isFulfillmentValid && (
              <p className="mb-3 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Complete the required details to continue.
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Patient balance to pay</p>
                <p className="text-xl font-bold text-primary">₱{total.toFixed(2)}</p>
              </div>
              <button
                type="button"
                disabled={!isCheckoutValid || isCheckingOut}
                onClick={handleCheckout}
                className="w-full sm:w-auto bg-primary text-primary-foreground px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-primary/90 shadow-md active:scale-95"
              >
                {isCheckingOut ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LockKeyhole className="h-4 w-4" />
                    Continue to secure payment
                  </>
                )}
              </button>
            </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">Original medicines</span><span className="text-right">₱{subtotal.toFixed(2)}</span>
                <span className="text-muted-foreground">Estimated insurance coverage</span><span className="text-right text-emerald-600">−₱{estimatedInsuranceCoverage.toFixed(2)}</span>
                <span className="text-muted-foreground">Delivery fee</span><span className="text-right">₱{deliveryFee.toFixed(2)}</span>
              </div>
          </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
