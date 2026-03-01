 import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  overtimeAPI, advancesAPI, leavesAPI, sitesAPI,
  auditAPI, backupAPI, reportsAPI, laboursAPI, documentsAPI
} from '../api';
import {
  Clock, Wallet, Calendar, MapPin, Shield, Database, FileText,
  Plus, Check, X, AlertCircle, Download, RefreshCw, ChevronDown, ChevronUp,
  FileArchive, Trash2, Eye, Upload, Users, Info
} from 'lucide-react';

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
      active
        ? 'text-primary-600 border-b-2 border-primary-600'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
    }`}
  >
    <Icon size={18} />
    {label}
  </button>
);

const More = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overtime');
  const [labours, setLabours] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchLabours();
  }, []);

  const fetchLabours = async () => {
    try {
      const res = await laboursAPI.getAll();
      setLabours(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const tabs = [
    { id: 'overtime', label: 'Overtime', icon: Clock },
    { id: 'advances', label: 'Advances', icon: Wallet },
    { id: 'leaves', label: 'Leaves', icon: Calendar },
    { id: 'sites', label: 'Sites', icon: MapPin },
    { id: 'documents', label: 'Documents', icon: FileArchive },
    { id: 'reports', label: 'Reports', icon: FileText },
    ...(isAdmin ? [
      { id: 'audit', label: 'Audit Logs', icon: Shield },
      { id: 'backup', label: 'Backup', icon: Database },
    ] : []),
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X size={20} /></button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
          <Check size={20} />
          <span>{success}</span>
        </div>
      )}

      <div className="card">
        <div className="flex overflow-x-auto border-b dark:border-gray-700 -mx-6 px-6">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </div>

        <div className="mt-6">
          {activeTab === 'overtime' && (
            <OvertimeTab labours={labours} setError={setError} setSuccess={setSuccess} />
          )}
          {activeTab === 'advances' && (
            <AdvancesTab labours={labours} setError={setError} setSuccess={setSuccess} />
          )}
          {activeTab === 'leaves' && (
            <LeavesTab labours={labours} setError={setError} setSuccess={setSuccess} />
          )}
          {activeTab === 'sites' && (
            <SitesTab labours={labours} setError={setError} setSuccess={setSuccess} isAdmin={isAdmin} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab labours={labours} isAdmin={isAdmin} setError={setError} setSuccess={setSuccess} />
          )}
          {activeTab === 'reports' && (
            <ReportsTab labours={labours} isAdmin={isAdmin} />
          )}
          {activeTab === 'audit' && isAdmin && (
            <AuditTab />
          )}
          {activeTab === 'backup' && isAdmin && (
            <BackupTab setError={setError} setSuccess={setSuccess} />
          )}
        </div>
      </div>
    </div>
  );
};

// Overtime Tab
const OvertimeTab = ({ labours, setError, setSuccess }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    labour_id: '', date: new Date().toISOString().split('T')[0], hours: '', rate_multiplier: '1'
  });

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await overtimeAPI.getAll();
      setRecords(res.data);
    } catch (err) {
      setError('Failed to load overtime records');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await overtimeAPI.create({
        ...formData,
        hours: parseFloat(formData.hours),
        rate_multiplier: parseFloat(formData.rate_multiplier)
      });
      setSuccess('Overtime added successfully');
      setShowForm(false);
      setFormData({ labour_id: '', date: new Date().toISOString().split('T')[0], hours: '', rate_multiplier: '1.5' });
      fetchRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add overtime');
    }
  };

  if (loading) return <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Overtime Records</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Overtime
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">
          <select value={formData.labour_id} onChange={(e) => setFormData({...formData, labour_id: e.target.value})} className="input" required>
            <option value="">Select Labour</option>
            {labours.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="input" required />
          <input type="number" placeholder="Hours" value={formData.hours} onChange={(e) => setFormData({...formData, hours: e.target.value})} className="input" step="0.5" min="0.5" required />
          <select value={formData.rate_multiplier} onChange={(e) => setFormData({...formData, rate_multiplier: e.target.value})} className="input">
            <option value="1">1x Rate</option>
            <option value="1.5">1.5x Rate</option>
            <option value="2">2x Rate</option>
            <option value="2.5">2.5x Rate</option>
          </select>
          <button type="submit" className="btn-success">Save</button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <th className="text-left py-3 px-4">Labour</th>
            <th className="text-left py-3 px-4">Date</th>
            <th className="text-center py-3 px-4">Hours</th>
            <th className="text-center py-3 px-4">Rate</th>
            <th className="text-right py-3 px-4">Amount</th>
          </tr></thead>
          <tbody>
            {records.map((r) => {
              const labour = labours.find(l => l.id === r.labour_id);
              return (
                <tr key={r.id} className="border-b dark:border-gray-700">
                  <td className="py-3 px-4">{labour?.name || r.labour_id}</td>
                  <td className="py-3 px-4">{r.date}</td>
                  <td className="py-3 px-4 text-center">{r.hours}</td>
                  <td className="py-3 px-4 text-center">{r.rate_multiplier}x</td>
                  <td className="py-3 px-4 text-right font-medium">₹{r.amount.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {records.length === 0 && <p className="text-center py-8 text-gray-500 dark:text-gray-400">No overtime records</p>}
      </div>
    </div>
  );
};

// Advances Tab
const AdvancesTab = ({ labours, setError, setSuccess }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deducting, setDeducting] = useState(null);
  const [repayPanel, setRepayPanel] = useState(null); // advance id currently open for repay
  const [repayAmount, setRepayAmount] = useState('');
  const [repaying, setRepaying] = useState(null);
  const [formData, setFormData] = useState({ labour_id: '', amount: '', reason: '' });

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await advancesAPI.getAll();
      setRecords(res.data);
    } catch (err) {
      setError('Failed to load advances');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await advancesAPI.create({ ...formData, amount: parseFloat(formData.amount) });
      setSuccess('Advance given successfully');
      setShowForm(false);
      setFormData({ labour_id: '', amount: '', reason: '' });
      fetchRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to give advance');
    }
  };

  const handleMarkDeducted = async (advanceId) => {
    try {
      setDeducting(advanceId);
      await advancesAPI.markDeducted(advanceId);
      setSuccess('Advance marked as fully deducted');
      fetchRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to mark as deducted');
    } finally {
      setDeducting(null);
    }
  };

  const handlePartialRepay = async (advanceId) => {
    const amount = parseFloat(repayAmount);
    if (!amount || amount <= 0) {
      setError('Enter a valid repay amount');
      return;
    }
    try {
      setRepaying(advanceId);
      await advancesAPI.repayPartial(advanceId, amount);
      setSuccess(`₹${amount.toLocaleString()} repayment recorded`);
      setRepayPanel(null);
      setRepayAmount('');
      fetchRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record repayment');
    } finally {
      setRepaying(null);
    }
  };

  if (loading) return <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto" /></div>;

  const pendingTotal = records.filter(r => !r.is_deducted).reduce((sum, r) => sum + r.amount - (r.repaid_amount || 0), 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">Advance Payments</h3>
          <p className="text-sm text-orange-600">Pending deduction: ₹{pendingTotal.toLocaleString()}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Give Advance
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <select value={formData.labour_id} onChange={(e) => setFormData({...formData, labour_id: e.target.value})} className="input" required>
            <option value="">Select Labour</option>
            {labours.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input type="number" placeholder="Amount" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="input" min="1" required />
          <input type="text" placeholder="Reason (optional)" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="input" />
          <button type="submit" className="btn-success">Save</button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <th className="text-left py-3 px-4">Labour</th>
            <th className="text-left py-3 px-4">Date</th>
            <th className="text-right py-3 px-4">Amount</th>
            <th className="text-right py-3 px-4">Remaining</th>
            <th className="text-left py-3 px-4">Reason</th>
            <th className="text-center py-3 px-4">Status</th>
            <th className="text-center py-3 px-4">Action</th>
          </tr></thead>
          <tbody>
            {records.map((r) => {
              const labour = labours.find(l => l.id === r.labour_id);
              const repaid = r.repaid_amount || 0;
              const remaining = r.amount - repaid;
              const pct = Math.round((repaid / r.amount) * 100);
              return (
                <>
                  <tr key={r.id} className="border-b dark:border-gray-700">
                    <td className="py-3 px-4">{labour?.name || r.labour_id}</td>
                    <td className="py-3 px-4">{r.date}</td>
                    <td className="py-3 px-4 text-right font-medium">₹{r.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      {repaid > 0 ? (
                        <div>
                          <span className={remaining > 0 ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                            ₹{remaining.toLocaleString()}
                          </span>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-1">
                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{pct}% repaid</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{r.reason || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${r.is_deducted ? 'bg-green-100 text-green-700' : repaid > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
                        {r.is_deducted ? 'Fully Repaid' : repaid > 0 ? 'Partial' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!r.is_deducted && (
                        <div className="flex flex-col gap-1 items-center">
                          <button
                            onClick={() => { setRepayPanel(repayPanel === r.id ? null : r.id); setRepayAmount(''); }}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
                          >
                            Partial Repay
                          </button>
                          <button
                            onClick={() => handleMarkDeducted(r.id)}
                            disabled={deducting === r.id}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 mx-auto w-full justify-center"
                          >
                            {deducting === r.id ? <RefreshCw className="animate-spin" size={12} /> : <Check size={12} />}
                            Full Repay
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {repayPanel === r.id && (
                    <tr key={`${r.id}-repay`} className="bg-blue-50 dark:bg-blue-900/30 border-b dark:border-gray-700">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Repay amount (max ₹{remaining.toLocaleString()}):</span>
                          <input
                            type="number"
                            value={repayAmount}
                            onChange={(e) => setRepayAmount(e.target.value)}
                            placeholder="Enter amount"
                            className="input w-40"
                            min="1"
                            max={remaining}
                          />
                          <button
                            onClick={() => handlePartialRepay(r.id)}
                            disabled={repaying === r.id}
                            className="btn-primary flex items-center gap-2 py-1.5 px-4 text-sm"
                          >
                            {repaying === r.id ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                            Confirm
                          </button>
                          <button onClick={() => setRepayPanel(null)} className="text-gray-500 hover:text-gray-700">
                            <X size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {records.length === 0 && <p className="text-center py-8 text-gray-500 dark:text-gray-400">No advance records</p>}
      </div>
    </div>
  );
};

// Leaves Tab
const LeavesTab = ({ labours, setError, setSuccess }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ labour_id: '', leave_type: 'casual', start_date: '', end_date: '', reason: '' });

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await leavesAPI.getAll();
      setRecords(res.data);
    } catch (err) {
      setError('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await leavesAPI.create(formData);
      setSuccess('Leave applied successfully');
      setShowForm(false);
      setFormData({ labour_id: '', leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      fetchRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to apply leave');
    }
  };

  const handleApprove = async (id) => {
    try {
      await leavesAPI.approve(id);
      setSuccess('Leave approved');
      fetchRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to approve leave');
    }
  };

  const handleReject = async (id) => {
    try {
      await leavesAPI.reject(id);
      setSuccess('Leave rejected');
      fetchRecords();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to reject leave');
    }
  };

  if (loading) return <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Leave Management</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Apply Leave
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-6 gap-4">
          <select value={formData.labour_id} onChange={(e) => setFormData({...formData, labour_id: e.target.value})} className="input" required>
            <option value="">Select Labour</option>
            {labours.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={formData.leave_type} onChange={(e) => setFormData({...formData, leave_type: e.target.value})} className="input">
            <option value="casual">Casual</option>
            <option value="sick">Sick</option>
            <option value="earned">Earned</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <input type="date" placeholder="Start Date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} className="input" required />
          <input type="date" placeholder="End Date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="input" required />
          <input type="text" placeholder="Reason" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="input" />
          <button type="submit" className="btn-success">Apply</button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <th className="text-left py-3 px-4">Labour</th>
            <th className="text-left py-3 px-4">Type</th>
            <th className="text-left py-3 px-4">Period</th>
            <th className="text-center py-3 px-4">Days</th>
            <th className="text-center py-3 px-4">Status</th>
            <th className="text-center py-3 px-4">Actions</th>
          </tr></thead>
          <tbody>
            {records.map((r) => {
              const labour = labours.find(l => l.id === r.labour_id);
              return (
                <tr key={r.id} className="border-b dark:border-gray-700">
                  <td className="py-3 px-4">{labour?.name || r.labour_id}</td>
                  <td className="py-3 px-4 capitalize">{r.leave_type}</td>
                  <td className="py-3 px-4">{r.start_date} to {r.end_date}</td>
                  <td className="py-3 px-4 text-center">{r.days}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      r.status === 'approved' ? 'bg-green-100 text-green-700' :
                      r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{r.status}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.status === 'pending' && (
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleApprove(r.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={18} /></button>
                        <button onClick={() => handleReject(r.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={18} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {records.length === 0 && <p className="text-center py-8 text-gray-500 dark:text-gray-400">No leave records</p>}
      </div>
    </div>
  );
};

// Sites Tab
const SitesTab = ({ labours, setError, setSuccess, isAdmin }) => {
  const [sites, setSites] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '' });
  const [assignData, setAssignData] = useState({ labour_id: '', site_id: '' });
  const [hoveredSite, setHoveredSite] = useState(null);
  const [siteLabours, setSiteLabours] = useState({});
  const [hoveredUnassigned, setHoveredUnassigned] = useState(false);
  const [unassignedLabours, setUnassignedLabours] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sitesRes, summaryRes, unassignedRes] = await Promise.all([
        sitesAPI.getAll(), 
        sitesAPI.getSummary(),
        sitesAPI.getUnassignedLabours()
      ]);
      setSites(sitesRes.data);
      setSummary(summaryRes.data);
      setUnassignedLabours(unassignedRes.data.labours || []);
    } catch (err) {
      setError('Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const fetchSiteLabours = async (siteId) => {
    if (siteLabours[siteId]) return; // Already fetched
    
    try {
      const res = await sitesAPI.getLabours(siteId);
      setSiteLabours(prev => ({
        ...prev,
        [siteId]: res.data.labours || []
      }));
    } catch (err) {
      console.error('Failed to fetch site labours:', err);
    }
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    try {
      await sitesAPI.create(formData);
      setSuccess('Site created successfully');
      setShowForm(false);
      setFormData({ name: '', address: '' });
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create site');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await sitesAPI.assign(assignData.labour_id, assignData.site_id);
      setSuccess('Labour assigned to site');
      setAssignData({ labour_id: '', site_id: '' });
      
      // Refresh data
      await fetchData();
      
      // Clear cached site labours for the assigned site
      setSiteLabours(prev => {
        const newSiteLabours = { ...prev };
        delete newSiteLabours[assignData.site_id];
        return newSiteLabours;
      });
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign');
    }
  };

  if (loading) return <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto" /></div>;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{summary?.total_sites || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Sites</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{summary?.assigned_labours || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Assigned</p>
        </div>
        <div 
          className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg text-center relative cursor-pointer"
          onMouseEnter={() => setHoveredUnassigned(true)}
          onMouseLeave={() => setHoveredUnassigned(false)}
        >
          <p className="text-2xl font-bold text-orange-600">{summary?.unassigned_labours || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Unassigned</p>
          <Info size={14} className="inline-block ml-1 text-orange-500" />
          
          {hoveredUnassigned && unassignedLabours.length > 0 && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white p-3 rounded-lg shadow-lg z-10">
              <div className="text-xs font-semibold mb-2 text-orange-300">Unassigned Labours:</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {unassignedLabours.slice(0, 10).map(labour => (
                  <div key={labour.id} className="text-xs flex items-center gap-2">
                    <Users size={12} />
                    {labour.name}
                  </div>
                ))}
                {unassignedLabours.length > 10 && (
                  <div className="text-xs text-gray-400 italic">
                    ... and {unassignedLabours.length - 10} more
                  </div>
                )}
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{summary?.total_labours || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Labours</p>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Site
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form onSubmit={handleCreateSite} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Site Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="input" required />
          <input type="text" placeholder="Address (optional)" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="input" />
          <button type="submit" className="btn-success">Create Site</button>
        </form>
      )}

      <form onSubmit={handleAssign} className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <select value={assignData.labour_id} onChange={(e) => setAssignData({...assignData, labour_id: e.target.value})} className="input" required>
          <option value="">Select Labour</option>
          {labours.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={assignData.site_id} onChange={(e) => setAssignData({...assignData, site_id: e.target.value})} className="input" required>
          <option value="">Select Site</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="submit" className="btn-primary">Assign to Site</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary?.sites?.map((site) => (
          <div 
            key={site.site_id} 
            className="border dark:border-gray-700 rounded-lg p-4 relative cursor-pointer hover:shadow-md transition-shadow"
            onMouseEnter={() => {
              setHoveredSite(site.site_id);
              fetchSiteLabours(site.site_id);
            }}
            onMouseLeave={() => setHoveredSite(null)}
          >
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="text-primary-600" size={20} />
              <h4 className="font-semibold dark:text-gray-100">{site.name}</h4>
              <Info size={14} className="ml-auto text-gray-400" />
            </div>
            {site.address && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{site.address}</p>}
            <p className="text-sm"><span className="font-medium">{site.labour_count}</span> labours assigned</p>
            
            {hoveredSite === site.site_id && siteLabours[site.site_id] && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white p-3 rounded-lg shadow-lg z-10">
                <div className="text-xs font-semibold mb-2 text-blue-300">Labours at {site.name}:</div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {siteLabours[site.site_id].length > 0 ? (
                    siteLabours[site.site_id].map(labour => (
                      <div key={labour.id} className="text-xs flex items-center gap-2">
                        <Users size={12} />
                        {labour.name}
                        <span className="text-gray-400">₹{labour.daily_wage}/day</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400 italic">No labours assigned</div>
                  )}
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {sites.length === 0 && <p className="text-center py-8 text-gray-500 dark:text-gray-400">No sites created</p>}
    </div>
  );
};

// Documents Tab
const DOC_TYPES = ['aadhar', 'pan', 'photo', 'certificate', 'contract', 'other'];

const DocumentsTab = ({ labours, isAdmin, setError, setSuccess }) => {
  const [selectedLabour, setSelectedLabour] = useState('');
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('aadhar');

  const loadDocs = async (labourId) => {
    if (!labourId) return;
    setLoadingDocs(true);
    try {
      const res = await documentsAPI.list(labourId);
      setDocs(res.data.documents || []);
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleLabourChange = (e) => {
    setSelectedLabour(e.target.value);
    setDocs([]);
    if (e.target.value) loadDocs(e.target.value);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLabour) return;
    setUploading(true);
    try {
      await documentsAPI.upload(selectedLabour, file, docType);
      setSuccess('Document uploaded');
      loadDocs(selectedLabour);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await documentsAPI.delete(selectedLabour, docId);
      setSuccess('Document deleted');
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError('Failed to delete document');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Labour Documents</h3>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">Select Labour</label>
          <select value={selectedLabour} onChange={handleLabourChange} className="input">
            <option value="">Select Labour</option>
            {labours.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {isAdmin && selectedLabour && (
          <>
            <div>
              <label className="label">Document Type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input w-36">
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <label className={`btn-primary flex items-center gap-2 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              {uploading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Upload
              <input type="file" className="hidden" onChange={handleUpload}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
            </label>
          </>
        )}
      </div>

      {loadingDocs ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : selectedLabour && docs.length === 0 ? (
        <p className="text-center py-8 text-gray-400">No documents uploaded yet</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 border dark:border-gray-700 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-primary-600" />
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{doc.original_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {doc.doc_type} · Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={documentsAPI.getDownloadUrl(selectedLabour, doc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-blue-600"
                  title="View / Download"
                >
                  <Eye size={16} />
                </a>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Reports Tab
const ReportsTab = ({ labours, isAdmin }) => {
  const [reportType, setReportType] = useState('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [labourId, setLabourId] = useState('');
  const [loading, setLoading] = useState(false);

  const openReport = async () => {
    setLoading(true);
    try {
      let response;
      if (reportType === 'monthly') {
        response = await reportsAPI.getMonthly(year, month);
      } else if (reportType === 'payroll') {
        response = await reportsAPI.getPayroll(year, month);
      } else if (reportType === 'labour' && labourId) {
        response = await reportsAPI.getLabourReport(labourId);
      } else {
        response = await reportsAPI.getSummary();
      }
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Generate Reports</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${reportType === 'monthly' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`} onClick={() => setReportType('monthly')}>
          <h4 className="font-semibold dark:text-gray-100">Monthly Report</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detailed monthly summary</p>
        </div>
        {isAdmin && (
          <div className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${reportType === 'payroll' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`} onClick={() => setReportType('payroll')}>
            <h4 className="font-semibold dark:text-gray-100">Payroll Register</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monthly payroll printout</p>
          </div>
        )}
        <div className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${reportType === 'labour' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`} onClick={() => setReportType('labour')}>
          <h4 className="font-semibold dark:text-gray-100">Labour Report</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">Individual labour details</p>
        </div>
        <div className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${reportType === 'summary' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`} onClick={() => setReportType('summary')}>
          <h4 className="font-semibold dark:text-gray-100">Summary Report</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">Organization overview</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        {(reportType === 'monthly' || reportType === 'payroll') && (
          <div className="flex gap-4 items-end">
            <div>
              <label className="label">Year</label>
              <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="input w-32" />
            </div>
            <div>
              <label className="label">Month</label>
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="input w-40">
                {[...Array(12)].map((_, i) => (
                  <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <button onClick={openReport} disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
              Generate Report
            </button>
          </div>
        )}
        {reportType === 'labour' && (
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="label">Select Labour</label>
              <select value={labourId} onChange={(e) => setLabourId(e.target.value)} className="input">
                <option value="">Select Labour</option>
                {labours.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <button onClick={openReport} disabled={loading || !labourId} className="btn-primary flex items-center gap-2">
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
              Generate Report
            </button>
          </div>
        )}
        {reportType === 'summary' && (
          <button onClick={openReport} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <RefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
            Generate Summary Report
          </button>
        )}
      </div>
    </div>
  );
};

// Audit Tab
const AuditTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await auditAPI.getRecent(100);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto" /></div>;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Audit Logs</h3>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white dark:bg-gray-800"><tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <th className="text-left py-3 px-4">Timestamp</th>
            <th className="text-left py-3 px-4">User</th>
            <th className="text-left py-3 px-4">Action</th>
            <th className="text-left py-3 px-4">Entity</th>
            <th className="text-left py-3 px-4">Details</th>
          </tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b dark:border-gray-700 text-sm">
                <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="py-2 px-4">{log.user}</td>
                <td className="py-2 px-4"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{log.action}</span></td>
                <td className="py-2 px-4">{log.entity_type}</td>
                <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{log.new_value || log.entity_id || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-center py-8 text-gray-500 dark:text-gray-400">No audit logs</p>}
      </div>
    </div>
  );
};

// Backup Tab
const BackupTab = ({ setError, setSuccess }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchBackups(); }, []);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await backupAPI.getAll();
      setBackups(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      await backupAPI.create();
      setSuccess('Backup created successfully');
      fetchBackups();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (id, filename) => {
    try {
      const res = await backupAPI.download(id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download backup');
    }
  };

  const handleRestore = async (id) => {
    if (!window.confirm('Are you sure you want to restore this backup? Current data will be overwritten.')) return;
    try {
      await backupAPI.restore(id);
      setSuccess('Backup restored successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to restore backup');
    }
  };

  if (loading) return <div className="text-center py-8"><RefreshCw className="animate-spin mx-auto" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Data Backups</h3>
        <button onClick={handleCreate} disabled={creating} className="btn-primary flex items-center gap-2">
          {creating ? <RefreshCw className="animate-spin" size={18} /> : <Database size={18} />}
          Create Backup
        </button>
      </div>

      <div className="space-y-3">
        {backups.map((backup) => (
          <div key={backup.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium dark:text-gray-100">{backup.filename}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(backup.timestamp).toLocaleString()} • {(backup.size_bytes / 1024).toFixed(1)} KB • by {backup.created_by}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleDownload(backup.id, backup.filename)} className="btn-secondary flex items-center gap-1 text-sm py-1 px-3">
                <Download size={16} /> Download
              </button>
              <button onClick={() => handleRestore(backup.id)} className="btn-secondary flex items-center gap-1 text-sm py-1 px-3 text-orange-600 hover:bg-orange-50">
                <RefreshCw size={16} /> Restore
              </button>
            </div>
          </div>
        ))}
        {backups.length === 0 && <p className="text-center py-8 text-gray-500 dark:text-gray-400">No backups yet</p>}
      </div>
    </div>
  );
};

export default More;
