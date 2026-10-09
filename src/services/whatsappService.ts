import { Linking } from 'react-native';
import { Bill, DayClosingReport, PendingPaymentRecord } from '../types/models';
import { formatRupee } from '../lib/money';

function encodeFallbackBill(bill: Bill, shopName: string, dateStr: string, timeStr: string): string {
  try {
    const payload = {
      n: bill.billNumber,
      d: dateStr,
      tm: timeStr,
      s: shopName,
      c: bill.customerName || '',
      cp: bill.customerPhone || '',
      tb: bill.tableNumber || '',
      m: bill.paymentMode,
      sub: bill.subtotal || bill.totalAmount,
      gst: bill.gstAmount || 0,
      gr: bill.gstRate || 0,
      t: bill.totalAmount,
      p: bill.paidAmount ?? (bill.paymentMode === 'Pending' ? 0 : bill.totalAmount),
      due: bill.pendingAmount || 0,
      i: (bill.items || []).map(item => [
        item.itemName || (item as any).name || 'Item',
        item.quantity,
        item.unitPrice,
        item.lineTotal || (item.unitPrice * item.quantity),
      ]),
    };
    const jsonStr = JSON.stringify(payload);
    if (typeof btoa === 'function') {
      return encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
    } else if (typeof Buffer !== 'undefined') {
      return encodeURIComponent(Buffer.from(jsonStr, 'utf-8').toString('base64'));
    }
  } catch (e) {
    // Non-fatal if encoding fails
  }
  return '';
}

