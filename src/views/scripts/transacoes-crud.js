(() => {
    const PAGE_SIZE = 10;

    const state = {
        transacoes: [],
        filtradas: [],
        categorias: [],
        currentPage: 1,
        filters: {
            search: "",
            valor: "",
            categoriaId: "",
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
        if (valor) params.set("valor", valor);

        const categoriaId = Number(state.filters.categoriaId);
        if (Number.isInteger(categoriaId) && categoriaId > 0) {
            params.set("categoria_id", String(categoriaId));
        }

        const mes = Number(state.filters.mes);
        if (Number.isInteger(mes) && mes >= 1 && mes <= 12) {
            params.set("mes_movimentacao", String(mes));
        }

        const ano = Number(state.filters.ano);
        if (Number.isInteger(ano) && ano >= 2000) {
            params.set("ano_movimentacao", String(ano));
        }

        return params;
    }

    async function loadCategorias() {
        const data = await window.ajax("/api/transacoes/categorias-movimentacao");
        state.categorias = Array.isArray(data?.categorias) ? data.categorias : [];
    }

    async function loadTransacoes() {
        const params = buildListParams();
        const data = await window.ajax(`/api/transacoes?${params.toString()}`);
        state.transacoes = Array.isArray(data?.transacoes) ? data.transacoes : [];
    }

    function applyFilter() {
        state.filtradas = [...state.transacoes];

        const mes = Number(state.filters.mes);
        const ano = Number(state.filters.ano);
        const mesValido = Number.isInteger(mes) && mes >= 1 && mes <= 12;
        const anoValido = Number.isInteger(ano) && ano >= 2000;

        if (mesValido && !anoValido) {
            state.filtradas = state.filtradas.filter((transacao) => {
                const dateParts = getUtcMonthYear(transacao.data_movimentacao);
                return dateParts && dateParts.month === mes;
            });
        }
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

    function categoriaNome(transacao) {
        return transacao?.categoria_movimentacao?.nome || "-";
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
        const select = byId("transacoesCategoriaFilter");
        if (!select) return;

        const current = String(state.filters.categoriaId ?? "");
        select.innerHTML = `
            <option value="">Todas as categorias</option>
            ${buildCategoriasOptions(current)}
        `;
    }

    function getTransacaoById(id) {
        return state.transacoes.find((transacao) => Number(transacao.id) === Number(id));
    }

    function renderTable() {
        const tbody = byId("transacoesTableBody");
        const pageInfo = byId("transacoesPageInfo");
        const prevBtn = byId("transacoesPrevPageBtn");
        const nextBtn = byId("transacoesNextPageBtn");
        if (!tbody || !pageInfo || !prevBtn || !nextBtn) return;

        const { rows, totalPages } = getPageSlice();

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhuma transação encontrada.</td></tr>';
        } else {
            tbody.innerHTML = rows
                .map((transacao) => `
                    <tr>
                        <td>${escapeHtml(transacao.descricao)}</td>
                        <td>${escapeHtml(categoriaNome(transacao))}</td>
                        <td>${escapeHtml(formatMoney(transacao.valor))}</td>
                        <td>${escapeHtml(formatDate(transacao.data_movimentacao))}</td>
                        <td class="col-actions">
                            <div class="actions-wrap">
                                <button type="button" class="action-btn action-btn--ghost" data-action="edit" data-id="${transacao.id}" title="Editar transação">
                                    <span class="action-btn__icon" aria-hidden="true">✎</span>
                                    <span class="action-btn__label">Editar</span>
                                </button>
                                <button type="button" class="action-btn action-btn--ghost" data-action="view" data-id="${transacao.id}" title="Visualizar transação">
                                    <span class="action-btn__icon" aria-hidden="true">👁</span>
                                    <span class="action-btn__label">Visualizar</span>
                                </button>
                                <button type="button" class="action-btn action-btn--danger" data-action="delete" data-id="${transacao.id}" title="Excluir transação">
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

        document.querySelectorAll("#transacoesTableBody [data-action]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = Number(btn.dataset.id);
                const action = btn.dataset.action;
                if (action === "edit") {
                    await openEditTransacaoSwal(id);
                }
                if (action === "view") {
                    await openViewTransacaoSwal(id);
                }
                if (action === "delete") {
                    await confirmDeleteTransacao(id);
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

    function collectTransacaoFormValues() {
        const descricao = byId("swal-transacao-descricao")?.value?.trim();
        const valor = parseMoneyInput(byId("swal-transacao-valor")?.value);
        const categoria_id = Number(byId("swal-transacao-categoria")?.value);
        const data_movimentacao = byId("swal-transacao-data")?.value;

        if (!descricao || descricao.length < 2) {
            Swal.showValidationMessage("Informe uma descrição válida");
            return null;
        }
        if (!Number.isFinite(valor) || valor <= 0) {
            Swal.showValidationMessage("Informe um valor válido");
            return null;
        }
        if (!Number.isInteger(categoria_id) || categoria_id <= 0) {
            Swal.showValidationMessage("Selecione uma categoria");
            return null;
        }
        if (!data_movimentacao) {
            Swal.showValidationMessage("Informe a data da movimentação");
            return null;
        }

        return { descricao, valor, categoria_id, data_movimentacao };
    }

    async function openCreateTransacaoSwal() {
        const result = await window.SwalFire({
            title: "Adicionar transação",
            html: `
                <div class="swal-form-grid">
                    <input id="swal-transacao-descricao" class="swal2-input" placeholder="Descrição" autocomplete="off">
                    <input id="swal-transacao-valor" class="swal2-input" placeholder="Valor" type="text" inputmode="decimal" value="R$ 0,00">
                    <select id="swal-transacao-categoria" class="swal2-select">
                        <option value="">Selecione a categoria</option>
                        ${buildCategoriasOptions()}
                    </select>
                    <label for="swal-transacao-data">Data movimentação</label>
                    <input id="swal-transacao-data" class="swal2-input" type="date" value="${toDateInputValue(new Date())}">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            didOpen: () => {
                const valorInput = byId("swal-transacao-valor");
                if (valorInput) {
                    valorInput.value = formatMoneyMask(valorInput.value);
                    valorInput.addEventListener("input", () => {
                        valorInput.value = formatMoneyMask(valorInput.value);
                    });
                }
                initSelect2(byId("swal-transacao-categoria"));
            },
            preConfirm: collectTransacaoFormValues,
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await window.ajax("/api/transacoes", {
                method: "POST",
                body: JSON.stringify(result.value),
            });

            await loadTransacoes();
            state.currentPage = 1;
            renderCrud();

            await window.SwalFire({
                icon: "success",
                title: "Transação criada",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao criar transação",
                text: error?.message || "Não foi possível criar a transação.",
            });
        }
    }

    async function openEditTransacaoSwal(id) {
        const transacao = getTransacaoById(id);
        if (!transacao) return;

        const result = await window.SwalFire({
            title: "Editar transação",
            html: `
                <div class="swal-form-grid">
                    <input id="swal-transacao-descricao" class="swal2-input" placeholder="Descrição" autocomplete="off" value="${escapeHtml(transacao.descricao)}">
                    <input id="swal-transacao-valor" class="swal2-input" placeholder="Valor" type="text" inputmode="decimal" value="${escapeHtml(formatMoney(transacao.valor))}">
                    <select id="swal-transacao-categoria" class="swal2-select">
                        <option value="">Selecione a categoria</option>
                        ${buildCategoriasOptions(transacao.categoria_id)}
                    </select>
                    <label for="swal-transacao-data">Data movimentação</label>
                    <input id="swal-transacao-data" class="swal2-input" type="date" value="${toDateInputValue(transacao.data_movimentacao)}">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            didOpen: () => {
                const valorInput = byId("swal-transacao-valor");
                if (valorInput) {
                    valorInput.value = formatMoneyMask(valorInput.value);
                    valorInput.addEventListener("input", () => {
                        valorInput.value = formatMoneyMask(valorInput.value);
                    });
                }
                initSelect2(byId("swal-transacao-categoria"));
            },
            preConfirm: collectTransacaoFormValues,
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            await window.ajax(`/api/transacoes/${id}`, {
                method: "PUT",
                body: JSON.stringify(result.value),
            });

            await loadTransacoes();
            renderCrud();

            await window.SwalFire({
                icon: "success",
                title: "Transação atualizada",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao atualizar transação",
                text: error?.message || "Não foi possível atualizar a transação.",
            });
        }
    }

    async function openViewTransacaoSwal(id) {
        const transacao = getTransacaoById(id);
        if (!transacao) return;

        await window.SwalFire({
            title: "Detalhes da transação",
            html: `
                <div class="swal-form-grid">
                    <p><strong>Descrição:</strong> ${escapeHtml(transacao.descricao)}</p>
                    <p><strong>Categoria:</strong> ${escapeHtml(categoriaNome(transacao))}</p>
                    <p><strong>Valor:</strong> ${escapeHtml(formatMoney(transacao.valor))}</p>
                    <p><strong>Data movimentação:</strong> ${escapeHtml(formatDate(transacao.data_movimentacao))}</p>
                </div>
            `,
            confirmButtonText: "Fechar",
        });
    }

    async function confirmDeleteTransacao(id) {
        const transacao = getTransacaoById(id);
        if (!transacao) return;

        const result = await window.SwalFire({
            icon: "warning",
            title: "Excluir transação",
            text: `Deseja excluir a transação ${transacao.descricao}?`,
            showCancelButton: true,
            confirmButtonText: "Excluir",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#dc2626",
        });

        if (!result.isConfirmed) return;

        try {
            await window.ajax(`/api/transacoes/${id}`, { method: "DELETE" });
            await loadTransacoes();
            renderCrud();

            await window.SwalFire({
                icon: "success",
                title: "Transação excluída",
                timer: 1000,
                showConfirmButton: false,
            });
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao excluir transação",
                text: error?.message || "Não foi possível excluir a transação.",
            });
        }
    }

    function bindEvents() {
        const searchInput = byId("transacoesSearchInput");
        const valorFilterInput = byId("transacoesValorFilterInput");
        const categoriaFilter = byId("transacoesCategoriaFilter");
        const mesFilter = byId("transacoesMesFilter");
        const anoFilter = byId("transacoesAnoFilter");
        const applyFiltersBtn = byId("transacoesApplyFiltersBtn");
        const clearFiltersBtn = byId("transacoesClearFiltersBtn");
        const addBtn = byId("transacoesAddBtn");
        const prevBtn = byId("transacoesPrevPageBtn");
        const nextBtn = byId("transacoesNextPageBtn");

        valorFilterInput?.addEventListener("input", () => {
            valorFilterInput.value = formatMoneyMask(valorFilterInput.value);
        });

        addBtn?.addEventListener("click", openCreateTransacaoSwal);

        applyFiltersBtn?.addEventListener("click", async () => {
            state.filters.search = String(searchInput?.value ?? "").trim();
            state.filters.valor = String(valorFilterInput?.value ?? "").trim();
            state.filters.categoriaId = String(categoriaFilter?.value ?? "").trim();
            state.filters.mes = String(mesFilter?.value ?? "").trim();
            state.filters.ano = String(anoFilter?.value ?? "").trim();

            await loadTransacoes();
            state.currentPage = 1;
            renderCrud();
        });

        clearFiltersBtn?.addEventListener("click", async () => {
            state.filters.search = "";
            state.filters.valor = "";
            state.filters.categoriaId = "";
            state.filters.mes = "";
            state.filters.ano = "";

            if (searchInput) searchInput.value = "";
            if (valorFilterInput) valorFilterInput.value = "";
            if (categoriaFilter) categoriaFilter.value = "";
            if (mesFilter) mesFilter.value = "";
            if (anoFilter) anoFilter.value = "";

            await loadTransacoes();
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

    async function initTransacoesCrud() {
        const root = byId("transacoesCrudRoot");
        if (!root) return;

        try {
            await loadCategorias();
            renderCategoriaFilter();
            bindEvents();
            await loadTransacoes();
            state.currentPage = 1;
            renderCrud();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao carregar transações",
                text: error?.message || "Não foi possível inicializar o CRUD de transações.",
            });
        }
    }

    window.initTransacoesCrud = initTransacoesCrud;
})();
