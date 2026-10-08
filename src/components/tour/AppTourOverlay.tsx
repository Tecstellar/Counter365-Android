import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { colors, typography, radii, spacing, shadows } from '../../theme';
import { AppButton } from '../common/AppButton';

export interface TourStep {
  route: string;
  sales?: string;
  kicker: string;
  title: string;
  body: string;
  hint: string;
  cta: string;
  open?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    route: 'home',
    kicker: '1 / 9 — YOUR SHOP',
    title: 'This screen is your day',
    body: 'Sale, expense, profit and pending sit at the top and change with every bill you take. Switch day, week, month or year with the row above them.',
    hint: 'The three tabs at the bottom are the whole app: Home, Sales, Account.',
    cta: 'Next',
  },
  {
    route: 'sales',
    sales: 'editor',
    kicker: '2 / 9 — CATEGORIES',
    open: 'cat',
    title: 'First, group what you sell',
    body: 'A category is a tab on your billing screen — Tea & Coffee, Snacks, Cold. Name it here and it appears on the counter. This form opens from “+ New category” at the foot of the menu.',
    hint: 'A category becomes real once it has its first item in it.',
    cta: 'Next',
  },
  {
    route: 'sales',
    sales: 'editor',
    kicker: '3 / 9 — ITEMS',
    open: 'item',
    title: 'Add your items and prices',
    body: 'Name, full price, and a half price if you sell half portions. Pick the category, mark it a favourite to keep it in the first tiles, and switch off “available today” when it runs out.',
    hint: 'Tap any item in the menu list later to change its price — no need to start over.',
    cta: 'Next',
  },
  {
    route: 'sales',
    sales: 'menu',
    kicker: '4 / 9 — BILLING',
    title: 'Billing is just tapping',
    body: 'Tap a tile to add one full portion. Hold the tile for a half. Tap the same tile again for a second one — the count shows on the corner.',
    hint: 'Use the category pills or search items to find and add any dish straight to the bill.',
    cta: 'Next',
  },
  {
    route: 'sales',
    sales: 'bill',
    kicker: '5 / 9 — PAYMENT',
    title: 'Cash, GPay or pending',
    body: 'The green bar shows the total — tap Bill to open it, fix quantities with − and +, then choose how they paid. Save & share sends the bill to the customer on WhatsApp.',
    hint: 'Choosing Pending asks for a name and number — that is what lets you remind them later.',
    cta: 'Next',
  },
  {
    route: 'pending',
    kicker: '6 / 9 — PENDING',
    title: 'Every unpaid bill in one place',
    body: 'Each customer shows what they owe and which bills it came from. Call them, open their contact, or send a plain list of the unpaid bills with Remind. Mark paid when the money comes in.',
    hint: 'Skip the number while billing and the amount still counts — but you cannot remind them.',
    cta: 'Next',
  },
  {
    route: 'contacts',
    kicker: '7 / 9 — CONTACTS',
    title: 'Customers and vendors',
    body: 'Your regulars build up here from the bills you take, with anyone who owes you marked Pending. The Vendors tab is for your milk, gas and supply contacts.',
    hint: 'Add a vendor once and their purchases are easier to log as expenses.',
    cta: 'Next',
  },
  {
    route: 'reports',
    kicker: '8 / 9 — REPORTS',
    title: 'Download any month',
    body: 'Pick the month and year, then read the summary — total sale, total expense, profit — or the day-wise tab for every single day. Top 10 items shows what actually sells.',
    hint: 'Export as PDF or Excel, or send it to your own WhatsApp for your records.',
    cta: 'Next',
  },
  {
    route: 'home',
    kicker: 'READY',
    title: 'That is the whole app',
    body: 'Take bills from Sales, watch the day here, and download the month when you need it. Add your helpers from Account and choose what each one can see.',
    hint: 'Open this guide again any time from the menu at the top left.',
    cta: 'Start billing',
  },
];

interface AppTourOverlayProps {
  currentStepIndex: number | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export const AppTourOverlay: React.FC<AppTourOverlayProps> = ({
  currentStepIndex,
  onNext,
  onBack,
  onSkip,
}) => {
  if (currentStepIndex === null || currentStepIndex < 0 || currentStepIndex >= TOUR_STEPS.length) {
    return null;
  }

  const step = TOUR_STEPS[currentStepIndex];

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        {/* Scrim click advances */}
        <TouchableOpacity activeOpacity={1} onPress={onNext} style={styles.backdrop} />

        {/* Tour Card */}
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.kicker}>{step.kicker}</Text>
            <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          {/* Hint Box */}
          <View style={styles.hintBox}>
            <Text style={styles.hintIcon}>ⓘ</Text>
            <Text style={styles.hintText}>{step.hint}</Text>
          </View>

          {/* Controls Footer */}
          <View style={styles.controls}>
            {/* Dots */}
            <View style={styles.dots}>
              {TOUR_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentStepIndex && styles.activeDot,
                  ]}
                />
              ))}
            </View>

            {/* Back Button */}
            {currentStepIndex > 0 && (
              <AppButton
                title="Back"
                variant="secondary"
                onPress={onBack}
                style={styles.backBtn}
              />
            )}

            {/* Next / CTA Button */}
            <AppButton
              title={step.cta}
              variant="primary"
              onPress={onNext}
              style={styles.nextBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    paddingBottom: 24,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay62,
  },
  card: {
    backgroundColor: colors.neutral100,
    borderRadius: radii.lg,
    padding: spacing.xxxl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.sm,
    letterSpacing: 1.4,
    color: colors.accent800,
    fontWeight: '700',
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  skipText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4,
    color: colors.text,
    lineHeight: 25,
  },
  body: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent100,
    borderRadius: radii.md,
    padding: 10,
    gap: 8,
  },
  hintIcon: {
    color: colors.accent800,
    fontSize: 14,
  },
  hintText: {
    flex: 1,
    fontSize: typography.sizes.sub,
    color: colors.accent800,
    fontFamily: typography.fonts.body,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 5,
    borderRadius: 2,
    backgroundColor: 'rgba(29, 31, 32, 0.16)',
  },
  activeDot: {
    width: 16,
    backgroundColor: colors.accent700,
  },
  backBtn: {
    marginLeft: 'auto',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  nextBtn: {
    marginLeft: 'auto',
    minHeight: 44,
    paddingHorizontal: 20,
  },
});
