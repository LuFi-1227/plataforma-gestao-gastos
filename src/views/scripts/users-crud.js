(() => {
    const PAGE_SIZE = 8;

    const state = {
        users: [],
        filteredUsers: [],
        permissions: [],
        marketingEnabled: false,
        defaultPaymentValue: 10,
        currentPage: 1,
        query: "",
    };

    function normalizarTexto(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .replace(/\s+/g, "_")
            .trim();
    }

    function isMobile() {
        return window.matchMedia("(max-width: 640px)").matches;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function formatarValorBRL(valorNumero) {
        const numero = Number(valorNumero);
        if (!Number.isFinite(numero)) return "R$ 10,00";
        return `R$ ${numero.toFixed(2).replace(".", ",")}`;
    }

    function aplicarMascaraBRL(valorRaw) {
        const digits = String(valorRaw ?? "").replace(/\D/g, "");
        const cents = Number(digits || "0");
        const numero = cents / 100;
        return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function parseValorMoedaInput(valorRaw) {
        const normalizado = String(valorRaw ?? "")
            .replace(/R\$/gi, "")
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(/,/g, ".");
        return Number(normalizado);
    }

    function getHojeYYYYMMDD() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function applyFilter() {
        const query = state.query.trim().toLowerCase();
        if (!query) {
            state.filteredUsers = [...state.users];
            return;
        }

        state.filteredUsers = state.users.filter((user) => {
            const nome = String(user.nome ?? "").toLowerCase();
            const email = String(user.email ?? "").toLowerCase();
            const telefone = String(user.telefone ?? "").toLowerCase();
            return nome.includes(query) || email.includes(query) || telefone.includes(query);
        });
    }

    function normalizePhoneInput(value) {
        const digits = String(value ?? "").replace(/\D/g, "");
        if (!digits) return "";
        const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
        return withCountryCode.slice(0, 13);
    }

    function isValidPhone(value) {
        return /^55\d{2}\d{8,9}$/.test(String(value ?? ""));
    }

    function getPageSlice() {
        const totalPages = Math.max(1, Math.ceil(state.filteredUsers.length / PAGE_SIZE));
        if (state.currentPage > totalPages) {
            state.currentPage = totalPages;
        }

        const start = (state.currentPage - 1) * PAGE_SIZE;
        return {
            rows: state.filteredUsers.slice(start, start + PAGE_SIZE),
            totalPages,
        };
    }

    function renderTable() {
        const tbody = byId("usuariosTableBody");
        const pageInfo = byId("usuariosPageInfo");
        const prevBtn = byId("usuariosPrevPageBtn");
        const nextBtn = byId("usuariosNextPageBtn");
        if (!tbody || !pageInfo || !prevBtn || !nextBtn) return;

        const { rows, totalPages } = getPageSlice();

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhum usuário encontrado.</td></tr>';
        } else {
            tbody.innerHTML = rows
                .map(
                    (user) => `
                        <tr>
                            <td>${escapeHtml(user.nome)}</td>
                            <td class="col-email">${escapeHtml(user.email)}</td>
                            <td>${escapeHtml(user.telefone ?? "-")}</td>
                            <td class="col-actions">
                                <div class="actions-wrap">
                                    <button
                                        type="button"
                                        class="action-btn action-btn--ghost"
                                        data-action="edit"
                                        data-id="${user.id}"
                                        title="Editar usuário"
                                    >
                                        <span class="action-btn__icon" aria-hidden="true">✎</span>
                                        <span class="action-btn__label">Editar</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="action-btn action-btn--ghost"
                                        data-action="reset-password"
                                        data-id="${user.id}"
                                        title="Redefinir senha"
                                    >
                                        <span class="action-btn__icon" aria-hidden="true">🔐</span>
                                        <span class="action-btn__label">Redefinir senha</span>
                                    </button>
                                    ${state.marketingEnabled ? `
                                        <button
                                            type="button"
                                            class="action-btn action-btn--ghost"
                                            data-action="register-payment"
                                            data-id="${user.id}"
                                            title="Registrar pagamento"
                                        >
                                            <span class="action-btn__icon" aria-hidden="true">💳</span>
                                            <span class="action-btn__label">Registrar pagamento</span>
                                        </button>
                                    ` : ""}
                                    <button
                                        type="button"
                                        class="action-btn action-btn--danger"
                                        data-action="delete"
                                        data-id="${user.id}"
                                        title="Excluir usuário"
                                    >
                                        <span class="action-btn__icon" aria-hidden="true">🗑</span>
                                        <span class="action-btn__label">Excluir</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `,
                )
                .join("");
        }

        pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
        prevBtn.disabled = state.currentPage <= 1;
        nextBtn.disabled = state.currentPage >= totalPages;

        document.querySelectorAll("#usuariosTableBody [data-action]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const userId = Number(btn.dataset.id);
                const action = btn.dataset.action;
                if (action === "edit") {
                    await openEditUserSwal(userId);
                }
                if (action === "reset-password") {
                    await resetUserPassword(userId);
                }
                if (action === "register-payment") {
                    await registerPaymentForUser(userId);
                }
                if (action === "delete") {
                    await confirmDeleteUser(userId);
                }
            });
        });
    }

    function renderCrud() {
        applyFilter();
        renderTable();
    }

    async function loadPermissions() {
        const data = await window.ajax("/api/permissoes");
        state.permissions = Array.isArray(data?.permissoes) ? data.permissoes : [];
    }

    async function loadUsers() {
        const data = await window.ajax("/api/usuarios");
        state.users = Array.isArray(data?.usuarios)
            ? data.usuarios.map((user) => ({ id: user.id, nome: user.nome, email: user.email, telefone: user.telefone, permissao_id: user.permissao_id }))
            : [];
    }

    async function loadMarketingMode() {
        const data = await window.ajax("/api/customizacoes");
        const customizacoes = Array.isArray(data?.customizacoes) ? data.customizacoes : [];

        state.marketingEnabled = customizacoes.some((item) => {
            const categoriaNome = normalizarTexto(item?.categoria_nome ?? item?.categoria_customizacao?.nome);
            const tipoValor = normalizarTexto(item?.tipo_valor);
            const valor = normalizarTexto(item?.valor);
            return categoriaNome === "tipo_app" && tipoValor === "tipo_de_aplicacao" && valor === "uso_para_marketing";
        });

        const valorPadraoPagamento = customizacoes.find((item) => normalizarTexto(item?.categoria_nome) === "valor_pagamento_padrao");
        const valorNumero = parseValorMoedaInput(valorPadraoPagamento?.valor ?? 10);
        state.defaultPaymentValue = Number.isFinite(valorNumero) && valorNumero > 0 ? valorNumero : 10;

        const dashboardBtn = byId("usuariosPaymentsDashboardBtn");
        if (dashboardBtn) {
            dashboardBtn.hidden = !state.marketingEnabled;
        }
    }

    function buildPermissionsOptions(selectedId) {
        return state.permissions
            .map((permission) => {
                const selected = Number(selectedId) === Number(permission.id) ? "selected" : "";
                return `<option value="${permission.id}" ${selected}>${escapeHtml(permission.nome)}</option>`;
            })
            .join("");
    }

    function initSelect2(el) {
        if (!window.jQuery || !window.jQuery.fn?.select2 || !el) return;
        window.jQuery(el).select2({
            width: "100%",
            dropdownParent: window.jQuery(".swal2-container"),
            placeholder: "Selecione uma permissão",
            allowClear: false,
            minimumResultsForSearch: 0,
            language: {
                noResults: () => "Nenhuma permissão encontrada",
                searching: () => "Pesquisando...",
            },
        });
    }

    function getUserById(userId) {
        return state.users.find((user) => Number(user.id) === Number(userId));
    }

    function collectUserFormValues({ requirePassword = false } = {}) {
        const nome = byId("swal-user-nome")?.value?.trim();
        const email = byId("swal-user-email")?.value?.trim();
        const telefone = normalizePhoneInput(byId("swal-user-telefone")?.value?.trim());
        const senhaInput = byId("swal-user-senha");
        const senha = senhaInput?.value ?? "";
        const permissao = Number(byId("swal-user-permissao")?.value);

        if (!nome || nome.length < 2) {
            Swal.showValidationMessage("Informe um nome válido (mínimo 2 caracteres)");
            return null;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Swal.showValidationMessage("Informe um email válido");
            return null;
        }
        if (!telefone || !isValidPhone(telefone)) {
            Swal.showValidationMessage("Informe um telefone válido no padrão 5563999999999");
            return null;
        }
        if (requirePassword && (!senha || senha.length < 6)) {
            Swal.showValidationMessage("A senha deve ter no mínimo 6 caracteres");
            return null;
        }
        if (!Number.isInteger(permissao) || permissao <= 0) {
            Swal.showValidationMessage("Selecione uma permissão");
            return null;
        }

        const payload = { nome, email, telefone, permissao };
        if (requirePassword) {
            payload.senha = senha;
        }

        return payload;
    }

    async function createUserRequest(payload) {
        return window.ajax("/api/usuarios", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async function openCreateUserSwal() {
        let keepAdding = true;

        while (keepAdding) {
            const result = await window.SwalFire({
                title: "Adicionar usuário",
                html: `
                    <div class="swal-form-grid">
                        <input id="swal-user-nome" class="swal2-input" placeholder="Nome" autocomplete="off">
                        <input id="swal-user-email" class="swal2-input" placeholder="Email" type="email" autocomplete="off">
                        <input id="swal-user-telefone" class="swal2-input" placeholder="Telefone (5563999999999)" type="tel" inputmode="numeric" autocomplete="off">
                        <input id="swal-user-senha" class="swal2-input" placeholder="Senha" type="password" autocomplete="new-password">
                        <select id="swal-user-permissao" class="swal2-select">
                            ${buildPermissionsOptions(2)}
                        </select>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                showDenyButton: true,
                cancelButtonText: "Cancelar",
                confirmButtonText: "Salvar",
                denyButtonText: "Salvar e adicionar outro usuário",
                preConfirm: () => collectUserFormValues({ requirePassword: true }),
                preDeny: () => collectUserFormValues({ requirePassword: true }),
                didOpen: () => {
                    const telefoneInput = byId("swal-user-telefone");
                    telefoneInput?.addEventListener("input", () => {
                        telefoneInput.value = normalizePhoneInput(telefoneInput.value);
                    });
                    initSelect2(byId("swal-user-permissao"));
                },
            });

            if (result.isDismissed) {
                keepAdding = false;
                break;
            }

            const payload = result.value;
            if (!payload) {
                continue;
            }

            try {
                const response = await createUserRequest(payload);
                await loadUsers();
                renderCrud();

                if (result.isConfirmed) {
                    keepAdding = false;
                    await window.SwalFire({
                        icon: "success",
                        title: response?.reactivated ? "Usuário reativado" : "Usuário criado",
                        text: response?.message || undefined,
                        timer: 1100,
                        showConfirmButton: false,
                    });
                }
            } catch (error) {
                await window.SwalFire({
                    icon: "error",
                    title: "Erro ao criar",
                    text: error?.message || "Não foi possível criar o usuário.",
                });
                keepAdding = result.isDenied;
            }
        }
    }

    async function openEditUserSwal(userId) {
        const user = getUserById(userId);
        if (!user) return;

        const result = await window.SwalFire({
            title: "Editar usuário",
            html: `
                <div class="swal-form-grid">
                    <input id="swal-user-nome" class="swal2-input" placeholder="Nome" value="${escapeHtml(user.nome)}" autocomplete="off">
                    <input id="swal-user-email" class="swal2-input" placeholder="Email" type="email" value="${escapeHtml(user.email)}" autocomplete="off">
                        <input id="swal-user-telefone" class="swal2-input" placeholder="Telefone (5563999999999)" type="tel" inputmode="numeric" value="${escapeHtml(user.telefone ?? "")}" autocomplete="off">
                    <select id="swal-user-permissao" class="swal2-select">
                        ${buildPermissionsOptions(user.permissao_id)}
                    </select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            preConfirm: () => collectUserFormValues(),
            didOpen: () => {
                const telefoneInput = byId("swal-user-telefone");
                telefoneInput?.addEventListener("input", () => {
                    telefoneInput.value = normalizePhoneInput(telefoneInput.value);
                });
                initSelect2(byId("swal-user-permissao"));
            },
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            const payload = {
                nome: result.value.nome,
                email: result.value.email,
                telefone: result.value.telefone,
                permissao: result.value.permissao,
            };

            await window.ajax(`/api/usuarios/${userId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            await loadUsers();
            renderCrud();

            await window.SwalFire({
                icon: "success",
                title: "Usuário atualizado",
                timer: 1100,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao atualizar",
                text: error?.message || "Não foi possível atualizar o usuário.",
            });
        }
    }

    async function confirmDeleteUser(userId) {
        const user = getUserById(userId);
        if (!user) return;

        const result = await window.SwalFire({
            icon: "warning",
            title: "Excluir usuário",
            text: `Deseja realmente excluir ${user.nome}?`,
            showCancelButton: true,
            confirmButtonText: "Excluir",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#dc2626",
        });

        if (!result.isConfirmed) return;

        try {
            await window.ajax(`/api/usuarios/${userId}`, { method: "DELETE" });
            await loadUsers();
            renderCrud();
            await window.SwalFire({
                icon: "success",
                title: "Usuário excluído",
                text: "Soft-delete concluído com sucesso.",
                timer: 1200,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao excluir",
                text: error?.message || "Não foi possível excluir o usuário.",
            });
        }
    }

    async function resetUserPassword(userId) {
        const user = state.users.find(u => u.id === Number(userId));
        if (!user) return;

        const result = await window.SwalFire({
            icon: "warning",
            title: "Redefinir senha",
            text: `Deseja redefinir a senha de ${user.nome}?`,
            showCancelButton: true,
            confirmButtonText: "Redefinir",
            cancelButtonText: "Cancelar",
        });

        if (!result.isConfirmed) return;

        try {
            const response = await window.ajax(`/api/usuarios/${userId}/redefinir-senha`, {
                method: "POST",
            });

            const senhaGerada = response?.novaSenha;
            console.log("Nova senha gerada para usuário", user.email, ":", senhaGerada);

            await window.SwalFire({
                icon: "success",
                title: "Senha redefinida",
                text: "Nova senha gerada e registrada no console.",
                timer: 1400,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao redefinir senha",
                text: error?.message || "Não foi possível redefinir a senha.",
            });
        }
    }

    async function registerPaymentForUser(userId) {
        const user = getUserById(userId);
        if (!user) return;

        const defaultValorFormatado = formatarValorBRL(state.defaultPaymentValue);
        const hoje = getHojeYYYYMMDD();

        const result = await window.SwalFire({
            title: "Registrar pagamento",
            html: `
                <div class="swal-form-grid">
                    <input id="swal-payment-descricao" class="swal2-input" placeholder="Descrição" autocomplete="off">
                    <input id="swal-payment-data" class="swal2-input" type="date" value="${hoje}">
                    <select id="swal-payment-tipo" class="swal2-select">
                        <option value="mensal" selected>Mensal</option>
                        <option value="semanal">Semanal</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="bimestral">Bimestral</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="semestral">Semestral</option>
                        <option value="anual">Anual</option>
                        <option value="diario">Diário</option>
                    </select>
                    <input id="swal-payment-valor" class="swal2-input" placeholder="Valor" type="text" inputmode="decimal" value="${defaultValorFormatado}">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Registrar",
            didOpen: () => {
                const tipoSelect = byId("swal-payment-tipo");
                const valorInput = byId("swal-payment-valor");
                if (window.jQuery && tipoSelect) {
                    window.jQuery(tipoSelect).select2({
                        width: "100%",
                        dropdownParent: window.jQuery(".swal2-container"),
                        minimumResultsForSearch: 0,
                    });
                }

                if (valorInput) {
                    valorInput.value = aplicarMascaraBRL(valorInput.value);
                    valorInput.addEventListener("input", () => {
                        valorInput.value = aplicarMascaraBRL(valorInput.value);
                    });
                }
            },
            preConfirm: () => {
                const descricao = byId("swal-payment-descricao")?.value?.trim();
                const data_pagamento = byId("swal-payment-data")?.value;
                const tipo_pagamento = byId("swal-payment-tipo")?.value;
                const valorRaw = byId("swal-payment-valor")?.value;
                const valor = parseValorMoedaInput(valorRaw);

                if (!descricao || descricao.length < 2) {
                    Swal.showValidationMessage("Informe uma descrição válida");
                    return null;
                }
                if (!data_pagamento) {
                    Swal.showValidationMessage("Informe a data de pagamento");
                    return null;
                }
                if (!tipo_pagamento) {
                    Swal.showValidationMessage("Selecione o tipo de pagamento");
                    return null;
                }
                if (!Number.isFinite(valor) || valor <= 0) {
                    Swal.showValidationMessage("Informe um valor válido");
                    return null;
                }

                return { descricao, valor, data_pagamento, tipo_pagamento };
            },
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await window.ajax(`/api/usuarios/${userId}/pagamentos`, {
                method: "POST",
                body: JSON.stringify(result.value),
            });

            await window.SwalFire({
                icon: "success",
                title: "Pagamento registrado",
                text: `Pagamento registrado para ${user.nome}.`,
                timer: 1200,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao registrar pagamento",
                text: error?.message || "Não foi possível registrar o pagamento.",
            });
        }
    }

    function bindEvents() {
        const searchInput = byId("usuariosSearchInput");
        const clearFiltersBtn = byId("usuariosClearFiltersBtn");
        const addBtn = byId("usuariosAddBtn");
        const dashboardBtn = byId("usuariosPaymentsDashboardBtn");
        const prevBtn = byId("usuariosPrevPageBtn");
        const nextBtn = byId("usuariosNextPageBtn");

        searchInput?.addEventListener("input", () => {
            state.query = searchInput.value || "";
            state.currentPage = 1;
            renderCrud();
        });

        clearFiltersBtn?.addEventListener("click", () => {
            state.query = "";
            if (searchInput) searchInput.value = "";
            state.currentPage = 1;
            renderCrud();
        });

        addBtn?.addEventListener("click", openCreateUserSwal);

        dashboardBtn?.addEventListener("click", async () => {
            if (typeof window.appNavigate === "function") {
                await window.appNavigate("pagamentosDashboard");
                return;
            }
            window.location.hash = "#pagamentosDashboard";
        });

        prevBtn?.addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage -= 1;
                renderCrud();
            }
        });

        nextBtn?.addEventListener("click", () => {
            const totalPages = Math.max(1, Math.ceil(state.filteredUsers.length / PAGE_SIZE));
            if (state.currentPage < totalPages) {
                state.currentPage += 1;
                renderCrud();
            }
        });

        if (isMobile()) {
            document.documentElement.classList.add("is-mobile");
        } else {
            document.documentElement.classList.remove("is-mobile");
        }
    }

    async function initUsersCrud() {
        const root = byId("usuariosCrudRoot");
        if (!root) return;

        try {
            await Promise.all([loadPermissions(), loadUsers(), loadMarketingMode()]);
            state.currentPage = 1;
            state.query = "";
            bindEvents();
            renderCrud();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao carregar usuários",
                text: error?.message || "Não foi possível inicializar o CRUD de usuários.",
            });
        }
    }

    window.initUsersCrud = initUsersCrud;
})();
