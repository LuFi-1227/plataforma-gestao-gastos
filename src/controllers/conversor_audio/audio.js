import { processAudioStream } from "../../services/audio_service.js";
import { exec } from "child_process";
import fs from "fs";

const WHISPER_PATH = process.env.WHISPER_PATH;

const BIN = `${WHISPER_PATH}/build/bin/whisper-cli`;
const MODEL = `${WHISPER_PATH}/models/ggml-base.bin`;

export async function converterAudioController(req, res) {
    try {
        let { url, mediaKey, modo = "texto" } = req.body;

        // 🔥 valida URL
        if (typeof url !== "string") {
            return res.status(400).json({ error: "url inválida" });
        }

        // 🔥 normaliza mediaKey
        if (typeof mediaKey === "object") {
            if (mediaKey.data) {
                mediaKey = Buffer.from(mediaKey.data).toString("base64");
            } else {
                const values = Object.values(mediaKey);
                mediaKey = Buffer.from(values).toString("base64");
            }
        }

        // 🔥 valida base64
        if (typeof mediaKey !== "string" || !/^[A-Za-z0-9+/=]+$/.test(mediaKey)) {
            return res.status(400).json({ error: "mediaKey inválida" });
        }

        // 🔓 pega stream do áudio
        const stream = await processAudioStream(url, mediaKey);

        // 🔥 se quiser só áudio → retorna direto
        if (modo === "audio") {
            res.setHeader("Content-Type", "audio/mpeg");
            res.setHeader("Content-Disposition", "attachment; filename=audio.mp3");

            stream.on("error", (err) => {
                console.error("ERRO STREAM:", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Erro no stream" });
                } else {
                    res.destroy();
                }
            });

            return stream.pipe(res);
        }

        // 🔥 stream → buffer
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);

        // 📁 salva arquivos temporários
        const inputPath = `/tmp/audio_${Date.now()}.mp3`;
        const wavPath = inputPath.replace(".mp3", ".wav");

        fs.writeFileSync(inputPath, buffer);

        // 🔁 converte pra WAV
        await execPromise(`ffmpeg -i ${inputPath} -ar 16000 -ac 1 -c:a pcm_s16le ${wavPath}`);

        // 🧠 whisper
        const output = await execPromise(
            `${BIN} -m ${MODEL} -f ${wavPath} -l pt`
        );

        // 🧹 limpa arquivos
        fs.unlinkSync(inputPath);
        fs.unlinkSync(wavPath);

        // 🔥 limpa texto
        const texto = output
            .split("\n")
            .filter(l => l.includes("]"))
            .map(l => l.split("] ")[1])
            .join(" ")
            .trim();

        return res.json({
            success: true,
            texto
        });

    } catch (err) {
        console.error("ERRO DETALHADO:", err);

        return res.status(500).json({
            success: false,
            message: "Erro ao processar áudio"
        });
    }
}

// helper
function execPromise(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(stderr || err);
            resolve(stdout);
        });
    });
}