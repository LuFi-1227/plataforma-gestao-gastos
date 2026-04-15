import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);
const prisma = new PrismaClient({ adapter });

function slugifyCategoryName(nome) {
    return String(nome)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function buildThemeVariableMap() {
    return {
        "cor-primaria": "--color-primary",
        "cor-secundaria": "--color-secondary",
        "cor-terciaria": "--color-tertiary",
        fonte: "--font-family-base",
        logo: "--brand-logo-url",
        "tamanho-fonte-primaria": "--font-size-primary",
        "tamanho-fonte-secundaria": "--font-size-secondary",
        "tamanho-fonte-terciaria": "--font-size-tertiary",
    };
}

export async function getTemaController(req, res) {
    try {
        const [categoriasCustomizacao, categoriasMovimentacao, customizacoes] = await Promise.all([
            prisma.categoria_customizacao.findMany({
                where: { status: 1 },
                select: { id: true, nome: true },
                orderBy: { nome: "asc" },
            }),
            prisma.categoria_movimentacao.findMany({
                where: { status: 1 },
                select: { id: true, nome: true },
                orderBy: { nome: "asc" },
            }),
            prisma.customizacao.findMany({
                where: { status: 1 },
                select: {
                    valor: true,
                    categoria_customizacao: {
                        select: { id: true, nome: true },
                    },
                },
                orderBy: { id: "desc" },
            }),
        ]);

        const idVariables = {};

        for (const categoria of categoriasCustomizacao) {
            const slug = slugifyCategoryName(categoria.nome);
            idVariables[`--customizacao-${slug}-id`] = String(categoria.id);
        }

        for (const categoria of categoriasMovimentacao) {
            const slug = slugifyCategoryName(categoria.nome);
            idVariables[`--categoria-movimentacao-${slug}-id`] = String(categoria.id);
        }

        const map = buildThemeVariableMap();
        const valueVariables = {};

        for (const item of customizacoes) {
            const slug = slugifyCategoryName(item.categoria_customizacao.nome);
            const cssVar = map[slug];
            if (!cssVar || valueVariables[cssVar]) {
                continue;
            }
            valueVariables[cssVar] = item.valor;
        }

        return res.json({
            success: true,
            data: {
                idVariables,
                valueVariables,
            },
        });
    } catch (error) {
        console.error("Erro ao carregar tema:", error);
        return res.status(500).json({ success: false, message: "Erro ao carregar tema" });
    }
}
