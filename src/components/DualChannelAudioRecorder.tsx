import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import DualChannelAudio, { AudioDevice, DualChannelRecordingResult, AudioLevels } from '../types/DualChannelAudio';
import settings from '../locales/settings';

type DualChannelAudioRecorderProps = {
  isRecording: boolean;
  selectedDeviceId?: number | null;
  sampleRate?: number;
  onFinish: (result: DualChannelRecordingResult | null, interrupted: boolean) => void;
  onDevicesFound?: (devices: AudioDevice[]) => void;
  onAudioLevels?: (levels: AudioLevels) => void;
};

export default function DualChannelAudioRecorder({ 
  isRecording, 
  selectedDeviceId = null,
  sampleRate = settings.sampling_rate,
  onFinish,
  onDevicesFound,
  onAudioLevels
}: DualChannelAudioRecorderProps) {
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const isProcessing = useRef(false);
  const prevIsRecording = useRef<boolean | null>(null);
  const hasFinished = useRef(false);
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);
  const nativeLevelsAvailable = useRef<boolean | null>(null); // null = no probado, true/false = resultado
  const loggedNativeAvailability = useRef(false); // Para evitar spam de logs

  useEffect(() => {
    initializeAudio();
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    // Solo reaccionar a cambios REALES del estado de grabación
    if (prevIsRecording.current === null) {
      prevIsRecording.current = isRecording;
      return;
    }

    // Verificar si realmente cambió el estado
    if (prevIsRecording.current === isRecording) {
      return;
    }

    prevIsRecording.current = isRecording;

    if (isRecording) {
      hasFinished.current = false;
      startDualChannelRecording();
      startAudioLevelMonitoring();
    } else {
      stopAudioLevelMonitoring();
      stopDualChannelRecording(false);
    }

    return () => {
      stopAudioLevelMonitoring();
      if (isRecording && !hasFinished.current && !isProcessing.current) {
        stopDualChannelRecording(true);
      }
    };
  }, [isRecording, isInitialized]);

  async function initializeAudio() {
    try {

      if (Platform.OS !== 'android') {
        Alert.alert(
          'Plataforma no soportada',
          'La grabación de dos canales separados solo está disponible en Android.',
          [{ text: 'OK' }]
        );
        setIsInitialized(false);
        return;
      }

      // Verificar si el módulo nativo está disponible
      try {
        nativeLevelsAvailable.current = true;
      } catch (error) {
        nativeLevelsAvailable.current = false;
      }

      // Obtener dispositivos de audio disponibles
      const devices = await DualChannelAudio.getAudioDevices();
      
      setAudioDevices(devices);
      onDevicesFound?.(devices);

      // Filtrar dispositivos USB para mostrar información relevante
      const usbDevices = devices.filter(device => device.isUSB);

      setIsInitialized(true);
    } catch (error) {
      Alert.alert(
        'Error de inicialización',
        'No se pudo inicializar el sistema de audio. Verificá que tenés permisos de micrófono.',
        [{ text: 'OK' }]
      );
      setIsInitialized(false);
    }
  }

  async function startDualChannelRecording() {
    if (isProcessing.current) {
      return;
    }
    
    isProcessing.current = true;

    try {
      // Verificar estado antes de iniciar
      const isCurrentlyRecording = await DualChannelAudio.isRecording();
      
      if (isCurrentlyRecording) {
        await DualChannelAudio.stopDualChannelRecording();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Crear directorio de salida
      const recordingsDir = `${FileSystem.documentDirectory}recordings/`;
      const dirInfo = await FileSystem.getInfoAsync(recordingsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(recordingsDir, { intermediates: true });
      }

      // Determinar qué dispositivo usar
      let deviceToUse = selectedDeviceId;
      if (!deviceToUse) {
        const usbDevice = audioDevices.find(device => device.isUSB);
        deviceToUse = usbDevice?.id || null;
      }

      // USAR EL MÓDULO NATIVO REAL
      const success = await DualChannelAudio.startDualChannelRecording(
        deviceToUse,
        sampleRate,
        recordingsDir
      );

      if (success) {
        const deviceInfo = audioDevices.find(d => d.id === deviceToUse);
      } else {
        hasFinished.current = true;
        onFinish(null, true);
      }
    } catch (error) {
      hasFinished.current = true;
      onFinish(null, true);
    } finally {
      isProcessing.current = false;
    }
  }

  async function stopDualChannelRecording(interrupted: boolean) {
    if (isProcessing.current) {
      return;
    }
    
    if (hasFinished.current) {
      return;
    }
    
    isProcessing.current = true;

    try {
      const isCurrentlyRecording = await DualChannelAudio.isRecording();
      
      if (isCurrentlyRecording) {
        
        // USAR EL MÓDULO NATIVO REAL
        const result = await DualChannelAudio.stopDualChannelRecording();
        
        if (result && result.channel1Path && result.channel2Path) {
          
          // Verificar que los archivos existan
          const file1Info = await FileSystem.getInfoAsync(`file://${result.channel1Path}`);
          const file2Info = await FileSystem.getInfoAsync(`file://${result.channel2Path}`);
          
          if (file1Info.exists && file2Info.exists && file1Info.size > 1000 && file2Info.size > 1000) {
            
            const finalResult = {
              channel1Path: `file://${result.channel1Path}`,
              channel2Path: `file://${result.channel2Path}`
            };
            
            hasFinished.current = true;
            onFinish(finalResult, interrupted);
          } else {
            hasFinished.current = true;
            onFinish(null, interrupted);
          }
        } else {
          hasFinished.current = true;
          onFinish(null, interrupted);
        }
      } else {
        hasFinished.current = true;
        onFinish(null, interrupted);
      }
    } catch (error) {
      hasFinished.current = true;
      onFinish(null, interrupted);
    } finally {
      isProcessing.current = false;
    }
  }

  // Iniciar monitoreo de niveles de audio
  function startAudioLevelMonitoring() {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
    }

    audioLevelInterval.current = setInterval(async () => {
      try {
        const levels = await DualChannelAudio.getAudioLevels();
        onAudioLevels?.(levels);
        
        // Log exitoso solo la primera vez
        if (nativeLevelsAvailable.current === null) {
          nativeLevelsAvailable.current = true;
        } else if (nativeLevelsAvailable.current === false) {
          // Si antes fallaba pero ahora funciona
          nativeLevelsAvailable.current = true;
        }
      } catch (error) {
        // Solo log la primera vez que falla
        if (nativeLevelsAvailable.current === null && !loggedNativeAvailability.current) {
          loggedNativeAvailability.current = true;
        }
        
        nativeLevelsAvailable.current = false;
        // Enviar niveles en cero si el módulo nativo falla
        onAudioLevels?.({ channel1: 0, channel2: 0 });
      }
    }, 100); // Actualizar cada 100ms
  }

  // Detener monitoreo de niveles de audio
  function stopAudioLevelMonitoring() {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
      audioLevelInterval.current = null;
      // Enviar niveles en cero al detener
      onAudioLevels?.({ channel1: 0, channel2: 0 });
    }
  }

  // Función auxiliar para obtener información del dispositivo seleccionado
  function getSelectedDeviceInfo(): AudioDevice | null {
    if (!selectedDeviceId) return null;
    return audioDevices.find(device => device.id === selectedDeviceId) || null;
  }

  // Función auxiliar para obtener dispositivos USB disponibles
  function getUSBDevices(): AudioDevice[] {
    return audioDevices.filter(device => device.isUSB);
  }

  // Exponer funciones útiles a través de ref si es necesario
  const api = {
    getAudioDevices: () => audioDevices,
    getUSBDevices,
    getSelectedDeviceInfo,
    isInitialized,
  };

  return null; // Este componente no renderiza nada
}

export { DualChannelAudioRecorder }; 