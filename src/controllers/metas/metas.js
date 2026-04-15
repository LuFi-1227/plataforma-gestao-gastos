import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

const STATUS_ATIVO_WHERE = {
    OR: [
        { status: 1 },
        { status: null },
    ],
};

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

function construirWhereMetas(userId, query = {}) {
    const and = [
        { usuario_id: userId },
        STATUS_ATIVO_WHERE,
    ];

    const categoriaId = Number(query.categoria_movimentacao_id);
    if (Number.isInteger(categoriaId) && categoriaId > 0) {
        and.push({ categoria_movimentacao_id: categoriaId });
    }

    const mes = Number(query.mes_meta);
    const ano = Number(query.ano_meta);
    const mesValido = Number.isInteger(mes) && mes >= 1 && mes <= 12;
    const anoValido = Number.isInteger(ano) && ano >= 2000;

    if (mesValido && anoValido) {
        const inicio = new Date(Date.UTC(ano, mes - 1, 1));
        const fim = new Date(Date.UTC(ano, mes, 1));
        and.push({ data_meta: { gte: inicio, lt: fim } });
    } else if (anoValido) {
        const inicioAno = new Date(Date.UTC(ano, 0, 1));
        const fimAno = new Date(Date.UTC(ano + 1, 0, 1));
        and.push({ data_meta: { gte: inicioAno, lt: fimAno } });
    }

    const search = String(query.search ?? "").trim();
    if (search.length) {
        and.push({ descricao: { contains: search, mode: "insensitive" } });
    }

    const valorNumero = parseValorMonetario(query.valor_meta);
    if (Number.isFinite(valorNumero) && valorNumero > 0) {
        and.push({ valor: { equals: valorNumero } });
    }

    return { AND: and };
}

async function categoriaMovimentacaoExiste(categoriaId) {
    const categoria = await prisma.categoria_movimentacao.findFirst({
        where: {
            id: categoriaId,
            ...STATUS_ATIVO_WHERE,
        },
        select: { id: true },
    });
    return Boolean(categoria);
}

