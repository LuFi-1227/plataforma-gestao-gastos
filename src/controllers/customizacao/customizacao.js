import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

const TIPOS_VALOR_VALIDOS = ["texto", "foto", "cor", "data", "fonte", "tamanho_fonte", "tipo_de_aplicacao"];
const FONT_SIZE_REGEX = /^\d+(?:\.\d+)?(px|em|rem|%|vw|vh|pt)$/i;
const TIPO_APP_VALORES_VALIDOS = ["uso_pessoal", "uso_para_marketing"];

function normalizarCategoriaNome(nome) {
    return String(nome ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .trim();
}

function normalizarTipoAplicacao(valor) {
    const normalizado = String(valor ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
    if (normalizado === "uso_pessoal") return "uso_pessoal";
    if (normalizado === "uso_para_marketing" || normalizado === "uso_para_mkt") return "uso_para_marketing";
    return null;
}

function includeCategoria() {
    return { categoria_customizacao: true };
}

function formatCustomizacao(c) {
    return {
        id: c.id,
        status: c.status,
        valor: c.valor,
        tipo_valor: c.tipo_valor,
        categoria_id: c.categoria_id,
        categoria_nome: c.categoria_customizacao?.nome ?? null,
        created_at: c.created_at,
        updated_at: c.updated_at,
    };
}

// GET /api/customizacoes
export async function listarCustomizacoesController(req, res) {
    try {
        const customizacoes = await prisma.customizacao.findMany({
            where: { status: 1 },
            include: includeCategoria(),
            orderBy: { id: "asc" },
        });
        res.json({ success: true, customizacoes: customizacoes.map(formatCustomizacao) });
    } catch (error) {
        console.error("Erro ao listar customizações:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// GET /api/customizacoes/:id
export async function getCustomizacaoController(req, res) {
    try {
        const id = parseInt(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }
        const customizacao = await prisma.customizacao.findUnique({
            where: { id },
            include: includeCategoria(),
        });
        if (!customizacao) {
            return res.status(404).json({ success: false, message: "Customização não encontrada" });
        }
        res.json({ success: true, customizacao: formatCustomizacao(customizacao) });
    } catch (error) {
        console.error("Erro ao buscar customização:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// POST /api/customizacoes — aceita multipart (foto) ou JSON
export async function criarCustomizacaoController(req, res) {
    try {
        const categoria_id = parseInt(req.body?.categoria_id);
        const tipo_valor = String(req.body?.tipo_valor ?? "texto").trim().toLowerCase();

        if (!Number.isInteger(categoria_id) || categoria_id <= 0) {
            return res.status(400).json({ success: false, message: "categoria_id é obrigatório e deve ser um inteiro positivo" });
        }
        if (!TIPOS_VALOR_VALIDOS.includes(tipo_valor)) {
            return res.status(400).json({ success: false, message: `tipo_valor deve ser um de: ${TIPOS_VALOR_VALIDOS.join(", ")}` });
        }

        const categoria = await prisma.categoria_customizacao.findUnique({ where: { id: categoria_id } });
        if (!categoria) {
            return res.status(404).json({ success: false, message: "Categoria de customização não encontrada" });
        }

        const categoriaEhTipoApp = normalizarCategoriaNome(categoria.nome) === "tipo_app";
        if (categoriaEhTipoApp && tipo_valor !== "tipo_de_aplicacao") {
            return res.status(400).json({ success: false, message: "Para a categoria Tipo_app, o tipo_valor deve ser 'tipo_de_aplicacao'" });
        }

        let valor;
        if (tipo_valor === "foto") {
            if (!req.file) {
                return res.status(400).json({ success: false, message: "Envie uma imagem para o tipo 'foto'" });
            }
            valor = `/uploads/customizacao/${req.file.filename}`;
        } else {
            valor = String(req.body?.valor ?? "").trim();
            if (!valor) {
                return res.status(400).json({ success: false, message: "O campo valor é obrigatório" });
            }
            if (tipo_valor === "cor" && !/^#[0-9A-Fa-f]{3,8}$/.test(valor)) {
                return res.status(400).json({ success: false, message: "Valor de cor deve ser um hex válido (ex: #FF5733)" });
            }
            if (tipo_valor === "tamanho_fonte" && !FONT_SIZE_REGEX.test(valor)) {
                return res.status(400).json({ success: false, message: "Valor de tamanho de fonte inválido (ex: 16px, 1.2em)" });
            }
            if (tipo_valor === "tipo_de_aplicacao") {
                const valorNormalizado = normalizarTipoAplicacao(valor);
                if (!valorNormalizado || !TIPO_APP_VALORES_VALIDOS.includes(valorNormalizado)) {
                    return res.status(400).json({ success: false, message: "Valor inválido para Tipo de aplicação" });
                }
                valor = valorNormalizado;
            }
        }

        const customizacao = await prisma.customizacao.create({
            data: { categoria_id, tipo_valor, valor },
            include: includeCategoria(),
        });

        res.status(201).json({
            success: true,
            message: "Customização criada com sucesso",
            customizacao: formatCustomizacao(customizacao),
        });
    } catch (error) {
        console.error("Erro ao criar customização:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// PUT /api/customizacoes/:id — aceita multipart (foto) ou JSON
export async function atualizarCustomizacaoController(req, res) {
    try {
        const id = parseInt(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }

        const atual = await prisma.customizacao.findUnique({ where: { id } });
        if (!atual) {
            return res.status(404).json({ success: false, message: "Customização não encontrada" });
        }

        const categoria_id_raw = req.body?.categoria_id;
        const categoria_id = categoria_id_raw !== undefined ? parseInt(categoria_id_raw) : atual.categoria_id;
        const tipo_valor = req.body?.tipo_valor
            ? String(req.body.tipo_valor).trim().toLowerCase()
            : atual.tipo_valor;

        if (!Number.isInteger(categoria_id) || categoria_id <= 0) {
            return res.status(400).json({ success: false, message: "categoria_id deve ser um inteiro positivo" });
        }
        if (!TIPOS_VALOR_VALIDOS.includes(tipo_valor)) {
            return res.status(400).json({ success: false, message: `tipo_valor deve ser um de: ${TIPOS_VALOR_VALIDOS.join(", ")}` });
        }

        const categoria = await prisma.categoria_customizacao.findUnique({ where: { id: categoria_id } });
        if (!categoria) {
            return res.status(404).json({ success: false, message: "Categoria de customização não encontrada" });
        }

        const categoriaEhTipoApp = normalizarCategoriaNome(categoria.nome) === "tipo_app";
        if (categoriaEhTipoApp && tipo_valor !== "tipo_de_aplicacao") {
            return res.status(400).json({ success: false, message: "Para a categoria Tipo_app, o tipo_valor deve ser 'tipo_de_aplicacao'" });
        }

        let valor;
        if (tipo_valor === "foto") {
            valor = req.file ? `/uploads/customizacao/${req.file.filename}` : atual.valor;
        } else {
            valor = String(req.body?.valor ?? "").trim();
            if (!valor) {
                return res.status(400).json({ success: false, message: "O campo valor é obrigatório" });
            }
            if (tipo_valor === "cor" && !/^#[0-9A-Fa-f]{3,8}$/.test(valor)) {
                return res.status(400).json({ success: false, message: "Valor de cor deve ser um hex válido (ex: #FF5733)" });
            }
            if (tipo_valor === "tamanho_fonte" && !FONT_SIZE_REGEX.test(valor)) {
                return res.status(400).json({ success: false, message: "Valor de tamanho de fonte inválido (ex: 16px, 1.2em)" });
            }
            if (tipo_valor === "tipo_de_aplicacao") {
                const valorNormalizado = normalizarTipoAplicacao(valor);
                if (!valorNormalizado || !TIPO_APP_VALORES_VALIDOS.includes(valorNormalizado)) {
                    return res.status(400).json({ success: false, message: "Valor inválido para Tipo de aplicação" });
                }
                valor = valorNormalizado;
            }
        }

        const customizacao = await prisma.customizacao.update({
            where: { id },
            data: { categoria_id, tipo_valor, valor, updated_at: new Date() },
            include: includeCategoria(),
        });

        res.json({
            success: true,
            message: "Customização atualizada com sucesso",
            customizacao: formatCustomizacao(customizacao),
        });
    } catch (error) {
        console.error("Erro ao atualizar customização:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// DELETE /api/customizacoes/:id — soft delete
export async function excluirCustomizacaoController(req, res) {
    try {
        const id = parseInt(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID inválido" });
        }
        const existe = await prisma.customizacao.findUnique({ where: { id } });
        if (!existe) {
            return res.status(404).json({ success: false, message: "Customização não encontrada" });
        }
        await prisma.customizacao.update({
            where: { id },
            data: { status: 0, updated_at: new Date() },
        });
        res.json({ success: true, message: "Customização excluída com sucesso" });
    } catch (error) {
        console.error("Erro ao excluir customização:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}
