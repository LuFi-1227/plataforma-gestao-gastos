import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Middlewares
import { requireAuth } from "./src/middlewares/auth.js";
import { requireAdmin } from "./src/middlewares/requireAdmin.js";
import { checkTransacoesRecorrentes } from "./src/middlewares/checkTransacoesRecorrentes.js";
import { uploadFotoMiddleware } from "./src/middlewares/upload.js";
import { uploadUserPhotoMiddleware } from "./src/middlewares/upload.js";

// Controllers
import { loginController, loginPorTelefoneController } from "./src/controllers/usuarios/login.js";
import { salvarFotoUsuarioController } from "./src/controllers/usuarios/user_photo.js";
import {
    listarUsuariosController,
    listarUsuariosSelectController,
    getUsuarioController,
    criarUsuarioController,
    atualizarUsuarioController,
    deletarUsuarioController,
    getUsuarioPorEmailController,
    redefinirSenhaUsuarioController,
    alterarSenhaUsuarioController,
} from "./src/controllers/usuarios/gerenciar.js";
import {
    listarPermissoesController,
    getPermissaoController,
    criarPermissaoController,
    atualizarPermissaoController,
    excluirPermissaoController,
} from "./src/controllers/permissoes/permissoes.js";
import {
    listarPagamentosController,
    getPagamentoController,
    criarPagamentoController,
    criarPagamentoParaUsuarioController,
    validarPermissaoInteracaoController,
    atualizarPagamentoController,
    excluirPagamentoController,
} from "./src/controllers/pagamentos/pagamentos.js";
import {
    listarTransacoesController,
    listarCategoriasMovimentacaoParaTransacoesController,
    resumoDashboardTransacoesController,
    getTransacaoController,
    criarTransacaoController,
    atualizarTransacaoController,
    excluirTransacaoController,
} from "./src/controllers/transacoes/transacoes.js";
import { relatorioMovimentacaoController } from "./src/controllers/relatorios/relatorio_movimentacao.js";
import {
    listarMetasController,
    listarCategoriasMovimentacaoParaMetasController,
    listarNotificacoesMetasController,
    getMetaController,
    criarMetaController,
    atualizarMetaController,
    excluirMetaController,
    prorrogarMetaController,
} from "./src/controllers/metas/metas.js";
import {
    listarCustomizacoesController,
    getCustomizacaoController,
    criarCustomizacaoController,
    atualizarCustomizacaoController,
    excluirCustomizacaoController,
} from "./src/controllers/customizacao/customizacao.js";
import {
    listarCategoriasCustomizacaoController,
    getCategoriaCustomizacaoController,
    criarCategoriaCustomizacaoController,
    atualizarCategoriaCustomizacaoController,
    excluirCategoriaCustomizacaoController,
} from "./src/controllers/categoria_customizacao/categoria_customizacao.js";
import {
    listarCategoriasMovimentacaoController,
    getCategoriaMovimentacaoController,
    criarCategoriaMovimentacaoController,
    atualizarCategoriaMovimentacaoController,
    excluirCategoriaMovimentacaoController,
} from "./src/controllers/categoria_movimentacao/categoria_movimentacao.js";
import {
    listarTransacoesRecorrentesController,
    getTransacaoRecorrenteController,
    criarTransacaoRecorrenteController,
    atualizarTransacaoRecorrenteController,
    excluirTransacaoRecorrenteController,
} from "./src/controllers/transacoes_recorrentes/transacoes_recorrentes.js";
import { getTemaController } from "./src/controllers/public/tema.js";
import { listarFontesController } from "./src/controllers/public/fontes.js";

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "src/views")));

// ─── Página inicial ───────────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "src/views/index.html"));
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post("/api/login", loginController);
app.post("/api/login/telefone", loginPorTelefoneController);
app.get("/api/tema", getTemaController);
app.get("/api/fontes", listarFontesController);

