import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, BackHandler, Linking } from 'react-native';
import { Audio } from 'expo-av';
import { AudioModule } from 'expo-audio';
import AudioRecorder from '../components/AudioRecorder';
import WhiteNoisePlayer from '../components/WhiteNoisePlayer';
import { AudioDevice, DualChannelRecordingResult, AudioLevels } from '../types/DualChannelAudio';
import { LocationData } from '../utils/locationService';
import settings from '../locales/settings';
import strings from '@locales/es';

// URL de la API
const API_BASE_URL = 'https://porosity-estimation-api-1c6222e12625.herokuapp.com';
const requiredRecordingSeconds = (settings.m * settings.n) / settings.sampling_rate;

export default function DualChannelRecordingScreen({ navigation, route }: any) {
  // Extraer parámetros del formulario
  const { 
    measurementName = 'Grabación', 
    comment = 'Grabación completada', 
    humidity = '0.5',
    locationData: receivedLocationData = null
  } = route.params || {};

  const [isRecording, setIsRecording] = useState(false);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [recordingResult, setRecordingResult] = useState<DualChannelRecordingResult | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimeRef = useRef(0); // Ref para mantener el tiempo actual sin resetear
  const [audioLevels, setAudioLevels] = useState({ channel1: 0, channel2: 0 });
  const [hasNavigated, setHasNavigated] = useState(false);
  const [isProcessingAPI, setIsProcessingAPI] = useState(false);
  const [deviceCheckComplete, setDeviceCheckComplete] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(receivedLocationData);
  const [isWhiteNoisePlaying, setIsWhiteNoisePlaying] = useState(false);

  // Verificar y solicitar permisos de micrófono
  const ensureMicrophonePermission = async (): Promise<boolean> => {
    try {
      const current = await AudioModule.getRecordingPermissionsAsync();
      if (current.granted) return true;

      const requested = await AudioModule.requestRecordingPermissionsAsync();
      if (requested.granted) return true;

      Alert.alert(
        strings.audioRecorder.permissionsRequired,
        strings.audioRecorder.microphonePermissionMessage,
        [
          { text: strings.common.cancel, style: 'cancel' },
          { text: 'Abrir ajustes', onPress: () => { try { Linking.openSettings?.(); } catch (e) {} } }
        ]
      );
      return false;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let autoStopTimer: NodeJS.Timeout;
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          recordingTimeRef.current = newTime; // También actualizar la ref
          return newTime;
        });
      }, 1000);

      if (requiredRecordingSeconds > 0) {
        autoStopTimer = setTimeout(() => {
          setIsRecording(false);
        }, (requiredRecordingSeconds + 5)* 1000);
      }
    } else {
      setRecordingTime(0);
      recordingTimeRef.current = 0; // También resetear la ref
      // Resetear niveles de audio cuando no se está grabando
      setAudioLevels({ channel1: 0, channel2: 0 });
    }
    
    return () => {
      clearInterval(interval);
      clearTimeout(autoStopTimer);
    };
  }, [isRecording]);

  // Manejar botón de atrás durante grabación
  useEffect(() => {
    const backAction = () => {
      if (isRecording || isProcessingAPI) {
        return true; // Prevenir navegación hacia atrás
      }
      return false; // Permitir navegación normal
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [isRecording, isProcessingAPI, navigation]);

  // Configurar la cabecera para mostrar estado de grabación
  useEffect(() => {
    navigation.setOptions({
      headerLeft: (isRecording || isProcessingAPI) ? () => (
        <TouchableOpacity
          style={{ opacity: 0.5, padding: 10 }}
          onPress={() => {
          }}
        >
          <Text style={{ color: '#666', fontSize: 16 }}>{strings.recordingScreen.back}</Text>
        </TouchableOpacity>
      ) : undefined,
      title: isRecording ? strings.recordingScreen.recording : isProcessingAPI ? strings.recordingScreen.sendingToApi : strings.recordingScreen.title
    });
  }, [isRecording, isProcessingAPI, navigation]);



  // Validar dispositivos al completar la búsqueda
  useEffect(() => {
    if (deviceCheckComplete && audioDevices.length === 0) {
      Alert.alert(
        strings.recordingScreen.noUsbDeviceAlert,
        strings.recordingScreen.noUsbDeviceMessage,
        [
          {
            text: strings.recordingScreen.goBack,
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  }, [deviceCheckComplete, audioDevices.length, navigation]);

  // Manejar niveles de audio reales del módulo nativo
  const handleAudioLevels = (levels: AudioLevels) => {
    setAudioLevels(levels);
  };

  const handleStartStopRecording = async () => {
    if (isRecording) {
      if (recordingTime < requiredRecordingSeconds) {
        return;
      }
      setIsRecording(false);
    } else {
      // Verificar permisos de micrófono antes de iniciar
      const hasPermission = await ensureMicrophonePermission();
      if (!hasPermission) {
        return;
      }
      // Validar que el ruido blanco esté reproduciéndose antes de iniciar grabación
      if (!isWhiteNoisePlaying) {
        Alert.alert(
          strings.recordingScreen.whiteNoiseRequired,
          strings.recordingScreen.whiteNoiseMessage,
          [
            {
              text: strings.recordingScreen.understood,
              style: 'default'
            }
          ]
        );
        return;
      }

      setRecordingResult(null);
      setHasNavigated(false); // Resetear flag de navegación
      setIsRecording(true);
    }
  };

  const handleRecordingFinish = async (audioUri: string | null, interrupted: boolean) => {
    setIsRecording(false);
    
    // Si ya navegamos, no hacer nada más
    if (hasNavigated) {
      return;
    }
    
    if (recordingResult) {
      // Obtener la duración real del audio en milisegundos
      const audioDurationMs = await getAudioDuration(recordingResult.channel1Path);
      
      setHasNavigated(true);
      navigation.navigate('Results', {
        humidity: parseFloat(humidity) || 0,
        porosity: 0,
        measurementName: measurementName,
        comment: comment,
        apiResults: null,
        measurementDateTime: new Date().toISOString(),
        recordingDuration: audioDurationMs,
        audioUri: recordingResult.channel1Path,
        dualChannelResult: recordingResult,
        isDualChannel: true,
        locationData: locationData
      });
    } else if (interrupted) {
      setRecordingTime(0);
      setRecordingResult(null);
      setHasNavigated(false);
    } else if (!audioUri) {
      Alert.alert(strings.common.error, strings.recordingScreen.errorCompleteRecording);
    }
  };

  const handleDevicesFound = (devices: AudioDevice[]) => {
    // Filtrar solo dispositivos USB
    const usbDevices = devices.filter(device => device.isUSB);
    setAudioDevices(usbDevices);
    setDeviceCheckComplete(true);
    
    // Auto-seleccionar el primer dispositivo USB si está disponible
    const usbDevice = usbDevices[0];
    if (usbDevice && !selectedDeviceId) {
      setSelectedDeviceId(usbDevice.id);
    }
  };

  // Función para obtener la duración real del audio en milisegundos
  const getAudioDuration = async (audioPath: string): Promise<number> => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioPath },
        { shouldPlay: false }
      );
      
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const durationMs = status.durationMillis;
        await sound.unloadAsync();
        return durationMs;
      }
      
      await sound.unloadAsync();
      return 0;
    } catch (error) {
      return 0;
    }
  };

  const handleDualChannelResult = async (result: DualChannelRecordingResult) => {
    setRecordingResult(result);
    
    setIsRecording(false);
    
    // Obtener la duración real del audio en milisegundos
    const audioDurationMs = await getAudioDuration(result.channel1Path);
    
    // Marcar que vamos a navegar para evitar doble navegación
    setHasNavigated(true);
    
    // Enviar a la API automáticamente
    setIsProcessingAPI(true);
    
    try {
      const apiResults = await sendDualChannelToAPI(result);
      
      // Navegar a resultados con datos de la API
      navigation.navigate('Results', {
        humidity: parseFloat(humidity) || 0,
        porosity: apiResults.porosity || 0,
        measurementName: measurementName,
        comment: comment,
        apiResults: apiResults,
        measurementDateTime: new Date().toISOString(),
        recordingDuration: audioDurationMs,
        audioUri: result.channel1Path,
        dualChannelResult: result,
        isDualChannel: true,
        locationData: locationData
      });
      
    } catch (error) {
      // Determinar el tipo de error para mostrar diferentes opciones
      const errorMessage = (error as Error).message || 'Error desconocido';
      const isServerError = errorMessage.includes('Error en el procesamiento de audio') || 
                           errorMessage.includes('Error interno del servidor');
      const isNetworkError = errorMessage.includes('Network') || errorMessage.includes('fetch');
      
      let alertTitle = 'Error de API';
      let alertMessage = errorMessage;
      let buttons = [];
      
      if (isServerError) {
        alertTitle = strings.recordingScreen.processingError;
        alertMessage = strings.recordingScreen.processingErrorMessage;
        
        buttons = [
          {
            text: strings.recordingScreen.viewAudioWithoutApi,
            onPress: () => {
              navigation.navigate('Results', {
                humidity: parseFloat(humidity) || 0,
                porosity: 0,
                measurementName: measurementName,
                comment: comment,
                apiResults: { error: 'Error de procesamiento', details: errorMessage },
                measurementDateTime: new Date().toISOString(),
                recordingDuration: audioDurationMs,
                audioUri: result.channel1Path,
                dualChannelResult: result,
                isDualChannel: true,
                locationData: locationData
              });
            }
          },
          {
            text: strings.recordingScreen.retryApi,
            onPress: () => handleDualChannelResult(result)
          }
        ];
      } else if (isNetworkError) {
        alertTitle = strings.recordingScreen.connectionError;
        alertMessage = strings.recordingScreen.connectionErrorMessage;
        
        buttons = [
          {
            text: strings.recordingScreen.continueWithoutApi,
            onPress: () => {
              navigation.navigate('Results', {
                humidity: parseFloat(humidity) || 0,
                porosity: 0,
                measurementName: measurementName,
                comment: comment,
                apiResults: null,
                measurementDateTime: new Date().toISOString(),
                recordingDuration: audioDurationMs,
                audioUri: result.channel1Path,
                dualChannelResult: result,
                isDualChannel: true,
                locationData: locationData
              });
            }
          },
          {
            text: strings.recordingScreen.retry,
            onPress: () => handleDualChannelResult(result)
          }
        ];
      } else {
        // Error genérico
        buttons = [
          {
            text: strings.recordingScreen.viewAudio,
            onPress: () => {
              navigation.navigate('Results', {
                humidity: parseFloat(humidity) || 0,
                porosity: 0,
                measurementName: measurementName,
                comment: comment,
                apiResults: { error: 'Error general', details: errorMessage },
                measurementDateTime: new Date().toISOString(),
                recordingDuration: audioDurationMs,
                audioUri: result.channel1Path,
                dualChannelResult: result,
                isDualChannel: true,
                locationData: locationData
              });
            }
          },
          {
            text: strings.recordingScreen.retry,
            onPress: () => handleDualChannelResult(result)
          }
        ];
      }
      
      Alert.alert(alertTitle, alertMessage, buttons);
    } finally {
      setIsProcessingAPI(false);
    }
  };

  const sendDualChannelToAPI = async (result: DualChannelRecordingResult) => {
    const formData = new FormData();
  
    formData.append('experiment_name', `${measurementName}`);
    formData.append('comment', comment);
    
    // Usar ubicación real del dispositivo si está disponible
    if (locationData) {
      formData.append('longitude', locationData.longitude.toString());
      formData.append('latitude', locationData.latitude.toString());
    } else {
      // Valores por defecto si no hay ubicación disponible
      formData.append('longitude', '0');
      formData.append('latitude', '0');
    }
    formData.append('freq_min', settings.min_frec.toString());
    formData.append('freq_max', settings.max_frec.toString());
    formData.append('sample_rate', settings.sampling_rate.toString());
    formData.append('number_of_samples', settings.n.toString());
    formData.append('averages', settings.m.toString());
    formData.append('distance_between_mics', settings.distance_between_mics.toString());
    formData.append('distance_between_mic_1_and_sample', settings.distance_between_mic_1_and_sample.toString());
    formData.append('humidity_value', humidity);
  
    formData.append('channel1_audio', {
      uri: result.channel1Path,
      name: 'channel1.wav',
      type: 'audio/wav',
    } as any);
  
    formData.append('channel2_audio', {
      uri: result.channel2Path,
      name: 'channel2.wav',
      type: 'audio/wav',
    } as any);
  
    try {
      const response = await fetch(`${API_BASE_URL}/measure-porosity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
  
      const apiResult = await response.json();
      return {
        alpha_average: apiResult.alpha_average,
        porosity: apiResult.porosity,
        csv_download_url: apiResult.csv_download_url,
        csv_filename: apiResult.csv_filename,
        success: true
      };
  
    } catch (error) {
      throw error;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDeviceDisplayName = (device: AudioDevice) => {
    const name = device.productName || `Dispositivo ${device.id}`;
    const type = device.isUSB ? '🔌 USB' : '🎤 Interno';
    return `${type} - ${name}`;
  };

  const showDeviceInfo = (device: AudioDevice) => {
    const deviceInfo = [
      `🏷️ Nombre: ${device.productName}`,
      `🆔 ID Android: ${device.id}`,
      `📱 Tipo: ${device.type}`,
      `🔌 USB: ${device.isUSB ? 'Sí' : 'No'}`,
      
      // Información específica de hardware USB
      device.vendorId && `🏭 Vendor ID: ${device.vendorId}`,
      device.productId && `📦 Product ID: ${device.productId}`,
      device.hardwareIdentifier && `🔧 Hardware ID: ${device.hardwareIdentifier}`,
      device.serialNumber && device.serialNumber !== 'N/A' && `🔢 Serial: ${device.serialNumber}`,
      device.manufacturerName && device.manufacturerName !== 'N/A' && `🏢 Fabricante: ${device.manufacturerName}`,
      
      // ID único mejorado
      device.uniqueIdentifier && `🔑 ID Único: ${device.uniqueIdentifier}`,
      device.address && `📍 Dirección: ${device.address}`,
      
      // Capacidades técnicas
      device.supportedChannelCounts && device.supportedChannelCounts.length > 0 && 
        `🎵 Canales: ${device.supportedChannelCounts.join(', ')}`,
      device.supportedSampleRates && device.supportedSampleRates.length > 0 && 
        `📊 Sample Rates: ${device.supportedSampleRates.slice(0, 5).join(', ')}${device.supportedSampleRates.length > 5 ? '...' : ''}`,
      device.supportedEncodings && device.supportedEncodings.length > 0 && 
        `🎯 Encodings: ${device.supportedEncodings.slice(0, 3).join(', ')}${device.supportedEncodings.length > 3 ? '...' : ''}`
    ].filter(Boolean).join('\n\n');

    Alert.alert(
      'Información del Dispositivo USB',
      deviceInfo,
      [
        { text: 'Cerrar', style: 'cancel' }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Text style={styles.title}>{strings.recordingScreen.title}</Text>

      <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
        
        {/* Dispositivo USB conectado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.recordingScreen.usbDevice}</Text>
          {!deviceCheckComplete ? (
            <Text style={styles.noDevicesText}>
              {strings.recordingScreen.searchingDevices}
            </Text>
          ) : audioDevices.length === 0 ? (
            <Text style={styles.noDevicesText}>
              {strings.recordingScreen.noUsbDevices}
            </Text>
          ) : selectedDeviceId ? (
            (() => {
              const selectedDevice = audioDevices.find(device => device.id === selectedDeviceId);
              return selectedDevice ? (
                <View style={[styles.deviceItem, styles.selectedDevice]}>
                  <View style={styles.deviceHeader}>
                    <View style={styles.deviceMainInfo}>
                      <Text style={[styles.deviceName, styles.selectedDeviceText]}>
                        {selectedDevice.productName}
                      </Text>
                      <Text style={styles.deviceType}>{selectedDevice.type}</Text>
                      {selectedDevice.supportedChannelCounts && selectedDevice.supportedChannelCounts.length > 0 && (
                        <Text style={styles.channelInfo}>
                          {strings.recordingScreen.channels}: {selectedDevice.supportedChannelCounts.join(', ')}
                        </Text>
                      )}
                    </View>
                    {selectedDevice.isUSB && (
                      <TouchableOpacity
                        style={styles.deviceInfoButton}
                        onPress={() => showDeviceInfo(selectedDevice)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deviceInfoButtonText}>ℹ️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={styles.noDevicesText}>
                  {strings.recordingScreen.deviceNotFound}
                </Text>
              );
            })()
          ) : (
            <Text style={styles.noDevicesText}>
              {strings.recordingScreen.noUsbDevices}
            </Text>
          )}
        </View>

        {/* Reproductor de Ruido Blanco */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.recordingScreen.whiteNoise}</Text>
          <WhiteNoisePlayer 
            disabled={isProcessingAPI} 
            selectedDeviceId={selectedDeviceId}
            isRecording={isRecording}
            onPlayingStateChange={setIsWhiteNoisePlaying}
          />
        </View>

        {/* Estado de grabación */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.recordingScreen.recordingStatus}</Text>
          <View style={styles.recordingStatus}>
            <Text style={[styles.statusText, isRecording && styles.recordingText]}>
              {isProcessingAPI ? strings.recordingScreen.sendingToApi : isRecording ? strings.recordingScreen.recordingInProgress : strings.recordingScreen.stopped}
            </Text>
            {isRecording && (
              <Text style={styles.timeText}>
                {formatTime(recordingTime)}
              </Text>
            )}
            {isProcessingAPI && (
              <View style={{ marginTop: 10, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={{ marginTop: 8, fontSize: 14, color: '#666' }}>
                  {strings.recordingScreen.processingAudio}
                </Text>
              </View>
            )}
          </View>
          
          {/* Niveles de audio en tiempo real */}
          {isRecording && (
            <View style={styles.audioLevelsContainer}>
              <View style={styles.channelLevel}>
                <Text style={styles.channelLevelLabel}>{strings.recordingScreen.channel1}</Text>
                <View style={styles.levelMeter}>
                  <View 
                    style={[
                      styles.levelBar, 
                      { 
                        width: `${Math.max(audioLevels.channel1, 1)}%`,
                        backgroundColor: audioLevels.channel1 > 80 ? '#FF3B30' : 
                                       audioLevels.channel1 > 50 ? '#FF9500' : 
                                       audioLevels.channel1 > 20 ? '#4CAF50' : '#8E8E93'
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.levelValue, { 
                  color: audioLevels.channel1 > 20 ? '#333' : '#999',
                  fontWeight: audioLevels.channel1 > 50 ? '600' : '400'
                }]}>
                  {Math.round(audioLevels.channel1)}%
                </Text>
              </View>
              
              <View style={styles.channelLevel}>
                <Text style={styles.channelLevelLabel}>{strings.recordingScreen.channel2}</Text>
                <View style={styles.levelMeter}>
                  <View 
                    style={[
                      styles.levelBar, 
                      { 
                        width: `${Math.max(audioLevels.channel2, 1)}%`,
                        backgroundColor: audioLevels.channel2 > 80 ? '#FF3B30' : 
                                       audioLevels.channel2 > 50 ? '#FF9500' : 
                                       audioLevels.channel2 > 20 ? '#4CAF50' : '#8E8E93'
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.levelValue, { 
                  color: audioLevels.channel2 > 20 ? '#333' : '#999',
                  fontWeight: audioLevels.channel2 > 50 ? '600' : '400'
                }]}>
                  {Math.round(audioLevels.channel2)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Resultado de grabación - Dos cuadros separados */}
        {recordingResult && (
          <View style={styles.audioResultsContainer}>
            {/* Canal 1 */}
            <View style={[styles.section, styles.channelSection, styles.channel1Section]}>
              <Text style={[styles.channelTitle, styles.channel1Title]}>{strings.recordingScreen.channel1Left}</Text>
              <View style={styles.channelContainer}>
                <View style={[styles.audioVisualization, styles.channel1Visualization]}>
                  <Text style={[styles.channelLabel, styles.channel1Label]}>L</Text>
                  <View style={styles.audioWaveform}>
                    {/* Forma de onda estática para Canal 1 */}
                    {[...Array(8)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveBar,
                          styles.channel1WaveBar,
                          { height: [15, 22, 18, 25, 12, 20, 16, 14][i] }
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.audioInfo}>
                  <Text style={styles.audioFileName}>
                    📁 {recordingResult.channel1Path.split('/').pop()}
                  </Text>
                  <Text style={styles.audioDetails}>
                    {strings.recordingScreen.format}
                  </Text>
                </View>
              </View>
            </View>

            {/* Canal 2 */}
            <View style={[styles.section, styles.channelSection, styles.channel2Section]}>
              <Text style={[styles.channelTitle, styles.channel2Title]}>{strings.recordingScreen.channel2Right}</Text>
              <View style={styles.channelContainer}>
                <View style={[styles.audioVisualization, styles.channel2Visualization]}>
                  <Text style={[styles.channelLabel, styles.channel2Label]}>R</Text>
                  <View style={styles.audioWaveform}>
                    {/* Forma de onda estática para Canal 2 */}
                    {[...Array(8)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveBar,
                          styles.channel2WaveBar,
                          { height: [18, 14, 21, 16, 19, 23, 17, 20][i] }
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.audioInfo}>
                  <Text style={styles.audioFileName}>
                    📁 {recordingResult.channel2Path.split('/').pop()}
                  </Text>
                  <Text style={styles.audioDetails}>
                    {strings.recordingScreen.format}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Botón de grabación */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            isRecording && styles.recordingButton,
            (isProcessingAPI || audioDevices.length === 0 || (!isRecording && !isWhiteNoisePlaying) || (isRecording && recordingTime < requiredRecordingSeconds)) && styles.buttonDisabled
          ]}
          onPress={handleStartStopRecording}
          disabled={
            isProcessingAPI ||
            audioDevices.length === 0 ||
            (!isRecording && !isWhiteNoisePlaying) ||
            (isRecording && recordingTime < requiredRecordingSeconds)
          }
        >
          <Text style={styles.buttonText}>
            {isProcessingAPI 
              ? strings.recordingScreen.processing
              : isRecording 
                ? (recordingTime < requiredRecordingSeconds
                    ? strings.recordingScreen.recording
                    : strings.recordingScreen.stopRecording)
                : audioDevices.length === 0
                  ? strings.recordingScreen.noUsbDevice
                  : !isWhiteNoisePlaying
                    ? strings.recordingScreen.requiresWhiteNoise
                    : strings.recordingScreen.startRecording
            }
          </Text>
        </TouchableOpacity>
      </View>

      {/* Componente de grabación */}
      <AudioRecorder
        isRecording={isRecording}
        useDualChannel={true}
        selectedDeviceId={selectedDeviceId}
        onFinish={handleRecordingFinish}
        onDevicesFound={handleDevicesFound}
        onDualChannelResult={handleDualChannelResult}
        onAudioLevels={handleAudioLevels}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 40,
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  deviceItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  selectedDevice: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  disabledDevice: {
    opacity: 0.5,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedDeviceText: {
    color: '#007AFF',
  },
  deviceType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  channelInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deviceMainInfo: {
    flex: 1,
  },
  deviceInfoButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  deviceInfoButtonText: {
    fontSize: 16,
    color: 'white',
  },
  noDevicesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  recordingStatus: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  recordingText: {
    color: '#FF3B30',
  },
  timeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  audioLevelsContainer: {
    marginTop: 16,
    gap: 12,
  },
  channelLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelLevelLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    width: 80,
  },
  levelMeter: {
    flex: 1,
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  levelBar: {
    height: '100%',
    borderRadius: 5,
    minWidth: 2,
  },
  levelValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    width: 40,
    textAlign: 'right',
  },
  selectedDeviceInfo: {
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  selectedDeviceLabel: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  audioResultsContainer: {
    gap: 16,
  },
  channelSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    marginBottom: 16,
  },
  channel1Section: {
    borderLeftColor: '#FF6B35',
  },
  channel2Section: {
    borderLeftColor: '#4ECDC4',
  },
  channelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
  },
  channel1Title: {
    color: '#FF6B35',
  },
  channel2Title: {
    color: '#4ECDC4',
  },
  channelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  audioVisualization: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 60,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  channel1Visualization: {
    backgroundColor: '#FFF5F3',
    borderColor: '#FF6B35',
  },
  channel2Visualization: {
    backgroundColor: '#F0FFFE',
    borderColor: '#4ECDC4',
  },
  channelLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  channel1Label: {
    color: '#FF6B35',
  },
  channel2Label: {
    color: '#4ECDC4',
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    gap: 1,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#007AFF',
    borderRadius: 1,
    minHeight: 2,
  },
  channel1WaveBar: {
    backgroundColor: '#FF6B35',
  },
  channel2WaveBar: {
    backgroundColor: '#4ECDC4',
  },
  audioInfo: {
    flex: 1,
  },
  audioFileName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  audioDetails: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 20,
    paddingBottom: 32,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
    shadowOpacity: 0.1,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
}); 