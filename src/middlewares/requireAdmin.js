import "dotenv/config";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;
const ADMIN_PERMISSION_ID = Number(process.env.ADMIN_PERMISSION_ID || 1);

export function requireAdmin(req, res, next) {
    if (!jwtSecret) {
        return res.status(500).json({ success: false, message: "JWT_SECRET não configurado" });
    }

    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Token não informado" });
    }

    const token = authorization.split(" ")[1];

    try {
        const payload = jwt.verify(token, jwtSecret);

        if (payload?.permissao_id !== ADMIN_PERMISSION_ID) {
            return res.status(403).json({ success: false, message: "Acesso negado: requer administrador" });
        }

        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Token inválido ou expirado" });
    }
}
