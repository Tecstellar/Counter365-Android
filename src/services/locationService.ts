import * as Location from 'expo-location';

export interface GpsLocationResult {
  latitude: number;
  longitude: number;
  formattedCoords: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
}

export const locationService = {
  /**
   * Request permission and extract live GPS coordinates with reverse geocoding
   */
  async getCurrentLocation(): Promise<{ success: boolean; data?: GpsLocationResult; error?: string }> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return {
          success: false,
          error: 'Location permission was denied. Please allow location access in your device settings.',
        };
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      const latDir = lat >= 0 ? 'N' : 'S';
      const lngDir = lng >= 0 ? 'E' : 'W';
      const formattedCoords = `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;

      let city: string | undefined;
      let state: string | undefined;
      let pincode: string | undefined;
      let address: string | undefined;

      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocode) {
          city = geocode.city || geocode.subregion || geocode.district || undefined;
          state = geocode.region || undefined;
          pincode = geocode.postalCode || undefined;
          
          const streetParts = [geocode.streetNumber, geocode.street, geocode.name].filter(Boolean);
          if (streetParts.length > 0) {
            address = streetParts.join(', ');
          }
        }
      } catch (geoErr) {
        console.warn('Reverse geocoding notice:', geoErr);
      }

      return {
        success: true,
        data: {
          latitude: lat,
          longitude: lng,
          formattedCoords,
          city,
          state,
          pincode,
          address,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Could not fetch device GPS location.',
      };
    }
  },
};
