import * as Updates from 'expo-updates';

const mockAlert = jest.fn();
let mockIsEnabled = false;

jest.mock('react-native', () => ({
  Alert: {
    alert: (...args: any[]) => mockAlert(...args),
  },
}));

jest.mock('expo-updates', () => ({
  get isEnabled() {
    return mockIsEnabled;
  },
  isEmbeddedLaunch: true,
  updateId: null,
  channel: null,
  runtimeVersion: null,
  createdAt: null,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

import { otaUpdateService } from '../src/services/otaUpdateService';

describe('OTA Update Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
    mockIsEnabled = false;
  });

  it('safely returns update metadata when updates are disabled', () => {
    const info = otaUpdateService.getUpdateInfo();
    expect(info.isEnabled).toBe(false);
    expect(info.isEmbeddedLaunch).toBe(true);
  });

  it('shows development mode alert with preview option in interactive mode when updates are disabled', async () => {
    mockIsEnabled = false;
    const result = await otaUpdateService.checkForUpdateAndPrompt(true);
    expect(result).toBe(false);
    expect(mockAlert).toHaveBeenCalledWith(
      expect.stringContaining('OTA Updates'),
      expect.stringContaining('Over-The-Air updates are active in standalone production builds'),
      expect.any(Array)
    );
  });

  it('silently ignores check when updates are disabled and not interactive', async () => {
    mockIsEnabled = false;
    const result = await otaUpdateService.checkForUpdateAndPrompt(false);
    expect(result).toBe(false);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('downloads update and notifies UI listeners to display the custom OtaUpdateModal', async () => {
    mockIsEnabled = true;
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({ isAvailable: true });
    (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({ isNew: true });

    const mockListener = jest.fn();
    const unsubscribe = otaUpdateService.subscribe(mockListener);

    const result = await otaUpdateService.checkForUpdateAndPrompt(false);
    expect(result).toBe(true);
    expect(Updates.checkForUpdateAsync).toHaveBeenCalled();
    expect(Updates.fetchUpdateAsync).toHaveBeenCalled();
    expect(mockListener).toHaveBeenCalledWith(true);

    unsubscribe();
  });

  it('alerts that app is up to date when interactive and no update is available', async () => {
    mockIsEnabled = true;
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({ isAvailable: false });

    const result = await otaUpdateService.checkForUpdateAndPrompt(true);
    expect(result).toBe(false);
    expect(mockAlert).toHaveBeenCalledWith(
      'Up to Date',
      expect.stringContaining('running the latest available version')
    );
  });
});
