import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontsDir = path.join(__dirname, "../../views/fonts");
const FONT_FILE_REGEX = /\.(ttf|otf|woff|woff2)$/i;

const FALLBACK_FONTS = [
    "Arial",
    "Verdana",
    "Tahoma",
    "Trebuchet MS",
    "Times New Roman",
    "Georgia",
    "Courier New",
    "Inter",
    "Roboto",
    "Poppins",
];

function normalizeFontName(fileName) {
    return fileName
        .replace(FONT_FILE_REGEX, "")
        .replace(/[_-]+/g, " ")
        .trim();
}

export async function listarFontesController(_req, res) {
    try {
        let fontesArquivos = [];

        try {
            const files = await fs.readdir(fontsDir);
            fontesArquivos = files
                .filter((name) => FONT_FILE_REGEX.test(name))
                .map(normalizeFontName)
                .filter(Boolean);
        } catch {
            fontesArquivos = [];
        }

        const fontes = Array.from(new Set([...fontesArquivos, ...FALLBACK_FONTS])).sort((a, b) => a.localeCompare(b));

        return res.json({
            success: true,
            fontes,
        });
    } catch (error) {
        console.error("Erro ao listar fontes:", error);
        return res.status(500).json({ success: false, message: "Erro ao listar fontes" });
    }
}
