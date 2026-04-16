import axios from "axios";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";

// 🔥 HKDF WhatsApp
function hkdf(key, length) {
    return crypto.hkdfSync(
        "sha256",
        key,
        Buffer.alloc(32),
        Buffer.from("WhatsApp Audio Keys"),
        length
    );
}

export async function processAudioStream(url, mediaKey) {
    // 🔽 baixa o arquivo criptografado
    const response = await axios.get(url, {
        responseType: "arraybuffer"
    });

    const fileBuffer = Buffer.from(response.data);

    // 🔥 remove os 10 bytes finais (MAC)
    const encrypted = fileBuffer.slice(0, fileBuffer.length - 10);

    // 🔑 prepara chave
    const mediaKeyBuffer = Buffer.from(mediaKey, "base64");
    const expandedKey = hkdf(mediaKeyBuffer, 112);

    const iv = expandedKey.slice(0, 16);
    const cipherKey = expandedKey.slice(16, 48);

    // 🔓 decrypt
    const decipher = crypto.createDecipheriv("aes-256-cbc", cipherKey, iv);
    decipher.setAutoPadding(true);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);

    // 🎧 stream de entrada
    const inputStream = new PassThrough();
    inputStream.end(decrypted);

    // 🎧 stream de saída (mp3)
    const outputStream = new PassThrough();

    ffmpeg(inputStream)
        .inputFormat("ogg") // WhatsApp geralmente usa ogg/opus
        .audioCodec("libmp3lame")
        .format("mp3")
        .on("error", (err) => {
            console.error("FFMPEG ERROR:", err);
            outputStream.destroy(err);
        })
        .pipe(outputStream, { end: true });

    return outputStream;
}