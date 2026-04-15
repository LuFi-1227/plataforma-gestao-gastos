import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

const TIPOS_PAGAMENTO_VALIDOS = ["diario", "semanal", "quinzenal", "mensal", "bimestral", "trimestral", "semestral", "anual"];
const ORDENACOES_VALIDAS = ["mais_recente", "usuario_az", "mais_antigo"];

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

function normalizarTipoPagamento(tipoRaw) {
    const tipo = String(tipoRaw ?? "").trim().toLowerCase();
    return TIPOS_PAGAMENTO_VALIDOS.includes(tipo) ? tipo : null;
}

function calcularDataVencimento(dataPagamento, tipoPagamento) {
    const base = new Date(dataPagamento);
    const resultado = new Date(base);

    switch (tipoPagamento) {
        case "diario":
            resultado.setDate(resultado.getDate() + 1);
            break;
        case "semanal":
            resultado.setDate(resultado.getDate() + 7);
            break;
        case "quinzenal":
            resultado.setDate(resultado.getDate() + 14);
            break;
        case "mensal":
            resultado.setMonth(resultado.getMonth() + 1);
            break;
        case "bimestral":
            resultado.setMonth(resultado.getMonth() + 2);
            break;
        case "trimestral":
            resultado.setMonth(resultado.getMonth() + 3);
            break;
        case "semestral":
            resultado.setMonth(resultado.getMonth() + 6);
            break;
        case "anual":
            resultado.setFullYear(resultado.getFullYear() + 1);
            break;
        default:
            resultado.setMonth(resultado.getMonth() + 1);
            break;
    }

    return resultado;
}

function getOrderBy(ordenacao) {
    if (ordenacao === "usuario_az") {
        return [{ usuarios: { nome: "asc" } }, { id: "desc" }];
    }
    if (ordenacao === "mais_antigo") {
        return [{ data_pagamento: "asc" }, { id: "asc" }];
    }
    return [{ data_pagamento: "desc" }, { id: "desc" }];
}

function construirWhereFiltros(query = {}) {
    const and = [
        {
            OR: [
                { status: 1 },
                { status: null },
            ],
        },
    ];

    const tipoPagamentoRaw = String(query.tipo_pagamento ?? "").trim().toLowerCase();
    if (tipoPagamentoRaw.length) {
        const tipoPagamento = normalizarTipoPagamento(tipoPagamentoRaw);
        if (tipoPagamento) {
            and.push({ tipo_pagamento: tipoPagamento });
        }
    }

    const mes = Number(query.mes_pagamento);
    const ano = Number(query.ano_pagamento);
    const mesValido = Number.isInteger(mes) && mes >= 1 && mes <= 12;
    const anoValido = Number.isInteger(ano) && ano >= 2000;

    if (mesValido && anoValido) {
        const inicio = new Date(ano, mes - 1, 1);
        const fim = new Date(ano, mes, 1);
        and.push({
            data_pagamento: {
                gte: inicio,
                lt: fim,
            },
        });
    } else if (anoValido) {
        const inicioAno = new Date(ano, 0, 1);
        const fimAno = new Date(ano + 1, 0, 1);
        and.push({
            data_pagamento: {
                gte: inicioAno,
                lt: fimAno,
            },
        });
    }

    const atraso = String(query.filtro_atraso ?? "todos").toLowerCase();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (atraso === "atrasados") {
        and.push({ data_vencimento: { lt: hoje } });
    }
    if (atraso === "em_dia") {
        and.push({ data_vencimento: { gte: hoje } });
    }

    const busca = String(query.search ?? "").trim();
    if (busca.length) {
        and.push({
            OR: [
                { descricao: { contains: busca, mode: "insensitive" } },
                { usuarios: { nome: { contains: busca, mode: "insensitive" } } },
                { usuarios: { email: { contains: busca, mode: "insensitive" } } },
            ],
        });
    }

    return { AND: and };
}

