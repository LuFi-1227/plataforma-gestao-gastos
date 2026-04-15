import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

function mapError(error, fallbackMessage) {
    return { success: false, message: fallbackMessage };
}

async function criarCustomizacao({ valor, categoria_id }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const customizacao = await prisma.$transaction(async (tx) => {
            const customizacaoCriada = await tx.customizacao.create({
                data: { valor, categoria_id },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "customizacao",
                registroId: customizacaoCriada.id,
                operacao: "CREATE",
                dadosDepois: customizacaoCriada,
                usuarioResponsavelId: usuarioId,
            });

            return customizacaoCriada;
        });

        return { success: true, message: "Customização criada com sucesso", customizacao };
    } catch (error) {
        console.error("Erro ao criar customização:", error);
        return mapError(error, "Erro ao criar customização");
    }
}

async function getCustomizacaoById(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const customizacao = await prisma.$transaction(async (tx) => {
            const customizacaoEncontrada = await tx.customizacao.findFirst({
                where: { id, status: 1 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "customizacao",
                registroId: id,
                operacao: "READ",
                dadosDepois: customizacaoEncontrada,
                usuarioResponsavelId: usuarioId,
            });

            return customizacaoEncontrada;
        });

        if (!customizacao) {
            return { success: false, message: "Customização não encontrada" };
        }

        return { success: true, customizacao };
    } catch (error) {
        console.error("Erro ao buscar customização:", error);
        return mapError(error, "Erro ao buscar customização");
    }
}

async function listarCustomizacoes(usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const customizacoes = await prisma.$transaction(async (tx) => {
            const customizacoesEncontradas = await tx.customizacao.findMany({
                where: { status: 1 },
                orderBy: { id: "desc" },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "customizacao",
                operacao: "LIST",
                dadosDepois: { total: customizacoesEncontradas.length },
                usuarioResponsavelId: usuarioId,
            });

            return customizacoesEncontradas;
        });

        return { success: true, customizacoes };
    } catch (error) {
        console.error("Erro ao listar customizações:", error);
        return mapError(error, "Erro ao listar customizações");
    }
}

async function atualizarCustomizacao(id, { valor, categoria_id }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const customizacao = await prisma.$transaction(async (tx) => {
            const customizacaoAntes = await tx.customizacao.findUnique({ where: { id } });
            const customizacaoDepois = await tx.customizacao.update({
                where: { id },
                data: { valor, categoria_id },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "customizacao",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: customizacaoAntes,
                dadosDepois: customizacaoDepois,
                usuarioResponsavelId: usuarioId,
            });

            return customizacaoDepois;
        });

        return { success: true, message: "Customização atualizada com sucesso", customizacao };
    } catch (error) {
        console.error("Erro ao atualizar customização:", error);
        return mapError(error, "Erro ao atualizar customização");
    }
}

async function excluirCustomizacao(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        await prisma.$transaction(async (tx) => {
            const customizacaoAntes = await tx.customizacao.findUnique({ where: { id } });
            const customizacaoDepois = await tx.customizacao.update({
                where: { id },
                data: { status: 0 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "customizacao",
                registroId: id,
                operacao: "DELETE",
                dadosAntes: customizacaoAntes,
                dadosDepois: customizacaoDepois,
                usuarioResponsavelId: usuarioId,
            });
        });

        return { success: true, message: "Customização excluída com sucesso" };
    } catch (error) {
        console.error("Erro ao excluir customização:", error);
        return mapError(error, "Erro ao excluir customização");
    }
}

export {
    criarCustomizacao,
    getCustomizacaoById,
    listarCustomizacoes,
    atualizarCustomizacao,
    excluirCustomizacao,
};
