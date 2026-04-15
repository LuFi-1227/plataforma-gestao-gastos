import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
    const { senha, ...safeUser } = usuario;
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

async function createUser(nome, email, telefone, senha, permissao=2) {
    try {
        const hash = await bcrypt.hash(senha, 10);
        const usuario = await prisma.usuarios.create({
            data: {
                nome,
                email,
                telefone: normalizarTelefone(telefone),
                senha: hash,
                permissoes: {
                    connect: { id: permissao },
                },
            },
        });
        return { success: true, message: "Usuário criado com sucesso", usuario: sanitizeUser(usuario) };
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        return mapPrismaError(error, "Erro ao criar usuário");
    }
}

async function getUserByEmail(email) {
    try {
        const usuario = await prisma.usuarios.findFirst({
            where: { email, status: 1 },
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

async function getUserById(id) {
    try {
        const usuario = await prisma.usuarios.findFirst({
            where: { id, status: 1 },
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

async function updateUser(id, nome, email, telefone, senha, permissao) {
    try {
        const hash = await bcrypt.hash(senha, 10);
        const usuario = await prisma.usuarios.update({
            where: { id },
            data: {
                nome,
                email,
                telefone: normalizarTelefone(telefone),
                senha: hash,
                permissoes: {
                    connect: { id: permissao },
                },
            },
        });
        return { success: true, message: "Usuário atualizado com sucesso", usuario: sanitizeUser(usuario) };
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        return mapPrismaError(error, "Erro ao atualizar usuário");
    }
}

async function deleteUser(id) {
    try {
        await prisma.usuarios.update({
            where: { id },
            data: { status: 0 },
        });
        return { success: true, message: "Usuário deletado com sucesso" };
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        return mapPrismaError(error, "Erro ao deletar usuário");
    }
}

export { login, createUser, getUserByEmail, getUserById, updateUser, deleteUser };