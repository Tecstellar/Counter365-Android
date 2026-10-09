import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
  Animated,
  PanResponder,
  AccessibilityInfo,
  DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { colors, useTheme } from '../../theme';
import { ProtoIcon } from '../../components/common/ProtoIcon';
import { AuthBackgroundGlows } from '../../components/common/AuthBackgroundGlows';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SlideData {
  lb: string;
  num: string;
  titlePrefix?: string;
  titleEm: string;
  titleSuffix?: string;
  body: string;
  image: any;
  imgPositionLeft?: DimensionValue;
  chips: Array<{
    type: 'counter' | 'filter' | 'pending' | 'receipt';
    num?: string;
    text: string;
    active?: boolean;
    avatar?: string;
    sub?: string;
    amount?: string;
    icon?: 'wa' | 'prn';
  }>;
}

const ONB_SLIDES: SlideData[] = [
  {
    lb: 'The Counter',
    num: '01',
    titleEm: 'Three taps,',
    titleSuffix: ' and the bill is done',
    body: 'Tap what the customer ordered, pick cash, GPay or pending, and move on. No typing prices, no waiting for the machine — it keeps pace with a morning rush.',
    image: require('../../../assets/onboarding_photo_1.jpg'),
    chips: [
      { type: 'counter', num: '1', text: 'Tap items' },
      { type: 'counter', num: '2', text: 'Pick payment' },
      { type: 'counter', num: '3', text: 'Done', active: true },
    ],
  },
  {
    lb: 'The Money',
    num: '02',
    titlePrefix: 'Know what you ',
    titleEm: 'actually made',
    body: 'Sales, expenses and profit for the day, week, month or year. Peak hours, best-selling items and which payment mode is growing — all from the bills you already take.',
    image: require('../../../assets/onboarding_photo_2.jpg'),
    chips: [
      { type: 'filter', text: 'Day', active: true },
      { type: 'filter', text: 'Week' },
      { type: 'filter', text: 'Month' },
      { type: 'filter', text: 'Year' },
    ],
  },
  {
    lb: 'The Pending',
    num: '03',
    titlePrefix: 'No more ',
    titleEm: 'notebook',
    titleSuffix: ' for payment pending',
    body: 'Save a pending bill against a name and number, and the app remembers what is owed and for how long. Send a plain list of the unpaid bills when it is time to ask.',
    image: require('../../../assets/onboarding_photo_3.jpg'),
    chips: [
      {
        type: 'pending',
        text: 'Panda 🐼❤️',
        avatar: 'P',
        sub: 'Due today',
        amount: '₹10',
        active: false,
      },
    ],
  },
  {
    lb: 'The Paperwork',
    num: '04',
    titlePrefix: 'Send it, or ',
    titleEm: 'print it',
    body: 'Bills and day reports go out on WhatsApp as a clean receipt — no printer needed. Keep a thermal printer if you prefer, and add your helpers with only the access you choose.',
    image: require('../../../assets/onboarding_photo_1.jpg'),
    imgPositionLeft: '-20%',
    chips: [
      { type: 'receipt', icon: 'wa', text: 'WhatsApp receipt' },
      { type: 'receipt', icon: 'prn', text: 'Thermal print' },
    ],
  },
];

