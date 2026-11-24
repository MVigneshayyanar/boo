import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { supabase, isSupabaseConfigured, SUPABASE_BUCKET } from './supabase.js';
import { ensureSeedAssets } from './seedAssets.js';

const app = express();
const PORT = process.env.PORT || 4000;
const uploadsDir = path.resolve('uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
ensureSeedAssets(uploadsDir);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(uploadsDir)
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

function requireSupabase(_req, res, next) {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({
      error: 'Supabase is not configured. Check backend/.env.'
    });
  }
  next();
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function addDays(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isValidDateStr(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function parseBool(val, fallback = true) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return Boolean(val);
  const s = String(val).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
}

async function uploadImageToSupabase(file) {
  const ext = path.extname(file.originalname) || '.png';
  const filePath = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype || 'image/png',
      upsert: false
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

function mapStoreRow(row) {
  return {
    id: row.id,
    storeLoginId: row.store_login_id,
    storeHash: row.store_hash,
    name: row.name,
    address: row.address || '',
    gstin: row.gstin || '',
    phone: row.phone || '',
    description: row.description || '',
    createdAt: row.created_at
  };
}

function mapProductRow(row, { customerView = false, conflictingBooking = null } = {}) {
  const priceVisible = Boolean(row.price_visible);
  const isAvailable = Boolean(row.is_available);
  const availableForDates = isAvailable && !conflictingBooking;

  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    category: row.category,
    type: row.type,
    color: row.color,
    price: customerView && !priceVisible ? null : Number(row.price),
    priceVisible,
    isAvailable,
    storageLocation: row.storage_location || '',
    imageUrl: row.image_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    availableForDates,
    conflictingBooking: customerView ? null : conflictingBooking
  };
}

function mapBookingRow(row) {
  const prod = row.products || {};
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || '',
    functionDate: row.function_date,
    collectionDate: row.collection_date,
    returnDate: row.return_date,
    basePrice: Number(row.base_price),
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    discountAmount: Number(row.discount_amount),
    finalPrice: Number(row.final_price),
    status: row.status,
    notes: row.notes || '',
    createdAt: row.created_at,
    productName: prod.name || '',
    productCategory: prod.category || '',
    productType: prod.type || '',
    productColor: prod.color || '',
    productStorageLocation: prod.storage_location || '',
    productImageUrl: prod.image_url || ''
  };
}

async function resolveStoreIdFromQuery(query) {
  if (query.storeId) return Number(query.storeId);
  if (query.storeHash) {
    const { data, error } = await supabase
      .from('stores')
      .select('id')
      .eq('store_hash', String(query.storeHash))
      .maybeSingle();
    if (error) throw error;
    return data ? data.id : null;
  }
  return null;
}

async function findConflictingBooking(productId, startDate, endDate, excludeBookingId = null) {
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('product_id', productId)
    .neq('status', 'Cancelled')
    .lte('collection_date', endDate)
    .gte('return_date', startDate)
    .order('collection_date', { ascending: true })
    .limit(1);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data && data.length > 0 ? mapBookingRow(data[0]) : null;
}

async function fetchConflictsMap(startDate, endDate, storeId = null) {
  let query = supabase
    .from('bookings')
    .select('*')
    .neq('status', 'Cancelled')
    .lte('collection_date', endDate)
    .gte('return_date', startDate)
    .order('collection_date', { ascending: true });

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.product_id)) {
      map.set(row.product_id, mapBookingRow(row));
    }
  }
  return map;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    backend: 'supabase',
    supabaseConfigured: isSupabaseConfigured,
    timestamp: new Date().toISOString()
  });
});

// ========================
// STORE AUTH & MANAGEMENT
// ========================

// Register a new store (10-digit phone mandatory, auto-generates Store ID & SHA-256 storeHash)
app.post('/api/stores/register', requireSupabase, async (req, res) => {
  try {
    const {
      password,
      name,
      address = '',
      gstin = '',
      phone = '',
      description = ''
    } = req.body;

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!password || !name || !/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Store Name, a valid 10-digit Phone Number, and Password are required' });
    }

    const { data: existingPhone, error: phoneErr } = await supabase
      .from('stores')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (phoneErr) throw phoneErr;
    if (existingPhone) {
      return res.status(409).json({ error: 'A store is already registered with this 10-digit phone number. Please log in.' });
    }

    // Auto-generate a clean unique Store ID (e.g. str-4f8a21)
    let cleanLoginId = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `str-${crypto.randomBytes(3).toString('hex')}`;
      const { data: existing, error: checkErr } = await supabase
        .from('stores')
        .select('id')
        .eq('store_login_id', candidate)
        .maybeSingle();
      if (checkErr) throw checkErr;
      if (!existing) {
        cleanLoginId = candidate;
        break;
      }
    }
    if (!cleanLoginId) {
      cleanLoginId = `str-${Date.now().toString(36)}`;
    }

    const passwordHash = sha256(password);
    const storeHash = sha256(`${cleanLoginId}:${cleanPhone}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`);

    const { data, error } = await supabase
      .from('stores')
      .insert({
        store_login_id: cleanLoginId,
        password_hash: passwordHash,
        store_hash: storeHash,
        name: String(name).trim(),
        address: String(address).trim(),
        gstin: String(gstin).trim(),
        phone: cleanPhone,
        description: String(description).trim()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ store: mapStoreRow(data) });
  } catch (err) {
    console.error('POST /api/stores/register error:', err);
    res.status(500).json({ error: err.message || 'Failed to register store' });
  }
});

