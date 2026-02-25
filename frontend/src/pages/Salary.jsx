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
      setError('');
      await salaryAPI.calculate(labourId);
      setSuccess('Salary calculated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      fetchData(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to calculate salary');
    }
  };

  const handlePay = async (labourId, weekEnd) => {
    try {
      setPayingLabour(labourId);
      setError('');
      await salaryAPI.pay(labourId, weekEnd);
      setSuccess('Salary paid successfully!');
      setTimeout(() => setSuccess(''), 3000);
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
                    <p className="font-semibold text-gray-800">{labour.name}</p>
                    <p className="text-sm text-gray-500">
                      {labour.weeks_pending || 0} week(s) pending
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
                            <th className="text-left py-2">Week</th>
                            <th className="text-center py-2">Days</th>
                            <th className="text-right py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labour.records.map((record, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="py-2">
                                {new Date(record.week_start).toLocaleDateString()} -{' '}
                                {new Date(record.week_end).toLocaleDateString()}
                              </td>
                              <td className="text-center py-2">{record.days_present}</td>
                              <td className="text-right py-2 font-medium">
                                ₹{record.amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleCalculateOne(labour.labour_id)}
                          className="btn-secondary flex items-center gap-2"
                        >
                          <Calculator size={18} />
                          Recalculate
                        </button>
                        {labour.total_pending > 0 && (
                          <button
                            onClick={() =>
                              handlePay(labour.labour_id, getLatestWeekEnd(labour.records))
                            }
                            disabled={payingLabour === labour.labour_id}
                            className="btn-success flex items-center gap-2"
                          >
                            {payingLabour === labour.labour_id ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CreditCard size={18} />
                            )}
                            Pay ₹{labour.total_pending.toLocaleString()}
                          </button>
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
