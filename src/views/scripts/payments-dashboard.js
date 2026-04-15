(() => {
    const PAGE_SIZE = 10;
    const VALID_TIPOS = new Set(["diario", "semanal", "quinzenal", "mensal", "bimestral", "trimestral", "semestral", "anual"]);
    const TIPOS_LABEL = {
        diario: "Diário",
        semanal: "Semanal",
        quinzenal: "Quinzenal",
        mensal: "Mensal",
        bimestral: "Bimestral",
        trimestral: "Trimestral",
        semestral: "Semestral",
        anual: "Anual",
    };

    const state = {
        pagamentos: [],
        filtrados: [],
        currentPage: 1,
        query: "",
        filters: {
            atraso: "todos",
            tipo: "",
            mes: "",
            ano: "",
            ordenacao: "mais_recente",
        },
        chart: null,
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatDate(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleDateString("pt-BR");
    }

    function formatMoney(value) {
        const n = Number(value ?? 0);
        if (!Number.isFinite(n)) return "R$ 0,00";
        return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function formatNumber(value) {
        const n = Number(value ?? 0);
        if (!Number.isFinite(n)) return "0";
        return n.toLocaleString("pt-BR");
    }

    function formatTipoLabel(tipo) {
        return TIPOS_LABEL[String(tipo ?? "").trim().toLowerCase()] || "Mensal";
    }

    function sameMonthYear(dateValue, baseDate) {
        const d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return false;
        return d.getMonth() === baseDate.getMonth() && d.getFullYear() === baseDate.getFullYear();
    }

    function parseMoneyInput(value) {
        const normalized = String(value ?? "")
            .replace(/R\$/gi, "")
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(/,/g, ".");
        return Number(normalized);
    }

    function formatMoneyMask(value) {
        const digits = String(value ?? "").replace(/\D/g, "");
        const cents = Number(digits || "0");
        const number = cents / 100;
        return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function toDateInputValue(dateValue) {
        const d = dateValue ? new Date(dateValue) : new Date();
        if (Number.isNaN(d.getTime())) return "";
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function applyTextFilter() {
        const q = state.query.trim().toLowerCase();
        if (!q) {
            state.filtrados = [...state.pagamentos];
            return;
        }

        state.filtrados = state.pagamentos.filter((item) => {
            const descricao = String(item.descricao ?? "").toLowerCase();
            const usuario = String(item.usuarios?.nome ?? "").toLowerCase();
            return descricao.includes(q) || usuario.includes(q);
        });
    }

    function getPageSlice() {
        const totalPages = Math.max(1, Math.ceil(state.filtrados.length / PAGE_SIZE));
        if (state.currentPage > totalPages) {
            state.currentPage = totalPages;
        }

        const start = (state.currentPage - 1) * PAGE_SIZE;
        return {
            rows: state.filtrados.slice(start, start + PAGE_SIZE),
            totalPages,
        };
    }

    function getPagamentoById(id) {
        return state.pagamentos.find((item) => Number(item.id) === Number(id));
    }

    function buildListParams() {
        const params = new URLSearchParams({
            ordenacao: state.filters.ordenacao || "mais_recente",
            filtro_atraso: state.filters.atraso || "todos",
        });

        const tipo = String(state.filters.tipo ?? "").trim().toLowerCase();
        if (VALID_TIPOS.has(tipo)) {
            params.set("tipo_pagamento", tipo);
        }

        const mesNumero = Number(state.filters.mes);
        if (Number.isInteger(mesNumero) && mesNumero >= 1 && mesNumero <= 12) {
            params.set("mes_pagamento", String(mesNumero));
        }

        const anoNumero = Number(state.filters.ano);
        if (Number.isInteger(anoNumero) && anoNumero >= 2000) {
            params.set("ano_pagamento", String(anoNumero));
        }

        if (state.query) params.set("search", state.query);

        return params;
    }

    async function loadPagamentos() {
        const params = buildListParams();
        const data = await window.ajax(`/api/pagamentos?${params.toString()}`);
        state.pagamentos = Array.isArray(data?.pagamentos) ? data.pagamentos : [];
    }

    async function loadPagamentosForDashboard() {
        const data = await window.ajax("/api/pagamentos?ordenacao=mais_recente");
        return Array.isArray(data?.pagamentos) ? data.pagamentos : [];
    }

    function renderCrudTable() {
        const tbody = byId("paymentsTableBody");
        const pageInfo = byId("paymentsPageInfo");
        const prevBtn = byId("paymentsPrevPageBtn");
        const nextBtn = byId("paymentsNextPageBtn");
        if (!tbody || !pageInfo || !prevBtn || !nextBtn) return;

        const { rows, totalPages } = getPageSlice();

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Nenhum pagamento encontrado.</td></tr>';
        } else {
            tbody.innerHTML = rows
                .map((item) => `
                    <tr>
                        <td>${escapeHtml(item.descricao)}</td>
                        <td>${escapeHtml(item.usuarios?.nome ?? "-")}</td>
                        <td>${escapeHtml(item.tipo_pagamento ?? "-")}</td>
                        <td>${escapeHtml(formatMoney(item.valor))}</td>
                        <td>${escapeHtml(formatDate(item.data_pagamento))}</td>
                        <td>${escapeHtml(formatDate(item.data_vencimento))}</td>
                        <td class="col-actions">
                            <div class="actions-wrap">
                                <button type="button" class="action-btn action-btn--ghost" data-action="edit" data-id="${item.id}" title="Editar pagamento">
                                    <span class="action-btn__icon" aria-hidden="true">✎</span>
                                    <span class="action-btn__label">Editar</span>
                                </button>
                                <button type="button" class="action-btn action-btn--danger" data-action="delete" data-id="${item.id}" title="Excluir pagamento">
                                    <span class="action-btn__icon" aria-hidden="true">🗑</span>
                                    <span class="action-btn__label">Excluir</span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `)
                .join("");
        }

        pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
        prevBtn.disabled = state.currentPage <= 1;
        nextBtn.disabled = state.currentPage >= totalPages;

        document.querySelectorAll("#paymentsTableBody [data-action]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = Number(btn.dataset.id);
                const action = btn.dataset.action;
                if (action === "edit") {
                    await openEditPaymentSwal(id);
                }
                if (action === "delete") {
                    await confirmDeletePayment(id);
                }
            });
        });
    }

    function renderCrud() {
        applyTextFilter();
        renderCrudTable();
    }

    function initUserSelect2(selectId, selectedUser) {
        const element = byId(selectId);
        if (!window.jQuery || !window.jQuery.fn?.select2 || !element) return;

        const $element = window.jQuery(element);
        $element.select2({
            width: "100%",
            dropdownParent: window.jQuery(".swal2-container"),
            placeholder: "Selecione um usuário",
            allowClear: false,
            minimumInputLength: 0,
            ajax: {
                transport: async (params, success, failure) => {
                    try {
                        const term = params.data?.term || "";
                        const page = params.data?.page || 1;
                        const payload = await window.ajax(`/api/usuarios/select?query=${encodeURIComponent(term)}&page=${page}&pageSize=10`);
                        success({
                            items: payload?.items || [],
                            pagination: payload?.pagination || { hasMore: false },
                        });
                    } catch (error) {
                        failure(error);
                    }
                },
                processResults: (data, params) => {
                    params.page = params.page || 1;
                    return {
                        results: Array.isArray(data?.items) ? data.items : [],
                        pagination: {
                            more: Boolean(data?.pagination?.hasMore),
                        },
                    };
                },
            },
            language: {
                noResults: () => "Nenhum usuário encontrado",
                searching: () => "Pesquisando...",
                inputTooShort: () => "Digite para pesquisar",
            },
        });

        if (selectedUser?.id) {
            const option = new Option(`${selectedUser.nome} (${selectedUser.email ?? ""})`, String(selectedUser.id), true, true);
            $element.append(option).trigger("change");
        }
    }

    async function openCreatePaymentSwal() {
        const result = await window.SwalFire({
            title: "Adicionar pagamento",
            html: `
                <div class="swal-form-grid">
                    <input id="swal-payment-descricao" class="swal2-input" placeholder="Descrição" autocomplete="off">
                    <input id="swal-payment-valor" class="swal2-input" placeholder="Valor" type="text" inputmode="decimal" value="R$ 10,00">
                    <input id="swal-payment-data" class="swal2-input" type="date" value="${toDateInputValue(new Date())}">
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
                    <select id="swal-payment-user" class="swal2-select"></select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            didOpen: () => {
                const valorInput = byId("swal-payment-valor");
                if (valorInput) {
                    valorInput.value = formatMoneyMask(valorInput.value);
                    valorInput.addEventListener("input", () => {
                        valorInput.value = formatMoneyMask(valorInput.value);
                    });
                }

                const tipoSelect = byId("swal-payment-tipo");
                if (window.jQuery && tipoSelect) {
                    window.jQuery(tipoSelect).select2({
                        width: "100%",
                        dropdownParent: window.jQuery(".swal2-container"),
                        minimumResultsForSearch: 0,
                    });
                }

                initUserSelect2("swal-payment-user");
            },
            preConfirm: () => {
                const descricao = byId("swal-payment-descricao")?.value?.trim();
                const valor = parseMoneyInput(byId("swal-payment-valor")?.value);
                const data_pagamento = byId("swal-payment-data")?.value;
                const tipo_pagamento = byId("swal-payment-tipo")?.value;
                const usuario_id = Number(byId("swal-payment-user")?.value);

                if (!descricao || descricao.length < 2) {
                    Swal.showValidationMessage("Informe uma descrição válida");
                    return null;
                }
                if (!Number.isFinite(valor) || valor <= 0) {
                    Swal.showValidationMessage("Informe um valor válido");
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
                if (!Number.isInteger(usuario_id) || usuario_id <= 0) {
                    Swal.showValidationMessage("Selecione um usuário");
                    return null;
                }

                return { descricao, valor, data_pagamento, tipo_pagamento, usuario_id };
            },
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await window.ajax("/api/pagamentos", {
                method: "POST",
                body: JSON.stringify(result.value),
            });

            await loadPagamentos();
            renderCrud();
            await refreshDashboard();

            await window.SwalFire({
                icon: "success",
                title: "Pagamento criado",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao criar pagamento",
                text: error?.message || "Não foi possível criar o pagamento.",
            });
        }
    }

    async function openEditPaymentSwal(id) {
        const item = getPagamentoById(id);
        if (!item) return;

        const result = await window.SwalFire({
            title: "Editar pagamento",
            html: `
                <div class="swal-form-grid">
                    <input id="swal-payment-descricao" class="swal2-input" placeholder="Descrição" autocomplete="off" value="${escapeHtml(item.descricao)}">
                    <input id="swal-payment-valor" class="swal2-input" placeholder="Valor" type="text" inputmode="decimal" value="${escapeHtml(formatMoney(item.valor))}">
                    <input id="swal-payment-data" class="swal2-input" type="date" value="${toDateInputValue(item.data_pagamento)}">
                    <select id="swal-payment-tipo" class="swal2-select">
                        <option value="mensal" ${item.tipo_pagamento === "mensal" ? "selected" : ""}>Mensal</option>
                        <option value="semanal" ${item.tipo_pagamento === "semanal" ? "selected" : ""}>Semanal</option>
                        <option value="quinzenal" ${item.tipo_pagamento === "quinzenal" ? "selected" : ""}>Quinzenal</option>
                        <option value="bimestral" ${item.tipo_pagamento === "bimestral" ? "selected" : ""}>Bimestral</option>
                        <option value="trimestral" ${item.tipo_pagamento === "trimestral" ? "selected" : ""}>Trimestral</option>
                        <option value="semestral" ${item.tipo_pagamento === "semestral" ? "selected" : ""}>Semestral</option>
                        <option value="anual" ${item.tipo_pagamento === "anual" ? "selected" : ""}>Anual</option>
                        <option value="diario" ${item.tipo_pagamento === "diario" ? "selected" : ""}>Diário</option>
                    </select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            didOpen: () => {
                const valorInput = byId("swal-payment-valor");
                if (valorInput) {
                    valorInput.value = formatMoneyMask(valorInput.value);
                    valorInput.addEventListener("input", () => {
                        valorInput.value = formatMoneyMask(valorInput.value);
                    });
                }

                const tipoSelect = byId("swal-payment-tipo");
                if (window.jQuery && tipoSelect) {
                    window.jQuery(tipoSelect).select2({
                        width: "100%",
                        dropdownParent: window.jQuery(".swal2-container"),
                        minimumResultsForSearch: 0,
                    });
                }
            },
            preConfirm: () => {
                const descricao = byId("swal-payment-descricao")?.value?.trim();
                const valor = parseMoneyInput(byId("swal-payment-valor")?.value);
                const data_pagamento = byId("swal-payment-data")?.value;
                const tipo_pagamento = byId("swal-payment-tipo")?.value;

                if (!descricao || descricao.length < 2) {
                    Swal.showValidationMessage("Informe uma descrição válida");
                    return null;
                }
                if (!Number.isFinite(valor) || valor <= 0) {
                    Swal.showValidationMessage("Informe um valor válido");
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

                return { descricao, valor, data_pagamento, tipo_pagamento };
            },
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await window.ajax(`/api/pagamentos/${id}`, {
                method: "PUT",
                body: JSON.stringify(result.value),
            });

            await loadPagamentos();
            renderCrud();
            await refreshDashboard();

            await window.SwalFire({
                icon: "success",
                title: "Pagamento atualizado",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao atualizar pagamento",
                text: error?.message || "Não foi possível atualizar o pagamento.",
            });
        }
    }

    async function confirmDeletePayment(id) {
        const item = getPagamentoById(id);
        if (!item) return;

        const result = await window.SwalFire({
            icon: "warning",
            title: "Excluir pagamento",
            text: `Deseja excluir o pagamento ${item.descricao}?`,
            showCancelButton: true,
            confirmButtonText: "Excluir",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#dc2626",
        });

        if (!result.isConfirmed) return;

        try {
            await window.ajax(`/api/pagamentos/${id}`, { method: "DELETE" });
            await loadPagamentos();
            renderCrud();
            await refreshDashboard();

            await window.SwalFire({
                icon: "success",
                title: "Pagamento excluído",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao excluir pagamento",
                text: error?.message || "Não foi possível excluir o pagamento.",
            });
        }
    }

    function buildChartSeries(items, groupBy, yearFilter, metricMode) {
        const map = new Map();

        items.forEach((item) => {
            const d = new Date(item.data_pagamento);
            if (Number.isNaN(d.getTime())) return;

            if (groupBy === "mes" && yearFilter && d.getFullYear() !== yearFilter) {
                return;
            }

            const key = groupBy === "ano"
                ? String(d.getFullYear())
                : `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
            const current = map.get(key) || 0;
            map.set(key, current + (metricMode === "quantidade" ? 1 : Number(item.valor || 0)));
        });

        const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        return {
            labels: entries.map((e) => e[0]),
            values: entries.map((e) => e[1]),
        };
    }

    function renderDashboardMetrics(items) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const totalSubscriptionsEl = byId("paymentsTotalSubscriptionsValue");
        const selectedType = String(byId("paymentsSubscriptionTypeMetric")?.value || "mensal").trim().toLowerCase();
        const selectedTypeCount = items.filter((item) => String(item.tipo_pagamento ?? "").trim().toLowerCase() === selectedType).length;
        const subscriptionsByTypeEl = byId("paymentsSubscriptionsByTypeValue");
        const subscriptionsByTypeHintEl = byId("paymentsSubscriptionsByTypeHint");
        const currentMonthCountEl = byId("paymentsCurrentMonthCountValue");
        const currentMonthRevenueEl = byId("paymentsCurrentMonthRevenueValue");
        const currentMonthCountHintEl = byId("paymentsCurrentMonthCountHint");
        const currentMonthRevenueHintEl = byId("paymentsCurrentMonthRevenueHint");
        const overdueCountEl = byId("paymentsOverdueCountValue");
        const totalEl = byId("paymentsTotalValue");

        const totalSubscriptions = items.length;
        const currentMonthItems = items.filter((item) => sameMonthYear(item.data_pagamento, now));
        const currentMonthCount = currentMonthItems.length;
        const currentMonthRevenue = currentMonthItems.reduce((sum, item) => sum + Number(item.valor || 0), 0);
        const total = items.reduce((sum, item) => sum + Number(item.valor || 0), 0);
        const overdueCount = items.filter((item) => {
            const vencimento = new Date(item.data_vencimento);
            if (Number.isNaN(vencimento.getTime())) return false;
            vencimento.setHours(0, 0, 0, 0);
            return vencimento < now;
        }).length;

        if (totalSubscriptionsEl) totalSubscriptionsEl.textContent = formatNumber(totalSubscriptions);
        if (subscriptionsByTypeEl) subscriptionsByTypeEl.textContent = formatNumber(selectedTypeCount);
        if (subscriptionsByTypeHintEl) subscriptionsByTypeHintEl.textContent = `Assinaturas do tipo ${formatTipoLabel(selectedType).toLowerCase()}.`;
        if (currentMonthCountEl) currentMonthCountEl.textContent = formatNumber(currentMonthCount);
        if (currentMonthRevenueEl) currentMonthRevenueEl.textContent = formatMoney(currentMonthRevenue);
        if (currentMonthCountHintEl) currentMonthCountHintEl.textContent = `Pagamentos realizados em ${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.`;
        if (currentMonthRevenueHintEl) currentMonthRevenueHintEl.textContent = `Receita recebida em ${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.`;
        if (overdueCountEl) overdueCountEl.textContent = formatNumber(overdueCount);
        if (totalEl) totalEl.textContent = formatMoney(total);
    }

    async function refreshDashboard() {
        const dashboardItems = await loadPagamentosForDashboard();
        renderDashboardMetrics(dashboardItems);

        const groupBy = String(byId("paymentsChartGroupBy")?.value || "mes");
        const metricMode = String(byId("paymentsChartMetric")?.value || "valor");
        const yearRaw = byId("paymentsChartAno")?.value;
        const yearFilter = Number.isInteger(Number(yearRaw)) && Number(yearRaw) > 0 ? Number(yearRaw) : null;

        const { labels, values } = buildChartSeries(dashboardItems, groupBy, yearFilter, metricMode);

        const canvas = byId("paymentsChartCanvas");
        if (!canvas || !window.Chart) return;

        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }

        state.chart = new window.Chart(canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: metricMode === "quantidade" ? "Quantidade de pagamentos" : "Ganhos",
                        data: values,
                        backgroundColor: "rgba(79, 70, 229, 0.4)",
                        borderColor: "rgba(79, 70, 229, 1)",
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => (metricMode === "quantidade" ? formatNumber(value) : formatMoney(value)),
                        },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => (metricMode === "quantidade" ? `${formatNumber(ctx.parsed.y)} pagamento(s)` : formatMoney(ctx.parsed.y)),
                        },
                    },
                },
            },
        });
    }

    function bindTabs() {
        const tabCrud = byId("paymentsTabCrud");
        const tabDashboard = byId("paymentsTabDashboard");
        const panelCrud = byId("paymentsPanelCrud");
        const panelDashboard = byId("paymentsPanelDashboard");

        const activate = (key) => {
            const isCrud = key === "crud";
            tabCrud?.classList.toggle("is-active", isCrud);
            tabDashboard?.classList.toggle("is-active", !isCrud);
            tabCrud?.setAttribute("aria-selected", String(isCrud));
            tabDashboard?.setAttribute("aria-selected", String(!isCrud));

            if (panelCrud && panelDashboard) {
                panelCrud.hidden = !isCrud;
                panelDashboard.hidden = isCrud;
                panelCrud.classList.toggle("is-active", isCrud);
                panelDashboard.classList.toggle("is-active", !isCrud);
            }

            if (!isCrud) {
                refreshDashboard();
            }
        };

        tabCrud?.addEventListener("click", () => activate("crud"));
        tabDashboard?.addEventListener("click", () => activate("dashboard"));
    }

    function bindEvents() {
        const searchInput = byId("paymentsSearchInput");
        const prevBtn = byId("paymentsPrevPageBtn");
        const nextBtn = byId("paymentsNextPageBtn");
        const addBtn = byId("paymentsAddBtn");
        const applyFiltersBtn = byId("paymentsApplyFiltersBtn");
        const clearFiltersBtn = byId("paymentsClearFiltersBtn");
        const refreshDashboardBtn = byId("paymentsRefreshDashboardBtn");
        const clearDashboardFiltersBtn = byId("paymentsClearDashboardFiltersBtn");
        const chartMetric = byId("paymentsChartMetric");
        const chartGroupBy = byId("paymentsChartGroupBy");
        const chartYear = byId("paymentsChartAno");
        const subscriptionTypeMetric = byId("paymentsSubscriptionTypeMetric");

        searchInput?.addEventListener("input", () => {
            state.query = searchInput.value || "";
            state.currentPage = 1;
            renderCrud();
        });

        addBtn?.addEventListener("click", openCreatePaymentSwal);

        prevBtn?.addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage -= 1;
                renderCrud();
            }
        });

        nextBtn?.addEventListener("click", () => {
            const totalPages = Math.max(1, Math.ceil(state.filtrados.length / PAGE_SIZE));
            if (state.currentPage < totalPages) {
                state.currentPage += 1;
                renderCrud();
            }
        });

        applyFiltersBtn?.addEventListener("click", async () => {
            state.filters.atraso = String(byId("paymentsFilterAtraso")?.value ?? "todos");
            state.filters.tipo = String(byId("paymentsFilterTipo")?.value ?? "");
            state.filters.mes = String(byId("paymentsFilterMes")?.value ?? "");
            state.filters.ano = String(byId("paymentsFilterAno")?.value ?? "");
            state.filters.ordenacao = String(byId("paymentsSortBy")?.value ?? "mais_recente");

            await loadPagamentos();
            state.currentPage = 1;
            renderCrud();
        });

        clearFiltersBtn?.addEventListener("click", async () => {
            state.query = "";
            state.filters.atraso = "todos";
            state.filters.tipo = "";
            state.filters.mes = "";
            state.filters.ano = "";
            state.filters.ordenacao = "mais_recente";

            if (searchInput) searchInput.value = "";
            const atrasoFilter = byId("paymentsFilterAtraso");
            const tipoFilter = byId("paymentsFilterTipo");
            const mesFilter = byId("paymentsFilterMes");
            const anoFilter = byId("paymentsFilterAno");
            const sortBy = byId("paymentsSortBy");

            if (atrasoFilter) atrasoFilter.value = "todos";
            if (tipoFilter) tipoFilter.value = "";
            if (mesFilter) mesFilter.value = "";
            if (anoFilter) anoFilter.value = "";
            if (sortBy) sortBy.value = "mais_recente";

            await loadPagamentos();
            state.currentPage = 1;
            renderCrud();
        });

        refreshDashboardBtn?.addEventListener("click", refreshDashboard);

        clearDashboardFiltersBtn?.addEventListener("click", () => {
            if (chartMetric) chartMetric.value = "valor";
            if (chartGroupBy) chartGroupBy.value = "mes";
            if (chartYear) chartYear.value = "";
            if (subscriptionTypeMetric) subscriptionTypeMetric.value = "mensal";
            refreshDashboard();
        });

        chartMetric?.addEventListener("change", refreshDashboard);
        chartGroupBy?.addEventListener("change", refreshDashboard);
        chartYear?.addEventListener("input", refreshDashboard);
        subscriptionTypeMetric?.addEventListener("change", refreshDashboard);
    }

    async function initPaymentsDashboard() {
        const root = byId("paymentsDashboardRoot");
        if (!root) return;

        try {
            bindTabs();
            bindEvents();
            await loadPagamentos();
            state.currentPage = 1;
            state.query = "";
            renderCrud();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao carregar pagamentos",
                text: error?.message || "Não foi possível inicializar o dashboard de pagamentos.",
            });
        }
    }

    window.initPaymentsDashboard = initPaymentsDashboard;
})();
