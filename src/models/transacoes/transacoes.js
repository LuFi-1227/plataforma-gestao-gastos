import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);

const prisma = new PrismaClient({adapter});

async function criarTransacao({ descricao, valor, data, categoria_id, usuario_id }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const novaTransacao = await prisma.$transaction(async (tx) => {
            const transacaoCriada = await tx.movimentacao_financeira.create({
                data: {
                    descricao,
                    valor,
                    data_movimentacao: data,
                    categoria_id,
                    usuario_id,
                },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "movimentacao_financeira",
                registroId: transacaoCriada.id,
                operacao: "CREATE",
                dadosDepois: transacaoCriada,
                usuarioResponsavelId: usuarioId,
            });

            return transacaoCriada;
        });

        return { success: true, message: "Transação criada com sucesso", transacao: novaTransacao };
    } catch (error) {
        console.error("Erro ao criar transação:", error);
        return { success: false, message: "Erro ao criar transação" };
    }
}

async function getTransacaoById(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const transacao = await prisma.$transaction(async (tx) => {
            const transacaoEncontrada = await tx.movimentacao_financeira.findFirst({
                where: { id, status: 1 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "movimentacao_financeira",
                registroId: id,
                operacao: "READ",
                dadosDepois: transacaoEncontrada,
                usuarioResponsavelId: usuarioId,
            });

            return transacaoEncontrada;
        });

        if (!transacao) {
            return { success: false, message: "Transação não encontrada" };
        }

        return { success: true, transacao };
    } catch (error) {
        console.error("Erro ao buscar transação:", error);
        return { success: false, message: "Erro ao buscar transação" };
    }
}

async function listarTransacoes(usuario_id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const transacoes = await prisma.$transaction(async (tx) => {
            const transacoesEncontradas = await tx.movimentacao_financeira.findMany({
                where: { usuario_id, status: 1 },
                orderBy: { data_movimentacao: "desc" },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "movimentacao_financeira",
                operacao: "LIST",
                dadosDepois: { usuario_id, total: transacoesEncontradas.length },
                usuarioResponsavelId: usuarioId,
            });

            return transacoesEncontradas;
        });

        return { success: true, transacoes };
    } catch (error) {
        console.error("Erro ao listar transações:", error);
        return { success: false, message: "Erro ao listar transações" };
    }
}

async function atualizarTransacao(id, { descricao, valor, data, categoria_id }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const transacaoAtualizada = await prisma.$transaction(async (tx) => {
            const transacaoAntes = await tx.movimentacao_financeira.findUnique({
                where: { id },
            });

            const transacaoDepois = await tx.movimentacao_financeira.update({
                where: { id },
                data: {
                    descricao,
                    valor,
                    data_movimentacao: data,
                    categoria_id,
                },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "movimentacao_financeira",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: transacaoAntes,
                dadosDepois: transacaoDepois,
                usuarioResponsavelId: usuarioId,
            });

            return transacaoDepois;
        });

        return { success: true, message: "Transação atualizada com sucesso", transacao: transacaoAtualizada };
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        return { success: false, message: "Erro ao atualizar transação" };
    }
}

async function excluirTransacao(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        await prisma.$transaction(async (tx) => {
            const transacaoAntes = await tx.movimentacao_financeira.findUnique({
                where: { id },
            });

            const transacaoDepois = await tx.movimentacao_financeira.update({
                where: { id },
                data: { status: 0 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "movimentacao_financeira",
                registroId: id,
                operacao: "DELETE",
                dadosAntes: transacaoAntes,
                dadosDepois: transacaoDepois,
                usuarioResponsavelId: usuarioId,
            });
        });

        return { success: true, message: "Transação excluída com sucesso" };
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        return { success: false, message: "Erro ao excluir transação" };
    }
}

export { criarTransacao, getTransacaoById, listarTransacoes, atualizarTransacao, excluirTransacao };