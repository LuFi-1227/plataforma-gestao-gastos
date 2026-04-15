(() => {
    const PAGE_SIZE = 10;

    const state = {
        metas: [],
        filtradas: [],
        categorias: [],
        currentPage: 1,
        filters: {
            search: "",
            valor: "",
            categoriaId: "",
            andamento: "",
            mes: "",
            ano: "",
        },
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
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    }

    function toDateInputValue(value) {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return "";
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function getUtcMonthYear(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return {
            month: date.getUTCMonth() + 1,
            year: date.getUTCFullYear(),
        };
    }

    function formatMoney(value) {
        const number = Number(value ?? 0);
        if (!Number.isFinite(number)) return "R$ 0,00";
        return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

    function buildListParams() {
        const params = new URLSearchParams();

        const search = String(state.filters.search ?? "").trim();
        if (search) params.set("search", search);

        const valor = String(state.filters.valor ?? "").trim();
        if (valor) params.set("valor_meta", valor);

        const categoriaId = Number(state.filters.categoriaId);
        if (Number.isInteger(categoriaId) && categoriaId > 0) {
            params.set("categoria_movimentacao_id", String(categoriaId));
        }

        const andamento = String(state.filters.andamento ?? "").trim();
        if (andamento) {
            params.set("andamento", andamento);
        }

        const mes = Number(state.filters.mes);
        if (Number.isInteger(mes) && mes >= 1 && mes <= 12) {
            params.set("mes_meta", String(mes));
        }

        const ano = Number(state.filters.ano);
        if (Number.isInteger(ano) && ano >= 2000) {
            params.set("ano_meta", String(ano));
        }

        return params;
    }

    async function loadCategorias() {
        const data = await window.ajax("/api/metas/categorias-movimentacao");
        state.categorias = Array.isArray(data?.categorias) ? data.categorias : [];
    }

    async function loadMetas() {
        const params = buildListParams();
        const data = await window.ajax(`/api/metas?${params.toString()}`);
        state.metas = Array.isArray(data?.metas) ? data.metas : [];
        if (typeof window.refreshHeaderNotifications === "function") {
            window.refreshHeaderNotifications();
        }
    }

    function applyFilter() {
        state.filtradas = [...state.metas];

        const mes = Number(state.filters.mes);
        const ano = Number(state.filters.ano);
        const andamento = String(state.filters.andamento ?? "").trim();
        const mesValido = Number.isInteger(mes) && mes >= 1 && mes <= 12;
        const anoValido = Number.isInteger(ano) && ano >= 2000;

        if (mesValido && !anoValido) {
            state.filtradas = state.filtradas.filter((meta) => {
                const dateParts = getUtcMonthYear(meta.data_meta);
                return dateParts && dateParts.month === mes;
            });
        }

        if (andamento) {
            state.filtradas = state.filtradas.filter((meta) => String(meta.andamento ?? "") === andamento);
        }
    }

    function statusLabel(andamento) {
        if (andamento === "batida") return "Batida";
        if (andamento === "em_andamento") return "Em andamento";
        return "Não batida";
    }

    function statusClass(andamento) {
        if (andamento === "batida") return "status-badge status-badge--success";
        if (andamento === "em_andamento") return "status-badge status-badge--warning";
        return "status-badge status-badge--danger";
    }

    function getProgressoPercentual(meta) {
        const n = Number(meta?.progresso_percentual ?? 0);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(100, n));
    }

    function buildCircularProgressMarkup(percentual) {
        const radius = 56;
        const circumference = 2 * Math.PI * radius;
        const progressOffset = circumference - ((percentual / 100) * circumference);

        return `
            <div class="meta-progress-wrap">
                <svg class="meta-progress-circle" viewBox="0 0 140 140" aria-hidden="true">
                    <circle class="meta-progress-circle__track" cx="70" cy="70" r="${radius}"></circle>
                    <circle class="meta-progress-circle__value" cx="70" cy="70" r="${radius}" style="stroke-dasharray:${circumference};stroke-dashoffset:${progressOffset};"></circle>
                </svg>
                <div class="meta-progress-label">${percentual.toFixed(1)}%</div>
            </div>
        `;
    }

    function canPostpone(meta) {
        return String(meta?.andamento ?? "") === "nao_batida";
    }

    function getPageSlice() {
        const totalPages = Math.max(1, Math.ceil(state.filtradas.length / PAGE_SIZE));
        if (state.currentPage > totalPages) {
            state.currentPage = totalPages;
        }

        const start = (state.currentPage - 1) * PAGE_SIZE;
        return {
            rows: state.filtradas.slice(start, start + PAGE_SIZE),
            totalPages,
        };
    }

    function categoriaNome(meta) {
        return meta?.categoria_movimentacao?.nome || "-";
    }

    function buildCategoriasOptions(selectedId) {
        return state.categorias
            .map((categoria) => {
                const selected = Number(categoria.id) === Number(selectedId) ? "selected" : "";
                return `<option value="${categoria.id}" ${selected}>${escapeHtml(categoria.nome)}</option>`;
            })
            .join("");
    }

    function renderCategoriaFilter() {
        const select = byId("metasCategoriaFilter");
        if (!select) return;

        const current = String(state.filters.categoriaId ?? "");
        select.innerHTML = `
            <option value="">Todas as categorias</option>
            ${buildCategoriasOptions(current)}
        `;
    }

    function getMetaById(id) {
        return state.metas.find((meta) => Number(meta.id) === Number(id));
    }

    function renderTable() {
        const tbody = byId("metasTableBody");
        const pageInfo = byId("metasPageInfo");
        const prevBtn = byId("metasPrevPageBtn");
        const nextBtn = byId("metasNextPageBtn");
        if (!tbody || !pageInfo || !prevBtn || !nextBtn) return;

        const { rows, totalPages } = getPageSlice();

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhuma meta encontrada.</td></tr>';
        } else {
            tbody.innerHTML = rows
                .map((meta) => `
                    <tr>
                        <td>${escapeHtml(meta.descricao)}</td>
                        <td>${escapeHtml(categoriaNome(meta))}</td>
                        <td>${escapeHtml(formatMoney(meta.valor))}</td>
                        <td>${escapeHtml(formatDate(meta.data_meta))}</td>
                        <td><span class="${statusClass(meta.andamento)}">${escapeHtml(statusLabel(meta.andamento))}</span></td>
                        <td class="col-actions">
                            <div class="actions-wrap">
                                <button type="button" class="action-btn action-btn--ghost" data-action="edit" data-id="${meta.id}" title="Editar meta">
                                    <span class="action-btn__icon" aria-hidden="true">✎</span>
                                    <span class="action-btn__label">Editar</span>
                                </button>
                                <button type="button" class="action-btn action-btn--ghost" data-action="view" data-id="${meta.id}" title="Visualizar meta">
                                    <span class="action-btn__icon" aria-hidden="true">👁</span>
                                    <span class="action-btn__label">Visualizar</span>
                                </button>
                                ${canPostpone(meta)
        ? `
                                <button type="button" class="action-btn action-btn--ghost" data-action="postpone" data-id="${meta.id}" title="Prorrogar meta">
                                    <span class="action-btn__icon" aria-hidden="true">⏳</span>
                                    <span class="action-btn__label">Prorrogar</span>
                                </button>
                                `
        : ""}
                                <button type="button" class="action-btn action-btn--danger" data-action="delete" data-id="${meta.id}" title="Excluir meta">
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

        document.querySelectorAll("#metasTableBody [data-action]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = Number(btn.dataset.id);
                const action = btn.dataset.action;
                if (action === "edit") {
                    await openEditMetaSwal(id);
                }
                if (action === "view") {
                    await openViewMetaSwal(id);
                }
                if (action === "postpone") {
                    await openPostponeMetaSwal(id);
                }
                if (action === "delete") {
                    await confirmDeleteMeta(id);
                }
            });
        });
    }

    function renderCrud() {
        applyFilter();
        renderTable();
    }

    function initSelect2(el) {
        if (!window.jQuery || !window.jQuery.fn?.select2 || !el) return;
        window.jQuery(el).select2({
            width: "100%",
            dropdownParent: window.jQuery(".swal2-container"),
            placeholder: "Selecione uma categoria",
            allowClear: false,
            minimumResultsForSearch: 0,
            language: {
                noResults: () => "Nenhuma categoria encontrada",
                searching: () => "Pesquisando...",
            },
        });
    }

    function collectMetaFormValues() {
        const descricao = byId("swal-meta-descricao")?.value?.trim();
        const valor = parseMoneyInput(byId("swal-meta-valor")?.value);
        const categoria_movimentacao_id = Number(byId("swal-meta-categoria")?.value);
        const data_meta = byId("swal-meta-data")?.value;

        if (!descricao || descricao.length < 2) {
            Swal.showValidationMessage("Informe uma descrição válida");
            return null;
        }
        if (!Number.isFinite(valor) || valor <= 0) {
            Swal.showValidationMessage("Informe um valor válido");
            return null;
        }
        if (!Number.isInteger(categoria_movimentacao_id) || categoria_movimentacao_id <= 0) {
            Swal.showValidationMessage("Selecione uma categoria");
            return null;
        }
        if (!data_meta) {
            Swal.showValidationMessage("Informe até quando deseja atingir a meta");
            return null;
        }

        return { descricao, valor, categoria_movimentacao_id, data_meta };
    }

    async function openCreateMetaSwal() {
        const result = await window.SwalFire({
            title: "Adicionar meta",
            html: `
                <div class="swal-form-grid">
                    <input id="swal-meta-descricao" class="swal2-input" placeholder="Descrição" autocomplete="off">
                    <input id="swal-meta-valor" class="swal2-input" placeholder="Valor" type="text" inputmode="decimal" value="R$ 0,00">
                    <select id="swal-meta-categoria" class="swal2-select">
                        <option value="">Selecione a categoria</option>
                        ${buildCategoriasOptions()}
                    </select>
                    <label for="swal-meta-data">Atingir meta até</label>
                    <input id="swal-meta-data" class="swal2-input" type="date" value="${toDateInputValue(new Date())}">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            didOpen: () => {
                const valorInput = byId("swal-meta-valor");
                if (valorInput) {
                    valorInput.value = formatMoneyMask(valorInput.value);
                    valorInput.addEventListener("input", () => {
                        valorInput.value = formatMoneyMask(valorInput.value);
                    });
                }
                initSelect2(byId("swal-meta-categoria"));
            },
            preConfirm: collectMetaFormValues,
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await window.ajax("/api/metas", {
                method: "POST",
                body: JSON.stringify(result.value),
            });

            await loadMetas();
            state.currentPage = 1;
            renderCrud();

            await window.SwalFire({
                icon: "success",
                title: "Meta criada",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao criar meta",
                text: error?.message || "Não foi possível criar a meta.",
            });
        }
    }

    async function openEditMetaSwal(id) {
        const meta = getMetaById(id);
        if (!meta) return;

        const result = await window.SwalFire({
            title: "Editar meta",
            html: `
                <div class="swal-form-grid">
                    <input id="swal-meta-descricao" class="swal2-input" placeholder="Descrição" autocomplete="off" value="${escapeHtml(meta.descricao)}">
                    <input id="swal-meta-valor" class="swal2-input" placeholder="Valor" type="text" inputmode="decimal" value="${escapeHtml(formatMoney(meta.valor))}">
                    <select id="swal-meta-categoria" class="swal2-select">
                        <option value="">Selecione a categoria</option>
                        ${buildCategoriasOptions(meta.categoria_movimentacao_id)}
                    </select>
                    <label for="swal-meta-data">Atingir meta até</label>
                    <input id="swal-meta-data" class="swal2-input" type="date" value="${toDateInputValue(meta.data_meta)}">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            didOpen: () => {
                const valorInput = byId("swal-meta-valor");
                if (valorInput) {
                    valorInput.value = formatMoneyMask(valorInput.value);
                    valorInput.addEventListener("input", () => {
                        valorInput.value = formatMoneyMask(valorInput.value);
                    });
                }
                initSelect2(byId("swal-meta-categoria"));
            },
            preConfirm: collectMetaFormValues,
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await window.ajax(`/api/metas/${id}`, {
                method: "PUT",
                body: JSON.stringify(result.value),
            });

            await loadMetas();
            renderCrud();

            await window.SwalFire({
                icon: "success",
                title: "Meta atualizada",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao atualizar meta",
                text: error?.message || "Não foi possível atualizar a meta.",
            });
        }
    }

    async function openViewMetaSwal(id) {
        const meta = getMetaById(id);
        if (!meta) return;

        const percentual = getProgressoPercentual(meta);
        const valorAcumulado = Number(meta.valor_acumulado ?? 0);
        const valorMeta = Number(meta.valor ?? 0);
        const falta = Math.max(0, valorMeta - valorAcumulado);

        await window.SwalFire({
            title: "Detalhes da meta",
            html: `
                <div class="meta-view-card">
                    <div class="meta-view-top">
                        ${buildCircularProgressMarkup(percentual)}
                        <div class="meta-view-main-info">
                            <h3 class="meta-view-title">${escapeHtml(meta.descricao)}</h3>
                            <span class="${statusClass(meta.andamento)}">${escapeHtml(statusLabel(meta.andamento))}</span>
                            <p class="meta-view-muted">Categoria: ${escapeHtml(categoriaNome(meta))}</p>
                            <p class="meta-view-muted">Atingir meta até: ${escapeHtml(formatDate(meta.data_meta))}</p>
                        </div>
                    </div>
                    <div class="meta-view-grid">
                        <article class="meta-view-metric">
                            <span>Valor da meta</span>
                            <strong>${escapeHtml(formatMoney(valorMeta))}</strong>
                        </article>
                        <article class="meta-view-metric">
                            <span>Acumulado</span>
                            <strong>${escapeHtml(formatMoney(valorAcumulado))}</strong>
                        </article>
                        <article class="meta-view-metric">
                            <span>Faltam</span>
                            <strong>${escapeHtml(formatMoney(falta))}</strong>
                        </article>
                    </div>
                </div>
            `,
            confirmButtonText: "Fechar",
        });
    }

    async function openPostponeMetaSwal(id) {
        const meta = getMetaById(id);
        if (!meta) return;

        const result = await window.SwalFire({
            title: "Prorrogar meta",
            html: `
                <div class="swal-form-grid">
                    <p class="meta-view-muted">Meta: <strong>${escapeHtml(meta.descricao)}</strong></p>
                    <p class="meta-view-muted">Data atual: <strong>${escapeHtml(formatDate(meta.data_meta))}</strong></p>
                    <label for="swal-meta-prorrogar-data">Nova data limite</label>
                    <input id="swal-meta-prorrogar-data" class="swal2-input" type="date" value="${toDateInputValue(meta.data_meta)}">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Prorrogar",
            preConfirm: () => {
                const data_meta = byId("swal-meta-prorrogar-data")?.value;
                if (!data_meta) {
                    Swal.showValidationMessage("Informe a nova data limite");
                    return null;
                }
                return { data_meta };
            },
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await window.ajax(`/api/metas/${id}/prorrogar`, {
                method: "PATCH",
                body: JSON.stringify(result.value),
            });

            await loadMetas();
            renderCrud();

            await window.SwalFire({
                icon: "success",
                title: "Meta prorrogada",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao prorrogar meta",
                text: error?.message || "Não foi possível prorrogar a meta.",
            });
        }
    }

    async function confirmDeleteMeta(id) {
        const meta = getMetaById(id);
        if (!meta) return;

        const result = await window.SwalFire({
            icon: "warning",
            title: "Excluir meta",
            text: `Deseja excluir a meta ${meta.descricao}?`,
            showCancelButton: true,
            confirmButtonText: "Excluir",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#dc2626",
        });

        if (!result.isConfirmed) return;

        try {
            await window.ajax(`/api/metas/${id}`, { method: "DELETE" });
            await loadMetas();
            renderCrud();

            await window.SwalFire({
                icon: "success",
                title: "Meta excluída",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao excluir meta",
                text: error?.message || "Não foi possível excluir a meta.",
            });
        }
    }

    function bindEvents() {
        const searchInput = byId("metasSearchInput");
        const valorFilterInput = byId("metasValorFilterInput");
        const categoriaFilter = byId("metasCategoriaFilter");
        const andamentoFilter = byId("metasAndamentoFilter");
        const mesFilter = byId("metasMesFilter");
        const anoFilter = byId("metasAnoFilter");
        const applyFiltersBtn = byId("metasApplyFiltersBtn");
        const clearFiltersBtn = byId("metasClearFiltersBtn");
        const addBtn = byId("metasAddBtn");
        const prevBtn = byId("metasPrevPageBtn");
        const nextBtn = byId("metasNextPageBtn");

        valorFilterInput?.addEventListener("input", () => {
            valorFilterInput.value = formatMoneyMask(valorFilterInput.value);
        });

        addBtn?.addEventListener("click", openCreateMetaSwal);

        applyFiltersBtn?.addEventListener("click", async () => {
            state.filters.search = String(searchInput?.value ?? "").trim();
            state.filters.valor = String(valorFilterInput?.value ?? "").trim();
            state.filters.categoriaId = String(categoriaFilter?.value ?? "").trim();
            state.filters.andamento = String(andamentoFilter?.value ?? "").trim();
            state.filters.mes = String(mesFilter?.value ?? "").trim();
            state.filters.ano = String(anoFilter?.value ?? "").trim();

            await loadMetas();
            state.currentPage = 1;
            renderCrud();
        });

        clearFiltersBtn?.addEventListener("click", async () => {
            state.filters.search = "";
            state.filters.valor = "";
            state.filters.categoriaId = "";
            state.filters.andamento = "";
            state.filters.mes = "";
            state.filters.ano = "";

            if (searchInput) searchInput.value = "";
            if (valorFilterInput) valorFilterInput.value = "";
            if (categoriaFilter) categoriaFilter.value = "";
            if (andamentoFilter) andamentoFilter.value = "";
            if (mesFilter) mesFilter.value = "";
            if (anoFilter) anoFilter.value = "";

            await loadMetas();
            state.currentPage = 1;
            renderCrud();
        });

        prevBtn?.addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage -= 1;
                renderCrud();
            }
        });

        nextBtn?.addEventListener("click", () => {
            const totalPages = Math.max(1, Math.ceil(state.filtradas.length / PAGE_SIZE));
            if (state.currentPage < totalPages) {
                state.currentPage += 1;
                renderCrud();
            }
        });
    }

    async function initMetasCrud() {
        const root = byId("metasCrudRoot");
        if (!root) return;

        try {
            await loadCategorias();
            renderCategoriaFilter();
            bindEvents();
            await loadMetas();
            state.currentPage = 1;
            renderCrud();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao carregar metas",
                text: error?.message || "Não foi possível inicializar o CRUD de metas.",
            });
        }
    }

    window.initMetasCrud = initMetasCrud;
})();
