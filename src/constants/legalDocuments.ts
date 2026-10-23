export interface LegalSection {
  title: string;
  content: string;
}

export const DPDPA_COMPLIANCE_DATE = 'October 2026';

export const GRIEVANCE_OFFICER = {
  title: 'Grievance Redressal Officer (DPDPA 2023)',
  name: 'Data Protection & Grievance Officer',
  email: 'grievance@counterpro.in',
  address: 'TecStellar / CounterPro Tech Labs, India',
  resolutionTimeline: 'Within 7 business days from receipt of grievance',
  boardName: 'Data Protection Board of India (DPBI)',
};

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    title: '1. Compliance with Digital Personal Data Protection Act, 2023',
    content:
      'CounterPro / Counter365 operates in strict compliance with the Digital Personal Data Protection Act, 2023 ("DPDPA 2023", Act No. 22 of 2023 of the Parliament of India). We process digital personal data lawfully, fairly, and transparently, ensuring full protection of the privacy rights of all Data Principals.',
  },
  {
    title: '2. Notice & Categories of Personal Data Collected',
    content:
      'In accordance with Section 5 of DPDPA 2023, we provide notice that we collect only the personal data essential to deliver point-of-sale and counter billing services:\n\n' +
      '• Merchant Identity & Authentication: Registered mobile phone number (for secure SMS OTP authentication), shop name, address, business category, and optional GSTIN.\n' +
      '• Staff / Operator Accounts: Mobile phone numbers and assigned access roles (Owner, Supervisor, Biller) for authorized counter access.\n' +
      '• Customer Contact Records: Customer mobile numbers entered at checkout strictly to dispatch digital bills, invoices, and payment receipts via WhatsApp or SMS.\n' +
      '• Transaction & Billing Data: Invoices, payment modes (Cash, UPI, Pending/Credit), itemized order lines, and business expense logs.\n' +
      '• Technical & Diagnostic Data: Device identifiers, app version, local offline sync queue status, and crash logs to maintain system reliability.',
  },
  {
    title: '3. Specified Lawful Purpose of Data Processing',
    content:
      'In accordance with Section 5 and Section 6 of DPDPA 2023, your personal data is collected and processed exclusively for the following specified purposes:\n\n' +
      '• Secure account onboarding, two-factor OTP verification, and session authentication.\n' +
      '• Generating, calculating, printing, and digitally dispatching customer sales bills.\n' +
      '• Synchronizing counter operations across multi-user terminals via secure encrypted cloud databases.\n' +
      '• Maintaining durable offline local records ensuring business continuity when internet connectivity is unavailable.\n' +
      '• Assisting merchants in generating statutory GST and business expense ledgers.\n\n' +
      'CounterPro NEVER sells, trades, rents, or commercializes your personal or business financial data to third-party advertisers or data brokers.',
  },
  {
    title: '4. Consent Architecture & Right to Withdraw Consent',
    content:
      'By checking the consent box and signing in with your verified mobile number, you provide free, specific, informed, unconditional, and unambiguous consent under Section 6 of DPDPA 2023. You have the statutory right to withdraw your consent at any time. Withdrawal can be exercised by deleting your account in Account Settings or by writing to our Grievance Redressal Officer. Upon withdrawal, we cease processing your personal data, subject only to statutory tax record retention laws.',
  },
  {
    title: '5. Rights of Data Principals (Under Sections 11–14 of DPDPA 2023)',
    content:
      'As a Data Principal under Indian law, you are entitled to the following statutory rights:\n\n' +
      '• Right to Access Information (Section 11): You may request a summary of your personal data processed by CounterPro, including processing activities and any data processors engaged.\n' +
      '• Right to Correction and Completion (Section 12): You may update, correct, or complete inaccurate or obsolete personal details directly via the app or through our support.\n' +
      '• Right to Erasure (Section 12): You have the absolute right to have your personal data permanently erased. Tapping "Permanently Delete Account" in the Account screen cascades a hard delete across all cloud database records and wipes local terminal caches.\n' +
      '• Right of Grievance Redressal (Section 13): You have the right to register complaints regarding data privacy with our Grievance Officer and receive prompt, documented resolution.\n' +
      '• Right to Nominate (Section 14): You may designate an individual who shall, in the event of death or incapacity, exercise your data rights on your behalf.\n' +
      '• Right to Approach the Board: If your grievance is not resolved satisfactorily, you may make a complaint to the Data Protection Board of India.',
  },
  {
    title: '6. Robust Technical & Organizational Security Safeguards',
    content:
      'Pursuant to Section 8(5) of DPDPA 2023, CounterPro implements reasonable security safeguards to prevent personal data breaches:\n\n' +
      '• Encryption in Transit: All communications between the app and backend cloud services are encrypted using TLS 1.3 cryptographic protocols.\n' +
      '• Encryption at Rest: Data stored in our cloud infrastructure is protected using AES-256 standard encryption.\n' +
      '• Local-First Resilient Cache: Offline transaction records are isolated securely within local sandboxed device storage.\n' +
      '• Strict Role-Based Access: Counter staff (Billers, Supervisors) only receive scoped operational access configured by the shop Owner.',
  },
  {
    title: '7. Data Retention & Statutory Compliance',
    content:
      'Personal data is retained only for the duration necessary to satisfy the purpose for which it was collected, or as mandated by statutory Indian laws (such as GST Act, 2017 record-keeping requirements for sales tax invoices). Once statutory obligations expire or upon account erasure, data is permanently scrubbed.',
  },
  {
    title: '8. Grievance Redressal Officer & Contact Details',
    content:
      'If you have any questions, concerns, or grievances regarding the processing of your personal data, you may reach our designated Grievance Officer:\n\n' +
      '• Designation: Grievance Redressal Officer (DPDPA 2023)\n' +
      '• Organization: CounterPro / TecStellar\n' +
      '• Email: grievance@counterpro.in\n' +
      '• General Support: support@counterpro.in\n' +
      '• Response Timeline: Acknowledged within 24 hours, resolved within 7 business days.\n' +
      '• Regulatory Authority: Data Protection Board of India (DPBI).',
  },
];

