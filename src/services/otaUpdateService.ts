import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

export interface OtaUpdateInfo {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  createdAt: string | null;
}

type OtaListener = (isReady: boolean) => void;
const listeners = new Set<OtaListener>();

export const otaUpdateService = {
  /**
   * Subscribe to OTA update events (e.g. to open OtaUpdateModal when an update is downloaded)
   */
  subscribe(listener: OtaListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Notify all registered UI listeners that an update is downloaded and ready to apply
   */
  notify(isReady: boolean) {
    listeners.forEach((fn) => {
      try {
        fn(isReady);
      } catch (err) {
        console.warn('OTA listener notification error:', err);
      }
    });
  },

  /**
   * Return metadata about the currently running bundle
   */
  getUpdateInfo(): OtaUpdateInfo {
    try {
      return {
        isEnabled: Updates.isEnabled ?? false,
        isEmbeddedLaunch: Updates.isEmbeddedLaunch ?? true,
        updateId: Updates.updateId ?? null,
        channel: Updates.channel ?? null,
        runtimeVersion: typeof Updates.runtimeVersion === 'string' ? Updates.runtimeVersion : null,
        createdAt: Updates.createdAt ? Updates.createdAt.toISOString() : null,
      };
    } catch {
      return {
        isEnabled: false,
        isEmbeddedLaunch: true,
        updateId: null,
        channel: null,
        runtimeVersion: null,
        createdAt: null,
      };
    }
  },

  /**
   * Apply the downloaded update and reload the application to start fresh on the Home screen
   */
  async applyUpdate(): Promise<void> {
    try {
      if (Updates.isEnabled) {
        await Updates.reloadAsync();
      }
    } catch (err) {
      console.warn('Failed to reload for OTA update:', err);
    }
  },

  /**
   * Check for an OTA update.
   * In production: downloads new bundle and triggers the beautiful OtaUpdateModal.
   * In development: provides a preview option to test the UI modal.
   */
  async checkForUpdateAndPrompt(interactive = false): Promise<boolean> {
    try {
      if (!Updates.isEnabled) {
        if (interactive) {
          Alert.alert(
            'OTA Updates (Development Mode)',
            'Over-The-Air updates are active in standalone production builds.\n\nWould you like to preview the update popup?',
            [
              { text: 'Close', style: 'cancel' },
              {
                text: 'Preview Popup',
                style: 'default',
                onPress: () => this.notify(true),
              },
            ]
          );
        }
        return false;
      }

      const checkResult = await Updates.checkForUpdateAsync();
      if (!checkResult.isAvailable) {
        if (interactive) {
          Alert.alert('Up to Date', 'Counter365 is running the latest available version.');
        }
        return false;
      }

      // Download the update in the background
      const fetchResult = await Updates.fetchUpdateAsync();
      if (fetchResult.isNew) {
        // Trigger the beautiful OtaUpdateModal
        this.notify(true);
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('OTA update check notice:', err);
      if (interactive) {
        Alert.alert('Update Check', err?.message || 'Could not verify updates at this time. Please try again later.');
      }
      return false;
    }
  },
};
