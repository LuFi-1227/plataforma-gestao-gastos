import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME = /^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/;
const ALLOWED_EXT = /\.(jpeg|jpg|png|gif|webp|svg)$/i;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function createImageUpload(relativeDir, fieldName = "foto") {
    const absoluteDir = path.join(__dirname, `../views/${relativeDir}`);
    ensureDir(absoluteDir);

    const storage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, absoluteDir),
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
            cb(null, name);
        },
    });

    const upload = multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter,
    });

    return function imageUploadMiddleware(req, res, next) {
        upload.single(fieldName)(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ success: false, message: `Upload: ${err.message}` });
            }
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            next();
        });
    };
}

const fileFilter = (_req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype) && ALLOWED_EXT.test(file.originalname)) {
        cb(null, true);
    } else {
        cb(new Error("Apenas imagens (JPEG, PNG, GIF, WEBP, SVG) são permitidas"), false);
    }
};

/**
 * Middleware para upload de uma foto (campo "foto").
 * Funciona paralelamente ao express.json(); quando o body é multipart,
 * req.body é populado com os campos de texto e req.file com o arquivo.
 * Quando não há arquivo, apenas parseia os campos de texto.
 */
export const uploadFotoMiddleware = createImageUpload("uploads/customizacao", "foto");
export const uploadUserPhotoMiddleware = createImageUpload("uploads/usuarios", "foto");
