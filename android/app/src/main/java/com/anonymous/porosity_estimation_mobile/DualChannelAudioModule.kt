package com.anonymous.porosity_estimation_mobile

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.AudioManager
import android.media.AudioDeviceInfo
import android.content.Context
import android.util.Log
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.*

data class USBDeviceInfo(
    val vendorId: String,
    val productId: String,
    val serialNumber: String?,
    val deviceName: String?,
    val manufacturerName: String?
)

class DualChannelAudioModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private var audioRecorder: DualChannelAudioRecorder? = null
    private val TAG = "DualChannelAudio"
    
    override fun getName(): String {
        return "DualChannelAudio"
    }
    
    @ReactMethod
    fun getAudioDevices(promise: Promise) {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS)
            val deviceArray = Arguments.createArray()
            
            for (device in devices) {
                val deviceInfo = Arguments.createMap()
                deviceInfo.putInt("id", device.id)
                deviceInfo.putString("productName", device.productName.toString())
                deviceInfo.putString("type", getDeviceTypeString(device.type))
                deviceInfo.putBoolean("isSource", device.isSource)
                
                // Información específica para interfaces USB
                if (device.type == AudioDeviceInfo.TYPE_USB_DEVICE || 
                    device.type == AudioDeviceInfo.TYPE_USB_ACCESSORY ||
                    device.type == AudioDeviceInfo.TYPE_USB_HEADSET) {
                    deviceInfo.putBoolean("isUSB", true)
                    
                    // Obtener información de canales
                    val channelMasks = device.channelMasks
                    val channelCounts = device.channelCounts
                    
                    val channelInfo = Arguments.createArray()
                    if (channelCounts.isNotEmpty()) {
                        for (count in channelCounts) {
                            channelInfo.pushInt(count)
                        }
                    }
                    deviceInfo.putArray("supportedChannelCounts", channelInfo)
                    
                    // Información adicional de identificación USB
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        // Información de direcciones y puertos USB
                        deviceInfo.putString("address", device.address ?: "N/A")
                        
                        // Información de sampling rates soportados
                        val sampleRates = device.sampleRates
                        val sampleRateArray = Arguments.createArray()
                        if (sampleRates.isNotEmpty()) {
                            for (rate in sampleRates) {
                                sampleRateArray.pushInt(rate)
                            }
                        }
                        deviceInfo.putArray("supportedSampleRates", sampleRateArray)
                        
                        // Información de encodings soportados
                        val encodings = device.encodings
                        val encodingArray = Arguments.createArray()
                        if (encodings.isNotEmpty()) {
                            for (encoding in encodings) {
                                encodingArray.pushInt(encoding)
                            }
                        }
                        deviceInfo.putArray("supportedEncodings", encodingArray)
                    }
                    
                    // Obtener información específica de hardware USB
                    Log.d(TAG, "🔍 Intentando obtener info USB para: ${device.productName}")
                    val usbInfo = getUSBDeviceInfo(device)
                    Log.d(TAG, "📊 Resultado USB info: $usbInfo")
                    
                    if (usbInfo != null) {
                        Log.d(TAG, "✅ Información USB obtenida exitosamente")
                        deviceInfo.putString("vendorId", usbInfo.vendorId)
                        deviceInfo.putString("productId", usbInfo.productId)
                        deviceInfo.putString("serialNumber", usbInfo.serialNumber ?: "N/A")
                        deviceInfo.putString("deviceName", usbInfo.deviceName ?: device.productName.toString())
                        deviceInfo.putString("manufacturerName", usbInfo.manufacturerName ?: "N/A")
                        
                        // Generar identificador único más específico con VID/PID
                        val uniqueId = "USB_${usbInfo.vendorId}_${usbInfo.productId}_${usbInfo.serialNumber ?: device.id.toString()}"
                        deviceInfo.putString("uniqueIdentifier", uniqueId)
                        deviceInfo.putString("hardwareIdentifier", "${usbInfo.vendorId}:${usbInfo.productId}")
                    } else {
                        Log.w(TAG, "⚠️ No se pudo obtener información USB, usando fallback")
                        // Fallback para dispositivos sin información USB detallada
                        val uniqueId = "${device.id}_${device.productName.hashCode()}_${device.type}"
                        deviceInfo.putString("uniqueIdentifier", uniqueId)
                        
                        // Intentar extraer información de la dirección si está disponible
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && device.address != null) {
                            deviceInfo.putString("hardwareIdentifier", "ADDR_${device.address}")
                            Log.d(TAG, "📍 Usando dirección como identificador: ${device.address}")
                        }
                    }
                    deviceInfo.putString("deviceHash", device.productName.hashCode().toString())
                    
                } else {
                    deviceInfo.putBoolean("isUSB", false)
                }
                
                deviceArray.pushMap(deviceInfo)
            }
            
            promise.resolve(deviceArray)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting audio devices", e)
            promise.reject("DEVICE_ERROR", "Failed to get audio devices: ${e.message}")
        }
    }
    
    @ReactMethod
    fun startDualChannelRecording(deviceId: Int?, sampleRate: Int, outputPath: String, promise: Promise) {
        try {
            if (audioRecorder?.isRecording() == true) {
                promise.reject("RECORDING_ERROR", "Recording already in progress")
                return
            }
            
            Log.d(TAG, "📱 About to create DualChannelAudioRecorder...")
            audioRecorder = DualChannelAudioRecorder(
                deviceId = deviceId,
                sampleRate = sampleRate,
                outputPath = outputPath,
                context = reactApplicationContext
            )
            
            Log.d(TAG, "📱 DualChannelAudioRecorder created, calling startRecording()...")
            val success = audioRecorder!!.startRecording()
            Log.d(TAG, "📱 startRecording() returned: $success")
            
            if (success) {
                Log.d(TAG, "Dual channel recording started successfully")
                promise.resolve(true)
            } else {
                promise.reject("RECORDING_ERROR", "Failed to start dual channel recording")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting dual channel recording", e)
            promise.reject("RECORDING_ERROR", "Failed to start recording: ${e.message}")
        }
    }
    
    @ReactMethod
    fun stopDualChannelRecording(promise: Promise) {
        try {
            val recorder = audioRecorder
            if (recorder == null) {
                promise.reject("RECORDING_ERROR", "No active recording")
                return
            }
            
            val result = recorder.stopRecording()
            audioRecorder = null
            
            if (result != null) {
                val resultMap = Arguments.createMap()
                resultMap.putString("channel1Path", result.first)
                resultMap.putString("channel2Path", result.second)
                promise.resolve(resultMap)
            } else {
                promise.reject("RECORDING_ERROR", "Failed to stop recording")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping dual channel recording", e)
            promise.reject("RECORDING_ERROR", "Failed to stop recording: ${e.message}")
        }
    }
    
    @ReactMethod
    fun isRecording(promise: Promise) {
        try {
            val isRecording = audioRecorder?.isRecording() ?: false
            promise.resolve(isRecording)
        } catch (e: Exception) {
            promise.reject("RECORDING_ERROR", "Failed to check recording status: ${e.message}")
        }
    }
    
    @ReactMethod
    fun getAudioLevels(promise: Promise) {
        try {
            val recorder = audioRecorder
            if (recorder == null || !recorder.isRecording()) {
                // Si no hay grabación activa, devolver niveles en cero
                val levels = Arguments.createMap()
                levels.putDouble("channel1", 0.0)
                levels.putDouble("channel2", 0.0)
                promise.resolve(levels)
                return
            }
            
            // Obtener niveles reales del grabador
            val audioLevels = recorder.getCurrentAudioLevels()
            val levels = Arguments.createMap()
            levels.putDouble("channel1", audioLevels.first)
            levels.putDouble("channel2", audioLevels.second)
            promise.resolve(levels)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting audio levels", e)
            promise.reject("AUDIO_LEVELS_ERROR", "Failed to get audio levels: ${e.message}")
        }
    }
    
    private fun getDeviceTypeString(type: Int): String {
        return when (type) {
            AudioDeviceInfo.TYPE_BUILTIN_MIC -> "BUILTIN_MIC"
            AudioDeviceInfo.TYPE_USB_DEVICE -> "USB_DEVICE"
            AudioDeviceInfo.TYPE_USB_ACCESSORY -> "USB_ACCESSORY"
            AudioDeviceInfo.TYPE_USB_HEADSET -> "USB_HEADSET"
            AudioDeviceInfo.TYPE_WIRED_HEADSET -> "WIRED_HEADSET"
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "BLUETOOTH_SCO"
            else -> "UNKNOWN_$type"
        }
    }
    
    private fun getUSBDeviceInfo(audioDevice: AudioDeviceInfo): USBDeviceInfo? {
        return try {
            Log.d(TAG, "🚀 Iniciando búsqueda de información USB...")
            val usbManager = reactApplicationContext.getSystemService(Context.USB_SERVICE) as UsbManager
            
            if (usbManager == null) {
                Log.e(TAG, "❌ UsbManager es null")
                return null
            }
            
            val deviceList = usbManager.deviceList
            
            // Buscar el dispositivo USB correspondiente por nombre de producto
            val audioProductName = audioDevice.productName.toString()
            Log.d(TAG, "🔍 Buscando dispositivo USB para AudioDevice: '$audioProductName'")
            Log.d(TAG, "🔍 Total dispositivos USB encontrados: ${deviceList.size}")
            
            if (deviceList.isEmpty()) {
                Log.w(TAG, "⚠️ No hay dispositivos USB detectados por UsbManager")
                return null
            }
            
            // Listar todos los dispositivos USB para diagnóstico
            deviceList.values.forEachIndexed { index, usbDevice ->
                val usbProductName = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    usbDevice.productName ?: "Sin nombre"
                } else {
                    "API < 21"
                }
                val manufacturerName = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    usbDevice.manufacturerName ?: "Sin fabricante"
                } else {
                    "API < 21"
                }
                
                Log.d(TAG, "📱 USB Device #$index:")
                Log.d(TAG, "   📝 Nombre: '$usbProductName'")
                Log.d(TAG, "   🏭 Fabricante: '$manufacturerName'")
                Log.d(TAG, "   🔧 VID: ${String.format("%04X", usbDevice.vendorId)} (${usbDevice.vendorId})")
                Log.d(TAG, "   📦 PID: ${String.format("%04X", usbDevice.productId)} (${usbDevice.productId})")
                Log.d(TAG, "   📂 Clase: ${usbDevice.deviceClass}")
                Log.d(TAG, "   🔌 Interface count: ${usbDevice.interfaceCount}")
            }
            
            // Buscar coincidencias más amplias
            for (usbDevice in deviceList.values) {
                val usbProductName = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    usbDevice.productName ?: ""
                } else {
                    ""
                }
                val usbManufacturerName = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    usbDevice.manufacturerName ?: ""
                } else {
                    ""
                }
                
                Log.d(TAG, "🔍 Comparando:")
                Log.d(TAG, "   Audio: '$audioProductName'")
                Log.d(TAG, "   USB: '$usbProductName'")
                
                // Múltiples estrategias de matching
                val isMatch = when {
                    // Matching directo por nombre
                    usbProductName.isNotEmpty() && audioProductName.contains(usbProductName, ignoreCase = true) -> {
                        Log.d(TAG, "✅ Match por nombre de producto")
                        true
                    }
                    // Matching específico para AMS-44
                    usbProductName.contains("AMS-44", ignoreCase = true) || 
                    audioProductName.contains("AMS-44", ignoreCase = true) -> {
                        Log.d(TAG, "✅ Match específico AMS-44")
                        true
                    }
                    // Matching por "USB-Audio" en el nombre
                    audioProductName.contains("USB-Audio", ignoreCase = true) && 
                    usbDevice.deviceClass == 1 -> { // Clase 1 = Audio
                        Log.d(TAG, "✅ Match por USB-Audio + clase Audio")
                        true
                    }
                    // Matching por Zoom como fabricante
                    usbManufacturerName.contains("Zoom", ignoreCase = true) -> {
                        Log.d(TAG, "✅ Match por fabricante Zoom")
                        true
                    }
                    else -> {
                        Log.d(TAG, "❌ No match")
                        false
                    }
                }
                
                if (isMatch) {
                    val vendorId = String.format("%04X", usbDevice.vendorId)
                    val productId = String.format("%04X", usbDevice.productId)
                    val serialNumber = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                        usbDevice.serialNumber
                    } else {
                        null
                    }
                    val manufacturerName = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                        usbDevice.manufacturerName
                    } else {
                        null
                    }
                    
                    Log.d(TAG, "🎉 Dispositivo USB encontrado:")
                    Log.d(TAG, "   🔧 VID: $vendorId")
                    Log.d(TAG, "   📦 PID: $productId")
                    Log.d(TAG, "   🔢 Serial: $serialNumber")
                    Log.d(TAG, "   🏢 Fabricante: $manufacturerName")
                    
                    return USBDeviceInfo(
                        vendorId = vendorId,
                        productId = productId,
                        serialNumber = serialNumber,
                        deviceName = usbProductName.ifEmpty { null },
                        manufacturerName = manufacturerName
                    )
                }
            }
            
            Log.w(TAG, "⚠️ No se encontró información USB específica para: $audioProductName")
            null
        } catch (e: Exception) {
            Log.e(TAG, "💥 Error obteniendo información del dispositivo USB", e)
            null
        }
    }
}

