/**
 * Food Image Storage Service
 * 
 * Handles uploading generated food images to Supabase Storage (bucket: 'menu-images')
 * with resilient offline local filesystem fallback (via expo-file-system)
 * so images are immediately durable and persistent.
 */

import { Paths, File } from 'expo-file-system';
import { supabase } from '../lib/supabase';

// Convert base64 string to Uint8Array for Supabase Storage upload
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const imageStorageService = {
  /**
   * Persists a generated food image.
   * 1. Attempts to upload to Supabase Storage 'menu-images' bucket
   * 2. Returns public Supabase URL if successful
   * 3. Falls back gracefully to durable local file storage or data URI if bucket is unavailable
   */
  async persistFoodImage(
    shopId: string,
    itemId: string,
    base64Data: string,
    mimeType: string = 'image/jpeg'
  ): Promise<string> {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `${itemId || 'item'}_${Date.now()}.${extension}`;
    const remotePath = `${shopId || 'common'}/${fileName}`;
    const fileBytes = base64ToUint8Array(cleanBase64);

    // 1. Try Supabase Storage upload
    try {
      const { data, error } = await supabase.storage
        .from('menu-images')
        .upload(remotePath, fileBytes, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error && data) {
        const { data: publicData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(remotePath);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      } else if (error) {
        console.warn('Supabase storage notice (falling back to local cache):', error.message);
      }
    } catch (storageErr: any) {
      console.warn('Supabase storage upload exception:', storageErr.message);
    }

    // 2. Local durable persistence fallback via expo-file-system (iOS / Android)
    try {
      if (Paths.document) {
        const file = new File(Paths.document, fileName);
        if (!file.exists) {
          file.create();
        }
        file.write(fileBytes);
        return file.uri;
      }
    } catch (fsErr: any) {
      console.warn('FileSystem local write notice:', fsErr?.message);
    }

    // 3. Web or in-memory fallback: data URI
    return `data:${mimeType};base64,${cleanBase64}`;
  },

  /**
   * Checks whether a menu item already possesses a valid, non-placeholder food photo
   */
  hasValidFoodImage(imageUrl?: string | null): boolean {
    if (!imageUrl) return false;
    const url = imageUrl.trim();
    if (url.length === 0) return false;
    if (url.includes('unsplash.com')) return false;
    return (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('file:') ||
      url.startsWith('data:') ||
      url.startsWith('content:')
    );
  },
};
