import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Eye, Printer, Share2, Save, AlertTriangle,
  Search, X, ChevronDown, Receipt,
} from 'lucide-react';
import { billingAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const LOGO_URL = '/icons/selvam-logo.png';

const today = () => new Date().toISOString().slice(0, 10);

const emptyLine = { item_name: '', quantity: '', rate: '' };

export default function BillingEntry() {
  const { user, isAdmin } = useAuth();

  // ── configurable items ──
  const [billingItems, setBillingItems] = useState([]);

  // ── form state ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPlace, setCustomerPlace] = useState('');
  const [billDate, setBillDate] = useState(today());
  const [taxPct, setTaxPct] = useState(0);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([{ ...emptyLine }]);

  // ── suggestions ──
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimeout = useRef(null);

  // ── preview / bill ──
  const [previewBill, setPreviewBill] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // ── loading ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const printRef = useRef(null);

  useEffect(() => {
    billingAPI.getItems().then(r => setBillingItems(r.data || [])).catch(() => {});
  }, []);

  // ── customer auto-complete ──
  const handleCustomerNameChange = (val) => {
    setCustomerName(val);
    if (val.length >= 2) {
      clearTimeout(suggestTimeout.current);
      suggestTimeout.current = setTimeout(async () => {
        try {
          const r = await billingAPI.suggestCustomers(val);
          setSuggestions(r.data || []);
          setShowSuggestions(true);
        } catch { setSuggestions([]); }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const pickSuggestion = (s) => {
    setCustomerName(s.customer_name || '');
    setCustomerPhone(s.customer_phone || '');
    setCustomerPlace(s.customer_place || '');
    setShowSuggestions(false);
  };

  // ── line items ──
  const updateLine = (idx, field, value) => {
    setLineItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      // auto-fill rate from billing items
      if (field === 'item_name') {
        const match = billingItems.find(i => i.name === value);
        if (match && !copy[idx].rate) copy[idx].rate = match.default_rate;
      }
      return copy;
    });
  };
  const addLine = () => setLineItems(prev => [...prev, { ...emptyLine }]);
  const removeLine = (idx) => setLineItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));

  const subtotal = lineItems.reduce((s, li) => s + (parseFloat(li.quantity) || 0) * (parseFloat(li.rate) || 0), 0);
  const taxAmount = subtotal * (parseFloat(taxPct) || 0) / 100;
  const total = subtotal + taxAmount;

  // ── duplicate check ──
  const checkDuplicate = useCallback(async () => {
    if (!customerName || !billDate) return;
    try {
      const r = await billingAPI.searchBills({ customer_name: customerName, bill_date: billDate });
      const existing = r.data?.bills || [];
      if (existing.length > 0) {
        const similar = existing.find(b => Math.abs(b.total_amount - total) < 1);
        if (similar) {
          setDuplicateWarning(`Duplicate? Bill ${similar.bill_number} (₹${similar.total_amount}) exists for this customer on this date.`);
          return;
        }
      }
      setDuplicateWarning(null);
    } catch { /* ignore */ }
  }, [customerName, billDate, total]);

  useEffect(() => { checkDuplicate(); }, [checkDuplicate]);

  // ── save bill ──
  const handleSave = async () => {
    setError('');
    const validLines = lineItems.filter(li => li.item_name && li.quantity && li.rate);
    if (!customerName) return setError('Customer name is required');
    if (validLines.length === 0) return setError('Add at least one item');

    setSaving(true);
    try {
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_place: customerPlace,
        bill_date: billDate,
        tax_percentage: parseFloat(taxPct) || 0,
        notes: notes || null,
        line_items: validLines.map(li => ({
          item_name: li.item_name,
          quantity: parseFloat(li.quantity),
          rate: parseFloat(li.rate),
        })),
      };
      const r = await billingAPI.createBill(payload);
      setPreviewBill(r.data);
      setShowPreview(true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  };

  // ── finalize ──
  const handleFinalize = async () => {
    if (!previewBill) return;
    try {
      const r = await billingAPI.updateStatus(previewBill.id, 'finalized');
      setPreviewBill(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to finalize');
    }
  };

  // ── print ──
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Bill - ${previewBill?.bill_number || ''}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; }
        .bill-container { max-width: 420px; margin: 0 auto; }
        .bill-header { text-align: center; border-bottom: 2px dashed #8B4513; padding-bottom: 12px; margin-bottom: 12px; }
        .bill-logo { width: 80px; height: 80px; margin: 0 auto 8px; border-radius: 50%; object-fit: cover; }
        .bill-title { font-size: 20px; font-weight: 700; color: #5D3A1A; }
        .bill-subtitle { font-size: 11px; color: #8B6914; letter-spacing: 1.5px; }
        .bill-info { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; }
        .bill-info-block { line-height: 1.6; }
        .bill-info-label { color: #888; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { background: #F5E6D3; color: #5D3A1A; font-size: 11px; padding: 6px 8px; text-align: left; text-transform: uppercase; letter-spacing: .5px; }
        td { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #eee; }
        .text-right { text-align: right; }
        .totals { border-top: 2px solid #D4A574; margin-top: 4px; padding-top: 8px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
        .total-row.grand { font-size: 16px; font-weight: 700; color: #5D3A1A; border-top: 2px dashed #8B4513; padding-top: 8px; margin-top: 4px; }
        .bill-footer { text-align: center; border-top: 2px dashed #8B4513; margin-top: 16px; padding-top: 10px; font-size: 11px; color: #888; }
        .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }
        .status-finalized { background: #DEF7EC; color: #03543F; }
        .status-draft { background: #FEF3C7; color: #92400E; }
        .status-paid { background: #DBEAFE; color: #1E40AF; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${printContent.innerHTML}
      <script>window.print();window.close();</script>
      </body></html>
    `);
    win.document.close();
  };

  // ── share via WhatsApp ──
  const handleShare = () => {
    if (!previewBill) return;
    const lines = previewBill.line_items.map(
      li => `  ${li.item_name}: ${li.quantity} × ₹${li.rate} = ₹${li.amount.toFixed(2)}`
    );
    const text = [
      `🧾 *Selvam Tea Stall*`,
      `Bill No: ${previewBill.bill_number}`,
      `Date: ${previewBill.bill_date}`,
      ``,
      `Customer: ${previewBill.customer_name}`,
      previewBill.customer_phone ? `Phone: ${previewBill.customer_phone}` : '',
      previewBill.customer_place ? `Place: ${previewBill.customer_place}` : '',
      ``,
      `Items:`,
      ...lines,
      ``,
      `Subtotal: ₹${previewBill.subtotal.toFixed(2)}`,
      previewBill.tax_amount > 0 ? `Tax (${previewBill.tax_percentage}%): ₹${previewBill.tax_amount.toFixed(2)}` : '',
      `*Total: ₹${previewBill.total_amount.toFixed(2)}*`,
      ``,
      `Thank you for your order!`,
    ].filter(Boolean).join('\n');

    const phone = previewBill.customer_phone?.replace(/\D/g, '') || '';
    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // ── reset form ──
  const resetForm = () => {
    setCustomerName(''); setCustomerPhone(''); setCustomerPlace('');
    setBillDate(today()); setTaxPct(0); setNotes('');
    setLineItems([{ ...emptyLine }]);
    setPreviewBill(null); setShowPreview(false);
    setDuplicateWarning(null); setError('');
  };

  // ── Bill Preview Component ──
  const BillPreviewContent = ({ bill }) => (
    <div className="bill-container" ref={printRef}>
      <div className="bill-header" style={{ textAlign: 'center', borderBottom: '2px dashed #8B4513', paddingBottom: 12, marginBottom: 12 }}>
        <img src={LOGO_URL} alt="Logo" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 8px' }}
          onError={e => { e.target.style.display = 'none'; }} />
        <div style={{ fontSize: 20, fontWeight: 700, color: '#5D3A1A' }}>Selvam Tea Stall</div>
        <div style={{ fontSize: 11, color: '#8B6914', letterSpacing: 1.5 }}>TEA • COFFEE • SNACKS</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
        <div style={{ lineHeight: 1.6 }}>
          <div><span style={{ color: '#888' }}>Bill No:</span> <strong>{bill.bill_number}</strong></div>
          <div><span style={{ color: '#888' }}>Date:</span> {bill.bill_date}</div>
          <div>
            <span style={{ color: '#888' }}>Status:</span>{' '}
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600,
              background: bill.status === 'finalized' ? '#DEF7EC' : bill.status === 'paid' ? '#DBEAFE' : '#FEF3C7',
              color: bill.status === 'finalized' ? '#03543F' : bill.status === 'paid' ? '#1E40AF' : '#92400E',
            }}>{bill.status.toUpperCase()}</span>
          </div>
        </div>
        <div style={{ lineHeight: 1.6, textAlign: 'right' }}>
          <div><strong>{bill.customer_name}</strong></div>
          {bill.customer_phone && <div>{bill.customer_phone}</div>}
          {bill.customer_place && <div>{bill.customer_place}</div>}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
        <thead>
          <tr>
            <th style={{ background: '#F5E6D3', color: '#5D3A1A', fontSize: 11, padding: '6px 8px', textAlign: 'left' }}>Item</th>
            <th style={{ background: '#F5E6D3', color: '#5D3A1A', fontSize: 11, padding: '6px 8px', textAlign: 'right' }}>Qty</th>
            <th style={{ background: '#F5E6D3', color: '#5D3A1A', fontSize: 11, padding: '6px 8px', textAlign: 'right' }}>Rate</th>
            <th style={{ background: '#F5E6D3', color: '#5D3A1A', fontSize: 11, padding: '6px 8px', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.line_items.map((li, i) => (
            <tr key={i}>
              <td style={{ padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #eee' }}>{li.item_name}</td>
              <td style={{ padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #eee', textAlign: 'right' }}>{li.quantity}</td>
              <td style={{ padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #eee', textAlign: 'right' }}>₹{li.rate.toFixed(2)}</td>
              <td style={{ padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #eee', textAlign: 'right' }}>₹{li.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '2px solid #D4A574', marginTop: 4, paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
          <span>Subtotal</span><span>₹{bill.subtotal.toFixed(2)}</span>
        </div>
        {bill.tax_amount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
            <span>Tax ({bill.tax_percentage}%)</span><span>₹{bill.tax_amount.toFixed(2)}</span>
          </div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 16,
          fontWeight: 700, color: '#5D3A1A', borderTop: '2px dashed #8B4513', marginTop: 4,
        }}>
          <span>Total</span><span>₹{bill.total_amount.toFixed(2)}</span>
        </div>
      </div>

      {bill.notes && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#666', fontStyle: 'italic' }}>Note: {bill.notes}</div>
      )}

      <div style={{ textAlign: 'center', borderTop: '2px dashed #8B4513', marginTop: 16, paddingTop: 10, fontSize: 11, color: '#888' }}>
        Thank you for your order!<br />Selvam Tea Stall
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt className="text-amber-600" /> New Bill
        </h1>
        {previewBill && (
          <button onClick={resetForm} className="btn btn-secondary text-sm">
            <Plus size={16} /> New Bill
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm">{error}</div>
      )}

      {duplicateWarning && !showPreview && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 p-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {duplicateWarning}
        </div>
      )}

      {/* ── Bill Preview Modal ── */}
      {showPreview && previewBill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b flex items-center justify-between z-10">
              <h2 className="font-bold text-lg">Bill Preview</h2>
              <button onClick={() => setShowPreview(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <BillPreviewContent bill={previewBill} />
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t flex flex-wrap gap-2 justify-end">
              {previewBill.status === 'draft' && isAdmin && (
                <button onClick={handleFinalize} className="btn bg-green-600 hover:bg-green-700 text-white text-sm">
                  Finalize
                </button>
              )}
              <button onClick={handlePrint} className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
                <Printer size={15} /> Print
              </button>
              <button onClick={handleShare} className="btn bg-green-500 hover:bg-green-600 text-white text-sm flex items-center gap-1">
                <Share2 size={15} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Form ── */}
      {!showPreview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer details */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Customer Details</h3>

              <div className="space-y-3">
                <div className="relative">
                  <label className="label">Customer Name *</label>
                  <input type="text" value={customerName}
                    onChange={e => handleCustomerNameChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="input" placeholder="Enter customer name" autoComplete="off" />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-700 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <button key={i} onMouseDown={() => pickSuggestion(s)}
                          className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-gray-600 text-sm">
                          <div className="font-medium">{s.customer_name}</div>
                          <div className="text-xs text-gray-500">{s.customer_phone} • {s.customer_place}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Phone</label>
                  <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                    className="input" placeholder="Phone number" />
                </div>

                <div>
                  <label className="label">Place</label>
                  <input type="text" value={customerPlace} onChange={e => setCustomerPlace(e.target.value)}
                    className="input" placeholder="City / Area" />
                </div>

                <div>
                  <label className="label">Bill Date *</label>
                  <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="input" />
                </div>

                <div>
                  <label className="label">Tax %</label>
                  <input type="number" value={taxPct} onChange={e => setTaxPct(e.target.value)}
                    className="input" placeholder="0" min="0" step="0.5" />
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    className="input" rows={2} placeholder="Any additional notes..." />
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Items</h3>
                <button onClick={addLine} className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                  <Plus size={14} /> Add Item
                </button>
              </div>

              <div className="space-y-3">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase px-1">
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Rate (₹)</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1"></div>
                </div>

                {lineItems.map((li, idx) => {
                  const amt = (parseFloat(li.quantity) || 0) * (parseFloat(li.rate) || 0);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 md:col-span-5">
                        <select value={li.item_name} onChange={e => updateLine(idx, 'item_name', e.target.value)}
                          className="input text-sm">
                          <option value="">Select item...</option>
                          {billingItems.map(bi => (
                            <option key={bi.id} value={bi.name}>{bi.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <input type="number" value={li.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)}
                          className="input text-sm" placeholder="Qty" min="0" step="1" />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <input type="number" value={li.rate} onChange={e => updateLine(idx, 'rate', e.target.value)}
                          className="input text-sm" placeholder="Rate" min="0" step="0.5" />
                      </div>
                      <div className="col-span-3 md:col-span-2 text-right font-medium text-sm text-gray-700 dark:text-gray-300">
                        ₹{amt.toFixed(2)}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeLine(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          disabled={lineItems.length === 1}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="mt-6 border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax ({taxPct}%)</span>
                    <span className="font-medium">₹{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-amber-700 dark:text-amber-400 border-t pt-2">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap gap-3 justify-end">
                <button onClick={handleSave} disabled={saving}
                  className="btn bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Eye size={16} />
                  )}
                  {saving ? 'Creating...' : 'Preview Bill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
