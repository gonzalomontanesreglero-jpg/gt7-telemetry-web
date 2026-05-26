const dgram = require('dgram');
const WebSocket = require('ws');
const crypto = require('crypto');

const client = dgram.createSocket('udp4');
const wss = new WebSocket.Server({ port: 8080 });

const GT7_PORT = 33739;
const PS5_IP = '192.168.1.50'; // ⚠️ REEMPLAZA ESTO CON LA IP DE TU PS5 MAS ADELANTE

// Clave de encriptación Salsa20 descubierta por la comunidad de GT7
const GT7_KEY = Buffer.from('64426251414d426d4c4d534d4b414d44', 'hex');

function decrypt(data) {
    const nonce = data.slice(64, 72);
    const cipher = crypto.createDecipheriv('chacha20', GT7_KEY, Buffer.concat([nonce, Buffer.alloc(4)]));
    return Buffer.concat([cipher.update(data.slice(0, 64)), cipher.final()]);
}

// Enviar un paquete "Heartbeat" para que la PS5 empiece a mandar datos
setInterval(() => {
    const buffer = Buffer.alloc(8);
    buffer.write('A'); 
    client.send(buffer, 0, buffer.length, GT7_PORT, PS5_IP);
}, 1000);

client.on('message', (msg) => {
    try {
        const decrypted = decrypt(msg);
        
        // Estructura básica de datos del juego
        const telemetry = {
            speed: decrypted.readFloatLE(0x4C) * 3.6, // Velocidad en km/h
            rpm: decrypted.readFloatLE(0x2C),       // RPM del motor
            maxRpm: decrypted.readFloatLE(0x30),    // RPM Máximas
            gear: decrypted.readUInt8(0x90) & 0x0F  // Marcha actual
        };

        // Enviar datos en tiempo real a tu pantalla web
        wss.clients.forEach(c => {
            if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(telemetry));
        });
    } catch (err) {
        console.error("Error procesando datos:", err);
    }
});

client.bind(GT7_PORT);
console.log('Servidor de telemetría GT7 escuchando en puerto 8080...');
