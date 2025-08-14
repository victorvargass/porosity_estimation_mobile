export default {
    // Parámetros de análisis
    m: 50, // averages
    n: 8192, // number_of_samples 
    sampling_rate: 48000,
    
    // Distancias en metros
    distance_between_mics: 0.04,
    distance_between_mic_1_and_sample: 0.3,
    
    // Rango de frecuencias en Hz
    min_frec: 500,
    max_frec: 3000,
    
    // Configuración de audio
    numberOfChannels: 2,
    
    // Otros parámetros
    hc_path: "",
};
