import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { registrarAuditoria, validarUsuarioResponsavelId } from "../auditoria/auditoria.js";

const adapter = new PrismaPg(`${process.env.DATABASE_URL}`);

const prisma = new PrismaClient({adapter});
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1d";

function normalizarTelefone(telefone) {
    const digits = String(telefone ?? "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    return `55${digits}`;
}

function sanitizeUser(usuario) {
    if (!usuario) return null;
    const { senha, __reactivado, ...safeUser } = usuario;
    if (safeUser.user_photo) {
        safeUser.user_photo = {
            id: safeUser.user_photo.id,
            caminho: safeUser.user_photo.caminho,
            foto_url: safeUser.user_photo.caminho,
            status: safeUser.user_photo.status,
            created_at: safeUser.user_photo.created_at,
            updated_at: safeUser.user_photo.updated_at,
        };
    }
    return safeUser;
}

function mapPrismaError(error, fallbackMessage) {
    if (error?.code === "P2002") {
        return { success: false, message: "Email já cadastrado" };
    }

    return { success: false, message: fallbackMessage };
}

async function login(email, senha){
    try {
        if (!jwtSecret) {
            return { success: false, message: "JWT_SECRET não configurado" };
        }

        const usuario = await prisma.usuarios.findFirst({
            where: { email, status: 1 },
        });

        if (!usuario) {
            return { success: false, message: "Email não encontrado" };
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return { success: false, message: "Senha incorreta" };
        }

        const token = jwt.sign(
            {
                sub: usuario.id,
                email: usuario.email,
                permissao_id: usuario.permissao_id,
            },
            jwtSecret,
            { expiresIn: jwtExpiresIn },
        );

        return { success: true, message: "Login bem-sucedido", token};
    } catch (error) {
        console.error("Erro ao realizar login:", error);
        return mapPrismaError(error, "Erro ao realizar login");
    }
}

async function loginPorTelefone(telefone) {
    try {
        if (!jwtSecret) {
            return { success: false, message: "JWT_SECRET não configurado" };
        }

        const telefoneNormalizado = normalizarTelefone(telefone);
        if (!/^55\d{2}\d{8,9}$/.test(telefoneNormalizado)) {
            return { success: false, message: "Telefone inválido. Use o padrão 5563999999999" };
        }

        const usuario = await prisma.usuarios.findFirst({
            where: { telefone: telefoneNormalizado, status: 1 },
        });

        if (!usuario) {
            return { success: false, message: "Telefone não encontrado" };
        }

        const token = jwt.sign(
            {
                sub: usuario.id,
                email: usuario.email,
                permissao_id: usuario.permissao_id,
            },
            jwtSecret,
            { expiresIn: jwtExpiresIn },
        );

        return {
            success: true,
            message: "Autenticação por telefone realizada com sucesso",
            token,
            registro_id: usuario.id,
            usuario_id: usuario.id,
        };
    } catch (error) {
        console.error("Erro ao autenticar por telefone:", error);
        return mapPrismaError(error, "Erro ao autenticar por telefone");
    }
}

async function createUser(nome, email, telefone, senha, permissao=2, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const hash = await bcrypt.hash(senha, 10);
        const telefoneNormalizado = normalizarTelefone(telefone);
        const usuario = await prisma.$transaction(async (tx) => {
            const usuarioExistente = await tx.usuarios.findUnique({
                where: { email },
            });

            if (usuarioExistente?.status === 1) {
                throw { code: "P2002" };
            }

            if (usuarioExistente?.status === 0) {
                const usuarioReativado = await tx.usuarios.update({
                    where: { id: usuarioExistente.id },
                    data: {
                        nome,
                        email,
                        telefone: telefoneNormalizado,
                        senha: hash,
                        status: 1,
                        permissoes: {
                            connect: { id: permissao },
                        },
                    },
                });

                await registrarAuditoria(tx, {
                    tabelaNome: "usuarios",
                    registroId: usuarioReativado.id,
                    operacao: "UPDATE",
                    dadosAntes: sanitizeUser(usuarioExistente),
                    dadosDepois: sanitizeUser(usuarioReativado),
                    usuarioResponsavelId: usuarioId,
                });

                return {
                    ...usuarioReativado,
                    __reactivado: true,
                };
            }

            const novoUsuario = await tx.usuarios.create({
                data: {
                    nome,
                    email,
                    telefone: telefoneNormalizado,
                    senha: hash,
                    permissoes: {
                        connect: { id: permissao },
                    },
                },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "usuarios",
                registroId: novoUsuario.id,
                operacao: "CREATE",
                dadosDepois: sanitizeUser(novoUsuario),
                usuarioResponsavelId: usuarioId,
            });

            return novoUsuario;
        });

        return {
            success: true,
            message: usuario.__reactivado ? "Usuário reativado com sucesso" : "Usuário criado com sucesso",
            reactivated: Boolean(usuario.__reactivado),
            usuario: sanitizeUser(usuario),
        };
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        return mapPrismaError(error, "Erro ao criar usuário");
    }
}

async function getUserByEmail(email, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const usuario = await prisma.$transaction(async (tx) => {
            const usuarioEncontrado = await tx.usuarios.findFirst({
                where: { email, status: 1 },
                include: { user_photo: true },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "usuarios",
                registroId: usuarioEncontrado?.id ?? null,
                operacao: "READ",
                dadosDepois: usuarioEncontrado ? sanitizeUser(usuarioEncontrado) : { email },
                usuarioResponsavelId: usuarioId,
            });

            return usuarioEncontrado;
        });

        if (!usuario) {
            return { success: false, message: "Usuário não encontrado" };
        }
        return { success: true, usuario: sanitizeUser(usuario) };
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        return mapPrismaError(error, "Erro ao buscar usuário");
    }
}

