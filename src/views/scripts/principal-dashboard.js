(() => {
    const state = {
        filters: {
            periodo: "mes_atual",
            mes: "",
            ano: "",
        },
        charts: {
            comparativo: null,
            gastosDescricao: null,
            ganhosDescricao: null,
            saldoMensal: null,
            saldoCategoria: null,
        },
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function getCurrentMonthYear() {
        const now = new Date();
        return {
            month: now.getUTCMonth() + 1,
            year: now.getUTCFullYear(),
        };
    }

    function formatMoney(value) {
        const n = Number(value ?? 0);
        if (!Number.isFinite(n)) return "R$ 0,00";
        return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function getMonthLabel(month) {
        const months = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
        ];
        const idx = Number(month) - 1;
        return months[idx] || "Mês inválido";
    }

    function renderPeriodoLabel(resumo = {}) {
        const labelEl = byId("principalDashboardPeriodLabel");
        if (!labelEl) return;

        const periodo = String(resumo.periodoAplicado ?? state.filters.periodo ?? "mes_atual");
        const mes = Number(resumo.mesAplicado ?? state.filters.mes);
        const ano = Number(resumo.anoAplicado ?? state.filters.ano);

        if (periodo === "mes") {
            labelEl.textContent = `${getMonthLabel(mes)}/${ano}`;
            return;
        }

        if (periodo === "ano") {
            labelEl.textContent = `Ano ${ano}`;
            return;
        }

        if (periodo === "todos") {
            labelEl.textContent = "Todo período";
            return;
        }

        labelEl.textContent = `Mês atual (${getMonthLabel(mes)}/${ano})`;
    }

    function toChartData(items = [], fallbackLabel = "Sem dados") {
        if (!Array.isArray(items) || !items.length) {
            return {
                labels: [fallbackLabel],
                values: [0],
            };
        }

        return {
            labels: items.map((item) => String(item.label ?? fallbackLabel)),
            values: items.map((item) => Number(item.value ?? 0)),
        };
    }

    function destroyChart(chartInstance) {
        if (chartInstance && typeof chartInstance.destroy === "function") {
            chartInstance.destroy();
        }
    }

    function renderResumo(resumo = {}) {
        const totalGanhosEl = byId("principalTotalGanhos");
        const totalGastosEl = byId("principalTotalGastos");
        const saldoLiquidoEl = byId("principalSaldoLiquido");

        const totalGanhos = Number(resumo.totalGanhos ?? 0);
        const totalGastos = Number(resumo.totalGastos ?? 0);
        const saldo = Number(resumo.saldo ?? 0);

        if (totalGanhosEl) totalGanhosEl.textContent = formatMoney(totalGanhos);
        if (totalGastosEl) totalGastosEl.textContent = formatMoney(totalGastos);
        if (saldoLiquidoEl) {
            saldoLiquidoEl.textContent = formatMoney(saldo);
            saldoLiquidoEl.style.color = saldo >= 0 ? "var(--app-success)" : "var(--app-danger)";
        }
    }

    function buildDashboardParams() {
        const params = new URLSearchParams();
        const periodo = String(state.filters.periodo ?? "mes_atual").trim() || "mes_atual";
        params.set("periodo", periodo);

        const mes = Number(state.filters.mes);
        if (Number.isInteger(mes) && mes >= 1 && mes <= 12) {
            params.set("mes", String(mes));
        }

        const ano = Number(state.filters.ano);
        if (Number.isInteger(ano) && ano >= 2000) {
            params.set("ano", String(ano));
        }

        return params;
    }

    function syncFilterVisibility() {
        const periodType = byId("principalPeriodType");
        const monthInput = byId("principalPeriodMonth");
        const yearInput = byId("principalPeriodYear");

        const periodo = String(periodType?.value ?? state.filters.periodo ?? "mes_atual");
        const showMonth = periodo === "mes";
        const showYear = periodo === "mes" || periodo === "ano";

        if (monthInput) monthInput.hidden = !showMonth;
        if (yearInput) yearInput.hidden = !showYear;
    }

    function renderComparativoChart(data = []) {
        const canvas = byId("principalComparativoChart");
        if (!canvas || !window.Chart) return;

        destroyChart(state.charts.comparativo);

        const chartData = toChartData(data, "Sem dados");

        state.charts.comparativo = new window.Chart(canvas, {
            type: "bar",
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: "Valor",
                    data: chartData.values,
                    backgroundColor: ["#16a34a", "#dc2626"],
                    borderRadius: 10,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => formatMoney(ctx.parsed.y),
                        },
                    },
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => formatMoney(value),
                        },
                    },
                },
            },
        });
    }

    function renderPieChart(canvasId, chartKey, source = [], colorSet = []) {
        const canvas = byId(canvasId);
        if (!canvas || !window.Chart) return;

        destroyChart(state.charts[chartKey]);

        const chartData = toChartData(source, "Sem dados");
        const colors = colorSet.length ? colorSet : ["#2563eb", "#7c3aed", "#0ea5e9", "#16a34a", "#dc2626", "#f59e0b", "#14b8a6"];

        state.charts[chartKey] = new window.Chart(canvas, {
            type: "doughnut",
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.values,
                    backgroundColor: chartData.labels.map((_, idx) => colors[idx % colors.length]),
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatMoney(ctx.parsed)}`,
                        },
                    },
                },
            },
        });
    }

    function renderSaldoMensalChart(source = []) {
        const canvas = byId("principalSaldoMensalChart");
        if (!canvas || !window.Chart) return;

        destroyChart(state.charts.saldoMensal);

        const labels = Array.isArray(source) && source.length ? source.map((item) => item.periodo) : ["Sem dados"];
        const values = Array.isArray(source) && source.length ? source.map((item) => Number(item.saldo ?? 0)) : [0];

        state.charts.saldoMensal = new window.Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Saldo mensal",
                    data: values,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.16)",
                    fill: true,
                    tension: 0.25,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => formatMoney(ctx.parsed.y),
                        },
                    },
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => formatMoney(value),
                        },
                    },
                },
            },
        });
    }

    function renderSaldoCategoriaChart(source = []) {
        const canvas = byId("principalSaldoCategoriaChart");
        if (!canvas || !window.Chart) return;

        destroyChart(state.charts.saldoCategoria);

        const chartData = toChartData(source, "Sem dados");

        state.charts.saldoCategoria = new window.Chart(canvas, {
            type: "bar",
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: "Saldo",
                    data: chartData.values,
                    backgroundColor: chartData.values.map((value) => (value >= 0 ? "#16a34a" : "#dc2626")),
                    borderRadius: 10,
                }],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => formatMoney(ctx.parsed.x),
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: {
                            callback: (value) => formatMoney(value),
                        },
                    },
                },
            },
        });
    }

    async function loadDashboardResumo() {
        const params = buildDashboardParams();
        const data = await window.ajax(`/api/dashboard/resumo?${params.toString()}`);
        const resumo = data?.resumo || {};
        const graficos = data?.graficos || {};

        renderResumo(resumo);
        renderPeriodoLabel(resumo);
        renderComparativoChart(graficos.comparativoGanhosGastos || []);
        renderPieChart("principalGastosDescricaoChart", "gastosDescricao", graficos.gastosPorDescricao || [], ["#dc2626", "#f97316", "#f59e0b", "#ef4444", "#b91c1c"]);
        renderPieChart("principalGanhosDescricaoChart", "ganhosDescricao", graficos.ganhosPorDescricao || [], ["#16a34a", "#22c55e", "#14b8a6", "#10b981", "#059669"]);
        renderSaldoMensalChart(graficos.saldoMensal || []);
        renderSaldoCategoriaChart(graficos.saldoPorCategoria || []);
    }

    function bindEvents() {
        const refreshBtn = byId("principalDashboardRefreshBtn");
        const periodType = byId("principalPeriodType");
        const periodMonth = byId("principalPeriodMonth");
        const periodYear = byId("principalPeriodYear");
        const applyFiltersBtn = byId("principalDashboardApplyFiltersBtn");

        periodType?.addEventListener("change", () => {
            state.filters.periodo = String(periodType.value || "mes_atual");
            syncFilterVisibility();
        });

        applyFiltersBtn?.addEventListener("click", async () => {
            state.filters.periodo = String(periodType?.value || "mes_atual");
            state.filters.mes = String(periodMonth?.value ?? "");
            state.filters.ano = String(periodYear?.value ?? "");

            try {
                await loadDashboardResumo();
            } catch (error) {
                await window.SwalFire({
                    icon: "error",
                    title: "Erro ao aplicar filtro",
                    text: error?.message || "Não foi possível aplicar o filtro agora.",
                });
            }
        });

        refreshBtn?.addEventListener("click", async () => {
            try {
                await loadDashboardResumo();
                await window.SwalFire({
                    icon: "success",
                    title: "Dashboard atualizado",
                    timer: 900,
                    showConfirmButton: false,
                });
            } catch (error) {
                await window.SwalFire({
                    icon: "error",
                    title: "Erro ao atualizar dashboard",
                    text: error?.message || "Não foi possível atualizar agora.",
                });
            }
        });
    }

    async function initPrincipalDashboard() {
        const root = byId("principalDashboardRoot");
        if (!root) return;

        try {
            const { month, year } = getCurrentMonthYear();
            const periodType = byId("principalPeriodType");
            const periodMonth = byId("principalPeriodMonth");
            const periodYear = byId("principalPeriodYear");

            state.filters.periodo = "mes_atual";
            state.filters.mes = String(month);
            state.filters.ano = String(year);

            if (periodType) periodType.value = "mes_atual";
            if (periodMonth) periodMonth.value = String(month);
            if (periodYear) periodYear.value = String(year);

            syncFilterVisibility();
            bindEvents();
            await loadDashboardResumo();
        } catch (error) {
            await window.SwalFire({
                icon: "error",
                title: "Erro ao carregar dashboard",
                text: error?.message || "Não foi possível carregar o dashboard financeiro.",
            });
        }
    }

    window.initPrincipalDashboard = initPrincipalDashboard;
})();