// ─── Usuários ─────────────────────────────────────────────────────────────────
// Admin: listar todos, criar, remover, buscar por email
app.get("/api/usuarios", requireAuth, requireAdmin, listarUsuariosController);
app.get("/api/usuarios/select", requireAuth, requireAdmin, listarUsuariosSelectController);
app.post("/api/usuarios", requireAuth, requireAdmin, criarUsuarioController);
app.delete("/api/usuarios/:id", requireAuth, requireAdmin, deletarUsuarioController);
app.get("/api/usuarios/email/:email", requireAuth, requireAdmin, getUsuarioPorEmailController);
app.post("/api/usuarios/:id/redefinir-senha", requireAuth, requireAdmin, redefinirSenhaUsuarioController);
app.post("/api/usuarios/:id/pagamentos", requireAuth, requireAdmin, criarPagamentoParaUsuarioController);

// Auth: ver/editar (admin faz tudo; usuário comum só edita a si mesmo)
app.get("/api/usuarios/:id", requireAuth, async (req, res, next) => {
    const isAdmin = req.user.permissao_id === Number(process.env.ADMIN_PERMISSION_ID ?? 1);
    const isSelf = Number(req.params.id) === Number(req.user.sub);
    if (!isAdmin && !isSelf) {
        return res.status(403).json({ success: false, message: "Acesso negado" });
    }
    return next();
}, getUsuarioController);

app.put("/api/usuarios/:id", requireAuth, async (req, res, next) => {
    const isAdmin = req.user.permissao_id === Number(process.env.ADMIN_PERMISSION_ID ?? 1);
    const isSelf = Number(req.params.id) === Number(req.user.sub);
    if (!isAdmin && !isSelf) {
        return res.status(403).json({ success: false, message: "Acesso negado" });
    }
    return next();
}, atualizarUsuarioController);

app.post("/api/usuarios/:id/alterar-senha", requireAuth, async (req, res, next) => {
    const isAdmin = req.user.permissao_id === Number(process.env.ADMIN_PERMISSION_ID ?? 1);
    const isSelf = Number(req.params.id) === Number(req.user.sub);
    if (!isAdmin && !isSelf) {
        return res.status(403).json({ success: false, message: "Acesso negado" });
    }
    return next();
}, alterarSenhaUsuarioController);

app.post("/api/usuarios/:id/foto", requireAuth, async (req, res, next) => {
    const isAdmin = req.user.permissao_id === Number(process.env.ADMIN_PERMISSION_ID ?? 1);
    const isSelf = Number(req.params.id) === Number(req.user.sub);
    if (!isAdmin && !isSelf) {
        return res.status(403).json({ success: false, message: "Acesso negado" });
    }
    return next();
}, uploadUserPhotoMiddleware, salvarFotoUsuarioController);

// ─── Permissões (admin only) ──────────────────────────────────────────────────
app.get("/api/permissoes", requireAuth, requireAdmin, listarPermissoesController);
app.post("/api/permissoes", requireAuth, requireAdmin, criarPermissaoController);
app.get("/api/permissoes/:id", requireAuth, requireAdmin, getPermissaoController);
app.put("/api/permissoes/:id", requireAuth, requireAdmin, atualizarPermissaoController);
app.delete("/api/permissoes/:id", requireAuth, requireAdmin, excluirPermissaoController);

// ─── Pagamentos (admin only) ──────────────────────────────────────────────────
app.get("/api/pagamentos", requireAuth, requireAdmin, listarPagamentosController);
app.post("/api/pagamentos", requireAuth, requireAdmin, criarPagamentoController);
app.get("/api/pagamentos/:id", requireAuth, requireAdmin, getPagamentoController);
app.put("/api/pagamentos/:id", requireAuth, requireAdmin, atualizarPagamentoController);
app.delete("/api/pagamentos/:id", requireAuth, requireAdmin, excluirPagamentoController);

// ─── Interação (usuário autenticado) ──────────────────────────────────────────
app.get("/api/interacao/permissao", requireAuth, validarPermissaoInteracaoController);

