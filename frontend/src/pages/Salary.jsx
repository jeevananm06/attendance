import React, { useState, useEffect, useRef } from 'react';
import { salaryAPI, laboursAPI, advancesAPI, sitesAPI } from '../api';
import {
  Wallet,
  Calculator,
  CreditCard,
  AlertCircle,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Banknote,
  FileText,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SalarySlip from '../components/SalarySlip';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const Salary = () => {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('pending'); // 'pending' | 'register' | 'history'
  const [pendingSalaries, setPendingSalaries] = useState(null);
  const [labours, setLabours] = useState([]);
  const [advances, setAdvances] = useState({}); // { labourId: { pending_amount, advances: [] } }
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedLabour, setExpandedLabour] = useState(null);
  const [payingLabour, setPayingLabour] = useState(null);
  const [calculatingLabour, setCalculatingLabour] = useState(null);
  const [payPanel, setPayPanel] = useState(null); // { labourId, weekEnd, total }
  const [payAmount, setPayAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [advanceDeduction, setAdvanceDeduction] = useState('none'); // 'none', 'full', 'partial'
  const [advanceDeductionAmount, setAdvanceDeductionAmount] = useState('');
  const [advancePayment, setAdvancePayment] = useState(false);
  const [slip, setSlip] = useState(null);

  // Site grouping state
  const [labourSiteMap, setLabourSiteMap] = useState({}); // { labour_id: { id, name } }
  const [siteList, setSiteList] = useState([]); // [{ id, name }] for filter
  const [selectedSite, setSelectedSite] = useState('all'); // 'all' | site_id | 'unassigned'

  const now = new Date();
  const [regYear, setRegYear] = useState(now.getFullYear());
  const [regMonth, setRegMonth] = useState(now.getMonth() + 1);
  const [register, setRegister] = useState(null);
  const [regLoading, setRegLoading] = useState(false);
  const [expandedRegLabour, setExpandedRegLabour] = useState(null);

  // Payment history / revert state
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [revertingId, setRevertingId] = useState(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [pendingRes, advancesRes, groupedRes] = await Promise.all([
        salaryAPI.getAllPending(),
        advancesAPI.getAllPending(),
        sitesAPI.getGroupedLabours(),
      ]);

      // Pending salaries
      const data = pendingRes.data;
      if (data?.labours) {
        data.labours = [...data.labours].sort((a, b) => a.name.localeCompare(b.name));
      }
      setPendingSalaries(data);
      const laboursList = (data?.labours || []).map(l => ({
        id: l.labour_id,
        name: l.name,
        daily_wage: l.daily_wage,
        phone: l.phone,
        pay_cycle: l.pay_cycle
      }));
      setLabours(laboursList);

      // Advances map
      const advMap = {};
      (advancesRes.data?.labours || []).forEach((adv) => {
        advMap[adv.labour_id] = adv.pending_amount;
      });
      setAdvances(advMap);

      // Build labour → site map
      const siteMap = {};
      const sites = [];
      (groupedRes.data?.groups || []).forEach(({ site, labours: siteLabours }) => {
        sites.push({ id: site.id, name: site.name });
        siteLabours.forEach(l => { siteMap[l.id] = { id: site.id, name: site.name }; });
      });
      setLabourSiteMap(siteMap);
      setSiteList(sites);
    } catch (err) {
      setError('Failed to load salary data');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCalculateAll = async () => {
    try {
      setCalculating(true);
      setError('');
      await salaryAPI.calculateAll();
      setSuccess('Salaries calculated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      fetchData(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to calculate salaries');
    } finally {
      setCalculating(false);
    }
  };

  const handleCalculateOne = async (labourId) => {
    try {
      setCalculatingLabour(labourId);
      setError('');
      await salaryAPI.calculate(labourId);
      setSuccess('Salary calculated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      fetchData(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to calculate salary');
    } finally {
      setCalculatingLabour(null);
    }
  };

  const openPayPanel = (labour) => {
    setPayPanel({ labourId: labour.labour_id, weekEnd: getLatestWeekEnd(labour.records), total: labour.total_pending });
    setPayAmount(String(labour.total_pending));
  };

  const closePayPanel = () => {
    setPayPanel(null);
    setPayAmount('');
    setPaymentComment('');
    setAdvanceDeduction('none');
    setAdvanceDeductionAmount('');
    setAdvancePayment(false);
  };

  const handleOpenSlip = async (labour, mode = 'last') => {
    try {
      let res;
      if (mode === 'all_pending') {
        res = await salaryAPI.getSlipAllPending(labour.labour_id);
      } else {
        const weekEnd = getLatestWeekEnd(labour.records);
        res = await salaryAPI.getSlip(labour.labour_id, weekEnd);
      }
      setSlip(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load salary slip');
    }
  };

  const handleLoadRegister = async () => {
    try {
      setRegLoading(true);
      setError('');
      const res = await salaryAPI.getRegister(regYear, regMonth);
      setRegister(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load register');
    } finally {
      setRegLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      setHistoryLoading(true);
      setError('');
      const res = await salaryAPI.getAllPayments(50);
      setPaymentHistory(res.data.payments);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load payment history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRevertPayment = async (paymentId, labourName, amount) => {
    if (!window.confirm(`Are you sure you want to revert the ₹${amount.toLocaleString()} payment for ${labourName}? This will mark the salary as unpaid.`)) {
      return;
    }
    try {
      setRevertingId(paymentId);
      setError('');
      const res = await salaryAPI.revertPayment(paymentId);
      setSuccess(res.data.message);
      // Refresh both payment history and pending data
      fetchPaymentHistory();
      fetchData(true);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to revert payment');
    } finally {
      setRevertingId(null);
    }
  };

  const handlePay = async () => {
    const { labourId, weekEnd, total } = payPanel;
    const entered = parseFloat(payAmount);
    if (isNaN(entered) || entered <= 0) { setError('Enter a valid amount'); return; }

    const isExcessPayment = entered > total;
    if (isExcessPayment && !advancePayment && !paymentComment.trim()) {
      setError('Please provide a reason for the excess payment');
      return;
    }

    const pendingAdvance = advances[labourId] || 0;
    const partialDeductAmt = parseFloat(advanceDeductionAmount);
    if (advanceDeduction === 'partial') {
      if (isNaN(partialDeductAmt) || partialDeductAmt <= 0) {
        setError('Enter a valid advance deduction amount');
        return;
      }
      if (partialDeductAmt > pendingAdvance) {
        setError(`Deduction amount cannot exceed pending advance (₹${pendingAdvance.toLocaleString()})`);
        return;
      }
    }

    try {
      setPayingLabour(labourId);
      setError('');
      const res = await salaryAPI.pay(
        labourId, 
        weekEnd, 
        entered, 
        paymentComment.trim() || null,
        advanceDeduction !== 'none' ? advanceDeduction : null,
        advanceDeduction === 'partial' ? partialDeductAmt : null,
        advancePayment
      );
      const { amount_paid, remaining, weeks_paid, excess_amount, advance_deducted, net_payment, advance_created } = res.data;
      let msg = `Paid ₹${amount_paid.toLocaleString()} (${weeks_paid} week${weeks_paid !== 1 ? 's' : ''})`;
      if (advance_deducted > 0) {
        msg += ` · Advance deducted: ₹${advance_deducted.toLocaleString()} · Net: ₹${net_payment.toLocaleString()}`;
      }
      if (advance_created) {
        msg += ` · Advance of ₹${excess_amount.toLocaleString()} recorded`;
      } else if (excess_amount > 0) {
        msg += ` · Excess: ₹${excess_amount.toLocaleString()}`;
      } else if (remaining > 0) {
        msg += ` · ₹${remaining.toLocaleString()} still pending`;
      } else if (!advance_deducted) {
        msg += ' · fully cleared';
      }
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 5000);
      closePayPanel();
      fetchData(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to pay salary');
    } finally {
      setPayingLabour(null);
    }
  };

  const getLatestWeekEnd = (records) => {
    if (!records || records.length === 0) return null;
    return records[records.length - 1].week_end;
  };

  // Group pending labours by site for display
  const getPendingGrouped = () => {
    const allLabours = pendingSalaries?.labours || [];
    if (selectedSite !== 'all') {
      const filtered = selectedSite === 'unassigned'
        ? allLabours.filter(l => !labourSiteMap[l.labour_id])
        : allLabours.filter(l => labourSiteMap[l.labour_id]?.id === selectedSite);
      return [{ siteId: selectedSite, siteName: null, labours: filtered }];
    }

    // Group by site
    const grouped = {};
    const unassigned = [];
    allLabours.forEach(l => {
      const site = labourSiteMap[l.labour_id];
      if (site) {
        if (!grouped[site.id]) grouped[site.id] = { siteId: site.id, siteName: site.name, labours: [] };
        grouped[site.id].labours.push(l);
      } else {
        unassigned.push(l);
      }
    });

    const groups = siteList
      .filter(s => grouped[s.id])
      .map(s => grouped[s.id]);

    if (unassigned.length > 0) {
      groups.push({ siteId: 'unassigned', siteName: 'Unassigned', labours: unassigned });
    }
    return groups;
  };

  // Pending total for current filter
  const filteredPendingTotal = () => {
    const groups = getPendingGrouped();
    return groups.flatMap(g => g.labours).reduce((sum, l) => sum + (l.total_pending || 0), 0);
  };

  const filteredLabourCount = () => {
    const groups = getPendingGrouped();
    return groups.flatMap(g => g.labours).filter(l => l.total_pending > 0).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingGroups = getPendingGrouped();

  return (
    <div className="space-y-6">
      {slip && <SalarySlip slip={slip} onClose={() => setSlip(null)} />}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
          }`}
        >
          Pending Payments
        </button>
        <button
          onClick={() => setTab('register')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'register' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
          }`}
        >
          Pay Register
        </button>
        {isAdmin && (
          <button
            onClick={() => { setTab('history'); if (!paymentHistory) fetchPaymentHistory(); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'history' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
            }`}
          >
            Payment History
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
          <Check size={20} />
          <span>{success}</span>
        </div>
      )}

      {tab === 'pending' && <>
      {/* Summary Card */}
      <div className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg opacity-90">
              {selectedSite === 'all'
                ? 'Total Pending Salary'
                : selectedSite === 'unassigned'
                  ? 'Unassigned — Pending Salary'
                  : `${siteList.find(s => s.id === selectedSite)?.name || 'Site'} — Pending Salary`}
            </h2>
            <p className="text-4xl font-bold mt-2">
              ₹{filteredPendingTotal().toLocaleString()}
            </p>
            <p className="text-sm opacity-75 mt-1">
              {filteredLabourCount()} labour{filteredLabourCount() !== 1 ? 's' : ''} with pending payment
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={handleCalculateAll}
              disabled={calculating}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
            >
              {calculating ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <RefreshCw size={20} />
              )}
              Calculate All Salaries
            </button>
          )}
        </div>
      </div>

      {/* Site Filter Pills */}
      {siteList.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <MapPin size={15} className="text-gray-400 dark:text-gray-500" />
          <button
            onClick={() => setSelectedSite('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedSite === 'all'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary-400'
            }`}
          >
            All Sites
          </button>
          {siteList.map(site => (
            <button
              key={site.id}
              onClick={() => setSelectedSite(site.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedSite === site.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary-400'
              }`}
            >
              {site.name}
            </button>
          ))}
          {(pendingSalaries?.labours || []).some(l => !labourSiteMap[l.labour_id]) && (
            <button
              onClick={() => setSelectedSite('unassigned')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedSite === 'unassigned'
                  ? 'bg-gray-600 text-white border-gray-600'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400'
              }`}
            >
              Unassigned
            </button>
          )}
        </div>
      )}

      {/* Pending Salaries List — grouped by site */}
      <div className="space-y-6">
        {pendingGroups.length === 0 && (
          <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
            <Wallet size={48} className="mx-auto mb-4 opacity-50" />
            <p>No labours found</p>
          </div>
        )}

        {pendingGroups.map((group) => (
          <div key={group.siteId}>
            {/* Site section header — only shown in "All Sites" view */}
            {selectedSite === 'all' && (
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={15} className="text-primary-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {group.siteName}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  — ₹{group.labours.reduce((s, l) => s + (l.total_pending || 0), 0).toLocaleString()} pending
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-1" />
              </div>
            )}

            <div className="space-y-4">
              {group.labours.map((labour) => (
                <LabourSalaryCard
                  key={labour.labour_id}
                  labour={labour}
                  advances={advances}
                  expandedLabour={expandedLabour}
                  setExpandedLabour={setExpandedLabour}
                  payPanel={payPanel}
                  payAmount={payAmount}
                  setPayAmount={setPayAmount}
                  paymentComment={paymentComment}
                  setPaymentComment={setPaymentComment}
                  advanceDeduction={advanceDeduction}
                  setAdvanceDeduction={setAdvanceDeduction}
                  advanceDeductionAmount={advanceDeductionAmount}
                  setAdvanceDeductionAmount={setAdvanceDeductionAmount}
                  advancePayment={advancePayment}
                  setAdvancePayment={setAdvancePayment}
                  payingLabour={payingLabour}
                  calculatingLabour={calculatingLabour}
                  openPayPanel={openPayPanel}
                  closePayPanel={closePayPanel}
                  handlePay={handlePay}
                  handleCalculateOne={handleCalculateOne}
                  handleOpenSlip={handleOpenSlip}
                  siteName={selectedSite === 'all' ? null : labourSiteMap[labour.labour_id]?.name}
                />
              ))}

              {group.labours.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                  No labours in this site
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      </>}

      {tab === 'register' && (
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Monthly Pay Register</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Year</label>
              <input
                type="number"
                value={regYear}
                onChange={(e) => setRegYear(Number(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm w-24 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Month</label>
              <select
                value={regMonth}
                onChange={(e) => setRegMonth(Number(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleLoadRegister}
              disabled={regLoading}
              className="btn-primary flex items-center gap-2"
            >
              {regLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Load
            </button>
          </div>

          {register && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {MONTHS[register.month - 1]} {register.year} —{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{register.labours.length} labours</span>
              </p>
              {register.labours.length === 0 ? (
                <p className="text-center py-8 text-gray-400 dark:text-gray-500">No salary records for this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Labour</th>
                        <th className="text-center px-3 py-2 text-gray-600 dark:text-gray-300">Weeks</th>
                        <th className="text-right px-3 py-2 text-gray-600 dark:text-gray-300">Earned</th>
                        <th className="text-right px-3 py-2 text-gray-600 dark:text-gray-300">Paid</th>
                        <th className="text-right px-3 py-2 text-gray-600 dark:text-gray-300">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {register.labours.map((l) => (
                        <React.Fragment key={l.labour_id}>
                          <tr
                            className={`border-t cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${expandedRegLabour === l.labour_id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                            onClick={() => setExpandedRegLabour(expandedRegLabour === l.labour_id ? null : l.labour_id)}
                          >
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                              {expandedRegLabour === l.labour_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              {l.labour_name}
                              {labourSiteMap[l.labour_id] && (
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-normal flex items-center gap-0.5">
                                  <MapPin size={11} />
                                  {labourSiteMap[l.labour_id].name}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{l.weeks.length}</td>
                            <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200">₹{l.total_earned.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-green-700">₹{l.total_paid.toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${l.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              ₹{l.balance.toLocaleString()}
                            </td>
                          </tr>
                          {expandedRegLabour === l.labour_id && (
                            <tr>
                              <td colSpan={5} className="bg-gray-50 dark:bg-gray-800 px-4 py-3">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <FileText size={16} />
                                    Weekly Payment Details
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-gray-100 dark:bg-gray-700">
                                        <tr>
                                          <th className="text-left px-2 py-1.5 text-gray-600 dark:text-gray-400">Week</th>
                                          <th className="text-center px-2 py-1.5 text-gray-600 dark:text-gray-400">Days</th>
                                          <th className="text-right px-2 py-1.5 text-gray-600 dark:text-gray-400">Earned</th>
                                          <th className="text-right px-2 py-1.5 text-gray-600 dark:text-gray-400">Paid</th>
                                          <th className="text-right px-2 py-1.5 text-gray-600 dark:text-gray-400">Balance</th>
                                          <th className="text-center px-2 py-1.5 text-gray-600 dark:text-gray-400">Status</th>
                                          <th className="text-left px-2 py-1.5 text-gray-600 dark:text-gray-400">Payment History</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {l.weeks.map((w, idx) => (
                                          <tr key={idx} className="border-t border-gray-200 dark:border-gray-600 align-top">
                                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                              {new Date(w.week_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(w.week_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </td>
                                            <td className="px-2 py-1.5 text-center text-gray-600 dark:text-gray-400">{w.days_present}</td>
                                            <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300">₹{w.total_amount.toLocaleString()}</td>
                                            <td className="px-2 py-1.5 text-right text-green-600">₹{w.paid_amount.toLocaleString()}</td>
                                            <td className={`px-2 py-1.5 text-right font-medium ${(w.total_amount - w.paid_amount) > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                              ₹{(w.total_amount - w.paid_amount).toLocaleString()}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                              {w.is_paid ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                  <Check size={10} /> Paid
                                                </span>
                                              ) : w.paid_amount > 0 ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                  Partial
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                  Pending
                                                </span>
                                              )}
                                            </td>
                                            {/* Payment log entries for this week */}
                                            <td className="px-2 py-1.5">
                                              {(!w.payments || w.payments.length === 0) ? (
                                                <span className="text-gray-400 dark:text-gray-500">—</span>
                                              ) : (
                                                <div className="space-y-1">
                                                  {w.payments.map((p) => (
                                                    <div key={p.id} className="flex items-start gap-2 text-[11px]">
                                                      <span className="font-semibold text-green-600 whitespace-nowrap">₹{p.amount.toLocaleString()}</span>
                                                      <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                        {new Date(p.paid_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                      </span>
                                                      <span className="text-gray-500 dark:text-gray-400">by {p.paid_by}</span>
                                                      {p.comment && (
                                                        <span className="text-gray-400 dark:text-gray-500 italic break-words" title={p.comment}>
                                                          "{p.comment}"
                                                        </span>
                                                      )}
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                                    <span>Daily Wage: <strong className="text-gray-700 dark:text-gray-300">₹{l.daily_wage.toLocaleString()}</strong></span>
                                    <span>Total Weeks: <strong className="text-gray-700 dark:text-gray-300">{l.weeks.length}</strong></span>
                                    <span>Paid Weeks: <strong className="text-green-600">{l.weeks.filter(w => w.is_paid).length}</strong></span>
                                    <span>Pending Weeks: <strong className="text-orange-500">{l.weeks.filter(w => !w.is_paid).length}</strong></span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <td className="px-3 py-2 font-bold text-gray-800 dark:text-gray-100">Total</td>
                        <td />
                        <td className="px-3 py-2 text-right font-bold text-gray-800 dark:text-gray-100">₹{register.grand_total_earned.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">₹{register.grand_total_paid.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-orange-600">
                          ₹{(register.grand_total_earned - register.grand_total_paid).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'history' && isAdmin && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recent Payments</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search by labour name..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm w-64 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={fetchPaymentHistory}
                disabled={historyLoading}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {historyLoading ? (
                  <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Refresh
              </button>
            </div>
          </div>

          {historyLoading && !paymentHistory ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !paymentHistory || paymentHistory.length === 0 ? (
            <p className="text-center py-8 text-gray-400 dark:text-gray-500">No payment records found</p>
          ) : (
            <>
              {historySearchTerm && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {paymentHistory.filter(p => p.labour_name.toLowerCase().includes(historySearchTerm.toLowerCase())).length} of {paymentHistory.length} payments
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Labour</th>
                      <th className="text-right px-3 py-2 text-gray-600 dark:text-gray-300">Amount</th>
                      <th className="text-center px-3 py-2 text-gray-600 dark:text-gray-300">Date</th>
                      <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Paid By</th>
                      <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Comment</th>
                      <th className="text-center px-3 py-2 text-gray-600 dark:text-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory
                      .filter(p => p.labour_name.toLowerCase().includes(historySearchTerm.toLowerCase()))
                      .map((p) => (
                    <tr key={p.id} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{p.labour_name}</td>
                      <td className="px-3 py-2 text-right font-semibold text-green-600">₹{p.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">
                        {new Date(p.paid_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.paid_by}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate" title={p.comment || ''}>
                        {p.comment || '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRevertPayment(p.id, p.labour_name, p.amount)}
                          disabled={revertingId === p.id}
                          className="px-2 py-1 text-xs font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-300 dark:border-red-700 rounded transition-colors disabled:opacity-50"
                        >
                          {revertingId === p.id ? (
                            <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            'Revert'
                          )}
                        </button>
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Extracted labour card to keep main component lean
const LabourSalaryCard = ({
  labour, advances, expandedLabour, setExpandedLabour,
  payPanel, payAmount, setPayAmount, paymentComment, setPaymentComment,
  advanceDeduction, setAdvanceDeduction, advanceDeductionAmount, setAdvanceDeductionAmount,
  advancePayment, setAdvancePayment,
  payingLabour, calculatingLabour, openPayPanel, closePayPanel,
  handlePay, handleCalculateOne, handleOpenSlip, siteName,
}) => (
  <div
    className={`border rounded-lg overflow-hidden ${
      labour.total_pending > 0 ? 'border-orange-200 dark:border-orange-800' : 'border-gray-200 dark:border-gray-700'
    }`}
  >
    <div
      className={`p-4 flex items-center justify-between cursor-pointer ${
        labour.total_pending > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-700'
      }`}
      onClick={() => setExpandedLabour(expandedLabour === labour.labour_id ? null : labour.labour_id)}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
          <Wallet className="text-primary-600" size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-800 dark:text-gray-100">{labour.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              labour.pay_cycle === 'monthly'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {labour.pay_cycle === 'monthly' ? 'Monthly' : 'Weekly'}
            </span>
            {siteName && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <MapPin size={11} />
                {siteName}
              </span>
            )}
            {advances[labour.labour_id] > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 flex items-center gap-1">
                <Banknote size={12} />
                Adv: ₹{advances[labour.labour_id].toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {labour.weeks_pending || 0} {labour.pay_cycle === 'monthly' ? 'month(s)' : 'week(s)'} pending
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={`text-lg font-bold ${
            labour.total_pending > 0 ? 'text-orange-600' : 'text-green-600'
          }`}>
            ₹{(labour.total_pending || 0).toLocaleString()}
          </p>
          {advances[labour.labour_id] > 0 && (
            <p className="text-xs text-red-600">
              Net: ₹{Math.max(0, (labour.total_pending || 0) - advances[labour.labour_id]).toLocaleString()}
            </p>
          )}
        </div>
        {expandedLabour === labour.labour_id ? (
          <ChevronUp size={20} className="text-gray-400" />
        ) : (
          <ChevronDown size={20} className="text-gray-400" />
        )}
      </div>
    </div>

    {expandedLabour === labour.labour_id && (
      <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
        {labour.records && labour.records.length > 0 ? (
          <>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400">
                  <th className="text-left py-2">{labour.pay_cycle === 'monthly' ? 'Month' : 'Week'}</th>
                  <th className="text-center py-2">Days</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {labour.records.map((record, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="py-2">
                      {new Date(record.week_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} –{' '}
                      {new Date(record.week_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="text-center py-2">{record.days_present}</td>
                    <td className="text-right py-2 font-medium">
                      ₹{record.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-3 flex-wrap">
              <div className="relative group">
                <button
                  onClick={() => handleOpenSlip(labour, 'last')}
                  className="btn-secondary flex items-center gap-2"
                >
                  <FileText size={18} />
                  Slip
                </button>
                {labour.total_pending > 0 && (
                  <button
                    onClick={() => handleOpenSlip(labour, 'all_pending')}
                    className="btn-secondary flex items-center gap-1 text-xs mt-1 w-full justify-center"
                  >
                    All Pending
                  </button>
                )}
              </div>
              <button
                onClick={() => handleCalculateOne(labour.labour_id)}
                disabled={calculatingLabour === labour.labour_id}
                className="btn-secondary flex items-center gap-2"
              >
                {calculatingLabour === labour.labour_id ? (
                  <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Calculator size={18} />
                )}
                Recalculate
              </button>
              {labour.total_pending > 0 && (
                payPanel?.labourId === labour.labour_id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">₹</span>
                        <input
                          type="number"
                          min="1"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="w-32 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          autoFocus
                        />
                        <button
                          onClick={handlePay}
                          disabled={payingLabour === labour.labour_id}
                          className="btn-success flex items-center gap-1.5"
                        >
                          {payingLabour === labour.labour_id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CreditCard size={16} />
                          )}
                          Confirm Pay
                        </button>
                        <button onClick={closePayPanel} className="text-gray-400 hover:text-gray-600">
                          <X size={18} />
                        </button>
                      </div>
                      {(() => {
                        const entered = parseFloat(payAmount);
                        const remaining = isNaN(entered) ? labour.total_pending : Math.max(0, labour.total_pending - entered);
                        const excess = isNaN(entered) ? 0 : Math.max(0, entered - labour.total_pending);
                        const color = remaining === 0 ? (excess > 0 ? 'text-blue-600' : 'text-green-600') : 'text-orange-500';
                        const pendingAdvance = advances[labour.labour_id] || 0;
                        const deductAmt = advanceDeduction === 'full' ? pendingAdvance : (advanceDeduction === 'partial' ? (parseFloat(advanceDeductionAmount) || 0) : 0);
                        const netPayment = entered - deductAmt;
                        return (
                          <>
                            <p className={`text-xs mt-1 ml-5 font-medium ${color}`}>
                              {excess > 0
                                ? (advancePayment
                                    ? `₹${excess.toLocaleString()} will be recorded as advance`
                                    : `⚠ Excess payment of ₹${excess.toLocaleString()} — comment required`)
                                : remaining === 0
                                  ? '✓ Full payment — all weeks cleared'
                                  : `₹${remaining.toLocaleString()} will remain pending`}
                            </p>

                            {/* Advance Payment checkbox — visible only on overpay */}
                            {excess > 0 && (
                              <label className="flex items-center gap-2 mt-2 ml-5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={advancePayment}
                                  onChange={(e) => setAdvancePayment(e.target.checked)}
                                  className="w-4 h-4 rounded border-blue-400 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                  Record ₹{excess.toLocaleString()} as advance payment
                                </span>
                              </label>
                            )}

                            <input
                              type="text"
                              placeholder={excess > 0 && !advancePayment ? "Reason for excess payment (required)" : "Comment (optional)"}
                              value={paymentComment}
                              onChange={(e) => setPaymentComment(e.target.value)}
                              className={`mt-2 ml-5 w-64 border rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 ${excess > 0 && !advancePayment ? 'border-blue-300 dark:border-blue-600 focus:ring-blue-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'}`}
                            />


                            {/* Advance Deduction Section */}
                            {pendingAdvance > 0 && (
                              <div className="mt-3 ml-5 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded">
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
                                  Pending Advance: ₹{pendingAdvance.toLocaleString()}
                                </p>
                                <div className="flex flex-wrap gap-2 items-center">
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="radio"
                                      name={`advance-${labour.labour_id}`}
                                      checked={advanceDeduction === 'none'}
                                      onChange={() => { setAdvanceDeduction('none'); setAdvanceDeductionAmount(''); }}
                                      className="w-3 h-3"
                                    />
                                    <span className="text-gray-600 dark:text-gray-400">No deduction</span>
                                  </label>
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="radio"
                                      name={`advance-${labour.labour_id}`}
                                      checked={advanceDeduction === 'full'}
                                      onChange={() => { setAdvanceDeduction('full'); setAdvanceDeductionAmount(''); }}
                                      className="w-3 h-3"
                                    />
                                    <span className="text-gray-600 dark:text-gray-400">Full (₹{pendingAdvance.toLocaleString()})</span>
                                  </label>
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="radio"
                                      name={`advance-${labour.labour_id}`}
                                      checked={advanceDeduction === 'partial'}
                                      onChange={() => setAdvanceDeduction('partial')}
                                      className="w-3 h-3"
                                    />
                                    <span className="text-gray-600 dark:text-gray-400">Partial</span>
                                  </label>
                                  {advanceDeduction === 'partial' && (
                                    <input
                                      type="number"
                                      min="1"
                                      max={pendingAdvance}
                                      placeholder="Amount"
                                      value={advanceDeductionAmount}
                                      onChange={(e) => setAdvanceDeductionAmount(e.target.value)}
                                      className="w-24 border border-amber-300 dark:border-amber-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  )}
                                </div>
                                {deductAmt > 0 && !isNaN(entered) && (
                                  <p className="text-xs mt-2 text-amber-700 dark:text-amber-400">
                                    Net payment after deduction: <strong>₹{netPayment.toLocaleString()}</strong>
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openPayPanel(labour)}
                    className="btn-success flex items-center gap-2"
                  >
                    <CreditCard size={18} />
                    Pay ₹{labour.total_pending.toLocaleString()}
                  </button>
                )
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <p>No pending salary records</p>
            <button
              onClick={() => handleCalculateOne(labour.labour_id)}
              disabled={calculatingLabour === labour.labour_id}
              className="btn-secondary mt-2 flex items-center gap-2 mx-auto"
            >
              {calculatingLabour === labour.labour_id ? (
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Calculator size={18} />
              )}
              Calculate Salary
            </button>
          </div>
        )}
      </div>
    )}
  </div>
);

export default Salary;
