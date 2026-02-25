import { useState, useEffect } from 'react';
import { attendanceAPI, laboursAPI } from '../api';
import {
  Calendar,
  Check,
  X,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Save
} from 'lucide-react';

const Attendance = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [labours, setLabours] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [laboursRes, attendanceRes] = await Promise.all([
        laboursAPI.getAll(),
        attendanceAPI.getByDate(selectedDate)
      ]);

      setLabours([...laboursRes.data].sort((a, b) => a.name.localeCompare(b.name)));

      const attendanceMap = {};
      attendanceRes.data.forEach((record) => {
        attendanceMap[record.labour_id] = record.status;
      });
      setAttendance(attendanceMap);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (labourId, status) => {
    setAttendance((prev) => ({
      ...prev,
      [labourId]: prev[labourId] === status ? undefined : status
    }));
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError('');

      const records = Object.entries(attendance)
        .filter(([_, status]) => status)
        .map(([labour_id, status]) => ({ labour_id, status }));

      if (records.length === 0) {
        setError('No attendance marked');
        return;
      }

      await attendanceAPI.markBulk({
        date: selectedDate,
        records
      });

      setSuccess('Attendance saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const markAllPresent = () => {
    const newAttendance = {};
    labours.forEach((labour) => {
      newAttendance[labour.id] = 'present';
    });
    setAttendance(newAttendance);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-500 text-white';
      case 'absent':
        return 'bg-red-500 text-white';
      case 'half_day':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  };

  const stats = {
    total: labours.length,
    present: Object.values(attendance).filter((s) => s === 'present').length,
    absent: Object.values(attendance).filter((s) => s === 'absent').length,
    halfDay: Object.values(attendance).filter((s) => s === 'half_day').length,
    notMarked: labours.length - Object.values(attendance).filter((s) => s).length
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

      {/* Date Selector */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="text-primary-600" size={24} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input w-auto"
              />
            </div>
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={markAllPresent} className="btn-secondary">
              Mark All Present
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              Save Attendance
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-sm text-gray-500">Total</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.present}</p>
          <p className="text-sm text-green-600">Present</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
          <p className="text-sm text-red-600">Absent</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.halfDay}</p>
          <p className="text-sm text-yellow-600">Half Day</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border text-center">
          <p className="text-2xl font-bold text-gray-600">{stats.notMarked}</p>
          <p className="text-sm text-gray-500">Not Marked</p>
        </div>
      </div>

      {/* Attendance List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Daily Wage</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {labours.map((labour) => (
                <tr key={labour.id} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-800">{labour.name}</p>
                      {labour.phone && (
                        <p className="text-sm text-gray-500">{labour.phone}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-600">₹{labour.daily_wage}</td>
                  <td className="py-4 px-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleStatusChange(labour.id, 'present')}
                        className={`p-2 rounded-lg transition-colors ${
                          attendance[labour.id] === 'present'
                            ? getStatusColor('present')
                            : 'bg-gray-100 hover:bg-green-100 text-gray-600'
                        }`}
                        title="Present"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={() => handleStatusChange(labour.id, 'half_day')}
                        className={`p-2 rounded-lg transition-colors ${
                          attendance[labour.id] === 'half_day'
                            ? getStatusColor('half_day')
                            : 'bg-gray-100 hover:bg-yellow-100 text-gray-600'
                        }`}
                        title="Half Day"
                      >
                        <Clock size={20} />
                      </button>
                      <button
                        onClick={() => handleStatusChange(labour.id, 'absent')}
                        className={`p-2 rounded-lg transition-colors ${
                          attendance[labour.id] === 'absent'
                            ? getStatusColor('absent')
                            : 'bg-gray-100 hover:bg-red-100 text-gray-600'
                        }`}
                        title="Absent"
                      >
                        <X size={20} />
                      </button>
                    </div>
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
    </div>
  );
};

export default Attendance;