// Store Login (via 10-digit phone + password)
app.post('/api/stores/login', requireSupabase, async (req, res) => {
  try {
    const { phone, password } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(cleanPhone) || !password) {
      return res.status(400).json({ error: 'Valid 10-digit Phone Number and Password are required' });
    }

    const passwordHash = sha256(password);

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.password_hash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid Phone Number or Password' });
    }

    res.json({ store: mapStoreRow(data) });
  } catch (err) {
    console.error('POST /api/stores/login error:', err);
    res.status(500).json({ error: err.message || 'Failed to login' });
  }
});

// Get public store info by SHA-256 hash (for /store/:storeHash customer route)
app.get('/api/stores/by-hash/:storeHash', requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('id, store_hash, name, address, gstin, phone, description')
      .eq('store_hash', String(req.params.storeHash))
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Store not found' });

    res.json({
      store: {
        id: data.id,
        storeHash: data.store_hash,
        name: data.name,
        address: data.address || '',
        gstin: data.gstin || '',
        phone: data.phone || '',
        description: data.description || ''
      }
    });
  } catch (err) {
    console.error('GET /api/stores/by-hash error:', err);
    res.status(500).json({ error: err.message || 'Failed to load store' });
  }
});

// Update store profile (name, address, gstin, phone, description)
app.put('/api/stores/:id', requireSupabase, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, gstin, phone, description } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = String(name).trim();
    if (address !== undefined) updates.address = String(address).trim();
    if (gstin !== undefined) updates.gstin = String(gstin).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (description !== undefined) updates.description = String(description).trim();

    const { data, error } = await supabase.from('stores').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ store: mapStoreRow(data) });
  } catch (err) {
    console.error('PUT /api/stores/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to update store profile' });
  }
});

// ========================
// PRODUCTS (SCOPED BY STORE)
// ========================