export async function validarPermissaoInteracaoController(req, res) {
    try {
        const usuarioId = Number(req.user?.sub);
        if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
            return res.status(401).json({ success: false, message: "Usuário não autenticado" });
        }

        const customizacaoTipoApp = await prisma.customizacao.findFirst({
            where: {
                status: 1,
                tipo_valor: "tipo_de_aplicacao",
                valor: "uso_para_marketing",
                categoria_customizacao: {
                    nome: {
                        equals: "Tipo_app",
                        mode: "insensitive",
                    },
                },
            },
            select: { id: true },
        });

        const marketingAtivo = Boolean(customizacaoTipoApp);
        if (!marketingAtivo) {
            return res.json({
                success: true,
                permite_interacao: true,
                marketing_ativo: false,
                usuario_ativo: true,
                pagamento_em_dia: true,
            });
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const [usuario, pagamentoEmDia] = await Promise.all([
            prisma.usuarios.findFirst({
                where: {
                    id: usuarioId,
                    OR: [
                        { status: 1 },
                        { status: null },
                    ],
                },
                select: { id: true },
            }),
            prisma.pagamentos.findFirst({
                where: {
                    usuario_id: usuarioId,
                    OR: [
                        { status: 1 },
                        { status: null },
                    ],
                    data_vencimento: { gte: hoje },
                },
                orderBy: [
                    { data_vencimento: "desc" },
                    { id: "desc" },
                ],
                select: { id: true },
            }),
        ]);

        const usuarioAtivo = Boolean(usuario);
        const estaEmDia = Boolean(pagamentoEmDia);
        const permiteInteracao = usuarioAtivo && estaEmDia;

        return res.json({
            success: true,
            permite_interacao: permiteInteracao,
            marketing_ativo: true,
            usuario_ativo: usuarioAtivo,
            pagamento_em_dia: estaEmDia,
        });
    } catch (error) {
        console.error("Erro ao validar permissão de interação:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export async function listarPagamentosController(req, res) {
    try {
        const ordenacao = ORDENACOES_VALIDAS.includes(String(req.query.ordenacao))
            ? String(req.query.ordenacao)
            : "mais_recente";

        const where = construirWhereFiltros(req.query);
        let pagamentos = await prisma.pagamentos.findMany({
            where,
            include: {
                usuarios: {
                    select: { id: true, nome: true, email: true },
                },
            },
            orderBy: getOrderBy(ordenacao),
        });

        const mes = Number(req.query.mes_pagamento);
        const ano = Number(req.query.ano_pagamento);
        const mesValido = Number.isInteger(mes) && mes >= 1 && mes <= 12;
        const anoValido = Number.isInteger(ano) && ano >= 2000;

        if (mesValido && !anoValido) {
            pagamentos = pagamentos.filter((item) => {
                const data = new Date(item.data_pagamento);
                if (Number.isNaN(data.getTime())) return false;
                return data.getMonth() + 1 === mes;
            });
        }

        return res.json({ success: true, pagamentos });
    } catch (error) {
        console.error("Erro ao listar pagamentos:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export async function getPagamentoController(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }

        const pagamento = await prisma.pagamentos.findUnique({
            where: { id },
            include: {
                usuarios: {
                    select: { id: true, nome: true, email: true },
                },
            },
        });

        if (!pagamento || Number(pagamento.status ?? 1) !== 1) {
            return res.status(404).json({ success: false, message: "Pagamento não encontrado" });
        }

        return res.json({ success: true, pagamento });
    } catch (error) {
        console.error("Erro ao buscar pagamento:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export async function criarPagamentoController(req, res) {
    try {
        const { descricao, valor, data_pagamento, tipo_pagamento, usuario_id } = req.body;

        const descricaoLimpa = String(descricao ?? "").trim();
        const valorNumero = parseValorMonetario(valor);
        const tipoPagamento = normalizarTipoPagamento(tipo_pagamento);
        const usuarioId = Number(usuario_id ?? req.user.sub);

        if (descricaoLimpa.length < 2) {
            return res.status(400).json({ success: false, message: "Descrição inválida" });
        }
        if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
            return res.status(400).json({ success: false, message: "Valor inválido" });
        }
        if (!tipoPagamento) {
            return res.status(400).json({ success: false, message: "Tipo de pagamento inválido" });
        }
        if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
            return res.status(400).json({ success: false, message: "Usuário inválido" });
        }

        const dataPagamento = data_pagamento ? new Date(data_pagamento) : new Date();
        if (Number.isNaN(dataPagamento.getTime())) {
            return res.status(400).json({ success: false, message: "Data de pagamento inválida" });
        }

        const dataVencimento = calcularDataVencimento(dataPagamento, tipoPagamento);

        const pagamento = await prisma.pagamentos.create({
            data: {
                status: 1,
                descricao: descricaoLimpa,
                valor: valorNumero,
                tipo_pagamento: tipoPagamento,
                data_pagamento: dataPagamento,
                data_vencimento: dataVencimento,
                usuario_id: usuarioId,
            },
            include: {
                usuarios: {
                    select: { id: true, nome: true, email: true },
                },
            },
        });

        return res.status(201).json({ success: true, message: "Pagamento criado com sucesso", pagamento });
    } catch (error) {
        console.error("Erro ao criar pagamento:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export async function criarPagamentoParaUsuarioController(req, res) {
    req.body.usuario_id = Number(req.params.id);
    return criarPagamentoController(req, res);
}

export async function atualizarPagamentoController(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }

        const atual = await prisma.pagamentos.findUnique({ where: { id } });
        if (!atual || Number(atual.status ?? 1) !== 1) {
            return res.status(404).json({ success: false, message: "Pagamento não encontrado" });
        }

        const { descricao, valor, data_pagamento, tipo_pagamento } = req.body;
        const descricaoLimpa = String(descricao ?? "").trim();
        const valorNumero = parseValorMonetario(valor);
        const tipoPagamento = normalizarTipoPagamento(tipo_pagamento);

        if (descricaoLimpa.length < 2) {
            return res.status(400).json({ success: false, message: "Descrição inválida" });
        }
        if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
            return res.status(400).json({ success: false, message: "Valor inválido" });
        }
        if (!tipoPagamento) {
            return res.status(400).json({ success: false, message: "Tipo de pagamento inválido" });
        }

        const dataPagamento = data_pagamento ? new Date(data_pagamento) : new Date();
        if (Number.isNaN(dataPagamento.getTime())) {
            return res.status(400).json({ success: false, message: "Data de pagamento inválida" });
        }

        const dataVencimento = calcularDataVencimento(dataPagamento, tipoPagamento);

        const pagamento = await prisma.pagamentos.update({
            where: { id },
            data: {
                descricao: descricaoLimpa,
                valor: valorNumero,
                tipo_pagamento: tipoPagamento,
                data_pagamento: dataPagamento,
                data_vencimento: dataVencimento,
                updated_at: new Date(),
            },
            include: {
                usuarios: {
                    select: { id: true, nome: true, email: true },
                },
            },
        });

        return res.json({ success: true, message: "Pagamento atualizado com sucesso", pagamento });
    } catch (error) {
        console.error("Erro ao atualizar pagamento:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export async function excluirPagamentoController(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }

        const atual = await prisma.pagamentos.findUnique({ where: { id } });
        if (!atual || Number(atual.status ?? 1) !== 1) {
            return res.status(404).json({ success: false, message: "Pagamento não encontrado" });
        }

        await prisma.pagamentos.update({
            where: { id },
            data: { status: 0, updated_at: new Date() },
        });

        return res.json({ success: true, message: "Pagamento excluído com sucesso" });
    } catch (error) {
        console.error("Erro ao excluir pagamento:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