class DualChannelAudioRecorder(
    private val deviceId: Int?,
    private val sampleRate: Int,
    private val outputPath: String,
    private val context: Context
) {
    private val TAG = "DualChannelRecorder"
    
    init {
        Log.d(TAG, "🏗️ DualChannelAudioRecorder CONSTRUCTOR called")
        Log.d(TAG, "🏗️ Constructor - outputPath: '$outputPath'")
        Log.d(TAG, "🏗️ Constructor - deviceId: $deviceId")
        Log.d(TAG, "🏗️ Constructor - sampleRate: $sampleRate")
    }
    
    // Convertir URI a path normal si es necesario
    private val cleanOutputPath: String = if (outputPath.startsWith("file://")) {
        java.net.URI(outputPath).path
    } else {
        outputPath
    }
    
    private var audioRecord: AudioRecord? = null
    private val isRecording = AtomicBoolean(false)
    private var recordingJob: Job? = null
    
    // Configuración para forzar canales 1 y 2 específicamente
    private val channelConfig = AudioFormat.CHANNEL_IN_STEREO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    private val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat) * 2
    
    // Guardar las rutas de los archivos que se están creando
    private var channel1File: File? = null
    private var channel2File: File? = null
    
    // Variables para monitoreo de niveles de audio en tiempo real
    @Volatile private var currentChannel1Level: Double = 0.0
    @Volatile private var currentChannel2Level: Double = 0.0
    private val levelUpdateInterval = 100 // ms
    private var lastLevelUpdate = 0L
    
    // Factor de ganancia para hacer los niveles más sensibles
    private val audioLevelGain = 6.0 // Multiplica los niveles por 8 para máxima sensibilidad
    private val audioLevelThreshold = 0.3 // Umbral mínimo para considerar silencio
    
    fun startRecording(): Boolean {
        Log.d(TAG, "🚀 START RECORDING FUNCTION CALLED")
        Log.d(TAG, "🚀 Function entry - this should appear immediately")
        try {
            Log.d(TAG, "🚀 Inside try block")
            Log.d(TAG, "Starting dual channel recording...")
            Log.d(TAG, "Original outputPath: '$outputPath'")
            Log.d(TAG, "Clean outputPath: '$cleanOutputPath'")
            
            // Crear AudioRecord con configuración estéreo forzando canales 1 y 2
            audioRecord = if (deviceId != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val devices = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS)
                val targetDevice = devices.find { it.id == deviceId }
                
                if (targetDevice != null) {
                    Log.d(TAG, "Using specific device: ${targetDevice.productName}")
                    
                    // Obtener información de canales soportados
                    val supportedChannels = targetDevice.channelCounts
                    Log.d(TAG, "Device supports channel counts: ${supportedChannels.joinToString()}")
                    
                    // Información adicional sobre el dispositivo
                    val deviceType = when (targetDevice.type) {
                        AudioDeviceInfo.TYPE_BUILTIN_MIC -> "BUILTIN_MIC"
                        AudioDeviceInfo.TYPE_USB_DEVICE -> "USB_DEVICE"
                        AudioDeviceInfo.TYPE_USB_ACCESSORY -> "USB_ACCESSORY"
                        AudioDeviceInfo.TYPE_USB_HEADSET -> "USB_HEADSET"
                        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "WIRED_HEADSET"
                        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "BLUETOOTH_SCO"
                        else -> "UNKNOWN_${targetDevice.type}"
                    }
                    Log.d(TAG, "Device type: $deviceType")
                    Log.d(TAG, "Device is USB: ${targetDevice.type in arrayOf(AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_ACCESSORY, AudioDeviceInfo.TYPE_USB_HEADSET)}")
                    
                    // Para Zoom AMS-44: probar diferentes configuraciones
                    Log.d(TAG, "Device has channels: ${supportedChannels.joinToString()}")
                    Log.d(TAG, "Zoom AMS-44 detected - trying specific channel configuration")
                    
                    // Para Zoom AMS-44: usar configuración estéreo estándar
                    Log.d(TAG, "Device supports ${supportedChannels.joinToString()} channels")
                    Log.d(TAG, "Using STEREO configuration to capture channels 1-2")
                    val channelMask = AudioFormat.CHANNEL_IN_STEREO
                    
                    Log.d(TAG, "Selected channel mask for interface channels 1-2: $channelMask")
                    
                    AudioRecord.Builder()
                        .setAudioSource(MediaRecorder.AudioSource.UNPROCESSED)
                        .setAudioFormat(
                            AudioFormat.Builder()
                                .setEncoding(audioFormat)
                                .setSampleRate(sampleRate)
                                .setChannelMask(channelMask)
                                .build()
                        )
                        .setBufferSizeInBytes(bufferSize)
                        .build().apply {
                            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                                setPreferredDevice(targetDevice)
                            }
                        }
                } else {
                    Log.w(TAG, "Device not found, using default")
                    createDefaultAudioRecord()
                }
            } else {
                createDefaultAudioRecord()
            }
            
            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord initialization failed")
                return false
            }
            
            audioRecord?.startRecording()
            isRecording.set(true)
            
            // Iniciar el proceso de grabación en una corrutina
            Log.d(TAG, "About to start coroutine for recording...")
            recordingJob = CoroutineScope(Dispatchers.IO).launch {
                try {
                    Log.d(TAG, "Coroutine started, calling recordAudioData...")
                    recordAudioData()
                    Log.d(TAG, "recordAudioData completed successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "Error in recording coroutine", e)
                }
            }
            
            Log.d(TAG, "Coroutine launched, returning true")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting recording", e)
            return false
        }
    }
    
    private fun createDefaultAudioRecord(): AudioRecord {
        Log.d(TAG, "Creating default AudioRecord with channels 1-2 (stereo) for Zoom AMS-44")
        return AudioRecord(
            MediaRecorder.AudioSource.UNPROCESSED,
            sampleRate,
            AudioFormat.CHANNEL_IN_STEREO, // Para Zoom AMS-44: canales 1 y 2
            audioFormat,
            bufferSize
        )
    }
    
    private suspend fun recordAudioData() {
        val audioData = ByteArray(bufferSize)
        val timestamp = System.currentTimeMillis()
        
        Log.d(TAG, "Creating files with original outputPath: '$outputPath'")
        Log.d(TAG, "Using clean outputPath: '$cleanOutputPath'")
        channel1File = File(cleanOutputPath, "interface_channel1_${timestamp}.wav")
        channel2File = File(cleanOutputPath, "interface_channel2_${timestamp}.wav")
        
        Log.d(TAG, "Created Interface Channel1 File object: ${channel1File!!.absolutePath}")
        Log.d(TAG, "Created Interface Channel2 File object: ${channel2File!!.absolutePath}")
        
        // Crear directorios si no existen
        val parentDir = channel1File!!.parentFile
        Log.d(TAG, "Parent directory: ${parentDir?.absolutePath}")
        Log.d(TAG, "Parent exists before mkdirs: ${parentDir?.exists()}")
        Log.d(TAG, "Parent can write: ${parentDir?.canWrite()}")
        
        val mkdirsResult1 = channel1File!!.parentFile?.mkdirs()
        val mkdirsResult2 = channel2File!!.parentFile?.mkdirs()
        
        Log.d(TAG, "mkdirs results: $mkdirsResult1, $mkdirsResult2")
        Log.d(TAG, "Parent exists after mkdirs: ${parentDir?.exists()}")
        Log.d(TAG, "Parent can write after mkdirs: ${parentDir?.canWrite()}")
        
        var channel1Stream: FileOutputStream? = null
        var channel2Stream: FileOutputStream? = null
        
        try {
            channel1Stream = FileOutputStream(channel1File!!)
            channel2Stream = FileOutputStream(channel2File!!)
            
            // Escribir headers WAV
            writeWavHeader(channel1Stream, sampleRate, 1) // Mono para canal 1
            writeWavHeader(channel2Stream, sampleRate, 1) // Mono para canal 2
            
            Log.d(TAG, "Recording interface channels 1&2 to: ${channel1File!!.absolutePath} and ${channel2File!!.absolutePath}")
            
            while (isRecording.get()) {
                val bytesRead = audioRecord?.read(audioData, 0, audioData.size) ?: 0
                
                if (bytesRead > 0) {
                    // Separar canales estéreo (intercalados L-R-L-R...)
                    separateChannels(audioData, bytesRead, channel1Stream, channel2Stream)
                }
            }
            
            // Actualizar headers con el tamaño final
            updateWavHeaderSize(channel1Stream, channel1File!!)
            updateWavHeaderSize(channel2Stream, channel2File!!)
            
        } catch (e: IOException) {
            Log.e(TAG, "IOException during recording", e)
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException during recording - no permissions?", e)
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error during recording", e)
        } finally {
            channel1Stream?.close()
            channel2Stream?.close()
        }
    }
    
    private fun separateChannels(
        stereoData: ByteArray, 
        bytesRead: Int, 
        channel1Stream: FileOutputStream, 
        channel2Stream: FileOutputStream
    ) {
        // Los datos estéreo vienen intercalados desde canales 1 y 2 de la interfaz: Ch1 Ch2 Ch1 Ch2 Ch1 Ch2...
        // Cada muestra es de 16 bits (2 bytes)
        // IMPORTANTE: AudioFormat.CHANNEL_IN_STEREO garantiza que obtenemos específicamente los canales 1 y 2
        val samples = bytesRead / 4 // 4 bytes por par estéreo (2 bytes por canal)
        
        val channel1Data = ByteArray(samples * 2) // 2 bytes por muestra mono
        val channel2Data = ByteArray(samples * 2)
        
        // Variables para calcular RMS
        var channel1Sum = 0.0
        var channel2Sum = 0.0
        
        // Variables para diagnóstico
        var channel1SampleSum = 0L
        var channel2SampleSum = 0L
        var samplesDiagnosed = 0
        
        for (i in 0 until samples) {
            val stereoIndex = i * 4
            val monoIndex = i * 2
            
            // Canal 1 de la interfaz (primer canal del par estéreo)
            channel1Data[monoIndex] = stereoData[stereoIndex]
            channel1Data[monoIndex + 1] = stereoData[stereoIndex + 1]
            
            // Canal 2 de la interfaz (segundo canal del par estéreo)  
            channel2Data[monoIndex] = stereoData[stereoIndex + 2]
            channel2Data[monoIndex + 1] = stereoData[stereoIndex + 3]
            
            // Calcular niveles RMS para cada canal
            val channel1Sample = (stereoData[stereoIndex].toInt() and 0xFF) or 
                               ((stereoData[stereoIndex + 1].toInt() and 0xFF) shl 8)
            val channel2Sample = (stereoData[stereoIndex + 2].toInt() and 0xFF) or 
                               ((stereoData[stereoIndex + 3].toInt() and 0xFF) shl 8)
            
            // Convertir a signed 16-bit
            val channel1Signed = if (channel1Sample > 32767) channel1Sample - 65536 else channel1Sample
            val channel2Signed = if (channel2Sample > 32767) channel2Sample - 65536 else channel2Sample
            
            // Acumular para RMS
            channel1Sum += (channel1Signed * channel1Signed).toDouble()
            channel2Sum += (channel2Signed * channel2Signed).toDouble()
            
            // Acumular para diagnóstico (solo primeras 100 muestras)
            if (samplesDiagnosed < 100) {
                channel1SampleSum += kotlin.math.abs(channel1Signed.toLong())
                channel2SampleSum += kotlin.math.abs(channel2Signed.toLong())
                samplesDiagnosed++
            }
        }
        
        // Actualizar niveles de audio cada 100ms
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastLevelUpdate >= levelUpdateInterval) {
            if (samples > 0) {
                // Calcular RMS y convertir a porcentaje (0-100)
                val channel1RMS = kotlin.math.sqrt(channel1Sum / samples)
                val channel2RMS = kotlin.math.sqrt(channel2Sum / samples)
                
                // Normalizar a rango 0-100 (32767 es el máximo valor para 16-bit signed)
                var channel1Level = (channel1RMS / 32767.0) * 100.0
                var channel2Level = (channel2RMS / 32767.0) * 100.0
                
                // Aplicar ganancia para mayor sensibilidad
                channel1Level *= audioLevelGain
                channel2Level *= audioLevelGain
                
                // Aplicar compresión logarítmica para mayor sensibilidad en niveles bajos
                if (channel1Level > 0) {
                    channel1Level = kotlin.math.log10(channel1Level + 1) * 50.0 // Escalado logarítmico
                }
                if (channel2Level > 0) {
                    channel2Level = kotlin.math.log10(channel2Level + 1) * 50.0 // Escalado logarítmico
                }
                
                // Aplicar umbral mínimo (reducir ruido de fondo)
                if (channel1Level < audioLevelThreshold) channel1Level = 0.0
                if (channel2Level < audioLevelThreshold) channel2Level = 0.0
                
                // Limitar al rango 0-100
                currentChannel1Level = channel1Level.coerceIn(0.0, 100.0)
                currentChannel2Level = channel2Level.coerceIn(0.0, 100.0)
                
                // Log para debug (solo ocasionalmente) - confirmando que son canales 1 y 2 de la interfaz
                if (currentTime % 1000 < levelUpdateInterval) {
                    Log.d(TAG, "Audio levels from interface channels 1&2 - Ch1: %.1f%%, Ch2: %.1f%% (RMS: %.0f, %.0f)".format(
                        currentChannel1Level, currentChannel2Level, channel1RMS, channel2RMS))
                    
                    // Diagnóstico: verificar si los canales son realmente diferentes
                    if (samplesDiagnosed >= 100) {
                        val channel1Avg = channel1SampleSum / samplesDiagnosed
                        val channel2Avg = channel2SampleSum / samplesDiagnosed
                        val difference = kotlin.math.abs(channel1Avg - channel2Avg)
                        val percentDiff = if (channel1Avg > 0) (difference * 100.0 / channel1Avg) else 0.0
                        
                        Log.d(TAG, "CHANNEL DIAGNOSIS: Ch1_avg=$channel1Avg, Ch2_avg=$channel2Avg, diff=$difference (${percentDiff.toInt()}%)")
                        
                        if (percentDiff < 5.0 && channel1Avg > 100) {
                            Log.w(TAG, "⚠️ WARNING: Channels seem to have very similar content! Hardware may be duplicating signal.")
                        } else if (difference > 100) {
                            Log.d(TAG, "✅ Channels appear to have different content - good!")
                        }
                    }
                }
            }
            lastLevelUpdate = currentTime
        }
        
        channel1Stream.write(channel1Data)
        channel2Stream.write(channel2Data)
    }
    
    private fun writeWavHeader(stream: FileOutputStream, sampleRate: Int, channels: Int) {
        val header = ByteArray(44)
        val byteRate = sampleRate * channels * 2 // 16 bits = 2 bytes
        
        // RIFF header
        "RIFF".toByteArray().copyInto(header, 0)
        // File size (placeholder, will be updated later)
        intToByteArray(36).copyInto(header, 4)
        "WAVE".toByteArray().copyInto(header, 8)
        
        // fmt chunk
        "fmt ".toByteArray().copyInto(header, 12)
        intToByteArray(16).copyInto(header, 16) // fmt chunk size
        shortToByteArray(1).copyInto(header, 20) // PCM format
        shortToByteArray(channels.toShort()).copyInto(header, 22)
        intToByteArray(sampleRate).copyInto(header, 24)
        intToByteArray(byteRate).copyInto(header, 28)
        shortToByteArray((channels * 2).toShort()).copyInto(header, 32) // block align
        shortToByteArray(16).copyInto(header, 34) // bits per sample
        
        // data chunk
        "data".toByteArray().copyInto(header, 36)
        intToByteArray(0).copyInto(header, 40) // data size (placeholder)
        
        stream.write(header)
    }
    
    private fun updateWavHeaderSize(stream: FileOutputStream, file: File) {
        try {
            val fileSize = file.length()
            val dataSize = fileSize - 44
            
            stream.channel.position(4)
            stream.write(intToByteArray((fileSize - 8).toInt()))
            
            stream.channel.position(40)
            stream.write(intToByteArray(dataSize.toInt()))
        } catch (e: Exception) {
            Log.e(TAG, "Error updating WAV header", e)
        }
    }
    
    private fun intToByteArray(value: Int): ByteArray {
        return ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(value).array()
    }
    
    private fun shortToByteArray(value: Short): ByteArray {
        return ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN).putShort(value).array()
    }
    
    fun stopRecording(): Pair<String, String>? {
        return try {
            Log.d(TAG, "Stopping dual channel recording...")
            isRecording.set(false)
            recordingJob?.cancel()
            
            // Detener y liberar AudioRecord de manera segura
            audioRecord?.let { record ->
                if (record.state == AudioRecord.STATE_INITIALIZED) {
                    try {
                        record.stop()
                        Log.d(TAG, "AudioRecord stopped successfully")
                    } catch (e: Exception) {
                        Log.e(TAG, "Error stopping AudioRecord", e)
                    }
                }
                record.release()
                Log.d(TAG, "AudioRecord released")
            }
            audioRecord = null
            
            // Verificar archivos y permisos antes de devolver rutas
            if (channel1File != null && channel2File != null) {
                Log.d(TAG, "Checking files exist...")
                Log.d(TAG, "Channel1 file: ${channel1File!!.absolutePath}")
                Log.d(TAG, "Channel1 exists: ${channel1File!!.exists()}")
                Log.d(TAG, "Channel1 readable: ${channel1File!!.canRead()}")
                Log.d(TAG, "Channel1 size: ${channel1File!!.length()}")
                
                Log.d(TAG, "Channel2 file: ${channel2File!!.absolutePath}")
                Log.d(TAG, "Channel2 exists: ${channel2File!!.exists()}")
                Log.d(TAG, "Channel2 readable: ${channel2File!!.canRead()}")
                Log.d(TAG, "Channel2 size: ${channel2File!!.length()}")
                
                if (channel1File!!.exists() && channel2File!!.exists() && 
                    channel1File!!.length() > 0 && channel2File!!.length() > 0) {
                    
                    val channel1Path = channel1File!!.absolutePath
                    val channel2Path = channel2File!!.absolutePath
                    
                    Log.d(TAG, "Returning verified paths: $channel1Path, $channel2Path")
                    Pair(channel1Path, channel2Path)
                } else {
                    Log.e(TAG, "Files don't exist or are empty")
                    null
                }
            } else {
                Log.e(TAG, "File objects are null")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
            null
        }
    }
    
    fun isRecording(): Boolean {
        return isRecording.get()
    }

    fun getCurrentAudioLevels(): Pair<Double, Double> {
        return Pair(currentChannel1Level, currentChannel2Level)
    }
} 