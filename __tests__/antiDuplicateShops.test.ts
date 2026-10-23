import { shopService } from '../src/services/shopService';
import { storage } from '../src/lib/storage';
import { supabase } from '../src/lib/supabase';
import { Shop } from '../src/types/models';

jest.mock('../src/lib/storage');
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Anti-Duplicate Shops Protection System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registerShop reuses existing shop ID and does NOT create a duplicate when phone is already registered', async () => {
    const existingShopId = 'fe3cb2ab-51f6-4d9b-897f-b0a0e62cb222';
    const mockPhone = '9360396190';

    const mockSelect = jest.fn().mockImplementation(() => ({
      eq: jest.fn().mockImplementation(() => ({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: existingShopId, phone: mockPhone, name: 'Nobi Tea Stall' }],
            error: null,
          }),
        }),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'user-uuid-1234', phone: mockPhone },
          error: null,
        }),
      })),
    }));

    const mockUpsert = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    const result = await shopService.registerShop({
      name: 'Nobi Tea Stall Updated',
      shopType: 'Tea Shop',
      phone: mockPhone,
      address: '551 Main St',
      city: 'Kalugumalai',
      state: 'Tamil Nadu',
      pincode: '628552',
    });

    // It must NOT generate a new random UUID; it must strictly reuse the existing ID
    expect(result.id).toBe(existingShopId);
    expect(mockUpsert).toHaveBeenCalled();
    const upsertPayload = mockUpsert.mock.calls[0][0];
    expect(upsertPayload.id).toBe(existingShopId);
    expect(upsertPayload.phone).toBe(mockPhone);
  });

  it('saveShop adopts existing remote shop ID if phone matches an existing shop in Supabase', async () => {
    const existingShopId = 'fe3cb2ab-51f6-4d9b-897f-b0a0e62cb222';
    const staleLocalId = '11111111-2222-4333-8444-555555555555';
    const mockPhone = '9360396190';

    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        neq: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: existingShopId }],
            error: null,
          }),
        }),
      }),
    });

    const mockUpsert = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    });

    const shopToSave: Shop = {
      id: staleLocalId,
      name: 'Jo Tea Stall',
      shopType: 'Tea Shop',
      phone: mockPhone,
      address: '15 South St',
      city: 'Thoothukkudi',
      state: 'Tamil Nadu',
      country: 'India',
      pincode: '628552',
      currencyCode: 'INR',
      timezone: 'Asia/Kolkata',
      gstEnabled: false,
      gstRate: 5,
      roundOffEnabled: true,
      dailyBackupEnabled: true,
      printerEnabled: false,
    };

    const saved = await shopService.saveShop(shopToSave);

    // It must have adopted the authoritative remote ID fe3cb2ab-... and NOT saved staleLocalId
    expect(saved.id).toBe(existingShopId);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0].id).toBe(existingShopId);
  });

  it('ensureShopExists adopts authoritative remote shop by phone instead of creating duplicate row', async () => {
    const existingShopId = 'fe3cb2ab-51f6-4d9b-897f-b0a0e62cb222';
    const staleShopId = '11111111-1111-4111-8111-111111111111';
    const mockPhone = '9360396190';

    (storage.getObject as jest.Mock).mockResolvedValue({
      id: staleShopId,
      name: 'Stale Shop',
      phone: mockPhone,
      address: 'Old Address',
      city: 'Old City',
    });

    const mockSelect = jest.fn().mockImplementation(() => ({
      eq: jest.fn().mockImplementation((col, val) => {
        if (col === 'id') {
          // Shop ID doesn't exist remotely (was deleted)
          return {
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (col === 'phone') {
          // But phone exists remotely!
          return {
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{ id: existingShopId, name: 'Nobi Tea Stall', address: '551', city: 'Kalugumalai' }],
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
    }));

    const mockUpsert = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    });

    const exists = await shopService.ensureShopExists(staleShopId);
    expect(exists).toBe(true);
    // Crucially: mockUpsert should NOT be called to insert a duplicate placeholder!
    expect(mockUpsert).not.toHaveBeenCalled();
    // And storage should have been updated to adopt authoritative shop
    expect(storage.setObject).toHaveBeenCalledWith(
      '@counterpro/active_shop',
      expect.objectContaining({
        id: existingShopId,
        name: 'Nobi Tea Stall',
      })
    );
  });
});
