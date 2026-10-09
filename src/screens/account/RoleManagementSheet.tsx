import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { typography, radii, spacing, useTheme, Theme } from '../../theme';
import { AppButton } from '../../components/common/AppButton';
import { AppTag } from '../../components/common/AppTag';
import { ModalSheet } from '../../components/common/ModalSheet';
import { ShopMember, UserRole, PermissionKey } from '../../types/models';

interface RoleManagementSheetProps {
  member: ShopMember | null;
  visible: boolean;
  onClose: () => void;
  onSelectRole: (role: UserRole) => void;
  onToggleOverride: (permKey: PermissionKey, currentValue: boolean) => void;
  onRemoveUser: () => void;
}

const PERM_ROWS: Array<{ key: PermissionKey; name: string }> = [
  { key: 'bill', name: 'Take bills' },
  { key: 'total', name: "See the day's takings" },
  { key: 'exp', name: 'Add expenses' },
  { key: 'pend', name: 'Clear pending' },
  { key: 'report', name: 'See day report & analytics' },
  { key: 'menu', name: 'Edit menu & prices' },
  { key: 'users', name: 'Add or remove users' },
];

const ROLES_INFO: Array<{ role: UserRole; sub: string }> = [
  { role: 'Supervisor', sub: 'Counter ops, expenses, menu & reports' },
  { role: 'Biller', sub: 'Bills and the day total only' },
];

const DEFAULT_ROLE_PERMS: Record<UserRole, Record<PermissionKey, boolean>> = {
  Owner: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, users: true, subscription: true },
  Supervisor: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, users: false, subscription: false },
  Biller: { bill: true, total: true, exp: false, pend: false, report: false, menu: false, users: false, subscription: false },
};

export const RoleManagementSheet: React.FC<RoleManagementSheetProps> = ({
  member,
  visible,
  onClose,
  onSelectRole,
  onToggleOverride,
  onRemoveUser,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  if (!member) return null;

  const overrides = member.overrides || {};
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <ModalSheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{member.fullName}</Text>
          <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Pick a role, then override single permissions if this person is an exception.
        </Text>

        {/* Role Choices */}
        <View style={styles.roleChoicesList}>
          {ROLES_INFO.map(item => {
            const isSelected = member.role === item.role;
            return (
              <TouchableOpacity
                key={item.role}
                activeOpacity={0.8}
                onPress={() => onSelectRole(item.role)}
                style={[
                  styles.roleCard,
                  isSelected && styles.roleCardSelected,
                ]}
              >
                <View
                  style={[
                    styles.radioDot,
                    isSelected && styles.radioDotSelected,
                  ]}
                />
                <View style={styles.roleInfo}>
                  <Text style={styles.roleName}>{item.role}</Text>
                  <Text style={styles.roleSub}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Permissions Overrides Header */}
        <View style={styles.permHeader}>
          <Text style={styles.permHeading}>Permissions</Text>
          <Text style={styles.permNote}>
            {hasOverrides ? 'differs from role' : 'as per role'}
          </Text>
        </View>

        {/* Permission Toggles List */}
        <View style={styles.permList}>
          {PERM_ROWS.map(p => {
            const basePerm = DEFAULT_ROLE_PERMS[member.role][p.key];
            const overrideVal = overrides[p.key];
            const isGranted = overrideVal !== undefined ? overrideVal : basePerm;
            const isOverridden = overrideVal !== undefined && overrideVal !== basePerm;

            return (
              <TouchableOpacity
                key={p.key}
                activeOpacity={0.7}
                onPress={() => onToggleOverride(p.key, isGranted)}
                style={styles.permRow}
              >
                <Text style={styles.permName}>{p.name}</Text>
                {isOverridden && <AppTag label="OVERRIDE" variant="outline" />}
                <View
                  style={[
                    styles.toggleTrack,
                    isGranted && styles.toggleTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      isGranted && styles.toggleKnobActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Deactivate User Action */}
        {member?.isActive === false ? (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: typography.sizes.body, color: colors.textMuted, fontFamily: typography.fonts.body }}>
              Staff member deactivated. Past billing history & records preserved.
            </Text>
          </View>
        ) : (
          <AppButton
            title="Deactivate this staff member"
            variant="ghost"
            onPress={onRemoveUser}
            style={styles.removeBtn}
          />
        )}
      </ScrollView>
    </ModalSheet>
  );
};

const createStyles = (theme: Theme) => {
  const colors = theme.colors;
  return StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4,
    color: colors.text,
  },
  doneBtn: {
    padding: 6,
  },
  doneText: {
    fontSize: typography.sizes.sub,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  subtitle: {
    fontSize: typography.sizes.sub,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 4,
    marginBottom: 12,
  },
  roleChoicesList: {
    gap: 8,
  },
  roleCard: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 11,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  roleCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent100,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(29, 31, 32, 0.2)',
  },
  radioDotSelected: {
    backgroundColor: colors.accent,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.lg,
    color: colors.text,
  },
  roleSub: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
    marginTop: 2,
  },
  permHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 4,
  },
  permHeading: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  permNote: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontFamily: typography.fonts.body,
  },
  permList: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  permRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerLight,
    gap: 10,
  },
  permName: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text,
    fontFamily: typography.fonts.body,
  },
  toggleTrack: {
    width: 40,
    height: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 11,
    backgroundColor: 'transparent',
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(29, 31, 32, 0.35)',
  },
  toggleKnobActive: {
    backgroundColor: colors.bg,
    alignSelf: 'flex-end',
  },
  removeBtn: {
    minHeight: 44,
    marginTop: 10,
  },
  });
};
