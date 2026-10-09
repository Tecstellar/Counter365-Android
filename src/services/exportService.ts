import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MonthlyReportData, DayClosingReport, Shop, Bill } from '../types/models';
import { formatRupee } from '../lib/money';
import { whatsappService } from './whatsappService';
import { supabase } from '../lib/supabase';
import { generateUUID } from '../lib/uuid';

export const exportService = {
  /**
   * 1. Generates and shares a professional PDF Monthly Report
   */
  async exportMonthlyReportPdf(report: MonthlyReportData, shop: Shop): Promise<{ success: boolean; uri?: string; error?: string }> {
    let html = '';
    try {
      const dayRowsHtml = report.days.map(d => `
        <tr style="${d.isWeekend ? 'background-color: #f0f7f4;' : ''}">
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${d.dateFormatted} (${d.dayOfWeek})</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatRupee(d.sales)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">${formatRupee(d.expenses)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700; color: #101318;">${formatRupee(d.profit)}</td>
        </tr>
      `).join('');

      const topItemsHtml = report.topItems.map(it => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">${it.rank}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${it.name}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${it.quantity} pcs</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatRupee(it.amount)}</td>
        </tr>
      `).join('');

      const paymentModesHtml = report.paymentModes.map(pm => `
        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
          <span>${pm.name} (${pm.pct})</span>
          <span style="font-weight: 600;">${formatRupee(pm.amount)}</span>
        </div>
      `).join('');

      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Jost:wght@500;600;700;800&family=Lexend:wght@300..800&family=Noto+Sans+Tamil:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Lexend', 'Noto Sans Tamil', system-ui, sans-serif;
              color: #111827;
              padding: 24px;
              margin: 0;
            }
            .shop-title, .report-title {
              font-family: 'Jost', 'Noto Sans Tamil', system-ui, sans-serif;
            }
            .header {
              border-bottom: 2px solid #101318;
              padding-bottom: 12px;
              margin-bottom: 18px;
            }
            .shop-title {
              font-size: 22px;
              font-weight: 800;
              color: #101318;
              margin: 0;
            }
            .shop-sub {
              font-size: 12px;
              color: #4b5563;
              margin-top: 3px;
            }
            .report-title {
              font-size: 16px;
              font-weight: 700;
              margin-top: 10px;
              color: #374151;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 10px;
              margin: 18px 0;
            }
            .kpi-box {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 10px;
            }
            .kpi-label {
              font-size: 11px;
              font-weight: 700;
              color: #6b7280;
              text-transform: uppercase;
            }
            .kpi-val {
              font-size: 18px;
              font-weight: 800;
              color: #111827;
              margin: 4px 0 2px 0;
            }
            .profit-val {
              color: #101318;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 12px;
            }
            .table th {
              background-color: #f3f4f6;
              padding: 8px;
              text-align: left;
              font-weight: 700;
              border-bottom: 2px solid #d1d5db;
            }
            .section-heading {
              font-size: 14px;
              font-weight: 700;
              color: #101318;
              margin-top: 20px;
              margin-bottom: 6px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 4px;
            }
            .footer {
              margin-top: 28px;
              text-align: center;
              font-size: 11px;
              color: #9ca3af;
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="shop-title">${shop.name}</h1>
            <div class="shop-sub">${shop.address ? `${shop.address}, ` : ''}${shop.city ? `${shop.city}, ` : ''}${shop.state} · Ph: +91 ${shop.phone}</div>
            <div class="report-title">Monthly Business Report — ${report.monthLabel}</div>
            <div style="font-size: 11px; color: #6b7280;">${report.rangeLabel}</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-box">
              <div class="kpi-label">Total Sales</div>
              <div class="kpi-val">${formatRupee(report.totalSales)}</div>
              <div style="font-size: 10px; color: #6b7280;">${report.billsCount} bills</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Total Expenses</div>
              <div class="kpi-val">${formatRupee(report.totalExpenses)}</div>
              <div style="font-size: 10px; color: #6b7280;">Cost outflow</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Net Profit</div>
              <div class="kpi-val profit-val">${formatRupee(report.profit)}</div>
              <div style="font-size: 10px; color: #6b7280;">${report.profitMarginPct}% margin</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Best Day</div>
              <div class="kpi-val">${report.monthShort} ${report.bestDay.day}</div>
              <div style="font-size: 10px; color: #6b7280;">${formatRupee(report.bestDay.profit)} profit</div>
            </div>
          </div>

          <div class="section-heading">Payment Modes Breakdown</div>
          <div style="max-width: 320px; margin-bottom: 14px;">
            ${paymentModesHtml}
          </div>

          <div class="section-heading">Day-Wise Performance (${report.days.length} Days)</div>
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th style="text-align: right;">Sales</th>
                <th style="text-align: right;">Expenses</th>
                <th style="text-align: right;">Profit</th>
              </tr>
            </thead>
            <tbody>
              ${dayRowsHtml}
              <tr style="background-color: #f3f4f6; font-weight: 800;">
                <td style="padding: 8px;">TOTAL</td>
                <td style="padding: 8px; text-align: right;">${formatRupee(report.totalSales)}</td>
                <td style="padding: 8px; text-align: right;">${formatRupee(report.totalExpenses)}</td>
                <td style="padding: 8px; text-align: right; color: #101318;">${formatRupee(report.profit)}</td>
              </tr>
            </tbody>
          </table>

          ${report.topItems.length > 0 ? `
          <div class="section-heading">Top 10 Selling Items</div>
          <table class="table">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>Item Name</th>
                <th style="text-align: right;">Quantity Sold</th>
                <th style="text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${topItemsHtml}
            </tbody>
          </table>
          ` : ''}

          <div class="footer">
            Generated by Counter365 · Billing for Food Shops · Verified Production Report
          </div>
        </body>
        </html>
      `;

      const cleanName = (shop.name || 'Shop').replace(/[^a-zA-Z0-9]/g, '_');
      const targetFilename = `${cleanName}_${report.monthShort}_${report.year}_Report.pdf`;
      const targetUri = `${FileSystem.documentDirectory}${targetFilename}`;

      // Request base64 output to bypass Android scoped cache permissions
      const printResult = await Print.printToFileAsync({ html, base64: true });

      if (printResult?.base64) {
        await FileSystem.writeAsStringAsync(targetUri, printResult.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (printResult?.uri) {
        await FileSystem.copyAsync({
          from: printResult.uri,
          to: targetUri,
        });
      }

      let safeUri = targetUri;
      if (!safeUri.startsWith('file://')) {
        safeUri = `file://${safeUri}`;
      }

      const fileInfo = await FileSystem.getInfoAsync(safeUri);
      const readyUri = fileInfo.exists ? safeUri : printResult.uri;

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable && readyUri) {
        try {
          await Sharing.shareAsync(readyUri, {
            mimeType: 'application/pdf',
            dialogTitle: `${shop.name} - ${report.monthLabel} Report`,
            UTI: 'com.adobe.pdf',
          });
        } catch (shareErr) {
          console.warn('Sharing error caught, activating print fallback:', shareErr);
          await Print.printAsync({ html });
        }
      } else {
        await Print.printAsync({ html });
      }

      return { success: true, uri: readyUri };
    } catch (err: any) {
      console.warn('PDF export error:', err);
      try {
        await Print.printAsync({ html });
        return { success: true };
      } catch (printErr: any) {
        return { success: false, error: printErr?.message || 'Failed to generate PDF' };
      }
    }
  },

  /**
   * 2. Generates and shares Excel (.csv spreadsheet) Monthly Report
   */
  async exportMonthlyReportExcel(report: MonthlyReportData, shop: Shop): Promise<{ success: boolean; uri?: string; error?: string }> {
    try {
      const cleanName = (shop.name || 'Shop').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanName}_${report.monthShort}_${report.year}_Report.csv`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      let csv = `COUNTER365 MONTHLY BUSINESS REPORT\n`;
      csv += `Shop Name,${shop.name}\n`;
      csv += `Period,${report.monthLabel}\n`;
      csv += `Address,"${shop.address || ''}, ${shop.city || ''}, ${shop.state}"\n`;
      csv += `Phone,+91 ${shop.phone}\n`;
      csv += `Generated On,${new Date().toLocaleString('en-IN')}\n\n`;

      csv += `EXECUTIVE SUMMARY\n`;
      csv += `Total Sales,${report.totalSales}\n`;
      csv += `Total Bills,${report.billsCount}\n`;
      csv += `Total Expenses,${report.totalExpenses}\n`;
      csv += `Net Profit,${report.profit}\n`;
      csv += `Profit Margin,${report.profitMarginPct}%\n\n`;

      csv += `PAYMENT MODES BREAKDOWN\n`;
      csv += `Mode,Amount,Percentage\n`;
      report.paymentModes.forEach(pm => {
        csv += `"${pm.name}",${pm.amount},${pm.pct}\n`;
      });
      csv += `\n`;

      csv += `DAY-WISE PERFORMANCE\n`;
      csv += `Date,Day of Week,Sales (INR),Expenses (INR),Profit (INR)\n`;
      report.days.forEach(d => {
        csv += `"${d.dateFormatted}","${d.dayOfWeek}",${d.sales},${d.expenses},${d.profit}\n`;
      });
      csv += `TOTAL,"",${report.totalSales},${report.totalExpenses},${report.profit}\n\n`;

      if (report.topItems.length > 0) {
        csv += `TOP 10 SELLING ITEMS\n`;
        csv += `Rank,Item Name,Quantity Sold,Total Revenue (INR)\n`;
        report.topItems.forEach(it => {
          csv += `${it.rank},"${it.name}",${it.quantity},${it.amount}\n`;
        });
      }

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `${shop.name} - ${report.monthLabel} Report (Excel/CSV)`,
          UTI: 'public.comma-separated-values-text',
        });
      }

      return { success: true, uri: fileUri };
    } catch (err: any) {
      console.warn('Excel export error:', err);
      return { success: false, error: err?.message || 'Failed to generate Excel report' };
    }
  },

  /**
   * 3. Formats and sends Monthly Report on WhatsApp
   */
  async shareMonthlyReportWhatsApp(report: MonthlyReportData, shop: Shop, phone?: string): Promise<boolean> {
    let text = `*${shop.name} — Monthly Report (${report.monthLabel})*\n`;
    text += `--------------------------------\n`;
    text += `*Total Sales:* ${formatRupee(report.totalSales)} (${report.billsCount} bills)\n`;
    text += `*Total Expenses:* ${formatRupee(report.totalExpenses)}\n`;
    text += `*NET PROFIT:* ${formatRupee(report.profit)} (${report.profitMarginPct}% margin)\n`;
    text += `*Best Day:* ${report.monthShort} ${report.bestDay.day} (${formatRupee(report.bestDay.profit)} profit)\n`;
    text += `--------------------------------\n`;
    text += `*Payment Breakdown:*\n`;
    report.paymentModes.forEach(pm => {
      text += `• ${pm.name}: ${formatRupee(pm.amount)} (${pm.pct})\n`;
    });

    if (report.topItems.length > 0) {
      text += `--------------------------------\n`;
      text += `*Top Selling Items:*\n`;
      report.topItems.slice(0, 5).forEach(it => {
        text += `${it.rank}. ${it.name} — ${it.quantity} pcs (${formatRupee(it.amount)})\n`;
      });
    }

    text += `--------------------------------\n`;
    text += `_Report generated by Counter365_`;

    return await whatsappService.shareViaWhatsApp(text, phone);
  },

  /**
   * 4. Persists Day Closing session to Supabase and local cache
   */
  async saveDayClosingToSupabase(report: DayClosingReport, shopId: string): Promise<void> {
    if (!shopId) return;
    try {
      const sessionId = generateUUID();
      await (supabase.from('cash_sessions') as any).insert({
        id: sessionId,
        shop_id: shopId,
        opening_cash: 0.00,
        opening_float: 0.00,
        closing_cash: report.cashSales,
        actual_cash: report.cashSales,
        difference: 0.00,
        total_sales: report.totalSales,
        total_expenses: report.totalExpenses,
        status: 'closed',
        opened_at: new Date().toISOString(),
        closed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('saveDayClosingToSupabase notice:', err);
    }
  },

  /**
   * 5. Prints Thermal Day Closing Receipt via Bluetooth/Thermal printer
   */
  async printDayClosingReceipt(report: DayClosingReport): Promise<boolean> {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
            <div class="center bold" style="font-size: 15px;">${report.shopTitle}</div>
            <div class="center" style="font-size: 10px;">${report.shopAddress}</div>
            <div class="center" style="font-size: 10px;">Ph: +91 ${report.phone}</div>
            <div class="dashed"></div>
            <div class="center bold">DAY CLOSING REPORT</div>
            <div class="center" style="font-size: 10px;">${report.date}</div>
            <div class="dashed"></div>
            <div class="flex">
              <span>Total Bills</span>
              <span class="bold">${report.billsCount}</span>
            </div>
            <div class="flex">
              <span>Total Sales</span>
              <span class="bold">${formatRupee(report.totalSales)}</span>
            </div>
            <div class="dashed"></div>
            <div class="flex">
              <span>  Cash Collected</span>
              <span>${formatRupee(report.cashSales)}</span>
            </div>
            <div class="flex">
              <span>  GPay / UPI</span>
              <span>${formatRupee(report.gpaySales)}</span>
            </div>
            <div class="flex">
              <span>  Pending / Credit</span>
              <span>${formatRupee(report.pendingSales)}</span>
            </div>
            <div class="dashed"></div>
            <div class="flex">
              <span>Total Expenses</span>
              <span>- ${formatRupee(report.totalExpenses)}</span>
            </div>
            <div class="solid"></div>
            <div class="flex bold" style="font-size: 14px;">
              <span>NET PROFIT</span>
              <span>${formatRupee(report.netProfit)}</span>
            </div>
            <div class="dashed"></div>
            <div class="center" style="font-size: 9px; margin-top: 8px;">
              Closed on ${new Date().toLocaleTimeString('en-IN')}<br/>COUNTER365 BILLING SYSTEM
            </div>
          </body>
        </html>
      `;

      await Print.printAsync({ html });
      return true;
    } catch (err) {
      console.warn('Thermal print day report error:', err);
      return false;
    }
  },

  /**
   * 6. Generates high-resolution PDF Receipt Copy of a Bill and safely shares/saves it
   * Styled like a receipt document / image with zero Android export sharing errors.
   */
  async exportBillPdf(bill: Bill, shop: Shop): Promise<{ success: boolean; uri?: string; error?: string }> {
    let html = '';
    try {
      const timeStr = new Date(bill.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date(bill.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      const itemRowsHtml = (bill.items || []).map(item => `
        <tr>
          <td style="padding: 7px 6px; border-bottom: 1px dashed #e2e8f0; font-weight: 600; font-size: 13px; color: #1e293b;">
            ${item.itemName}
          </td>
          <td style="padding: 7px 6px; border-bottom: 1px dashed #e2e8f0; text-align: center; font-size: 13px; color: #334155;">
            ${item.quantity}
          </td>
          <td style="padding: 7px 6px; border-bottom: 1px dashed #e2e8f0; text-align: right; font-size: 13px; color: #64748b;">
            ${formatRupee(item.unitPrice)}
          </td>
          <td style="padding: 7px 6px; border-bottom: 1px dashed #e2e8f0; text-align: right; font-weight: 700; font-size: 13px; color: #0f172a;">
            ${formatRupee(item.lineTotal || (item.unitPrice * item.quantity))}
          </td>
        </tr>
      `).join('');

      const isFullPaid = bill.paymentMode !== 'Pending' && bill.paymentMode !== 'Partial Pay';
      const isPartial = bill.paymentMode === 'Partial Pay';
      const isPending = bill.paymentMode === 'Pending';

      let paymentDetailsHtml = `
        <div style="background: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 8px; padding: 12px 14px; margin-top: 14px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 26px; height: 26px; border-radius: 13px; background: #EA580C; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800;">✓</div>
            <div style="width: 1px; height: 26px; background: #FED7AA;"></div>
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #EA580C; letter-spacing: 0.5px; text-transform: uppercase;">
                ${isFullPaid ? 'PAID' : isPartial ? 'PARTIALLY PAID' : 'PENDING'}
              </div>
              <div style="font-size: 12.5px; font-weight: 600; color: #1E293B;">
                Paid via ${bill.paymentMode}
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: #0F172A;">
              ${formatRupee(isFullPaid ? bill.totalAmount : isPartial ? (bill.paidAmount || 0) : 0)}
            </div>
          </div>
        </div>
      `;

      if (isPartial) {
        paymentDetailsHtml += `
          <div style="display: flex; justify-content: space-between; margin-top: 6px; padding: 6px 12px; background: #FEF2F2; border-radius: 6px; font-size: 12px;">
            <span style="color: #DC2626; font-weight: 600;">Balance Due:</span>
            <strong style="color: #DC2626;">${formatRupee(bill.pendingAmount || 0)}</strong>
          </div>
        `;
        if (shop.upiId) {
          paymentDetailsHtml += `
            <div style="margin-top: 6px; font-size: 11px; color: #475569; text-align: center; background: #F8FAFC; padding: 6px; border-radius: 6px; border: 1px dashed #CBD5E1;">
              📲 Pay Balance Due via UPI: <strong style="color: #0F172A;">${shop.upiId}</strong>
            </div>
          `;
        }
      } else if (isPending && shop.upiId) {
        paymentDetailsHtml += `
          <div style="margin-top: 6px; font-size: 11px; color: #475569; text-align: center; background: #F8FAFC; padding: 6px; border-radius: 6px; border: 1px dashed #CBD5E1;">
            📲 Pay Due via UPI: <strong style="color: #0F172A;">${shop.upiId}</strong>
          </div>
        `;
      }

      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Jost:wght@500;600;700;800&family=Lexend:wght@300..800&family=Noto+Sans+Tamil:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              margin: 6mm;
              size: auto;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
            }
            body {
              font-family: 'Lexend', 'Noto Sans Tamil', system-ui, sans-serif;
              color: #0f172a;
              background-color: #f8fafc;
              margin: 0;
              padding: 12px;
              display: flex;
              justify-content: center;
              align-items: flex-start;
            }
            .receipt-card {
              width: 100%;
              max-width: 440px;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 24px 20px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
            }
            .top-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }
            .merchant-logo-box {
              background-color: #E2E8F0;
              border-radius: 6px;
              padding: 8px 16px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.5px;
              color: #475569;
              text-transform: uppercase;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }
            .shop-logo-img {
              max-height: 38px;
              border-radius: 6px;
              object-fit: contain;
            }
            .receipt-title-wrap {
              text-align: right;
            }
            .receipt-title {
              font-family: 'Jost', system-ui, sans-serif;
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 1px;
              color: #0f172a;
              margin: 0;
              text-transform: uppercase;
            }
            .receipt-title-underline {
              width: 32px;
              height: 2.5px;
              background-color: #F97316;
              margin-top: 3px;
              margin-left: auto;
            }
            .shop-info-block {
              margin-bottom: 16px;
            }
            .shop-name {
              font-family: 'Jost', 'Noto Sans Tamil', system-ui, sans-serif;
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 6px 0;
            }
            .shop-meta-line {
              font-size: 12px;
              color: #475569;
              margin: 3px 0;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .h-divider {
              height: 1px;
              background-color: #E5E7EB;
              margin: 14px 0;
            }
            .meta-columns {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .meta-col-left {
              flex: 1;
            }
            .meta-v-divider {
              width: 1px;
              height: 36px;
              background-color: #E5E7EB;
              margin: 0 16px;
            }
            .meta-col-right {
              flex: 1;
            }
            .meta-label-small {
              font-size: 10px;
              font-weight: 700;
              color: #6B7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .meta-val-large {
              font-size: 15px;
              font-weight: 800;
              color: #0F172A;
            }
            .billed-to-block {
              margin-top: 4px;
            }
            .customer-name-large {
              font-size: 14px;
              font-weight: 700;
              color: #0F172A;
              margin-top: 2px;
            }
            .customer-phone-sub {
              font-size: 12px;
              color: #64748B;
              margin-top: 1px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0 6px 0;
            }
            .items-table th {
              background-color: #F3F4F6;
              padding: 8px 10px;
              font-size: 10.5px;
              font-weight: 700;
              color: #6B7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .items-table td {
              padding: 9px 10px;
              font-size: 13px;
              border-bottom: 1px solid #F1F5F9;
              color: #0F172A;
            }
            .subtotal-row {
              display: flex;
              justify-content: flex-end;
              gap: 32px;
              padding: 10px 10px 4px 10px;
              font-size: 13px;
            }
            .subtotal-label {
              font-weight: 600;
              color: #475569;
            }
            .subtotal-val {
              font-weight: 700;
              color: #0F172A;
            }
            .grand-total-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 14px;
              margin-top: 10px;
              background-color: #F8FAFC;
              border-top: 3px solid #F97316;
              border-bottom: 1px solid #E2E8F0;
            }
            .grand-total-label {
              font-family: 'Jost', system-ui, sans-serif;
              font-size: 14px;
              font-weight: 800;
              color: #0F172A;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .grand-total-val {
              font-size: 20px;
              font-weight: 800;
              color: #0F172A;
            }
            .thank-you-row {
              display: flex;
              align-items: center;
              gap: 12px;
              margin: 22px 0 14px 0;
            }
            .thank-you-line {
              flex: 1;
              height: 1px;
              background-color: #E2E8F0;
            }
            .thank-you-text {
              font-size: 13px;
              font-weight: 700;
              color: #0F172A;
            }
            .footer-branding {
              text-align: center;
              margin-top: 10px;
            }
            .counter-brand-logo {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              font-size: 14px;
              font-weight: 800;
              color: #0F172A;
            }
            .brand-badge {
              width: 18px;
              height: 18px;
              border-radius: 9px;
              background-color: #0F172A;
              color: #FFFFFF;
              font-size: 11px;
              font-weight: 900;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }
            .footer-receipt-note {
              font-size: 10px;
              color: #94A3B8;
              margin-top: 3px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <!-- 1. Top Bar: Merchant Logo (left) | RECEIPT (right) -->
            <div class="top-bar">
              <div>
                ${shop.logoUrl ? `
                  <img src="${shop.logoUrl}" class="shop-logo-img" alt="Logo" />
                ` : `
                  <div class="merchant-logo-box">MERCHANT LOGO</div>
                `}
              </div>
              <div class="receipt-title-wrap">
                <h2 class="receipt-title">RECEIPT</h2>
                <div class="receipt-title-underline"></div>
              </div>
            </div>

            <!-- 2. Shop Details -->
            <div class="shop-info-block">
              <h1 class="shop-name">${shop.name}</h1>
              <div class="shop-meta-line">📍 ${shop.address ? `${shop.address}, ` : ''}${shop.city ? `${shop.city}` : ''}</div>
              <div class="shop-meta-line">📞 +91 ${shop.phone}${shop.gstEnabled && shop.gstNumber ? ` · GSTIN: ${shop.gstNumber}` : ''}</div>
            </div>

            <div class="h-divider"></div>

            <!-- 3. Metadata: Bill Number & Date/Time -->
            <div class="meta-columns">
              <div class="meta-col-left">
                <div class="meta-label-small">BILL NUMBER</div>
                <div class="meta-val-large">Bill #${bill.billNumber}</div>
                ${bill.tableNumber ? `<div style="font-size: 11px; color: #EA580C; font-weight: 700; margin-top: 2px;">Table ${bill.tableNumber}</div>` : ''}
              </div>
              <div class="meta-v-divider"></div>
              <div class="meta-col-right">
                <div class="meta-label-small">📅 DATE & TIME</div>
                <div class="meta-val-large" style="font-size: 13.5px;">${dateStr} · ${timeStr}</div>
              </div>
            </div>

            ${(bill.customerName || bill.customerPhone) ? `
              <div class="h-divider"></div>
              <div class="billed-to-block">
                <div class="meta-label-small">👤 BILLED TO</div>
                <div class="customer-name-large">${bill.customerName || 'Customer'}</div>
                ${bill.customerPhone ? `<div class="customer-phone-sub">+91 ${bill.customerPhone}</div>` : ''}
              </div>
            ` : ''}

            <!-- 4. Items Table with gray header background -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="text-align: left; border-top-left-radius: 4px; border-bottom-left-radius: 4px;">ITEM</th>
                  <th style="text-align: center; width: 45px;">QTY</th>
                  <th style="text-align: right; width: 65px;">PRICE</th>
                  <th style="text-align: right; width: 75px; border-top-right-radius: 4px; border-bottom-right-radius: 4px;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${itemRowsHtml}
              </tbody>
            </table>

            <!-- 5. Subtotal -->
            <div class="subtotal-row">
              <span class="subtotal-label">Subtotal</span>
              <span class="subtotal-val">${formatRupee(bill.subtotal || bill.totalAmount)}</span>
            </div>
            ${(bill.gstAmount || 0) > 0 ? `
              <div class="subtotal-row" style="padding-top: 0;">
                <span class="subtotal-label">GST ${shop.gstRate ? `(${shop.gstRate}%)` : ''}</span>
                <span class="subtotal-val">${formatRupee(bill.gstAmount || 0)}</span>
              </div>
            ` : ''}

            <!-- 6. GRAND TOTAL Bar with orange top border -->
            <div class="grand-total-bar">
              <span class="grand-total-label">GRAND TOTAL</span>
              <span class="grand-total-val">${formatRupee(bill.totalAmount)}</span>
            </div>

            <!-- 7. Peach Payment Card with orange checkmark -->
            ${paymentDetailsHtml}

            <!-- 8. Footer -->
            <div class="thank-you-row">
              <div class="thank-you-line"></div>
              <span class="thank-you-text">Thank you for your business!</span>
              <div class="thank-you-line"></div>
            </div>

            <div class="footer-branding">
              <div class="counter-brand-logo">
                <span class="brand-badge">C</span> Counter<span style="color: #FF5F00;">365</span>
              </div>
              <div class="footer-receipt-note">
                Generated via Counter365 Point of Sale · Official Receipt Copy
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Safe sanitized filename
      const safeBillNo = (bill.billNumber || 'Bill').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeShop = (shop.name || 'Shop').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeShop}_Bill_${safeBillNo}.pdf`;
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      let targetUri = `${baseDir}${filename}`;

      // Ensure proper URI scheme
      if (!targetUri.startsWith('file://')) {
        targetUri = `file://${targetUri}`;
      }

      // Generate PDF
      const printResult = await Print.printToFileAsync({ html, base64: true });

      if (printResult?.base64) {
        await FileSystem.writeAsStringAsync(targetUri, printResult.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (printResult?.uri) {
        await FileSystem.copyAsync({
          from: printResult.uri,
          to: targetUri,
        });
      }

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(targetUri);
      const readyUri = fileInfo.exists ? targetUri : printResult.uri;

      // Safe Sharing with fallback to native print/save-as-pdf preview
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable && readyUri) {
        try {
          await Sharing.shareAsync(readyUri, {
            mimeType: 'application/pdf',
            dialogTitle: `${shop.name} - Bill #${bill.billNumber}`,
            UTI: 'com.adobe.pdf',
          });
        } catch (shareErr) {
          console.warn('Native share dialog error, activating print preview fallback:', shareErr);
          await Print.printAsync({ html });
        }
      } else {
        await Print.printAsync({ html });
      }

      return { success: true, uri: readyUri };
    } catch (err: any) {
      console.warn('exportBillPdf error:', err);
      try {
        await Print.printAsync({ html });
        return { success: true };
      } catch (fallbackErr: any) {
        return { success: false, error: fallbackErr?.message || 'Failed to export bill PDF' };
      }
    }
  }
};