// ─── Transações (own records) ─────────────────────────────────────────────────
app.get("/api/transacoes", requireAuth, checkTransacoesRecorrentes, listarTransacoesController);
app.get("/api/transacoes/categorias-movimentacao", requireAuth, listarCategoriasMovimentacaoParaTransacoesController);
app.get("/api/dashboard/resumo", requireAuth, resumoDashboardTransacoesController);
app.get("/api/relatorio/movimentacao", requireAuth, relatorioMovimentacaoController);
app.post("/api/transacoes", requireAuth, criarTransacaoController);
app.get("/api/transacoes/:id", requireAuth, getTransacaoController);
app.put("/api/transacoes/:id", requireAuth, atualizarTransacaoController);
app.delete("/api/transacoes/:id", requireAuth, excluirTransacaoController);

// ─── Metas (own records) ──────────────────────────────────────────────────────
app.get("/api/metas", requireAuth, listarMetasController);
app.get("/api/metas/categorias-movimentacao", requireAuth, listarCategoriasMovimentacaoParaMetasController);
app.get("/api/metas/notificacoes", requireAuth, listarNotificacoesMetasController);
app.post("/api/metas", requireAuth, criarMetaController);
app.get("/api/metas/:id", requireAuth, getMetaController);
app.put("/api/metas/:id", requireAuth, atualizarMetaController);
app.patch("/api/metas/:id/prorrogar", requireAuth, prorrogarMetaController);
app.delete("/api/metas/:id", requireAuth, excluirMetaController);

// ─── Customizações (own records) ──────────────────────────────────────────────
// ─── Customizações (admin only) ──────────────────────────────────────────────
app.get("/api/customizacoes", requireAuth, requireAdmin, listarCustomizacoesController);
app.post("/api/customizacoes", requireAuth, requireAdmin, uploadFotoMiddleware, criarCustomizacaoController);
app.get("/api/customizacoes/:id", requireAuth, requireAdmin, getCustomizacaoController);
app.put("/api/customizacoes/:id", requireAuth, requireAdmin, uploadFotoMiddleware, atualizarCustomizacaoController);
app.delete("/api/customizacoes/:id", requireAuth, requireAdmin, excluirCustomizacaoController);

// ─── Categorias de Customização (own records) ─────────────────────────────────
// ─── Categorias de Customização (admin only) ──────────────────────────────────
app.get("/api/categorias-customizacao", requireAuth, requireAdmin, listarCategoriasCustomizacaoController);
app.post("/api/categorias-customizacao", requireAuth, requireAdmin, criarCategoriaCustomizacaoController);
app.get("/api/categorias-customizacao/:id", requireAuth, requireAdmin, getCategoriaCustomizacaoController);
app.put("/api/categorias-customizacao/:id", requireAuth, requireAdmin, atualizarCategoriaCustomizacaoController);
app.delete("/api/categorias-customizacao/:id", requireAuth, requireAdmin, excluirCategoriaCustomizacaoController);

// ─── Categorias de Movimentação (own records) ─────────────────────────────────
// ─── Categorias de Movimentação (admin only) ──────────────────────────────────
app.get("/api/categorias-movimentacao", requireAuth, requireAdmin, listarCategoriasMovimentacaoController);
app.post("/api/categorias-movimentacao", requireAuth, requireAdmin, criarCategoriaMovimentacaoController);
app.get("/api/categorias-movimentacao/:id", requireAuth, requireAdmin, getCategoriaMovimentacaoController);
app.put("/api/categorias-movimentacao/:id", requireAuth, requireAdmin, atualizarCategoriaMovimentacaoController);
app.delete("/api/categorias-movimentacao/:id", requireAuth, requireAdmin, excluirCategoriaMovimentacaoController);

// ─── Transações Recorrentes (own records) ────────────────────────────────────
app.get("/api/transacoes-recorrentes", requireAuth, listarTransacoesRecorrentesController);
app.post("/api/transacoes-recorrentes", requireAuth, criarTransacaoRecorrenteController);
app.get("/api/transacoes-recorrentes/:id", requireAuth, getTransacaoRecorrenteController);
app.put("/api/transacoes-recorrentes/:id", requireAuth, atualizarTransacaoRecorrenteController);
app.delete("/api/transacoes-recorrentes/:id", requireAuth, excluirTransacaoRecorrenteController);

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
