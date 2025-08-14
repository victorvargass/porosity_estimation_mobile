// src/screens/ResultsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, ActivityIndicator, ScrollView, Image, TouchableOpacity, Linking, BackHandler } from 'react-native';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';
import styles from '@styles/ResultsStyles';
import { DualChannelRecordingResult } from '../types/DualChannelAudio';
import { LocationData, formatLocationForDisplay } from '../utils/locationService';
import strings from '@locales/es';

const API_BASE_URL = 'https://porosity-estimation-api-1c6222e12625.herokuapp.com';

type ResultsScreenProps = {
  navigation: any;
  route: {
    params: {
      humidity: number;
      porosity: number;
      measurementName: string;
      comment: string;
      apiResults?: any;
      measurementDateTime?: string;
      recordingDuration?: number;
      audioUri?: string;
      dualChannelResult?: DualChannelRecordingResult;
      isDualChannel?: boolean;
      locationData?: LocationData;
    };
  };
};

export default function ResultsScreen({ navigation, route }: ResultsScreenProps) {
  const { 
    humidity, 
    porosity, 
    measurementName, 
    comment,
    apiResults,
    measurementDateTime,
    recordingDuration,
    audioUri,
    dualChannelResult,
    isDualChannel,
    locationData
  } = route.params || { 
    humidity: 0, 
    porosity: 0, 
    measurementName: '', 
    comment: '',
    apiResults: null,
    measurementDateTime: '',
    recordingDuration: 0,
    audioUri: null,
    dualChannelResult: null,
    isDualChannel: false,
    locationData: undefined
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [playingChannel, setPlayingChannel] = useState<'single' | 'channel1' | 'channel2' | null>(null);
  const [isDownloadingSignalsPlot, setIsDownloadingSignalsPlot] = useState(false);
  const [isDownloadingMagnitudePlot, setIsDownloadingMagnitudePlot] = useState(false);
  const [isDownloadingComparisonPlot, setIsDownloadingComparisonPlot] = useState(false);
  const [signalsPlotUri, setSignalsPlotUri] = useState<string | null>(null);
  const [magnitudePlotUri, setMagnitudePlotUri] = useState<string | null>(null);
  const [comparisonPlotUri, setComparisonPlotUri] = useState<string | null>(null);
  const [isGeneratingPlots, setIsGeneratingPlots] = useState(false);

  // Estados para controlar la expansión de cada sección
  const [isDataMeasurementExpanded, setIsDataMeasurementExpanded] = useState(true);
  const [isMetricsExpanded, setIsMetricsExpanded] = useState(false);
  const [isChartsExpanded, setIsChartsExpanded] = useState(false);
  const [isAudioExpanded, setIsAudioExpanded] = useState(false);

  // Generar plots automáticamente al cargar la pantalla
  useEffect(() => {
    if (apiResults && apiResults.csv_filename && !apiResults.error) {
      generateAllPlots();
    }
  }, [apiResults]);

  // Bloquear el botón atrás del dispositivo
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Bloquear el botón atrás - no hacer nada
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove();
    }, [])
  );

  // Guardar la referencia al sound para poder detenerlo
  const [currentSound, setCurrentSound] = useState<any>(null);

  // Función para generar automáticamente todos los plots
  const generateAllPlots = async () => {
    if (!apiResults?.csv_filename || apiResults.error) {
      return;
    }

    setIsGeneratingPlots(true);

    try {
      // Generar plots en paralelo
      const plotPromises = [
        generatePlotFromEndpoint('signals', 'freq_min=500&freq_max=3000'),
        generatePlotFromEndpoint('magnitude-phase', 'column_name=h12_mag'),
        generatePlotFromEndpoint('selected-signals', 'columns=alpha,coherence,s11&plot_name=comparison&ymin=0&ymax=1')
      ];

      const [signalsResult, magnitudeResult, comparisonResult] = await Promise.all(plotPromises);

      // Establecer las URIs de los plots generados
      if (signalsResult) {
        setSignalsPlotUri(signalsResult);
      }
      if (magnitudeResult) {
        setMagnitudePlotUri(magnitudeResult);
      }
      if (comparisonResult) {
        setComparisonPlotUri(comparisonResult);
      }

    } catch (error) {
    } finally {
      setIsGeneratingPlots(false);
    }
  };

  // Función auxiliar para generar un plot desde un endpoint
  const generatePlotFromEndpoint = (plotType: string, body: string): Promise<string | null> => {
    return new Promise<string | null>(async (resolve) => {
      try {
        const requestUrl = `${API_BASE_URL}/generate-plot-${plotType}/${apiResults.csv_filename}`;

        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body
        });

        if (response.ok) {
        const blob = await response.blob();

        // Usar FileReader para leer el blob (compatible con React Native)
        const fileReaderResult = await new Promise<string | null>((fileResolve) => {
          const fileReader = new FileReader();
          fileReader.onload = async () => {
            try {
              const base64data = fileReader.result as string;
              
              // Verificar si es JSON
              if (base64data.includes('application/json') || base64data.includes('application/octet-stream')) {
                const base64Content = base64data.split(',')[1];
                const decodedContent = atob(base64Content);
                
                const jsonResponse = JSON.parse(decodedContent);
                
                if (jsonResponse.download_url && jsonResponse.message && jsonResponse.message.includes("generated successfully")) {
                  
                  // Descargar la imagen
                  const downloadResult = await FileSystem.downloadAsync(
                    jsonResponse.download_url,
                    FileSystem.documentDirectory + jsonResponse.plot_filename
                  );

                  if (downloadResult.status === 200) {
                    fileResolve(downloadResult.uri);
                    return;
                  } else {
                    fileResolve(null);
                    return;
                  }
                }
              } else {
                fileResolve(null);
              }
            } catch (error) {
              fileResolve(null);
            }
          };
          
          fileReader.onerror = () => {
            fileResolve(null);
          };
          
          fileReader.readAsDataURL(blob);
        });

        resolve(fileReaderResult);
        } else {
          resolve(null);
        }
      } catch (error) {
        resolve(null);
      }
    });
  };

  // Funciones simplificadas para compartir plots ya generados
  const shareSignalsPlot = async () => {
    if (!signalsPlotUri) {
      Alert.alert(strings.common.error, strings.resultsScreen.signalsPlotNotAvailable);
      return;
    }
    await shareExistingPlot(signalsPlotUri, strings.resultsScreen.signalsPlot);
  };

  const shareMagnitudePlot = async () => {
    if (!magnitudePlotUri) {
      Alert.alert(strings.common.error, strings.resultsScreen.magnitudePlotNotAvailable);
      return;
    }
    await shareExistingPlot(magnitudePlotUri, strings.resultsScreen.magnitudePlot);
  };

  const shareComparisonPlot = async () => {
    if (!comparisonPlotUri) {
      Alert.alert(strings.common.error, strings.resultsScreen.comparisonPlotNotAvailable);
      return;
    }
    await shareExistingPlot(comparisonPlotUri, strings.resultsScreen.comparisonPlot);
  };

  const shareExistingPlot = async (plotUri: string, plotName: string) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(plotUri, {
          mimeType: 'image/png',
          dialogTitle: `${strings.resultsScreen.shareDialogTitle} ${plotName}`,
          UTI: 'public.png'
        });
      } else {
        Alert.alert(strings.common.error, strings.resultsScreen.sharingNotAvailable);
      }
    } catch (error) {
      Alert.alert(strings.common.error, `${strings.resultsScreen.couldNotSharePlot} ${plotName}`);
    }
  };

  const playSound = async (channelType: 'single' | 'channel1' | 'channel2' = 'single') => {
    let audioPath: string | undefined;
    
    if (channelType === 'single' && audioUri) {
      audioPath = audioUri;
    } else if (channelType === 'channel1' && dualChannelResult) {
      audioPath = dualChannelResult.channel1Path;
    } else if (channelType === 'channel2' && dualChannelResult) {
      audioPath = dualChannelResult.channel2Path;
    }

    if (!audioPath) {
      Alert.alert(strings.common.error, strings.resultsScreen.noAudioFileToPlay);
      return;
    }

    try {
      setIsLoading(true);
      
      // Detener audio previo si existe
      if (currentSound) {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      }
      
      // Usar expo-av para reproducir el audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioPath },
        { shouldPlay: true }
      );
      
      setIsPlaying(true);
      setPlayingChannel(channelType);
      setCurrentSound(sound);
    } catch (error) {
      Alert.alert(strings.common.error, strings.resultsScreen.couldNotPlayAudio);
    } finally {
      setIsLoading(false);
    }
  };

  const stopSound = async () => {
    try {
      if (currentSound) {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
        setCurrentSound(null);
      }
      setIsPlaying(false);
      setPlayingChannel(null);
    } catch (error) {
    }
  };

  const downloadCSV = async () => {
    if (!apiResults?.csv_download_url) {
      Alert.alert(strings.common.error, strings.resultsScreen.noCsvFileToDownload);
      return;
    }

    try {
      setIsDownloading(true);

      // Descargar el archivo CSV
      const downloadResult = await FileSystem.downloadAsync(
        apiResults.csv_download_url,
        FileSystem.documentDirectory + apiResults.csv_filename
      );

      if (downloadResult.status === 200) {
        
        // Verificar si se puede compartir
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'text/csv',
            dialogTitle: `${strings.resultsScreen.downloadCsvDialogTitle} ${apiResults.csv_filename}`,
            UTI: 'public.comma-separated-values-text'
          });
        } else {
          Alert.alert(
            strings.resultsScreen.downloadCompleted,
            `${strings.resultsScreen.csvSavedAt} ${downloadResult.uri}`,
            [{ text: strings.common.ok }]
          );
        }
      } else {
        throw new Error(`Error HTTP: ${downloadResult.status}`);
      }
    } catch (error) {
      Alert.alert(
        strings.resultsScreen.downloadError,
        `${strings.resultsScreen.couldNotDownloadCsv}: ${error instanceof Error ? error.message : strings.resultsScreen.unknownError}`,
        [{ text: strings.common.ok }]
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const shareAudio = async (channelType: 'single' | 'channel1' | 'channel2' = 'single') => {
    let audioPath: string | undefined;
    let fileName: string = 'Audio'; // Valor por defecto
    
    if (channelType === 'single' && audioUri) {
      audioPath = audioUri;
      fileName = strings.resultsScreen.recordedAudio;
    } else if (channelType === 'channel1' && dualChannelResult) {
      audioPath = dualChannelResult.channel1Path;
      fileName = strings.resultsScreen.channel1LeftFile;
    } else if (channelType === 'channel2' && dualChannelResult) {
      audioPath = dualChannelResult.channel2Path;
      fileName = strings.resultsScreen.channel2RightFile;
    }

    if (!audioPath) {
      Alert.alert(strings.common.error, strings.resultsScreen.noAudioFileToShare);
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(audioPath, {
          mimeType: 'audio/wav',
          dialogTitle: `${strings.resultsScreen.shareAudioDialogTitle} ${fileName}`,
          UTI: 'public.wav'
        });
      } else {
        Alert.alert(strings.common.error, strings.resultsScreen.sharingNotAvailable);
      }
    } catch (error) {
      Alert.alert(strings.common.error, strings.resultsScreen.couldNotShareAudio);
    }
  };

  const formatDuration = (milliseconds: number) => {
    if (!milliseconds || milliseconds === 0) return strings.resultsScreen.defaultDurationFormat;
    
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds.toFixed(3)}s`;
    } else {
      return `${seconds.toFixed(3)} segundos`;
    }
  };

  const formatDateTime = (dateTime: string) => {
    if (!dateTime) return strings.resultsScreen.notAvailable;
    try {
      const date = new Date(dateTime);
      return date.toLocaleString('es-ES');
    } catch (error) {
      return dateTime;
    }
  };

  // Funciones para toggle de secciones
  const toggleDataMeasurement = () => setIsDataMeasurementExpanded(!isDataMeasurementExpanded);
  const toggleMetrics = () => setIsMetricsExpanded(!isMetricsExpanded);
  const toggleCharts = () => setIsChartsExpanded(!isChartsExpanded);
  const toggleAudio = () => setIsAudioExpanded(!isAudioExpanded);

  // Función para abrir Google Maps con la ubicación
  const openGoogleMaps = async () => {
    if (!locationData || typeof locationData.latitude !== 'number' || typeof locationData.longitude !== 'number') {
      return;
    }
        
    try {
      const lat = locationData.latitude;
      const lng = locationData.longitude;
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
          Alert.alert(
            strings.common.error,
            strings.resultsScreen.cantOpenGoogleMaps,
            [{ text: strings.common.ok }]
          );
        }
      }
    } catch (error) {
      Alert.alert(
        strings.common.error,
        strings.resultsScreen.couldNotOpenGoogleMaps,
        [{ text: strings.common.ok }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.resultsScreen.title}</Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        
        {/* SECCIÓN: DATOS MEDICIÓN */}
        <View style={[styles.sectionContainer, { backgroundColor: '#e8f5e8' }]}>
          <TouchableOpacity 
            style={styles.sectionHeader} 
            onPress={toggleDataMeasurement}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.sectionTitle, { color: '#2E7D32' }]}>{strings.resultsScreen.dataMeasurement}</Text>
              <Text style={{ fontSize: 18, color: '#2E7D32' }}>
                {isDataMeasurementExpanded ? '▼' : '▶'}
              </Text>
            </View>
          </TouchableOpacity>
          
          {isDataMeasurementExpanded && (
            <View style={styles.sectionContent}>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: 'bold' }}>{strings.startScreen.commentLabel}: </Text>{comment}
            </Text>
            
            {measurementDateTime ? (
              <Text style={styles.infoText}>
                <Text style={{ fontWeight: 'bold' }}>{strings.resultsScreen.date}</Text>{formatDateTime(measurementDateTime)}
              </Text>
            ) : null}
            
            {recordingDuration && recordingDuration > 0 ? (
              <Text style={styles.infoText}>
                <Text style={{ fontWeight: 'bold' }}>{strings.resultsScreen.duration}</Text>{formatDuration(recordingDuration)}
              </Text>
            ) : null}

            {locationData ? (
              <TouchableOpacity
                onPress={openGoogleMaps}
                activeOpacity={0.7}
                style={{ marginTop: 8 }}
              >
                <Text style={[styles.infoText, { marginBottom: 4 }]}>
                  <Text style={{ fontWeight: 'bold' }}>{strings.resultsScreen.latitude}</Text>{formatLocationForDisplay(locationData).decimal.latitude}°
                </Text>
                <Text style={[styles.infoText, { marginBottom: 4 }]}>
                  <Text style={{ fontWeight: 'bold' }}>{strings.resultsScreen.longitude}</Text>{formatLocationForDisplay(locationData).decimal.longitude}°
                </Text>
                <Text style={[styles.infoText, { marginBottom: 8 }]}>
                  <Text style={{ fontWeight: 'bold' }}>{strings.resultsScreen.accuracy}</Text>{formatLocationForDisplay(locationData).accuracy}
                </Text>
                <Text style={{ fontSize: 12, color: '#2E7D32', fontStyle: 'italic' }}>
                  {strings.resultsScreen.tapToOpenMaps}
                </Text>
              </TouchableOpacity>
            ) : null}
            </View>
          )}
        </View>

        {/* SECCIÓN: MÉTRICAS */}
        {apiResults ? (
          <View style={[styles.sectionContainer, { backgroundColor: '#fff3e0' }]}>
            <TouchableOpacity 
              style={styles.sectionHeader} 
              onPress={toggleMetrics}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.sectionTitle, { color: '#F57C00' }]}>{strings.resultsScreen.metrics}</Text>
                <Text style={{ fontSize: 18, color: '#F57C00' }}>
                  {isMetricsExpanded ? '▼' : '▶'}
                </Text>
              </View>
            </TouchableOpacity>
            
            {isMetricsExpanded && (
              <View style={styles.sectionContent}>
              {apiResults.error ? (
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#d32f2f', marginBottom: 8 }}>
                    {strings.resultsScreen.errorInApi}
                  </Text>
                  <Text style={[styles.infoText, { color: '#d32f2f' }]}>
                    <Text style={{ fontWeight: 'bold' }}>{strings.resultsScreen.errorLabel}</Text>{apiResults.error}
                  </Text>
                  {apiResults.details ? (
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 8, fontStyle: 'italic' }}>
                      {apiResults.details}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                    {strings.resultsScreen.audioRecordedButNotProcessed}
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.infoText}>
                    <Text style={{ fontWeight: 'bold' }}>{strings.resultsScreen.alphaAverage}</Text>{apiResults.alpha_average?.toFixed(4) || strings.resultsScreen.notAvailable}
                  </Text>
                  <Text style={styles.infoText}>
                    <Text style={{ fontWeight: 'bold' }}>{strings.resultsScreen.calculatedPorosity}</Text>{apiResults.porosity?.toFixed(4) || strings.resultsScreen.notAvailable}
                  </Text>
                  
                  {/* Descarga de CSV */}
                  {apiResults.csv_download_url ? (
                    <View style={{ marginTop: 16, padding: 12, backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#F57C00' }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#F57C00', marginBottom: 8 }}>
                        {strings.resultsScreen.csvFileTitle}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                        {strings.resultsScreen.csvDescription}
                      </Text>
                      
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12, textAlign: 'center' }}>
                        📄 {apiResults.csv_filename || strings.resultsScreen.notAvailable}
                      </Text>
                      
                      <Button
                        title={isDownloading ? strings.resultsScreen.downloading : strings.resultsScreen.downloadCsv}
                        onPress={downloadCSV}
                        disabled={isDownloading}
                        color="#F57C00"
                      />
                      
                      <Text style={{ fontSize: 12, color: '#666', marginTop: 8, textAlign: 'center' }}>
                        {isDownloading ? strings.resultsScreen.downloadingFile : strings.resultsScreen.csvFileAvailable}
                      </Text>
                    </View>
                  ) : null}


                </View>
              )}
            </View>
          )}
        </View>
        ) : null}

        {/* SECCIÓN: GRÁFICOS */}
        {apiResults && apiResults.csv_filename && !apiResults.error ? (
          <View style={[styles.sectionContainer, { backgroundColor: '#f3e5f5' }]}>
            <TouchableOpacity 
              style={styles.sectionHeader} 
              onPress={toggleCharts}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.sectionTitle, { color: '#7B1FA2' }]}>{strings.resultsScreen.charts}</Text>
                <Text style={{ fontSize: 18, color: '#7B1FA2' }}>
                  {isChartsExpanded ? '▼' : '▶'}
                </Text>
              </View>
            </TouchableOpacity>
            
            {isChartsExpanded && (
              <View style={styles.sectionContent}>
                {/* Plot de Señales */}
                <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#fff3e0', borderRadius: 8, borderWidth: 1, borderColor: '#E65100' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#E65100', marginBottom: 8 }}>
                    {strings.resultsScreen.signalsPlot}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    {strings.resultsScreen.signalsPlotDescription}
                  </Text>
                
                {signalsPlotUri ? (
                  <View style={{ marginVertical: 8, alignItems: 'center' }}>
                    <Image 
                      source={{ uri: signalsPlotUri }} 
                      style={{ 
                        width: '100%', 
                        height: 150, 
                        borderRadius: 8,
                        backgroundColor: '#f0f0f0'
                      }}
                      resizeMode="contain"
                    />
                    <Text style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                      {strings.resultsScreen.plotGenerated}
                    </Text>
                  </View>
                ) : isGeneratingPlots ? (
                  <View style={{ marginVertical: 8, alignItems: 'center', padding: 20 }}>
                    <ActivityIndicator size="large" color="#FF9800" />
                    <Text style={{ fontSize: 10, color: '#666', marginTop: 8 }}>
                      {strings.resultsScreen.generatingPlot}
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginVertical: 8, alignItems: 'center', padding: 20, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, color: '#999' }}>
                      {strings.resultsScreen.plotNotAvailable}
                    </Text>
                  </View>
                )}
                
                <Button
                  title={signalsPlotUri ? strings.resultsScreen.sharePlot : strings.resultsScreen.generatingPlot}
                  onPress={shareSignalsPlot}
                  disabled={!signalsPlotUri}
                  color={signalsPlotUri ? "#FF9800" : "#CCCCCC"}
                />
                </View>

                {/* Plot de Magnitud y Fase */}
                <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#e8f5e8', borderRadius: 8, borderWidth: 1, borderColor: '#2E7D32' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#2E7D32', marginBottom: 8 }}>
                    {strings.resultsScreen.magnitudePlot}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    {strings.resultsScreen.magnitudePlotDescription}
                  </Text>
                  
                  {magnitudePlotUri ? (
                    <View style={{ marginVertical: 8, alignItems: 'center' }}>
                      <Image 
                        source={{ uri: magnitudePlotUri }} 
                        style={{ 
                          width: '100%', 
                          height: 150, 
                          borderRadius: 8,
                          backgroundColor: '#f0f0f0'
                        }}
                        resizeMode="contain"
                      />
                      <Text style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                        {strings.resultsScreen.plotGenerated}
                      </Text>
                    </View>
                  ) : isGeneratingPlots ? (
                    <View style={{ marginVertical: 8, alignItems: 'center', padding: 20 }}>
                      <ActivityIndicator size="large" color="#4CAF50" />
                      <Text style={{ fontSize: 10, color: '#666', marginTop: 8 }}>
                        {strings.resultsScreen.generatingPlot}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ marginVertical: 8, alignItems: 'center', padding: 20, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
                      <Text style={{ fontSize: 10, color: '#999' }}>
                        {strings.resultsScreen.plotNotAvailable}
                      </Text>
                    </View>
                  )}
                  
                  <Button
                    title={magnitudePlotUri ? strings.resultsScreen.sharePlot : strings.resultsScreen.generatingPlot}
                    onPress={shareMagnitudePlot}
                    disabled={!magnitudePlotUri}
                    color={magnitudePlotUri ? "#4CAF50" : "#CCCCCC"}
                  />
                </View>

                {/* Plot de Comparación */}
                <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#e3f2fd', borderRadius: 8, borderWidth: 1, borderColor: '#1565C0' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1565C0', marginBottom: 8 }}>
                    {strings.resultsScreen.comparisonPlot}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    {strings.resultsScreen.comparisonPlotDescription}
                  </Text>
                  
                  {comparisonPlotUri ? (
                    <View style={{ marginVertical: 8, alignItems: 'center' }}>
                      <Image 
                        source={{ uri: comparisonPlotUri }} 
                        style={{ 
                          width: '100%', 
                          height: 150, 
                          borderRadius: 8,
                          backgroundColor: '#f0f0f0'
                        }}
                        resizeMode="contain"
                      />
                      <Text style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                        {strings.resultsScreen.plotGenerated}
                      </Text>
                    </View>
                  ) : isGeneratingPlots ? (
                    <View style={{ marginVertical: 8, alignItems: 'center', padding: 20 }}>
                      <ActivityIndicator size="large" color="#2196F3" />
                      <Text style={{ fontSize: 10, color: '#666', marginTop: 8 }}>
                        {strings.resultsScreen.generatingPlot}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ marginVertical: 8, alignItems: 'center', padding: 20, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
                      <Text style={{ fontSize: 10, color: '#999' }}>
                        {strings.resultsScreen.plotNotAvailable}
                      </Text>
                    </View>
                  )}
                  
                  <Button
                    title={comparisonPlotUri ? strings.resultsScreen.sharePlot : strings.resultsScreen.generatingPlot}
                    onPress={shareComparisonPlot}
                    disabled={!comparisonPlotUri}
                    color={comparisonPlotUri ? "#2196F3" : "#CCCCCC"}
                  />
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* SECCIÓN: AUDIO */}
        {((isDualChannel && dualChannelResult) || audioUri) ? (
          <View style={[styles.sectionContainer, { backgroundColor: '#e3f2fd' }]}>
            <TouchableOpacity 
              style={styles.sectionHeader} 
              onPress={toggleAudio}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.sectionTitle, { color: '#1565C0' }]}>{strings.resultsScreen.audio}</Text>
                <Text style={{ fontSize: 18, color: '#1565C0' }}>
                  {isAudioExpanded ? '▼' : '▶'}
                </Text>
              </View>
            </TouchableOpacity>
            
            {isAudioExpanded && (
              <View style={styles.sectionContent}>
              {isDualChannel && dualChannelResult ? (
                <View>
                  <Text style={styles.audioSubtitle}>{strings.resultsScreen.stereoRecordingWithSeparateChannels}</Text>
                  
                  {/* Canal 1 (Izquierdo) */}
                  <View style={{ marginVertical: 8, padding: 12, backgroundColor: '#fff3e0', borderRadius: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#FF6B35', marginBottom: 8, textAlign: 'center' }}>
                      {strings.resultsScreen.channel1Left}
                    </Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => playingChannel !== 'channel1' ? playSound('channel1') : stopSound()}
                        disabled={isLoading}
                        style={{ 
                          backgroundColor: playingChannel !== 'channel1' ? '#FF6B35' : '#F44336', 
                          padding: 12, 
                          borderRadius: 25, 
                          minWidth: 50,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 18 }}>
                          {isLoading ? "⏳" : playingChannel !== 'channel1' ? "▶️" : "⏹️"}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => shareAudio('channel1')}
                        style={{ 
                          backgroundColor: '#FF9800', 
                          padding: 12, 
                          borderRadius: 25, 
                          minWidth: 50,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 18 }}>📤</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Canal 2 (Derecho) */}
                  <View style={{ marginVertical: 8, padding: 12, backgroundColor: '#e0f2f1', borderRadius: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#4ECDC4', marginBottom: 8, textAlign: 'center' }}>
                      {strings.resultsScreen.channel2Right}
                    </Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => playingChannel !== 'channel2' ? playSound('channel2') : stopSound()}
                        disabled={isLoading}
                        style={{ 
                          backgroundColor: playingChannel !== 'channel2' ? '#4ECDC4' : '#F44336', 
                          padding: 12, 
                          borderRadius: 25, 
                          minWidth: 50,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 18 }}>
                          {isLoading ? "⏳" : playingChannel !== 'channel2' ? "▶️" : "⏹️"}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => shareAudio('channel2')}
                        style={{ 
                          backgroundColor: '#FF9800', 
                          padding: 12, 
                          borderRadius: 25, 
                          minWidth: 50,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 18 }}>📤</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.audioInfo}>
                    {isPlaying ? `${strings.resultsScreen.playingChannel} ${playingChannel === 'channel1' ? strings.resultsScreen.leftChannel : strings.resultsScreen.rightChannel}...` : strings.resultsScreen.readyToPlay}
                  </Text>
                </View>
              ) : audioUri ? (
                <View>
                  <Text style={styles.audioSubtitle}>{strings.resultsScreen.stereoFile2Channels}</Text>
                  
                  <View style={{ marginVertical: 8, padding: 12, backgroundColor: '#e8f5e8', borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => playingChannel !== 'single' ? playSound('single') : stopSound()}
                        disabled={isLoading}
                        style={{ 
                          backgroundColor: playingChannel !== 'single' ? '#4CAF50' : '#F44336', 
                          padding: 12, 
                          borderRadius: 25, 
                          minWidth: 50,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 18 }}>
                          {isLoading ? "⏳" : playingChannel !== 'single' ? "▶️" : "⏹️"}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => shareAudio('single')}
                        style={{ 
                          backgroundColor: '#FF9800', 
                          padding: 12, 
                          borderRadius: 25, 
                          minWidth: 50,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 18 }}>📤</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <Text style={styles.audioInfo}>
                    {isPlaying ? strings.resultsScreen.playing : strings.resultsScreen.readyToPlay}
                  </Text>
                </View>
              ) : null}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Form')}
        >
          <Text style={styles.buttonText}>{strings.resultsScreen.startOver}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
