import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  CalendarPlus,
  History,
  CalendarCheck,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  FileText,
  BellRing,
  MessageCircle,
  Copy,
  ExternalLink,
  LogOut,
  Settings,
  Store,
  BarChart3
} from 'lucide-react';
import {
  addDays,
  todayStr,
  daysBetween,
  formatCurrency,
  resolveImageUrl,
  buildWhatsAppUrl,
  registerStore,
  loginStore,
  updateStoreProfile,
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  checkAvailability
} from '../api.js';
import InvoiceModal from '../components/InvoiceModal.jsx';
import SalesAnalytics from '../components/SalesAnalytics.jsx';
import SquareImageCropper from '../components/SquareImageCropper.jsx';

const STORE_SESSION_KEY = 'atelier_store_session_v1';
const CUSTOM_COLORS_KEY = 'atelier_custom_colors_v1';
const CUSTOM_TYPES_KEY = 'atelier_custom_types_v1';

const DEFAULT_COLORS = [
  'Crimson Red',
  'Gold',
  'Antique Gold',
  'Gold & Ruby',
  'Emerald Green',
  'Ivory',
  'Navy Blue',
  'Maroon',
  'Blush Pink',
  'Rose Gold',
  'Silver',
  'Champagne',
  'Royal Blue',
  'Peach',
  'Black'
];

const TYPES_BY_CATEGORY = {
  Dress: ['Bridal Lehenga', 'Silk Saree', 'Evening Gown', 'Sherwani', 'Anarkali', 'Indo-Western', 'Kurta Set', 'Dupatta'],
  Jewelry: ['Necklace Set', 'Choker Set', 'Earrings / Jhumkas', 'Bangles', 'Maang Tikka', 'Bridal Set', 'Ring', 'Bracelet']
};

const EMPTY_PRODUCT = {
  name: '',
  category: 'Dress',
  type: 'Bridal Lehenga',
  color: 'Crimson Red',
  price: '',
  priceVisible: true,
  isAvailable: true,
  storageLocation: '',
  imageUrl: ''
};

