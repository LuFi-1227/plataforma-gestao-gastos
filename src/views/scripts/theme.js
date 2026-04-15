async function carregarTema() {
    try {
        const response = await fetch("/api/tema", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return;
        }

        const result = await response.json();
        if (!result?.success) {
            return;
        }

        const root = document.documentElement;
        const idVariables = result.data?.idVariables ?? {};
        const valueVariables = result.data?.valueVariables ?? {};

        for (const [name, value] of Object.entries(idVariables)) {
            root.style.setProperty(name, String(value));
        }

        for (const [name, value] of Object.entries(valueVariables)) {
            root.style.setProperty(name, String(value));
        }
    } catch {
        // fallback para variáveis default do CSS
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", carregarTema);
} else {
    carregarTema();
}
