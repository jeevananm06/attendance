import html2canvas from 'html2canvas';

/**
 * Build bill HTML string (for print window & off-screen capture)
 */
export function buildBillHTML(bill, logoBase64) {
  const status = bill.status || 'consolidated';
  const statusBg = status === 'finalized' ? '#DEF7EC' : status === 'paid' ? '#DBEAFE' : status === 'consolidated' ? '#E0E7FF' : '#FEF3C7';
  const statusColor = status === 'finalized' ? '#03543F' : status === 'paid' ? '#1E40AF' : status === 'consolidated' ? '#3730A3' : '#92400E';
  const rows = (bill.line_items || []).map(li =>
    `<tr>
      <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee">${li.item_name}</td>
      <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">${li.quantity}</td>
      <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">₹${li.rate.toFixed(2)}</td>
      <td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;text-align:right">₹${li.amount.toFixed(2)}</td>
    </tr>`
  ).join('');

  return `<div style="background:#fff;padding:20px;max-width:420px;margin:0 auto;font-family:'Segoe UI',sans-serif;color:#333">
  <div style="text-align:center;border-bottom:2px dashed #8B4513;padding-bottom:12px;margin-bottom:12px">
    ${logoBase64 ? `<img src="${logoBase64}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 8px" />` : ''}
    <div style="font-size:20px;font-weight:700;color:#5D3A1A">Selvam Tea Stall</div>
    <div style="font-size:11px;color:#8B6914;letter-spacing:1.5px">TEA • COFFEE • SNACKS</div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px">
    <div style="line-height:1.6">
      <div><span style="color:#888">Bill No:</span> <strong>${bill.bill_number}</strong></div>
      <div><span style="color:#888">Date:</span> ${bill.bill_date}</div>
      <div><span style="color:#888">Status:</span> <span style="background:${statusBg};color:${statusColor};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600;line-height:1;white-space:nowrap">${status.toUpperCase()}</span></div>
    </div>
    <div style="line-height:1.6;text-align:right">
      <div><strong>${bill.customer_name}</strong></div>
      ${bill.customer_phone ? `<div>${bill.customer_phone}</div>` : ''}
      ${bill.customer_place ? `<div>${bill.customer_place}</div>` : ''}
    </div>
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
</div>`;
}

/**
 * Convert logo URL to base64 for embedding
 */
export async function fetchLogoBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Print bill in a new window with logo embedded as base64
 */
export function printBill(bill, logoBase64) {
  const html = buildBillHTML(bill, logoBase64);
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Bill - ${bill.bill_number}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{padding:0;margin:0}@media print{body{padding:0}}</style>
  </head><body>${html}
  <script>window.onload=function(){window.print();window.close();};</script>
  </body></html>`);
  win.document.close();
}

/**
 * Share bill as image via WhatsApp (uses temp off-screen div + html2canvas)
 */
export async function shareBillAsImage(bill, logoBase64) {
  // Create a temp off-screen container
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:420px;';
  container.innerHTML = buildBillHTML(bill, logoBase64);
  document.body.appendChild(container);

  // Wait a tick for images to render
  await new Promise(r => setTimeout(r, 100));

  try {
    const canvas = await html2canvas(container, { useCORS: true, scale: 2, backgroundColor: '#ffffff' });
    document.body.removeChild(container);

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `bill-${bill.bill_number}.png`, { type: 'image/png' });

        // Try native Web Share API (works on mobile)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: `Bill ${bill.bill_number}` });
            resolve(true);
            return;
          } catch { /* fall through */ }
        }

        // Fallback: download image then open WhatsApp
        const imgUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = imgUrl;
        a.download = `bill-${bill.bill_number}.png`;
        a.click();

        let phone = bill.customer_phone?.replace(/[\s\-()]/g, '') || '';
        // Ensure proper format: strip leading 0, add 91 if no country code
        if (phone && !phone.startsWith('+') && !phone.startsWith('91')) {
          phone = phone.replace(/^0+/, '');
          phone = '91' + phone;
        } else if (phone.startsWith('+')) {
          phone = phone.slice(1);
        }
        const waUrl = phone
          ? `https://wa.me/${phone}?text=${encodeURIComponent(`Bill ${bill.bill_number} - ₹${bill.total_amount.toFixed(2)}\n(Please find the bill image downloaded to your device)`)}`
          : `https://wa.me/`;
        setTimeout(() => window.open(waUrl, '_blank'), 500);
        resolve(true);
      }, 'image/png');
    });
  } catch {
    document.body.removeChild(container);
    return false;
  }
}