export default function AdminPage() {
  // Store auth session
  const [store, setStore] = useState(() => {
    try {
      const raw = localStorage.getItem(STORE_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({
    storeLoginId: '',
    password: '',
    name: '',
    address: '',
    gstin: '',
    phone: '',
    description: ''
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState('inventory');
  const [products, setProducts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Invoice modal
  const [invoiceBooking, setInvoiceBooking] = useState(null);

  // Inventory filters & product modal
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('All');
  const [invColor, setInvColor] = useState('All');
  const [invType, setInvType] = useState('All');
  const [invStatus, setInvStatus] = useState('All');

  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [cropFile, setCropFile] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Persistent custom colors
  const [customColors, setCustomColors] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [addingColor, setAddingColor] = useState(false);
  const [newColorInput, setNewColorInput] = useState('');

  // Persistent custom types per category
  const [customTypes, setCustomTypes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_TYPES_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  });
  const [addingType, setAddingType] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState('');

  const availableTypesForCategory = useMemo(() => {
    const cat = productForm.category || 'Dress';
    const map = new Map();
    const add = (t) => {
      const trimmed = String(t || '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) map.set(key, trimmed);
    };
    (TYPES_BY_CATEGORY[cat] || []).forEach(add);
    (customTypes[cat] || []).forEach(add);
    products.filter((p) => p.category === cat).forEach((p) => add(p.type));
    return Array.from(map.values());
  }, [productForm.category, customTypes, products]);

  function handleSaveNewType() {
    const trimmed = newTypeInput.trim();
    if (!trimmed) return;
    const cat = productForm.category || 'Dress';
    const exists = availableTypesForCategory.some((t) => t.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const next = { ...customTypes, [cat]: [...(customTypes[cat] || []), trimmed] };
      setCustomTypes(next);
      try {
        localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    setProductForm((p) => ({ ...p, type: trimmed }));
    setNewTypeInput('');
    setAddingType(false);
  }

  // Booking creation state
  const [bookingForm, setBookingForm] = useState({
    productId: '',
    customerName: '',
    customerPhone: '',
    functionDate: addDays(todayStr(), 3),
    collectionDate: addDays(todayStr(), 2),
    returnDate: addDays(todayStr(), 4),
    editDates: false,
    price: '',
    discountType: 'none',
    discountValue: '',
    notes: ''
  });
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Booking history filter
  const [historyStatus, setHistoryStatus] = useState('All');
  const [historySearch, setHistorySearch] = useState('');

  // Availability checker
  const [availMode, setAvailMode] = useState('functionDate');
  const [availDate, setAvailDate] = useState(addDays(todayStr(), 3));
  const [availStart, setAvailStart] = useState(addDays(todayStr(), 2));
  const [availEnd, setAvailEnd] = useState(addDays(todayStr(), 4));
  const [availResult, setAvailResult] = useState(null);

  // Store Settings form
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    address: '',
    gstin: '',
    phone: '',
    description: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const showBanner = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner((prev) => (prev?.text === text ? null : prev)), 5000);
  };

  function persistStore(nextStore) {
    setStore(nextStore);
    if (nextStore) {
      localStorage.setItem(STORE_SESSION_KEY, JSON.stringify(nextStore));
    } else {
      localStorage.removeItem(STORE_SESSION_KEY);
    }
  }

  async function loadAll(currentStore = store) {
    if (!currentStore?.id) return;
    setLoading(true);
    try {
      const [prodRes, bookRes] = await Promise.all([
        fetchProducts({ storeId: currentStore.id }),
        fetchBookings({ storeId: currentStore.id })
      ]);
      setProducts(prodRes.items || []);
      setBookings(bookRes.items || []);
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (store?.id) {
      loadAll(store);
      setSettingsForm({
        name: store.name || '',
        address: store.address || '',
        gstin: store.gstin || '',
        phone: store.phone || '',
        description: store.description || ''
      });
    }
  }, [store?.id]);

  // Auth handlers
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res =
        authMode === 'register'
          ? await registerStore(authForm)
          : await loginStore({ phone: authForm.phone, password: authForm.password });
      persistStore(res.store);
      if (authMode === 'register') {
        showBanner(
          'success',
          `Store registered! Store ID: ${res.store.storeLoginId.toUpperCase()}. Use your 10-digit phone (${res.store.phone}) & password to log in.`
        );
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    persistStore(null);
    setProducts([]);
    setBookings([]);
  }

  // Available colors for Add/Edit dropdown
  const availableColors = useMemo(() => {
    const map = new Map();
    const add = (c) => {
      const trimmed = String(c || '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) map.set(key, trimmed);
    };
    DEFAULT_COLORS.forEach(add);
    customColors.forEach(add);
    products.forEach((p) => add(p.color));
    return Array.from(map.values());
  }, [customColors, products]);

  function handleSaveNewColor() {
    const trimmed = newColorInput.trim();
    if (!trimmed) return;
    const exists = availableColors.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const next = [...customColors, trimmed];
      setCustomColors(next);
      try {
        localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    setProductForm((p) => ({ ...p, color: trimmed }));
    setNewColorInput('');
    setAddingColor(false);
  }

  // Inventory filter options
  const invColorOptions = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.color).filter(Boolean))).sort()], [products]);
  const invTypeOptions = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.type).filter(Boolean))).sort()], [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (invCategory !== 'All' && p.category !== invCategory) return false;
      if (invColor !== 'All' && p.color !== invColor) return false;
      if (invType !== 'All' && p.type !== invType) return false;
      if (invStatus === 'Available' && !p.isAvailable) return false;
      if (invStatus === 'Unavailable' && p.isAvailable) return false;
      if (invSearch.trim()) {
        const q = invSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.color.toLowerCase().includes(q) ||
          p.storageLocation.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, invCategory, invColor, invType, invStatus, invSearch]);

  // Today's Returns & Overdue Returns
  const today = todayStr();
  const activeReturns = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'Returned' && b.status !== 'Cancelled');
    const overdue = active.filter((b) => b.returnDate < today).sort((a, b) => a.returnDate.localeCompare(b.returnDate));
    const dueToday = active.filter((b) => b.returnDate === today);
    return { overdue, dueToday, totalCount: overdue.length + dueToday.length };
  }, [bookings, today]);

  // Selected product in booking form
  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(bookingForm.productId)) || null,
    [products, bookingForm.productId]
  );

  // Live availability check for booking form
  useEffect(() => {
    if (!bookingForm.productId || !bookingForm.collectionDate || !bookingForm.returnDate) {
      setAvailabilityStatus(null);
      return;
    }
    let cancelled = false;
    checkAvailability({
      productId: bookingForm.productId,
      startDate: bookingForm.collectionDate,
      endDate: bookingForm.returnDate
    })
      .then((res) => {
        if (!cancelled) setAvailabilityStatus(res);
      })
      .catch(() => {
        if (!cancelled) setAvailabilityStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingForm.productId, bookingForm.collectionDate, bookingForm.returnDate]);

  // Availability checker tab loader
  useEffect(() => {
    if (activeTab !== 'availability' || !store?.id) return;
    const params =
      availMode === 'functionDate'
        ? { storeId: store.id, date: availDate }
        : { storeId: store.id, startDate: availStart, endDate: availEnd };
    checkAvailability(params)
      .then((res) => setAvailResult(res))
      .catch((err) => showBanner('error', err.message));
  }, [activeTab, store?.id, availMode, availDate, availStart, availEnd]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (historyStatus !== 'All' && b.status !== historyStatus) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        return (
          b.customerName.toLowerCase().includes(q) ||
          b.customerPhone.toLowerCase().includes(q) ||
          b.productName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bookings, historyStatus, historySearch]);

  // Product modal handlers
  function openNewProductModal() {
    setEditingProduct({});
    setProductForm(EMPTY_PRODUCT);
    setImageFile(null);
    setImagePreview('');
    setAddingColor(false);
  }

  function openEditProductModal(product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      type: product.type,
      color: product.color,
      price: String(product.price),
      priceVisible: product.priceVisible,
      isAvailable: product.isAvailable,
      storageLocation: product.storageLocation,
      imageUrl: product.imageUrl
    });
    setImageFile(null);
    setImagePreview(resolveImageUrl(product.imageUrl));
    setAddingColor(false);
  }

  async function handleSaveProduct(e) {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const fd = new FormData();
      fd.append('storeId', String(store.id));
      fd.append('name', productForm.name);
      fd.append('category', productForm.category);
      fd.append('type', productForm.type);
      fd.append('color', productForm.color);
      fd.append('price', productForm.price);
      fd.append('priceVisible', String(productForm.priceVisible));
      fd.append('isAvailable', String(productForm.isAvailable));
      fd.append('storageLocation', productForm.storageLocation);
      if (imageFile) {
        fd.append('image', imageFile);
      } else {
        fd.append('imageUrl', productForm.imageUrl);
      }

      if (editingProduct?.id) {
        await updateProduct(editingProduct.id, fd);
        showBanner('success', `Updated "${productForm.name}".`);
      } else {
        await createProduct(fd);
        showBanner('success', `Added "${productForm.name}" to inventory.`);
      }
      setEditingProduct(null);
      await loadAll();
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleQuickToggle(product, field) {
    try {
      await updateProduct(product.id, { [field]: !product[field] });
      await loadAll();
    } catch (err) {
      showBanner('error', err.message);
    }
  }

  async function handleDeleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}"?`)) return;
    try {
      await deleteProduct(product.id);
      showBanner('success', `Deleted "${product.name}".`);
      await loadAll();
    } catch (err) {
      showBanner('error', err.message);
    }
  }

  function startBookingForProduct(product) {
    const fnDate = addDays(todayStr(), 3);
    setBookingForm({
      productId: String(product.id),
      customerName: '',
      customerPhone: '',
      functionDate: fnDate,
      collectionDate: addDays(fnDate, -1),
      returnDate: addDays(fnDate, 1),
      editDates: false,
      price: String(product.price),
      discountType: 'none',
      discountValue: '',
      notes: ''
    });
    setActiveTab('book');
  }

  function handleBookingProductChange(newId) {
    const prod = products.find((p) => String(p.id) === String(newId));
    setBookingForm((prev) => ({
      ...prev,
      productId: newId,
      price: prod ? String(prod.price) : ''
    }));
  }

  function handleFunctionDateChange(fnDate) {
    setBookingForm((prev) => ({
      ...prev,
      functionDate: fnDate,
      collectionDate: prev.editDates ? prev.collectionDate : addDays(fnDate, -1),
      returnDate: prev.editDates ? prev.returnDate : addDays(fnDate, 1)
    }));
  }

  const pricingPreview = useMemo(() => {
    const base = Math.max(0, Number(bookingForm.price) || 0);
    const dVal = Math.max(0, Number(bookingForm.discountValue) || 0);
    let discountAmount = 0;
    if (bookingForm.discountType === 'percentage') {
      discountAmount = Number(((base * Math.min(100, dVal)) / 100).toFixed(2));
    } else if (bookingForm.discountType === 'amount') {
      discountAmount = Math.min(base, dVal);
    }
    const finalPrice = Math.max(0, Number((base - discountAmount).toFixed(2)));
    const priceChanged = selectedProduct && bookingForm.price !== '' && Number(bookingForm.price) !== selectedProduct.price;
    return { base, discountAmount, finalPrice, priceChanged };
  }, [bookingForm.price, bookingForm.discountType, bookingForm.discountValue, selectedProduct]);

  async function handleCreateBooking(e) {
    e.preventDefault();
    setSubmittingBooking(true);
    try {
      const res = await createBooking({
        storeId: store.id,
        productId: Number(bookingForm.productId),
        customerName: bookingForm.customerName,
        customerPhone: bookingForm.customerPhone,
        functionDate: bookingForm.functionDate,
        collectionDate: bookingForm.collectionDate,
        returnDate: bookingForm.returnDate,
        price: Number(bookingForm.price),
        discountType: bookingForm.discountType,
        discountValue: Number(bookingForm.discountValue) || 0,
        notes: bookingForm.notes
      });

      const msg = res.inventoryPriceUpdated
        ? `Booking #${res.booking.id} confirmed! Inventory price updated to ${formatCurrency(res.booking.basePrice)}.`
        : `Booking #${res.booking.id} confirmed for ${res.booking.customerName}!`;
      showBanner('success', msg);
      setInvoiceBooking(res.booking);
      setBookingForm((prev) => ({
        ...prev,
        customerName: '',
        customerPhone: '',
        discountType: 'none',
        discountValue: '',
        notes: ''
      }));
      await loadAll();
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function handleStatusChange(bookingId, newStatus) {
    try {
      await updateBooking(bookingId, { status: newStatus });
      showBanner('success', `Booking #${bookingId} marked as ${newStatus}.`);
      await loadAll();
    } catch (err) {
      showBanner('error', err.message);
    }
  }

  async function handleDeleteBooking(bookingId) {
    if (!window.confirm(`Delete booking #${bookingId}?`)) return;
    try {
      await deleteBooking(bookingId);
      showBanner('success', `Booking #${bookingId} deleted.`);
      await loadAll();
    } catch (err) {
      showBanner('error', err.message);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await updateStoreProfile(store.id, settingsForm);
      persistStore(res.store);
      showBanner('success', 'Store profile & invoice details updated.');
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  function buildReturnReminderUrl(b, isOverdue) {
    const daysLate = isOverdue ? daysBetween(b.returnDate, today) : 0;
    const msg = isOverdue
      ? `Hello ${b.customerName}, this is a gentle reminder from *${store.name}* that your rented item *${b.productName}* was due for return on *${b.returnDate}* (${daysLate} day${daysLate === 1 ? '' : 's'} overdue). Please arrange the return at the earliest. Thank you!`
      : `Hello ${b.customerName}, this is a friendly reminder from *${store.name}* that your rented item *${b.productName}* is scheduled for return *today (${b.returnDate})*. Thank you!`;
    return buildWhatsAppUrl(b.customerPhone, msg);
  }

  // ========================
  // LOGIN / REGISTER SCREEN
  // ========================
  if (!store) {
    return (
      <div className="container" style={{ maxWidth: 540, marginTop: 24 }}>
        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              className={`btn ${authMode === 'login' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
            >
              Store Login
            </button>
            <button
              className={`btn ${authMode === 'register' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
            >
              Register New Store
            </button>
          </div>

          {authError && (
            <div className="alert alert-error">
              <AlertTriangle size={17} /> <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {authMode === 'register' && (
              <div className="field">
                <label>Store Name *</label>
                <input
                  required
                  placeholder="e.g. Royal Bridal Rentals"
                  value={authForm.name}
                  onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            )}

            <div className="field">
              <label>10-Digit Store Phone *</label>
              <input
                type="tel"
                required
                inputMode="numeric"
                maxLength={10}
                pattern="[0-9]{10}"
                placeholder="Enter 10-digit mobile number"
                value={authForm.phone}
                onChange={(e) =>
                  setAuthForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
                }
              />
            </div>

            <div className="field">
              <label>Password *</label>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={authForm.password}
                onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>

            {authMode === 'register' && (
              <>
                <div className="field">
                  <label>Store Address (shown on Invoice)</label>
                  <input
                    placeholder="Shop No, Street, City"
                    value={authForm.address}
                    onChange={(e) => setAuthForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>GSTIN (optional)</label>
                  <input
                    placeholder="22AAAAA0000A1Z5"
                    value={authForm.gstin}
                    onChange={(e) => setAuthForm((f) => ({ ...f, gstin: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Invoice Notes / Terms (optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Late return fee applies, security deposit terms..."
                    value={authForm.description}
                    onChange={(e) => setAuthForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </>
            )}

            <button type="submit" className="btn btn-gold" disabled={authLoading} style={{ marginTop: 6 }}>
              <Store size={16} />{' '}
              {authLoading ? 'Please wait...' : authMode === 'register' ? 'Create Store Account' : 'Sign In to Store'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ========================
  // STORE ADMIN DASHBOARD
  // ========================
  const customerStoreUrl = `${window.location.origin}/store/${store.storeHash}`;

  return (
    <div>
      {/* Single-Line Sticky Topbar */}
      <header className="topbar">
        <div
          className="topbar-inner"
          style={{
            padding: '10px 24px',
            flexWrap: 'nowrap',
            gap: 12,
            overflowX: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div className="brand-mark" style={{ width: 32, height: 32, fontSize: '1rem' }}>A</div>
            <span className="brand-title" style={{ whiteSpace: 'nowrap' }}>Aurelia</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{store.name}</span>
            <span className="badge badge-gold" style={{ whiteSpace: 'nowrap' }}>
              ID: {store.storeLoginId.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 200 }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>Customer Link:</span>
            <code
              style={{
                fontSize: '0.74rem',
                background: 'var(--surface-soft)',
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                maxWidth: 260,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {customerStoreUrl}
            </code>
            <button
              className="btn btn-outline btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => {
                navigator.clipboard.writeText(customerStoreUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
            >
              <Copy size={13} /> {copiedLink ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={customerStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
              style={{ textDecoration: 'none', flexShrink: 0 }}
            >
              <ExternalLink size={13} /> Open
            </a>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-gold btn-sm" onClick={openNewProductModal}>
              <Plus size={15} /> Add Product
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container">

      {banner && (
        <div className={`alert ${banner.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {banner.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{banner.text}</span>
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
          <Package size={16} /> Inventory ({products.length})
        </button>
        <button className={`tab-btn ${activeTab === 'book' ? 'active' : ''}`} onClick={() => setActiveTab('book')}>
          <CalendarPlus size={16} /> Book for Customer
        </button>
        <button className={`tab-btn ${activeTab === 'returns' ? 'active' : ''}`} onClick={() => setActiveTab('returns')}>
          <BellRing size={16} /> Returns &amp; Reminders
          {activeReturns.totalCount > 0 && (
            <span className="badge badge-red" style={{ marginLeft: 4 }}>{activeReturns.totalCount}</span>
          )}
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <History size={16} /> Booking History ({bookings.length})
        </button>
        <button className={`tab-btn ${activeTab === 'availability' ? 'active' : ''}`} onClick={() => setActiveTab('availability')}>
          <CalendarCheck size={16} /> Availability Check
        </button>
        <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
          <BarChart3 size={16} /> Sales Analysis
        </button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={16} /> Store &amp; Invoice Settings
        </button>
      </div>

      {/* TAB 1: INVENTORY */}
      {activeTab === 'inventory' && (
        <div>
          <div className="card" style={{ marginBottom: 20, padding: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <input
                style={{ flex: '1 1 200px', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)' }}
                placeholder="Search name, type, color, storage..."
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
              />
              <select
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)' }}
                value={invCategory}
                onChange={(e) => setInvCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Dress">Dress</option>
                <option value="Jewelry">Jewelry</option>
              </select>
              <select
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)' }}
                value={invColor}
                onChange={(e) => setInvColor(e.target.value)}
              >
                {invColorOptions.map((c) => (
                  <option key={c} value={c}>{c === 'All' ? 'All Colors' : c}</option>
                ))}
              </select>
              <select
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)' }}
                value={invType}
                onChange={(e) => setInvType(e.target.value)}
              >
                {invTypeOptions.map((t) => (
                  <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>
                ))}
              </select>
              <select
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)' }}
                value={invStatus}
                onChange={(e) => setInvStatus(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--ink-muted)' }}>Loading inventory...</p>
          ) : filteredProducts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 36 }}>
              <p style={{ color: 'var(--ink-muted)', marginTop: 0 }}>No products found. Click <strong>Add Product</strong> to get started.</p>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((p) => (
                <div className="product-card" key={p.id}>
                  <div className="product-img-wrap">
                    <div className="product-badges">
                      <span className={`badge ${p.isAvailable ? 'badge-green' : 'badge-red'}`}>
                        {p.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                      <span className={`badge ${p.priceVisible ? 'badge-gold' : 'badge-neutral'}`}>
                        {p.priceVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                        {p.priceVisible ? 'Price Shown' : 'Price Hidden'}
                      </span>
                    </div>
                    {p.imageUrl ? (
                      <img src={resolveImageUrl(p.imageUrl)} alt={p.name} />
                    ) : (
                      <Sparkles size={40} color="#b48332" />
                    )}
                  </div>
                  <div className="product-body">
                    <div className="product-meta">
                      <span className="badge badge-neutral">{p.category}</span>
                      <span className="badge badge-neutral">{p.type}</span>
                      <span className="badge badge-neutral">{p.color}</span>
                    </div>
                    <h3 className="product-title">{p.name}</h3>
                    <div className="product-price">{formatCurrency(p.price)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                      <MapPin size={14} color="var(--gold)" />
                      <span>Stored at: <strong>{p.storageLocation || 'Unassigned'}</strong></span>
                    </div>

                    <div className="product-actions">
                      <button className="btn btn-gold btn-sm" style={{ flex: 1 }} onClick={() => startBookingForProduct(p)}>
                        <CalendarPlus size={14} /> Book
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        title="Toggle customer price visibility"
                        onClick={() => handleQuickToggle(p, 'priceVisible')}
                      >
                        {p.priceVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button className="btn btn-outline btn-sm" title="Edit product" onClick={() => openEditProductModal(p)}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" title="Delete product" onClick={() => handleDeleteProduct(p)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BOOK FOR CUSTOMER */}
      {activeTab === 'book' && (
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Create Customer Booking</h2>
          <form onSubmit={handleCreateBooking} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Select Product *</label>
                <select
                  required
                  value={bookingForm.productId}
                  onChange={(e) => handleBookingProductChange(e.target.value)}
                >
                  <option value="">-- Choose a Dress or Jewelry Item --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type} · {p.color}) — {formatCurrency(p.price)} [{p.storageLocation || 'No loc'}]
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Customer Name *</label>
                <input
                  required
                  placeholder="e.g. Ananya Sharma"
                  value={bookingForm.customerName}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, customerName: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Customer WhatsApp / Phone</label>
                <input
                  placeholder="e.g. 9876543210"
                  value={bookingForm.customerPhone}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ background: 'var(--surface-soft)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <strong style={{ fontSize: '0.92rem' }}>Function &amp; Rental Dates (Auto: Collection -1 day, Return +1 day)</strong>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label className="toggle-row" style={{ padding: '6px 12px', background: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={bookingForm.editDates}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBookingForm((prev) => ({
                          ...prev,
                          editDates: checked,
                          collectionDate: checked ? prev.collectionDate : addDays(prev.functionDate, -1),
                          returnDate: checked ? prev.returnDate : addDays(prev.functionDate, 1)
                        }));
                      }}
                    />
                    <span>Edit Dates (Long Function)</span>
                  </label>
                  {bookingForm.editDates && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        setBookingForm((prev) => ({
                          ...prev,
                          collectionDate: addDays(prev.functionDate, -1),
                          returnDate: addDays(prev.functionDate, 1)
                        }))
                      }
                    >
                      <RotateCcw size={13} /> Reset -1/+1
                    </button>
                  )}
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Function Date *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.functionDate}
                    onChange={(e) => handleFunctionDateChange(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Collection Date {bookingForm.editDates ? '(Editable)' : '(Auto -1 day)'}</label>
                  <input
                    type="date"
                    required
                    disabled={!bookingForm.editDates}
                    value={bookingForm.collectionDate}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, collectionDate: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Return Date {bookingForm.editDates ? '(Editable)' : '(Auto +1 day)'}</label>
                  <input
                    type="date"
                    required
                    disabled={!bookingForm.editDates}
                    value={bookingForm.returnDate}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, returnDate: e.target.value }))}
                  />
                </div>
              </div>

              {availabilityStatus && (
                <div
                  className={`alert ${availabilityStatus.available ? 'alert-success' : 'alert-error'}`}
                  style={{ marginTop: 14, marginBottom: 0 }}
                >
                  {availabilityStatus.available ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  {availabilityStatus.available ? (
                    <span>Available for <strong>{bookingForm.collectionDate}</strong> to <strong>{bookingForm.returnDate}</strong>.</span>
                  ) : availabilityStatus.conflictingBooking ? (
                    <span>
                      Already booked from <strong>{availabilityStatus.conflictingBooking.collectionDate}</strong> to{' '}
                      <strong>{availabilityStatus.conflictingBooking.returnDate}</strong> by{' '}
                      <strong>{availabilityStatus.conflictingBooking.customerName}</strong>.
                    </span>
                  ) : (
                    <span>This product is currently marked Unavailable in inventory.</span>
                  )}
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Rental Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={bookingForm.price}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, price: e.target.value }))}
                />
                {pricingPreview.priceChanged && (
                  <span style={{ fontSize: '0.76rem', color: 'var(--gold-dark)', fontWeight: 600 }}>
                    Price changed from {formatCurrency(selectedProduct.price)} — inventory will also update automatically.
                  </span>
                )}
              </div>

              <div className="field">
                <label>Discount Type</label>
                <select
                  value={bookingForm.discountType}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, discountType: e.target.value, discountValue: '' }))}
                >
                  <option value="none">No Discount</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="amount">Fixed Amount (₹)</option>
                </select>
              </div>

              {bookingForm.discountType !== 'none' && (
                <div className="field">
                  <label>{bookingForm.discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount (₹)'}</label>
                  <input
                    type="number"
                    min="0"
                    max={bookingForm.discountType === 'percentage' ? '100' : undefined}
                    step="0.01"
                    placeholder="0"
                    value={bookingForm.discountValue}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                  />
                </div>
              )}

              <div className="field">
                <label>Notes</label>
                <input
                  placeholder="Alterations, deposit..."
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                borderRadius: 12,
                background: 'var(--gold-soft)',
                border: '1px solid #ebd5a7'
              }}
            >
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>Base Price</div>
                  <strong>{formatCurrency(pricingPreview.base)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>Discount</div>
                  <strong style={{ color: 'var(--emerald)' }}>- {formatCurrency(pricingPreview.discountAmount)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>Final Payable</div>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--gold-dark)' }}>{formatCurrency(pricingPreview.finalPrice)}</strong>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingBooking || (availabilityStatus && !availabilityStatus.available)}
              >
                <CalendarCheck size={17} /> {submittingBooking ? 'Confirming...' : 'Confirm Booking & Generate Invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: RETURNS & WHATSAPP REMINDERS */}
      {activeTab === 'returns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Overdue Returns */}
          <div className="card" style={{ borderColor: activeReturns.overdue.length ? '#fecdca' : undefined }}>
            <h2 style={{ marginTop: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} /> Crossed Return Date / Overdue ({activeReturns.overdue.length})
            </h2>
            {activeReturns.overdue.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', marginBottom: 0 }}>No overdue returns.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Return Date</th>
                      <th>Overdue By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReturns.overdue.map((b) => {
                      const lateDays = daysBetween(b.returnDate, today);
                      return (
                        <tr key={b.id}>
                          <td>
                            <strong>{b.customerName}</strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{b.customerPhone || 'No phone'}</div>
                          </td>
                          <td><strong>{b.productName}</strong></td>
                          <td><strong style={{ color: 'var(--danger)' }}>{b.returnDate}</strong></td>
                          <td><span className="badge badge-red">{lateDays} day{lateDays === 1 ? '' : 's'} late</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <a
                                href={buildReturnReminderUrl(b, true)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm"
                                style={{ background: '#16a34a', color: '#fff', textDecoration: 'none' }}
                              >
                                <MessageCircle size={14} /> Send WhatsApp Reminder
                              </a>
                              <button className="btn btn-outline btn-sm" onClick={() => handleStatusChange(b.id, 'Returned')}>
                                Mark Returned
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Today's Returns */}
          <div className="card">
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BellRing size={20} color="var(--gold)" /> Today&apos;s Returns — {today} ({activeReturns.dueToday.length})
            </h2>
            {activeReturns.dueToday.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', marginBottom: 0 }}>No items scheduled for return today.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Function Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReturns.dueToday.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.customerName}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{b.customerPhone || 'No phone'}</div>
                        </td>
                        <td><strong>{b.productName}</strong></td>
                        <td>{b.functionDate}</td>
                        <td><span className="badge badge-gold">{b.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <a
                              href={buildReturnReminderUrl(b, false)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{ background: '#16a34a', color: '#fff', textDecoration: 'none' }}
                            >
                              <MessageCircle size={14} /> Send WhatsApp Reminder
                            </a>
                            <button className="btn btn-outline btn-sm" onClick={() => handleStatusChange(b.id, 'Returned')}>
                              Mark Returned
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BOOKING HISTORY */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Booking History</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)' }}
                placeholder="Search customer or product..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              <select
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)' }}
                value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Collected">Collected</option>
                <option value="Returned">Returned</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <p style={{ color: 'var(--ink-muted)' }}>No bookings recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Product &amp; Storage</th>
                    <th>Customer</th>
                    <th>Function Date</th>
                    <th>Collection → Return</th>
                    <th>Pricing</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr key={b.id}>
                      <td>#{b.id}</td>
                      <td>
                        <strong>{b.productName}</strong>
                        <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                          {b.productType} · {b.productStorageLocation || 'Unassigned'}
                        </div>
                      </td>
                      <td>
                        <strong>{b.customerName}</strong>
                        <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>{b.customerPhone || '—'}</div>
                      </td>
                      <td><strong>{b.functionDate}</strong></td>
                      <td>{b.collectionDate} → {b.returnDate}</td>
                      <td>
                        <div><strong>{formatCurrency(b.finalPrice)}</strong></div>
                        {b.discountAmount > 0 && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--emerald)' }}>
                            Base {formatCurrency(b.basePrice)} (-{formatCurrency(b.discountAmount)})
                          </div>
                        )}
                      </td>
                      <td>
                        <select
                          value={b.status}
                          onChange={(e) => handleStatusChange(b.id, e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }}
                        >
                          <option value="Confirmed">Confirmed</option>
                          <option value="Collected">Collected</option>
                          <option value="Returned">Returned</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setInvoiceBooking(b)}>
                            <FileText size={14} /> Invoice
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBooking(b.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AVAILABILITY CHECKER */}
      {activeTab === 'availability' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>Availability Checker</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-sm ${availMode === 'functionDate' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAvailMode('functionDate')}
              >
                By Function Date
              </button>
              <button
                className={`btn btn-sm ${availMode === 'customRange' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAvailMode('customRange')}
              >
                Custom Range
              </button>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: 20 }}>
            {availMode === 'functionDate' ? (
              <div className="field">
                <label>Function Date (Checks {addDays(availDate, -1)} to {addDays(availDate, 1)})</label>
                <input type="date" value={availDate} onChange={(e) => setAvailDate(e.target.value)} />
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Start Date (Collection)</label>
                  <input type="date" value={availStart} onChange={(e) => setAvailStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>End Date (Return)</label>
                  <input type="date" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} />
                </div>
              </>
            )}
          </div>

          {availResult && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category / Color</th>
                    <th>Storage</th>
                    <th>Price</th>
                    <th>Status ({availResult.startDate} → {availResult.endDate})</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availResult.items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.type} · {item.color}</td>
                      <td>{item.storageLocation || '—'}</td>
                      <td>{formatCurrency(item.price)}</td>
                      <td>
                        {item.availableForDates ? (
                          <span className="badge badge-green">Available</span>
                        ) : item.conflictingBooking ? (
                          <span className="badge badge-red">
                            Booked ({item.conflictingBooking.collectionDate} → {item.conflictingBooking.returnDate} · {item.conflictingBooking.customerName})
                          </span>
                        ) : (
                          <span className="badge badge-neutral">Disabled in Inventory</span>
                        )}
                      </td>
                      <td>
                        {item.availableForDates && (
                          <button className="btn btn-gold btn-sm" onClick={() => startBookingForProduct(item)}>
                            Book Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SALES ANALYSIS */}
      {activeTab === 'analytics' && <SalesAnalytics bookings={bookings} />}

      {/* TAB 7: STORE & INVOICE SETTINGS */}
      {activeTab === 'settings' && (
        <div className="card" style={{ maxWidth: 680 }}>
          <h2 style={{ marginTop: 0 }}>Store &amp; Invoice Details</h2>
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label>Store Name *</label>
              <input
                required
                value={settingsForm.name}
                onChange={(e) => setSettingsForm((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Store Address</label>
              <input
                placeholder="Shop No, Street, City"
                value={settingsForm.address}
                onChange={(e) => setSettingsForm((s) => ({ ...s, address: e.target.value }))}
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>GSTIN</label>
                <input
                  placeholder="22AAAAA0000A1Z5"
                  value={settingsForm.gstin}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, gstin: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Store Phone</label>
                <input
                  placeholder="+91 98765 43210"
                  value={settingsForm.phone}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="field">
              <label>Invoice Footer / Terms / Additional Details</label>
              <textarea
                rows={3}
                placeholder="Any terms, deposit note, or extra details to print on invoices..."
                value={settingsForm.description}
                onChange={(e) => setSettingsForm((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Store Details'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL (no description field) */}
      {editingProduct !== null && (
        <div className="modal-backdrop" onClick={() => setEditingProduct(null)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct.id ? 'Edit Product' : 'Add New Product'}</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setEditingProduct(null)}>Close</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-grid">
                  <div className="field">
                    <label>Product Name *</label>
                    <input
                      required
                      placeholder="e.g. Royal Kundan Necklace"
                      value={productForm.name}
                      onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Category *</label>
                    <select
                      value={productForm.category}
                      onChange={(e) => {
                        const nextCat = e.target.value;
                        const defaultType = TYPES_BY_CATEGORY[nextCat]?.[0] || '';
                        setProductForm((p) => ({ ...p, category: nextCat, type: defaultType }));
                      }}
                    >
                      <option value="Dress">Dress</option>
                      <option value="Jewelry">Jewelry</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Type ({productForm.category}) *</label>
                    {addingType ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          autoFocus
                          placeholder={`New ${productForm.category.toLowerCase()} type...`}
                          value={newTypeInput}
                          onChange={(e) => setNewTypeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveNewType();
                            }
                          }}
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="btn btn-gold btn-sm" onClick={handleSaveNewType}>
                          Add
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setAddingType(false);
                            setNewTypeInput('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          required
                          style={{ flex: 1 }}
                          value={productForm.type}
                          onChange={(e) => {
                            if (e.target.value === '__add_new_type__') {
                              setAddingType(true);
                            } else {
                              setProductForm((p) => ({ ...p, type: e.target.value }));
                            }
                          }}
                        >
                          {availableTypesForCategory.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                          <option value="__add_new_type__">+ Add New Type...</option>
                        </select>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          title="Add a new type"
                          onClick={() => setAddingType(true)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="field">
                    <label>Color *</label>
                    {addingColor ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          autoFocus
                          placeholder="Enter new color name..."
                          value={newColorInput}
                          onChange={(e) => setNewColorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveNewColor();
                            }
                          }}
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="btn btn-gold btn-sm" onClick={handleSaveNewColor}>
                          Add
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setAddingColor(false);
                            setNewColorInput('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          required
                          style={{ flex: 1 }}
                          value={productForm.color}
                          onChange={(e) => {
                            if (e.target.value === '__add_new__') {
                              setAddingColor(true);
                            } else {
                              setProductForm((p) => ({ ...p, color: e.target.value }));
                            }
                          }}
                        >
                          {availableColors.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          <option value="__add_new__">+ Add New Color...</option>
                        </select>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          title="Add a new color"
                          onClick={() => setAddingColor(true)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="field">
                    <label>Rental Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={productForm.price}
                      onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Storage Location (Where Stored)</label>
                    <input
                      placeholder="e.g. Rack B - Section 04 / Vault A"
                      value={productForm.storageLocation}
                      onChange={(e) => setProductForm((p) => ({ ...p, storageLocation: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={productForm.priceVisible}
                      onChange={(e) => setProductForm((p) => ({ ...p, priceVisible: e.target.checked }))}
                    />
                    <span>Show Price to Customers</span>
                  </label>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={productForm.isAvailable}
                      onChange={(e) => setProductForm((p) => ({ ...p, isAvailable: e.target.checked }))}
                    />
                    <span>Product Active &amp; Available</span>
                  </label>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Upload Product Image (1:1 Square Crop)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) {
                          setCropFile(file);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>Or Image URL</label>
                    <input
                      placeholder="https://... or /uploads/..."
                      value={productForm.imageUrl}
                      onChange={(e) => {
                        setProductForm((p) => ({ ...p, imageUrl: e.target.value }));
                        if (!imageFile) setImagePreview(resolveImageUrl(e.target.value));
                      }}
                    />
                  </div>
                </div>

                {imagePreview && (
                  <div style={{ textAlign: 'center', background: 'var(--surface-soft)', padding: 12, borderRadius: 10 }}>
                    <img src={imagePreview} alt="Preview" style={{ maxHeight: 140, objectFit: 'contain' }} />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setEditingProduct(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={savingProduct}>
                    {savingProduct ? 'Saving...' : editingProduct.id ? 'Save Changes' : 'Add Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {invoiceBooking && (
        <InvoiceModal store={store} booking={invoiceBooking} onClose={() => setInvoiceBooking(null)} />
      )}

      {/* 1:1 SQUARE IMAGE CROPPER MODAL */}
      {cropFile && (
        <SquareImageCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={(croppedFile, previewUrl) => {
            setImageFile(croppedFile);
            setImagePreview(previewUrl);
            setCropFile(null);
          }}
        />
      )}
      </div>
    </div>
  );
}
