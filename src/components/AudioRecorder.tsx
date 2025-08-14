import { useEffect, useRef, useState } from 'react';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import DualChannelAudioRecorder from './DualChannelAudioRecorder';
import { DualChannelRecordingResult, AudioDevice, AudioLevels } from '../types/DualChannelAudio';
import settings from '../locales/settings';
import strings from '@locales/es';

type AudioRecorderProps = {
  isRecording: boolean;
  onFinish: (audioUri: string | null, interrupted: boolean) => void;
  useDualChannel?: boolean; // Nueva prop para usar grabación de dos canales
  selectedDeviceId?: number | null;
  onDevicesFound?: (devices: AudioDevice[]) => void;
  onDualChannelResult?: (result: DualChannelRecordingResult) => void;
  onAudioLevels?: (levels: AudioLevels) => void;
};

export default function AudioRecorder({ 
  isRecording, 
  onFinish, 
  useDualChannel = false,
  selectedDeviceId,
  onDevicesFound,
  onDualChannelResult,
  onAudioLevels
}: AudioRecorderProps) {
  // Configuración específica para grabación estéreo
  const recordingOptions = {
    ...RecordingPresets.HIGH_QUALITY,
    extension: '.m4a', // Cambiado a m4a
    sampleRate: settings.sampling_rate,
    numberOfChannels: settings.numberOfChannels,
    bitDepth: 16,
  };

  const audioRecorder = useAudioRecorder(recordingOptions);
  const isProcessing = useRef(false);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);

  // Callback para manejar resultados de grabación dual channel
  const handleDualChannelFinish = (result: DualChannelRecordingResult | null, interrupted: boolean) => {
    if (result) {
      onDualChannelResult?.(result);
      // Para compatibilidad, devolver la ruta del primer canal como URI principal
      onFinish(result.channel1Path, interrupted);
    } else {
      onFinish(null, interrupted);
    }
  };

  // Callback para cuando se encuentran dispositivos de audio
  const handleDevicesFound = (devices: AudioDevice[]) => {
    setAudioDevices(devices);
    onDevicesFound?.(devices);
  };

  useEffect(() => {
    // Solo solicitar permisos si NO estamos usando dual channel
    if (!useDualChannel) {
      // Request permissions on component mount
      (async () => {
        try {
          const audioStatus = await AudioModule.requestRecordingPermissionsAsync();
          if (!audioStatus.granted) {
            Alert.alert(
              strings.audioRecorder.permissionsRequired,
              strings.audioRecorder.microphonePermissionMessage,
              [{ text: strings.audioRecorder.ok }]
            );
          } else {
          }
        } catch (error) {
        }
      })();
    }
  }, [useDualChannel]);

  useEffect(() => {
    // Solo ejecutar la lógica de grabación original si NO estamos usando dual channel
    if (!useDualChannel) {
      if (isRecording) {
        startRecording();
      } else {
        stopRecording(false);
      }

      return () => {
        stopRecording(true);
      };
    }
  }, [isRecording, useDualChannel]);

  async function startRecording() {
    try {
      await audioRecorder.prepareToRecordAsync();
      
      audioRecorder.record();
    } catch (e) {
      onFinish(null, true);
    }
  }

  async function stopRecording(interrupted: boolean) {
    if (audioRecorder.isRecording) {
      try {
        await audioRecorder.stop();
        
        if (audioRecorder.uri) {
          const fileInfo = await FileSystem.getInfoAsync(audioRecorder.uri);
          if (fileInfo.exists && fileInfo.size > 0) {
            onFinish(audioRecorder.uri, interrupted);
          } else {
            onFinish(null, interrupted);
          }
        } else {
          onFinish(null, interrupted);
        }
      } catch (e) {
        onFinish(null, interrupted);
      }
    } else {
      onFinish(null, interrupted);
    }
  }

  // Si useDualChannel está habilitado, verificar plataforma
  if (useDualChannel) {
    if (Platform.OS === 'android') {
      return (
        <DualChannelAudioRecorder
          isRecording={isRecording}
          selectedDeviceId={selectedDeviceId}
          onFinish={handleDualChannelFinish}
          onDevicesFound={handleDevicesFound}
          onAudioLevels={onAudioLevels}
        />
      );
    }
  }

  // Modo estándar: no renderizar nada, solo manejar grabación en useEffect
  return null;
}
