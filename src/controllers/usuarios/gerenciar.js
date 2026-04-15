import {
    createUser,
    getAllUsers,
    getUserById,
    getUserByEmail,
    updateUser,
    deleteUser,
    resetUserPassword,
    changeUserPassword,
} from "../../models/usuarios/user.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONE_REGEX = /^55\d{2}\d{8,9}$/;

function normalizarTelefone(telefone) {
    const digits = String(telefone ?? "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    return `55${digits}`;
}

function validarCamposUsuario({ nome, email, telefone, senha }) {
    if (nome !== undefined) {
        if (typeof nome !== "string" || nome.trim().length < 2 || nome.trim().length > 100) {
            return "Nome deve ter entre 2 e 100 caracteres";
        }
    }
    if (email !== undefined) {
        if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
            return "Email inválido";
        }
    }
    if (telefone !== undefined) {
        const telefoneNormalizado = normalizarTelefone(telefone);
        if (!TELEFONE_REGEX.test(telefoneNormalizado)) {
            return "Telefone inválido. Use o padrão 5563999999999";
        }
    }
    if (senha !== undefined) {
        if (typeof senha !== "string" || senha.length < 6) {
            return "Senha deve ter no mínimo 6 caracteres";
        }
    }
    return null;
}

function normalizarSenhaOpcional(senha) {
    if (senha === undefined || senha === null) return undefined;
    if (typeof senha !== "string") return senha;

    const senhaLimpa = senha.trim();
    return senhaLimpa.length ? senhaLimpa : undefined;
}

function validarAlteracaoSenha({ senhaAtual, novaSenha, confirmacaoSenha }) {
    if (!senhaAtual || typeof senhaAtual !== "string") {
        return "Senha atual é obrigatória";
    }
    if (!novaSenha || typeof novaSenha !== "string" || novaSenha.length < 6) {
        return "A nova senha deve ter no mínimo 6 caracteres";
    }
    if (novaSenha !== confirmacaoSenha) {
        return "A confirmação da nova senha não confere";
    }
    if (senhaAtual === novaSenha) {
        return "A nova senha deve ser diferente da atual";
    }
    return null;
}

// GET /api/usuarios — admin lista todos
export async function listarUsuariosController(req, res) {
    const result = await getAllUsers(Number(req.user.sub));
    if (!result.success) return res.status(500).json(result);
    return res.json(result);
}

// GET /api/usuarios/select — admin listagem paginada/filtrada para selects
export async function listarUsuariosSelectController(req, res) {
    const result = await getAllUsers(Number(req.user.sub));
    if (!result.success) return res.status(500).json(result);

    const query = String(req.query.query ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize ?? 10) || 10));

    const users = Array.isArray(result.usuarios) ? result.usuarios : [];
    const filtrados = query
        ? users.filter((user) => {
            const nome = String(user.nome ?? "").toLowerCase();
            const email = String(user.email ?? "").toLowerCase();
            const telefone = String(user.telefone ?? "").toLowerCase();
            return nome.includes(query) || email.includes(query) || telefone.includes(query);
        })
        : users;

    const total = filtrados.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;

    const items = filtrados.slice(start, start + pageSize).map((user) => ({
        id: user.id,
        text: `${user.nome} (${user.email})`,
        nome: user.nome,
        email: user.email,
        telefone: user.telefone,
    }));

    return res.json({
        success: true,
        items,
        pagination: {
            page: currentPage,
            pageSize,
            total,
            totalPages,
            hasMore: currentPage < totalPages,
        },
    });
}

// GET /api/usuarios/:id — admin ou próprio usuário
export async function getUsuarioController(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: "ID inválido" });
    }
    const result = await getUserById(id, Number(req.user.sub));
    if (!result.success) return res.status(404).json(result);
    return res.json(result);
}

// POST /api/usuarios — admin cria usuário
export async function criarUsuarioController(req, res) {
    const { nome, email, telefone, senha, permissao } = req.body;
    if (!nome || !email || !telefone || !senha) {
        return res.status(400).json({ success: false, message: "nome, email, telefone e senha são obrigatórios" });
    }
    const telefoneNormalizado = normalizarTelefone(telefone);
    const erro = validarCamposUsuario({ nome, email, telefone: telefoneNormalizado, senha });
    if (erro) return res.status(400).json({ success: false, message: erro });

    const permissaoId = permissao !== undefined ? Number(permissao) : 2;
    if (!Number.isInteger(permissaoId) || permissaoId <= 0) {
        return res.status(400).json({ success: false, message: "permissao deve ser um inteiro positivo" });
    }
    const result = await createUser(nome.trim(), email.trim(), telefoneNormalizado, senha, permissaoId, Number(req.user.sub));
    if (!result.success) return res.status(409).json(result);
    return res.status(result.reactivated ? 200 : 201).json(result);
}

// PUT /api/usuarios/:id — admin edita qualquer; usuário edita apenas a si mesmo
export async function atualizarUsuarioController(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: "ID inválido" });
    }
    const { nome, email, telefone, permissao } = req.body;
    const senha = normalizarSenhaOpcional(req.body?.senha);
    if (!nome || !email || !telefone) {
        return res.status(400).json({ success: false, message: "nome, email e telefone são obrigatórios" });
    }
    const telefoneNormalizado = normalizarTelefone(telefone);
    const erro = validarCamposUsuario({ nome, email, telefone: telefoneNormalizado, senha });
    if (erro) return res.status(400).json({ success: false, message: erro });

    const permissaoId = permissao !== undefined ? Number(permissao) : undefined;
    if (permissaoId !== undefined && (!Number.isInteger(permissaoId) || permissaoId <= 0)) {
        return res.status(400).json({ success: false, message: "permissao deve ser um inteiro positivo" });
    }
    const result = await updateUser(id, nome.trim(), email.trim(), telefoneNormalizado, senha, permissaoId, Number(req.user.sub));
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
}

// DELETE /api/usuarios/:id — somente admin
export async function deletarUsuarioController(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: "ID inválido" });
    }
    const result = await deleteUser(id, Number(req.user.sub));
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
}

// POST /api/usuarios/:id/redefinir-senha — somente admin
export async function redefinirSenhaUsuarioController(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: "ID inválido" });
    }

    const result = await resetUserPassword(id, Number(req.user.sub));
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
}

// POST /api/usuarios/:id/alterar-senha — admin ou próprio usuário
export async function alterarSenhaUsuarioController(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: "ID inválido" });
    }

    const senhaAtual = String(req.body?.senhaAtual ?? "");
    const novaSenha = String(req.body?.novaSenha ?? "");
    const confirmacaoSenha = String(req.body?.confirmacaoSenha ?? "");

    const erro = validarAlteracaoSenha({ senhaAtual, novaSenha, confirmacaoSenha });
    if (erro) {
        return res.status(400).json({ success: false, message: erro });
    }

    const result = await changeUserPassword(id, senhaAtual, novaSenha, Number(req.user.sub));
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
}

// GET /api/usuarios/email/:email — admin
export async function getUsuarioPorEmailController(req, res) {
    const { email } = req.params;
    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: "Email inválido" });
    }
    const result = await getUserByEmail(email, Number(req.user.sub));
    if (!result.success) return res.status(404).json(result);
    return res.json(result);
}
