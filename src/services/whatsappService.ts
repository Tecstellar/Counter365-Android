import { Linking } from 'react-native';
import { Bill, DayClosingReport, PendingPaymentRecord } from '../types/models';
import { formatRupee } from '../lib/money';

export const whatsappService = {
  /**
   * Formats a short, clean, customer-facing WhatsApp bill message.
   * Scenarios:
   * A. Fully Paid
   * B. Partially Paid
   * C. Fully Pending
   * No individual line items in text; detailed receipt accessible via short PDF link.
   */
  formatCustomerBill(
    bill: Bill,
    shopName: string,
    shopUpiId?: string | null,
    shopPhone?: string | null,
    customPdfUrl?: string | null
  ): string {
    const rawCustName = (bill.customerName || '').trim();
    const custName = (rawCustName && rawCustName !== 'Not tracked')
      ? rawCustName
      : 'Valued Customer';

    const rawBillId = bill.id || (bill.billNumber ? bill.billNumber.replace(/[^a-zA-Z0-9_-]/g, '') : 'latest');
    const defaultUrl = `https://counter365.tecstellar.com/b/${rawBillId}`;
    const pdfUrl = customPdfUrl || defaultUrl;

    const cleanUpi = shopUpiId?.trim();
    const hasValidUpi = !!(
      cleanUpi &&
      cleanUpi.includes('@') &&
      !cleanUpi.toLowerCase().includes('example') &&
      !cleanUpi.toLowerCase().includes('placeholder') &&
      !cleanUpi.toLowerCase().includes('your-upi')
    );

    const cleanPhone = shopPhone?.trim();
    const hasContact = !!cleanPhone;

    const isFullyPending =
      bill.paymentMode === 'Pending' ||
      ((bill.paidAmount === 0 || bill.paidAmount === undefined) &&
        (bill.pendingAmount || 0) > 0 &&
        bill.totalAmount > 0);

    const isPartiallyPaid =
      !isFullyPending &&
      (bill.paymentMode === 'Partial Pay' ||
        ((bill.paidAmount || 0) > 0 && (bill.pendingAmount || 0) > 0));

    // ==========================================
    // A. Fully Paid
    // ==========================================
    if (!isFullyPending && !isPartiallyPaid) {
      const paymentMethod = bill.paymentMode || 'Cash';
      let msg = `Hi ${custName} 👋\n\n`;
      msg += `Thank you for choosing *${shopName}*!\n\n`;
      msg += `💰 *Total Amount:* ${formatRupee(bill.totalAmount)}\n`;
      msg += `✅ *Payment Status:* PAID (${paymentMethod})\n\n`;
      msg += `📄 *View Receipt:*\n${pdfUrl}\n\n`;
      if (hasContact) {
        msg += `📞 *Contact:* ${cleanPhone}\n\n`;
      }
      msg += `Thank you for your business!`;
      return msg;
    }

    // ==========================================
    // B. Partially Paid
    // ==========================================
    if (isPartiallyPaid) {
      const paid = bill.paidAmount || 0;
      const balance = bill.pendingAmount || Math.max(0, bill.totalAmount - paid);
      let msg = `Hi ${custName} 👋\n\n`;
      msg += `Thank you for choosing *${shopName}*!\n\n`;
      msg += `💰 *Total Amount:* ${formatRupee(bill.totalAmount)}\n`;
      msg += `💵 *Total Paid:* ${formatRupee(paid)}\n`;
      msg += `🔴 *Balance Due:* ${formatRupee(balance)}\n`;
      msg += `⚠️ *Payment Status:* PARTIALLY PAID\n\n`;
      msg += `📄 *View Receipt:*\n${pdfUrl}\n\n`;

      let hasTrailingBlock = false;
      if (hasValidUpi) {
        msg += `💳 *UPI ID:* ${cleanUpi}\n`;
        hasTrailingBlock = true;
      }
      if (hasContact) {
        msg += `📞 *Contact:* ${cleanPhone}\n`;
        hasTrailingBlock = true;
      }
      if (hasTrailingBlock) {
        msg += `\n`;
      }
      msg += `Thank you for your business!`;
      return msg;
    }

    // ==========================================
    // C. Fully Pending
    // ==========================================
    const pendingBalance = bill.pendingAmount || bill.totalAmount;
    let msg = `Hi ${custName} 👋\n\n`;
    msg += `Thank you for choosing *${shopName}*!\n\n`;
    msg += `💰 *Total Amount:* ${formatRupee(bill.totalAmount)}\n`;
    msg += `💵 *Total Paid:* ₹0.00\n`;
    msg += `🔴 *Balance Due:* ${formatRupee(pendingBalance)}\n`;
    msg += `⚠️ *Payment Status:* PENDING\n\n`;
    msg += `📄 *View Receipt:*\n${pdfUrl}\n\n`;

    let hasTrailingBlock = false;
    if (hasValidUpi) {
      msg += `💳 *UPI ID:* ${cleanUpi}\n`;
      hasTrailingBlock = true;
    }
    if (hasContact) {
      msg += `📞 *Contact:* ${cleanPhone}\n`;
      hasTrailingBlock = true;
    }
    if (hasTrailingBlock) {
      msg += `\n`;
    }
    msg += `Thank you for your business!`;
    return msg;
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

      // Fast direct open attempt for native WhatsApp
      try {
        await Linking.openURL(url);
        return true;
      } catch {
        // Fallback to web WhatsApp link if direct scheme was rejected
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
