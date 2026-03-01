import { useState } from 'react';
import { exportAPI } from '../api';
import {
  Download,
  FileSpreadsheet,
  Users,
  Calendar,
  Wallet,
  AlertCircle,
  Check
} from 'lucide-react';

const Export = () => {
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleExport = async (type) => {
    try {
      setLoading((prev) => ({ ...prev, [type]: true }));
      setError('');

      let response;
      let filename;

      switch (type) {
        case 'labours':
          response = await exportAPI.labours();
          filename = `labours_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'attendance':
          response = await exportAPI.attendance();
          filename = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'salary':
          response = await exportAPI.salary();
          filename = `salary_${new Date().toISOString().split('T')[0]}.csv`;
          break;
        default:
          return;
      }

      downloadFile(response.data, filename);
      setSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to export ${type} data`);
      console.error(err);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const exportOptions = [
    {
      id: 'labours',
      title: 'Labours Data',
      description: 'Export all labour information including name, phone, daily wage, and status',
      icon: Users,
      color: 'blue'
    },
    {
      id: 'attendance',
      title: 'Attendance Records',
      description: 'Export complete attendance history with dates and status',
      icon: Calendar,
      color: 'green'
    },
    {
      id: 'salary',
      title: 'Salary Records',
      description: 'Export salary calculations, payments, and pending amounts',
      icon: Wallet,
      color: 'purple'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      green: 'bg-green-50 border-green-200 hover:bg-green-100',
      purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
    };
    return colors[color] || colors.blue;
  };

  const getIconColorClass = (color) => {
    const colors = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      purple: 'text-purple-600'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
          <Check size={20} />
          <span>{success}</span>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <FileSpreadsheet className="text-primary-600" size={28} />
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Export Data</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Download your data as CSV files</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className={`p-6 rounded-xl border-2 transition-colors ${getColorClasses(
                  option.color
                )}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-lg bg-white dark:bg-gray-700 shadow-sm`}>
                    <Icon size={24} className={getIconColorClass(option.color)} />
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">{option.title}</h3>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{option.description}</p>

                <button
                  onClick={() => handleExport(option.id)}
                  disabled={loading[option.id]}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  {loading[option.id] ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download size={18} />
                      Export CSV
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Export Information</h3>
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-medium">1</span>
            </div>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">CSV Format</p>
              <p>All exports are in CSV (Comma Separated Values) format, compatible with Excel, Google Sheets, and other spreadsheet applications.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-medium">2</span>
            </div>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">Complete Data</p>
              <p>Each export includes all records in the system. Use spreadsheet filters to narrow down the data as needed.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-medium">3</span>
            </div>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">Date in Filename</p>
              <p>Each exported file includes today's date in the filename for easy organization and tracking.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Export;
