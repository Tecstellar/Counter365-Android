import { storage } from '../lib/storage';

export const TWOFACTOR_CONFIG = {
  API_KEY: process.env.EXPO_PUBLIC_TWOFACTOR_API_KEY || 'e11be203-4f77-11f1-9800-0200cd936042',
  TEMPLATE_NAME: process.env.EXPO_PUBLIC_TWOFACTOR_TEMPLATE_NAME || 'Login_Verification_OTP',
  BASE_URL: 'https://2factor.in/API/V1',
};

const SESSION_KEY_PREFIX = '@counterpro/2factor_session_';

export interface SendOtpResult {
  success: boolean;
  sessionId?: string;
  message?: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Single official Demo Login ID for App Store and Play Store review purposes.
 */
export const DEMO_REVIEW_PHONE = '9999999999';
export const DEMO_REVIEW_OTP = '123456';

export const twoFactorService = {
  /**
   * Sanitizes phone number to 10 digits for Indian mobile numbers
   */
  sanitizePhone(phone: string): string {
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      return clean.slice(2);
    }
    if (clean.length > 10) {
      return clean.slice(-10);
    }
    return clean;
  },

  /**
   * Send OTP via 2Factor.in AUTOGEN API with Template Name
   */
  async sendOtp(rawPhone: string): Promise<SendOtpResult> {
    const phone = this.sanitizePhone(rawPhone);
    if (phone.length !== 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
    }

    // STRICT SINGLE DEMO LOGIN ID FOR REVIEW PURPOSES
    if (phone === DEMO_REVIEW_PHONE) {
      const demoSessionId = `demo_review_session_${phone}`;
      await storage.setItem(`${SESSION_KEY_PREFIX}${phone}`, demoSessionId);
      return {
        success: true,
        sessionId: demoSessionId,
        message: 'Reviewer demo login active. OTP: 123456',
      };
    }

    try {
      const url = `${TWOFACTOR_CONFIG.BASE_URL}/${TWOFACTOR_CONFIG.API_KEY}/SMS/${phone}/AUTOGEN/${TWOFACTOR_CONFIG.TEMPLATE_NAME}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.Status === 'Success') {
        const sessionId = data.Details;
        await storage.setItem(`${SESSION_KEY_PREFIX}${phone}`, sessionId);
        return {
          success: true,
          sessionId,
          message: 'OTP sent successfully to your mobile number.',
        };
      }

      // Handle 2Factor API failure response
      const errorMessage = data?.Details || 'Failed to send OTP via SMS provider.';
      console.warn('2Factor sendOtp error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } catch (err: any) {
      console.warn('2Factor network error (fallback):', err?.message);
      return {
        success: false,
        error: 'Unable to connect to SMS service. Please check your internet connection.',
      };
    }
  },

  /**
   * Verify OTP via 2Factor.in VERIFY API
   */
  async verifyOtp(rawPhone: string, otp: string, explicitSessionId?: string): Promise<VerifyOtpResult> {
    const phone = this.sanitizePhone(rawPhone);
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      return { success: false, error: 'Please enter a valid 6-digit OTP code.' };
    }

    // STRICT SINGLE DEMO LOGIN ID FOR REVIEW PURPOSES
    if (phone === DEMO_REVIEW_PHONE) {
      if (cleanOtp === DEMO_REVIEW_OTP) {
        return { success: true, message: 'Reviewer demo verified successfully.' };
      }
      return { success: false, error: 'Invalid demo OTP code. Use 123456' };
    }

    try {
      let sessionId = explicitSessionId;
      if (!sessionId) {
        sessionId = (await storage.getItem(`${SESSION_KEY_PREFIX}${phone}`)) || undefined;
      }

      if (!sessionId) {
        return {
          success: false,
          error: 'Session expired or not found. Please click Resend code.',
        };
      }

      const url = `${TWOFACTOR_CONFIG.BASE_URL}/${TWOFACTOR_CONFIG.API_KEY}/SMS/VERIFY/${sessionId}/${cleanOtp}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.Status === 'Success' && (data.Details === 'OTP Matched' || data.Details.includes('Matched'))) {
        // Clear stored session on successful verification
        await storage.removeItem(`${SESSION_KEY_PREFIX}${phone}`);
        return {
          success: true,
          message: 'OTP verified successfully.',
        };
      }

      const errorMsg = data?.Details || 'Incorrect OTP. Please try again.';
      return {
        success: false,
        error: errorMsg === 'OTP Mismatch' ? 'Incorrect OTP code entered. Please try again.' : errorMsg,
      };
    } catch (err: any) {
      console.warn('2Factor verifyOtp network error:', err?.message);
      return {
        success: false,
        error: 'Unable to verify OTP. Please check your internet connection.',
      };
    }
  },
};
