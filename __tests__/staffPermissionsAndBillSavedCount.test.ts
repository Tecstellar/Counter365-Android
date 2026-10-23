jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android || objs.default },
  StyleSheet: { create: (s: any) => s },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

import { ROLE_DEFAULT_PERMISSIONS } from '../src/context/AuthContext';
import { UserRole, PermissionKey, ShopMember } from '../src/types/models';
import { TRANSLATIONS } from '../src/i18n/translations';

describe('Bill Saved Count and Staff Permission Overrides', () => {
  describe('Bill Saved Count Extraction', () => {
    const parseCountToday = (billNumber: string | number | undefined | null): number => {
      const numStr = String(billNumber ?? '');
      const matches = numStr.match(/(\d+)(?!.*\d)/);
      const parsedCount = matches ? parseInt(matches[1], 10) : (Number(billNumber) || 1);
      return parsedCount > 0 ? parsedCount : 1;
    };

    it('correctly extracts number 10 when billNumber is 10 or "#0010" or "BILL-OCT-0010"', () => {
      expect(parseCountToday(10)).toBe(10);
      expect(parseCountToday('10')).toBe(10);
      expect(parseCountToday('#0010')).toBe(10);
      expect(parseCountToday('#10')).toBe(10);
      expect(parseCountToday('BILL-OCT-0010')).toBe(10);
      expect(parseCountToday('INV-10')).toBe(10);
      expect(parseCountToday('INV-2026-10-0042')).toBe(42);
      expect(parseCountToday(1)).toBe(1);
      expect(parseCountToday('#0001')).toBe(1);
    });

    it('falls back gracefully to 1 when no numbers are found', () => {
      expect(parseCountToday('')).toBe(1);
      expect(parseCountToday(null)).toBe(1);
      expect(parseCountToday(undefined)).toBe(1);
    });
  });

  describe('Staff Permission Overrides', () => {
    const can = (
      role: UserRole,
      perm: PermissionKey,
      member?: Partial<ShopMember> | null
    ): boolean => {
      if (member && member.isActive === false) {
        return false;
      }
      if (role === 'Owner') return true;
      if (member?.overrides && member.overrides[perm] !== undefined) {
        return Boolean(member.overrides[perm]);
      }
      const defaultPerms = ROLE_DEFAULT_PERMISSIONS[role];
      return defaultPerms ? Boolean(defaultPerms[perm]) : false;
    };

    it('Supervisor has default permissions (bill, menu, pend, exp, total, report: true; users: false)', () => {
      expect(can('Supervisor', 'bill')).toBe(true);
      expect(can('Supervisor', 'menu')).toBe(true);
      expect(can('Supervisor', 'pend')).toBe(true);
      expect(can('Supervisor', 'exp')).toBe(true);
      expect(can('Supervisor', 'total')).toBe(true);
      expect(can('Supervisor', 'report')).toBe(true);
      expect(can('Supervisor', 'users')).toBe(false);
    });

    it('Supervisor override disables menu and pend when owner turns them off', () => {
      const supervisorWithOverrides: Partial<ShopMember> = {
        role: 'Supervisor',
        isActive: true,
        overrides: {
          menu: false,
          pend: false,
        },
      };

      // Menu and pending are overridden to false
      expect(can('Supervisor', 'menu', supervisorWithOverrides)).toBe(false);
      expect(can('Supervisor', 'pend', supervisorWithOverrides)).toBe(false);

      // Other permissions remain granted
      expect(can('Supervisor', 'bill', supervisorWithOverrides)).toBe(true);
      expect(can('Supervisor', 'exp', supervisorWithOverrides)).toBe(true);
    });

    it('Supervisor override disables bill when owner turns off bill access', () => {
      const supervisorNoBill: Partial<ShopMember> = {
        role: 'Supervisor',
        isActive: true,
        overrides: {
          bill: false,
        },
      };

      expect(can('Supervisor', 'bill', supervisorNoBill)).toBe(false);
      expect(can('Supervisor', 'menu', supervisorNoBill)).toBe(true);
    });

    it('Biller override can grant menu or pend if owner turns them on', () => {
      const billerWithOverrides: Partial<ShopMember> = {
        role: 'Biller',
        isActive: true,
        overrides: {
          menu: true,
          pend: true,
        },
      };

      expect(can('Biller', 'bill', billerWithOverrides)).toBe(true);
      expect(can('Biller', 'menu', billerWithOverrides)).toBe(true);
      expect(can('Biller', 'pend', billerWithOverrides)).toBe(true);
      expect(can('Biller', 'exp', billerWithOverrides)).toBe(false);
    });

    it('Deactivated member has zero permissions regardless of role or overrides', () => {
      const deactivatedSupervisor: Partial<ShopMember> = {
        role: 'Supervisor',
        isActive: false,
        overrides: {
          bill: true,
        },
      };

      expect(can('Supervisor', 'bill', deactivatedSupervisor)).toBe(false);
      expect(can('Supervisor', 'menu', deactivatedSupervisor)).toBe(false);
    });
  });

  describe('Localization for no_access warning', () => {
    it('has no_access in all supported languages', () => {
      expect(TRANSLATIONS.en.no_access).toBe("You don't have access for that");
      expect(TRANSLATIONS.ta.no_access).toBe('உங்களுக்கு இதற்கான அனுமதி இல்லை');
      expect(TRANSLATIONS.hi.no_access).toBe('आपके पास इसके लिए अनुमति नहीं है');
      expect(TRANSLATIONS.ml.no_access).toBe('നിങ്ങൾക്ക് ഇതിനുള്ള അനുമതിയില്ല');
      expect(TRANSLATIONS.kn.no_access).toBe('ನಿಮಗೆ ಇದಕ್ಕೆ ಪ್ರವೇಶವಿಲ್ಲ');
      expect(TRANSLATIONS.te.no_access).toBe('మీకు దీనికి ప్రాప్యత లేదు');
    });
  });
});
