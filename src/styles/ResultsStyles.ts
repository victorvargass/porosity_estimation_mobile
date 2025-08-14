import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  // Nuevos estilos para secciones
  sectionContainer: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionContent: {
    // El contenido dentro de cada sección
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
    color: '#333',
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  audioContainer: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  audioTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  audioSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  audioControls: {
    marginBottom: 10,
  },
  audioInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    flex: 1,
  },
  // Estilos para dual channel
  audioResultsContainer: {
    gap: 16,
    marginBottom: 20,
  },
  channel1Section: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  channel2Section: {
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
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
    marginBottom: 15,
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
  csvContainer: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  csvTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  csvSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  csvControls: {
    marginBottom: 10,
  },
  csvInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  apiContainer: {
    backgroundColor: '#e8f5e8',
    padding: 18,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  apiTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2e7d32',
  },
  apiText: {
    fontSize: 14,
    color: '#2e7d32',
    marginBottom: 4,
  },
  buttonContainer: {
    marginTop: 30,
    marginBottom: 20,
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
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
