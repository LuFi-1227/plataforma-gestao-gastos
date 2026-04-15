import { saveUserPhoto } from "../../models/usuarios/user_photo.js";

export async function salvarFotoUsuarioController(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: "ID inválido" });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: "Selecione uma foto" });
    }

    const result = await saveUserPhoto(id, req.file, Number(req.user.sub));
    if (!result.success) {
        return res.status(400).json(result);
    }

    return res.json(result);
}
