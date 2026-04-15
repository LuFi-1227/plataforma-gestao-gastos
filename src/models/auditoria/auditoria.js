import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

function validarUsuarioResponsavelId(usuarioResponsavelId) {
    const usuarioId = Number(usuarioResponsavelId);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        throw new Error("usuarioResponsavelId é obrigatório e deve ser um inteiro positivo");
    }

    return usuarioId;
}

async function registrarAuditoria(tx, {
    tabelaNome,
    registroId = null,
    operacao,
    dadosAntes = null,
    dadosDepois = null,
    usuarioResponsavelId,
}) {
    const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);

    await tx.auditoria.create({
        data: {
            tabela_nome: tabelaNome,
            registro_id: registroId,
            operacao,
            dados_antes: dadosAntes,
            dados_depois: dadosDepois,
            usuario_responsavel_id: usuarioId,
        },
    });
}

async function criarAuditoria(dados) {
    try {
        const auditoria = await prisma.auditoria.create({ data: dados });
        return { success: true, message: "Auditoria criada com sucesso", auditoria };
    } catch (error) {
        console.error("Erro ao criar auditoria:", error);
        return { success: false, message: "Erro ao criar auditoria" };
    }
}

async function getAuditoriaById(id) {
    try {
        const auditoria = await prisma.auditoria.findUnique({ where: { id } });
        if (!auditoria) {
            return { success: false, message: "Registro de auditoria não encontrado" };
        }

        return { success: true, auditoria };
    } catch (error) {
        console.error("Erro ao buscar auditoria:", error);
        return { success: false, message: "Erro ao buscar auditoria" };
    }
}

async function listarAuditorias(filtros = {}) {
    try {
        const auditorias = await prisma.auditoria.findMany({
            where: filtros,
            orderBy: { created_at: "desc" },
        });

        return { success: true, auditorias };
    } catch (error) {
        console.error("Erro ao listar auditorias:", error);
        return { success: false, message: "Erro ao listar auditorias" };
    }
}

async function atualizarAuditoria(id, dados) {
    try {
        const auditoria = await prisma.auditoria.update({
            where: { id },
            data: dados,
        });

        return { success: true, message: "Auditoria atualizada com sucesso", auditoria };
    } catch (error) {
        console.error("Erro ao atualizar auditoria:", error);
        return { success: false, message: "Erro ao atualizar auditoria" };
    }
}

async function excluirAuditoria(id) {
    try {
        await prisma.auditoria.delete({ where: { id } });
        return { success: true, message: "Auditoria excluída com sucesso" };
    } catch (error) {
        console.error("Erro ao excluir auditoria:", error);
        return { success: false, message: "Erro ao excluir auditoria" };
    }
}

export {
    validarUsuarioResponsavelId,
    registrarAuditoria,
    criarAuditoria,
    getAuditoriaById,
    listarAuditorias,
    atualizarAuditoria,
    excluirAuditoria,
};
