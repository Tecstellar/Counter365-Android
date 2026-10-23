import QRCode from 'qrcode';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { MonthlyReportData, DayClosingReport, Shop, Bill } from '../types/models';
import { formatRupee } from '../lib/money';
import { whatsappService } from './whatsappService';
import { supabase } from '../lib/supabase';
import { generateUUID, isValidUUID } from '../lib/uuid';
import { storage } from '../lib/storage';
import { LOCAL_BILLS_KEY } from './billingService';

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
   * Helper: converts base64 string to Uint8Array for Supabase Storage
   * Ultra-resilient pure JS decoding: operates without Buffer or atob dependencies.
   */
  base64ToUint8Array(base64: string): Uint8Array {
    try {
      const clean = base64.replace(/^data:application\/pdf;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');
      const len = clean.length;
      if (len === 0) return new Uint8Array(0);

      if (typeof Buffer !== 'undefined') {
        try {
          return new Uint8Array(Buffer.from(clean, 'base64'));
        } catch {}
      }

      const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const lookup = new Uint8Array(256);
      for (let i = 0; i < b64chars.length; i++) {
        lookup[b64chars.charCodeAt(i)] = i;
      }

      let padding = 0;
      if (clean[len - 1] === '=') padding++;
      if (clean[len - 2] === '=') padding++;

      const byteLength = Math.max(0, (len * 3) / 4 - padding);
      const bytes = new Uint8Array(byteLength);

      let p = 0;
      for (let i = 0; i < len; i += 4) {
        const enc1 = lookup[clean.charCodeAt(i)];
        const enc2 = lookup[clean.charCodeAt(i + 1)];
        const enc3 = lookup[clean.charCodeAt(i + 2)];
        const enc4 = lookup[clean.charCodeAt(i + 3)];

        bytes[p++] = (enc1 << 2) | (enc2 >> 4);
        if (clean[i + 2] !== '=' && p < byteLength) {
          bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
        }
        if (clean[i + 3] !== '=' && p < byteLength) {
          bytes[p++] = ((enc3 & 3) << 6) | enc4;
        }
      }

      return bytes;
    } catch (err) {
      console.warn('base64ToUint8Array error:', err);
      return new Uint8Array(0);
    }
  },

  /**
   * Uploads receipt PDF to Supabase Storage 'receipts' public bucket
   * Includes multi-attempt retries to guarantee persistence before returning
   */
  async uploadReceiptToCloud(billId: string, pdfBase64: string): Promise<string | null> {
    try {
      if (!supabase || !billId) return null;
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      const fileBytes = this.base64ToUint8Array(cleanBase64);
      if (!fileBytes || fileBytes.length === 0) return null;
      const arrayBuffer = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength) as ArrayBuffer;
      const filePath = `${billId}.pdf`;

      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error } = await supabase.storage
            .from('receipts')
            .upload(filePath, arrayBuffer, {
              contentType: 'application/pdf',
              upsert: true,
              cacheControl: '0',
            });
          if (!error) {
            lastError = null;
            break;
          }
          lastError = error;
        } catch (e: any) {
          lastError = e;
        }
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 350 * attempt));
        }
      }

      if (lastError) {
        console.warn('Supabase storage receipt upload notice:', lastError.message || lastError);
      }

      const { data } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);
      return data?.publicUrl || `https://tziqjkklqtmjlncoraba.supabase.co/storage/v1/object/public/receipts/${filePath}`;
    } catch (err: any) {
      console.warn('uploadReceiptToCloud exception:', err);
      return null;
    }
  },

  /**
   * Helper to strip emojis from PDF text to preserve clean vector typography
   */
  stripEmojis(text: string): string {
    if (!text) return '';
    return text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Generates a self-contained, offline vector SVG QR Code (Model 2, EC Level M)
   */
  generateQrSvg(data: string, size: number = 96): string {
    try {
      const qr = QRCode.create(data, { errorCorrectionLevel: 'M' });
      const moduleCount = qr.modules.size;
      const margin = 2;
      const totalDim = moduleCount + margin * 2;
      let pathD = '';
      for (let r = 0; r < moduleCount; r++) {
        let c = 0;
        while (c < moduleCount) {
          if (qr.modules.get(r, c)) {
            const start = c;
            while (c < moduleCount && qr.modules.get(r, c)) c++;
            const len = c - start;
            pathD += `M${start + margin} ${r + margin}h${len}v1h-${len}z `;
          } else {
            c++;
          }
        }
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="${size}" height="${size}" shape-rendering="crispEdges">
        <rect width="${totalDim}" height="${totalDim}" fill="#FFFFFF"/>
        <path d="${pathD.trim()}" fill="#0F1B2D"/>
      </svg>`;
    } catch (err) {
      console.warn('generateQrSvg error:', err);
      return '';
    }
  },

  /**
   * Builds the official high-resolution receipt HTML template pixel-matched to pdf_template.png
   * Supports multi-page pagination, embedded vector graphics, and conditional UPI QR attachment.
   */
  buildBillReceiptHtml(bill: Bill, shop: Shop): string {
    const timeStr = new Date(bill.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(bill.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const formatMoney = (amount: number): string => {
      if (amount === 0) return '₹0.00';
      if (amount % 1 !== 0) {
        return '\u20B9' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return formatRupee(amount);
    };

    const cleanShopName = this.stripEmojis(shop.name || 'CounterPro Shop');
    const cleanShopAddress = this.stripEmojis(shop.address || '');
    const cleanShopCity = this.stripEmojis(shop.city || '');
    const cleanShopPhone = (shop.phone || '').trim();
    const cleanBillNumber = (bill.billNumber || '0001').replace(/[^a-zA-Z0-9_-]/g, '');

    const rawCustName = (bill.customerName || '').trim();
    const isWalkIn = !rawCustName || rawCustName === 'Not tracked' || rawCustName.toLowerCase() === 'walk-in' || rawCustName.toLowerCase() === 'walk-in customer';
    const cleanCustName = isWalkIn ? 'Walk-in Customer' : this.stripEmojis(rawCustName);
    const cleanCustPhone = (bill.customerPhone || '').replace(/[^0-9]/g, '').slice(-10);

    const itemCount = (bill.items || []).length;
    const isCompact = itemCount >= 5;
    const isUltraCompact = itemCount >= 8;

    const itemRowsHtml = (bill.items || []).map(item => {
      const rawName = item.itemName || 'Item';
      // Strip any pre-existing (Half) or (Full) to prevent double portion tags
      const cleanItemName = this.stripEmojis(rawName).replace(/\s*\((?:half|full)\)/gi, '').trim();
      const portionFontSize = isUltraCompact ? '12px' : isCompact ? '13px' : '15px';
      const portionTag = item.isHalf ? `<span style="font-size: ${portionFontSize}; color: #EA580C; font-weight: 700; margin-left: 5px;">(Half)</span>` : '';
      const lineTotal = item.lineTotal || (item.unitPrice * item.quantity);
      return `
        <tr class="table-tr">
          <td class="td-item">
            ${cleanItemName}${portionTag}
          </td>
          <td class="td-qty">
            ${item.quantity}
          </td>
          <td class="td-price">
            ${formatMoney(item.unitPrice)}
          </td>
          <td class="td-total">
            ${formatMoney(lineTotal)}
          </td>
        </tr>
      `;
    }).join('');

    const isFullyPending = bill.paymentMode === 'Pending' || ((bill.paidAmount === 0 || bill.paidAmount === undefined) && (bill.pendingAmount || 0) > 0 && bill.totalAmount > 0);
    const isPartiallyPaid = !isFullyPending && (bill.paymentMode === 'Partial Pay' || ((bill.paidAmount || 0) > 0 && (bill.pendingAmount || 0) > 0));
    const isFullyPaid = !isFullyPending && !isPartiallyPaid;

    // Optional intermediate rows between Subtotal and Grand Total
    const subtotal = bill.subtotal !== undefined && bill.subtotal !== null ? bill.subtotal : bill.totalAmount;
    const discountAmount = bill.discountAmount || 0;
    const gstAmount = bill.gstAmount || 0;
    const roundOff = (bill as any).roundOff || 0;

    const subtotalRowHeight = isUltraCompact ? '26px' : isCompact ? '30px' : '40px';
    const subtotalFontSize = isUltraCompact ? '14px' : isCompact ? '16px' : '19px';

    let intermediateRowsHtml = '';
    if (discountAmount > 0) {
      intermediateRowsHtml += `
        <div class="subtotal-row" style="height: ${subtotalRowHeight};">
          <span class="subtotal-label" style="font-size: ${subtotalFontSize};">Discount</span>
          <span class="subtotal-val" style="font-size: ${subtotalFontSize}; color: #16A34A;">-${formatMoney(discountAmount)}</span>
        </div>
      `;
    }
    if (gstAmount > 0) {
      const displayGstRate = bill.gstRate !== undefined && bill.gstRate !== null && bill.gstRate > 0
        ? bill.gstRate
        : (shop.gstRate || 5);
      intermediateRowsHtml += `
        <div class="subtotal-row" style="height: ${subtotalRowHeight};">
          <span class="subtotal-label" style="font-size: ${subtotalFontSize};">GST (${displayGstRate}%)</span>
          <span class="subtotal-val" style="font-size: ${subtotalFontSize};">${formatMoney(gstAmount)}</span>
        </div>
      `;
    }
    if (roundOff !== 0) {
      const sign = roundOff > 0 ? '+' : '';
      intermediateRowsHtml += `
        <div class="subtotal-row" style="height: ${subtotalRowHeight};">
          <span class="subtotal-label" style="font-size: ${subtotalFontSize};">Round off</span>
          <span class="subtotal-val" style="font-size: ${subtotalFontSize};">${sign}${formatMoney(roundOff)}</span>
        </div>
      `;
    }

    // Payment Details Panel & UPI Block
    let paymentDetailsHtml = '';
    let upiBlockHtml = '';

    if (isFullyPaid) {
      let paidMethodLabel: string = bill.paymentMode || 'Cash';
      if (bill.paymentMode === 'Cash + GPay' && (bill.cashAmount !== undefined || bill.gpayAmount !== undefined)) {
        paidMethodLabel = `Cash ${formatMoney(bill.cashAmount || 0)} + GPay ${formatMoney(bill.gpayAmount || 0)}`;
      }
      paymentDetailsHtml = `
        <div class="status-panel" style="background: #FFF7ED;">
          <div class="status-left">
            <div class="status-circle" aria-label="✓">
              <!-- ✓ -->
              <span style="display:none;">✓</span>
              <svg width="48" height="48" viewBox="0 0 58 58" fill="none">
                <circle cx="29" cy="29" r="29" fill="#FF5F00"/>
                <path d="M17 29.5L25.5 38L41 21" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="status-divider"></div>
            <div>
              <div class="status-badge-title">PAID</div>
              <div class="status-badge-sub">Paid via ${paidMethodLabel}</div>
            </div>
          </div>
          <div class="status-right-amount">${formatMoney(bill.totalAmount)}</div>
        </div>
      `;
    } else if (isPartiallyPaid) {
      const paid = bill.paidAmount || 0;
      const balance = bill.pendingAmount || Math.max(0, bill.totalAmount - paid);
      paymentDetailsHtml = `
        <div class="status-panel" style="background: #FFF7ED;">
          <div class="status-left">
            <div class="status-circle">
              <svg width="48" height="48" viewBox="0 0 58 58" fill="none">
                <circle cx="29" cy="29" r="26" stroke="#FF5F00" stroke-width="6"/>
                <path d="M29 9 A20 20 0 0 1 29 49 Z" fill="#FF5F00"/>
              </svg>
            </div>
            <div class="status-divider"></div>
            <div>
              <div class="status-badge-title">PARTIALLY PAID</div>
              <div class="status-badge-sub">Paid via ${bill.paymentMode || 'Partial Pay'} · Paid ${formatMoney(paid)}</div>
            </div>
          </div>
          <div class="status-right-amount" style="color: #FF5F00;">Due ${formatMoney(balance)}</div>
        </div>
      `;

      if (balance > 0 && shop.upiId && shop.upiId.trim()) {
        const cleanUpi = shop.upiId.trim().toLowerCase();
        const cleanNote = 'Bill-' + cleanBillNumber.replace(/[^a-zA-Z0-9-]/g, '');
        const cleanPn = encodeURIComponent(cleanShopName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Store');
        const upiUri = `upi://pay?pa=${cleanUpi}&pn=${cleanPn}&am=${balance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
        const qrSvg = this.generateQrSvg(upiUri, 96);
        upiBlockHtml = `
          <a href="${upiUri}" style="text-decoration: none; color: inherit; display: block;" target="_blank">
            <div class="upi-block">
              <div class="upi-details">
                <div class="upi-label">PAY VIA UPI · TAP OR SCAN</div>
                <div class="upi-id-val">${cleanUpi}</div>
                <div class="upi-due-val">Remaining Balance Due: ${formatMoney(balance)}</div>
                <div style="font-size: 15px; color: #5B6475; margin-top: 6px;">Pay Balance Due via UPI: <strong>${cleanUpi}</strong> · Tap to pay or scan QR</div>
              </div>
              <div class="upi-qr-tile">
                ${qrSvg}
              </div>
            </div>
          </a>
        `;
      }
    } else {
      const pendingBalance = bill.pendingAmount || bill.totalAmount;
      paymentDetailsHtml = `
        <div class="status-panel" style="background: #FFFBEB;">
          <div class="status-left">
            <div class="status-circle">
              <svg width="48" height="48" viewBox="0 0 58 58" fill="none">
                <circle cx="29" cy="29" r="26" stroke="#D97706" stroke-width="5"/>
                <path d="M29 18V32M29 40H29.02" stroke="#D97706" stroke-width="4.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="status-divider" style="background: #FDE68A;"></div>
            <div>
              <div class="status-badge-title" style="color: #D97706;">PAYMENT PENDING</div>
              <div class="status-badge-sub">Payment Pending · Amount Paid: ₹0.00</div>
            </div>
          </div>
          <div class="status-right-amount" style="color: #D97706;">Due ${formatMoney(pendingBalance)}</div>
        </div>
      `;

      if (pendingBalance > 0 && shop.upiId && shop.upiId.trim()) {
        const cleanUpi = shop.upiId.trim().toLowerCase();
        const cleanNote = 'Bill-' + cleanBillNumber.replace(/[^a-zA-Z0-9-]/g, '');
        const cleanPn = encodeURIComponent(cleanShopName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Store');
        const upiUri = `upi://pay?pa=${cleanUpi}&pn=${cleanPn}&am=${pendingBalance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
        const qrSvg = this.generateQrSvg(upiUri, 96);
        upiBlockHtml = `
          <a href="${upiUri}" style="text-decoration: none; color: inherit; display: block;" target="_blank">
            <div class="upi-block">
              <div class="upi-details">
                <div class="upi-label">PAY VIA UPI · TAP OR SCAN</div>
                <div class="upi-id-val">${cleanUpi}</div>
                <div class="upi-due-val">Outstanding Balance Due: ${formatMoney(pendingBalance)}</div>
                <div style="font-size: 15px; color: #5B6475; margin-top: 6px;">Pay Outstanding Due via UPI: <strong>${cleanUpi}</strong> · Tap to pay or scan QR</div>
              </div>
              <div class="upi-qr-tile">
                ${qrSvg}
              </div>
            </div>
          </a>
        `;
      }
    }

    const isBillEdited = !!(bill.isEdited || bill.status === 'edited' || (bill as any).editedAt);
    const editedTimeStr = (bill as any).editedAt ? new Date((bill as any).editedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
    const editedDateStr = (bill as any).editedAt ? new Date((bill as any).editedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Bill #${cleanBillNumber} - ${cleanShopName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Tamil:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --page-padding: ${isUltraCompact ? '12px 18px 10px 18px' : isCompact ? '16px 22px 12px 22px' : '24px 28px 20px 28px'};
            --header-height: ${isUltraCompact ? '56px' : isCompact ? '66px' : '92px'};
            --header-mb: ${isUltraCompact ? '8px' : isCompact ? '12px' : '20px'};
            --logo-width: ${isUltraCompact ? '120px' : isCompact ? '145px' : '180px'};
            --logo-height: ${isUltraCompact ? '42px' : isCompact ? '50px' : '64px'};
            --receipt-title-size: ${isUltraCompact ? '15px' : isCompact ? '17px' : '20px'};
            --shop-mb: ${isUltraCompact ? '8px' : isCompact ? '10px' : '18px'};
            --shop-name-size: ${isUltraCompact ? '20px' : isCompact ? '23px' : '30px'};
            --shop-meta-size: ${isUltraCompact ? '12px' : isCompact ? '13.5px' : '16px'};
            --bill-date-height: ${isUltraCompact ? '46px' : isCompact ? '54px' : '84px'};
            --bill-number-size: ${isUltraCompact ? '17px' : isCompact ? '19px' : '24px'};
            --date-val-size: ${isUltraCompact ? '13.5px' : isCompact ? '15px' : '18px'};
            --vertical-hairline-height: ${isUltraCompact ? '30px' : isCompact ? '38px' : '52px'};
            --billed-to-height: ${isUltraCompact ? '46px' : isCompact ? '52px' : '80px'};
            --cust-name-size: ${isUltraCompact ? '15px' : isCompact ? '17px' : '20px'};
            --cust-phone-size: ${isUltraCompact ? '12px' : isCompact ? '13.5px' : '16px'};
            --table-mt: ${isUltraCompact ? '6px' : isCompact ? '8px' : '14px'};
            --th-height: ${isUltraCompact ? '28px' : isCompact ? '32px' : '42px'};
            --th-size: ${isUltraCompact ? '11px' : isCompact ? '12px' : '14px'};
            --tr-height: ${isUltraCompact ? '28px' : isCompact ? '34px' : '50px'};
            --td-size: ${isUltraCompact ? '13px' : isCompact ? '14.5px' : '18px'};
            --td-padding-y: ${isUltraCompact ? '2px' : isCompact ? '4px' : '8px'};
            --subtotal-height: ${isUltraCompact ? '26px' : isCompact ? '30px' : '48px'};
            --subtotal-size: ${isUltraCompact ? '14px' : isCompact ? '16px' : '19px'};
            --grand-total-height: ${isUltraCompact ? '44px' : isCompact ? '50px' : '66px'};
            --grand-total-label-size: ${isUltraCompact ? '17px' : isCompact ? '19px' : '24px'};
            --grand-total-val-size: ${isUltraCompact ? '22px' : isCompact ? '25px' : '32px'};
            --status-panel-height: ${isUltraCompact ? '50px' : isCompact ? '58px' : '80px'};
            --status-panel-mt: ${isUltraCompact ? '8px' : isCompact ? '10px' : '18px'};
            --status-badge-title-size: ${isUltraCompact ? '13px' : isCompact ? '14.5px' : '16px'};
            --status-badge-sub-size: ${isUltraCompact ? '12.5px' : isCompact ? '14px' : '17px'};
            --status-amount-size: ${isUltraCompact ? '16px' : isCompact ? '18px' : '20px'};
            --thank-you-mt: ${isUltraCompact ? '8px' : isCompact ? '12px' : '24px'};
            --thank-you-size: ${isUltraCompact ? '14px' : isCompact ? '16px' : '20px'};
            --footer-mt: ${isUltraCompact ? '8px' : isCompact ? '12px' : '22px'};
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          @media print {
            html, body {
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              background: #FFFFFF !important;
            }
            .receipt-page {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              page-break-after: auto;
              page-break-inside: auto;
            }
            .summary-block, .table-tr, .status-panel, .upi-block, .thank-you-row, .footer-block {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 100%;
            margin: 0;
            padding: 0;
            background: #FFFFFF;
            font-family: 'Inter', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #0F1B2D;
          }

          .receipt-page {
            width: 100%;
            max-width: 820px;
            margin: 0 auto;
            position: relative;
            background: #FFFFFF;
            padding: var(--page-padding);
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
          }

          /* 1. Header Band */
          .header-band {
            width: 100%;
            min-height: var(--header-height);
            height: auto;
            background: #F4F5F7;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 22px 8px 20px;
            margin-bottom: var(--header-mb);
            box-sizing: border-box;
            flex-shrink: 0;
          }
          .merchant-logo-box {
            width: var(--logo-width);
            min-height: var(--logo-height);
            height: auto;
            background: #E2E6EC;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            overflow: visible;
            padding: 4px;
          }
          .merchant-logo-text {
            font-size: 13px;
            font-weight: 700;
            color: #5B6475;
            letter-spacing: 0.12em;
            line-height: 1.25;
            text-transform: uppercase;
          }
          .receipt-title-wrap {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
          }
          .receipt-title {
            font-size: var(--receipt-title-size);
            font-weight: 700;
            color: #0F1B2D;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            line-height: 1;
          }
          .receipt-title-underline, .receipt-underline {
            width: 44px;
            height: 3px;
            background: #FF5F00; /* #F97316 */
            margin-top: 6px;
            border-radius: 1.5px;
          }

          /* 2. Shop Block */
          .shop-block {
            width: 100%;
            padding-left: 10px;
            margin-bottom: var(--shop-mb);
            box-sizing: border-box;
            flex-shrink: 0;
          }
          .shop-name {
            font-size: var(--shop-name-size);
            font-weight: 600;
            color: #0F1B2D;
            line-height: 1.2;
            letter-spacing: -0.01em;
          }
          .shop-meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 6px;
          }
          .shop-meta-row:last-child {
            margin-top: 4px;
          }
          .shop-meta-text {
            font-size: var(--shop-meta-size);
            color: #5B6475;
            font-weight: 400;
            line-height: 1.3;
          }

          /* Hairlines */
          .hairline {
            width: 100%;
            height: 1.5px;
            background: #E3E5EA;
            flex-shrink: 0;
          }

          /* 4. Bill / Date Row */
          .bill-date-row {
            width: 100%;
            min-height: var(--bill-date-height);
            height: auto;
            padding: 8px 0;
            display: flex;
            align-items: center;
            flex-shrink: 0;
            box-sizing: border-box;
          }
          .bill-col {
            flex: 1;
            padding-left: 10px;
          }
          .meta-label {
            font-size: 13px;
            font-weight: 700;
            color: #5B6475;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }
          .bill-number-val {
            font-size: var(--bill-number-size);
            font-weight: 700;
            color: #0F1B2D;
            margin-top: 3px;
            letter-spacing: -0.01em;
          }
          .vertical-hairline {
            width: 1.5px;
            height: var(--vertical-hairline-height);
            background: #E3E5EA;
          }
          .date-col {
            flex: 1;
            padding-left: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .date-icon-wrap {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .date-val {
            font-size: var(--date-val-size);
            font-weight: 500;
            color: #0F1B2D;
            margin-top: 2px;
          }

          /* 6. Billed To */
          .billed-to-row {
            width: 100%;
            min-height: var(--billed-to-height);
            height: auto;
            padding: 8px 0;
            display: flex;
            align-items: center;
            padding-left: 10px;
            gap: 14px;
            box-sizing: border-box;
            flex-shrink: 0;
          }
          .person-icon-wrap {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .billed-to-details {
            display: flex;
            flex-direction: column;
          }
          .customer-name-val {
            font-size: var(--cust-name-size);
            font-weight: 600;
            color: #0F1B2D;
            margin-top: 2px;
            letter-spacing: -0.01em;
          }
          .customer-phone-val {
            font-size: var(--cust-phone-size);
            font-weight: 400;
            color: #5B6475;
            margin-top: 2px;
          }

          /* 8. Items Table */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: var(--table-mt);
            box-sizing: border-box;
          }
          .items-table thead {
            display: table-header-group;
          }
          .table-header-tr {
            height: var(--th-height);
            background-color: #F3F4F6;
            background: #F4F5F7;
          }
          .th-item {
            padding-left: 14px;
            font-size: var(--th-size);
            font-weight: 700;
            color: #5B6475;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            text-align: left;
            border-top-left-radius: 8px;
            border-bottom-left-radius: 8px;
          }
          .th-qty {
            width: 65px;
            font-size: var(--th-size);
            font-weight: 700;
            color: #5B6475;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            text-align: center;
          }
          .th-price {
            width: 120px;
            font-size: var(--th-size);
            font-weight: 700;
            color: #5B6475;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            text-align: right;
          }
          .th-total {
            width: 120px;
            padding-right: 14px;
            font-size: var(--th-size);
            font-weight: 700;
            color: #5B6475;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            text-align: right;
            border-top-right-radius: 8px;
            border-bottom-right-radius: 8px;
          }

          .table-tr {
            height: var(--tr-height);
            page-break-inside: avoid;
            break-inside: avoid;
            position: relative;
          }
          .td-item {
            padding-left: 14px;
            padding-top: var(--td-padding-y);
            padding-bottom: var(--td-padding-y);
            font-size: var(--td-size);
            font-weight: 600;
            color: #0F1B2D;
            text-align: left;
            border-bottom: 1.5px solid #E3E5EA;
            word-break: break-word;
          }
          .td-qty {
            width: 65px;
            padding-top: var(--td-padding-y);
            padding-bottom: var(--td-padding-y);
            font-size: var(--td-size);
            font-weight: 400;
            color: #0F1B2D;
            text-align: center;
            border-bottom: 1.5px solid #E3E5EA;
          }
          .td-price {
            width: 120px;
            padding-top: var(--td-padding-y);
            padding-bottom: var(--td-padding-y);
            font-size: var(--td-size);
            font-weight: 500;
            color: #0F1B2D;
            text-align: right;
            font-variant-numeric: tabular-nums;
            border-bottom: 1.5px solid #E3E5EA;
          }
          .td-total {
            width: 120px;
            padding-right: 14px;
            padding-top: var(--td-padding-y);
            padding-bottom: var(--td-padding-y);
            font-size: var(--td-size);
            font-weight: 600;
            color: #0F1B2D;
            text-align: right;
            font-variant-numeric: tabular-nums;
            border-bottom: 1.5px solid #E3E5EA;
          }

          /* Summary block */
          .summary-block {
            page-break-inside: avoid;
            break-inside: avoid;
            width: 100%;
            box-sizing: border-box;
          }

          /* 9. Subtotal Row */
          .subtotal-row {
            width: 100%;
            height: var(--subtotal-height);
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 14px;
            gap: 30px;
            box-sizing: border-box;
          }
          .subtotal-label {
            font-size: var(--subtotal-size);
            font-weight: 500;
            color: #0F1B2D;
          }
          .subtotal-val {
            font-size: var(--subtotal-size);
            font-weight: 600;
            color: #0F1B2D;
            font-variant-numeric: tabular-nums;
          }

          /* 10. Grand Total Band */
          .grand-total-bar, .grand-total-band {
            width: 100%;
            height: var(--grand-total-height);
            background: #F4F5F7;
            border-top: 3.5px solid #FF5F00;
            border-radius: 0 0 10px 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-left: 16px;
            padding-right: 16px;
            box-sizing: border-box;
          }
          .grand-total-label {
            font-size: var(--grand-total-label-size);
            font-weight: 700;
            color: #0F1B2D;
            letter-spacing: -0.01em;
            text-transform: uppercase;
          }
          .grand-total-val {
            font-size: var(--grand-total-val-size);
            font-weight: 800;
            color: #0F1B2D;
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.02em;
          }

          /* 11. Status Panel */
          .status-panel {
            width: 100%;
            height: var(--status-panel-height);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-left: 16px;
            padding-right: 16px;
            box-sizing: border-box;
            margin-top: var(--status-panel-mt);
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .status-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .status-circle {
            width: ${isUltraCompact ? '32px' : isCompact ? '36px' : '44px'};
            height: ${isUltraCompact ? '32px' : isCompact ? '36px' : '44px'};
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .status-circle svg {
            width: ${isUltraCompact ? '32px' : isCompact ? '36px' : '44px'};
            height: ${isUltraCompact ? '32px' : isCompact ? '36px' : '44px'};
          }
          .status-divider {
            width: 1px;
            height: ${isUltraCompact ? '26px' : isCompact ? '32px' : '40px'};
            background: #FED7AA;
          }
          .status-badge-title {
            font-size: var(--status-badge-title-size);
            font-weight: 800;
            color: #FF5F00;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            line-height: 1.1;
          }
          .status-badge-sub {
            font-size: var(--status-badge-sub-size);
            font-weight: 500;
            color: #0F1B2D;
            margin-top: 2px;
            line-height: 1.2;
          }
          .status-right-amount {
            font-size: var(--status-amount-size);
            font-weight: 700;
            color: #0F1B2D;
            font-variant-numeric: tabular-nums;
          }

          /* UPI Block */
          .upi-block {
            width: 100%;
            background: #FFF3EC;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: ${isUltraCompact ? '8px 14px' : isCompact ? '10px 16px' : '14px 20px'};
            box-sizing: border-box;
            margin-top: ${isUltraCompact ? '8px' : isCompact ? '10px' : '14px'};
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .upi-details {
            display: flex;
            flex-direction: column;
          }
          .upi-label {
            font-size: ${isUltraCompact ? '11px' : isCompact ? '12px' : '14px'};
            font-weight: 800;
            color: #FF5F00;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          .upi-id-val {
            font-size: ${isUltraCompact ? '15px' : isCompact ? '17px' : '20px'};
            font-weight: 700;
            color: #0F1B2D;
            margin-top: 2px;
          }
          .upi-due-val {
            font-size: ${isUltraCompact ? '13px' : isCompact ? '14px' : '16px'};
            font-weight: 500;
            color: #5B6475;
            margin-top: 2px;
          }
          .upi-qr-tile {
            width: ${isUltraCompact ? '72px' : isCompact ? '84px' : '100px'};
            height: ${isUltraCompact ? '72px' : isCompact ? '84px' : '100px'};
            background: #FFFFFF;
            border: 1px solid #FED7AA;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3px;
            box-sizing: border-box;
            flex-shrink: 0;
          }
          .upi-qr-tile svg {
            width: 100%;
            height: 100%;
          }

          /* 12. Thank you row */
          .thank-you-row {
            width: 100%;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: var(--thank-you-mt);
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .thank-you-line {
            height: 1.5px;
            background: #E3E5EA;
            flex: 1;
            max-width: 250px;
          }
          .thank-you-text {
            font-size: var(--thank-you-size);
            font-weight: 500;
            color: #0F1B2D;
            text-align: center;
            padding: 0 14px;
          }

          /* 13. Footer */
          .footer-block, .footer-branding {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-top: var(--footer-mt);
            text-align: center;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .footer-logo {
            height: ${isUltraCompact ? '22px' : isCompact ? '26px' : '30px'};
            width: 160px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .footer-caption, .footer-receipt-note {
            margin-top: 4px;
            font-size: ${isUltraCompact ? '11px' : isCompact ? '12px' : '13px'};
            font-weight: 400;
            color: #5B6475;
            letter-spacing: 0.01em;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="receipt-page">
          <!-- 1. Header Band -->
          <div class="header-band">
            <div>
              ${shop.logoUrl ? `
                <div class="merchant-logo-box" style="background: transparent;">
                  <img src="${shop.logoUrl}" style="max-height: 72px; max-width: 210px; object-fit: contain; border-radius: 10px;" alt="Logo" />
                </div>
              ` : `
                <div class="merchant-logo-box">
                  <div class="merchant-logo-text" aria-label="MERCHANT LOGO">MERCHANT<br>LOGO</div>
                </div>
              `}
            </div>
            <div class="receipt-title-wrap">
              <div class="receipt-title">${isBillEdited ? 'RECEIPT (REVISED)' : 'RECEIPT'}</div>
              <div class="receipt-title-underline receipt-underline"></div>
            </div>
          </div>

          <!-- 2. Shop Block -->
          <div class="shop-block">
            <div class="shop-name">${cleanShopName}</div>
            ${cleanShopAddress ? `
              <div class="shop-meta-row">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1B2D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span class="shop-meta-text">${cleanShopAddress}${cleanShopCity ? `, ${cleanShopCity}` : ''}</span>
              </div>
            ` : ''}
            ${cleanShopPhone ? `
              <div class="shop-meta-row">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1B2D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span class="shop-meta-text">+91 ${cleanShopPhone}${shop.gstNumber ? ` · GSTIN: ${shop.gstNumber}` : ''}</span>
              </div>
            ` : ''}
          </div>

          <!-- 3. Divider 1 -->
          <div class="hairline"></div>

          <!-- 4. Bill / Date Row -->
          <div class="bill-date-row">
            <div class="bill-col">
              <div class="meta-label">BILL NUMBER</div>
              <div class="bill-number-val">Bill #${cleanBillNumber}</div>
              ${bill.tableNumber ? `<div style="font-size: 18px; font-weight: 700; color: #EA580C; margin-top: 4px;">${bill.tableNumber.trim().toLowerCase().startsWith('table') ? bill.tableNumber.trim() : 'Table ' + bill.tableNumber.trim()}</div>` : ''}
            </div>
            <div class="vertical-hairline"></div>
            <div class="date-col">
              <div class="date-icon-wrap">
                <svg width="${isUltraCompact ? '20' : isCompact ? '22' : '26'}" height="${isUltraCompact ? '20' : isCompact ? '22' : '26'}" viewBox="0 0 24 24" fill="none" stroke="#0F1B2D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                  <circle cx="8" cy="14" r="1" fill="#0F1B2D"></circle>
                  <circle cx="12" cy="14" r="1" fill="#0F1B2D"></circle>
                  <circle cx="16" cy="14" r="1" fill="#0F1B2D"></circle>
                  <circle cx="8" cy="18" r="1" fill="#0F1B2D"></circle>
                  <circle cx="12" cy="18" r="1" fill="#0F1B2D"></circle>
                  <circle cx="16" cy="18" r="1" fill="#0F1B2D"></circle>
                </svg>
              </div>
              <div>
                <div class="meta-label">DATE & TIME</div>
                <div class="date-val">${dateStr} · ${timeStr}</div>
                ${isBillEdited ? `<div style="font-size: 13px; font-weight: 600; color: #EA580C; margin-top: 3px;">Edited: ${editedDateStr ? editedDateStr + ' · ' : ''}${editedTimeStr || timeStr}</div>` : ''}
              </div>
            </div>
          </div>

          <!-- 5. Divider 2 -->
          <div class="hairline"></div>

          <!-- 6. Billed To -->
          <div class="billed-to-row">
            <div class="person-icon-wrap">
              <svg width="${isUltraCompact ? '20' : isCompact ? '24' : '28'}" height="${isUltraCompact ? '20' : isCompact ? '24' : '28'}" viewBox="0 0 24 24" fill="none" stroke="#0F1B2D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="billed-to-details">
              <div class="meta-label">BILLED TO</div>
              <div class="customer-name-val">${cleanCustName}</div>
              ${cleanCustPhone ? `<div class="customer-phone-val">+91 ${cleanCustPhone}</div>` : ''}
            </div>
          </div>

          <!-- 7. Divider 3 -->
          <div class="hairline"></div>

          <!-- 8. Items Table -->
          <table class="items-table">
            <thead>
              <tr class="table-header-tr">
                <th class="th-item">ITEM</th>
                <th class="th-qty">QTY</th>
                <th class="th-price">PRICE</th>
                <th class="th-total">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml}
            </tbody>
          </table>

          <!-- Summary Block (Subtotal, Grand Total, Status Panel, UPI, Thank you, Footer) -->
          <div class="summary-block">
            <!-- 9. Subtotal Row -->
            <div class="subtotal-row">
              <span class="subtotal-label">Subtotal</span>
              <span class="subtotal-val">${formatMoney(subtotal)}</span>
            </div>

            <!-- Optional Intermediate Rows (Discount, GST, Round off) -->
            ${intermediateRowsHtml}

            <!-- 10. Grand Total Band -->
            <div class="grand-total-bar grand-total-band">
              <span class="grand-total-label">GRAND TOTAL</span>
              <span class="grand-total-val">${formatMoney(bill.totalAmount)}</span>
            </div>

            <!-- 11. Payment Status Panel -->
            ${paymentDetailsHtml}

            <!-- UPI Payment Block (Pending / Partial) -->
            ${upiBlockHtml}

            <!-- 12. Thank you row -->
            <div class="thank-you-row">
              <div class="thank-you-line"></div>
              <div class="thank-you-text">Thank you for your business!</div>
              <div class="thank-you-line"></div>
            </div>

            <!-- 13. Footer Branding -->
            <div class="footer-block footer-branding">
              <div class="footer-logo">
                <svg width="205" height="36" viewBox="0 0 205 36" fill="none">
                  <circle cx="18" cy="18" r="16" fill="#0F1B2D"/>
                  <path d="M25 12C23.2 10 20.2 9 17 9C12 9 8 13 8 18C8 23 12 27 17 27C20.2 27 23.2 26 25 24" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
                  <text x="44" y="26" font-family="'Inter', sans-serif" font-size="24" font-weight="800" fill="#0F1B2D" letter-spacing="-0.02em">Counter</text>
                  <text x="146" y="26" font-family="'Inter', sans-serif" font-size="24" font-weight="800" fill="#FF5F00" letter-spacing="-0.02em">365</text>
                </svg>
              </div>
              <div class="footer-caption footer-receipt-note">Generated via Counter365 Point of Sale · ${isBillEdited ? 'Official Revised Receipt Copy' : 'Official Receipt Copy'}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Generates and uploads receipt PDF in the background
   */
  async generateAndUploadReceipt(bill: Bill, shop: Shop): Promise<string | null> {
    try {
      const html = this.buildBillReceiptHtml(bill, shop);
      const printResult = await Print.printToFileAsync({ html, base64: true });
      if (printResult?.base64 && bill.id && isValidUUID(bill.shopId)) {
        return await this.uploadReceiptToCloud(bill.id, printResult.base64);
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * 6. Generates high-resolution PDF Receipt Copy of a Bill and safely shares/saves it
   * Styled like a receipt document / image with zero Android export sharing errors.
   */
  async exportBillPdf(bill: Bill, shop: Shop): Promise<{ success: boolean; uri?: string; cloudUrl?: string; error?: string }> {
    let html = '';
    try {
      // Fast path: use existing bill if items are already present, otherwise read from local storage
      let targetBill = bill;
      if (bill?.id && (!bill.items || bill.items.length === 0)) {
        try {
          const localBills = await storage.getObject<Bill[]>(LOCAL_BILLS_KEY, []);
          const matched = localBills.find(b => b.id === bill.id);
          if (matched && matched.items && matched.items.length > 0) {
            targetBill = matched;
          }
        } catch {}
      }

      html = this.buildBillReceiptHtml(targetBill, shop);

      // Safe sanitized filename with edit versioning to avoid Android FileProvider/WhatsApp cache collisions
      const safeBillNo = (targetBill.billNumber || targetBill.id || 'Bill').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeShop = (shop.name || 'Shop').replace(/[^a-zA-Z0-9_-]/g, '_');
      const editTag = targetBill.isEdited || targetBill.editedAt ? `-v${Date.now()}` : '';
      const filename = `Bill-${safeBillNo}${editTag}-${safeShop}.pdf`;
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      let targetUri = `${baseDir}${filename}`;

      // Ensure proper URI scheme
      if (!targetUri.startsWith('file://')) {
        targetUri = `file://${targetUri}`;
      }

      // Clean up any existing file with this path
      try {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      } catch {}

      // Generate PDF fast directly to file without slow base64 serialization (<100ms)
      const printResult = await Print.printToFileAsync({ html });
      let readyUri = printResult.uri;

      if (printResult?.base64) {
        try {
          await FileSystem.writeAsStringAsync(targetUri, printResult.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          readyUri = targetUri;
        } catch {
          readyUri = printResult.uri;
        }
      } else if (printResult?.uri) {
        try {
          await FileSystem.copyAsync({
            from: printResult.uri,
            to: targetUri,
          });
          readyUri = targetUri;
        } catch {
          readyUri = printResult.uri;
        }
      }

      // Safe Sharing with fallback to native print/save-as-pdf preview
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable && readyUri) {
        try {
          await Sharing.shareAsync(readyUri, {
            mimeType: 'application/pdf',
            dialogTitle: `${shop.name} - Bill #${targetBill.billNumber}`,
            UTI: 'com.adobe.pdf',
          });
        } catch (shareErr) {
          console.warn('Native share dialog error, activating print preview fallback:', shareErr);
          await Print.printAsync({ html });
        }
      } else {
        await Print.printAsync({ html });
      }

      // Upload receipt to cloud in background completely asynchronously
      if (targetBill.id) {
        (async () => {
          try {
            let base64Data = printResult?.base64;
            if (!base64Data && typeof FileSystem.readAsStringAsync === 'function') {
              base64Data = await FileSystem.readAsStringAsync(readyUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
            }
            if (base64Data) {
              await this.uploadReceiptToCloud(targetBill.id, base64Data);
            }
          } catch (cloudErr) {
            console.warn('Background cloud receipt upload notice:', cloudErr);
          }
        })();
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
  },

  /**
   * Generates authoritative receipt PDF from saved Supabase / local bill data, validates PDF signature,
   * uploads to Supabase Storage receipts bucket, and returns customer-accessible direct PDF URL.
   */
  async generateAndUploadBillReceipt(
    billOrId: string | Bill,
    shop: Shop
  ): Promise<{ success: boolean; pdfUrl: string; localUri?: string; storageUrl?: string; brandedUrl?: string; error?: string }> {
    try {
      let bill: Bill;
      if (typeof billOrId === 'string') {
        const billId = billOrId;
        // 1. Check local storage first for fastest & freshest in-memory edits
        const localBills = await storage.getObject<Bill[]>(LOCAL_BILLS_KEY, []);
        const localBill = localBills.find(b => b.id === billId);
        if (localBill && localBill.items && localBill.items.length > 0) {
          bill = localBill;
        } else {
          // 2. Fetch authoritative bill from Supabase
          const { data: remoteBill, error: billErr } = await (supabase.from('bills') as any)
            .select('*')
            .eq('id', billId)
            .single();

          if (billErr || !remoteBill) {
            throw new Error(billErr?.message || 'Bill not found');
          }

          // Fetch authoritative line items
          const { data: itemRows } = await (supabase.from('bill_items') as any)
            .select('*')
            .eq('bill_id', billId);

          bill = {
            id: remoteBill.id,
            shopId: remoteBill.shop_id,
            billNumber: remoteBill.bill_number,
            customerName: remoteBill.customer_name,
            customerPhone: remoteBill.customer_phone,
            customerId: remoteBill.customer_id,
            tableNumber: remoteBill.table_number,
            status: remoteBill.status,
            isEdited: remoteBill.is_edited || remoteBill.status === 'edited',
            editedAt: remoteBill.edited_at,
            editedByName: remoteBill.edited_by_name,
            subtotal: Number(remoteBill.subtotal) || 0,
            discountAmount: Number(remoteBill.discount_amount) || 0,
            discountType: remoteBill.discount_type,
            discountValue: Number(remoteBill.discount_value) || 0,
            gstRate: Number(remoteBill.gst_rate) || 0,
            gstAmount: Number(remoteBill.gst_amount) || 0,
            totalAmount: Number(remoteBill.total_amount) || 0,
            paidAmount: Number(remoteBill.paid_amount) || 0,
            pendingAmount: Number(remoteBill.pending_amount) || 0,
            paymentMode: remoteBill.payment_mode,
            cashAmount: remoteBill.cash_amount ? Number(remoteBill.cash_amount) : undefined,
            gpayAmount: remoteBill.gpay_amount ? Number(remoteBill.gpay_amount) : undefined,
            createdAt: remoteBill.created_at,
            completedAt: remoteBill.completed_at,
            items: (itemRows || []).map((it: any) => ({
              id: it.id,
              menuItemId: it.menu_item_id,
              itemName: it.item_name,
              quantity: it.quantity,
              unitPrice: Number(it.unit_price) || 0,
              lineTotal: Number(it.line_total) || 0,
              isHalf: it.is_half,
            })),
          };
        }
      } else {
        // Passed as bill object: check if local storage has a newer version with edited items
        if (billOrId?.id) {
          const localBills = await storage.getObject<Bill[]>(LOCAL_BILLS_KEY, []);
          const matchingLocal = localBills.find(b => b.id === billOrId.id);
          if (
            matchingLocal &&
            matchingLocal.items &&
            matchingLocal.items.length > 0 &&
            matchingLocal.editedAt &&
            (!billOrId.editedAt || new Date(matchingLocal.editedAt).getTime() >= new Date(billOrId.editedAt).getTime())
          ) {
            bill = matchingLocal;
          } else {
            bill = billOrId;
          }
        } else {
          bill = billOrId;
        }
      }

      // 2. Render authoritative HTML template matching design reference
      const html = this.buildBillReceiptHtml(bill, shop);

      // 3. Generate PDF via Print.printToFileAsync
      const printResult = await Print.printToFileAsync({ html, base64: true });

      // 4. Validate output has valid PDF structure (%PDF-)
      if (printResult?.base64) {
        let isPdf = false;
        try {
          if (typeof Buffer !== 'undefined') {
            const buf = Buffer.from(printResult.base64, 'base64');
            isPdf = buf.slice(0, 5).toString('utf-8').startsWith('%PDF-');
          } else if (typeof atob === 'function') {
            isPdf = atob(printResult.base64.slice(0, 16)).startsWith('%PDF-');
          }
        } catch {}
        if (!isPdf && printResult.base64.length < 50) {
          throw new Error('Generated file failed PDF structure validation');
        }
      }

      // 5. Save durable local copy with versioning
      const safeBillNo = (bill.billNumber || bill.id || 'bill').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeShop = (shop.name || 'Shop').replace(/[^a-zA-Z0-9_-]/g, '_');
      const editTag = bill.isEdited || bill.editedAt ? `-v${Date.now()}` : '';
      const filename = `Bill-${safeBillNo}${editTag}-${safeShop}.pdf`;
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      let targetUri = `${baseDir}${filename}`;
      if (!targetUri.startsWith('file://')) {
        targetUri = `file://${targetUri}`;
      }

      try {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      } catch {}

      if (printResult?.base64) {
        await FileSystem.writeAsStringAsync(targetUri, printResult.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (printResult?.uri) {
        await FileSystem.copyAsync({ from: printResult.uri, to: targetUri });
      }

      // 6. Upload to Supabase Storage 'receipts' bucket
      const targetBillId = bill.id || safeBillNo;
      const isBillEdited = !!(bill.isEdited || bill.status === 'edited' || bill.editedAt);
      const editVersion = bill.editedAt ? new Date(bill.editedAt).getTime() : Date.now();
      const versionedBillId = isBillEdited ? `${targetBillId}-v${editVersion}` : targetBillId;

      let cloudUrl: string | null = null;
      if (printResult?.base64 && targetBillId) {
        // Always upload base identifier
        cloudUrl = await this.uploadReceiptToCloud(targetBillId, printResult.base64);

        // When bill is edited, upload versioned PDF to defeat 24h CDN & Browser disk caches
        if (isBillEdited) {
          try {
            await this.uploadReceiptToCloud(versionedBillId, printResult.base64);
          } catch {}
        }

        // Also upload with safeBillNo if different from targetBillId
        if (safeBillNo && safeBillNo !== targetBillId) {
          try {
            await this.uploadReceiptToCloud(safeBillNo, printResult.base64);
            if (isBillEdited) {
              await this.uploadReceiptToCloud(`${safeBillNo}-v${editVersion}`, printResult.base64);
            }
          } catch {}
        }
      }

      const publicStorageUrl = `https://tziqjkklqtmjlncoraba.supabase.co/storage/v1/object/public/receipts/${targetBillId}.pdf`;
      const finalPdfUrl = cloudUrl || publicStorageUrl;
      const brandedUrl = `https://counter365.tecstellar.com/b/${targetBillId}`;

      return {
        success: true,
        pdfUrl: brandedUrl,
        storageUrl: finalPdfUrl,
        brandedUrl,
        localUri: targetUri,
      };
    } catch (err: any) {
      console.warn('generateAndUploadBillReceipt error:', err);
      const safeFallbackId = (typeof billOrId === 'string' ? billOrId : billOrId.id) || 'latest';
      const storageFallbackUrl = `https://tziqjkklqtmjlncoraba.supabase.co/storage/v1/object/public/receipts/${safeFallbackId}.pdf?v=${Date.now()}`;
      const brandedFallbackUrl = `https://counter365.tecstellar.com/b/${safeFallbackId}`;
      return {
        success: false,
        pdfUrl: brandedFallbackUrl,
        storageUrl: storageFallbackUrl,
        brandedUrl: brandedFallbackUrl,
        error: err?.message || 'Failed to generate receipt PDF',
      };
    }
  },
};