interface IntroScreenProps {
  onComplete: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animation values
  const scrollX = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-130)).current;
  const swipeHintAnim = useRef(new Animated.Value(0)).current;

  // Slide entrance animation values
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const bodyTranslateY = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(1)).current;
  const chipsScale = useRef(new Animated.Value(1)).current;
  const chipsOpacity = useRef(new Animated.Value(1)).current;

  // Check accessibility reduce motion
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      setReduceMotion(enabled);
    });
  }, []);

  // Shimmer loop on primary button
  useEffect(() => {
    if (reduceMotion) return;
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 130,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.delay(1900),
        Animated.timing(shimmerAnim, {
          toValue: -130,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [reduceMotion]);

  // Swipe hint pulse animation
  useEffect(() => {
    if (reduceMotion) return;
    const hintLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(swipeHintAnim, {
          toValue: 5,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(swipeHintAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    hintLoop.start();
    return () => hintLoop.stop();
  }, [reduceMotion]);

  // Trigger per-slide entrance animations
  const triggerSlideAnimations = () => {
    if (reduceMotion) {
      cardScale.setValue(1);
      cardTranslateY.setValue(0);
      textTranslateY.setValue(0);
      textOpacity.setValue(1);
      bodyTranslateY.setValue(0);
      bodyOpacity.setValue(1);
      chipsScale.setValue(1);
      chipsOpacity.setValue(1);
      return;
    }

    cardScale.setValue(0.93);
    cardTranslateY.setValue(14);
    textTranslateY.setValue(12);
    textOpacity.setValue(0);
    bodyTranslateY.setValue(12);
    bodyOpacity.setValue(0);
    chipsScale.setValue(0.9);
    chipsOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(260),
        Animated.parallel([
          Animated.timing(bodyTranslateY, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(bodyOpacity, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(520),
        Animated.parallel([
          Animated.timing(chipsScale, {
            toValue: 1,
            duration: 550,
            useNativeDriver: true,
          }),
          Animated.timing(chipsOpacity, {
            toValue: 1,
            duration: 550,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  };

  const goToSlide = (targetIndex: number) => {
    const nextIdx = Math.max(0, Math.min(ONB_SLIDES.length - 1, targetIndex));
    setCurrentIndex(nextIdx);
    triggerSlideAnimations();
    Animated.spring(scrollX, {
      toValue: nextIdx * (SCREEN_WIDTH - 40),
      useNativeDriver: true,
      friction: 8,
      tension: 45,
    }).start();
  };

  const handleNext = () => {
    if (currentIndex === ONB_SLIDES.length - 1) {
      onComplete();
    } else {
      goToSlide(currentIndex + 1);
    }
  };

  // Pan Responder for smooth horizontal swipe gestures
  const panX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = (SCREEN_WIDTH - 40) * 0.2;
        const fastSwipe = Math.abs(gestureState.vx) > 0.45;

        if (gestureState.dx < -threshold || (fastSwipe && gestureState.dx < -30)) {
          if (currentIndex < ONB_SLIDES.length - 1) {
            goToSlide(currentIndex + 1);
          } else {
            goToSlide(currentIndex);
          }
        } else if (gestureState.dx > threshold || (fastSwipe && gestureState.dx > 30)) {
          if (currentIndex > 0) {
            goToSlide(currentIndex - 1);
          } else {
            goToSlide(currentIndex);
          }
        } else {
          goToSlide(currentIndex);
        }
        Animated.timing(panX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Dimensions clamped to match prototype with comfortable space: clamp(260px, 36vh, 340px)
  const cardHeight = Math.min(340, Math.max(260, SCREEN_HEIGHT * 0.36));
  const cardWidth = SCREEN_WIDTH - 40;

  const currentSlide = ONB_SLIDES[currentIndex];

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 14 : 16);
  const bottomPadding = Math.max(insets.bottom, 18);

  // Parallax translation for the active image
  const parallaxOffset = panX.interpolate({
    inputRange: [-cardWidth, 0, cardWidth],
    outputRange: [cardWidth * 0.1, 0, -cardWidth * 0.1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      {/* Background Radial Glows */}
      <AuthBackgroundGlows />

      {/* Top Header Bar (.obt) */}
      <View style={styles.topBar}>
        <Image
          source={require('../../../assets/logo_light.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <TouchableOpacity
          onPress={onComplete}
          activeOpacity={0.8}
          style={[
            styles.skipButton,
            {
              backgroundColor: colors.gc,
              borderColor: colors.glb,
            },
          ]}
        >
          <Text style={[styles.skipText, { color: colors.ink }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main Slide Card Area with gesture */}
      <View style={styles.sliderContainer} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.photoCard,
            {
              height: cardHeight,
              width: cardWidth,
              transform: [
                { scale: cardScale },
                { translateY: cardTranslateY },
              ],
            },
          ]}
        >
          {/* Parallax Image (120% width, -10% left offset) */}
          <Animated.Image
            source={currentSlide.image}
            style={[
              styles.cardImage,
              {
                left: currentSlide.imgPositionLeft ?? '-10%',
                transform: [{ translateX: parallaxOffset }],
              },
            ]}
            resizeMode="cover"
          />

          {/* Vignette Linear Gradient Overlay (.obp:after) */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLinearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
                <Stop offset="30%" stopColor="#000000" stopOpacity="0" />
                <Stop offset="52%" stopColor="#000000" stopOpacity="0" />
                <Stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
          </Svg>

          {/* Top-Left Chip (.obl) */}
          <View style={styles.chipTopLeft}>
            <Text style={styles.chipTopLeftText}>{currentSlide.lb}</Text>
          </View>

          {/* Top-Right Chip (.obn) */}
          <View style={styles.chipTopRight}>
            <Text style={styles.chipTopRightNum}>
              {currentSlide.num}{' '}
              <Text style={styles.chipTopRightTotal}>/ 04</Text>
            </Text>
          </View>

          {/* Bottom Glass Strip (.obx) */}
          <Animated.View
            style={[
              styles.bottomGlassStrip,
              {
                opacity: chipsOpacity,
                transform: [{ scale: chipsScale }],
              },
            ]}
          >
            {currentSlide.chips.map((chip, idx) => {
              if (chip.type === 'counter') {
                return (
                  <View
                    key={idx}
                    style={[styles.stripPill, chip.active && styles.stripPillActive]}
                  >
                    <View style={styles.circleNum}>
                      <Text style={styles.circleNumText}>{chip.num}</Text>
                    </View>
                    <Text style={styles.stripPillText}>{chip.text}</Text>
                  </View>
                );
              }

              if (chip.type === 'filter') {
                return (
                  <View
                    key={idx}
                    style={[styles.stripPill, chip.active && styles.stripPillActive]}
                  >
                    <Text style={styles.stripPillText}>{chip.text}</Text>
                  </View>
                );
              }

              if (chip.type === 'pending') {
                return (
                  <View key={idx} style={styles.pendingRow}>
                    <View style={styles.pendingAvatar}>
                      <Text style={styles.pendingAvatarText}>{chip.avatar}</Text>
                    </View>
                    <View style={styles.pendingDetails}>
                      <Text style={styles.pendingName}>{chip.text}</Text>
                      <Text style={styles.pendingSub}>{chip.sub}</Text>
                    </View>
                    <Text style={styles.pendingAmount}>{chip.amount}</Text>
                  </View>
                );
              }

              if (chip.type === 'receipt') {
                return (
                  <View key={idx} style={styles.receiptPill}>
                    {chip.icon ? (
                      <ProtoIcon name={chip.icon} size={16} color="#FFFFFF" strokeWidth={1.8} />
                    ) : null}
                    <Text style={styles.stripPillText}>{chip.text}</Text>
                  </View>
                );
              }

              return null;
            })}
          </Animated.View>
        </Animated.View>

        {/* Headline & Body with staggered animations */}
        <View style={styles.textDetails}>
          <Animated.Text
            style={[
              styles.headline,
              { color: colors.ink },
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            {currentSlide.titlePrefix}
            <Text style={styles.headlineEm}>{currentSlide.titleEm}</Text>
            {currentSlide.titleSuffix}
          </Animated.Text>

          <Animated.Text
            style={[
              styles.bodyText,
              { color: colors.mu },
              {
                opacity: bodyOpacity,
                transform: [{ translateY: bodyTranslateY }],
              },
            ]}
          >
            {currentSlide.body}
          </Animated.Text>
        </View>
      </View>

      {/* Footer (.obf): Dots + Action Button */}
      <View style={styles.footerRow}>
        {/* Animated Progress Dots (.obd) */}
        <View style={styles.dotsContainer}>
          {ONB_SLIDES.map((_, i) => {
            const isActive = i === currentIndex;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => goToSlide(i)}
                activeOpacity={0.8}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? '#FF5F00' : colors.ln,
                    width: isActive ? 48 : 10,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Primary CTA Button (.obb) */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.92}
          style={styles.ctaButton}
        >
          {/* Shimmer sweep overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmerOverlay,
              {
                transform: [{ translateX: shimmerAnim }],
              },
            ]}
          />

          <Text style={styles.ctaButtonText}>
            {currentIndex === 3 ? 'Get started' : 'Next'}
          </Text>
          <ProtoIcon name="ar" size={20} color="#FFFFFF" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* Swipe Left Hint (.obz) */}
      <View style={[styles.swipeHintContainer, { opacity: currentIndex === 3 ? 0 : 1 }]}>
        <Animated.Text
          style={[
            styles.swipeHintText,
            { color: colors.mu },
            { transform: [{ translateX: swipeHintAnim }] },
          ]}
        >
          SWIPE LEFT <Text style={styles.swipeArrows}>›››</Text>
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  logoImage: {
    width: 158,
    height: 38,
  },
  skipButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Glass styling
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lexend',
  },
  sliderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  photoCard: {
    borderRadius: 34,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#2A1A10',
    // 0 34px 50px -30px rgba(70,35,10,0.6)
    shadowColor: 'rgba(70,35,10,0.6)',
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cardImage: {
    position: 'absolute',
    top: 0,
    width: '120%',
    height: '100%',
  },
  chipTopLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 2,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(17,17,17,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipTopLeftText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Lexend',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  chipTopRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  chipTopRightNum: {
    color: '#111111',
    fontSize: 13.5,
    fontWeight: '800',
    fontFamily: 'Lexend',
  },
  chipTopRightTotal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#76716B',
  },
  bottomGlassStrip: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 2,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  stripPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  receiptPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  stripPillActive: {
    backgroundColor: '#FF5F00',
  },
  circleNum: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#FF5F00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleNumText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Lexend',
  },
  stripPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'Lexend',
  },
  pendingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    gap: 9,
  },
  pendingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#FF5F00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Lexend',
  },
  pendingDetails: {
    flex: 1,
  },
  pendingName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Lexend',
  },
  pendingSub: {
    color: '#FFFFFF',
    opacity: 0.75,
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Lexend',
  },
  pendingAmount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Lexend',
  },
  textDetails: {
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 18,
  },
  headline: {
    fontFamily: 'Jost',
    fontWeight: '700',
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headlineEm: {
    color: '#FF5F00',
  },
  bodyText: {
    fontFamily: 'Lexend',
    fontSize: 13.5,
    lineHeight: 21,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 10,
    borderRadius: 99,
  },
  ctaButton: {
    position: 'relative',
    overflow: 'hidden',
    height: 56,
    paddingHorizontal: 26,
    borderRadius: 18,
    backgroundColor: '#FF5F00',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    // 0 16px 28px -10px rgba(255,95,0,.65)
    shadowColor: '#FF5F00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Lexend',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  swipeHintContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  swipeHintText: {
    fontSize: 12,
    letterSpacing: 2.2,
    fontWeight: '600',
    fontFamily: 'Lexend',
    textTransform: 'uppercase',
  },
  swipeArrows: {
    letterSpacing: -2,
    fontWeight: '700',
  },
});
