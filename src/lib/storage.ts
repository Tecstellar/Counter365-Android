import AsyncStorage from '@react-native-async-storage/async-storage';

// Memory store fallback for testing or initial load
const memoryStore: Record<string, string> = {};

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (AsyncStorage && AsyncStorage.getItem) {
        return await AsyncStorage.getItem(key);
      }
      return memoryStore[key] || null;
    } catch {
      return memoryStore[key] || null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      memoryStore[key] = value;
      if (AsyncStorage && AsyncStorage.setItem) {
        await AsyncStorage.setItem(key, value);
      }
    } catch {
      memoryStore[key] = value;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      delete memoryStore[key];
      if (AsyncStorage && AsyncStorage.removeItem) {
        await AsyncStorage.removeItem(key);
      }
    } catch {
      delete memoryStore[key];
    }
  },

  async getObject<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const val = await this.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  async setObject<T>(key: string, value: T): Promise<void> {
    try {
      await this.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('Storage setObject error:', err);
    }
  },

  async clear(): Promise<void> {
    try {
      Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
      if (AsyncStorage && AsyncStorage.clear) {
        await AsyncStorage.clear();
      }
    } catch {
      Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
    }
  }
};
