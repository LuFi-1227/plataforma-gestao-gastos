import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

/**
 * Middleware que verifica transações recorrentes com proxima_execucao <= hoje
 * para o usuário autenticado e anexa o resultado em req.transacoesRecorrentesVencidas.
 * Não bloqueia a requisição — apenas informa a rota/controller sobre notificações pendentes.
 */
export async function checkTransacoesRecorrentes(req, res, next) {
    if (!req.user?.sub) {
        return next();
    }

    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const vencidas = await prisma.transacoes_recorrentes.findMany({
            where: {
                usuario_id: Number(req.user.sub),
                status: 1,
                proxima_execucao: { lte: hoje },
            },
            select: {
                id: true,
                descricao: true,
                valor: true,
                frequencia: true,
                proxima_execucao: true,
            },
            orderBy: { proxima_execucao: "asc" },
        });

        req.transacoesRecorrentesVencidas = vencidas;
    } catch (error) {
        console.error("Erro ao verificar transações recorrentes:", error);
        req.transacoesRecorrentesVencidas = [];
    }

    next();
}
