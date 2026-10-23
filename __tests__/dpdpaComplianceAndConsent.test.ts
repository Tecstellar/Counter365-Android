import {
  PRIVACY_POLICY_SECTIONS,
  TERMS_OF_SERVICE_SECTIONS,
  GRIEVANCE_OFFICER,
  DPDPA_COMPLIANCE_DATE,
} from '../src/constants/legalDocuments';

describe('Digital Personal Data Protection Act, 2023 (DPDPA) Compliance & Consent Architecture', () => {
  it('1. Privacy Policy contains all mandatory DPDPA 2023 sections', () => {
    expect(PRIVACY_POLICY_SECTIONS.length).toBeGreaterThanOrEqual(8);
    const titles = PRIVACY_POLICY_SECTIONS.map(s => s.title);

    // Section 5 Notice & Lawful Purpose
    expect(titles.some(t => t.includes('Notice & Categories of Personal Data Collected'))).toBe(true);
    expect(titles.some(t => t.includes('Specified Lawful Purpose'))).toBe(true);

    // Section 6 Consent
    expect(titles.some(t => t.includes('Consent Architecture'))).toBe(true);

    // Section 11-14 Rights of Data Principals
    expect(titles.some(t => t.includes('Rights of Data Principals'))).toBe(true);

    // Section 8 Technical & Organizational Security Safeguards
    expect(titles.some(t => t.includes('Security Safeguards'))).toBe(true);

    // Data Retention
    expect(titles.some(t => t.includes('Data Retention'))).toBe(true);

    // Grievance Redressal Officer
    expect(titles.some(t => t.includes('Grievance Redressal Officer'))).toBe(true);
  });

  it('2. Grievance Redressal Officer details are specified in accordance with Section 8 & 13', () => {
    expect(GRIEVANCE_OFFICER.email).toBe('grievance@counterpro.in');
    expect(GRIEVANCE_OFFICER.resolutionTimeline).toContain('7 business days');
    expect(GRIEVANCE_OFFICER.boardName).toBe('Data Protection Board of India (DPBI)');
  });

  it('3. Privacy Policy explicitly covers essential billing counter data points and purpose limitation', () => {
    const noticeSection = PRIVACY_POLICY_SECTIONS.find(s => s.title.includes('Categories of Personal Data'));
    expect(noticeSection).toBeDefined();
    expect(noticeSection!.content).toContain('Merchant Identity');
    expect(noticeSection!.content).toContain('Staff / Operator Accounts');
    expect(noticeSection!.content).toContain('Customer Contact Records');
    expect(noticeSection!.content).toContain('Transaction & Billing Data');

    const purposeSection = PRIVACY_POLICY_SECTIONS.find(s => s.title.includes('Purpose'));
    expect(purposeSection).toBeDefined();
    expect(purposeSection!.content).toContain('two-factor OTP verification');
    expect(purposeSection!.content).toContain('sales bills');
    expect(purposeSection!.content).toContain('NEVER sells, trades, rents, or commercializes');
  });

  it('4. Data Principal Rights explicitly detail Access, Correction, Erasure, Grievance, and Nomination', () => {
    const rightsSection = PRIVACY_POLICY_SECTIONS.find(s => s.title.includes('Rights of Data Principals'));
    expect(rightsSection).toBeDefined();
    expect(rightsSection!.content).toContain('Section 11');
    expect(rightsSection!.content).toContain('Section 12');
    expect(rightsSection!.content).toContain('Section 13');
    expect(rightsSection!.content).toContain('Section 14');
    expect(rightsSection!.content).toContain('Permanently Delete Account');
  });

  it('5. Terms of Service details Merchant obligations as Data Fiduciary for end customer billing', () => {
    expect(TERMS_OF_SERVICE_SECTIONS.length).toBeGreaterThanOrEqual(8);
    const fiduciarySection = TERMS_OF_SERVICE_SECTIONS.find(s => s.title.includes('Data Fiduciary'));
    expect(fiduciarySection).toBeDefined();
    expect(fiduciarySection!.content).toContain('WhatsApp');
    expect(fiduciarySection!.content).toContain('DPDPA 2023');

    const taxSection = TERMS_OF_SERVICE_SECTIONS.find(s => s.title.includes('GST, Taxation'));
    expect(taxSection).toBeDefined();
    expect(taxSection!.content).toContain('GST');
  });
});
