import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

function mapError(error, fallbackMessage) {
    return { success: false, message: fallbackMessage };
}

async function criarMeta({ descricao, valor, data_meta, usuario_id, categoria_movimentacao_id }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const meta = await prisma.$transaction(async (tx) => {
            const metaCriada = await tx.metas.create({
                data: { descricao, valor, data_meta, usuario_id, categoria_movimentacao_id },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "metas",
                registroId: metaCriada.id,
                operacao: "CREATE",
                dadosDepois: metaCriada,
                usuarioResponsavelId: usuarioId,
            });

            return metaCriada;
        });

        return { success: true, message: "Meta criada com sucesso", meta };
    } catch (error) {
        console.error("Erro ao criar meta:", error);
        return mapError(error, "Erro ao criar meta");
    }
}

async function getMetaById(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const meta = await prisma.$transaction(async (tx) => {
            const metaEncontrada = await tx.metas.findFirst({
                where: { id, status: 1 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "metas",
                registroId: id,
                operacao: "READ",
                dadosDepois: metaEncontrada,
                usuarioResponsavelId: usuarioId,
            });

            return metaEncontrada;
        });

        if (!meta) {
            return { success: false, message: "Meta não encontrada" };
        }

        return { success: true, meta };
    } catch (error) {
        console.error("Erro ao buscar meta:", error);
        return mapError(error, "Erro ao buscar meta");
    }
}

async function listarMetas(usuario_id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const metas = await prisma.$transaction(async (tx) => {
            const metasEncontradas = await tx.metas.findMany({
                where: { status: 1, ...(usuario_id ? { usuario_id } : {}) },
                orderBy: { data_meta: "asc" },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "metas",
                operacao: "LIST",
                dadosDepois: { total: metasEncontradas.length, usuario_id: usuario_id ?? null },
                usuarioResponsavelId: usuarioId,
            });

            return metasEncontradas;
        });

        return { success: true, metas };
    } catch (error) {
        console.error("Erro ao listar metas:", error);
        return mapError(error, "Erro ao listar metas");
    }
}

async function atualizarMeta(id, { descricao, valor, data_meta, categoria_movimentacao_id }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const meta = await prisma.$transaction(async (tx) => {
            const metaAntes = await tx.metas.findUnique({ where: { id } });
            const metaDepois = await tx.metas.update({
                where: { id },
                data: { descricao, valor, data_meta, categoria_movimentacao_id },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "metas",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: metaAntes,
                dadosDepois: metaDepois,
                usuarioResponsavelId: usuarioId,
            });

            return metaDepois;
        });

        return { success: true, message: "Meta atualizada com sucesso", meta };
    } catch (error) {
        console.error("Erro ao atualizar meta:", error);
        return mapError(error, "Erro ao atualizar meta");
    }
}

async function excluirMeta(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        await prisma.$transaction(async (tx) => {
            const metaAntes = await tx.metas.findUnique({ where: { id } });
            const metaDepois = await tx.metas.update({
                where: { id },
                data: { status: 0 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "metas",
                registroId: id,
                operacao: "DELETE",
                dadosAntes: metaAntes,
                dadosDepois: metaDepois,
                usuarioResponsavelId: usuarioId,
            });
        });

        return { success: true, message: "Meta excluída com sucesso" };
    } catch (error) {
        console.error("Erro ao excluir meta:", error);
        return mapError(error, "Erro ao excluir meta");
    }
}

export {
    criarMeta,
    getMetaById,
    listarMetas,
    atualizarMeta,
    excluirMeta,
};
