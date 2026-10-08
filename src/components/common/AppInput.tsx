import React, { useState, useMemo, useRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { colors, typography, radii, spacing, shadows, useTheme, Theme } from '../../theme';

export interface AppInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  prefix?: string;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
  onSubmitEditing?: () => void;
}

export const AppInput = React.forwardRef<TextInput, AppInputProps>(({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  maxLength,
  multiline = false,
  numberOfLines = 1,
  style,
  inputStyle,
  prefix,
  disabled = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  autoFocus = false,
  autoCapitalize = 'sentences',
  returnKeyType,
  onSubmitEditing,
}, ref) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => inputRef.current as TextInput);

  const handleFocusInput = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label} onPress={handleFocusInput}>
          {label}
        </Text>
      )}
      <Pressable
        onPress={handleFocusInput}
        style={[
          styles.inputContainer,
          multiline && styles.multilineContainer,
          isFocused && styles.focused,
          disabled && styles.disabledContainer,
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIconWrap}>{leftIcon}</View>
        )}
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.inputPlaceholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={!disabled}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            inputStyle,
          ]}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.rightIconWrap}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </Pressable>
    </View>
  );
});

AppInput.displayName = 'AppInput';

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontFamily: typography.fonts.bodySemiBold,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  inputContainer: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 42,
  },
  focused: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    backgroundColor: colors.inputBg,
    ...shadows.card,
  },
  disabledContainer: {
    backgroundColor: colors.neutral100,
    opacity: 0.65,
  },
  multilineContainer: {
    minHeight: 72,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  leftIconWrap: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconWrap: {
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefix: {
    fontFamily: typography.fonts.numbers,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
    marginRight: 6,
    lineHeight: 22,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.inputText,
    fontFamily: typography.fonts.body,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 40,
  },
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: 4,
  },
  });
};
