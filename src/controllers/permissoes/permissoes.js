import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

export async function listarPermissoesController(req, res) {
    try {
        const permissoes = await prisma.permissoes.findMany();
        res.json({ success: true, permissoes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function getPermissaoController(req, res) {
    try {
        const { id } = req.params;
        const permissao = await prisma.permissoes.findUnique({
            where: { id: parseInt(id) },
        });
        if (!permissao) {
            return res.status(404).json({ success: false, message: "Permissão não encontrada" });
        }
        res.json({ success: true, permissao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function criarPermissaoController(req, res) {
    try {
        const { nome } = req.body;
        const permissao = await prisma.permissoes.create({
            data: { nome },
        });
        res.status(201).json({ success: true, message: "Permissão criada com sucesso", permissao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function atualizarPermissaoController(req, res) {
    try {
        const { id } = req.params;
        const { nome } = req.body;
        const permissao = await prisma.permissoes.update({
            where: { id: parseInt(id) },
            data: { nome },
        });
        res.json({ success: true, message: "Permissão atualizada com sucesso", permissao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function excluirPermissaoController(req, res) {
    try {
        const { id } = req.params;
        await prisma.permissoes.delete({
            where: { id: parseInt(id) },
        });
        res.json({ success: true, message: "Permissão excluída com sucesso" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
