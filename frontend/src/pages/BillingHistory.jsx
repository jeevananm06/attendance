import { useState, useEffect, useRef } from 'react';
import {
  Search, Printer, Share2, Eye, Trash2, CheckCircle, Filter,
  ChevronDown, ChevronUp, Receipt, BarChart3, X,
} from 'lucide-react';
import { billingAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const LOGO_URL = '/icons/selvam-logo.png';

const statusColors = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  finalized: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

export default function BillingHistory() {
  const { isAdmin } = useAuth();
  const printRef = useRef(null);

  // ── filters ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── data ──
  const [bills, setBills] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  // ── detail ──
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = {};
      if (customerName) params.customer_name = customerName;
      if (customerPhone) params.customer_phone = customerPhone;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (statusFilter) params.bill_status = statusFilter;
      params.limit = 100;
      const r = await billingAPI.searchBills(params);
      setBills(r.data?.bills || []);
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

  useEffect(() => { fetchBills(); fetchSummary(); }, []);

  const handleSearch = () => { fetchBills(); fetchSummary(); };

  const handleStatusChange = async (billId, newStatus) => {
    try {
      await billingAPI.updateStatus(billId, newStatus);
      fetchBills();
      fetchSummary();
      if (selectedBill?.id === billId) {
        const r = await billingAPI.getBill(billId);
        setSelectedBill(r.data);
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (billId) => {
    if (!window.confirm('Delete this bill permanently?')) return;
    try {
      await billingAPI.deleteBill(billId);
      fetchBills();
      fetchSummary();
      if (selectedBill?.id === billId) { setSelectedBill(null); setShowDetail(false); }
    } catch { /* ignore */ }
  };

  const handlePrint = (bill) => {
    const content = buildPrintHTML(bill);
    const win = window.open('', '_blank');
    win.document.write(content);
    win.document.close();
  };

  const handleShare = (bill) => {
    const lines = bill.line_items.map(
      li => `  ${li.item_name}: ${li.quantity} × ₹${li.rate} = ₹${li.amount.toFixed(2)}`
    );
    const text = [
      `🧾 *Selvam Tea Stall*`,
      `Bill No: ${bill.bill_number}`,
      `Date: ${bill.bill_date}`,
      ``,
      `Customer: ${bill.customer_name}`,
      bill.customer_phone ? `Phone: ${bill.customer_phone}` : '',
      bill.customer_place ? `Place: ${bill.customer_place}` : '',
      ``,
      `Items:`,
      ...lines,
      ``,
      `Subtotal: ₹${bill.subtotal.toFixed(2)}`,
      bill.tax_amount > 0 ? `Tax (${bill.tax_percentage}%): ₹${bill.tax_amount.toFixed(2)}` : '',
      `*Total: ₹${bill.total_amount.toFixed(2)}*`,
      ``,
      `Thank you for your order!`,
    ].filter(Boolean).join('\n');
    const phone = bill.customer_phone?.replace(/\D/g, '') || '';
    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const viewBill = async (bill) => {
    try {
      const r = await billingAPI.getBill(bill.id);
      setSelectedBill(r.data);
      setShowDetail(true);
    } catch { setSelectedBill(bill); setShowDetail(true); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt className="text-amber-600" /> Bill History
        </h1>
        <button onClick={() => setShowFilters(p => !p)}
          className="btn btn-secondary text-sm flex items-center gap-1">
          <Filter size={15} /> Filters {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Summary cards */}
      {isAdmin && summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="label">Customer</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                className="input text-sm" placeholder="Name" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                className="input text-sm" placeholder="Phone" />
            </div>
            <div>
              <label className="label">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="label">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-sm">
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="finalized">Finalized</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSearch} className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
              <Search size={15} /> Search
            </button>
            <button onClick={() => { setCustomerName(''); setCustomerPhone(''); setStartDate(''); setEndDate(''); setStatusFilter(''); }}
              className="btn btn-secondary text-sm">Clear</button>
          </div>
        </div>
      )}

      {/* Bills table */}
      <div className="card overflow-x-auto">
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
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
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
                  <td className="py-2 px-3 font-mono text-xs">{bill.bill_number}</td>
                  <td className="py-2 px-3">{bill.bill_date}</td>
                  <td className="py-2 px-3 font-medium">{bill.customer_name}</td>
                  <td className="py-2 px-3 text-gray-500">{bill.customer_phone || '-'}</td>
                  <td className="py-2 px-3 text-right font-medium">₹{bill.total_amount.toFixed(2)}</td>
                  <td className="py-2 px-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[bill.status] || ''}`}>
                      {bill.status}
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
                      {isAdmin && bill.status === 'draft' && (
                        <button onClick={() => handleStatusChange(bill.id, 'finalized')} className="p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded text-emerald-600" title="Finalize">
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(bill.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 0 && (
          <div className="mt-3 text-xs text-gray-500 text-right">Showing {bills.length} of {total} bills</div>
        )}
      </div>

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
              <BillPrintView bill={selectedBill} />
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t flex flex-wrap gap-2 justify-end">
              {isAdmin && selectedBill.status === 'draft' && (
                <button onClick={() => handleStatusChange(selectedBill.id, 'finalized')}
                  className="btn bg-green-600 hover:bg-green-700 text-white text-sm">Finalize</button>
              )}
              {isAdmin && selectedBill.status === 'finalized' && (
                <button onClick={() => handleStatusChange(selectedBill.id, 'paid')}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white text-sm">Mark Paid</button>
              )}
              <button onClick={() => handlePrint(selectedBill)}
                className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
                <Printer size={15} /> Print
              </button>
              <button onClick={() => handleShare(selectedBill)}
                className="btn bg-green-500 hover:bg-green-600 text-white text-sm flex items-center gap-1">
                <Share2 size={15} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function BillPrintView({ bill }) {
  return (
    <div>
      <div style={{ textAlign: 'center', borderBottom: '2px dashed #8B4513', paddingBottom: 12, marginBottom: 12 }}>
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
          {bill.line_items?.map((li, i) => (
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
}


function buildPrintHTML(bill) {
  const rows = bill.line_items?.map(li =>
    `<tr><td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee">${li.item_name}</td>
     <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">${li.quantity}</td>
     <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">₹${li.rate.toFixed(2)}</td>
     <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">₹${li.amount.toFixed(2)}</td></tr>`
  ).join('') || '';

  const statusBg = bill.status === 'finalized' ? '#DEF7EC' : bill.status === 'paid' ? '#DBEAFE' : '#FEF3C7';
  const statusColor = bill.status === 'finalized' ? '#03543F' : bill.status === 'paid' ? '#1E40AF' : '#92400E';

  return `<html><head><title>Bill - ${bill.bill_number}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:20px;color:#333;max-width:420px;margin:0 auto}@media print{body{padding:0}}</style>
  </head><body>
  <div style="text-align:center;border-bottom:2px dashed #8B4513;padding-bottom:12px;margin-bottom:12px">
    <img src="${LOGO_URL}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 8px" onerror="this.style.display='none'" />
    <div style="font-size:20px;font-weight:700;color:#5D3A1A">Selvam Tea Stall</div>
    <div style="font-size:11px;color:#8B6914;letter-spacing:1.5px">TEA • COFFEE • SNACKS</div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px">
    <div style="line-height:1.6"><div><span style="color:#888">Bill No:</span> <strong>${bill.bill_number}</strong></div><div><span style="color:#888">Date:</span> ${bill.bill_date}</div>
    <div><span style="color:#888">Status:</span> <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:600;background:${statusBg};color:${statusColor}">${bill.status.toUpperCase()}</span></div></div>
    <div style="line-height:1.6;text-align:right"><div><strong>${bill.customer_name}</strong></div>${bill.customer_phone ? `<div>${bill.customer_phone}</div>` : ''}${bill.customer_place ? `<div>${bill.customer_place}</div>` : ''}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin:10px 0">
    <thead><tr>
      <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:left">Item</th>
      <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:right">Qty</th>
      <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:right">Rate</th>
      <th style="background:#F5E6D3;color:#5D3A1A;font-size:11px;padding:6px 8px;text-align:right">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="border-top:2px solid #D4A574;margin-top:4px;padding-top:8px">
    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
    ${bill.tax_amount > 0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px"><span>Tax (${bill.tax_percentage}%)</span><span>₹${bill.tax_amount.toFixed(2)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:16px;font-weight:700;color:#5D3A1A;border-top:2px dashed #8B4513;margin-top:4px"><span>Total</span><span>₹${bill.total_amount.toFixed(2)}</span></div>
  </div>
  ${bill.notes ? `<div style="margin-top:8px;font-size:11px;color:#666;font-style:italic">Note: ${bill.notes}</div>` : ''}
  <div style="text-align:center;border-top:2px dashed #8B4513;margin-top:16px;padding-top:10px;font-size:11px;color:#888">Thank you for your order!<br/>Selvam Tea Stall</div>
  <script>window.print();window.close();</script>
  </body></html>`;
}
