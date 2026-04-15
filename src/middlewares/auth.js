import "dotenv/config";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;

export function requireAuth(req, res, next) {
    if (!jwtSecret) {
        return res.status(500).json({ success: false, message: "JWT_SECRET não configurado" });
    }

    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Token não informado" });
    }

    const token = authorization.split(" ")[1];

    try {
        req.user = jwt.verify(token, jwtSecret);
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Token inválido ou expirado" });
    }
}
