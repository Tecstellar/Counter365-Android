import * as Print from 'expo-print';
import { Bill } from '../types/models';
import { formatRupee } from '../lib/money';

export const printerService = {
  generateThermalHtml(bill: Bill, shopName: string, shopAddress: string, shopPhone: string): string {
    const lines = bill.items.map(i => `
      <div style="display:flex; justify-content:space-between; padding:2px 0;">
        <span style="flex:1;">${i.itemName}</span>
        <span style="width:30px; text-align:right;">x${i.quantity}</span>
        <span style="width:60px; text-align:right;">${formatRupee(i.lineTotal)}</span>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 58mm;
              margin: 0 auto;
              padding: 6px;
              color: #000;
              font-size: 11px;
              line-height: 1.35;
            }
            .center { text-align: center; }
            .dashed { border-top: 1px dashed #000; margin: 5px 0; }
            .solid { border-top: 1px solid #000; margin: 5px 0; }
            .flex { display: flex; justify-content: space-between; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 15px;">${shopName}</div>
          <div class="center" style="font-size: 10px;">${shopAddress}</div>
          <div class="center" style="font-size: 10px;">Ph +91 ${shopPhone}</div>
          <div class="dashed"></div>
          <div class="flex">
            <span class="bold">Bill ${bill.billNumber}</span>
            <span>${new Date(bill.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="flex" style="font-size: 10px;">
            <span>${bill.tableNumber ? 'Table: ' + bill.tableNumber : 'Takeaway / Counter'}</span>
            <span>${new Date(bill.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <div class="dashed"></div>
          ${lines}
          <div class="dashed"></div>
          <div class="flex">
            <span>Subtotal</span>
            <span>${formatRupee(bill.subtotal)}</span>
          </div>
          ${bill.gstAmount > 0 ? `
          <div class="flex">
            <span>GST 5%</span>
            <span>${formatRupee(bill.gstAmount)}</span>
          </div>` : ''}
          <div class="solid"></div>
          <div class="flex bold" style="font-size: 14px;">
            <span>TOTAL</span>
            <span>${formatRupee(bill.totalAmount)}</span>
          </div>
          <div class="flex" style="font-size: 10px; margin-top: 4px;">
            <span>Payment Mode</span>
            <span class="bold">${bill.paymentMode}</span>
          </div>
          ${bill.paymentMode === 'Partial Pay' ? `
          <div class="flex" style="font-size: 10px;">
            <span>Paid Amount</span>
            <span>${formatRupee(bill.paidAmount)}</span>
          </div>
          <div class="flex bold" style="font-size: 10px; color: #b91c1c;">
            <span>Balance Due</span>
            <span>${formatRupee(bill.pendingAmount)}</span>
          </div>
          <div style="border:1px solid #000; padding:3px; margin-top:4px; font-size:10px;">
            CUSTOMER: ${bill.customerName || 'Customer'}${bill.customerPhone ? ' (' + bill.customerPhone + ')' : ''}
          </div>` : ''}
          ${bill.paymentMode === 'Cash + GPay' ? `
          <div class="flex" style="font-size: 10px;">
            <span>Cash</span>
            <span>${formatRupee(bill.cashAmount || 0)}</span>
          </div>
          <div class="flex" style="font-size: 10px;">
            <span>GPay / UPI</span>
            <span>${formatRupee(bill.gpayAmount || 0)}</span>
          </div>` : ''}
          ${bill.paymentMode === 'Pending' ? `
          <div style="border:1px solid #000; padding:3px; margin-top:4px; font-size:10px;">
            PENDING — ${bill.customerName || 'Not tracked'}${bill.customerPhone ? ' (' + bill.customerPhone + ')' : ''}
          </div>` : ''}
          ${(bill.customerName || bill.customerPhone) && bill.paymentMode !== 'Pending' && bill.paymentMode !== 'Partial Pay' ? `
          <div style="border:1px dashed #000; padding:3px; margin-top:4px; font-size:10px;">
            CUSTOMER: ${bill.customerName || ''}${bill.customerPhone ? ' (' + bill.customerPhone + ')' : ''}
          </div>` : ''}
          <div class="dashed"></div>
          <div class="center" style="font-size: 9px; margin-top: 6px;">
            Thank you — visit again<br/>Billed on COUNTER365
          </div>
        </body>
      </html>
    `;
  },

  async printReceipt(bill: Bill, shopName: string, shopAddress: string, shopPhone: string): Promise<boolean> {
    try {
      const html = this.generateThermalHtml(bill, shopName, shopAddress, shopPhone);
      await Print.printAsync({ html });
      return true;
    } catch (err) {
      console.warn('Thermal print exception:', err);
      return false;
    }
  }
};
