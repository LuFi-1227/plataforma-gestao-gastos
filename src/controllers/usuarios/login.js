import {login, loginPorTelefone} from "../../models/usuarios/user.js";

export async function loginController(req, res) {
    const { email, senha, password } = req.body;
    const senhaFinal = senha ?? password;
    if (!email || !senhaFinal) {
        return res.status(400).json({ success: false, message: "Email e senha são obrigatórios" });
    }
    const result = await login(email, senhaFinal);
    if (result.success) {
        return res.json(result);
    } else {
        return res.status(401).json(result);
    }
}

export async function loginPorTelefoneController(req, res) {
    const { telefone, phone } = req.body;
    const telefoneFinal = telefone ?? phone;

    if (!telefoneFinal) {
        return res.status(400).json({ success: false, message: "Telefone é obrigatório" });
    }

    const result = await loginPorTelefone(telefoneFinal);
    if (result.success) {
        return res.json(result);
    }

    return res.status(401).json(result);
}