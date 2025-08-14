import * as Location from 'expo-location';
import { Alert } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface LocationError {
  error: string;
  details?: string;
}

/**
 * Solicita permisos de ubicación al usuario
 * @returns Promise<boolean> - true si los permisos fueron concedidos
 */
export const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    
    // Verificar si los permisos ya fueron concedidos
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return true;
    }
    
    // Solicitar permisos
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permisos de Ubicación',
        'Para registrar la ubicación de las mediciones, necesitamos acceso a tu ubicación. Puedes habilitarlo en la configuración de la aplicación.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    Alert.alert(
      'Error',
      'No se pudieron solicitar los permisos de ubicación. Inténtalo de nuevo.',
      [{ text: 'OK' }]
    );
    return false;
  }
};

/**
 * Obtiene la ubicación actual del dispositivo
 * @returns Promise<LocationData | LocationError> - Los datos de ubicación o un error
 */
export const getCurrentLocation = async (): Promise<LocationData | LocationError> => {
  try {
    
    // Verificar permisos primero
    const hasPermissions = await requestLocationPermissions();
    if (!hasPermissions) {
      return {
        error: 'Permisos de ubicación denegados',
        details: 'El usuario no concedió permisos para acceder a la ubicación'
      };
    }
    
    // Verificar si los servicios de ubicación están habilitados
    const isLocationEnabled = await Location.hasServicesEnabledAsync();
    if (!isLocationEnabled) {
      Alert.alert(
        'Servicios de Ubicación',
        'Los servicios de ubicación están deshabilitados. Por favor, habilítalos en la configuración del dispositivo.',
        [{ text: 'OK' }]
      );
      return {
        error: 'Servicios de ubicación deshabilitados',
        details: 'Los servicios de ubicación del dispositivo están deshabilitados'
      };
    }
    
    // Obtener la ubicación actual con alta precisión
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
    
    const locationData: LocationData = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || undefined,
      timestamp: location.timestamp
    };
    
    return locationData;
    
  } catch (error) {
    let errorMessage = 'No se pudo obtener la ubicación actual';
    let errorDetails = 'Error desconocido';
    
    if (error instanceof Error) {
      errorDetails = error.message;
      
      // Mensajes de error más específicos
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'Tiempo de espera agotado';
        errorDetails = 'No se pudo obtener la ubicación en el tiempo esperado. Asegúrate de estar en un área con buena señal GPS.';
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        errorMessage = 'Permisos insuficientes';
        errorDetails = 'No se tienen los permisos necesarios para acceder a la ubicación.';
      } else if (error.message.includes('unavailable') || error.message.includes('disabled')) {
        errorMessage = 'Ubicación no disponible';
        errorDetails = 'Los servicios de ubicación no están disponibles en este dispositivo.';
      }
    }
    
    return {
      error: errorMessage,
      details: errorDetails
    };
  }
};

/**
 * Convierte coordenadas decimales a formato de grados, minutos y segundos
 * @param decimal - Coordenada en formato decimal
 * @param isLatitude - true para latitud, false para longitud
 * @returns string - Coordenada en formato DMS
 */
export const formatCoordinatesDMS = (decimal: number, isLatitude: boolean): string => {
  const direction = isLatitude 
    ? (decimal >= 0 ? 'N' : 'S') 
    : (decimal >= 0 ? 'E' : 'W');
  
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutes = Math.floor((absolute - degrees) * 60);
  const seconds = ((absolute - degrees - minutes / 60) * 3600).toFixed(2);
  
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
};

/**
 * Formatea las coordenadas para mostrar de manera legible
 * @param locationData - Datos de ubicación
 * @returns object - Coordenadas formateadas
 */
export const formatLocationForDisplay = (locationData: LocationData) => {
  return {
    decimal: {
      latitude: locationData.latitude.toFixed(6),
      longitude: locationData.longitude.toFixed(6)
    },
    dms: {
      latitude: formatCoordinatesDMS(locationData.latitude, true),
      longitude: formatCoordinatesDMS(locationData.longitude, false)
    },
    accuracy: locationData.accuracy ? `±${locationData.accuracy.toFixed(1)}m` : 'N/A',
    timestamp: new Date(locationData.timestamp).toLocaleString('es-ES')
  };
};

/**
 * Genera un enlace de Google Maps para las coordenadas dadas
 * @param locationData - Datos de ubicación
 * @param label - Etiqueta opcional para el marcador en el mapa
 * @returns string - URL de Google Maps
 */
export const generateGoogleMapsLink = (locationData: LocationData, label?: string): string => {
  const lat = locationData.latitude;
  const lng = locationData.longitude;
  
  const coordinates = `${lat},${lng}`;
  const labelPart = label ? `(${encodeURIComponent(label)})` : '';
  
  return `https://www.google.com/maps/search/?api=1&query=${coordinates}${labelPart}`;
};

/**
 * Genera múltiples tipos de enlaces de mapas para las coordenadas
 * @param locationData - Datos de ubicación
 * @param label - Etiqueta opcional para el marcador
 * @returns object - Enlaces para diferentes servicios de mapas
 */
export const generateMapLinks = (locationData: LocationData, label?: string) => {
  const lat = locationData.latitude;
  const lng = locationData.longitude;
  const encodedLabel = label ? encodeURIComponent(label) : '';
  
  return {
    googleMaps: generateGoogleMapsLink(locationData, label),
    appleMaps: `http://maps.apple.com/?q=${lat},${lng}${label ? `&ll=${lat},${lng}` : ''}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    coordinates: `${lat},${lng}`
  };
}; 