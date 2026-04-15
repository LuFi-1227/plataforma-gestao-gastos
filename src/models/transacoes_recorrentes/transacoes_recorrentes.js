import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

function mapError(error, fallbackMessage) {
    return { success: false, message: fallbackMessage };
}

async function criarTransacaoRecorrente(dados, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const transacaoRecorrente = await prisma.$transaction(async (tx) => {
            const transacaoCriada = await tx.transacoes_recorrentes.create({ data: dados });

            await registrarAuditoria(tx, {
                tabelaNome: "transacoes_recorrentes",
                registroId: transacaoCriada.id,
                operacao: "CREATE",
                dadosDepois: transacaoCriada,
                usuarioResponsavelId: usuarioId,
            });

            return transacaoCriada;
        });

        return { success: true, message: "Transação recorrente criada com sucesso", transacaoRecorrente };
    } catch (error) {
        console.error("Erro ao criar transação recorrente:", error);
        return mapError(error, "Erro ao criar transação recorrente");
    }
}

async function getTransacaoRecorrenteById(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const transacaoRecorrente = await prisma.$transaction(async (tx) => {
            const transacaoEncontrada = await tx.transacoes_recorrentes.findFirst({
                where: { id, status: 1 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "transacoes_recorrentes",
                registroId: id,
                operacao: "READ",
                dadosDepois: transacaoEncontrada,
                usuarioResponsavelId: usuarioId,
            });

            return transacaoEncontrada;
        });

        if (!transacaoRecorrente) {
            return { success: false, message: "Transação recorrente não encontrada" };
        }

        return { success: true, transacaoRecorrente };
    } catch (error) {
        console.error("Erro ao buscar transação recorrente:", error);
        return mapError(error, "Erro ao buscar transação recorrente");
    }
}

async function listarTransacoesRecorrentes(usuario_id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const transacoesRecorrentes = await prisma.$transaction(async (tx) => {
            const transacoes = await tx.transacoes_recorrentes.findMany({
                where: { status: 1, ...(usuario_id ? { usuario_id } : {}) },
                orderBy: { proxima_execucao: "asc" },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "transacoes_recorrentes",
                operacao: "LIST",
                dadosDepois: { total: transacoes.length, usuario_id: usuario_id ?? null },
                usuarioResponsavelId: usuarioId,
            });

            return transacoes;
        });

        return { success: true, transacoesRecorrentes };
    } catch (error) {
        console.error("Erro ao listar transações recorrentes:", error);
        return mapError(error, "Erro ao listar transações recorrentes");
    }
}

async function atualizarTransacaoRecorrente(id, dados, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const transacaoRecorrente = await prisma.$transaction(async (tx) => {
            const transacaoAntes = await tx.transacoes_recorrentes.findUnique({ where: { id } });
            const transacaoDepois = await tx.transacoes_recorrentes.update({
                where: { id },
                data: dados,
            });

            await registrarAuditoria(tx, {
                tabelaNome: "transacoes_recorrentes",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: transacaoAntes,
                dadosDepois: transacaoDepois,
                usuarioResponsavelId: usuarioId,
            });

            return transacaoDepois;
        });

        return { success: true, message: "Transação recorrente atualizada com sucesso", transacaoRecorrente };
    } catch (error) {
        console.error("Erro ao atualizar transação recorrente:", error);
        return mapError(error, "Erro ao atualizar transação recorrente");
    }
}

async function excluirTransacaoRecorrente(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        await prisma.$transaction(async (tx) => {
            const transacaoAntes = await tx.transacoes_recorrentes.findUnique({ where: { id } });
            const transacaoDepois = await tx.transacoes_recorrentes.update({
                where: { id },
                data: { status: 0 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "transacoes_recorrentes",
                registroId: id,
                operacao: "DELETE",
                dadosAntes: transacaoAntes,
                dadosDepois: transacaoDepois,
                usuarioResponsavelId: usuarioId,
            });
        });

        return { success: true, message: "Transação recorrente excluída com sucesso" };
    } catch (error) {
        console.error("Erro ao excluir transação recorrente:", error);
        return mapError(error, "Erro ao excluir transação recorrente");
    }
}

export {
    criarTransacaoRecorrente,
    getTransacaoRecorrenteById,
    listarTransacoesRecorrentes,
    atualizarTransacaoRecorrente,
    excluirTransacaoRecorrente,
};
