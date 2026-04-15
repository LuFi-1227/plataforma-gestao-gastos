import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

export async function listarCategoriasMovimentacaoController(req, res) {
    try {
        const categorias = await prisma.categoria_movimentacao.findMany();
        res.json({ success: true, categorias });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function getCategoriaMovimentacaoController(req, res) {
    try {
        const { id } = req.params;
        const categoria = await prisma.categoria_movimentacao.findUnique({
            where: { id: parseInt(id) },
        });
        if (!categoria) {
            return res.status(404).json({ success: false, message: "Categoria não encontrada" });
        }
        res.json({ success: true, categoria });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function criarCategoriaMovimentacaoController(req, res) {
    try {
        const { nome } = req.body;
        const categoria = await prisma.categoria_movimentacao.create({
            data: { nome },
        });
        res.status(201).json({ success: true, message: "Categoria criada com sucesso", categoria });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function atualizarCategoriaMovimentacaoController(req, res) {
    try {
        const { id } = req.params;
        const { nome } = req.body;
        const categoria = await prisma.categoria_movimentacao.update({
            where: { id: parseInt(id) },
            data: { nome },
        });
        res.json({ success: true, message: "Categoria atualizada com sucesso", categoria });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function excluirCategoriaMovimentacaoController(req, res) {
    try {
        const { id } = req.params;
        await prisma.categoria_movimentacao.delete({
            where: { id: parseInt(id) },
        });
        res.json({ success: true, message: "Categoria excluída com sucesso" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
