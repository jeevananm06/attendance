import { useState, useEffect } from 'react';
import { salaryAPI, laboursAPI } from '../api';
import {
  Wallet,
  Calculator,
  CreditCard,
  AlertCircle,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Salary = () => {
  const { isAdmin } = useAuth();
  const [pendingSalaries, setPendingSalaries] = useState(null);
  const [labours, setLabours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedLabour, setExpandedLabour] = useState(null);
  const [payingLabour, setPayingLabour] = useState(null);
  const [calculatingLabour, setCalculatingLabour] = useState(null);
  const [payPanel, setPayPanel] = useState(null); // { labourId, weekEnd, total }
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [pendingRes, laboursRes] = await Promise.all([
        salaryAPI.getAllPending(),
        laboursAPI.getAll()
      ]);
      const data = pendingRes.data;
      if (data?.labours) {
        data.labours = [...data.labours].sort((a, b) => a.name.localeCompare(b.name));
      }
      setPendingSalaries(data);
      setLabours([...laboursRes.data].sort((a, b) => a.name.localeCompare(b.name)));
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

  const closePayPanel = () => { setPayPanel(null); setPayAmount(''); };

  const handlePay = async () => {
    const { labourId, weekEnd, total } = payPanel;
    const entered = parseFloat(payAmount);
    if (isNaN(entered) || entered <= 0) { setError('Enter a valid amount'); return; }
    try {
      setPayingLabour(labourId);
      setError('');
      const res = await salaryAPI.pay(labourId, weekEnd, entered >= total ? null : entered);
      const { amount_paid, remaining, weeks_paid } = res.data;
      setSuccess(`Paid ₹${amount_paid.toLocaleString()} (${weeks_paid} week${weeks_paid !== 1 ? 's' : ''})${ remaining > 0 ? ` · ₹${remaining.toLocaleString()} still pending` : ' · fully cleared'}`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Summary Card */}
      <div className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg opacity-90">Total Pending Salary</h2>
            <p className="text-4xl font-bold mt-2">
              ₹{(pendingSalaries?.total_pending || 0).toLocaleString()}
            </p>
            <p className="text-sm opacity-75 mt-1">
              {pendingSalaries?.labours?.filter((l) => l.total_pending > 0).length || 0} labours with pending payment
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

      {/* Pending Salaries List */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Pending Payments</h3>

        <div className="space-y-4">
          {pendingSalaries?.labours?.map((labour) => (
            <div
              key={labour.labour_id}
              className={`border rounded-lg overflow-hidden ${
                labour.total_pending > 0 ? 'border-orange-200' : 'border-gray-200'
              }`}
            >
              <div
                className={`p-4 flex items-center justify-between cursor-pointer ${
                  labour.total_pending > 0 ? 'bg-orange-50' : 'bg-gray-50'
                }`}
                onClick={() =>
                  setExpandedLabour(expandedLabour === labour.labour_id ? null : labour.labour_id)
                }
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <Wallet className="text-primary-600" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{labour.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        labour.pay_cycle === 'monthly'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {labour.pay_cycle === 'monthly' ? 'Monthly' : 'Weekly'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
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
                  </div>
                  {expandedLabour === labour.labour_id ? (
                    <ChevronUp size={20} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-400" />
                  )}
                </div>
              </div>

              {expandedLabour === labour.labour_id && (
                <div className="p-4 border-t bg-white">
                  {labour.records && labour.records.length > 0 ? (
                    <>
                      <table className="w-full text-sm mb-4">
                        <thead>
                          <tr className="text-gray-500">
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
                                  <span className="text-sm text-gray-600">₹</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max={labour.total_pending}
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    className="w-32 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                                  const color = remaining === 0 ? 'text-green-600' : 'text-orange-500';
                                  return (
                                    <p className={`text-xs mt-1 ml-5 font-medium ${color}`}>
                                      {remaining === 0
                                        ? '✓ Full payment — all weeks cleared'
                                        : `₹${remaining.toLocaleString()} will remain pending`}
                                    </p>
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
                    <div className="text-center py-4 text-gray-500">
                      <p>No pending salary records</p>
                      <button
                        onClick={() => handleCalculateOne(labour.labour_id)}
                        className="btn-secondary mt-2"
                      >
                        Calculate Salary
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {(!pendingSalaries?.labours || pendingSalaries.labours.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            <Wallet size={48} className="mx-auto mb-4 opacity-50" />
            <p>No labours found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Salary;
