import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Printer, Share2, AlertTriangle, X, Receipt,
} from 'lucide-react';
import { billingAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { fetchLogoBase64, printBill, shareBillAsImage, buildBillHTML } from '../utils/billTemplate';

const LOGO_URL = '/icons/selvam-logo.png';

const today = () => new Date().toISOString().slice(0, 10);

const emptyLine = { item_name: '', quantity: '', rate: '' };

export default function BillingEntry() {
  const { user, isAdmin } = useAuth();

  // ── configurable items ──
  const [billingItems, setBillingItems] = useState([]);
  const [logoBase64, setLogoBase64] = useState(null);

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

  // ── bill (created once, reused) ──
  const [savedBill, setSavedBill] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // ── loading ──
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    billingAPI.getItems().then(r => setBillingItems(r.data || [])).catch(() => {});
    fetchLogoBase64(LOGO_URL).then(b64 => setLogoBase64(b64));
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

  // ── create bill (once) ──
  const handleSaveAndPrint = async () => {
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
      setSavedBill(r.data);
      setShowPreview(true);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  };

  // ── finalize ──
  const handleFinalize = async () => {
    if (!savedBill) return;
    try {
      const r = await billingAPI.updateStatus(savedBill.id, 'finalized');
      setSavedBill(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to finalize');
    }
  };

  // ── print (with base64 logo) ──
  const handlePrint = (bill) => {
    const b = bill || savedBill;
    if (!b) return;
    printBill(b, logoBase64);
    // After printing from new bill flow, clear form
    if (!bill) {
      setTimeout(() => resetForm(), 1000);
    }
  };

  // ── share as image via WhatsApp ──
  const handleShare = async (bill) => {
    const b = bill || savedBill;
    if (!b) return;
    setSharing(true);
    try {
      await shareBillAsImage(b, logoBase64);
    } catch { /* ignore */ }
    setSharing(false);
  };

  // ── reset form ──
  const resetForm = () => {
    setCustomerName(''); setCustomerPhone(''); setCustomerPlace('');
    setBillDate(today()); setTaxPct(0); setNotes('');
    setLineItems([{ ...emptyLine }]);
    setSavedBill(null); setShowPreview(false);
    setDuplicateWarning(null); setError('');
  };

  // ── Bill Preview Content (uses shared template) ──
  const BillPreviewContent = ({ bill }) => (
    <div dangerouslySetInnerHTML={{ __html: buildBillHTML(bill, logoBase64) }} />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt className="text-amber-600" /> New Bill
        </h1>
        {savedBill && (
          <button onClick={resetForm} className="btn btn-secondary text-sm flex items-center gap-1">
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

      {/* ── Bill (saved) view ── */}
      {showPreview && savedBill && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-gray-700 dark:text-gray-200">Bill Created ✓</span>
            <div className="flex gap-2">
              {savedBill.status === 'draft' && isAdmin && (
                <button onClick={handleFinalize} className="btn bg-green-600 hover:bg-green-700 text-white text-sm">Finalize</button>
              )}
              <button onClick={() => handlePrint()} className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
                <Printer size={15} /> Print &amp; New Bill
              </button>
              <button onClick={() => handleShare()} disabled={sharing} className="btn bg-green-500 hover:bg-green-600 text-white text-sm flex items-center gap-1">
                {sharing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 size={15} />}
                WhatsApp
              </button>
            </div>
          </div>
          <BillPreviewContent bill={savedBill} />
        </div>
      )}

      {/* ── Form ── */}
      {!showPreview && !savedBill && (
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
                <button onClick={handleSaveAndPrint} disabled={saving}
                  className="btn bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Printer size={16} />
                  )}
                  {saving ? 'Creating...' : 'Print Bill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
