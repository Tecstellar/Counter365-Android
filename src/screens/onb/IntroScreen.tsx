import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, shadows } from '../../theme';
import { AppButton } from '../../components/common/AppButton';

const INTRO_SLIDES = [
  {
    tag: 'THE COUNTER',
    num: '01',
    image: require('../../../assets/images/fast_billing.jpg'),
    shot: 'A tea shop owner billing an order on his phone at the counter',
    title: 'Three taps, and the bill is done',
    body: 'Tap what the customer ordered, pick cash, GPay or pending, and move on. No typing prices, no waiting for the machine — it keeps pace with a morning rush.',
  },
  {
    tag: 'THE MONEY',
    num: '02',
    image: require('../../../assets/images/business_insights.jpg'),
    shot: 'A cash box and the day total on the phone, side by side at the counter',
    title: 'Know what you actually made',
    body: 'Sales, expenses and profit for the day, week, month or year. Peak hours, best-selling items and which payment mode is growing — all from the bills you already take.',
  },
  {
    tag: 'THE PENDING',
    num: '03',
    image: require('../../../assets/images/offline_shield.jpg'),
    shot: 'A paper pending-payments register open beside the phone',
    title: 'No more notebook for payment pending',
    body: 'Save a pending bill against a name and number, and the app remembers what is owed and for how long. Send a plain list of the unpaid bills when it is time to ask.',
  },
  {
    tag: 'THE PAPERWORK',
    num: '04',
    image: require('../../../assets/images/fast_billing.jpg'),
    shot: 'A bill arriving on a customer WhatsApp thread',
    title: 'Send it, or print it',
    body: 'Bills and day reports go out on WhatsApp as a clean receipt — no printer needed. Keep a thermal printer if you prefer, and add your helpers with only the access you choose.',
  },
];

interface IntroScreenProps {
  onComplete: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slide = INTRO_SLIDES[currentSlide];

  const handleNext = () => {
    if (currentSlide === INTRO_SLIDES.length - 1) {
      onComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 16);

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Image
          source={require('../../../assets/counterpro_logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={onComplete} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Photo Card with Duotone Frame */}
        <View style={styles.photoContainer}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />

          <Image source={slide.image} style={styles.image} resizeMode="cover" />

          {/* Badge overlays */}
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{slide.tag}</Text>
          </View>
          <View style={styles.numBadge}>
            <Text style={styles.numText}>{slide.num}</Text>
          </View>
        </View>

        {/* Text Details */}
        <View style={styles.textDetails}>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideBody}>{slide.body}</Text>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        {/* Dots */}
        <View style={styles.dots}>
          {INTRO_SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setCurrentSlide(i)}
              style={[
                styles.dot,
                i === currentSlide ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        <AppButton
          title={currentSlide === 3 ? 'Get started' : 'Next'}
          variant="primary"
          onPress={handleNext}
          style={styles.ctaButton}
        />
      </View>

      <Text style={styles.swipeHint}>SWIPE LEFT</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  logoImage: {
    width: 140,
    height: 38,
  },
  skipButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFECE6',
    ...shadows.sm,
  },
  skipText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 22,
  },
  photoContainer: {
    position: 'relative',
    aspectRatio: 4 / 3,
    borderWidth: 1,
    borderColor: '#EFECE6',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...shadows.card,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  corner: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: '#FD5E03',
    zIndex: 2,
  },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
  tagBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#111111',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    zIndex: 3,
  },
  tagText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#FFFFFF',
  },
  numBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    zIndex: 3,
    ...shadows.sm,
  },
  numText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  textDetails: {
    gap: 10,
  },
  slideTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    color: colors.text,
  },
  slideBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    fontFamily: typography.fonts.body,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#FD5E03',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#E5E0D8',
  },
  ctaButton: {
    marginLeft: 'auto',
    minHeight: 50,
    paddingHorizontal: 28,
    borderRadius: 16,
  },
  swipeHint: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingBottom: 10,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
  },
});
