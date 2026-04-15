import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

function mapError(error, fallbackMessage) {
    if (error?.code === "P2002") {
        return { success: false, message: "Já existe uma categoria com esse nome" };
    }

    return { success: false, message: fallbackMessage };
}

async function criarCategoriaCustomizacao({ nome }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const categoria = await prisma.$transaction(async (tx) => {
            const categoriaCriada = await tx.categoria_customizacao.create({
                data: { nome },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "categoria_customizacao",
                registroId: categoriaCriada.id,
                operacao: "CREATE",
                dadosDepois: categoriaCriada,
                usuarioResponsavelId: usuarioId,
            });

            return categoriaCriada;
        });

        return { success: true, message: "Categoria de customização criada com sucesso", categoria };
    } catch (error) {
        console.error("Erro ao criar categoria de customização:", error);
        return mapError(error, "Erro ao criar categoria de customização");
    }
}

async function getCategoriaCustomizacaoById(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const categoria = await prisma.$transaction(async (tx) => {
            const categoriaEncontrada = await tx.categoria_customizacao.findFirst({
                where: { id, status: 1 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "categoria_customizacao",
                registroId: id,
                operacao: "READ",
                dadosDepois: categoriaEncontrada,
                usuarioResponsavelId: usuarioId,
            });

            return categoriaEncontrada;
        });

        if (!categoria) {
            return { success: false, message: "Categoria de customização não encontrada" };
        }

        return { success: true, categoria };
    } catch (error) {
        console.error("Erro ao buscar categoria de customização:", error);
        return mapError(error, "Erro ao buscar categoria de customização");
    }
}

async function listarCategoriasCustomizacao(usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const categorias = await prisma.$transaction(async (tx) => {
            const categoriasEncontradas = await tx.categoria_customizacao.findMany({
                where: { status: 1 },
                orderBy: { nome: "asc" },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "categoria_customizacao",
                operacao: "LIST",
                dadosDepois: { total: categoriasEncontradas.length },
                usuarioResponsavelId: usuarioId,
            });

            return categoriasEncontradas;
        });

        return { success: true, categorias };
    } catch (error) {
        console.error("Erro ao listar categorias de customização:", error);
        return mapError(error, "Erro ao listar categorias de customização");
    }
}

async function atualizarCategoriaCustomizacao(id, { nome }, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const categoria = await prisma.$transaction(async (tx) => {
            const categoriaAntes = await tx.categoria_customizacao.findUnique({ where: { id } });
            const categoriaDepois = await tx.categoria_customizacao.update({
                where: { id },
                data: { nome },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "categoria_customizacao",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: categoriaAntes,
                dadosDepois: categoriaDepois,
                usuarioResponsavelId: usuarioId,
            });

            return categoriaDepois;
        });

        return { success: true, message: "Categoria de customização atualizada com sucesso", categoria };
    } catch (error) {
        console.error("Erro ao atualizar categoria de customização:", error);
        return mapError(error, "Erro ao atualizar categoria de customização");
    }
}

async function excluirCategoriaCustomizacao(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        await prisma.$transaction(async (tx) => {
            const categoriaAntes = await tx.categoria_customizacao.findUnique({ where: { id } });
            const categoriaDepois = await tx.categoria_customizacao.update({
                where: { id },
                data: { status: 0 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "categoria_customizacao",
                registroId: id,
                operacao: "DELETE",
                dadosAntes: categoriaAntes,
                dadosDepois: categoriaDepois,
                usuarioResponsavelId: usuarioId,
            });
        });

        return { success: true, message: "Categoria de customização excluída com sucesso" };
    } catch (error) {
        console.error("Erro ao excluir categoria de customização:", error);
        return mapError(error, "Erro ao excluir categoria de customização");
    }
}

export {
    criarCategoriaCustomizacao,
    getCategoriaCustomizacaoById,
    listarCategoriasCustomizacao,
    atualizarCategoriaCustomizacao,
    excluirCategoriaCustomizacao,
};
