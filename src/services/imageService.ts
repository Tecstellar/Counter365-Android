import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

export interface PickImageResult {
  success: boolean;
  uri?: string;
  logoUrl?: string;
  error?: string;
}

export const imageService = {
  /**
   * Pick an image from gallery and upload/store permanently in Supabase
   */
  async pickShopLogo(): Promise<PickImageResult> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return {
          success: false,
          error: 'Photo library permission was denied. Please allow photo access in settings.',
        };
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { success: false };
      }

      const asset = result.assets[0];
      const localUri = asset.uri;
      const base64Data = asset.base64;

      // Base64 data URI format (durable, lightweight, self-contained)
      const dataUri = base64Data ? `data:image/jpeg;base64,${base64Data}` : localUri;

      // Try uploading to Supabase Storage bucket 'shop-logos'
      let finalUrl = dataUri || localUri;
      try {
        if (base64Data && typeof atob === 'function') {
          const filePath = `logos/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
          
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteNumbers.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('shop-logos')
            .upload(filePath, byteArray, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!uploadErr && uploadData) {
            const { data: publicData } = supabase.storage
              .from('shop-logos')
              .getPublicUrl(filePath);

            if (publicData?.publicUrl) {
              finalUrl = publicData.publicUrl;
            }
          }
        }
      } catch (uploadNotice) {
        console.warn('Supabase storage bucket upload notice (using dataUri fallback):', uploadNotice);
      }

      return {
        success: true,
        uri: localUri,
        logoUrl: finalUrl,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to select image.',
      };
    }
  },
};