export const whatsappService = {
  formatCustomerBill(bill: Bill, shopName: string, shopUpiId?: string | null): string {
    const timeStr = new Date(bill.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(bill.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const tableLine = bill.tableNumber ? `*Table: ${bill.tableNumber}*\n` : '';
    const customerLine = (bill.customerName || bill.customerPhone)
      ? `*Customer: ${bill.customerName || ''}${bill.customerPhone ? ' (' + bill.customerPhone + ')' : ''}*\n`
      : '';
    
    // Items breakdown
    let itemsSummary = '';
    if (bill.items && bill.items.length > 0) {
      itemsSummary = bill.items
        .map(it => {
          const dishTitle = it.itemName || (it as any).name || 'Item';
          return `• ${dishTitle} × ${it.quantity} = ${formatRupee(it.lineTotal || it.unitPrice * it.quantity)}`;
        })
        .join('\n') + '\n--------------------------------\n';
    }

    // Subtotal and GST breakdown if applicable
    let breakdown = '';
    if (bill.gstAmount && bill.gstAmount > 0) {
      breakdown = `Subtotal: ${formatRupee(bill.subtotal || (bill.totalAmount - bill.gstAmount))}\nGST (${bill.gstRate || 5}%): ${formatRupee(bill.gstAmount)}\n`;
    }

    // Payment mode and balance status
    let paymentDetail = `*Payment Status:* ✅ PAID (${bill.paymentMode})`;
    if (bill.paymentMode === 'Partial Pay') {
      paymentDetail = `*Payment Status:* ⏳ PARTIALLY PAID\n*Paid Now:* ${formatRupee(bill.paidAmount)} | *Balance Due:* ${formatRupee(bill.pendingAmount)}`;
    } else if (bill.paymentMode === 'Pending') {
      paymentDetail = `*Payment Status:* ⚠️ PAYMENT PENDING\n*Balance Due:* ${formatRupee(bill.pendingAmount || bill.totalAmount)}`;
    } else if (bill.paymentMode === 'Cash + GPay') {
      paymentDetail = `*Payment Status:* ✅ PAID (Split)\n*Paid via:* Cash ${formatRupee(bill.cashAmount || 0)} + GPay ${formatRupee(bill.gpayAmount || 0)}`;
    }

    // Only display UPI if customer has outstanding pending amount and shop has a valid UPI ID
    let upiLine = '';
    const cleanUpi = shopUpiId?.trim();
    const hasBalanceDue = (bill.paymentMode === 'Partial Pay' || bill.paymentMode === 'Pending') && ((bill.pendingAmount || 0) > 0 || bill.paymentMode === 'Pending');
    if (hasBalanceDue && cleanUpi && cleanUpi.includes('@') && !cleanUpi.toLowerCase().includes('example') && !cleanUpi.toLowerCase().includes('placeholder')) {
      upiLine = `\n📲 *Pay Due via UPI ID:* ${cleanUpi}\n`;
    }

    const rawBillId = bill.id || (bill.billNumber ? bill.billNumber.replace(/[^a-zA-Z0-9_-]/g, '') : 'latest');
    const fallbackQuery = encodeFallbackBill(bill, shopName, dateStr, timeStr);
    const pdfUrl = fallbackQuery
      ? `https://counter365.tecstellar.com/b/${rawBillId}?d=${fallbackQuery}`
      : `https://counter365.tecstellar.com/b/${rawBillId}`;

    return `*${shopName}*\nBill ${bill.billNumber} — ${dateStr}, ${timeStr}\n${tableLine}${customerLine}--------------------------------\n${itemsSummary}${breakdown}*TOTAL AMOUNT: ${formatRupee(bill.totalAmount)}*\n${paymentDetail}${upiLine}\n--------------------------------\n📄 *Official Bill & PDF Receipt:*\n${pdfUrl}\n\nThank you for visiting! Please visit again 🙏\n_Billed via Counter365 · Official Receipt_`;
  },

  formatPendingReminder(record: PendingPaymentRecord, shopName: string, shopUpiId?: string | null): string {
    const custLine = record.customerName && record.customerName !== 'Not tracked' ? `Customer: *${record.customerName}*\n` : '';
    const billsList = record.bills.map(b => `${b.billNumber} (${b.date}): ${formatRupee(b.amount)}`).join('\n');
    const cleanUpi = shopUpiId?.trim();
    const upiLine = (cleanUpi && cleanUpi.includes('@') && !cleanUpi.toLowerCase().includes('example') && !cleanUpi.toLowerCase().includes('placeholder'))
      ? `\n📲 *Pay Due via UPI ID (GPay / PhonePe / Paytm):* ${cleanUpi}\n`
      : '';
    return `*${shopName}*\n${custLine}Pending payment reminder as on today:\n--------------------------------\n${billsList}\n--------------------------------\n*TOTAL PENDING: ${formatRupee(record.amountDue)}*${upiLine}\n\nPlease settle at the shop counter or via UPI at your convenience. Thank you!`;
  },

  formatDayReport(report: DayClosingReport): string {
    return `*${report.shopTitle} — Day Closing (${report.date})*\n--------------------------------\nTotal Sales: ${formatRupee(report.totalSales)} (${report.billsCount} bills)\nCash: ${formatRupee(report.cashSales)}\nGPay / UPI: ${formatRupee(report.gpaySales)}\nPending: ${formatRupee(report.pendingSales)}\nExpenses: -${formatRupee(report.totalExpenses)}\n--------------------------------\n*NET PROFIT: ${formatRupee(report.netProfit)}*\nHours: ${report.hoursNote}`;
  },

  async shareViaWhatsApp(text: string, phone?: string | null): Promise<boolean> {
    try {
      const rawDigits = phone ? phone.replace(/[^0-9]/g, '') : '';
      const cleanPhone = rawDigits.length >= 10
        ? (rawDigits.length === 10 ? '91' + rawDigits : rawDigits)
        : '';
      const encodedText = encodeURIComponent(text);
      const url = cleanPhone
        ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`
        : `whatsapp://send?text=${encodedText}`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        // Web WhatsApp fallback
        const webUrl = cleanPhone
          ? `https://wa.me/${cleanPhone}?text=${encodedText}`
          : `https://api.whatsapp.com/send?text=${encodedText}`;
        await Linking.openURL(webUrl);
        return true;
      }
    } catch (err) {
      console.warn('WhatsApp share notice:', err);
      return false;
    }
  }
};
