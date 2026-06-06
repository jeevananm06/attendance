import { useState, useEffect, useRef } from 'react';
import {
  Search, Printer, Share2, Trash2, CheckCircle,
  Receipt, BarChart3, X, Pencil, Plus, CheckSquare, Square,
  DollarSign, AlertTriangle, CreditCard,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { billingAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { fetchLogoBase64, printBill, shareBillAsImage, buildBillHTML } from '../utils/billTemplate';

const LOGO_URL = '/icons/selvam-logo.png';
const emptyLine = { item_name: '', quantity: '', rate: '' };

const statusColors = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  finalized: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  partial_paid: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

export default function BillingHistory() {
  const { isAdmin, isManager } = useAuth();
  const canViewBills = isAdmin || isManager;
  const printRef = useRef(null);
  const [logoBase64, setLogoBase64] = useState(null);
  const [sharing, setSharing] = useState(false);

  // ── filters ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('unpaid'); // Default: show unpaid bills only

  // ── data ──
  const [bills, setBills] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  // ── detail ──
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // ── multi-select ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  // ── payment modal ──
  const [paymentModal, setPaymentModal] = useState(null); // { billId, billNumber, totalAmount }
  const [partialAmount, setPartialAmount] = useState('');

  // ── delete confirmation modal ──
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, label, multi }

  // ── consolidated print modal ──
  const [consolidatedModal, setConsolidatedModal] = useState(null); // { html, customerCount }

  // ── edit ──
  const [editBill, setEditBill] = useState(null);
  const [editLines, setEditLines] = useState([]);
  const [editPhone, setEditPhone] = useState('');
  const [editPlace, setEditPlace] = useState('');
  const [editTax, setEditTax] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [billingItems, setBillingItems] = useState([]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = {};
      if (customerName) params.customer_name = customerName;
      if (customerPhone) params.customer_phone = customerPhone;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      // Handle 'unpaid' pseudo-status: exclude paid bills (not sent to backend)
      if (statusFilter && statusFilter !== 'unpaid') params.bill_status = statusFilter;
      params.limit = 100;
      const r = await billingAPI.searchBills(params);
      let fetchedBills = r.data?.bills || [];
      // Filter out paid bills when 'unpaid' is selected
      if (statusFilter === 'unpaid') {
        fetchedBills = fetchedBills.filter(b => b.status !== 'paid');
      }
      setBills(fetchedBills);
      setTotal(r.data?.total || 0);
    } catch { setBills([]); } finally { setLoading(false); }
  };

  const fetchSummary = async () => {
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const r = await billingAPI.getSummary(params);
      setSummary(r.data);
    } catch { setSummary(null); }
  };

  useEffect(() => {
    fetchBills();
    fetchSummary();
    fetchLogoBase64(LOGO_URL).then(b64 => setLogoBase64(b64));
    billingAPI.getItems().then(r => setBillingItems(r.data || [])).catch(() => {});
  }, []);

  const handleSearch = () => { fetchBills(); fetchSummary(); };

  const handleStatusChange = async (billId, newStatus, paidAmount = 0) => {
    try {
      await billingAPI.updateStatus(billId, newStatus, paidAmount);
      fetchBills();
      fetchSummary();
      if (selectedBill?.id === billId) {
        const r = await billingAPI.getBill(billId);
        setSelectedBill(r.data);
      }
    } catch { /* ignore */ }
  };

  const handleDelete = (billId, label = 'this bill') => {
    setDeleteConfirm({ id: billId, label, multi: false });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.multi) {
        setDeleting(true);
        await Promise.all([...selectedIds].map(id => billingAPI.deleteBill(id)));
        setSelectedIds(new Set());
        setDeleting(false);
      } else {
        await billingAPI.deleteBill(deleteConfirm.id);
        if (selectedBill?.id === deleteConfirm.id) { setSelectedBill(null); setShowDetail(false); }
      }
      fetchBills();
      fetchSummary();
    } catch { /* ignore */ }
    setDeleteConfirm(null);
  };

  const openPaymentModal = (bill) => {
    setPaymentModal({ billId: bill.id, billNumber: bill.bill_number, totalAmount: bill.total_amount, paidAmount: bill.paid_amount || 0 });
    setPartialAmount('');
  };

  const handleMarkPaid = async (billId) => {
    await handleStatusChange(billId, 'paid');
  };

  const handlePartialPay = async () => {
    if (!paymentModal) return;
    const amt = parseFloat(partialAmount);
    if (!amt || amt <= 0) return;
    if (amt >= paymentModal.totalAmount) {
      await handleStatusChange(paymentModal.billId, 'paid');
    } else {
      await handleStatusChange(paymentModal.billId, 'partial_paid', amt);
    }
    setPaymentModal(null);
  };

  const handleMarkPaidSelected = async () => {
    if (selectedIds.size === 0) return;
    setMarkingPaid(true);
    try {
      await Promise.all([...selectedIds].map(id => billingAPI.updateStatus(id, 'paid')));
      setSelectedIds(new Set());
      fetchBills();
      fetchSummary();
    } catch { /* ignore */ }
    setMarkingPaid(false);
  };

  const ensureFullBill = async (bill) => {
    if (bill.line_items && bill.line_items.length > 0) return bill;
    try {
      const r = await billingAPI.getBill(bill.id);
      return r.data;
    } catch { return bill; }
  };

  const toggleSelect = (billId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(billId)) next.delete(billId);
      else next.add(billId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === bills.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(bills.map(b => b.id)));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({ id: null, label: `${selectedIds.size} bill(s)`, multi: true });
  };

  const handleConsolidatedPrint = async () => {
    // Group filtered bills by customer
    const customerBills = {};
    for (const bill of bills) {
      const key = bill.customer_name;
      if (!customerBills[key]) customerBills[key] = [];
      customerBills[key].push(bill);
    }

    // Build consolidated HTML for each customer with date-wise breakdown
    let allHTML = '';
    for (const [customer, cBills] of Object.entries(customerBills)) {
      const fullBills = await Promise.all(cBills.map(b => ensureFullBill(b)));
      // Sort by date
      fullBills.sort((a, b) => (a.bill_date || '').localeCompare(b.bill_date || ''));

      let totalAmount = 0;
      // Build date-wise rows: Date | Item | Qty | Rate | Amount
      let rows = '';
      fullBills.forEach(fb => {
        const items = fb.line_items || [];
        totalAmount += fb.total_amount || 0;
        items.forEach((li, idx) => {
          const dateCell = idx === 0
            ? `<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;vertical-align:top" rowspan="${items.length}">${fb.bill_date}</td>`
            : '';
          rows += `<tr>
            ${dateCell}
            <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee">${li.item_name}</td>
            <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">${li.quantity}</td>
            <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">₹${li.rate.toFixed(2)}</td>
            <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">₹${(li.quantity * li.rate).toFixed(2)}</td>
          </tr>`;
        });
      });

      const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : `${fullBills[0]?.bill_date} - ${fullBills[fullBills.length - 1]?.bill_date}`;

      const html = `<div style="background:#fff;padding:20px;max-width:520px;margin:0 auto;font-family:'Segoe UI',sans-serif;color:#333">
        <div style="text-align:center;border-bottom:2px dashed #8B4513;padding-bottom:12px;margin-bottom:12px">
          ${logoBase64 ? `<img src="${logoBase64}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 8px" />` : ''}
          <div style="font-size:20px;font-weight:700;color:#5D3A1A">Selvam Tea Stall</div>
          <div style="font-size:11px;color:#8B6914;letter-spacing:1.5px">TEA • COFFEE • SNACKS</div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px">
          <div style="line-height:1.6">
            <div><span style="color:#888">Bill No:</span> <strong>Consolidated (${fullBills.length} bills)</strong></div>
            <div><span style="color:#888">Period:</span> ${dateRange}</div>
            <div><span style="color:#888">Status:</span> <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:600;background:#E0E7FF;color:#3730A3">CONSOLIDATED</span></div>
          </div>
          <div style="line-height:1.6;text-align:right">
            <div><strong>${customer}</strong></div>
            ${cBills[0]?.customer_phone ? `<div>${cBills[0].customer_phone}</div>` : ''}
            ${cBills[0]?.customer_place ? `<div>${cBills[0].customer_place}</div>` : ''}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:10px 0">
          <thead><tr>
            <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:left">Date</th>
            <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:left">Item</th>
            <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:right">Qty</th>
            <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:right">Rate</th>
            <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:right">Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="border-top:2px solid #D4A574;margin-top:4px;padding-top:8px">
          <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:16px;font-weight:700;color:#5D3A1A;border-top:2px dashed #8B4513;margin-top:4px"><span>Total</span><span>₹${totalAmount.toFixed(2)}</span></div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#666;font-style:italic">Note: Period: ${dateRange}</div>
        <div style="text-align:center;border-top:2px dashed #8B4513;margin-top:16px;padding-top:10px;font-size:11px;color:#888">Thank you for your order!<br/>Selvam Tea Stall</div>
      </div>`;

      allHTML += html + '<div style="page-break-after:always"></div>';
    }

    // Detect mobile devices: iPhone, iPad (including modern iPadOS), iPod, Android
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // Modern iPad Pro

    if (isMobile) {
      // Mobile: show modal instead of new window (prevents getting stuck)
      setConsolidatedModal({ html: allHTML, customerCount: Object.keys(customerBills).length });
    } else {
      // Desktop: open new window
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>Consolidated Bills</title></head><body>${allHTML}</body></html>`);
      win.document.close();
      win.onload = () => { win.print(); };
    }
  };

  const printConsolidatedFromModal = () => {
    if (!consolidatedModal) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Consolidated Bills</title></head><body>${consolidatedModal.html}</body></html>`);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  const handlePrint = async (bill) => {
    const full = await ensureFullBill(bill);
    await printBill(full, logoBase64);
  };

  const handleShare = async (bill) => {
    setSharing(true);
    try {
      const full = await ensureFullBill(bill);
      await shareBillAsImage(full, logoBase64);
    } catch { /* ignore */ }
    setSharing(false);
  };

  const viewBill = async (bill) => {
    try {
      const r = await billingAPI.getBill(bill.id);
      setSelectedBill(r.data);
      setShowDetail(true);
    } catch { setSelectedBill(bill); setShowDetail(true); }
  };

  const openEdit = async (bill) => {
    try {
      const r = await billingAPI.getBill(bill.id);
      const b = r.data;
      setEditBill(b);
      setEditLines(b.line_items.map(li => ({ item_name: li.item_name, quantity: li.quantity, rate: li.rate })));
      setEditPhone(b.customer_phone || '');
      setEditPlace(b.customer_place || '');
      setEditTax(b.tax_percentage || 0);
      setEditNotes(b.notes || '');
      setEditError('');
    } catch { /* ignore */ }
  };

  const updateEditLine = (idx, field, value) => {
    setEditLines(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === 'item_name') {
        const match = billingItems.find(i => i.name === value);
        if (match && !copy[idx].rate) copy[idx].rate = match.default_rate;
      }
      return copy;
    });
  };

  const saveEdit = async () => {
    if (!editBill) return;
    const validLines = editLines.filter(li => li.item_name && li.quantity && li.rate);
    if (validLines.length === 0) { setEditError('Add at least one item'); return; }
    setEditSaving(true); setEditError('');
    try {
      // Edit the bill in place so its id and bill number are preserved and the
      // record can never be lost on a partial failure.
      await billingAPI.updateBill(editBill.id, {
        customer_phone: editPhone,
        customer_place: editPlace,
        tax_percentage: parseFloat(editTax) || 0,
        notes: editNotes || null,
        line_items: validLines.map(li => ({
          item_name: li.item_name,
          quantity: parseFloat(li.quantity),
          rate: parseFloat(li.rate),
        })),
      });
      setEditBill(null);
      fetchBills(); 
      fetchSummary();
    } catch (e) {
      setEditError(e.response?.data?.detail || 'Failed to save');
    }
    setEditSaving(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Receipt className="text-amber-600" /> Bill History
      </h1>

      {/* Summary cards */}
      {isAdmin && summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{summary.total_bills}</div>
            <div className="text-xs text-gray-500">Total Bills</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-green-600">₹{(summary.total_revenue || 0).toLocaleString()}</div>
            <div className="text-xs text-gray-500">Revenue</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{summary.draft_count}</div>
            <div className="text-xs text-gray-500">Draft</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{summary.finalized_count}</div>
            <div className="text-xs text-gray-500">Finalized</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{summary.partial_paid_count || 0}</div>
            <div className="text-xs text-gray-500">Partial Paid</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.paid_count}</div>
            <div className="text-xs text-gray-500">Paid</div>
          </div>
        </div>
      )}

      {/* Item breakdown */}
      {isAdmin && summary?.item_breakdown?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <BarChart3 size={16} /> Item Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {summary.item_breakdown.map((item, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                <div className="font-medium text-sm">{item.item_name}</div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                  {item.total_qty.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">₹{item.total_amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2 md:col-span-1">
            <label className="label">Customer</label>
            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
              className="input text-sm w-full" placeholder="Name" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="input text-sm w-full" placeholder="Phone" />
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input text-sm w-full" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input text-sm w-full" />
          </div>
          <div>
            <label className="label">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-sm w-full">
              <option value="unpaid">Unpaid</option>
              <option value="draft">Draft</option>
              <option value="finalized">Finalized</option>
              <option value="partial_paid">Partial Paid</option>
              <option value="paid">Paid</option>
              <option value="">All</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={handleSearch} className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1 rounded-lg flex-1 md:flex-none justify-center">
            <Search size={15} /> Search
          </button>
          <button onClick={() => { setCustomerName(''); setCustomerPhone(''); setStartDate(''); setEndDate(''); setStatusFilter('unpaid'); }}
            className="btn btn-secondary text-sm rounded-lg flex-1 md:flex-none">Clear</button>
          {isAdmin && (
            <button onClick={handleConsolidatedPrint}
              className="btn bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-1 rounded-lg flex-1 md:flex-none justify-center"
              title="Print consolidated bill per customer for current filter results">
              <Printer size={15} /> Consolidated
            </button>
          )}
        </div>
      </div>

      {/* Multi-select action bar */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="card flex flex-wrap items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{selectedIds.size} bill(s) selected</span>
          <button onClick={handleMarkPaidSelected} disabled={markingPaid}
            className="btn bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-1 rounded-lg">
            {markingPaid ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <DollarSign size={14} />}
            Mark as Paid
          </button>
          <button onClick={handleDeleteSelected} disabled={deleting}
            className="btn bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-1 rounded-lg">
            {deleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
            Delete Selected
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="btn btn-secondary text-sm rounded-lg">Cancel</button>
        </div>
      )}

      {/* Bills list - card view on mobile, table on desktop */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Receipt size={48} className="mx-auto mb-3 opacity-40" />
            <p>No bills found</p>
          </div>
        ) : (
          <>
            {/* Mobile: Card view */}
            <div className="md:hidden space-y-3">
              {bills.map(bill => (
                <div key={bill.id} className="border rounded-lg p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => viewBill(bill)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button onClick={e => { e.stopPropagation(); toggleSelect(bill.id); }} className="text-gray-400 hover:text-gray-700">
                          {selectedIds.has(bill.id) ? <CheckSquare size={18} className="text-amber-600" /> : <Square size={18} />}
                        </button>
                      )}
                      <span className="font-mono text-xs font-bold">{bill.bill_number}</span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[bill.status] || ''}`}>
                      {bill.status === 'partial_paid' ? `partial ₹${(bill.paid_amount || 0).toLocaleString()}` : bill.status}
                    </span>
                  </div>
                  <div className="text-sm font-medium mb-1">{bill.customer_name}</div>
                  <div className="text-xs text-gray-500 mb-2">{bill.bill_date} · {bill.customer_phone || 'No phone'}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700">₹{bill.total_amount.toFixed(2)}</span>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handlePrint(bill)} className="p-2 hover:bg-gray-100 rounded" title="Print">
                        <Printer size={16} />
                      </button>
                      <button onClick={() => handleShare(bill)} className="p-2 hover:bg-green-50 rounded text-green-600" title="Share">
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 uppercase">
                    {isAdmin && (
                      <th className="py-2 px-3 w-8">
                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                          {selectedIds.size === bills.length ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </th>
                    )}
                    <th className="py-2 px-3">Bill #</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => (
                    <tr key={bill.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                      onClick={() => viewBill(bill)}>
                      {isAdmin && (
                        <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                          <button onClick={() => toggleSelect(bill.id)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                            {selectedIds.has(bill.id) ? <CheckSquare size={16} className="text-amber-600" /> : <Square size={16} />}
                          </button>
                        </td>
                      )}
                      <td className="py-2 px-3 font-mono text-xs">{bill.bill_number}</td>
                      <td className="py-2 px-3">{bill.bill_date}</td>
                      <td className="py-2 px-3 font-medium">{bill.customer_name}</td>
                      <td className="py-2 px-3 text-gray-500">{bill.customer_phone || '-'}</td>
                      <td className="py-2 px-3 text-right font-medium">₹{bill.total_amount.toFixed(2)}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[bill.status] || ''}`}>
                          {bill.status === 'partial_paid' ? `partial ₹${(bill.paid_amount || 0).toLocaleString()}` : bill.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handlePrint(bill)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Print">
                            <Printer size={14} />
                          </button>
                          <button onClick={() => handleShare(bill)} className="p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded text-green-600" title="Share">
                            <Share2 size={14} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => openEdit(bill)} className="p-1 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded text-amber-600" title="Edit">
                              <Pencil size={14} />
                            </button>
                          )}
                          {isAdmin && bill.status === 'draft' && (
                            <button onClick={() => handleStatusChange(bill.id, 'finalized')} className="p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded text-emerald-600" title="Finalize">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {isAdmin && bill.status !== 'paid' && (
                            <button onClick={() => handleMarkPaid(bill.id)} className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-blue-600" title="Mark Paid">
                              <DollarSign size={14} />
                            </button>
                          )}
                          {isAdmin && bill.status !== 'paid' && (
                            <button onClick={() => openPaymentModal(bill)} className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded text-orange-600" title="Partial Pay">
                              <CreditCard size={14} />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDelete(bill.id, bill.bill_number)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {total > 0 && (
          <div className="mt-3 text-xs text-gray-500 text-right">Showing {bills.length} of {total} bills</div>
        )}
      </div>

      {/* Edit Bill Modal */}
      {editBill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b flex items-center justify-between z-10">
              <h2 className="font-bold text-lg">Edit Bill — {editBill.bill_number}</h2>
              <button onClick={() => setEditBill(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              {editError && <p className="text-red-600 text-sm">{editError}</p>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">Customer</label>
                  <input className="input" value={editBill.customer_name} disabled />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                </div>
                <div>
                  <label className="label">Place</label>
                  <input className="input" value={editPlace} onChange={e => setEditPlace(e.target.value)} />
                </div>
                <div>
                  <label className="label">Tax %</label>
                  <input type="number" className="input" value={editTax} onChange={e => setEditTax(e.target.value)} min="0" step="0.5" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Notes</label>
                  <input className="input" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Items</span>
                  <button onClick={() => setEditLines(prev => [...prev, { ...emptyLine }])} className="btn btn-secondary text-xs py-1 px-2 flex items-center gap-1"><Plus size={13} /> Add</button>
                </div>
                <div className="space-y-2">
                  {editLines.map((li, idx) => {
                    const amt = (parseFloat(li.quantity) || 0) * (parseFloat(li.rate) || 0);
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <select value={li.item_name} onChange={e => updateEditLine(idx, 'item_name', e.target.value)} className="input text-sm">
                            <option value="">Select item...</option>
                            {billingItems.map(bi => <option key={bi.id} value={bi.name}>{bi.name}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2"><input type="number" value={li.quantity} onChange={e => updateEditLine(idx, 'quantity', e.target.value)} className="input text-sm" placeholder="Qty" /></div>
                        <div className="col-span-2"><input type="number" value={li.rate} onChange={e => updateEditLine(idx, 'rate', e.target.value)} className="input text-sm" placeholder="Rate" /></div>
                        <div className="col-span-2 text-right text-sm font-medium">₹{amt.toFixed(2)}</div>
                        <div className="col-span-1 flex justify-end">
                          <button onClick={() => setEditLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setEditBill(null)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving} className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
                {editSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Detail Modal */}
      {showDetail && selectedBill && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b flex items-center justify-between z-10">
              <h2 className="font-bold text-lg">{selectedBill.bill_number}</h2>
              <button onClick={() => setShowDetail(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4" ref={printRef}>
              <BillPrintView bill={selectedBill} logoBase64={logoBase64} />
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t flex flex-wrap gap-2 justify-end">
              {isAdmin && (
                <button onClick={() => { setShowDetail(false); openEdit(selectedBill); }}
                  className="btn bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm flex items-center gap-1">
                  <Pencil size={15} /> Edit
                </button>
              )}
              {isAdmin && selectedBill.status === 'draft' && (
                <button onClick={() => handleStatusChange(selectedBill.id, 'finalized')}
                  className="btn bg-green-600 hover:bg-green-700 text-white text-sm">Finalize</button>
              )}
              {isAdmin && selectedBill.status !== 'paid' && (
                <button onClick={() => handleMarkPaid(selectedBill.id)}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-1">
                  <DollarSign size={15} /> Mark Paid
                </button>
              )}
              {isAdmin && selectedBill.status !== 'paid' && (
                <button onClick={() => { setShowDetail(false); openPaymentModal(selectedBill); }}
                  className="btn bg-orange-500 hover:bg-orange-600 text-white text-sm flex items-center gap-1">
                  <CreditCard size={15} /> Partial Pay
                </button>
              )}
              <button onClick={() => handlePrint(selectedBill)}
                className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
                <Printer size={15} /> Print
              </button>
              <button onClick={() => handleShare(selectedBill)} disabled={sharing}
                className="btn bg-green-500 hover:bg-green-600 text-white text-sm flex items-center gap-1">
                {sharing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 size={15} />}
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Confirm Delete</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to permanently delete <strong>{deleteConfirm.label}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={confirmDelete} className="btn bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-1">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <CreditCard size={24} className="text-orange-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Record Payment</h3>
            </div>
            <div className="space-y-3 mb-6">
              <div className="text-sm text-gray-500">Bill: <strong>{paymentModal.billNumber}</strong></div>
              <div className="text-sm text-gray-500">Total: <strong className="text-gray-900 dark:text-white">₹{paymentModal.totalAmount.toLocaleString()}</strong></div>
              {paymentModal.paidAmount > 0 && (
                <div className="text-sm text-gray-500">Already Paid: <strong className="text-green-600">₹{paymentModal.paidAmount.toLocaleString()}</strong></div>
              )}
              <div>
                <label className="label">Payment Amount (₹)</label>
                <input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)}
                  className="input" placeholder="Enter amount" min="1" max={paymentModal.totalAmount}
                  autoFocus />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPartialAmount(String(paymentModal.totalAmount))}
                  className="text-xs text-blue-600 hover:underline">Full amount</button>
                <button onClick={() => setPartialAmount(String(Math.round(paymentModal.totalAmount / 2)))}
                  className="text-xs text-blue-600 hover:underline">Half</button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPaymentModal(null)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={handlePartialPay}
                disabled={!partialAmount || parseFloat(partialAmount) <= 0}
                className="btn bg-orange-500 hover:bg-orange-600 text-white text-sm flex items-center gap-1 disabled:opacity-50">
                <DollarSign size={14} /> Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Print Modal (Mobile) */}
      {consolidatedModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Consolidated Report Preview</h3>
              <button onClick={() => setConsolidatedModal(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <div dangerouslySetInnerHTML={{ __html: consolidatedModal.html }} />
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t flex flex-wrap gap-2 justify-end">
              <button onClick={() => setConsolidatedModal(null)} className="btn btn-secondary text-sm">Close</button>
              <button onClick={printConsolidatedFromModal}
                className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function BillPrintView({ bill, logoBase64 }) {
  return <div dangerouslySetInnerHTML={{ __html: buildBillHTML(bill, logoBase64) }} />;
}


