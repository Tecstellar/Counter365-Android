const mockSelectPrinterAsync = jest.fn();
const mockPrintAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-print', () => ({
  get printAsync() {
    return mockPrintAsync;
  },
  get selectPrinterAsync() {
    return mockSelectPrinterAsync;
  },
}));

import { printerService } from '../src/services/printerService';

describe('Thermal Printer Reliability & Genuine Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('scanForPrinters returns genuine discovered printer when platform reports one', async () => {
    mockSelectPrinterAsync.mockResolvedValueOnce({
      name: 'Epson TM-T88VI Thermal Printer',
      url: 'ipp://192.168.1.150:631/ipp/print',
    });

    const res = await printerService.scanForPrinters();
    expect(res.printers.length).toBe(1);
    expect(res.printers[0].name).toBe('Epson TM-T88VI Thermal Printer');
    expect(res.printers[0].url).toBe('ipp://192.168.1.150:631/ipp/print');
    expect(res.printers[0].connectionType).toBe('airprint');
  });

  test('scanForPrinters returns empty list with clear explanation when no printer responds (never inserts fake devices)', async () => {
    mockSelectPrinterAsync.mockResolvedValueOnce(null);

    const res = await printerService.scanForPrinters();
    expect(res.printers).toHaveLength(0);
    expect(res.explanation).toBeDefined();
    expect(res.explanation).toContain('thermal');
  });

  test('connectNetworkPrinter rejects invalid IP formats and accepts valid IPv4 address', async () => {
    const invalidRes = await printerService.connectNetworkPrinter('999.999.999.9999');
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain('Invalid IPv4');

    const validRes = await printerService.connectNetworkPrinter('192.168.1.100', 9100, 'Kitchen Printer');
    expect(validRes.success).toBe(true);
    expect(validRes.printer?.name).toBe('Kitchen Printer');
    expect(validRes.printer?.url).toBe('http://192.168.1.100:9100');
    expect(validRes.printer?.connectionType).toBe('network');
  });

  test('printTestSlip formats authentic slip and executes Print.printAsync', async () => {
    const res = await printerService.printTestSlip('Raja Tea Stall', '12 Market St', '9876543210', undefined, '80mm');
    expect(res.success).toBe(true);
    expect(mockPrintAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Raja Tea Stall'),
      })
    );
  });

  test('printTestSlip accurately reports failure if Print.printAsync rejects', async () => {
    mockPrintAsync.mockRejectedValueOnce(new Error('Hardware buffer full'));
    const res = await printerService.printTestSlip('Raja Tea Stall', '12 Market St', '9876543210');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Hardware buffer full');
  });

  test('disconnectPrinter clears saved active printer state', async () => {
    await printerService.saveActivePrinter({
      id: 'test_1',
      name: 'Counter Printer',
      connectionType: 'network',
      discoveredAt: Date.now(),
    });

    let active = await printerService.getActivePrinter();
    expect(active?.name).toBe('Counter Printer');

    await printerService.disconnectPrinter();
    active = await printerService.getActivePrinter();
    expect(active).toBeNull();
  });
});
