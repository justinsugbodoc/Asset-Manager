import { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/layout/app-shell';
import { 
  Search, ShoppingBag, Pill, Plus, Minus, Store, Truck, 
  MapPin, CheckCircle2, Clock, Activity, X, AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Dummy catalog data
const MEDICATIONS_CATALOG = [
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

const CATEGORIES = ['All', 'Pain Relief', 'Cold & Flu', 'Cough', 'Digestion', 'Vitamins', 'Heart Health', 'Antibiotics'];

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
  const currentUser = useMemo(() => safeJSONParse<{ email?: string; name?: string; phone?: string } | null>(localStorage.getItem('sugbodoc_current_user'), null), []);

  const [activeTab, setActiveTab] = useState<'shop' | 'cart' | 'orders'>('shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  const [cartItems, setCartItems] = useState<any[]>(() => safeJSONParse(localStorage.getItem('sugbodoc_medication_cart'), []));
  const [orders, setOrders] = useState<any[]>(() => safeJSONParse(localStorage.getItem('sugbodoc_medication_orders'), []));
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);

  const [fulfillmentMode, setFulfillmentMode] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryForm, setDeliveryForm] = useState(() => safeJSONParse(
    localStorage.getItem('sugbodoc_medication_checkout_details'),
    { recipientName: currentUser?.name || '', phone: currentUser?.phone || '', address: '' },
  ));
  const [pickupLocation, setPickupLocation] = useState(PARTNER_LOCATIONS[0]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('sugbodoc_medication_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem('sugbodoc_medication_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('sugbodoc_medication_checkout_details', JSON.stringify(deliveryForm));
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

          if (result.orderType !== 'medication' || !result.medicationOrderId) {
            throw new Error('This payment session is not a medication order.');
          }

          const draft = safeJSONParse<{
            items: any[];
            fulfillmentDetails: any;
            totals: { subtotal: number; deliveryFee: number; total: number };
            createdAt: string;
            status: string;
          } | null>(localStorage.getItem('sugbodoc_medication_checkout_draft'), null);
          if (!draft) {
            throw new Error('Order details could not be recovered. Your payment was received; please contact support.');
          }
          if (result.amountTotal !== Math.round(draft.totals.total * 100)) {
            throw new Error('The paid amount does not match this order.');
          }

          setOrders(current => {
            const exists = current.some((o: any) => o.reference === result.medicationOrderId);
            if (exists) return current;
            return [{
              ...draft,
              reference: result.medicationOrderId,
              paymentStatus: 'paid',
              paidAmount: result.amountTotal / 100,
              paymentSessionId: sessionId,
            }, ...current];
          });

          setCartItems([]);
          localStorage.removeItem('sugbodoc_medication_checkout_draft');
          setActiveTab('orders');
          toast({ title: 'Order Successful', description: 'Your medication order has been placed and is now pending fulfillment.' });
          
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
    return MEDICATIONS_CATALOG.filter(med => {
      const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            med.genericName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === 'All' || med.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, categoryFilter]);

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const deliveryFee = fulfillmentMode === 'delivery' ? 99 : 0;
  const total = subtotal + deliveryFee;

  const MINIMUM_ORDER_PHP = 50;

  const isCheckoutValid = useMemo(() => {
    if (cartItems.length === 0) return false;
    if (total < MINIMUM_ORDER_PHP) return false;
    if (fulfillmentMode === 'delivery') {
      return deliveryForm.recipientName.trim() !== '' && 
             deliveryForm.phone.trim() !== '' && 
             deliveryForm.address.trim() !== '';
    }
    return !!pickupLocation;
  }, [cartItems, fulfillmentMode, deliveryForm, pickupLocation, total]);

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
      const med = MEDICATIONS_CATALOG.find(m => m.id === id);
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
      const orderPayload = {
        items: cartItems,
        fulfillmentDetails: fulfillmentMode === 'delivery' ? {
          mode: 'delivery',
          ...deliveryForm
        } : {
          mode: 'pickup',
          location: pickupLocation
        },
        totals: { subtotal, deliveryFee, total },
        createdAt: new Date().toISOString(),
        status: 'Pending',
      };
      localStorage.setItem('sugbodoc_medication_checkout_draft', JSON.stringify(orderPayload));

      const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
      const appBase = `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}`;
      
      const response = await fetch(`${base}/api/stripe/create-medication-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: cartItems.map(({ id, quantity }) => ({ id, quantity })),
          fulfillmentDetails: orderPayload.fulfillmentDetails,
          patientEmail: currentUser?.email,
          successUrl: `${appBase}medications?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${appBase}medications?payment=cancelled`,
          medicationOrderPayload: orderPayload
        })
      });
      
      const result = await response.json();
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || 'Failed to start checkout');
      
      window.location.href = result.checkoutUrl;
    } catch (err) {
      toast({ title: 'Checkout Error', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
      setIsCheckingOut(false);
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

      {/* Tabs */}
      <div className="flex bg-muted/50 p-1.5 rounded-xl w-full max-w-sm mb-8 border border-border/50 shadow-sm">
        <button onClick={() => setActiveTab('shop')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'shop' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          Shop
        </button>
        <button onClick={() => setActiveTab('cart')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'cart' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          Cart
          {cartItems.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'cart' ? 'bg-primary text-white' : 'bg-primary/20 text-primary'}`}>
              {cartItems.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'orders' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          Orders
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
                  <p className="text-xs text-muted-foreground mt-1 mb-3 line-clamp-1">{med.genericName}</p>
                  
                  <div className="mt-auto pt-4 flex items-end justify-between border-t border-border/50">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">{med.dosage} • {med.form}</div>
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
                    <ShoppingBag className="h-5 w-5 text-primary" /> Order Items
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

                {/* Fulfillment */}
                <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" /> Fulfillment Method
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3 mb-6 bg-muted/40 p-1.5 rounded-xl border border-border">
                    <button 
                      onClick={() => setFulfillmentMode('delivery')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${fulfillmentMode === 'delivery' ? 'bg-background shadow-sm text-primary border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Truck className="h-4 w-4" /> Delivery
                    </button>
                    <button 
                      onClick={() => setFulfillmentMode('pickup')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${fulfillmentMode === 'pickup' ? 'bg-background shadow-sm text-primary border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Store className="h-4 w-4" /> Store Pickup
                    </button>
                  </div>

                  {fulfillmentMode === 'delivery' ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Recipient Name</label>
                        <input 
                          type="text" 
                          value={deliveryForm.recipientName}
                          onChange={e => setDeliveryForm(prev => ({ ...prev, recipientName: e.target.value }))}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm transition-shadow"
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Phone Number</label>
                        <input 
                          type="tel" 
                          value={deliveryForm.phone}
                          onChange={e => setDeliveryForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm transition-shadow"
                          placeholder="e.g. 0917..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Complete Address</label>
                        <textarea 
                          value={deliveryForm.address}
                          onChange={e => setDeliveryForm(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[100px] resize-none shadow-sm transition-shadow"
                          placeholder="House/Unit No., Street, Barangay, City, Province"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Select Partner Location</label>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                          {PARTNER_LOCATIONS.map(loc => (
                            <button
                              key={loc}
                              onClick={() => setPickupLocation(loc)}
                              className={`w-full flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl border text-left transition-all ${pickupLocation === loc ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:border-primary/30'}`}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div className={`p-2 rounded-lg shrink-0 ${pickupLocation === loc ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                  <MapPin className="h-5 w-5" />
                                </div>
                                <span className={`text-sm font-bold flex-1 ${pickupLocation === loc ? 'text-primary' : 'text-foreground'}`}>{loc}</span>
                                {pickupLocation === loc && <CheckCircle2 className="h-5 w-5 text-primary ml-auto shrink-0" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="lg:col-span-1">
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm sticky top-24">
                  <h3 className="font-bold text-lg mb-5">Order Summary</h3>
                  <div className="space-y-3 text-sm mb-6">
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <span>Subtotal ({cartItems.length} items)</span>
                      <span className="text-foreground">₱{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <span>Delivery Fee</span>
                      <span className="text-foreground">{deliveryFee === 0 ? 'Free' : `₱${deliveryFee.toFixed(2)}`}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-bold text-xl pt-5 border-t border-border border-dashed mb-6">
                    <span>Total</span>
                    <span className="text-primary">₱{total.toFixed(2)}</span>
                  </div>
                  
                  <button 
                    disabled={!isCheckoutValid || isCheckingOut}
                    onClick={handleCheckout}
                    className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-primary/90 shadow-md hover:shadow-lg active:scale-95"
                  >
                    {isCheckingOut ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Place Order • ₱{total.toFixed(2)}</>
                    )}
                  </button>
                  
                  {!isCheckoutValid && cartItems.length > 0 && (
                    <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-4 font-medium flex items-center justify-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {total < MINIMUM_ORDER_PHP
                        ? `Minimum order is ₱${MINIMUM_ORDER_PHP.toFixed(2)}`
                        : 'Please complete fulfillment details'}
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
              <h3 className="text-xl font-bold mb-2">No past orders</h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">You haven't placed any medication orders yet. Your order history will appear here.</p>
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
                        <span className="font-bold text-foreground">Order #{order.reference.slice(-8).toUpperCase()}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${order.status === 'Pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> 
                        {new Date(order.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto bg-primary/5 sm:bg-transparent p-3 sm:p-0 rounded-xl">
                      <div className="font-bold text-xl text-primary">₱{order.totals.total.toFixed(2)}</div>
                      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 sm:justify-end mt-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Paid securely
                      </div>
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
    </AppShell>
  );
}