export const TERMS_OF_SERVICE_SECTIONS: LegalSection[] = [
  {
    title: '1. CounterPro Merchant Agreement',
    content:
      'These Terms of Service govern your access to and use of CounterPro / Counter365 ("App"), a point-of-sale, inventory, and counter billing system provided by TecStellar / CounterPro. By accessing or using the App, you agree to be bound by these Terms and our DPDPA-compliant Privacy Policy.',
  },
  {
    title: '2. Merchant Responsibilities as Data Fiduciary for End Customers',
    content:
      'When entering customer mobile numbers or personal details at the billing counter to issue digital WhatsApp or SMS invoices, the Merchant acts as the Data Fiduciary/Controller under DPDPA 2023. The Merchant warrants that customer contact information is gathered lawfully with customer knowledge for the sole purpose of transaction delivery.',
  },
  {
    title: '3. GST, Taxation & Commercial Compliance',
    content:
      'CounterPro provides automated calculation aids for Indian GST rates (0%, 5%, 12%, 18%, 28%). The Merchant is solely responsible for determining the accurate HSN/SAC classification, setting lawful tax rates, issuing valid tax invoices, and filing statutory returns with commercial tax authorities. CounterPro is an operational tool and does not provide legal or tax advice.',
  },
  {
    title: '4. Hardware, Bluetooth Thermal Printers & Peripherals',
    content:
      'CounterPro connects with standard ESC/POS 58mm and 80mm Bluetooth thermal printers. While we rigorously test compatibility across standard ESC/POS hardware, hardware performance depends on printer firmware, Bluetooth range, and paper rolls. Digital sharing via WhatsApp is always available as an instantaneous zero-cost backup.',
  },
  {
    title: '5. Local-First Durable Operation & Cloud Synchronization',
    content:
      'CounterPro is engineered with local-first durable storage. In the event of network disruption or power loss, transactions remain securely saved on the local device. Queued transactions synchronize automatically to the cloud database once an active internet connection is re-established. Merchants must ensure devices are not factory-reset or uninstalled while offline mutations remain un-synced.',
  },
  {
    title: '6. Account Security & Multi-User Staff Access',
    content:
      'Shop Owners may authorize Biller and Supervisor accounts. The Owner is responsible for maintaining access hygiene, revoking access of departed staff members, and safeguarding device access codes. Any operation performed under an authorized staff login shall be deemed authorized by the shop owner.',
  },
  {
    title: '7. Prohibited Uses',
    content:
      'You agree not to use CounterPro for: (a) fraudulent billing, fictitious invoices, or money laundering; (b) unauthorized distribution of unsolicited spam messages; (c) reverse engineering, decompiling, or attempting to compromise the security of the App or its cloud APIs.',
  },
  {
    title: '8. Account Termination & Data Deletion',
    content:
      'You may terminate your account at any time. CounterPro provides an immediate, irreversible "Permanently Delete Account" mechanism in the Account screen. Upon execution, all shop configuration, menu items, sales records, customer directories, and expense entries are permanently scrubbed from our active cloud database.',
  },
  {
    title: '9. Limitation of Liability & Governing Law',
    content:
      'To the maximum extent permitted by Indian law, CounterPro shall not be liable for indirect, incidental, or consequential damages resulting from hardware failures, network interruptions, or merchant calculation errors. These Terms are governed by and construed in accordance with the laws of India, and any disputes shall be subject to the exclusive jurisdiction of the competent courts in India.',
  },
];
