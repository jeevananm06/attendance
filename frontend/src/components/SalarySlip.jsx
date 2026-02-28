import { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const SalarySlip = ({ slip, onClose }) => {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=700,height=600');
    win.document.write(`
      <html><head><title>Salary Slip</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h2 { margin: 0 0 4px; }
        .sub { color: #555; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px 4px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        td:last-child { text-align: right; font-weight: 600; }
        .total td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; font-size: 16px; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px;
          background: ${slip.is_paid ? '#d1fae5' : '#fef3c7'}; color: ${slip.is_paid ? '#065f46' : '#92400e'}; }
        .footer { margin-top: 40px; font-size: 12px; color: #9ca3af; text-align: center; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Salary Slip</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
            >
              <Printer size={16} />
              Print
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div ref={printRef} className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">AttendanceMS</h2>
            <p className="text-sm text-gray-500">Labour Salary Slip</p>
          </div>

          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-semibold text-gray-900">{slip.labour_name}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Period</p>
              <p className="font-semibold text-gray-900">
                {fmtDate(slip.week_start)} – {fmtDate(slip.week_end)}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-2 text-gray-600">Daily Wage</td>
                <td className="py-2 text-right font-medium">{fmt(slip.daily_wage)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Days Present</td>
                <td className="py-2 text-right font-medium">{slip.days_present}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Gross Salary</td>
                <td className="py-2 text-right font-medium">{fmt(slip.gross_salary)}</td>
              </tr>
              {slip.advance_pending > 0 && (
                <tr>
                  <td className="py-2 text-red-600">Advance Pending</td>
                  <td className="py-2 text-right font-medium text-red-600">− {fmt(slip.advance_pending)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-800">
                <td className="py-3 font-bold text-gray-900 text-base">Net Payable</td>
                <td className="py-3 text-right font-bold text-gray-900 text-base">{fmt(slip.net_salary)}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex items-center justify-between pt-2">
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium ${
                slip.is_paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {slip.is_paid ? `Paid on ${fmtDate(slip.paid_date)}` : 'Unpaid'}
            </span>
            <p className="text-xs text-gray-400">Generated: {fmtDate(slip.generated_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalarySlip;
