import { NativeModules } from 'react-native';

export interface AudioDevice {
  id: number;
  productName: string;
  type: string;
  isSource: boolean;
  isUSB: boolean;
  supportedChannelCounts?: number[];
  address?: string;
  supportedSampleRates?: number[];
  supportedEncodings?: number[];
  uniqueIdentifier?: string;
  deviceHash?: string;
  // Información específica de hardware USB
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  deviceName?: string;
  manufacturerName?: string;
  hardwareIdentifier?: string;
}

export interface DualChannelRecordingResult {
  channel1Path: string;
  channel2Path: string;
}

export interface AudioLevels {
  channel1: number; // 0-100
  channel2: number; // 0-100
}

export interface DualChannelAudioModule {
  getAudioDevices(): Promise<AudioDevice[]>;
  startDualChannelRecording(
    deviceId: number | null,
    sampleRate: number,
    outputPath: string
  ): Promise<boolean>;
  stopDualChannelRecording(): Promise<DualChannelRecordingResult>;
  isRecording(): Promise<boolean>;
  getAudioLevels(): Promise<AudioLevels>;
}

const { DualChannelAudio } = NativeModules;

export default DualChannelAudio as DualChannelAudioModule; 