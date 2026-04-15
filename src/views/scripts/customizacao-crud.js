(() => {
    const PAGE_SIZE = 8;

    const state = {
        customizacoes: [],
        filteredCustomizacoes: [],
        categorias: [],
        fontes: [],
        currentPage: 1,
        query: "",
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

    function isImagePath(value) {
        return typeof value === "string" && value.startsWith("/uploads/customizacao/");
    }

    function normalizarTexto(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .replace(/\s+/g, "_")
            .trim();
    }

    function isTipoAppCategoria(categoriaId) {
        const categoria = state.categorias.find((item) => Number(item.id) === Number(categoriaId));
        if (!categoria) return false;
        return normalizarTexto(categoria.nome) === "tipo_app";
    }

    function normalizarTipoAplicacaoValor(valor) {
        const normalizado = normalizarTexto(valor);
        if (normalizado === "uso_pessoal") return "uso_pessoal";
        if (normalizado === "uso_para_marketing") return "uso_para_marketing";
        return "uso_pessoal";
    }

    function detectarTipoValorPorCategoriaNome(nomeCategoria) {
        const nome = normalizarTexto(nomeCategoria);

        if (nome.includes("cor")) {
            return "cor";
        }

        if (nome.includes("tamanho") && nome.includes("fonte")) {
            return "tamanho_fonte";
        }

        if (nome.includes("fonte")) {
            return "fonte";
        }

        if (nome.includes("logo") || nome.includes("foto")) {
            return "foto";
        }

        return "texto";
    }

    function labelTipoAplicacao(valor) {
        return normalizarTipoAplicacaoValor(valor) === "uso_para_marketing" ? "Uso para marketing" : "Uso pessoal";
    }

    function renderValorCell(item) {
        if (item.tipo_valor === "foto" && isImagePath(item.valor)) {
            return `
                <div class="customizacao-valor-foto-wrap">
                    <img class="customizacao-valor-foto" src="${escapeHtml(item.valor)}" alt="Imagem de customização">
                    <span class="customizacao-valor-text">${escapeHtml(item.valor)}</span>
                </div>
            `;
        }

        if (item.tipo_valor === "cor") {
            return `
                <div class="customizacao-valor-cor-wrap">
                    <span class="customizacao-valor-cor" style="background:${escapeHtml(item.valor)}"></span>
                    <span class="customizacao-valor-text">${escapeHtml(item.valor)}</span>
                </div>
            `;
        }

        if (item.tipo_valor === "tipo_de_aplicacao") {
            return `<span class="customizacao-valor-text">${labelTipoAplicacao(item.valor)}</span>`;
        }

        return `<span class="customizacao-valor-text">${escapeHtml(item.valor)}</span>`;
    }

    function applyFilter() {
        const query = state.query.trim().toLowerCase();
        if (!query) {
            state.filteredCustomizacoes = [...state.customizacoes];
            return;
        }

        state.filteredCustomizacoes = state.customizacoes.filter((item) => {
            const categoria = String(item.categoria_nome ?? "").toLowerCase();
            const valor = String(item.valor ?? "").toLowerCase();
            return categoria.includes(query) || valor.includes(query);
        });
    }

    function getPageSlice() {
        const totalPages = Math.max(1, Math.ceil(state.filteredCustomizacoes.length / PAGE_SIZE));
        if (state.currentPage > totalPages) {
            state.currentPage = totalPages;
        }

        const start = (state.currentPage - 1) * PAGE_SIZE;
        return {
            rows: state.filteredCustomizacoes.slice(start, start + PAGE_SIZE),
            totalPages,
        };
    }

    function getCustomizacaoById(id) {
        return state.customizacoes.find((item) => Number(item.id) === Number(id));
    }

    function getDefaultValueByCategory(categoriaId) {
        const categoriaIdNum = Number(categoriaId);
        const existente = state.customizacoes.find((item) => Number(item.categoria_id) === categoriaIdNum);
        return existente?.valor ?? "";
    }

    function buildCategoriasOptions(selectedId) {
        return state.categorias
            .map((categoria) => {
                const selected = Number(selectedId) === Number(categoria.id) ? "selected" : "";
                return `<option value="${categoria.id}" ${selected}>${escapeHtml(categoria.nome)}</option>`;
            })
            .join("");
    }

    function initSelect2(el, placeholder) {
        if (!window.jQuery || !window.jQuery.fn?.select2 || !el) return;
        window.jQuery(el).select2({
            width: "100%",
            dropdownParent: window.jQuery(".swal2-container"),
            placeholder,
            allowClear: false,
            minimumResultsForSearch: 0,
            language: {
                noResults: () => "Nenhum resultado encontrado",
                searching: () => "Pesquisando...",
            },
        });
    }

    function renderTipoValorField(tipo, valorAtual = "") {
        const container = byId("swal-customizacao-valor-wrapper");
        if (!container) return;

        if (tipo === "foto") {
            container.innerHTML = `
                <input id="swal-customizacao-valor-foto" class="swal2-file" type="file" accept="image/*">
                ${valorAtual && isImagePath(valorAtual)
        ? `<div class="swal-customizacao-foto-atual">Atual: ${escapeHtml(valorAtual)}</div>`
        : ""}
            `;
            return;
        }

        if (tipo === "cor") {
            const valor = valorAtual || "#4f46e5";
            container.innerHTML = `
                <div class="swal-color-picker-wrap">
                    <input id="swal-customizacao-valor-text" class="swal2-input swal2-input--color" type="color" value="${escapeHtml(valor)}">
                    <span id="swal-customizacao-color-preview" class="swal-color-preview" style="background:${escapeHtml(valor)}"></span>
                </div>
            `;

            const colorInput = byId("swal-customizacao-valor-text");
            const colorPreview = byId("swal-customizacao-color-preview");
            colorInput?.addEventListener("input", () => {
                if (colorPreview) {
                    colorPreview.style.background = colorInput.value;
                }
            });
            return;
        }

        if (tipo === "data") {
            container.innerHTML = `<input id="swal-customizacao-valor-text" class="swal2-input" type="date" value="${escapeHtml(valorAtual)}">`;
            return;
        }

        if (tipo === "fonte") {
            const fontesDisponiveis = state.fontes.length ? state.fontes : ["Arial", "Verdana", "Tahoma"];
            const valorSelecionado = valorAtual || fontesDisponiveis[0];
            const options = fontesDisponiveis
                .map((fonte) => {
                    const selected = fonte === valorSelecionado ? "selected" : "";
                    return `<option value="${escapeHtml(fonte)}" ${selected}>${escapeHtml(fonte)}</option>`;
                })
                .join("");

            container.innerHTML = `<select id="swal-customizacao-valor-fonte" class="swal2-select">${options}</select>`;
            initSelect2(byId("swal-customizacao-valor-fonte"), "Selecione a fonte");
            return;
        }

        if (tipo === "tamanho_fonte") {
            const match = String(valorAtual || "").trim().match(/^(\d+(?:\.\d+)?)(px|em|rem|%|vw|vh|pt)$/i);
            const valorNumero = match?.[1] ?? "16";
            const valorUnidade = (match?.[2] ?? "px").toLowerCase();

            container.innerHTML = `
                <div class="swal-dual-inline">
                    <input id="swal-customizacao-size-number" class="swal2-input swal2-input--half" type="number" min="1" step="0.1" value="${escapeHtml(valorNumero)}" placeholder="Valor">
                    <select id="swal-customizacao-size-unit" class="swal2-select swal2-select--half">
                        <option value="px" ${valorUnidade === "px" ? "selected" : ""}>px</option>
                        <option value="em" ${valorUnidade === "em" ? "selected" : ""}>em</option>
                        <option value="rem" ${valorUnidade === "rem" ? "selected" : ""}>rem</option>
                        <option value="%" ${valorUnidade === "%" ? "selected" : ""}>%</option>
                        <option value="vw" ${valorUnidade === "vw" ? "selected" : ""}>vw</option>
                        <option value="vh" ${valorUnidade === "vh" ? "selected" : ""}>vh</option>
                        <option value="pt" ${valorUnidade === "pt" ? "selected" : ""}>pt</option>
                    </select>
                </div>
            `;
            initSelect2(byId("swal-customizacao-size-unit"), "Unidade");
            return;
        }

        if (tipo === "tipo_de_aplicacao") {
            const valorSelecionado = normalizarTipoAplicacaoValor(valorAtual);
            container.innerHTML = `
                <select id="swal-customizacao-valor-tipo-app" class="swal2-select">
                    <option value="uso_pessoal" ${valorSelecionado === "uso_pessoal" ? "selected" : ""}>Uso pessoal</option>
                    <option value="uso_para_marketing" ${valorSelecionado === "uso_para_marketing" ? "selected" : ""}>Uso para marketing</option>
                </select>
            `;
            initSelect2(byId("swal-customizacao-valor-tipo-app"), "Selecione o tipo de aplicação");
            return;
        }

        container.innerHTML = `<input id="swal-customizacao-valor-text" class="swal2-input" placeholder="Valor" type="text" value="${escapeHtml(valorAtual)}" autocomplete="off">`;
    }

    function getCurrentTipoValor() {
        return String(byId("swal-customizacao-tipo")?.value ?? "texto").toLowerCase();
    }

    function getCurrentCategoria() {
        return Number(byId("swal-customizacao-categoria")?.value);
    }

    function collectFormValues({ isEdit = false } = {}) {
        const categoria_id = getCurrentCategoria();
        const tipo_valor = getCurrentTipoValor();

        if (!Number.isInteger(categoria_id) || categoria_id <= 0) {
            Swal.showValidationMessage("Selecione uma categoria válida");
            return null;
        }

        if (!["texto", "foto", "cor", "data", "fonte", "tamanho_fonte", "tipo_de_aplicacao"].includes(tipo_valor)) {
            Swal.showValidationMessage("Selecione um tipo de valor válido");
            return null;
        }

        if (tipo_valor === "foto") {
            const fileInput = byId("swal-customizacao-valor-foto");
            const file = fileInput?.files?.[0] ?? null;

            if (!isEdit && !file) {
                Swal.showValidationMessage("Selecione uma foto");
                return null;
            }

            return { categoria_id, tipo_valor, file };
        }

        if (tipo_valor === "fonte") {
            const fonte = String(byId("swal-customizacao-valor-fonte")?.value ?? "").trim();
            if (!fonte) {
                Swal.showValidationMessage("Selecione uma fonte");
                return null;
            }
            return { categoria_id, tipo_valor, valor: fonte };
        }

        if (tipo_valor === "tamanho_fonte") {
            const numero = String(byId("swal-customizacao-size-number")?.value ?? "").replace(",", ".").trim();
            const unidade = String(byId("swal-customizacao-size-unit")?.value ?? "").trim();
            const valorComposto = `${numero}${unidade}`;

            if (!/^\d+(?:\.\d+)?(px|em|rem|%|vw|vh|pt)$/i.test(valorComposto)) {
                Swal.showValidationMessage("Informe tamanho válido (ex: 16px, 1.2em)");
                return null;
            }

            return { categoria_id, tipo_valor, valor: valorComposto };
        }

        if (tipo_valor === "tipo_de_aplicacao") {
            const tipoAplicacao = String(byId("swal-customizacao-valor-tipo-app")?.value ?? "").trim();
            if (!["uso_pessoal", "uso_para_marketing"].includes(tipoAplicacao)) {
                Swal.showValidationMessage("Selecione um tipo de aplicação válido");
                return null;
            }
            return { categoria_id, tipo_valor, valor: tipoAplicacao };
        }

        const valor = String(byId("swal-customizacao-valor-text")?.value ?? "").trim();
        if (!valor) {
            Swal.showValidationMessage("Informe um valor");
            return null;
        }

        if (tipo_valor === "cor" && !/^#[0-9A-Fa-f]{3,8}$/.test(valor)) {
            Swal.showValidationMessage("Informe uma cor válida em HEX");
            return null;
        }

        return { categoria_id, tipo_valor, valor };
    }

    async function requestWithFormData(url, method, payload) {
        const token = window.appAuth?.getToken?.();
        const formData = new FormData();
        formData.append("categoria_id", String(payload.categoria_id));
        formData.append("tipo_valor", payload.tipo_valor);

        if (payload.file) {
            formData.append("foto", payload.file);
        }
        if (payload.valor !== undefined) {
            formData.append("valor", String(payload.valor));
        }

        const response = await fetch(url, {
            method,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });

        const contentType = response.headers.get("content-type") || "";
        const body = contentType.includes("application/json") ? await response.json() : await response.text();

        if (!response.ok) {
            const message = body?.message || body?.error || "Erro na requisição";
            throw new Error(message);
        }

        return body;
    }

    async function loadCategorias() {
        const data = await window.ajax("/api/categorias-customizacao");
        state.categorias = Array.isArray(data?.categorias) ? data.categorias.filter((c) => Number(c.status ?? 1) === 1) : [];
    }

    async function loadFontes() {
        const data = await window.ajax("/api/fontes");
        state.fontes = Array.isArray(data?.fontes) ? data.fontes : [];
    }

    async function loadCustomizacoes() {
        const data = await window.ajax("/api/customizacoes");
        state.customizacoes = Array.isArray(data?.customizacoes) ? data.customizacoes : [];
    }

    function renderTable() {
        const tbody = byId("customizacaoTableBody");
        const pageInfo = byId("customizacaoPageInfo");
        const prevBtn = byId("customizacaoPrevPageBtn");
        const nextBtn = byId("customizacaoNextPageBtn");
        if (!tbody || !pageInfo || !prevBtn || !nextBtn) return;

        const { rows, totalPages } = getPageSlice();

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhuma customização encontrada.</td></tr>';
        } else {
            tbody.innerHTML = rows
                .map((item) => `
                    <tr>
                        <td>${escapeHtml(item.categoria_nome)}</td>
                        <td class="col-tipo">${escapeHtml(item.tipo_valor)}</td>
                        <td class="col-valor-display">${renderValorCell(item)}</td>
                        <td class="col-actions">
                            <div class="actions-wrap">
                                <button
                                    type="button"
                                    class="action-btn action-btn--ghost"
                                    data-action="edit"
                                    data-id="${item.id}"
                                    title="Editar customização"
                                >
                                    <span class="action-btn__icon" aria-hidden="true">✎</span>
                                    <span class="action-btn__label">Editar</span>
                                </button>
                                <button
                                    type="button"
                                    class="action-btn action-btn--danger"
                                    data-action="delete"
                                    data-id="${item.id}"
                                    title="Excluir customização"
                                >
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

        document.querySelectorAll("#customizacaoTableBody [data-action]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = Number(btn.dataset.id);
                const action = btn.dataset.action;
                if (action === "edit") {
                    await openEditSwal(id);
                }
                if (action === "delete") {
                    await confirmDelete(id);
                }
            });
        });
    }

    function renderCrud() {
        applyFilter();
        renderTable();
    }

    function setupDynamicForm(initial = {}) {
        const categoriaSelect = byId("swal-customizacao-categoria");
        const tipoSelect = byId("swal-customizacao-tipo");

        const currentTipo = String(initial.tipo_valor || "texto").toLowerCase();
        renderTipoValorField(currentTipo, initial.valor ?? "");

        const syncTipoPorCategoria = () => {
            const categoriaId = Number(categoriaSelect?.value);
            const tipoObrigatorio = isTipoAppCategoria(categoriaId);
            if (!tipoSelect) return;

            const categoria = state.categorias.find((item) => Number(item.id) === Number(categoriaId));
            const tipoDetectado = detectarTipoValorPorCategoriaNome(categoria?.nome ?? "");

            if (tipoObrigatorio) {
                tipoSelect.value = "tipo_de_aplicacao";
                tipoSelect.disabled = true;
                if (window.jQuery) {
                    window.jQuery(tipoSelect).val("tipo_de_aplicacao").trigger("change");
                }
            } else {
                tipoSelect.disabled = false;
                tipoSelect.value = tipoDetectado;
                if (window.jQuery) {
                    window.jQuery(tipoSelect).val(tipoDetectado).trigger("change");
                }
            }
        };

        const onCategoriaChange = () => {
            syncTipoPorCategoria();
            const tipoAtual = getCurrentTipoValor();
            if (tipoAtual === "foto" || tipoAtual === "tipo_de_aplicacao") return;
            const categoriaId = Number(categoriaSelect?.value);
            const defaultValue = getDefaultValueByCategory(categoriaId);
            const valorInput = byId("swal-customizacao-valor-text");
            if (valorInput && !valorInput.value) {
                valorInput.value = defaultValue;
            }
        };

        const onTipoChange = () => {
            const tipoSelecionado = String(tipoSelect?.value).toLowerCase();
            const categoriaId = Number(categoriaSelect?.value);
            const defaultValue = tipoSelecionado === "foto" ? "" : getDefaultValueByCategory(categoriaId);
            renderTipoValorField(tipoSelecionado, defaultValue);
        };

        categoriaSelect?.addEventListener("change", onCategoriaChange);
        tipoSelect?.addEventListener("change", onTipoChange);

        if (window.jQuery) {
            window.jQuery(categoriaSelect).on("change select2:select", onCategoriaChange);
            window.jQuery(tipoSelect).on("change select2:select", onTipoChange);
        }

        syncTipoPorCategoria();
    }

    async function openCreateSwal() {
        const categoriaPadrao = state.categorias[0]?.id ?? "";
        const valorPadrao = categoriaPadrao ? getDefaultValueByCategory(categoriaPadrao) : "";

        const result = await window.SwalFire({
            title: "Adicionar customização",
            html: `
                <div class="swal-form-grid">
                    <select id="swal-customizacao-categoria" class="swal2-select">
                        ${buildCategoriasOptions(categoriaPadrao)}
                    </select>
                    <select id="swal-customizacao-tipo" class="swal2-select">
                        <option value="texto" selected>Texto</option>
                        <option value="foto">Foto</option>
                        <option value="cor">Cor</option>
                        <option value="data">Data</option>
                        <option value="fonte">Fonte</option>
                        <option value="tamanho_fonte">Tamanho da fonte</option>
                        <option value="tipo_de_aplicacao">Tipo de aplicação</option>
                    </select>
                    <div id="swal-customizacao-valor-wrapper"></div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            preConfirm: () => collectFormValues({ isEdit: false }),
            didOpen: () => {
                initSelect2(byId("swal-customizacao-categoria"), "Selecione uma categoria");
                initSelect2(byId("swal-customizacao-tipo"), "Selecione o tipo");
                renderTipoValorField("texto", valorPadrao);
                setupDynamicForm({ tipo_valor: "texto", valor: valorPadrao });
            },
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            if (result.value.tipo_valor === "foto") {
                await requestWithFormData("/api/customizacoes", "POST", result.value);
            } else {
                await window.ajax("/api/customizacoes", {
                    method: "POST",
                    body: JSON.stringify(result.value),
                });
            }

            await window.SwalFire({
                icon: "success",
                title: "Customização criada",
                timer: 900,
                showConfirmButton: false,
            });
            window.location.reload();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao criar",
                text: error?.message || "Não foi possível criar a customização.",
            });
        }
    }

    async function openEditSwal(id) {
        const item = getCustomizacaoById(id);
        if (!item) return;

        const result = await window.SwalFire({
            title: "Editar customização",
            html: `
                <div class="swal-form-grid">
                    <select id="swal-customizacao-categoria" class="swal2-select">
                        ${buildCategoriasOptions(item.categoria_id)}
                    </select>
                    <select id="swal-customizacao-tipo" class="swal2-select">
                        <option value="texto" ${item.tipo_valor === "texto" ? "selected" : ""}>Texto</option>
                        <option value="foto" ${item.tipo_valor === "foto" ? "selected" : ""}>Foto</option>
                        <option value="cor" ${item.tipo_valor === "cor" ? "selected" : ""}>Cor</option>
                        <option value="data" ${item.tipo_valor === "data" ? "selected" : ""}>Data</option>
                        <option value="fonte" ${item.tipo_valor === "fonte" ? "selected" : ""}>Fonte</option>
                        <option value="tamanho_fonte" ${item.tipo_valor === "tamanho_fonte" ? "selected" : ""}>Tamanho da fonte</option>
                        <option value="tipo_de_aplicacao" ${item.tipo_valor === "tipo_de_aplicacao" ? "selected" : ""}>Tipo de aplicação</option>
                    </select>
                    <div id="swal-customizacao-valor-wrapper"></div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            confirmButtonText: "Salvar",
            preConfirm: () => collectFormValues({ isEdit: true }),
            didOpen: () => {
                initSelect2(byId("swal-customizacao-categoria"), "Selecione uma categoria");
                initSelect2(byId("swal-customizacao-tipo"), "Selecione o tipo");
                renderTipoValorField(item.tipo_valor, item.valor);
                setupDynamicForm(item);
            },
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            if (result.value.tipo_valor === "foto") {
                await requestWithFormData(`/api/customizacoes/${id}`, "PUT", result.value);
            } else {
                await window.ajax(`/api/customizacoes/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(result.value),
                });
            }

            await window.SwalFire({
                icon: "success",
                title: "Customização atualizada",
                timer: 900,
                showConfirmButton: false,
            });
            window.location.reload();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao atualizar",
                text: error?.message || "Não foi possível atualizar a customização.",
            });
        }
    }

    async function confirmDelete(id) {
        const item = getCustomizacaoById(id);
        if (!item) return;

        const result = await window.SwalFire({
            icon: "warning",
            title: "Excluir customização",
            text: `Deseja realmente excluir a customização de ${item.categoria_nome}?`,
            showCancelButton: true,
            confirmButtonText: "Excluir",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#dc2626",
        });

        if (!result.isConfirmed) return;

        try {
            await window.ajax(`/api/customizacoes/${id}`, { method: "DELETE" });
            await window.SwalFire({
                icon: "success",
                title: "Customização excluída",
                timer: 900,
                showConfirmButton: false,
            });
            window.location.reload();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao excluir",
                text: error?.message || "Não foi possível excluir a customização.",
            });
        }
    }

    function bindEvents() {
        const searchInput = byId("customizacaoSearchInput");
        const clearFiltersBtn = byId("customizacaoClearFiltersBtn");
        const addBtn = byId("customizacaoAddBtn");
        const prevBtn = byId("customizacaoPrevPageBtn");
        const nextBtn = byId("customizacaoNextPageBtn");

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

        addBtn?.addEventListener("click", openCreateSwal);

        prevBtn?.addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage -= 1;
                renderCrud();
            }
        });

        nextBtn?.addEventListener("click", () => {
            const totalPages = Math.max(1, Math.ceil(state.filteredCustomizacoes.length / PAGE_SIZE));
            if (state.currentPage < totalPages) {
                state.currentPage += 1;
                renderCrud();
            }
        });
    }

    async function initCustomizacaoCrud() {
        const root = byId("customizacaoCrudRoot");
        if (!root) return;

        try {
            await Promise.all([loadCategorias(), loadCustomizacoes(), loadFontes()]);
            state.currentPage = 1;
            state.query = "";
            bindEvents();
            renderCrud();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao carregar customizações",
                text: error?.message || "Não foi possível inicializar o CRUD de customização.",
            });
        }
    }

    window.initCustomizacaoCrud = initCustomizacaoCrud;
})();