app.get('/api/products', requireSupabase, async (req, res) => {
  try {
    const {
      date,
      startDate: qStart,
      endDate: qEnd,
      category,
      type,
      color,
      search,
      customerView,
      availableOnly
    } = req.query;

    const storeId = await resolveStoreIdFromQuery(req.query);
    if ((req.query.storeHash || req.query.storeId) && !storeId) {
      return res.status(404).json({ error: 'Store not found' });
    }

    let startDate = null;
    let endDate = null;
    if (isValidDateStr(qStart) && isValidDateStr(qEnd)) {
      startDate = qStart;
      endDate = qEnd;
    } else if (isValidDateStr(date)) {
      startDate = addDays(date, -1);
      endDate = addDays(date, 1);
    }

    let query = supabase.from('products').select('*').order('id', { ascending: false });
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    if (category && category !== 'All') {
      query = query.ilike('category', category);
    }
    if (type && type !== 'All') {
      query = query.ilike('type', type);
    }
    if (color && color !== 'All') {
      query = query.ilike('color', `%${color}%`);
    }
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,type.ilike.%${search}%,color.ilike.%${search}%,storage_location.ilike.%${search}%`
      );
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const conflictsMap = startDate && endDate ? await fetchConflictsMap(startDate, endDate, storeId) : new Map();
    const isCustomer = customerView === 'true' || customerView === '1';

    let items = (rows || []).map((row) =>
      mapProductRow(row, {
        customerView: isCustomer,
        conflictingBooking: conflictsMap.get(row.id) || null
      })
    );

    if (availableOnly === 'true' || availableOnly === '1') {
      items = items.filter((item) => item.availableForDates);
    }

    res.json({
      items,
      window: startDate && endDate ? { startDate, endDate } : null
    });
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ error: err.message || 'Failed to load products' });
  }
});

app.post('/api/products', requireSupabase, upload.single('image'), async (req, res) => {
  try {
    const {
      storeId,
      name,
      category = 'Dress',
      type,
      color,
      price,
      priceVisible = true,
      isAvailable = true,
      storageLocation = '',
      imageUrl = ''
    } = req.body;

    if (!storeId || !name || !type || !color || price === undefined || price === '') {
      return res.status(400).json({ error: 'storeId, name, type, color, and price are required' });
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number' });
    }

    const finalImageUrl = req.file ? await uploadImageToSupabase(req.file) : String(imageUrl).trim();

    const { data, error } = await supabase
      .from('products')
      .insert({
        store_id: Number(storeId),
        name: String(name).trim(),
        category: String(category).trim(),
        type: String(type).trim(),
        color: String(color).trim(),
        price: numericPrice,
        price_visible: parseBool(priceVisible, true),
        is_available: parseBool(isAvailable, true),
        storage_location: String(storageLocation).trim(),
        image_url: finalImageUrl,
        description: ''
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(mapProductRow(data));
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: err.message || 'Failed to create product' });
  }
});

app.put('/api/products/:id', requireSupabase, upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { data: existing, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const price =
      req.body.price !== undefined && req.body.price !== '' ? Number(req.body.price) : Number(existing.price);
    if (Number.isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number' });
    }

    const imageUrl = req.file
      ? await uploadImageToSupabase(req.file)
      : req.body.imageUrl !== undefined
        ? String(req.body.imageUrl).trim()
        : existing.image_url;

    const updates = {
      name: req.body.name !== undefined ? String(req.body.name).trim() : existing.name,
      category: req.body.category !== undefined ? String(req.body.category).trim() : existing.category,
      type: req.body.type !== undefined ? String(req.body.type).trim() : existing.type,
      color: req.body.color !== undefined ? String(req.body.color).trim() : existing.color,
      price,
      price_visible: parseBool(req.body.priceVisible, existing.price_visible),
      is_available: parseBool(req.body.isAvailable, existing.is_available),
      storage_location:
        req.body.storageLocation !== undefined ? String(req.body.storageLocation).trim() : existing.storage_location,
      image_url: imageUrl,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json(mapProductRow(data));
  } catch (err) {
    console.error('PUT /api/products/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to update product' });
  }
});

app.delete('/api/products/:id', requireSupabase, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    res.json({ deleted: true, id });
  } catch (err) {
    console.error('DELETE /api/products/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete product' });
  }
});

// ========================
// AVAILABILITY & BOOKINGS
// ========================

app.get('/api/availability', requireSupabase, async (req, res) => {
  try {
    const { productId, date, startDate: qStart, endDate: qEnd } = req.query;
    const storeId = await resolveStoreIdFromQuery(req.query);

    let startDate = qStart;
    let endDate = qEnd;
    if ((!isValidDateStr(startDate) || !isValidDateStr(endDate)) && isValidDateStr(date)) {
      startDate = addDays(date, -1);
      endDate = addDays(date, 1);
    }

    if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) {
      return res.status(400).json({ error: 'Provide a valid date or startDate & endDate (YYYY-MM-DD)' });
    }

    if (productId) {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', Number(productId))
        .maybeSingle();

      if (error) throw error;
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const conflict = await findConflictingBooking(product.id, startDate, endDate);
      const formatted = mapProductRow(product, { conflictingBooking: conflict });
      return res.json({
        productId: product.id,
        startDate,
        endDate,
        available: formatted.availableForDates,
        productActive: formatted.isAvailable,
        conflictingBooking: formatted.conflictingBooking
      });
    }

    let query = supabase.from('products').select('*').order('id', { ascending: false });
    if (storeId) query = query.eq('store_id', storeId);

    const { data: rows, error } = await query;
    if (error) throw error;

    const conflictsMap = await fetchConflictsMap(startDate, endDate, storeId);
    const items = (rows || []).map((row) =>
      mapProductRow(row, { conflictingBooking: conflictsMap.get(row.id) || null })
    );

    res.json({ startDate, endDate, items });
  } catch (err) {
    console.error('GET /api/availability error:', err);
    res.status(500).json({ error: err.message || 'Failed to check availability' });
  }
});

app.get('/api/bookings', requireSupabase, async (req, res) => {
  try {
    const { status, productId } = req.query;
    const storeId = await resolveStoreIdFromQuery(req.query);

    let query = supabase
      .from('bookings')
      .select('*, products(name, category, type, color, storage_location, image_url)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (storeId) query = query.eq('store_id', storeId);
    if (status && status !== 'All') query = query.eq('status', status);
    if (productId) query = query.eq('product_id', Number(productId));

    const { data, error } = await query;
    if (error) throw error;
    res.json({ items: (data || []).map(mapBookingRow) });
  } catch (err) {
    console.error('GET /api/bookings error:', err);
    res.status(500).json({ error: err.message || 'Failed to load bookings' });
  }
});

app.post('/api/bookings', requireSupabase, async (req, res) => {
  try {
    const {
      storeId,
      productId,
      customerName,
      customerPhone = '',
      functionDate,
      collectionDate: customCollectionDate,
      returnDate: customReturnDate,
      price,
      discountType = 'none',
      discountValue = 0,
      notes = ''
    } = req.body;

    if (!productId || !customerName || !isValidDateStr(functionDate)) {
      return res.status(400).json({ error: 'productId, customerName, and valid functionDate (YYYY-MM-DD) are required' });
    }

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', Number(productId))
      .maybeSingle();

    if (prodErr) throw prodErr;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const resolvedStoreId = Number(storeId || product.store_id);
    const collectionDate = isValidDateStr(customCollectionDate) ? customCollectionDate : addDays(functionDate, -1);
    const returnDate = isValidDateStr(customReturnDate) ? customReturnDate : addDays(functionDate, 1);

    if (collectionDate > returnDate) {
      return res.status(400).json({ error: 'Collection date cannot be after return date' });
    }

    const conflict = await findConflictingBooking(product.id, collectionDate, returnDate);
    if (conflict) {
      return res.status(409).json({
        error: `Product is already booked from ${conflict.collectionDate} to ${conflict.returnDate} by ${conflict.customerName}`,
        conflictingBooking: conflict
      });
    }

    const basePrice = price !== undefined && price !== '' ? Number(price) : Number(product.price);
    if (Number.isNaN(basePrice) || basePrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number' });
    }

    let inventoryPriceUpdated = false;
    if (basePrice !== Number(product.price)) {
      const { error: updErr } = await supabase
        .from('products')
        .update({ price: basePrice, updated_at: new Date().toISOString() })
        .eq('id', product.id);
      if (updErr) throw updErr;
      inventoryPriceUpdated = true;
    }

    const dVal = Math.max(0, Number(discountValue) || 0);
    let discountAmount = 0;
    if (discountType === 'percentage') {
      const clampedPct = Math.min(100, dVal);
      discountAmount = Number(((basePrice * clampedPct) / 100).toFixed(2));
    } else if (discountType === 'amount') {
      discountAmount = Math.min(basePrice, Number(dVal.toFixed(2)));
    }
    const finalPrice = Math.max(0, Number((basePrice - discountAmount).toFixed(2)));

    const { data: created, error: insErr } = await supabase
      .from('bookings')
      .insert({
        store_id: resolvedStoreId,
        product_id: product.id,
        customer_name: String(customerName).trim(),
        customer_phone: String(customerPhone).trim(),
        function_date: functionDate,
        collection_date: collectionDate,
        return_date: returnDate,
        base_price: basePrice,
        discount_type: discountType,
        discount_value: dVal,
        discount_amount: discountAmount,
        final_price: finalPrice,
        status: 'Confirmed',
        notes: String(notes).trim()
      })
      .select('*, products(name, category, type, color, storage_location, image_url)')
      .single();

    if (insErr) throw insErr;
    res.status(201).json({ booking: mapBookingRow(created), inventoryPriceUpdated });
  } catch (err) {
    console.error('POST /api/bookings error:', err);
    res.status(500).json({ error: err.message || 'Failed to create booking' });
  }
});

app.patch('/api/bookings/:id', requireSupabase, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { data: existing, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const status = req.body.status || existing.status;
    const functionDate = isValidDateStr(req.body.functionDate) ? req.body.functionDate : existing.function_date;
    const collectionDate = isValidDateStr(req.body.collectionDate) ? req.body.collectionDate : existing.collection_date;
    const returnDate = isValidDateStr(req.body.returnDate) ? req.body.returnDate : existing.return_date;
    const notes = req.body.notes !== undefined ? String(req.body.notes).trim() : existing.notes;

    if (collectionDate > returnDate) {
      return res.status(400).json({ error: 'Collection date cannot be after return date' });
    }

    if (status !== 'Cancelled') {
      const conflict = await findConflictingBooking(existing.product_id, collectionDate, returnDate, id);
      if (conflict) {
        return res.status(409).json({
          error: `Dates overlap with booking #${conflict.id} (${conflict.collectionDate} to ${conflict.returnDate})`,
          conflictingBooking: conflict
        });
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({
        status,
        function_date: functionDate,
        collection_date: collectionDate,
        return_date: returnDate,
        notes
      })
      .eq('id', id)
      .select('*, products(name, category, type, color, storage_location, image_url)')
      .single();

    if (updErr) throw updErr;
    res.json(mapBookingRow(updated));
  } catch (err) {
    console.error('PATCH /api/bookings/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to update booking' });
  }
});

app.delete('/api/bookings/:id', requireSupabase, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw error;
    res.json({ deleted: true, id });
  } catch (err) {
    console.error('DELETE /api/bookings/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete booking' });
  }
});

app.listen(PORT, () => {
  console.log(`Atelier Rental Backend (Supabase Multi-Store) running on http://localhost:${PORT}`);
});