function toUtcDateOnly(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function obterAndamentoMeta(metaDataLimite, concluida) {
    if (concluida) return "batida";
    const hoje = toUtcDateOnly(new Date());
    const limite = toUtcDateOnly(metaDataLimite);
    if (!hoje || !limite) return "nao_batida";
    return hoje <= limite ? "em_andamento" : "nao_batida";
}

function parseNumber(value) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function periodosSaoConcorrentes(metaA, metaB) {
    if (Number(metaA.categoria_movimentacao_id) !== Number(metaB.categoria_movimentacao_id)) {
        return false;
    }

    const inicioA = toUtcDateOnly(metaA.created_at);
    const fimA = toUtcDateOnly(metaA.data_meta);
    const inicioB = toUtcDateOnly(metaB.created_at);
    const fimB = toUtcDateOnly(metaB.data_meta);

    if (!inicioA || !fimA || !inicioB || !fimB) return false;
    return inicioA <= fimB && inicioB <= fimA;
}

async function calcularValorAcumulado(meta) {
    const inicio = toUtcDateOnly(meta.created_at);
    const fim = toUtcDateOnly(meta.data_meta);
    if (!inicio || !fim || inicio > fim) return 0;

    const agregado = await prisma.movimentacao_financeira.aggregate({
        _sum: { valor: true },
        where: {
            usuario_id: Number(meta.usuario_id),
            categoria_id: Number(meta.categoria_movimentacao_id),
            ...STATUS_ATIVO_WHERE,
            data_movimentacao: {
                gte: inicio,
                lte: fim,
            },
        },
    });

    return parseNumber(agregado?._sum?.valor);
}

async function calcularValorAcumuladoPorJanela({ usuarioId, categoriaId, inicio, fim }) {
    if (!inicio || !fim || inicio > fim) return 0;

    const agregado = await prisma.movimentacao_financeira.aggregate({
        _sum: { valor: true },
        where: {
            usuario_id: Number(usuarioId),
            categoria_id: Number(categoriaId),
            ...STATUS_ATIVO_WHERE,
            data_movimentacao: {
                gte: inicio,
                lte: fim,
            },
        },
    });

    return parseNumber(agregado?._sum?.valor);
}

function maxDate(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
}

async function enriquecerMetaComProgresso(meta) {
    const valorMeta = parseNumber(meta.valor);
    const valorAcumulado = await calcularValorAcumulado(meta);
    const percentualRaw = valorMeta > 0 ? (valorAcumulado / valorMeta) * 100 : 0;
    const percentual = Math.max(0, Math.min(100, percentualRaw));

    let concluida = Boolean(meta.concluida);
    let concluidaEm = meta.concluida_em || null;

    if (percentual >= 100 && !concluida) {
        const metaAtualizada = await prisma.metas.update({
            where: { id: Number(meta.id) },
            data: {
                concluida: true,
                concluida_em: new Date(),
                notificacao_enviada: false,
                notificacao_enviada_em: null,
                updated_at: new Date(),
            },
            select: {
                concluida: true,
                concluida_em: true,
            },
        });

        concluida = Boolean(metaAtualizada.concluida);
        concluidaEm = metaAtualizada.concluida_em || null;
    }

    return {
        ...meta,
        concluida,
        concluida_em: concluidaEm,
        valor_acumulado: Number(valorAcumulado.toFixed(2)),
        progresso_percentual: Number(percentual.toFixed(2)),
        andamento: obterAndamentoMeta(meta.data_meta, concluida),
    };
}

async function enriquecerListaMetas(metas = []) {
    if (!metas.length) return [];

    const userId = Number(metas[0]?.usuario_id);
    const categoriasIds = [...new Set(metas.map((meta) => Number(meta.categoria_movimentacao_id)).filter((id) => Number.isInteger(id) && id > 0))];

    if (!Number.isInteger(userId) || userId <= 0 || !categoriasIds.length) {
        const fallback = await Promise.all(metas.map((meta) => enriquecerMetaComProgresso(meta)));
        return fallback;
    }

    const metasContexto = await prisma.metas.findMany({
        where: {
            usuario_id: userId,
            categoria_movimentacao_id: { in: categoriasIds },
            ...STATUS_ATIVO_WHERE,
        },
        select: {
            id: true,
            usuario_id: true,
            categoria_movimentacao_id: true,
            valor: true,
            data_meta: true,
            created_at: true,
            concluida: true,
            concluida_em: true,
        },
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
    });

    const metasPorCategoria = new Map();
    metasContexto.forEach((meta) => {
        const key = Number(meta.categoria_movimentacao_id);
        const list = metasPorCategoria.get(key) || [];
        list.push(meta);
        metasPorCategoria.set(key, list);
    });

    const enrichedById = new Map();

    for (const [, lista] of metasPorCategoria) {
        let contadorLiberadoEm = null;
        let bloqueiaDemais = false;

        for (const meta of lista) {
            const valorMeta = parseNumber(meta.valor);
            const dataLimite = toUtcDateOnly(meta.data_meta);
            const dataCriacao = toUtcDateOnly(meta.created_at);

            let valorAcumulado = 0;
            let concluida = Boolean(meta.concluida);
            let concluidaEm = meta.concluida_em || null;

            if (!bloqueiaDemais || concluida) {
                const inicioJanela = maxDate(dataCriacao, contadorLiberadoEm || dataCriacao);
                valorAcumulado = await calcularValorAcumuladoPorJanela({
                    usuarioId: meta.usuario_id,
                    categoriaId: meta.categoria_movimentacao_id,
                    inicio: inicioJanela,
                    fim: dataLimite,
                });
            }

            const percentualRaw = valorMeta > 0 ? (valorAcumulado / valorMeta) * 100 : 0;
            const percentual = Math.max(0, Math.min(100, percentualRaw));

            if (percentual >= 100 && !concluida) {
                const metaAtualizada = await prisma.metas.update({
                    where: { id: Number(meta.id) },
                    data: {
                        concluida: true,
                        concluida_em: new Date(),
                        notificacao_enviada: false,
                        notificacao_enviada_em: null,
                        updated_at: new Date(),
                    },
                    select: {
                        concluida: true,
                        concluida_em: true,
                    },
                });

                concluida = Boolean(metaAtualizada.concluida);
                concluidaEm = metaAtualizada.concluida_em || null;
            }

            if (concluida) {
                contadorLiberadoEm = toUtcDateOnly(concluidaEm || new Date());
                bloqueiaDemais = false;
            } else {
                bloqueiaDemais = true;
                contadorLiberadoEm = null;
            }

            enrichedById.set(Number(meta.id), {
                concluida,
                concluida_em: concluidaEm,
                valor_acumulado: Number(valorAcumulado.toFixed(2)),
                progresso_percentual: Number(percentual.toFixed(2)),
                andamento: obterAndamentoMeta(meta.data_meta, concluida),
            });
        }
    }

    return metas.map((meta) => {
        const computed = enrichedById.get(Number(meta.id));
        if (!computed) {
            return {
                ...meta,
                concluida: Boolean(meta.concluida),
                concluida_em: meta.concluida_em || null,
                valor_acumulado: 0,
                progresso_percentual: 0,
                andamento: obterAndamentoMeta(meta.data_meta, Boolean(meta.concluida)),
            };
        }
        return { ...meta, ...computed };
    });
}

export async function listarMetasController(req, res) {
    try {
        const userId = Number(req.user.sub);
        const metas = await prisma.metas.findMany({
            where: construirWhereMetas(userId, req.query),
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
            orderBy: [{ data_meta: "desc" }, { id: "desc" }],
        });

        const metasEnriquecidas = await enriquecerListaMetas(metas);
        const andamentoFiltro = String(req.query.andamento ?? "").trim();
        const andamentoValido = ["nao_batida", "em_andamento", "batida"].includes(andamentoFiltro);
        const metasFiltradas = andamentoValido
            ? metasEnriquecidas.filter((meta) => meta.andamento === andamentoFiltro)
            : metasEnriquecidas;

        res.json({ success: true, metas: metasFiltradas });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function listarCategoriasMovimentacaoParaMetasController(_req, res) {
    try {
        const categorias = await prisma.categoria_movimentacao.findMany({
            where: {
                ...STATUS_ATIVO_WHERE,
            },
            select: { id: true, nome: true },
            orderBy: { nome: "asc" },
        });
        res.json({ success: true, categorias });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function getMetaController(req, res) {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user.sub);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }

        const meta = await prisma.metas.findFirst({
            where: {
                id,
                usuario_id: userId,
                ...STATUS_ATIVO_WHERE,
            },
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
        });
        if (!meta) {
            return res.status(404).json({ success: false, message: "Meta não encontrada" });
        }
        const [metaEnriquecida] = await enriquecerListaMetas([meta]);
        res.json({ success: true, meta: metaEnriquecida });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function listarNotificacoesMetasController(req, res) {
    try {
        const userId = Number(req.user.sub);
        const peek = String(req.query.peek ?? "") === "1";

        const pendentes = await prisma.metas.findMany({
            where: {
                usuario_id: userId,
                concluida: true,
                notificacao_enviada: false,
                ...STATUS_ATIVO_WHERE,
            },
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
            orderBy: [
                { valor: "desc" },
                { data_meta: "asc" },
                { id: "asc" },
            ],
        });

        if (!pendentes.length) {
            return res.json({ success: true, notificacoes: [], totalPendentes: 0 });
        }

        const principal = pendentes[0];
        const concorrentes = pendentes.filter((meta) => Number(meta.id) !== Number(principal.id) && periodosSaoConcorrentes(meta, principal));

        if (!peek) {
            await prisma.metas.update({
                where: { id: Number(principal.id) },
                data: {
                    notificacao_enviada: true,
                    notificacao_enviada_em: new Date(),
                    updated_at: new Date(),
                },
            });
        }

        const notificacao = {
            id: Number(principal.id),
            titulo: "Meta batida 🎉",
            mensagem: `Você bateu a meta \"${principal.descricao}\" (${principal.categoria_movimentacao?.nome || "Sem categoria"}).`,
            valorMeta: parseNumber(principal.valor),
            concluidaEm: principal.concluida_em,
            concorrentesNoPeriodo: concorrentes.length,
            prioridade: "maior_valor",
        };

        return res.json({
            success: true,
            notificacoes: [notificacao],
            totalPendentes: pendentes.length,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

export async function criarMetaController(req, res) {
    try {
        const userId = Number(req.user.sub);
        const { descricao, valor, categoria_movimentacao_id, data_meta } = req.body;
        const descricaoLimpa = String(descricao ?? "").trim();
        const valorNumero = parseValorMonetario(valor);
        const categoriaId = Number(categoria_movimentacao_id);
        const dataMeta = data_meta ? new Date(data_meta) : new Date();

        if (descricaoLimpa.length < 2) {
            return res.status(400).json({ success: false, message: "Descrição inválida" });
        }
        if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
            return res.status(400).json({ success: false, message: "Valor inválido" });
        }
        if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
            return res.status(400).json({ success: false, message: "Categoria inválida" });
        }
        if (Number.isNaN(dataMeta.getTime())) {
            return res.status(400).json({ success: false, message: "Data da meta inválida" });
        }

        const categoriaExiste = await categoriaMovimentacaoExiste(categoriaId);
        if (!categoriaExiste) {
            return res.status(400).json({ success: false, message: "Categoria de movimentação não encontrada" });
        }

        const meta = await prisma.metas.create({
            data: {
                descricao: descricaoLimpa,
                valor: valorNumero,
                categoria_movimentacao_id: categoriaId,
                usuario_id: userId,
                data_meta: dataMeta,
                concluida: false,
                concluida_em: null,
                notificacao_enviada: false,
                notificacao_enviada_em: null,
                status: 1,
            },
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
        });
        res.status(201).json({ success: true, message: "Meta criada com sucesso", meta });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function atualizarMetaController(req, res) {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user.sub);
        const { descricao, valor, categoria_movimentacao_id, data_meta } = req.body;
        const descricaoLimpa = String(descricao ?? "").trim();
        const valorNumero = parseValorMonetario(valor);
        const categoriaId = Number(categoria_movimentacao_id);
        const dataMeta = data_meta ? new Date(data_meta) : null;

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
        if (!dataMeta || Number.isNaN(dataMeta.getTime())) {
            return res.status(400).json({ success: false, message: "Data da meta inválida" });
        }

        const metaAtual = await prisma.metas.findFirst({
            where: {
                id,
                usuario_id: userId,
                ...STATUS_ATIVO_WHERE,
            },
            select: { id: true },
        });

        if (!metaAtual) {
            return res.status(404).json({ success: false, message: "Meta não encontrada" });
        }

        const categoriaExiste = await categoriaMovimentacaoExiste(categoriaId);
        if (!categoriaExiste) {
            return res.status(400).json({ success: false, message: "Categoria de movimentação não encontrada" });
        }

        const meta = await prisma.metas.update({
            where: { id },
            data: {
                descricao: descricaoLimpa,
                valor: valorNumero,
                categoria_movimentacao_id: categoriaId,
                data_meta: dataMeta,
                concluida: false,
                concluida_em: null,
                notificacao_enviada: false,
                notificacao_enviada_em: null,
                updated_at: new Date(),
            },
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
        });
        res.json({ success: true, message: "Meta atualizada com sucesso", meta });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function excluirMetaController(req, res) {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user.sub);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }

        const metaAtual = await prisma.metas.findFirst({
            where: {
                id,
                usuario_id: userId,
                ...STATUS_ATIVO_WHERE,
            },
            select: { id: true },
        });

        if (!metaAtual) {
            return res.status(404).json({ success: false, message: "Meta não encontrada" });
        }

        await prisma.metas.update({
            where: { id },
            data: {
                status: 0,
                updated_at: new Date(),
            },
        });
        res.json({ success: true, message: "Meta excluída com sucesso" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

export async function prorrogarMetaController(req, res) {
    try {
        const id = Number(req.params.id);
        const userId = Number(req.user.sub);
        const novaDataRaw = req.body?.data_meta;
        const novaData = novaDataRaw ? new Date(novaDataRaw) : null;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }
        if (!novaData || Number.isNaN(novaData.getTime())) {
            return res.status(400).json({ success: false, message: "Data da meta inválida" });
        }

        const metaAtual = await prisma.metas.findFirst({
            where: {
                id,
                usuario_id: userId,
                ...STATUS_ATIVO_WHERE,
            },
            select: {
                id: true,
                data_meta: true,
                concluida: true,
            },
        });

        if (!metaAtual) {
            return res.status(404).json({ success: false, message: "Meta não encontrada" });
        }

        if (Boolean(metaAtual.concluida)) {
            return res.status(400).json({ success: false, message: "Meta já concluída não pode ser prorrogada" });
        }

        const dataAtualMeta = new Date(metaAtual.data_meta);
        if (novaData <= dataAtualMeta) {
            return res.status(400).json({ success: false, message: "A nova data deve ser maior que a data atual da meta" });
        }

        const meta = await prisma.metas.update({
            where: { id },
            data: {
                data_meta: novaData,
                notificacao_enviada: false,
                notificacao_enviada_em: null,
                updated_at: new Date(),
            },
            include: {
                categoria_movimentacao: {
                    select: { id: true, nome: true },
                },
            },
        });

        return res.json({ success: true, message: "Meta prorrogada com sucesso", meta });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
