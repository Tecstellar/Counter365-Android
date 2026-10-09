import { MonthlyReportData, DayClosingReport, Bill, ExpenseRecord, ShopType } from '../types/models';
import { colors } from '../theme/colors';

export const reportService = {
  /**
   * Generates a 100% real monthly report computed from actual shop bills & expenses
   */
  getMonthlyReport(
    year: number,
    month: number, // 0-indexed: 0 = Jan, 8 = Sep
    bills: Bill[] = [],
    expenses: ExpenseRecord[] = []
  ): MonthlyReportData {
    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const dim = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
    const currentDay = now.getDate();
    const daysCount = isCurrentMonth ? Math.min(currentDay, dim) : dim;

    // Filter bills and expenses belonging to this specific month & year
    const monthBills = bills.filter(b => {
      if (b.isDeleted || b.status === 'deleted' || b.status === 'cancelled') return false;
      const d = new Date(b.createdAt);
      const s = b.settledAt ? new Date(b.settledAt) : null;
      const createdInMonth = d.getFullYear() === year && d.getMonth() === month;
      const settledInMonth = s ? (s.getFullYear() === year && s.getMonth() === month) : false;
      const collectionsInMonth = b.collections && b.collections.some(c => {
        const cd = new Date(c.paidAt);
        return cd.getFullYear() === year && cd.getMonth() === month;
      });
      return (createdInMonth || settledInMonth || collectionsInMonth) && (b.status === 'completed' || b.status === 'edited');
    });

    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    // Compute daily metrics from real records
    const days: MonthlyReportData['days'] = [];

    for (let d = 1; d <= daysCount; d++) {
      const dow = new Date(year, month, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isToday = isCurrentMonth && d === currentDay;

      // Filter bills for day d
      const dayBills = monthBills.filter(b => {
        const bd = new Date(b.createdAt);
        const sd = b.settledAt ? new Date(b.settledAt) : null;
        const createdOnDay = bd.getFullYear() === year && bd.getMonth() === month && bd.getDate() === d;
        const settledOnDay = sd ? (sd.getFullYear() === year && sd.getMonth() === month && sd.getDate() === d) : false;
        const collectionsOnDay = b.collections && b.collections.some(c => {
          const cd = new Date(c.paidAt);
          return cd.getFullYear() === year && cd.getMonth() === month && cd.getDate() === d;
        });
        return createdOnDay || settledOnDay || collectionsOnDay;
      });

      // Filter expenses for day d
      const dayExpenses = monthExpenses.filter(e => {
        const ed = new Date(e.expenseDate);
        return ed.getDate() === d;
      });

      const daySales = dayBills.reduce((sum, b) => {
        if (b.collections && b.collections.length > 0) {
          const colSum = b.collections.reduce((cSum, c) => {
            const cd = new Date(c.paidAt);
            if (cd.getFullYear() === year && cd.getMonth() === month && cd.getDate() === d) {
              return cSum + c.amount;
            }
            return cSum;
          }, 0);
          return sum + colSum;
        }

        const createdOnDay = new Date(b.createdAt).getDate() === d && new Date(b.createdAt).getMonth() === month;
        const settledOnDay = b.settledAt ? (new Date(b.settledAt).getDate() === d && new Date(b.settledAt).getMonth() === month) : false;
        const initialPaid = b.initialPaidAmount !== undefined
          ? b.initialPaidAmount
          : (b.paymentMode === 'Pending' && !b.settledAt ? 0 : (b.settledAt && b.paymentMode === 'Cash' && b.cashAmount === undefined ? 0 : (b.paidAmount || 0)));
        const settledPaid = b.settledAt ? Math.max(0, b.totalAmount - initialPaid) : 0;
        let amt = 0;
        if (createdOnDay) amt += initialPaid;
        if (settledOnDay) amt += settledPaid;
        return sum + amt;
      }, 0);
      const dayExp = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
      const dayProfit = daySales - dayExp;

      days.push({
        dayNumber: d,
        dateFormatted: `${SHORT_MONTHS[month]} ${d}`,
        dayOfWeek: isToday ? 'today' : DOW[dow],
        isWeekend,
        isToday,
        sales: daySales,
        expenses: dayExp,
        profit: dayProfit,
      });
    }

    const totalSales = monthBills.reduce((sum, b) => {
      if (b.collections && b.collections.length > 0) {
        const colSum = b.collections.reduce((cSum, c) => {
          const cd = new Date(c.paidAt);
          return (cd.getFullYear() === year && cd.getMonth() === month) ? cSum + c.amount : cSum;
        }, 0);
        return sum + colSum;
      }
      const paid = b.paidAmount !== undefined ? b.paidAmount : (b.paymentMode === 'Pending' ? 0 : b.totalAmount);
      return sum + paid;
    }, 0);
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalSales - totalExpenses;
    const profitMarginPct = totalSales > 0 ? Math.round((profit / totalSales) * 100) : 0;

    // Best day
    const nonZeroDays = days.filter(r => r.sales > 0 || r.profit > 0);
    const bestDayRow = nonZeroDays.length > 0
      ? nonZeroDays.reduce((best, r) => (r.profit > best.profit ? r : best), nonZeroDays[0])
      : { dayNumber: 1, dayOfWeek: 'Thu', profit: 0 };

    // Weekly breakdown from actual day buckets
    const weeks: MonthlyReportData['weeks'] = [];
    if (days.length > 0) {
      for (let i = 0; i < days.length; i += 7) {
        const chunk = days.slice(i, i + 7);
        const ws = chunk.reduce((sum, r) => sum + r.sales, 0);
        const we = chunk.reduce((sum, r) => sum + r.expenses, 0);
        weeks.push({
          name: `Week ${weeks.length + 1}`,
          detail: `${chunk[0].dayNumber}–${chunk[chunk.length - 1].dayNumber} ${SHORT_MONTHS[month]}`,
          sales: ws,
          expenses: we,
          profit: ws - we,
          salePct: totalSales > 0 ? `${Math.min(74, Math.round((ws / totalSales) * 74))}%` : '0%',
          expPct: totalSales > 0 ? `${Math.min(74, Math.round((we / totalSales) * 74))}%` : '0%',
        });
      }
    }

    // Payment modes breakdown from real bills
    let cashAmt = 0;
    let upiAmt = 0;
    let pendingAmt = 0;

    monthBills.forEach(b => {
      if (b.paymentMode === 'Cash') {
        cashAmt += (b.paidAmount !== undefined ? b.paidAmount : b.totalAmount);
      } else if (b.paymentMode === 'GPay') {
        upiAmt += (b.paidAmount !== undefined ? b.paidAmount : b.totalAmount);
      } else if (b.paymentMode === 'Cash + GPay') {
        cashAmt += (b.cashAmount || 0);
        upiAmt += (b.gpayAmount || 0);
      } else if (b.paymentMode === 'Partial Pay') {
        cashAmt += (b.paidAmount || 0);
        pendingAmt += (b.pendingAmount || 0);
      } else if (b.paymentMode === 'Pending') {
        cashAmt += (b.paidAmount || 0);
        pendingAmt += (b.pendingAmount !== undefined ? b.pendingAmount : b.totalAmount);
      }
    });

    const paymentModes = [
      {
        name: 'Cash',
        amount: cashAmt,
        pct: totalSales > 0 ? `${Math.round((cashAmt / totalSales) * 100)}%` : '0%',
        color: colors.accent900,
      },
      {
        name: 'GPay / UPI',
        amount: upiAmt,
        pct: totalSales > 0 ? `${Math.round((upiAmt / totalSales) * 100)}%` : '0%',
        color: colors.accent700,
      },
      {
        name: 'Pending',
        amount: pendingAmt,
        pct: totalSales > 0 ? `${Math.round((pendingAmt / totalSales) * 100)}%` : '0%',
        color: colors.accent300,
      },
    ];

    // Real Top Items ranking grouped from actual bill items
    const itemMap = new Map<string, { name: string; quantity: number; amount: number }>();
    monthBills.forEach(b => {
      (b.items || []).forEach(it => {
        const existing = itemMap.get(it.itemName) || { name: it.itemName, quantity: 0, amount: 0 };
        existing.quantity += it.quantity;
        existing.amount += it.lineTotal;
        itemMap.set(it.itemName, existing);
      });
    });

    const topItemsList = Array.from(itemMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const maxTopAmt = topItemsList.length > 0 ? topItemsList[0].amount : 1;
    const formattedTopItems = topItemsList.map((item, i) => ({
      rank: i + 1,
      name: item.name,
      quantity: item.quantity,
      amount: item.amount,
      pct: `${Math.round((item.amount / maxTopAmt) * 100)}%`,
    }));

    const rangeLabel = isCurrentMonth
      ? `1–${currentDay} ${SHORT_MONTHS[month]} · Month to date`
      : `1–${dim} ${SHORT_MONTHS[month]} ${year}`;

    return {
      month,
      year,
      monthLabel: `${MONTH_NAMES[month]} ${year}`,
      monthShort: SHORT_MONTHS[month],
      rangeLabel,
      totalSales,
      totalExpenses,
      profit,
      profitMarginPct,
      billsCount: monthBills.length,
      bestDay: {
        day: bestDayRow.dayNumber,
        dow: bestDayRow.dayOfWeek,
        profit: bestDayRow.profit,
      },
      weeks,
      paymentModes,
      days,
      topItems: formattedTopItems,
    };
  },

  /**
   * Generates a 100% real daily closing report computed from today's real bills and expenses
   */
  getDayClosingReport(
    shopTitle: string,
    shopAddress: string,
    phone: string,
    shopType: ShopType,
    todayExpenses: number = 0,
    todayBills: Bill[] = []
  ): DayClosingReport {
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter out cancelled and deleted bills
    const activeTodayBills = todayBills.filter(
      b => !b.isDeleted && b.status !== 'deleted' && b.status !== 'cancelled'
    );

    const todaySales = activeTodayBills.reduce((sum, b) => {
      if (b.collections && b.collections.length > 0) {
        const todayCols = b.collections.reduce((cSum, c) => {
          if (c.paidAt && c.paidAt.startsWith(todayStr)) {
            return cSum + c.amount;
          }
          return cSum;
        }, 0);
        return sum + todayCols;
      }
      const paid = b.paidAmount !== undefined ? b.paidAmount : (b.paymentMode === 'Pending' ? 0 : b.totalAmount);
      return sum + paid;
    }, 0);

    let cashSales = 0;
    let gpaySales = 0;
    let pendingSales = 0;

    activeTodayBills.forEach(b => {
      if (b.collections && b.collections.length > 0) {
        b.collections.forEach(c => {
          if (c.paidAt && c.paidAt.startsWith(todayStr)) {
            if (c.paymentMode === 'GPay') {
              gpaySales += c.amount;
            } else {
              cashSales += c.amount;
            }
          }
        });
        if (b.createdAt && b.createdAt.startsWith(todayStr) && Number(b.pendingAmount || 0) > 0) {
          pendingSales += b.pendingAmount;
        }
      } else {
        const paid = b.paidAmount !== undefined ? b.paidAmount : (b.paymentMode === 'Pending' ? 0 : b.totalAmount);
        if (b.paymentMode === 'GPay') {
          gpaySales += paid;
        } else if (b.paymentMode === 'Cash + GPay') {
          cashSales += (b.cashAmount || 0);
          gpaySales += (b.gpayAmount || 0);
        } else if (b.paymentMode === 'Partial Pay') {
          cashSales += (b.paidAmount || 0);
          pendingSales += (b.pendingAmount || 0);
        } else if (b.paymentMode === 'Pending') {
          cashSales += (b.paidAmount || 0);
          pendingSales += (b.pendingAmount !== undefined ? b.pendingAmount : b.totalAmount);
        } else {
          cashSales += paid;
        }
      }
    });

    const netProfit = todaySales - todayExpenses;
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return {
      date: dateFormatted,
      shopTitle: shopTitle || 'Counter365 Shop',
      shopAddress: shopAddress || '',
      phone: phone || '',
      totalSales: todaySales,
      cashSales,
      gpaySales,
      pendingSales,
      totalExpenses: todayExpenses,
      netProfit,
      billsCount: todayBills.length,
      hoursNote: 'Full business day summary',
    };
  }
};
