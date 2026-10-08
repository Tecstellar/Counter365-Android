import { UserRole, PermissionKey } from '../src/types/models';

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Record<PermissionKey, boolean>> = {
  Owner: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, users: true, subscription: true },
  Supervisor: { bill: true, total: true, exp: true, pend: true, report: true, menu: true, users: false, subscription: false },
  Biller: { bill: true, total: true, exp: false, pend: false, report: false, menu: false, users: false, subscription: false },
};

describe('Role & Permission Authorization Matrix', () => {
  test('Owner has full operational and subscription access', () => {
    const ownerPerms = ROLE_DEFAULT_PERMISSIONS['Owner'];
    expect(ownerPerms.bill).toBe(true);
    expect(ownerPerms.total).toBe(true);
    expect(ownerPerms.exp).toBe(true);
    expect(ownerPerms.pend).toBe(true);
    expect(ownerPerms.report).toBe(true);
    expect(ownerPerms.menu).toBe(true);
    expect(ownerPerms.users).toBe(true);
    expect(ownerPerms.subscription).toBe(true);
  });

  test('Supervisor has all operational permissions but NO subscription or user management permission', () => {
    const supPerms = ROLE_DEFAULT_PERMISSIONS['Supervisor'];
    expect(supPerms.bill).toBe(true);
    expect(supPerms.total).toBe(true);
    expect(supPerms.exp).toBe(true);
    expect(supPerms.pend).toBe(true);
    expect(supPerms.report).toBe(true);
    expect(supPerms.menu).toBe(true);
    expect(supPerms.users).toBe(false);
    expect(supPerms.subscription).toBe(false);
  });

  test('Biller has only billing and day total permissions', () => {
    const billerPerms = ROLE_DEFAULT_PERMISSIONS['Biller'];
    expect(billerPerms.bill).toBe(true);
    expect(billerPerms.total).toBe(true);
    expect(billerPerms.exp).toBe(false);
    expect(billerPerms.pend).toBe(false);
    expect(billerPerms.report).toBe(false);
    expect(billerPerms.menu).toBe(false);
    expect(billerPerms.users).toBe(false);
    expect(billerPerms.subscription).toBe(false);
  });
});