async function getUserById(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const usuario = await prisma.$transaction(async (tx) => {
            const usuarioEncontrado = await tx.usuarios.findFirst({
                where: { id, status: 1 },
                include: { user_photo: true },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "usuarios",
                registroId: id,
                operacao: "READ",
                dadosDepois: usuarioEncontrado ? sanitizeUser(usuarioEncontrado) : null,
                usuarioResponsavelId: usuarioId,
            });

            return usuarioEncontrado;
        });

        if (!usuario) {
            return { success: false, message: "Usuário não encontrado" };
        }
        return { success: true, usuario: sanitizeUser(usuario) };
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        return mapPrismaError(error, "Erro ao buscar usuário");
    }
}

async function getAllUsers(usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const usuarios = await prisma.$transaction(async (tx) => {
            const usuariosAtivos = await tx.usuarios.findMany({
                where: { status: 1 },
                include: { user_photo: true },
                orderBy: { nome: "asc" },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "usuarios",
                operacao: "LIST",
                dadosDepois: { total: usuariosAtivos.length },
                usuarioResponsavelId: usuarioId,
            });

            return usuariosAtivos;
        });

        return { success: true, usuarios: usuarios.map(sanitizeUser) };
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        return mapPrismaError(error, "Erro ao listar usuários");
    }
}

async function updateUser(id, nome, email, telefone, senha, permissao, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const telefoneNormalizado = normalizarTelefone(telefone);
        const usuario = await prisma.$transaction(async (tx) => {
            const usuarioAntes = await tx.usuarios.findUnique({
                where: { id },
            });

            const data = {
                nome,
                email,
                telefone: telefoneNormalizado,
            };

            if (senha) {
                data.senha = await bcrypt.hash(senha, 10);
            }

            if (permissao !== undefined) {
                data.permissoes = {
                    connect: { id: permissao },
                };
            }

            const usuarioAtualizado = await tx.usuarios.update({
                where: { id },
                data,
            });

            await registrarAuditoria(tx, {
                tabelaNome: "usuarios",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: sanitizeUser(usuarioAntes),
                dadosDepois: sanitizeUser(usuarioAtualizado),
                usuarioResponsavelId: usuarioId,
            });

            return usuarioAtualizado;
        });

        return { success: true, message: "Usuário atualizado com sucesso", usuario: sanitizeUser(usuario) };
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        return mapPrismaError(error, "Erro ao atualizar usuário");
    }
}

async function deleteUser(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        await prisma.$transaction(async (tx) => {
            const usuarioAntes = await tx.usuarios.findUnique({
                where: { id },
            });

            const usuarioRemovido = await tx.usuarios.update({
                where: { id },
                data: { status: 0 },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "usuarios",
                registroId: id,
                operacao: "DELETE",
                dadosAntes: sanitizeUser(usuarioAntes),
                dadosDepois: sanitizeUser(usuarioRemovido),
                usuarioResponsavelId: usuarioId,
            });
        });

        return { success: true, message: "Usuário deletado com sucesso" };
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        return mapPrismaError(error, "Erro ao deletar usuário");
    }
}

async function resetUserPassword(id, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);
        const senhaTemporaria = crypto.randomBytes(8).toString("base64url");
        const hash = await bcrypt.hash(senhaTemporaria, 10);

        const usuario = await prisma.$transaction(async (tx) => {
            const usuarioAntes = await tx.usuarios.findUnique({
                where: { id },
            });

            const usuarioAtualizado = await tx.usuarios.update({
                where: { id },
                data: { senha: hash },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "usuarios",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: sanitizeUser(usuarioAntes),
                dadosDepois: sanitizeUser(usuarioAtualizado),
                usuarioResponsavelId: usuarioId,
            });

            return usuarioAtualizado;
        });

        return {
            success: true,
            message: "Senha redefinida com sucesso",
            usuario: sanitizeUser(usuario),
            novaSenha: senhaTemporaria,
        };
    } catch (error) {
        console.error("Erro ao redefinir senha do usuário:", error);
        return mapPrismaError(error, "Erro ao redefinir senha");
    }
}

async function changeUserPassword(id, senhaAtual, novaSenha, usuarioResponsavelId) {
    try {
        const usuarioId = validarUsuarioResponsavelId(usuarioResponsavelId);

        const usuario = await prisma.$transaction(async (tx) => {
            const usuarioAntes = await tx.usuarios.findUnique({
                where: { id },
            });

            if (!usuarioAntes || Number(usuarioAntes.status ?? 1) !== 1) {
                throw new Error("Usuário não encontrado");
            }

            const senhaValida = await bcrypt.compare(senhaAtual, usuarioAntes.senha);
            if (!senhaValida) {
                throw new Error("Senha atual incorreta");
            }

            const novoHash = await bcrypt.hash(novaSenha, 10);
            const usuarioAtualizado = await tx.usuarios.update({
                where: { id },
                data: {
                    senha: novoHash,
                    updated_at: new Date(),
                },
            });

            await registrarAuditoria(tx, {
                tabelaNome: "usuarios",
                registroId: id,
                operacao: "UPDATE",
                dadosAntes: sanitizeUser(usuarioAntes),
                dadosDepois: sanitizeUser(usuarioAtualizado),
                usuarioResponsavelId: usuarioId,
            });

            return usuarioAtualizado;
        });

        return {
            success: true,
            message: "Senha alterada com sucesso",
            usuario: sanitizeUser(usuario),
        };
    } catch (error) {
        console.error("Erro ao alterar senha do usuário:", error);
        return mapPrismaError(error, error?.message || "Erro ao alterar senha");
    }
}

export { login, loginPorTelefone, createUser, getUserByEmail, getUserById, getAllUsers, updateUser, deleteUser, resetUserPassword, changeUserPassword };