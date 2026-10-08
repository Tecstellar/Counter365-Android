import { twoFactorService, TWOFACTOR_CONFIG, DEMO_REVIEW_PHONE, DEMO_REVIEW_OTP } from '../src/services/twoFactorService';
import { authService } from '../src/services/authService';

describe('2Factor SMS OTP Gateway & Single Demo Review Login', () => {
  it('should sanitize 10-digit Indian phone numbers correctly', () => {
    expect(twoFactorService.sanitizePhone('98404 12345')).toBe('9840412345');
    expect(twoFactorService.sanitizePhone('+919840412345')).toBe('9840412345');
    expect(twoFactorService.sanitizePhone('+91 98404-12345')).toBe('9840412345');
    expect(twoFactorService.sanitizePhone('919840412345')).toBe('9840412345');
    expect(twoFactorService.sanitizePhone('99999 99999')).toBe('9999999999');
  });

  it('should reject invalid phone numbers (< 10 digits)', async () => {
    const res = await twoFactorService.sendOtp('12345');
    expect(res.success).toBe(false);
    expect(res.error).toContain('valid 10-digit');
  });

  it('should reject OTP verification with invalid length', async () => {
    const res = await twoFactorService.verifyOtp(DEMO_REVIEW_PHONE, '123');
    expect(res.success).toBe(false);
    expect(res.error).toContain('6-digit OTP');
  });

  it('should support the single official demo review login ID', async () => {
    const sendRes = await twoFactorService.sendOtp(DEMO_REVIEW_PHONE);
    expect(sendRes.success).toBe(true);
    expect(sendRes.message).toContain('Reviewer demo login active');

    const verifyRes = await twoFactorService.verifyOtp(DEMO_REVIEW_PHONE, DEMO_REVIEW_OTP);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.message).toContain('verified');
  });

  it('should reject incorrect demo OTP for demo review login ID', async () => {
    const verifyRes = await twoFactorService.verifyOtp(DEMO_REVIEW_PHONE, '000000');
    expect(verifyRes.success).toBe(false);
    expect(verifyRes.error).toContain('Invalid demo OTP');
  });

  it('should use correct 2Factor template and API configuration', () => {
    expect(TWOFACTOR_CONFIG.API_KEY).toBe('e11be203-4f77-11f1-9800-0200cd936042');
    expect(TWOFACTOR_CONFIG.TEMPLATE_NAME).toBe('Login_Verification_OTP');
    expect(TWOFACTOR_CONFIG.BASE_URL).toBe('https://2factor.in/API/V1');
  });

  it('authService should verify single demo profile and load demo shop', async () => {
    const authRes = await authService.verifyOtp(DEMO_REVIEW_PHONE, DEMO_REVIEW_OTP);
    expect(authRes.success).toBe(true);
    expect(authRes.profile).toBeDefined();
    expect(authRes.profile?.phone).toBe(DEMO_REVIEW_PHONE);
    expect(authRes.isExistingShop).toBe(true);
    expect(authRes.shop).toBeDefined();
    expect(authRes.shop?.name).toContain('Demo');

    const currentProfile = await authService.getCurrentProfile();
    expect(currentProfile?.phone).toBe(DEMO_REVIEW_PHONE);
  }, 15000);
});
