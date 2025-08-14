import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import strings from '@locales/es';

interface WhiteNoisePlayerProps {
  disabled?: boolean;
  selectedDeviceId?: number | null;
  isRecording?: boolean;
  onPlayingStateChange?: (isPlaying: boolean) => void;
}

export default function WhiteNoisePlayer({ disabled = false, selectedDeviceId, isRecording = false, onPlayingStateChange }: WhiteNoisePlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Notificar cambios en el estado de reproducción
  useEffect(() => {
    onPlayingStateChange?.(isPlaying);
  }, [isPlaying, onPlayingStateChange]);

  // Configurar audio al montar el componente y cuando cambie el estado de grabación
  useEffect(() => {
    configureAudio();
    return () => {
      // Limpiar al desmontar
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [isRecording]); // Reconfigurar cuando cambie el estado de grabación

  const configureAudio = async () => {
    try {

      // Configuración simplificada que debe funcionar en todas las versiones
      const audioConfig = {
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
        shouldDuckAndroid: false, // No reducir volumen de otros audios
      };

      await Audio.setAudioModeAsync(audioConfig);
      
      // Si hay un dispositivo USB seleccionado, intentar usarlo para la salida
      if (selectedDeviceId !== null && selectedDeviceId !== undefined) {
      }
    } catch (error) {
      // Si falla la configuración, intentar configuración mínima
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch (minimalError) {
      }
    }
  };

  const togglePlayback = async () => {
    if (disabled) return;
    setIsLoading(true);
    
    try {
      if (isPlaying && sound) {
        // Detener reproducción
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        // Iniciar reproducción
        
        // Reconfigurar audio antes de reproducir
        await configureAudio();
        
        if (!sound) {
          // Cargar el audio por primera vez
          const { sound: newSound } = await Audio.Sound.createAsync(
            require('../../assets/white_noise.wav'),
            { 
              shouldPlay: true,
              isLooping: true,  // Reproducir en bucle
              volume: 0.8  // Volumen constante
            }
          );
          
          setSound(newSound);
          setIsPlaying(true);
          
          // Configurar listener para cuando termine (por si acaso)
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish && !status.isLooping) {
              setIsPlaying(false);
            }
          });
        } else {
          // Reanudar reproducción existente
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      Alert.alert(strings.common.error, `${strings.whiteNoisePlayer.playbackError}: ${error.message}`);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Detener cuando se deshabilite
  useEffect(() => {
    if (disabled && isPlaying && sound) {
      sound.pauseAsync().then(() => {
        setIsPlaying(false);
      });
    }
  }, [disabled, isPlaying, sound]);

  // Manejar reconfiguración durante grabación (sin cambio de volumen)
  useEffect(() => {
    const handleRecordingStateChange = async () => {
      // Si acabamos de empezar a grabar y el sonido está reproduciéndose,
      // esperar un poco y reconfigurar para asegurar compatibilidad
      if (isRecording && sound && isPlaying) {
        setTimeout(async () => {
          try {
            await configureAudio();
          } catch (error) {
          }
        }, 500);
      }
    };

    handleRecordingStateChange();
  }, [isRecording, sound, isPlaying]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.whiteNoisePlayer.title}</Text>
        <TouchableOpacity
          style={[
            styles.button,
            isPlaying && !isRecording && styles.stopButton,
            (disabled || isRecording) && styles.disabledButton
          ]}
          onPress={togglePlayback}
          disabled={disabled || isLoading || isRecording}
        >
        <Text style={[styles.buttonText, (disabled || isRecording) && styles.disabledText]}>
          {isLoading 
            ? strings.whiteNoisePlayer.loading
            : isPlaying 
              ? strings.whiteNoisePlayer.stop
              : strings.whiteNoisePlayer.play
          }
        </Text>
      </TouchableOpacity>      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stopButton: {
    backgroundColor: '#dc3545',
  },
  lockedButton: {
    backgroundColor: '#fd7e14', // Color naranja para indicar bloqueado pero activo
  },
  disabledButton: {
    backgroundColor: '#6c757d',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledText: {
    color: '#adb5bd',
  },
  statusText: {
    fontSize: 12,
    color: '#28a745',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  recordingStatusText: {
    fontSize: 12,
    color: '#FF6B35',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  usbInfo: {
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  warningText: {
    fontSize: 11,
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  recordingHint: {
    fontSize: 12,
    color: '#17a2b8',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
    backgroundColor: '#e7f3ff',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bee5eb',
  },
}); 