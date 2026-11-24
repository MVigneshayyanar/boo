import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Sparkles, Search, CheckCircle2, Tag, MapPin, Phone } from 'lucide-react';
import { addDays, todayStr, formatCurrency, resolveImageUrl, fetchProducts, fetchStoreByHash } from '../api.js';

export default function CustomerPage() {
  const { storeHash } = useParams();
  const [store, setStore] = useState(null);
  const [storeError, setStoreError] = useState('');

  const [requiredDate, setRequiredDate] = useState(addDays(todayStr(), 3));
  const [products, setProducts] = useState([]);
  const [windowInfo, setWindowInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [category, setCategory] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!storeHash) return;
    let cancelled = false;
    setStoreError('');
    fetchStoreByHash(storeHash)
      .then((res) => {
        if (!cancelled) setStore(res.store);
      })
      .catch((err) => {
        if (!cancelled) setStoreError(err.message || 'Store not found');
      });
    return () => {
      cancelled = true;
    };
  }, [storeHash]);

  useEffect(() => {
    if (!storeHash || !requiredDate) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchProducts({
      storeHash,
      date: requiredDate,
      customerView: 'true',
      availableOnly: 'true'
    })
      .then((res) => {
        if (!cancelled) {
          setProducts(res.items || []);
          setWindowInfo(res.window || null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeHash, requiredDate]);

  const colorOptions = useMemo(() => {
    const set = new Set(products.map((p) => p.color).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  const typeOptions = useMemo(() => {
    const scoped = category === 'All' ? products : products.filter((p) => p.category === category);
    const set = new Set(scoped.map((p) => p.type).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [products, category]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (category !== 'All' && p.category !== category) return false;
      if (colorFilter !== 'All' && p.color !== colorFilter) return false;
      if (typeFilter !== 'All' && p.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.color.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, category, colorFilter, typeFilter, search]);

  if (storeError) {
    return (
      <div className="container" style={{ maxWidth: 620, marginTop: 40 }}>
        <div className="card" style={{ textAlign: 'center', padding: 36 }}>
          <h2 style={{ marginTop: 0 }}>Store Not Found</h2>
          <p style={{ color: 'var(--ink-muted)' }}>{storeError}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {store && (
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <div className="brand-mark">{store.name.charAt(0).toUpperCase()}</div>
              <div>
                <div className="brand-title">{store.name}</div>
                <div className="brand-sub" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {store.address && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} /> {store.address}
                    </span>
                  )}
                  {store.phone && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={11} /> {store.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <div className="container">
        {/* Required Date & Filters — Single Line */}
        <div
          className="date-hero-card"
          style={{
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            overflowX: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Calendar size={15} color="var(--gold)" />
            <input
              type="date"
              aria-label="Required Function Date"
              title="Required Function Date"
              style={{
                padding: '7px 10px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                fontSize: '0.84rem',
                fontFamily: 'inherit'
              }}
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
            />
          </div>

          {windowInfo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                color: 'var(--ink-muted)',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <CheckCircle2 size={14} color="var(--emerald)" />
              <strong style={{ color: 'var(--emerald)' }}>{filteredProducts.length}</strong>
              <span>({windowInfo.startDate} → {windowInfo.endDate})</span>
            </div>
          )}

          <div style={{ position: 'relative', flex: '1 1 150px', minWidth: 130 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--ink-muted)' }} />
            <input
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                borderRadius: 9,
                border: '1px solid var(--border)',
                fontSize: '0.84rem'
              }}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {['All', 'Dress', 'Jewelry'].map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 10px' }}
                onClick={() => {
                  setCategory(cat);
                  setTypeFilter('All');
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <select
            style={{
              padding: '7px 10px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              fontSize: '0.82rem',
              flexShrink: 0
            }}
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
          >
            {colorOptions.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'All Colors' : c}</option>
            ))}
          </select>

          <select
            style={{
              padding: '7px 10px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              fontSize: '0.82rem',
              flexShrink: 0
            }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>
            ))}
          </select>

          {(category !== 'All' || colorFilter !== 'All' || typeFilter !== 'All' || search) && (
            <button
              className="btn btn-outline btn-sm"
              style={{ flexShrink: 0, padding: '6px 10px' }}
              onClick={() => {
                setCategory('All');
                setColorFilter('All');
                setTypeFilter('All');
                setSearch('');
              }}
            >
              Clear
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <p style={{ color: 'var(--ink-muted)' }}>Checking availability for {requiredDate}...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <h3 style={{ marginTop: 0 }}>No available pieces for {requiredDate}</h3>
            <p style={{ color: 'var(--ink-muted)' }}>Try choosing another date or clearing your search filter.</p>
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((p) => (
              <div className="product-card" key={p.id}>
                <div className="product-img-wrap">
                  {p.imageUrl ? (
                    <img src={resolveImageUrl(p.imageUrl)} alt={p.name} />
                  ) : (
                    <Sparkles size={34} color="#b48332" />
                  )}
                </div>

                <div className="product-body">
                  <div className="product-meta">
                    <span className="badge badge-neutral">{p.type}</span>
                    <span className="badge badge-neutral">{p.color}</span>
                  </div>
                  <h3 className="product-title">{p.name}</h3>

                  <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                    {p.priceVisible && p.price !== null ? (
                      <div className="product-price">{formatCurrency(p.price)}</div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.84rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
                        <Tag size={14} color="var(--gold)" /> Price on Request
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
