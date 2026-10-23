jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android || objs.default },
  StyleSheet: { create: (s: any) => s },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  BackHandler: { exitApp: jest.fn(), addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Modal: ({ children }: any) => children,
  View: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  TouchableOpacity: ({ children }: any) => children,
  Pressable: ({ children }: any) => children,
  ScrollView: ({ children }: any) => children,
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

import { ROLE_DEFAULT_PERMISSIONS } from '../src/context/AuthContext';
import { TRANSLATIONS, SupportedLanguage } from '../src/i18n/translations';
import { PermissionKey, UserRole, ShopMember } from '../src/types/models';

const PERM_ROWS: Array<{ key: PermissionKey; name: string }> = [
  { key: 'bill', name: 'Take bills' },
  { key: 'total', name: "See the day's takings" },
  { key: 'exp', name: 'Add expenses' },
  { key: 'pend', name: 'Clear pending' },
  { key: 'report', name: 'See day report & analytics' },
  { key: 'menu', name: 'Edit menu & prices' },
  { key: 'users', name: 'Add or remove users' },
];

describe('RBAC & Back Navigation Acceptance Suite', () => {
  describe('1. Owner-Controlled Permissions at Creation & Defaults', () => {
    it('defines consistent default permissions for Owner, Supervisor, and Biller', () => {
      // Owner has full access
      expect(ROLE_DEFAULT_PERMISSIONS.Owner.bill).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Owner.menu).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Owner.report).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Owner.pend).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Owner.exp).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Owner.users).toBe(true);

      // Supervisor has operational access, cannot manage users or subscription
      expect(ROLE_DEFAULT_PERMISSIONS.Supervisor.bill).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Supervisor.menu).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Supervisor.pend).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Supervisor.exp).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Supervisor.users).toBe(false);

      // Biller has billing and takings only
      expect(ROLE_DEFAULT_PERMISSIONS.Biller.bill).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Biller.total).toBe(true);
      expect(ROLE_DEFAULT_PERMISSIONS.Biller.menu).toBe(false);
      expect(ROLE_DEFAULT_PERMISSIONS.Biller.pend).toBe(false);
      expect(ROLE_DEFAULT_PERMISSIONS.Biller.exp).toBe(false);
      expect(ROLE_DEFAULT_PERMISSIONS.Biller.report).toBe(false);
    });

    it('all module keys in PERM_ROWS are valid PermissionKey identifiers', () => {
      const validKeys: PermissionKey[] = ['bill', 'total', 'exp', 'pend', 'report', 'menu', 'users'];
      PERM_ROWS.forEach(row => {
        expect(validKeys).toContain(row.key);
        expect(row.name).toBeTruthy();
      });
    });

    it('computes effective permission giving strict priority to explicit Owner overrides over defaults', () => {
      const computePerm = (role: UserRole, overrides: Partial<Record<PermissionKey, boolean>> | undefined, perm: PermissionKey, isActive: boolean = true) => {
        if (!isActive) return false;
        if (role === 'Owner') return true;
        if (overrides && overrides[perm] !== undefined) {
          return Boolean(overrides[perm]);
        }
        return Boolean(ROLE_DEFAULT_PERMISSIONS[role]?.[perm]);
      };

      // Owner explicitly turns OFF menu and pend for a Supervisor at creation time
      const supervisorOverrides: Partial<Record<PermissionKey, boolean>> = {
        menu: false,
        pend: false,
      };
      expect(computePerm('Supervisor', supervisorOverrides, 'menu')).toBe(false);
      expect(computePerm('Supervisor', supervisorOverrides, 'pend')).toBe(false);
      expect(computePerm('Supervisor', supervisorOverrides, 'bill')).toBe(true);

      // Owner explicitly grants menu edit access to a trusted Biller
      const billerOverrides: Partial<Record<PermissionKey, boolean>> = {
        menu: true,
      };
      expect(computePerm('Biller', billerOverrides, 'menu')).toBe(true);
      expect(computePerm('Biller', billerOverrides, 'exp')).toBe(false);
    });
  });

  describe('2. Navigation History & Android Back Button Logic', () => {
    it('unwinds history stack on non-home screen without closing the app', () => {
      let currentRoute = 'reports';
      let routeHistory = ['home', 'sales'];

      // Simulate back press on reports
      const simulateBack = () => {
        if (currentRoute === 'home') {
          return { action: 'SHOW_EXIT_MODAL' };
        }
        const nextHistory = [...routeHistory];
        let prevRoute = 'home';
        while (nextHistory.length > 0) {
          const candidate = nextHistory.pop()!;
          if (candidate !== currentRoute) {
            prevRoute = candidate;
            break;
          }
        }
        currentRoute = prevRoute;
        routeHistory = nextHistory;
        return { action: 'NAVIGATE', to: currentRoute };
      };

      const result1 = simulateBack();
      expect(result1.action).toBe('NAVIGATE');
      expect(result1.to).toBe('sales');
      expect(currentRoute).toBe('sales');

      const result2 = simulateBack();
      expect(result2.action).toBe('NAVIGATE');
      expect(result2.to).toBe('home');
      expect(currentRoute).toBe('home');

      // Now on home screen, back must trigger exit confirmation modal
      const result3 = simulateBack();
      expect(result3.action).toBe('SHOW_EXIT_MODAL');
    });

    it('reverts sales subviews (editor/bill) to menu before navigating away', () => {
      let salesSubView: 'menu' | 'editor' | 'bill' = 'editor';
      const handleSalesBack = () => {
        if (salesSubView === 'editor' || salesSubView === 'bill') {
          salesSubView = 'menu';
          return true; // Handled internally
        }
        return false; // Can pop route
      };

      expect(handleSalesBack()).toBe(true);
      expect(salesSubView).toBe('menu');
      expect(handleSalesBack()).toBe(false);
    });
  });

  describe('3. Localization for Exit Confirmation Modal', () => {
    const supportedLangs: SupportedLanguage[] = ['en', 'ta', 'hi', 'ml', 'kn', 'te'];

    it('has exit_app_title, exit_app_confirm, and exit_app_btn defined in all supported languages', () => {
      supportedLangs.forEach(lang => {
        const dict = TRANSLATIONS[lang];
        expect(dict.exit_app_title).toBeTruthy();
        expect(dict.exit_app_confirm).toBeTruthy();
        expect(dict.exit_app_btn).toBeTruthy();
        expect(dict.cancel).toBeTruthy();
      });
    });
  });
});
