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

function parseValorMonetario(valorRaw) {
    if (typeof valorRaw === "number") {
        return Number.isFinite(valorRaw) ? valorRaw : NaN;
    }

    const normalizado = String(valorRaw ?? "")
        .replace(/R\$/gi, "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(/,/g, ".");

    return Number(normalizado);
}

function construirWhereTransacoes(userId, query = {}) {
    const and = [
        { usuario_id: userId },
        {
            OR: [
                { status: 1 },
                { status: null },
            ],
        },
    ];

    const categoriaId = Number(query.categoria_id);
    if (Number.isInteger(categoriaId) && categoriaId > 0) {
        and.push({ categoria_id: categoriaId });
    }

    const mes = Number(query.mes_movimentacao);
    const ano = Number(query.ano_movimentacao);
    const mesValido = Number.isInteger(mes) && mes >= 1 && mes <= 12;
    const anoValido = Number.isInteger(ano) && ano >= 2000;

    if (mesValido && anoValido) {
        const inicio = new Date(Date.UTC(ano, mes - 1, 1));
        const fim = new Date(Date.UTC(ano, mes, 1));
        and.push({ data_movimentacao: { gte: inicio, lt: fim } });
    } else if (anoValido) {
        const inicioAno = new Date(Date.UTC(ano, 0, 1));
        const fimAno = new Date(Date.UTC(ano + 1, 0, 1));
        and.push({ data_movimentacao: { gte: inicioAno, lt: fimAno } });
    }

    const search = String(query.search ?? "").trim();
    if (search.length) {
        and.push({ descricao: { contains: search, mode: "insensitive" } });
    }

    const valorNumero = parseValorMonetario(query.valor);
    if (Number.isFinite(valorNumero) && valorNumero > 0) {
        and.push({ valor: { equals: valorNumero } });
    }

    return { AND: and };
}

async function categoriaMovimentacaoExiste(categoriaId) {
    const categoria = await prisma.categoria_movimentacao.findFirst({
        where: {
            id: categoriaId,
            OR: [
                { status: 1 },
                { status: null },
            ],
        },
        select: { id: true },
    });

    return Boolean(categoria);
}

export async function listarTransacoesController(req, res) {
    try {
        const userId = Number(req.user.sub);
        const transacoes = await prisma.movimentacao_financeira.findMany({
            where: construirWhereTransacoes(userId, req.query),
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
            orderBy: [{ data_movimentacao: "desc" }, { id: "desc" }],
        });
        res.json({ success: true, transacoes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function listarCategoriasMovimentacaoParaTransacoesController(_req, res) {
    try {
        const categorias = await prisma.categoria_movimentacao.findMany({
            where: {
                OR: [
                    { status: 1 },
                    { status: null },
                ],
            },
            select: { id: true, nome: true },
            orderBy: { nome: "asc" },
        });
        res.json({ success: true, categorias });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function getTransacaoController(req, res) {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user.sub);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }

        const transacao = await prisma.movimentacao_financeira.findFirst({
            where: {
                id,
                usuario_id: userId,
                OR: [
                    { status: 1 },
                    { status: null },
                ],
            },
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
        });

        if (!transacao) {
            return res.status(404).json({ success: false, message: "Transação não encontrada" });
        }

        res.json({ success: true, transacao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function criarTransacaoController(req, res) {
    try {
        const userId = Number(req.user.sub);
        const { descricao, valor, categoria_id, data_movimentacao } = req.body;
        const descricaoLimpa = String(descricao ?? "").trim();
        const valorNumero = parseValorMonetario(valor);
        const categoriaId = Number(categoria_id);
        const dataMovimentacao = data_movimentacao ? new Date(data_movimentacao) : new Date();

        if (descricaoLimpa.length < 2) {
            return res.status(400).json({ success: false, message: "Descrição inválida" });
        }
        if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
            return res.status(400).json({ success: false, message: "Valor inválido" });
        }
        if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
            return res.status(400).json({ success: false, message: "Categoria inválida" });
        }
        if (Number.isNaN(dataMovimentacao.getTime())) {
            return res.status(400).json({ success: false, message: "Data da movimentação inválida" });
        }

        const categoriaExiste = await categoriaMovimentacaoExiste(categoriaId);
        if (!categoriaExiste) {
            return res.status(400).json({ success: false, message: "Categoria de movimentação não encontrada" });
        }

        const transacao = await prisma.movimentacao_financeira.create({
            data: {
                descricao: descricaoLimpa,
                valor: valorNumero,
                categoria_id: categoriaId,
                usuario_id: userId,
                data_movimentacao: dataMovimentacao,
                status: 1,
            },
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
        });

        res.status(201).json({ success: true, message: "Transação criada com sucesso", transacao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function atualizarTransacaoController(req, res) {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user.sub);
        const { descricao, valor, categoria_id, data_movimentacao } = req.body;
        const descricaoLimpa = String(descricao ?? "").trim();
        const valorNumero = parseValorMonetario(valor);
        const categoriaId = Number(categoria_id);
        const dataMovimentacao = data_movimentacao ? new Date(data_movimentacao) : null;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }
        if (descricaoLimpa.length < 2) {
            return res.status(400).json({ success: false, message: "Descrição inválida" });
        }
        if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
            return res.status(400).json({ success: false, message: "Valor inválido" });
        }
        if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
            return res.status(400).json({ success: false, message: "Categoria inválida" });
        }
        if (!dataMovimentacao || Number.isNaN(dataMovimentacao.getTime())) {
            return res.status(400).json({ success: false, message: "Data da movimentação inválida" });
        }

        const transacaoAtual = await prisma.movimentacao_financeira.findFirst({
            where: {
                id,
                usuario_id: userId,
                OR: [
                    { status: 1 },
                    { status: null },
                ],
            },
            select: { id: true },
        });

        if (!transacaoAtual) {
            return res.status(404).json({ success: false, message: "Transação não encontrada" });
        }

        const categoriaExiste = await categoriaMovimentacaoExiste(categoriaId);
        if (!categoriaExiste) {
            return res.status(400).json({ success: false, message: "Categoria de movimentação não encontrada" });
        }

        const transacao = await prisma.movimentacao_financeira.update({
            where: { id },
            data: {
                descricao: descricaoLimpa,
                valor: valorNumero,
                categoria_id: categoriaId,
                data_movimentacao: dataMovimentacao,
                updated_at: new Date(),
            },
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
        });

        res.json({ success: true, message: "Transação atualizada com sucesso", transacao });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function excluirTransacaoController(req, res) {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user.sub);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }

        const transacaoAtual = await prisma.movimentacao_financeira.findFirst({
            where: {
                id,
                usuario_id: userId,
                OR: [
                    { status: 1 },
                    { status: null },
                ],
            },
            select: { id: true },
        });

        if (!transacaoAtual) {
            return res.status(404).json({ success: false, message: "Transação não encontrada" });
        }

        await prisma.movimentacao_financeira.update({
            where: { id },
            data: {
                status: 0,
                updated_at: new Date(),
            },
        });

        res.json({ success: true, message: "Transação excluída com sucesso" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function resumoDashboardTransacoesController(req, res) {
    try {
        const userId = Number(req.user.sub);
        const now = new Date();
        const currentMonth = now.getUTCMonth() + 1;
        const currentYear = now.getUTCFullYear();

        const periodo = String(req.query.periodo ?? "mes_atual").trim();
        const mesQuery = Number(req.query.mes);
        const anoQuery = Number(req.query.ano);

        const mes = Number.isInteger(mesQuery) && mesQuery >= 1 && mesQuery <= 12 ? mesQuery : currentMonth;
        const ano = Number.isInteger(anoQuery) && anoQuery >= 2000 ? anoQuery : currentYear;

        let dataInicio = null;
        let dataFim = null;

        if (periodo === "mes") {
            dataInicio = new Date(Date.UTC(ano, mes - 1, 1));
            dataFim = new Date(Date.UTC(ano, mes, 1));
        } else if (periodo === "ano") {
            dataInicio = new Date(Date.UTC(ano, 0, 1));
            dataFim = new Date(Date.UTC(ano + 1, 0, 1));
        } else if (periodo === "mes_atual") {
            dataInicio = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
            dataFim = new Date(Date.UTC(currentYear, currentMonth, 1));
        }

        const where = {
            usuario_id: userId,
            OR: [
                { status: 1 },
                { status: null },
            ],
        };

        if (dataInicio && dataFim) {
            where.data_movimentacao = { gte: dataInicio, lt: dataFim };
        }

        const transacoes = await prisma.movimentacao_financeira.findMany({
            where,
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
            orderBy: [{ data_movimentacao: "asc" }, { id: "asc" }],
        });

        let totalGanhos = 0;
        let totalGastos = 0;

        const gastosPorDescricaoMap = new Map();
        const ganhosPorDescricaoMap = new Map();
        const saldoMensalMap = new Map();
        const categoriaSaldoMap = new Map();

        for (const item of transacoes) {
            const valor = Number(item.valor ?? 0);
            if (!Number.isFinite(valor) || valor <= 0) continue;

            const descricao = String(item.descricao ?? "Sem descrição").trim() || "Sem descrição";
            const categoriaNome = String(item?.categoria_movimentacao?.nome ?? "Sem categoria");
            const data = new Date(item.data_movimentacao);
            const anoMes = Number.isNaN(data.getTime())
                ? "Desconhecido"
                : `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;

            const isGasto = isGastoCategoria(item);
            const isGanho = !isGasto && isGanhoCategoria(item);

            if (isGasto) {
                totalGastos += valor;
                gastosPorDescricaoMap.set(descricao, (gastosPorDescricaoMap.get(descricao) || 0) + valor);
                saldoMensalMap.set(anoMes, (saldoMensalMap.get(anoMes) || 0) - valor);
                categoriaSaldoMap.set(categoriaNome, (categoriaSaldoMap.get(categoriaNome) || 0) - valor);
            } else if (isGanho) {
                totalGanhos += valor;
                ganhosPorDescricaoMap.set(descricao, (ganhosPorDescricaoMap.get(descricao) || 0) + valor);
                saldoMensalMap.set(anoMes, (saldoMensalMap.get(anoMes) || 0) + valor);
                categoriaSaldoMap.set(categoriaNome, (categoriaSaldoMap.get(categoriaNome) || 0) + valor);
            } else {
                totalGanhos += valor;
                ganhosPorDescricaoMap.set(descricao, (ganhosPorDescricaoMap.get(descricao) || 0) + valor);
                saldoMensalMap.set(anoMes, (saldoMensalMap.get(anoMes) || 0) + valor);
                categoriaSaldoMap.set(categoriaNome, (categoriaSaldoMap.get(categoriaNome) || 0) + valor);
            }
        }

        const toSortedArray = (map) => Array.from(map.entries())
            .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
            .sort((a, b) => b.value - a.value);

        const gastosPorDescricao = toSortedArray(gastosPorDescricaoMap);
        const ganhosPorDescricao = toSortedArray(ganhosPorDescricaoMap);
        const saldoMensal = Array.from(saldoMensalMap.entries())
            .map(([periodo, saldo]) => ({ periodo, saldo: Number(saldo.toFixed(2)) }))
            .sort((a, b) => a.periodo.localeCompare(b.periodo));
        const saldoPorCategoria = toSortedArray(categoriaSaldoMap);

        return res.json({
            success: true,
            resumo: {
                totalGanhos: Number(totalGanhos.toFixed(2)),
                totalGastos: Number(totalGastos.toFixed(2)),
                saldo: Number((totalGanhos - totalGastos).toFixed(2)),
                periodoAplicado: periodo,
                mesAplicado: mes,
                anoAplicado: ano,
            },
            graficos: {
                comparativoGanhosGastos: [
                    { label: "Ganhos", value: Number(totalGanhos.toFixed(2)) },
                    { label: "Gastos", value: Number(totalGastos.toFixed(2)) },
                ],
                gastosPorDescricao,
                ganhosPorDescricao,
                saldoMensal,
                saldoPorCategoria,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
