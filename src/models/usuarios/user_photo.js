import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewsRoot = path.resolve(__dirname, "../../views");

function normalizePhoto(photo) {
    if (!photo) return null;
    return {
        id: photo.id,
        caminho: photo.caminho,
        status: photo.status,
        created_at: photo.created_at,
        updated_at: photo.updated_at,
        foto_url: photo.caminho,
    };
}

function removeStoredFile(relativePath) {
    if (!relativePath) return;
    const normalized = String(relativePath).replace(/^\/+/, "");
    const absolutePath = path.join(viewsRoot, normalized);
    if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
    }
}

export async function saveUserPhoto(usuarioId, file, usuarioResponsavelId) {
    try {
        const responsavelId = validarUsuarioResponsavelId(usuarioResponsavelId);

        if (!file) {
            return { success: false, message: "Foto não enviada" };
        }

        const caminho = `/uploads/usuarios/${file.filename}`;

        const result = await prisma.$transaction(async (tx) => {
            const usuario = await tx.usuarios.findUnique({
                where: { id: usuarioId },
                include: { user_photo: true },
            });

            if (!usuario || Number(usuario.status ?? 1) !== 1) {
                throw new Error("Usuário não encontrado");
            }

            const fotoAnterior = usuario.user_photo;
            const photo = fotoAnterior
                ? await tx.user_photo.update({
                    where: { usuario_id: usuarioId },
                    data: {
                        caminho,
                        status: 1,
                        updated_at: new Date(),
                    },
                })
                : await tx.user_photo.create({
                    data: {
                        usuario_id: usuarioId,
                        caminho,
                        status: 1,
                    },
                });

            await registrarAuditoria(tx, {
                tabelaNome: "user_photo",
                registroId: photo.id,
                operacao: fotoAnterior ? "UPDATE" : "CREATE",
                dadosAntes: normalizePhoto(fotoAnterior),
                dadosDepois: normalizePhoto(photo),
                usuarioResponsavelId: responsavelId,
            });

            return { photo, fotoAnterior };
        });

        if (result.fotoAnterior?.caminho && result.fotoAnterior.caminho !== result.photo.caminho) {
            removeStoredFile(result.fotoAnterior.caminho);
        }

        return {
            success: true,
            message: "Foto salva com sucesso",
            foto: normalizePhoto(result.photo),
        };
    } catch (error) {
        console.error("Erro ao salvar foto do usuário:", error);
        return { success: false, message: error?.message || "Erro ao salvar foto do usuário" };
    }
}
