import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);

const prisma = new PrismaClient({adapter});

async function criarPermissao({ nome }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const novaPermissao = await prisma.$transaction(async (tx) => {
            const permissaoCriada = await tx.permissoes.create({
                data: { nome },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "permissoes",
                registroId: permissaoCriada.id,
                operacao: "CREATE",
                dadosDepois: permissaoCriada,
                usuarioResponsavelId: usuarioId,
            });

            return permissaoCriada;
        });

        return { success: true, message: "Permissão criada com sucesso", permissao: novaPermissao };
    } catch (error) {
        console.error("Erro ao criar permissão:", error);
        return { success: false, message: "Erro ao criar permissão" };
    }
}

async function permissaoByName(name, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const permissao = await prisma.$transaction(async (tx) => {
            const permissaoEncontrada = await tx.permissoes.findFirst({
                where: { nome: name, status: 1 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "permissoes",
                registroId: permissaoEncontrada?.id ?? null,
                operacao: "READ",
                dadosDepois: permissaoEncontrada ?? { nome: name },
                usuarioResponsavelId: usuarioId,
            });

            return permissaoEncontrada;
        });

        if (!permissao) {
            return { success: false, message: "Permissão não encontrada" };
        }
        return { success: true, permissao };
    } catch (error) {
        console.error("Erro ao buscar permissão:", error);
        return { success: false, message: "Erro ao buscar permissão" };
    }
}

async function getPermissaoById(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const permissao = await prisma.$transaction(async (tx) => {
            const permissaoEncontrada = await tx.permissoes.findFirst({
                where: { id, status: 1 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "permissoes",
                registroId: id,
                operacao: "READ",
                dadosDepois: permissaoEncontrada,
                usuarioResponsavelId: usuarioId,
            });

            return permissaoEncontrada;
        });

        if (!permissao) {
            return { success: false, message: "Permissão não encontrada" };
        }

        return { success: true, permissao };
    } catch (error) {
        console.error("Erro ao buscar permissão:", error);
        return { success: false, message: "Erro ao buscar permissão" };
    }
}

async function listarPermissoes(usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const permissoes = await prisma.$transaction(async (tx) => {
            const permissoesAtivas = await tx.permissoes.findMany({
                where: { status: 1 },
                orderBy: { nome: "asc" },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "permissoes",
                operacao: "LIST",
                dadosDepois: { total: permissoesAtivas.length },
                usuarioResponsavelId: usuarioId,
            });

            return permissoesAtivas;
        });

        return { success: true, permissoes };
    } catch (error) {
        console.error("Erro ao listar permissões:", error);
        return { success: false, message: "Erro ao listar permissões" };
    }
}

async function atualizarPermissao(id, { nome }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const permissaoAtualizada = await prisma.$transaction(async (tx) => {
            const permissaoAntes = await tx.permissoes.findUnique({
                where: { id },
            });

            const permissaoDepois = await tx.permissoes.update({
                where: { id },
                data: { nome },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "permissoes",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: permissaoAntes,
                dadosDepois: permissaoDepois,
                usuarioResponsavelId: usuarioId,
            });

            return permissaoDepois;
        });

        return { success: true, message: "Permissão atualizada com sucesso", permissao: permissaoAtualizada };
    } catch (error) {
        console.error("Erro ao atualizar permissão:", error);
        return { success: false, message: "Erro ao atualizar permissão" };
    }
}

async function excluirPermissao(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        await prisma.$transaction(async (tx) => {
            const permissaoAntes = await tx.permissoes.findUnique({
                where: { id },
            });

            const permissaoDepois = await tx.permissoes.update({
                where: { id },
                data: { status: 0 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "permissoes",
                registroId: id,
                operacao: "DELETE",
                dadosAntes: permissaoAntes,
                dadosDepois: permissaoDepois,
                usuarioResponsavelId: usuarioId,
            });
        });

        return { success: true, message: "Permissão excluída com sucesso" };
    } catch (error) {
        console.error("Erro ao excluir permissão:", error);
        return { success: false, message: "Erro ao excluir permissão" };
    }
}

export { criarPermissao, permissaoByName, getPermissaoById, listarPermissoes, atualizarPermissao, excluirPermissao };