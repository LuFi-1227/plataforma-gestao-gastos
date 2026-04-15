import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

export async function listarTransacoesRecorrentesController(req, res) {
    try {
        const transacoes = await prisma.transacoes_recorrentes.findMany({
            where: { usuario_id: Number(req.user.sub) },
        });
        res.json({ success: true, transacoes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function getTransacaoRecorrenteController(req, res) {
    try {
        const { id } = req.params;
        const transacao = await prisma.transacoes_recorrentes.findUnique({
            where: { id: parseInt(id) },
        });
        if (!transacao || transacao.usuario_id !== Number(req.user.sub)) {
            return res.status(404).json({ success: false, message: "Transação recorrente não encontrada" });
        }
        res.json({ success: true, transacao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function criarTransacaoRecorrenteController(req, res) {
    try {
        const { descricao, valor, categoria_movimentacao_id, frequencia, data_inicio, data_fim, tipo } = req.body;
        const transacao = await prisma.transacoes_recorrentes.create({
            data: {
                descricao,
                valor: parseFloat(valor),
                categoria_id: parseInt(categoria_movimentacao_id),
                usuario_id: Number(req.user.sub),
                tipo,
                frequencia,
                data_inicio: data_inicio ? new Date(data_inicio) : new Date(),
                data_fim: data_fim ? new Date(data_fim) : null,
                proxima_execucao: data_inicio ? new Date(data_inicio) : new Date(),
            },
        });
        res.status(201).json({ success: true, message: "Transação recorrente criada com sucesso", transacao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function atualizarTransacaoRecorrenteController(req, res) {
    try {
        const { id } = req.params;
        const { descricao, valor, categoria_movimentacao_id, frequencia, data_inicio, data_fim, tipo } = req.body;
        const transacao = await prisma.transacoes_recorrentes.update({
            where: { id: parseInt(id) },
            data: {
                descricao,
                valor: parseFloat(valor),
                categoria_id: parseInt(categoria_movimentacao_id),
                tipo,
                frequencia,
                data_inicio: data_inicio ? new Date(data_inicio) : undefined,
                data_fim: data_fim ? new Date(data_fim) : undefined,
            },
        });
        res.json({ success: true, message: "Transação recorrente atualizada com sucesso", transacao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function excluirTransacaoRecorrenteController(req, res) {
    try {
        const { id } = req.params;
        await prisma.transacoes_recorrentes.delete({
            where: { id: parseInt(id) },
        });
        res.json({ success: true, message: "Transação recorrente excluída com sucesso" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
