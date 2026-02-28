import { useState, useEffect, useCallback, useRef } from 'react';
import { attendanceAPI, laboursAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Check,
  X,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Save,
  ChevronDown,
  ChevronUp,
  CalendarCheck
} from 'lucide-react';

const STATUS_META = {
  present:  { label: 'P', color: 'bg-green-500 text-white',  light: 'bg-green-100 text-green-800 border-green-300' },
  half_day: { label: 'H', color: 'bg-yellow-400 text-white', light: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  absent:   { label: 'A', color: 'bg-red-500 text-white',    light: 'bg-red-100 text-red-800 border-red-300' },
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function toYMD(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const MonthlyLabourCard = ({ labour, year, month }) => {
  const [monthAttendance, setMonthAttendance] = useState({});
  const [expanded, setExpanded] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [filling, setFilling] = useState(false);
  const [fillStatus, setFillStatus] = useState('present');
  const [fillResult, setFillResult] = useState(null);

  const daysInMonth = getDaysInMonth(year, month);
  const today = new Date().toISOString().split('T')[0];

  const handleFillMonth = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Fill all working days of this month as "${fillStatus}" for ${labour.name}? Sundays will be skipped. Already-marked days will NOT be overwritten.`)) return;
    setFilling(true);
    setFillResult(null);
    try {
      const res = await attendanceAPI.fillMonth(labour.id, year, month + 1, fillStatus, false);
      setFillResult(`✓ Filled ${res.data.filled_count} days as ${fillStatus}`);
      if (expanded) fetchMonthData();
    } catch (err) {
      setFillResult('✗ ' + (err.response?.data?.detail || 'Failed to fill month'));
    } finally {
      setFilling(false);
      setTimeout(() => setFillResult(null), 4000);
    }
  };

  const fetchMonthData = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const start = toYMD(year, month, 1);
      const end   = toYMD(year, month, daysInMonth);
      const res   = await attendanceAPI.getByLabour(labour.id, start, end);
      const map   = {};
      res.data.forEach((r) => { map[r.date] = r.status; });
      setMonthAttendance(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMonth(false);
    }
  }, [labour.id, year, month, daysInMonth]);

  useEffect(() => {
    if (expanded) fetchMonthData();
  }, [expanded, fetchMonthData]);

  const present    = Object.values(monthAttendance).filter((s) => s === 'present').length;
  const halfDay    = Object.values(monthAttendance).filter((s) => s === 'half_day').length;
  const absent     = Object.values(monthAttendance).filter((s) => s === 'absent').length;
  const daysWorked = present + halfDay * 0.5;
  const earned     = daysWorked * labour.daily_wage;

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
            {labour.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{labour.name}</p>
            <p className="text-xs text-gray-500">₹{labour.daily_wage}/day</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-2 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">P {present}</span>
            <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">H {halfDay}</span>
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">A {absent}</span>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <select
              value={fillStatus}
              onChange={(e) => setFillStatus(e.target.value)}
              className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
            >
              <option value="present">Present</option>
              <option value="half_day">Half Day</option>
              <option value="absent">Absent</option>
            </select>
            <button
              onClick={handleFillMonth}
              disabled={filling}
              title="Fill whole month"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium disabled:opacity-50"
            >
              {filling ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" /> : <CalendarCheck size={12} />}
              Fill
            </button>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-800">₹{earned.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{daysWorked} days</p>
          </div>
          {expanded
            ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" />
            : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
        </div>
      </div>

      {fillResult && (
        <div className={`px-4 py-2 text-xs font-medium ${fillResult.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {fillResult}
        </div>
      )}

      {expanded && (
        <div className="border-t bg-gray-50 p-4">
          {loadingMonth ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const firstDow = new Date(year, month, 1).getDay();
                  const cells = [];
                  for (let i = 0; i < firstDow; i++) cells.push(<div key={`pad-${i}`} />);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const ymd      = toYMD(year, month, d);
                    const status   = monthAttendance[ymd];
                    const isFuture = ymd > today;
                    const meta     = STATUS_META[status];
                    cells.push(
                      <div
                        key={d}
                        className={`rounded border text-center py-1 select-none ${
                          isFuture
                            ? 'bg-white border-gray-100 text-gray-200'
                            : meta
                              ? `${meta.light} border`
                              : 'bg-white border-gray-200 text-gray-400'
                        }`}
                      >
                        <div className="text-[9px] text-gray-400">{d}</div>
                        <div className="text-xs font-bold leading-tight">{meta ? meta.label : '–'}</div>
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> Half Day</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Absent</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-gray-300 bg-white inline-block" /> Unmarked</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Attendance = () => {
  const { isAdmin, isManager, isLabour } = useAuth();
  const canEditAttendance = isAdmin || isManager;
  const canViewMonthly = isAdmin || isManager;
  
  const [view, setView] = useState('daily');

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [labours, setLabours] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  useEffect(() => {
    if (view === 'daily') fetchDailyData();
    else fetchLaboursOnly();
  }, [selectedDate, view]);

  const fetchLaboursOnly = async () => {
    try {
      setLoading(true);
      const res = await laboursAPI.getAll();
      setLabours([...res.data].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError('Failed to load labours');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [laboursRes, attendanceRes] = await Promise.all([
        laboursAPI.getAll(),
        attendanceAPI.getByDate(selectedDate)
      ]);
      setLabours([...laboursRes.data].sort((a, b) => a.name.localeCompare(b.name)));
      const statusMap = {};
      const commentMap = {};
      attendanceRes.data.forEach((r) => {
        statusMap[r.labour_id] = r.status;
        if (r.comment) commentMap[r.labour_id] = r.comment;
      });
      setAttendance(statusMap);
      setComments(commentMap);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePullToRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    if (view === 'daily') fetchDailyData(true);
    else fetchLaboursOnly();
  };

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    if (containerRef.current?.scrollTop > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 80) handlePullToRefresh();
  };

  const handleStatusChange = (labourId, status) => {
    setAttendance((prev) => ({
      ...prev,
      [labourId]: prev[labourId] === status ? undefined : status
    }));
  };

  const handleCommentChange = (labourId, comment) => {
    setComments((prev) => ({ ...prev, [labourId]: comment }));
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError('');
      const records = Object.entries(attendance)
        .filter(([_, s]) => s)
        .map(([labour_id, status]) => ({ labour_id, status, comment: comments[labour_id] || null }));
      if (records.length === 0) { setError('No attendance marked'); return; }
      await attendanceAPI.markBulk({ date: selectedDate, records });
      setSuccess('Attendance saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const markAllPresent = () => {
    const map = {};
    labours.forEach((l) => { map[l.id] = 'present'; });
    setAttendance(map);
  };

  const getSelectedDayName = () => {
    const d = new Date(selectedDate);
    return DAY_NAMES[d.getDay()];
  };

  const changeMonth = (delta) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const getStatusColor = (status) => STATUS_META[status]?.color || 'bg-gray-200 text-gray-600';

  const dailyStats = {
    total:     labours.length,
    present:   Object.values(attendance).filter((s) => s === 'present').length,
    absent:    Object.values(attendance).filter((s) => s === 'absent').length,
    halfDay:   Object.values(attendance).filter((s) => s === 'half_day').length,
    notMarked: labours.length - Object.values(attendance).filter(Boolean).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {refreshing && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} /><span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X size={20} /></button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
          <Check size={20} /><span>{success}</span>
        </div>
      )}

      {/* Top bar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Only show view toggle if user can view monthly */}
          {canViewMonthly ? (
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => setView('daily')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'daily' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setView('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'monthly' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Monthly
              </button>
            </div>
          ) : (
            <h3 className="text-lg font-semibold text-gray-800">Daily Attendance</h3>
          )}

          {view === 'daily' && (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft size={22} />
                </button>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-primary-600" size={20} />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="input w-auto"
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">{getSelectedDayName()}</span>
                </div>
                <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronRight size={22} />
                </button>
              </div>
              {canEditAttendance && (
                <div className="flex gap-2">
                  <button onClick={markAllPresent} className="btn-secondary">Mark All Present</button>
                  <button onClick={handleSaveAll} disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Save size={18} />}
                    Save
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'monthly' && (
            <div className="flex items-center gap-3">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={22} />
              </button>
              <span className="font-semibold text-gray-800 min-w-[150px] text-center text-lg">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight size={22} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DAILY VIEW */}
      {view === 'daily' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total',      value: dailyStats.total,      bg: 'bg-white border',                       tc: 'text-gray-800',   sc: 'text-gray-500' },
              { label: 'Present',    value: dailyStats.present,    bg: 'bg-green-50 border border-green-200',   tc: 'text-green-600',  sc: 'text-green-600' },
              { label: 'Absent',     value: dailyStats.absent,     bg: 'bg-red-50 border border-red-200',       tc: 'text-red-600',    sc: 'text-red-600' },
              { label: 'Half Day',   value: dailyStats.halfDay,    bg: 'bg-yellow-50 border border-yellow-200', tc: 'text-yellow-600', sc: 'text-yellow-600' },
              { label: 'Not Marked', value: dailyStats.notMarked,  bg: 'bg-gray-50 border',                     tc: 'text-gray-600',   sc: 'text-gray-500' },
            ].map(({ label, value, bg, tc, sc }) => (
              <div key={label} className={`p-4 rounded-lg text-center ${bg}`}>
                <p className={`text-2xl font-bold ${tc}`}>{value}</p>
                <p className={`text-sm ${sc}`}>{label}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {labours.map((labour) => (
                    <tr key={labour.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <p className="font-medium text-gray-800">{labour.name}</p>
                        {labour.phone && <p className="text-sm text-gray-500">{labour.phone}</p>}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-center gap-2">
                          {[
                            { status: 'present',  icon: <Check size={20} />,  hover: 'hover:bg-green-100' },
                            { status: 'half_day', icon: <Clock size={20} />,  hover: 'hover:bg-yellow-100' },
                            { status: 'absent',   icon: <X size={20} />,      hover: 'hover:bg-red-100' },
                          ].map(({ status, icon, hover }) => (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(labour.id, status)}
                              className={`p-2 rounded-lg transition-colors ${
                                attendance[labour.id] === status
                                  ? getStatusColor(status)
                                  : `bg-gray-100 ${hover} text-gray-600`
                              }`}
                              title={status}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="text"
                          placeholder="Add comment..."
                          value={comments[labour.id] || ''}
                          onChange={(e) => handleCommentChange(labour.id, e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {labours.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>No labours found. Add labours first.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MONTHLY VIEW */}
      {view === 'monthly' && (
        <div className="space-y-3">
          {labours.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              <Calendar size={48} className="mx-auto mb-4 opacity-50" />
              <p>No labours found.</p>
            </div>
          ) : (
            labours.map((labour) => (
              <MonthlyLabourCard
                key={`${labour.id}-${selectedYear}-${selectedMonth}`}
                labour={labour}
                year={selectedYear}
                month={selectedMonth}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Attendance;
