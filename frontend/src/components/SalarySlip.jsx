import { useRef, useState } from 'react';
import { X, Printer, Share2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const SalarySlip = ({ slip, onClose }) => {
  const printRef = useRef(null);
  const isMulti = slip.mode === 'all_pending';
  const [sharing, setSharing] = useState(false);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=700,height=700');
    win.document.write(`
      <html><head><title>Salary Slip</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h2 { margin: 0 0 4px; }
        .sub { color: #555; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 6px 4px; border-bottom: 2px solid #333; font-size: 12px; text-align: left; }
        th:last-child, td:last-child { text-align: right; }
        th:nth-child(2), td:nth-child(2) { text-align: center; }
        th:nth-child(3), td:nth-child(3) { text-align: right; }
        th:nth-child(4), td:nth-child(4) { text-align: right; }
        td { padding: 6px 4px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        td.right { text-align: right; font-weight: 600; }
        .total td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; font-size: 15px; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; }
        .footer { margin-top: 40px; font-size: 12px; color: #9ca3af; text-align: center; }
        .desg { color: #6b7280; font-size: 12px; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleShare = async () => {
    if (!printRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const fileName = `salary-slip-${slip.labour_name.replace(/\s+/g, '-')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Salary Slip - ${slip.labour_name}`,
          files: [file],
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">
            {isMulti ? 'All Pending Salary Slip' : 'Salary Slip'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
              title="Share as image"
            >
              {sharing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Share2 size={16} />
              )}
              Share
            </button>
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
        <div ref={printRef} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <h2 className="text-xl font-bold text-gray-900">AttendanceMS</h2>
            <p className="text-sm text-gray-500">Labour Salary Slip</p>
          </div>

          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-semibold text-gray-900">{slip.labour_name}</p>
              {slip.designation && <p className="text-xs text-gray-400">{slip.designation}</p>}
            </div>
            <div className="text-right">
              <p className="text-gray-500">{isMulti ? 'Period' : 'Period'}</p>
              <p className="font-semibold text-gray-900">
                {isMulti
                  ? `${fmtDate(slip.weeks[0]?.week_start)} – ${fmtDate(slip.weeks[slip.weeks.length - 1]?.week_end)}`
                  : `${fmtDate(slip.week_start)} – ${fmtDate(slip.week_end)}`
                }
              </p>
            </div>
          </div>

          {isMulti ? (
            <>
              {/* Weekly breakdown table */}
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="py-1 text-left text-gray-500 font-semibold text-xs">Week</th>
                    <th className="py-1 text-center text-gray-500 font-semibold text-xs">Days</th>
                    <th className="py-1 text-right text-gray-500 font-semibold text-xs">Earned</th>
                    <th className="py-1 text-right text-gray-500 font-semibold text-xs">Paid</th>
                    <th className="py-1 text-right text-gray-500 font-semibold text-xs">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {slip.weeks.map((w, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-700 text-xs">
                        {fmtDate(w.week_start).split(' ').slice(0,2).join(' ')} – {fmtDate(w.week_end).split(' ').slice(0,2).join(' ')}
                      </td>
                      <td className="py-1.5 text-center text-gray-700">{w.days_present}</td>
                      <td className="py-1.5 text-right text-gray-700">{fmt(w.earned)}</td>
                      <td className="py-1.5 text-right text-gray-500">{fmt(w.paid)}</td>
                      <td className="py-1.5 text-right font-medium text-orange-600">{fmt(w.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-2 text-gray-600">Daily Wage</td>
                    <td className="py-2 text-right font-medium">{fmt(slip.daily_wage)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">Total Weeks</td>
                    <td className="py-2 text-right font-medium">{slip.total_weeks}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">Total Days Present</td>
                    <td className="py-2 text-right font-medium">{slip.total_days}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-600">Total Gross</td>
                    <td className="py-2 text-right font-medium">{fmt(slip.total_gross)}</td>
                  </tr>
                  {slip.total_paid_partial > 0 && (
                    <tr>
                      <td className="py-2 text-gray-600">Already Paid (Partial)</td>
                      <td className="py-2 text-right font-medium text-green-600">− {fmt(slip.total_paid_partial)}</td>
                    </tr>
                  )}
                  {slip.advance_pending > 0 && (
                    <tr>
                      <td className="py-2 text-red-600">Advance Pending</td>
                      <td className="py-2 text-right font-medium text-red-600">− {fmt(slip.advance_pending)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-800">
                    <td className="py-3 font-bold text-gray-900 text-base">Net Payable</td>
                    <td className="py-3 text-right font-bold text-gray-900 text-base">{fmt(slip.net_payable)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : (
            <>
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
              </div>
            </>
          )}

          <p className="text-xs text-gray-400 text-right">Generated: {fmtDate(slip.generated_at)}</p>
        </div>
      </div>
    </div>
  );
};

export default SalarySlip;
