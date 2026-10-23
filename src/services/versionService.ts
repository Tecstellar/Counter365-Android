import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../constants/appConfig';
import { isVersionOutdated } from '../lib/versionCompare';

export interface AppVersionConfig {
  id: string;
  minRequiredVersion: string;
  latestVersion: string;
  isMandatoryUpdate: boolean;
  updateTitle: string;
  updateMessage: string;
  downloadUrl: string;
}

export interface VersionCheckResult {
  updateRequired: boolean;
  isMandatory: boolean;
  config: AppVersionConfig | null;
  currentVersion: string;
  minRequiredVersion: string;
}

export const versionService = {
  /**
   * Fetches the authoritative app version control row from Supabase.
   */
  async getRemoteVersionConfig(): Promise<AppVersionConfig | null> {
    try {
      if (!supabase) return null;
      const { data, error } = await (supabase.from('app_version_control') as any)
        .select('*')
        .eq('id', 'counterpro_android')
        .single();

      if (error || !data) {
        // Fallback check: try fetching any first row if specific ID differs
        const { data: fallbackData } = await (supabase.from('app_version_control') as any)
          .select('*')
          .limit(1)
          .single();
        if (fallbackData) {
          return {
            id: fallbackData.id,
            minRequiredVersion: fallbackData.min_required_version || '1.0.4',
            latestVersion: fallbackData.latest_version || '1.0.4',
            isMandatoryUpdate: fallbackData.is_mandatory_update !== false,
            updateTitle: fallbackData.update_title || 'Update Required',
            updateMessage:
              fallbackData.update_message ||
              'Please update the app to continue using the service.',
            downloadUrl:
              fallbackData.download_url || APP_CONFIG.playStoreUrl,
          };
        }
        return null;
      }

      return {
        id: data.id,
        minRequiredVersion: data.min_required_version || '1.0.4',
        latestVersion: data.latest_version || '1.0.4',
        isMandatoryUpdate: data.is_mandatory_update !== false,
        updateTitle: data.update_title || 'Update Required',
        updateMessage:
          data.update_message ||
          'Please update the app to continue using the service.',
        downloadUrl: data.download_url || APP_CONFIG.playStoreUrl,
      };
    } catch (err) {
      console.warn('versionService.getRemoteVersionConfig notice:', err);
      return null;
    }
  },

  /**
   * Checks whether the currently installed app version meets the Supabase requirement.
   */
  async checkVersion(
    installedVersion: string = APP_CONFIG.version
  ): Promise<VersionCheckResult> {
    const config = await this.getRemoteVersionConfig();
    if (!config) {
      return {
        updateRequired: false,
        isMandatory: false,
        config: null,
        currentVersion: installedVersion,
        minRequiredVersion: installedVersion,
      };
    }

    const outdated = isVersionOutdated(installedVersion, config.minRequiredVersion);
    const updateRequired = outdated && config.isMandatoryUpdate;

    return {
      updateRequired,
      isMandatory: config.isMandatoryUpdate,
      config,
      currentVersion: installedVersion,
      minRequiredVersion: config.minRequiredVersion,
    };
  },

  /**
   * Subscribes to Supabase Realtime changes on `app_version_control`.
   * When an admin changes the minimum required version in Supabase,
   * active devices immediately receive the update and lock the app screen.
   */
  subscribeToVersionUpdates(
    installedVersion: string = APP_CONFIG.version,
    onStatusChange: (result: VersionCheckResult) => void
  ): () => void {
    if (!supabase) {
      return () => {};
    }

    try {
      const channel = supabase
        .channel('app_version_control_changes')
        .on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table: 'app_version_control',
          },
          (payload: any) => {
            const row = payload.new || payload.record;
            if (row) {
              const config: AppVersionConfig = {
                id: row.id,
                minRequiredVersion: row.min_required_version || '1.0.4',
                latestVersion: row.latest_version || '1.0.4',
                isMandatoryUpdate: row.is_mandatory_update !== false,
                updateTitle: row.update_title || 'Update Required',
                updateMessage:
                  row.update_message ||
                  'Please update the app to continue using the service.',
                downloadUrl: row.download_url || APP_CONFIG.playStoreUrl,
              };

              const outdated = isVersionOutdated(
                installedVersion,
                config.minRequiredVersion
              );
              const updateRequired = outdated && config.isMandatoryUpdate;

              onStatusChange({
                updateRequired,
                isMandatory: config.isMandatoryUpdate,
                config,
                currentVersion: installedVersion,
                minRequiredVersion: config.minRequiredVersion,
              });
            }
          }
        )
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      };
    } catch (err) {
      console.warn('versionService subscription warning:', err);
      return () => {};
    }
  },
};
