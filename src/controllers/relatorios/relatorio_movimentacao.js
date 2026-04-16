import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function isGastoCategoria(item) {
    const nome = normalizeText(item?.categoria_movimentacao?.nome);
    const categoriaId = Number(item?.categoria_id);
    if (["gasto", "gastos", "despesa", "despesas", "saida", "saidas"].some((keyword) => nome.includes(keyword))) {
        return true;
    }
    if (categoriaId === 3) return true;
    return false;
}

function isGanhoCategoria(item) {
    const nome = normalizeText(item?.categoria_movimentacao?.nome);
    const categoriaId = Number(item?.categoria_id);
    if (["ganho", "ganhos", "receita", "receitas", "entrada", "entradas"].some((keyword) => nome.includes(keyword))) {
        return true;
    }
    if (categoriaId === 4) return true;
    return false;
}

export async function relatorioMovimentacaoController(req, res) {
    try {
        const userId = Number(req.user.sub);
        const { mes, ano, categoria_id } = req.query;

        // Data atual
        const agora = new Date();
        const mesAtual = agora.getUTCMonth() + 1;
        const anoAtual = agora.getUTCFullYear();

        // Validar e usar mes/ano padrão (atual) se não fornecidos
        const mesValido = Number.isInteger(Number(mes)) && Number(mes) >= 1 && Number(mes) <= 12;
        const anoValido = Number.isInteger(Number(ano)) && Number(ano) >= 2000;

        const mesSelecionado = mesValido ? Number(mes) : mesAtual;
        const anoSelecionado = anoValido ? Number(ano) : anoAtual;

        // Construir range de datas
        const dataInicio = new Date(Date.UTC(anoSelecionado, mesSelecionado - 1, 1));
        const dataFim = new Date(Date.UTC(anoSelecionado, mesSelecionado, 1));

        // Construir where clause
        const where = {
            usuario_id: userId,
            data_movimentacao: {
                gte: dataInicio,
                lt: dataFim,
            },
            OR: [
                { status: 1 },
                { status: null },
            ],
        };

        // Filtrar por categoria se fornecida
        const categoriaId = Number(categoria_id);
        if (Number.isInteger(categoriaId) && categoriaId > 0) {
            where.categoria_id = categoriaId;
        }

        // Buscar movimentações
        const movimentacoes = await prisma.movimentacao_financeira.findMany({
            where,
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
            orderBy: [{ data_movimentacao: "desc" }, { id: "desc" }],
        });

        // Processar dados para relatório
        let totalGanhos = 0;
        let totalGastos = 0;
        const categoriaSaldoMap = new Map();
        const movimentacoesPorData = [];

        for (const item of movimentacoes) {
            const valor = Number(item.valor ?? 0);
            if (!Number.isFinite(valor) || valor <= 0) continue;

            const categoriaNome = String(item?.categoria_movimentacao?.nome ?? "Sem categoria");
            const isGasto = isGastoCategoria(item);
            const isGanho = !isGasto && isGanhoCategoria(item);

            if (isGasto) {
                totalGastos += valor;
                categoriaSaldoMap.set(categoriaNome, (categoriaSaldoMap.get(categoriaNome) || 0) - valor);
            } else if (isGanho) {
                totalGanhos += valor;
                categoriaSaldoMap.set(categoriaNome, (categoriaSaldoMap.get(categoriaNome) || 0) + valor);
            } else {
                totalGanhos += valor;
                categoriaSaldoMap.set(categoriaNome, (categoriaSaldoMap.get(categoriaNome) || 0) + valor);
            }

            movimentacoesPorData.push({
                id: item.id,
                descricao: item.descricao,
                valor: Number(item.valor.toFixed(2)),
                data_movimentacao: item.data_movimentacao,
                categoria: {
                    id: item.categoria_movimentacao.id,
                    nome: item.categoria_movimentacao.nome,
                },
                tipo: isGasto ? "gasto" : isGanho ? "ganho" : "outro",
            });
        }

        // Preparar dados por categoria
        const saldoPorCategoria = Array.from(categoriaSaldoMap.entries())
            .map(([categoria, saldo]) => ({
                categoria,
                saldo: Number(saldo.toFixed(2)),
            }))
            .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));

        // Resposta formatada
        return res.json({
            success: true,
            relatorio: {
                periodo: {
                    mes: mesSelecionado,
                    ano: anoSelecionado,
                    dataInicio: dataInicio.toISOString().split('T')[0],
                    dataFim: new Date(dataFim.getTime() - 1).toISOString().split('T')[0],
                },
                filtros: {
                    categoriaFiltrada: Number.isInteger(categoriaId) && categoriaId > 0 ? categoriaId : null,
                },
                resumo: {
                    totalGanhos: Number(totalGanhos.toFixed(2)),
                    totalGastos: Number(totalGastos.toFixed(2)),
                    saldo: Number((totalGanhos - totalGastos).toFixed(2)),
                    totalMovimentacoes: movimentacoes.length,
                },
                saldoPorCategoria,
                movimentacoes: movimentacoesPorData,
            },
        });
    } catch (error) {
        console.error("Erro ao gerar relatório de movimentação:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}
