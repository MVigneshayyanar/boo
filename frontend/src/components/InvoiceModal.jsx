import React from 'react';
import { Printer, MessageCircle, X } from 'lucide-react';
import { formatCurrency, buildWhatsAppUrl } from '../api.js';

export default function InvoiceModal({ store, booking, onClose }) {
  if (!booking || !store) return null;

  const invoiceNo = `INV-${store.id}-${String(booking.id).padStart(4, '0')}`;
  const issuedDate = booking.createdAt ? booking.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const whatsappLines = [
    `*${store.name}* — Rental Invoice`,
    store.address ? `Address: ${store.address}` : null,
    store.gstin ? `GSTIN: ${store.gstin}` : null,
    store.phone ? `Store Phone: ${store.phone}` : null,
    `-------------------------`,
    `Invoice No: ${invoiceNo}`,
    `Date: ${issuedDate}`,
    `Customer: ${booking.customerName}${booking.customerPhone ? ` (${booking.customerPhone})` : ''}`,
    `-------------------------`,
    `Item: ${booking.productName} (${booking.productType} · ${booking.productColor})`,
    `Function Date: ${booking.functionDate}`,
    `Collection Date: ${booking.collectionDate}`,
    `Return Date: ${booking.returnDate}`,
    `-------------------------`,
    `Rental Price: ${formatCurrency(booking.basePrice)}`,
    booking.discountAmount > 0 ? `Discount: -${formatCurrency(booking.discountAmount)}` : null,
    `*Total Payable: ${formatCurrency(booking.finalPrice)}*`,
    store.description ? `\nNote: ${store.description}` : null,
    `\nThank you for choosing ${store.name}!`
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappHref = buildWhatsAppUrl(booking.customerPhone, whatsappLines);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Rental Invoice — {invoiceNo}</h2>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            <X size={16} /> Close
          </button>
        </div>

        <div className="modal-body">
          <div
            id="printable-invoice"
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              marginBottom: 18
            }}
          >
            {/* Store Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '2px solid var(--ink)', paddingBottom: 14, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '1.45rem' }}>{store.name}</h2>
                {store.address && <div style={{ fontSize: '0.84rem', color: 'var(--ink-muted)' }}>{store.address}</div>}
                {store.gstin && <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>GSTIN: {store.gstin}</div>}
                {store.phone && <div style={{ fontSize: '0.84rem', color: 'var(--ink-muted)' }}>Phone: {store.phone}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted)' }}>
                  Tax / Rental Invoice
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{invoiceNo}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>Date: {issuedDate}</div>
              </div>
            </div>

            {/* Customer & Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18, fontSize: '0.88rem' }}>
              <div>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Billed To</div>
                <div style={{ fontWeight: 700 }}>{booking.customerName}</div>
                <div>{booking.customerPhone || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Rental Schedule</div>
                <div>Function: <strong>{booking.functionDate}</strong></div>
                <div>Collection: <strong>{booking.collectionDate}</strong></div>
                <div>Return: <strong>{booking.returnDate}</strong></div>
              </div>
            </div>

            {/* Line Item */}
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category / Color</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>{booking.productName}</strong></td>
                  <td>{booking.productType} · {booking.productColor}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(booking.basePrice)}</td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: '0.9rem' }}>
              <div>Base Price: <strong>{formatCurrency(booking.basePrice)}</strong></div>
              {booking.discountAmount > 0 && (
                <div style={{ color: 'var(--emerald)' }}>
                  Discount ({booking.discountType === 'percentage' ? `${booking.discountValue}%` : 'Fixed'}):{' '}
                  <strong>-{formatCurrency(booking.discountAmount)}</strong>
                </div>
              )}
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gold-dark)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                Total Payable: {formatCurrency(booking.finalPrice)}
              </div>
            </div>

            {store.description && (
              <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px dashed var(--border)', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                {store.description}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={() => window.print()}>
              <Printer size={16} /> Print / Save PDF
            </button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-gold"
              style={{ textDecoration: 'none', background: '#16a34a' }}
            >
              <MessageCircle size={16} /> Share on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
