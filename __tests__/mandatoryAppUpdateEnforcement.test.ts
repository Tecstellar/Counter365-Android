import { compareVersions, isVersionOutdated, parseVersionNumbers } from '../src/lib/versionCompare';
import { versionService, AppVersionConfig } from '../src/services/versionService';

describe('Mandatory App Update Enforcement System', () => {
  describe('Semantic Version Parsing and Comparison', () => {
    test('parses standard 3-digit semantic versions into numbers', () => {
      expect(parseVersionNumbers('1.0.4')).toEqual([1, 0, 4]);
      expect(parseVersionNumbers('2.15.100')).toEqual([2, 15, 100]);
      expect(parseVersionNumbers('v1.0.5')).toEqual([1, 0, 5]);
      expect(parseVersionNumbers('1.0')).toEqual([1, 0, 0]);
    });

    test('correctly compares version numbers', () => {
      expect(compareVersions('1.0.4', '1.0.4')).toBe(0);
      expect(compareVersions('1.0.4', '1.0.5')).toBe(-1);
      expect(compareVersions('1.0.5', '1.0.4')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersions('1.0.4', '2.0.0')).toBe(-1);
    });

    test('isVersionOutdated returns true only when installed < minRequired', () => {
      // Installed is 1.0.4, min required is 1.0.5 -> outdated
      expect(isVersionOutdated('1.0.4', '1.0.5')).toBe(true);

      // Installed is 1.0.4, min required is 1.0.4 -> up to date
      expect(isVersionOutdated('1.0.4', '1.0.4')).toBe(false);

      // Installed is 1.0.5, min required is 1.0.4 -> up to date
      expect(isVersionOutdated('1.0.5', '1.0.4')).toBe(false);

      // Installed is 1.0.4, min required is 2.0.0 -> outdated
      expect(isVersionOutdated('1.0.4', '2.0.0')).toBe(true);
    });
  });

  describe('Version Service Remote Check Logic', () => {
    test('triggers mandatory update when remote min_required_version exceeds installed version', async () => {
      const mockConfig: AppVersionConfig = {
        id: 'counterpro_android',
        minRequiredVersion: '1.0.5',
        latestVersion: '1.0.5',
        isMandatoryUpdate: true,
        updateTitle: 'Update Required',
        updateMessage: 'Please update the app to continue using the service.',
        downloadUrl: 'https://play.google.com/store/apps/details?id=com.counterpro.bill',
      };

      jest.spyOn(versionService, 'getRemoteVersionConfig').mockResolvedValueOnce(mockConfig);

      const result = await versionService.checkVersion('1.0.4');

      expect(result.updateRequired).toBe(true);
      expect(result.isMandatory).toBe(true);
      expect(result.config?.updateTitle).toBe('Update Required');
      expect(result.config?.updateMessage).toBe(
        'Please update the app to continue using the service.'
      );
    });

    test('does NOT trigger update when installed version matches or exceeds min_required_version', async () => {
      const mockConfig: AppVersionConfig = {
        id: 'counterpro_android',
        minRequiredVersion: '1.0.4',
        latestVersion: '1.0.4',
        isMandatoryUpdate: true,
        updateTitle: 'Update Required',
        updateMessage: 'Please update the app to continue using the service.',
        downloadUrl: 'https://play.google.com/store/apps/details?id=com.counterpro.bill',
      };

      jest.spyOn(versionService, 'getRemoteVersionConfig').mockResolvedValueOnce(mockConfig);

      const result = await versionService.checkVersion('1.0.4');

      expect(result.updateRequired).toBe(false);
    });

    test('respects isMandatoryUpdate=false flag if soft update is configured', async () => {
      const mockConfig: AppVersionConfig = {
        id: 'counterpro_android',
        minRequiredVersion: '1.0.5',
        latestVersion: '1.0.5',
        isMandatoryUpdate: false,
        updateTitle: 'New Version Available',
        updateMessage: 'A new version is available.',
        downloadUrl: 'https://play.google.com/store/apps/details?id=com.counterpro.bill',
      };

      jest.spyOn(versionService, 'getRemoteVersionConfig').mockResolvedValueOnce(mockConfig);

      const result = await versionService.checkVersion('1.0.4');

      expect(result.updateRequired).toBe(false);
      expect(result.isMandatory).toBe(false);
    });
  });
});
