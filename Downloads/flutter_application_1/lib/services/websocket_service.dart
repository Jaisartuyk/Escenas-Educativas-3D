import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;
import '../config/api_config.dart';

/// Servicio para manejar la conexión WebSocket con el servidor central
/// Incluye auto-reconexión y heartbeat para mantener la conexión en background
class WebSocketService {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _isConnected = false;
  bool _intentionalDisconnect = false; // true = el usuario pidió desconectarse
  String? _driverId;
  String? _token;

  // Auto-reconexión
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 999; // prácticamente infinito
  static const Duration _heartbeatInterval = Duration(seconds: 25);

  // Callbacks
  Function(String)? onAudioReceived;
  Function(Map<String, dynamic>)? onTransmissionStatusChanged;
  Function(bool)? onConnectionStatusChanged;
  Function(String)? onError;

  bool get isConnected => _isConnected;
  String? get driverId => _driverId;

  /// Conectar al servidor WebSocket
  Future<bool> connect(String driverId, {String? token}) async {
    _intentionalDisconnect = false;
    _driverId = driverId;
    _token = token;
    _reconnectAttempts = 0;

    return await _doConnect();
  }

  Future<bool> _doConnect() async {
    if (_isConnected) {
      print('⚠️ Ya existe una conexión activa');
      return true;
    }

    try {
      // Construir URL con token
      String wsUrl = ApiConfig.wsAudioConductores;
      if (_token != null && _token!.isNotEmpty) {
        wsUrl = '$wsUrl?token=$_token';
      }
      final uri = Uri.parse(wsUrl);
      print('📡 Conectando WebSocket (intento ${_reconnectAttempts + 1}): $wsUrl');

      _channel = WebSocketChannel.connect(uri);

      _subscription = _channel!.stream.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDisconnection,
        cancelOnError: false,
      );

      _isConnected = true;
      _reconnectAttempts = 0;
      onConnectionStatusChanged?.call(true);

      // Iniciar heartbeat para mantener la conexión viva
      _startHeartbeat();

      print('✅ Conectado al servidor WebSocket como conductor: $_driverId');
      return true;
    } catch (e) {
      print('❌ Error al conectar WebSocket: $e');
      _isConnected = false;
      onConnectionStatusChanged?.call(false);
      onError?.call('Error al conectar: $e');
      _scheduleReconnect();
      return false;
    }
  }

  /// Heartbeat — envía un ping cada 25s para evitar que el servidor cierre la conexión idle
  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(_heartbeatInterval, (_) {
      if (_isConnected && _channel != null) {
        try {
          _channel!.sink.add(jsonEncode({'type': 'ping'}));
          print('💓 Heartbeat enviado');
        } catch (e) {
          print('❌ Error enviando heartbeat: $e');
        }
      }
    });
  }

  /// Programar reconexión con backoff exponencial (máx 30s)
  void _scheduleReconnect() {
    if (_intentionalDisconnect) {
      print('🔌 Desconexión intencional, no se reconecta');
      return;
    }
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      print('❌ Máximo de intentos de reconexión alcanzado');
      return;
    }

    _reconnectTimer?.cancel();
    final delay = Duration(seconds: _reconnectDelay());
    print('🔄 Reconectando en ${delay.inSeconds}s... (intento ${_reconnectAttempts + 1})');

    _reconnectTimer = Timer(delay, () async {
      _reconnectAttempts++;
      await _doConnect();
    });
  }

  int _reconnectDelay() {
    // Backoff: 3s, 5s, 10s, 15s, 30s, 30s, 30s...
    final delays = [3, 5, 10, 15, 30];
    final idx = _reconnectAttempts.clamp(0, delays.length - 1);
    return delays[idx];
  }

  /// Desconectar intencionalmente (no reconecta)
  Future<void> disconnect() async {
    _intentionalDisconnect = true;
    _reconnectTimer?.cancel();
    _heartbeatTimer?.cancel();

    try {
      await _subscription?.cancel();
      await _channel?.sink.close(status.goingAway);

      _channel = null;
      _subscription = null;
      _isConnected = false;
      _driverId = null;
      _token = null;

      onConnectionStatusChanged?.call(false);
      print('🔌 Desconectado del servidor WebSocket');
    } catch (e) {
      print('❌ Error al desconectar: $e');
    }
  }

  /// Notificar que se inicia transmisión
  Future<void> startTransmission() async {
    if (!_isConnected || _channel == null) {
      return;
    }

    try {
      final message = jsonEncode({
        'type': 'transmission_start',
        'driver_id': _driverId,
        'driver_name': _driverId, // Usar el mismo ID como nombre por ahora
        'timestamp': DateTime.now().toIso8601String(),
      });

      _channel!.sink.add(message);
      print('📡 Notificación: Transmisión iniciada');
    } catch (e) {
      print('❌ Error notificando inicio de transmisión: $e');
    }
  }

  /// Notificar que termina transmisión
  Future<void> stopTransmission() async {
    if (!_isConnected || _channel == null) {
      return;
    }

    try {
      final message = jsonEncode({
        'type': 'transmission_stop',
        'driver_id': _driverId,
        'driver_name': _driverId, // Usar el mismo ID como nombre por ahora
        'timestamp': DateTime.now().toIso8601String(),
      });

      _channel!.sink.add(message);
      print('📡 Notificación: Transmisión terminada');
    } catch (e) {
      print('❌ Error notificando fin de transmisión: $e');
    }
  }

  /// Enviar audio en base64
  Future<void> sendAudio(String base64Audio) async {
    if (!_isConnected || _channel == null) {
      print('⚠️ No hay conexión activa para enviar audio');
      return;
    }

    try {
      final message = jsonEncode({
        'type': 'audio',
        'driver_id': _driverId,
        'audio': base64Audio,
        'mimeType': 'audio/aac', // Indicar al servidor el formato
        'timestamp': DateTime.now().toIso8601String(),
      });

      _channel!.sink.add(message);
      print('📤 Audio enviado');
    } catch (e) {
      print('❌ Error al enviar audio: $e');
      onError?.call('Error al enviar audio: $e');
    }
  }

  /// Enviar ubicación
  Future<void> sendLocation(double latitude, double longitude) async {
    if (!_isConnected || _channel == null) {
      return;
    }

    try {
      final message = jsonEncode({
        'type': 'location',
        'driver_id': _driverId,
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': DateTime.now().toIso8601String(),
      });

      _channel!.sink.add(message);
    } catch (e) {
      print('❌ Error al enviar ubicación: $e');
    }
  }

  /// Manejar mensajes recibidos
  void _handleMessage(dynamic message) {
    try {
      print('📩 Mensaje raw recibido: ${message.toString().substring(0, message.toString().length > 200 ? 200 : message.toString().length)}...');
      
      final data = jsonDecode(message as String);
      final type = data['type'] as String?;
      
      print('📨 Tipo de mensaje: $type');

      switch (type) {
        case 'audio':
        case 'audio_broadcast':
        case 'audio_message':
          final audio = data['audio'] as String? ?? data['audioData'] as String? ?? data['data'] as String?;
          final senderId = data['driver_id']?.toString() ?? data['speakerId']?.toString() ?? data['from']?.toString();
          
          // No reproducir el propio audio (anti-eco)
          if (audio != null && senderId != _driverId) {
            print('🔊 Audio recibido de conductor: $senderId (${audio.length} caracteres)');
            onAudioReceived?.call(audio);
          } else if (senderId == _driverId) {
            print('🔇 Audio propio ignorado (anti-eco)');
          } else {
            print('⚠️ Mensaje de audio sin datos de audio o sin senderId válido');
          }
          break;

        case 'transmission_status':
        case 'audio_transmission_status':
          print('📡 Estado de transmisión recibido');
          onTransmissionStatusChanged?.call(Map<String, dynamic>.from(data));
          break;

        case 'ping':
          _channel?.sink.add(jsonEncode({'type': 'pong'}));
          print('🏓 Ping recibido, pong enviado');
          break;

        case 'pong':
          print('🏓 Pong recibido');
          break;
          
        case 'driver_location_update':
          // Ignorar actualizaciones de ubicación de otros conductores
          break;

        default:
          print('📨 Mensaje no manejado - tipo: $type, data: $data');
      }
    } catch (e) {
      print('❌ Error procesando mensaje: $e');
      print('❌ Mensaje problemático: $message');
    }
  }

  /// Manejar errores
  void _handleError(dynamic error) {
    print('❌ Error en WebSocket: $error');
    _isConnected = false;
    _heartbeatTimer?.cancel();
    onConnectionStatusChanged?.call(false);
    onError?.call('Reconectando...');
    _scheduleReconnect();
  }

  /// Manejar desconexión inesperada
  void _handleDisconnection() {
    print('🔌 Conexión WebSocket cerrada');
    _isConnected = false;
    _heartbeatTimer?.cancel();
    onConnectionStatusChanged?.call(false);

    // Solo reconectar si NO fue intencional
    if (!_intentionalDisconnect) {
      print('🔄 Desconexión inesperada, iniciando reconexión automática...');
      _scheduleReconnect();
    }
  }

  /// Limpiar recursos
  void dispose() {
    _intentionalDisconnect = true;
    _reconnectTimer?.cancel();
    _heartbeatTimer?.cancel();
    disconnect();
  }
}
