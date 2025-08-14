import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Linking, Alert } from 'react-native';
import strings from '@locales/es';
import styles from '@styles/FormStyles';
import { getCurrentLocation, LocationData, LocationError, formatLocationForDisplay } from '../utils/locationService';
import { useAuth } from '../../App';

export default function FormScreen({ navigation }: any) {
  const [measurementName, setMeasurementName] = useState('Prueba');
  const [comment, setComment] = useState('Este es un comentario de prueba');
  const [humidity, setHumidity] = useState('0.5');
  const [isValid, setIsValid] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualGPS, setIsManualGPS] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [manualCoordinatesError, setManualCoordinatesError] = useState<string | null>(null);
  const [humidityError, setHumidityError] = useState<string | null>(null);
  const { logout } = useAuth();

  // Función para validar coordenadas manuales
  const validateManualCoordinates = (lat: string, lng: string): string | null => {
    if (!lat.trim() || !lng.trim()) {
      return null; // No mostrar mensaje, solo no permitir continuar
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return strings.formScreen.invalidCoordinates;
    }

    if (latitude < -90 || latitude > 90) {
      return strings.formScreen.latitudeRange;
    }

    if (longitude < -180 || longitude > 180) {
      return strings.formScreen.longitudeRange;
    }

    return null;
  };

  // Función para validar humedad
  const validateHumidity = (value: string): string | null => {
    if (!value.trim()) {
      return null; // No mostrar mensaje si está vacío, solo no permitir continuar
    }

    const humidityValue = parseFloat(value);

    if (isNaN(humidityValue)) {
      return strings.formScreen.invalidHumidity;
    }

    return null;
  };

  // Función para crear LocationData desde coordenadas manuales
  const createManualLocationData = (lat: string, lng: string): LocationData => {
    return {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      timestamp: Date.now(),
      accuracy: undefined // No hay precisión en coordenadas manuales
    };
  };

  const handleLogout = () => {
    Alert.alert(
      strings.startScreen.logout,
      strings.startScreen.logoutConfirm,
      [
        {
          text: strings.startScreen.cancel,
          style: 'cancel',
        },
        {
          text: strings.startScreen.confirm,
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // No necesitamos navegar - el contexto cambiará automáticamente a login
            } catch (error) {
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    // El formulario es válido cuando todos los campos están llenos Y tenemos ubicación GPS
    const baseFieldsValid = measurementName.trim().length > 0 && comment.trim().length > 0;
    
    // Validar humedad
    const hasHumidity = humidity.trim().length > 0;
    const humidityValidationError = validateHumidity(humidity);
    setHumidityError(humidityValidationError);
    const humidityValid = hasHumidity && humidityValidationError === null;
    
    const formFieldsValid = baseFieldsValid && humidityValid;
    
    let locationReady = false;
    if (isManualGPS) {
      // Para GPS manual, validamos las coordenadas manuales
      const hasCoordinates = manualLatitude.trim().length > 0 && manualLongitude.trim().length > 0;
      const manualError = validateManualCoordinates(manualLatitude, manualLongitude);
      setManualCoordinatesError(manualError);
      locationReady = hasCoordinates && manualError === null;
    } else {
      // Para GPS automático, usamos la lógica existente
      locationReady = locationData !== null && !isGettingLocation;
      setManualCoordinatesError(null);
    }
    
    setIsValid(formFieldsValid && locationReady);
  }, [measurementName, comment, humidity, locationData, isGettingLocation, isManualGPS, manualLatitude, manualLongitude]);

  // Obtener ubicación GPS al cargar el formulario (solo en modo automático)
  useEffect(() => {
    if (!isManualGPS) {
      const getLocation = async () => {
        setIsGettingLocation(true);
        setLocationError(null);
        
        try {
          const result = await getCurrentLocation();
          
          if ('error' in result) {
            setLocationError(result.error);
            setLocationData(null);
          } else {
            setLocationData(result);
            setLocationError(null);
          }
        } catch (error) {
          setLocationError(strings.formScreen.unexpectedLocationError);
          setLocationData(null);
        } finally {
          setIsGettingLocation(false);
        }
      };

      getLocation();
    } else {
      // En modo manual, limpiar datos automáticos
      setLocationData(null);
      setLocationError(null);
      setIsGettingLocation(false);
    }
  }, [isManualGPS]);

  const handleStart = () => {
    if (isValid) {
      let finalLocationData: LocationData;
      
      if (isManualGPS) {
        // Crear LocationData desde coordenadas manuales
        finalLocationData = createManualLocationData(manualLatitude, manualLongitude);
      } else {
        // Usar LocationData automático
        if (!locationData) return; // Verificación de seguridad
        finalLocationData = locationData;
      }
      
      navigation.navigate('DualChannelRecording', { 
        measurementName, 
        comment, 
        humidity, 
        locationData: finalLocationData 
      });
    }
  };

  // Función para reintentar obtener ubicación
  const retryLocation = async () => {
    setIsGettingLocation(true);
    setLocationError(null);
    
    try {
      const result = await getCurrentLocation();
      
      if ('error' in result) {
        setLocationError(result.error);
        setLocationData(null);
      } else {
        setLocationData(result);
        setLocationError(null);
      }
    } catch (error) {
      setLocationError(strings.formScreen.unexpectedLocationError);
      setLocationData(null);
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Función para abrir Google Maps con la ubicación
  const openGoogleMaps = async () => {
    let targetLocationData: LocationData | null = null;
    
    if (isManualGPS && manualLatitude && manualLongitude) {
      targetLocationData = createManualLocationData(manualLatitude, manualLongitude);
    } else if (!isManualGPS && locationData) {
      targetLocationData = locationData;
    }
    
    if (!targetLocationData || typeof targetLocationData.latitude !== 'number' || typeof targetLocationData.longitude !== 'number') {
      return;
    }
        
    try {
        const lat = targetLocationData.latitude;
        const lng = targetLocationData.longitude;
        const label = encodeURIComponent(measurementName || strings.formScreen.defaultLocationLabel);
        
        const mapsUrl = `https://maps.google.com/maps?q=${label}@${lat},${lng}`;
            
      const canOpen = await Linking.canOpenURL(mapsUrl);
      
      if (canOpen) {
        await Linking.openURL(mapsUrl);
      } else {
        const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
          
        const canOpenGeo = await Linking.canOpenURL(geoUrl);
        if (canOpenGeo) {
          await Linking.openURL(geoUrl);
        } else {
          Alert.alert(strings.common.error, strings.formScreen.errorOpeningMaps);
        }
      }
    } catch (error) {
      Alert.alert(strings.common.error, strings.formScreen.errorOpeningMaps);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{strings.formScreen.title}</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>{strings.startScreen.logout}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.formContainer} 
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: isManualGPS ? 80 : 40 }}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.label}>{strings.startScreen.nameLabel}</Text>
        <TextInput
          style={styles.input}
          value={measurementName}
          onChangeText={setMeasurementName}
          placeholder={strings.startScreen.namePlaceholder}
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>{strings.startScreen.commentLabel}</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={comment}
          onChangeText={setComment}
          placeholder={strings.startScreen.commentPlaceholder}
          placeholderTextColor="#aaa"
          multiline
        />
        <Text style={styles.label}>{strings.startScreen.humidityLabel}</Text>
        <TextInput
          style={styles.input}
          value={humidity}
          onChangeText={setHumidity}
          placeholder={strings.startScreen.humidityPlaceholder}
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
          inputMode="decimal"
        />

        {/* Mostrar error de validación de humedad si existe */}
        {humidityError && (
          <View style={{
            backgroundColor: '#fff3e0',
            padding: 12,
            borderRadius: 8,
            borderColor: '#FF9800',
            borderWidth: 1,
            marginBottom: 16,
            marginTop: -16
          }}>
            <Text style={{ fontSize: 12, color: '#FF9800', fontWeight: '500' }}>
              ⚠️ {humidityError}
            </Text>
          </View>
        )}

        {/* Sección de ubicación GPS */}
        <Text style={styles.label}>{strings.formScreen.gpsLabel}</Text>
        
        {/* Toggle para GPS automático vs manual */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ 
            flexDirection: 'row', 
            backgroundColor: '#f0f0f0', 
            borderRadius: 8, 
            padding: 4 
          }}>
            <TouchableOpacity
              style={[{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 6,
                alignItems: 'center'
              }, !isManualGPS && {
                backgroundColor: '#007AFF',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2
              }]}
              onPress={() => setIsManualGPS(false)}
            >
              <Text style={[{
                fontSize: 14,
                fontWeight: '500'
              }, !isManualGPS ? { color: 'white' } : { color: '#666' }]}>
                {strings.formScreen.automatic}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 6,
                alignItems: 'center'
              }, isManualGPS && {
                backgroundColor: '#007AFF',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2
              }]}
              onPress={() => setIsManualGPS(true)}
            >
              <Text style={[{
                fontSize: 14,
                fontWeight: '500'
              }, isManualGPS ? { color: 'white' } : { color: '#666' }]}>
                {strings.formScreen.manual}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenido condicional según el modo GPS */}
        {!isManualGPS ? (
          // GPS Automático
          <TouchableOpacity
            style={[styles.input, { 
              padding: 16, 
              backgroundColor: isGettingLocation ? '#f0f8ff' : locationData ? '#e8f5e8' : '#fff3e0',
              borderColor: isGettingLocation ? '#007AFF' : locationData ? '#4CAF50' : '#FF9800',
              minHeight: 100,
              justifyContent: 'center',
              alignItems: 'stretch'
            }]}
            onPress={locationData ? openGoogleMaps : retryLocation}
            disabled={isGettingLocation}
            activeOpacity={0.7}
          >
            {isGettingLocation ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={{ marginLeft: 8, color: '#007AFF' }}>
                  {strings.formScreen.gettingLocation}
                </Text>
              </View>
            ) : locationData ? (
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#4CAF50', marginBottom: 8 }}>
                  {strings.formScreen.locationObtained}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                  {strings.formScreen.latitude}: {formatLocationForDisplay(locationData).decimal.latitude}°
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                  {strings.formScreen.longitude}: {formatLocationForDisplay(locationData).decimal.longitude}°
                </Text>
                <Text style={{ fontSize: 11, color: '#999' }}>
                  {strings.formScreen.accuracy}: {formatLocationForDisplay(locationData).accuracy}
                </Text>
                <Text style={{ fontSize: 10, color: '#007AFF', marginTop: 4 }}>
                  📍 Toca para ver en Google Maps
                </Text>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF9800', marginBottom: 8 }}>
                  {strings.formScreen.locationError}
                </Text>
                {locationError && (
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    {locationError}
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        ) : (
          // GPS Manual
          <View>            
            {/* Campo de Latitud */}
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              {strings.formScreen.latitude}
            </Text>
            <TextInput
              style={[styles.input, { marginBottom: 16 }]}
              value={manualLatitude}
              onChangeText={setManualLatitude}
              placeholder={strings.formScreen.latitudePlaceholder}
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              inputMode="decimal"
            />

            {/* Campo de Longitud */}
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              {strings.formScreen.longitude}
            </Text>
            <TextInput
              style={[styles.input, { marginBottom: 16 }]}
              value={manualLongitude}
              onChangeText={setManualLongitude}
              placeholder={strings.formScreen.longitudePlaceholder}
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              inputMode="decimal"
            />

            {/* Mostrar error de validación si existe */}
            {manualCoordinatesError && (
              <View style={{
                backgroundColor: '#fff3e0',
                padding: 12,
                borderRadius: 8,
                borderColor: '#FF9800',
                borderWidth: 1,
                marginBottom: 16
              }}>
                <Text style={{ fontSize: 12, color: '#FF9800', fontWeight: '500' }}>
                  ⚠️ {manualCoordinatesError}
                </Text>
              </View>
            )}

            {/* Mostrar coordenadas válidas si están completas */}
            {!manualCoordinatesError && manualLatitude && manualLongitude && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#e8f5e8',
                  padding: 12,
                  borderRadius: 8,
                  borderColor: '#4CAF50',
                  borderWidth: 1,
                  marginBottom: 20
                }}
                onPress={openGoogleMaps}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#4CAF50', marginBottom: 8 }}>
                  ✅ {strings.formScreen.locationObtained}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                  {strings.formScreen.latitude}: {parseFloat(manualLatitude).toFixed(6)}°
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                  {strings.formScreen.longitude}: {parseFloat(manualLongitude).toFixed(6)}°
                </Text>
                <Text style={{ fontSize: 11, color: '#999' }}>
                  📍 Toca para ver en Google Maps
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={!isValid}
        >
          <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>
            {strings.startScreen.startButton}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
