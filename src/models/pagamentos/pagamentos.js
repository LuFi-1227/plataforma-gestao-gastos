import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

function mapError(error, fallbackMessage) {
    return { success: false, message: fallbackMessage };
}

async function criarPagamento({ descricao, valor, data_pagamento, data_vencimento, usuario_id }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const pagamento = await prisma.$transaction(async (tx) => {
            const pagamentoCriado = await tx.pagamentos.create({
                data: { descricao, valor, data_pagamento, data_vencimento, usuario_id },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "pagamentos",
                registroId: pagamentoCriado.id,
                operacao: "CREATE",
                dadosDepois: pagamentoCriado,
                usuarioResponsavelId: usuarioId,
            });

            return pagamentoCriado;
        });

        return { success: true, message: "Pagamento criado com sucesso", pagamento };
    } catch (error) {
        console.error("Erro ao criar pagamento:", error);
        return mapError(error, "Erro ao criar pagamento");
    }
}

async function getPagamentoById(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const pagamento = await prisma.$transaction(async (tx) => {
            const pagamentoEncontrado = await tx.pagamentos.findFirst({
                where: { id, status: 1 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "pagamentos",
                registroId: id,
                operacao: "READ",
                dadosDepois: pagamentoEncontrado,
                usuarioResponsavelId: usuarioId,
            });

            return pagamentoEncontrado;
        });

        if (!pagamento) {
            return { success: false, message: "Pagamento não encontrado" };
        }

        return { success: true, pagamento };
    } catch (error) {
        console.error("Erro ao buscar pagamento:", error);
        return mapError(error, "Erro ao buscar pagamento");
    }
}

async function listarPagamentos(usuario_id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const pagamentos = await prisma.$transaction(async (tx) => {
            const pagamentosEncontrados = await tx.pagamentos.findMany({
                where: { status: 1, ...(usuario_id ? { usuario_id } : {}) },
                orderBy: { data_vencimento: "asc" },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "pagamentos",
                operacao: "LIST",
                dadosDepois: { total: pagamentosEncontrados.length, usuario_id: usuario_id ?? null },
                usuarioResponsavelId: usuarioId,
            });

            return pagamentosEncontrados;
        });

        return { success: true, pagamentos };
    } catch (error) {
        console.error("Erro ao listar pagamentos:", error);
        return mapError(error, "Erro ao listar pagamentos");
    }
}

async function atualizarPagamento(id, { descricao, valor, data_pagamento, data_vencimento }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const pagamento = await prisma.$transaction(async (tx) => {
            const pagamentoAntes = await tx.pagamentos.findUnique({ where: { id } });
            const pagamentoDepois = await tx.pagamentos.update({
                where: { id },
                data: { descricao, valor, data_pagamento, data_vencimento },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "pagamentos",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: pagamentoAntes,
                dadosDepois: pagamentoDepois,
                usuarioResponsavelId: usuarioId,
            });

            return pagamentoDepois;
        });

        return { success: true, message: "Pagamento atualizado com sucesso", pagamento };
    } catch (error) {
        console.error("Erro ao atualizar pagamento:", error);
        return mapError(error, "Erro ao atualizar pagamento");
    }
}

async function excluirPagamento(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        await prisma.$transaction(async (tx) => {
            const pagamentoAntes = await tx.pagamentos.findUnique({ where: { id } });
            const pagamentoDepois = await tx.pagamentos.update({
                where: { id },
                data: { status: 0 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "pagamentos",
                registroId: id,
                operacao: "DELETE",
                dadosAntes: pagamentoAntes,
                dadosDepois: pagamentoDepois,
                usuarioResponsavelId: usuarioId,
            });
        });

        return { success: true, message: "Pagamento excluído com sucesso" };
    } catch (error) {
        console.error("Erro ao excluir pagamento:", error);
        return mapError(error, "Erro ao excluir pagamento");
    }
}

export {
    criarPagamento,
    getPagamentoById,
    listarPagamentos,
    atualizarPagamento,
    excluirPagamento,
};
