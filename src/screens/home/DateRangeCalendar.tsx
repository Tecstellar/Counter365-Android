import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';

interface DateRangeCalendarProps {
  startDate: Date;
  endDate: Date;
  onApplyRange: (start: Date, end: Date) => void;
  onClose?: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  startDate,
  endDate,
  onApplyRange,
  onClose,
}) => {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [currentMonth, setCurrentMonth] = useState(startDate.getMonth());
  const [currentYear, setCurrentYear] = useState(startDate.getFullYear());
  const [rangeStart, setRangeStart] = useState<Date>(startDate);
  const [rangeEnd, setRangeEnd] = useState<Date>(endDate);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Quick Presets
  const applyPreset = (daysBack: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    setRangeStart(start);
    setRangeEnd(end);
    setIsSelectingEnd(false);
    onApplyRange(start, end);
  };

  const applyThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    setRangeStart(start);
    setRangeEnd(end);
    setIsSelectingEnd(false);
    onApplyRange(start, end);
  };

  // Day click handler
  const handleDatePress = (day: number) => {
    const clickedDate = new Date(currentYear, currentMonth, day);
    clickedDate.setHours(0, 0, 0, 0);

    if (!isSelectingEnd) {
      // First click: select start date (dot 1)
      setRangeStart(clickedDate);
      setRangeEnd(clickedDate);
      setIsSelectingEnd(true);
    } else {
      // Second click: complete range (dot 2)
      if (clickedDate < rangeStart) {
        setRangeEnd(rangeStart);
        setRangeStart(clickedDate);
      } else {
        const endWithTime = new Date(clickedDate);
        endWithTime.setHours(23, 59, 59, 999);
        setRangeEnd(endWithTime);
      }
      setIsSelectingEnd(false);
    }
  };

  // Helper date comparisons
  const isSameDay = (d1: Date, year: number, month: number, day: number) => {
    return (
      d1.getFullYear() === year &&
      d1.getMonth() === month &&
      d1.getDate() === day
    );
  };

  const isDayInRange = (year: number, month: number, day: number) => {
    const d = new Date(year, month, day, 12, 0, 0, 0).getTime();
    const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0, 0).getTime();
    const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59, 999).getTime();
    return d >= start && d <= end;
  };

  // Build grid days
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday
  const today = new Date();

  const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
  const gridCells = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - firstDayIndex + 1;
    if (dayNumber > 0 && dayNumber <= daysInMonth) {
      gridCells.push(dayNumber);
    } else {
      gridCells.push(null);
    }
  }

  const formatDisplayDate = (d: Date) => {
    return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const hasFullRange = rangeStart.getTime() !== rangeEnd.getTime();

  return (
    <View style={styles.calendarCard}>
      {/* Active Range Header */}
      <View style={styles.rangeHeaderBox}>
        <View style={styles.rangeInfo}>
          <Text style={styles.rangeKicker}>CUSTOM DATE RANGE</Text>
          <Text style={styles.rangeLabel}>
            {formatDisplayDate(rangeStart)}  →  {formatDisplayDate(rangeEnd)}
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Presets Row */}
      <View style={styles.presetRow}>
        <TouchableOpacity
          onPress={() => applyPreset(7)}
          style={styles.presetPill}
        >
          <Text style={styles.presetPillText}>Last 7 Days</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => applyPreset(14)}
          style={styles.presetPill}
        >
          <Text style={styles.presetPillText}>Last 14 Days</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => applyPreset(30)}
          style={styles.presetPill}
        >
          <Text style={styles.presetPillText}>Last 30 Days</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={applyThisMonth}
          style={styles.presetPill}
        >
          <Text style={styles.presetPillText}>This Month</Text>
        </TouchableOpacity>
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNavRow}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.monthTitle}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </Text>

        <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Days of Week Header */}
      <View style={styles.weekDaysHeader}>
        {DAY_LABELS.map((label, idx) => (
          <View key={idx} style={styles.weekDayCol}>
            <Text style={styles.weekDayText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid with Snake Range Ribbon */}
      <View style={styles.gridContainer}>
        {gridCells.map((day, cellIndex) => {
          if (day === null) {
            return <View key={cellIndex} style={styles.cellWrapper} />;
          }

          const isStart = isSameDay(rangeStart, currentYear, currentMonth, day);
          const isEnd = isSameDay(rangeEnd, currentYear, currentMonth, day);
          const inRange = isDayInRange(currentYear, currentMonth, day);
          const isCurrentToday = isSameDay(today, currentYear, currentMonth, day);
          const isEndpoint = isStart || isEnd;

          // Snake ribbon connectors:
          // Left ribbon shows if this cell is in range and not start (or start after end)
          const showLeftRibbon = hasFullRange && inRange && !isStart;
          // Right ribbon shows if this cell is in range and not end
          const showRightRibbon = hasFullRange && inRange && !isEnd;

          return (
            <TouchableOpacity
              key={cellIndex}
              activeOpacity={0.7}
              onPress={() => handleDatePress(day)}
              style={styles.cellWrapper}
            >
              {/* Snake Ribbon Track connecting days */}
              {inRange && hasFullRange && (
                <View
                  style={[
                    styles.snakeRibbon,
                    showLeftRibbon && styles.snakeLeft,
                    showRightRibbon && styles.snakeRight,
                    !showLeftRibbon && styles.snakeStartEdge,
                    !showRightRibbon && styles.snakeEndEdge,
                  ]}
                />
              )}

              {/* Day Button Dot */}
              <View
                style={[
                  styles.dayDot,
                  isEndpoint && styles.dayDotSelected,
                  !isEndpoint && isCurrentToday && styles.dayDotToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isEndpoint && styles.dayTextSelected,
                    !isEndpoint && inRange && styles.dayTextInRange,
                    !isEndpoint && isCurrentToday && styles.dayTextToday,
                  ]}
                >
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selection Helper Message */}
      <View style={styles.helperRow}>
        <Ionicons
          name={isSelectingEnd ? "calendar-outline" : "checkmark-circle"}
          size={14}
          color={isSelectingEnd ? colors.accent : "#16A34A"}
        />
        <Text style={styles.helperText}>
          {isSelectingEnd
            ? 'Tap a second date to complete the range ribbon'
            : 'Range selected — tap Apply Filter to update'}
        </Text>
      </View>

      {/* Apply Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onApplyRange(rangeStart, rangeEnd)}
        style={styles.applyBtn}
      >
        <Text style={styles.applyBtnText}>Apply Filter</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme, isDark: boolean) => {
  const colors = theme.colors;
  return StyleSheet.create({
    calendarCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginVertical: 6,
      ...shadows.card,
    },
    rangeHeaderBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 10,
      marginBottom: 10,
    },
    rangeInfo: {
      flex: 1,
    },
    rangeKicker: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      letterSpacing: 1.1,
      color: colors.accent,
      fontWeight: '700',
    },
    rangeLabel: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FAF7F2',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    closeBtnText: {
      fontSize: 16,
      color: colors.textMuted,
      fontWeight: '700',
    },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    presetPill: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FAF7F2',
    },
    presetPillText: {
      fontSize: 11.5,
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.text,
    },
    monthNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
      marginBottom: 8,
    },
    monthNavBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#FAF7F2',
    },
    monthNavArrow: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      lineHeight: 22,
    },
    monthTitle: {
      fontFamily: typography.fonts.heading,
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    weekDaysHeader: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 6,
      marginBottom: 4,
    },
    weekDayCol: {
      flex: 1,
      alignItems: 'center',
    },
    weekDayText: {
      fontFamily: typography.fonts.heading,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 2,
    },
    cellWrapper: {
      width: '14.28%',
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      marginVertical: 1,
    },
    snakeRibbon: {
      position: 'absolute',
      top: 5,
      bottom: 5,
      backgroundColor: isDark ? 'rgba(255, 95, 0, 0.22)' : 'rgba(253, 94, 3, 0.12)',
      height: 32,
    },
    snakeLeft: {
      left: 0,
      right: '50%',
    },
    snakeRight: {
      left: '50%',
      right: 0,
    },
    snakeStartEdge: {
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
      left: '10%',
    },
    snakeEndEdge: {
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      right: '10%',
    },
    dayDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    dayDotSelected: {
      backgroundColor: colors.accent,
      ...shadows.sm,
    },
    dayDotToday: {
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
    dayText: {
      fontFamily: typography.fonts.body,
      fontSize: 13,
      color: colors.text,
    },
    dayTextSelected: {
      fontFamily: typography.fonts.heading,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    dayTextInRange: {
      fontFamily: typography.fonts.heading,
      fontWeight: '700',
      color: colors.accent,
    },
    dayTextToday: {
      fontWeight: '700',
      color: colors.accent,
    },
    helperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    helperText: {
      fontSize: 11.5,
      color: colors.textSecondary,
      fontFamily: typography.fonts.heading,
      fontWeight: '600',
    },
    applyBtn: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
      ...shadows.card,
    },
    applyBtnText: {
      fontFamily: typography.fonts.heading,
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });
};
