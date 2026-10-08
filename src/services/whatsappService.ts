import { Linking } from 'react-native';
import { Bill, DayClosingReport, PendingPaymentRecord } from '../types/models';
import { formatRupee } from '../lib/money';

export const whatsappService = {
  formatCustomerBill(bill: Bill, shopName: string): string {
    const lines = bill.items.map(item => `${item.itemName} x${item.quantity} = ${formatRupee(item.lineTotal)}`).join('\n');
    const timeStr = new Date(bill.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(bill.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const tableLine = bill.tableNumber ? `*Table: ${bill.tableNumber}*\n` : '';
    const customerLine = (bill.customerName || bill.customerPhone)
      ? `*Customer: ${bill.customerName || ''}${bill.customerPhone ? ' (' + bill.customerPhone + ')' : ''}*\n`
      : '';
    
    let paymentDetail = `Paid by: ${bill.paymentMode}`;
    if (bill.paymentMode === 'Partial Pay') {
      paymentDetail = `Paid: ${formatRupee(bill.paidAmount)} | *Balance Due: ${formatRupee(bill.pendingAmount)}*`;
    } else if (bill.paymentMode === 'Cash + GPay') {
      paymentDetail = `Cash: ${formatRupee(bill.cashAmount || 0)} + GPay: ${formatRupee(bill.gpayAmount || 0)}`;
    }

    let fallbackQuery = '';
    try {
      const compactPayload = {
        s: shopName,
        n: bill.billNumber,
        t: bill.totalAmount,
        p: bill.paidAmount,
        due: bill.pendingAmount,
        m: bill.paymentMode,
        d: dateStr,
        tm: timeStr,
        c: bill.customerName,
        cp: bill.customerPhone,
        tb: bill.tableNumber,
        sub: bill.subtotal,
        gst: bill.gstAmount,
        gr: bill.gstRate,
        i: (bill.items || []).map(it => [it.itemName, it.quantity, it.unitPrice, it.lineTotal]),
      };
      const jsonStr = JSON.stringify(compactPayload);
      if (typeof btoa !== 'undefined') {
        fallbackQuery = `?d=${encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))))}`;
      }
    } catch {}

    const rawBillId = bill.id || (bill.billNumber ? bill.billNumber.replace(/[^a-zA-Z0-9_-]/g, '') : 'latest');
    const pdfUrl = `https://counter365.tecstellar.com/b/${rawBillId}`;

    return `*${shopName}*\nBill ${bill.billNumber} — ${dateStr}, ${timeStr}\n${tableLine}${customerLine}--------------------------------\n${lines}\n--------------------------------\n*TOTAL: ${formatRupee(bill.totalAmount)}*\n${paymentDetail}\n\n📄 *View or download a PDF copy:*\n${pdfUrl}\n\n_Billed on Counter365 · PDF copy available_`;
  },

  formatPendingReminder(record: PendingPaymentRecord, shopName: string): string {
    const billsList = record.bills.map(b => `${b.billNumber} (${b.date}): ${formatRupee(b.amount)}`).join('\n');
    return `*${shopName}*\nPending payment reminder as on today:\n--------------------------------\n${billsList}\n--------------------------------\n*TOTAL PENDING: ${formatRupee(record.amountDue)}*\n\nPlease settle at the shop counter at your convenience. Thank you!`;
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
