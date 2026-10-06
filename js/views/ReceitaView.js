/* =========================================================================
   views/ReceitaView.js — Página 1: Análise de Receita
   ========================================================================= */

(function (App) {
  "use strict";

  const G = App.views.GraficoView;
  const { moeda, moedaCurta, inteiro, pct } = App.utils.formato;

  const TPL_RECEITA_PCT = "<b>%{label}</b><br>Receita: R$ %{value:,.2f}<br>Participação: %{percent}<extra></extra>";

  App.views.ReceitaView = {
    render(r, D) {
      const C = G.COR;
      const ticket = r.qtdAprovada ? r.receita / r.qtdAprovada : 0;
      const parque = r.pdvsFiltrados.length;

      /* séries mensais (também alimentam os mini gráficos dos KPIs) */
      const meses = [], qtds = [], aprovadas = [], receitas = [], tickets = [];
      for (let m = r.mesDe; m <= r.mesAte; m++) {
        meses.push(D.ano_mes_rotulo[m]);
        qtds.push(r.qtdMes[m]);
        aprovadas.push(r.qtdAprovMes[m]);
        receitas.push(r.receitaMes[m]);
        tickets.push(r.qtdAprovMes[m] ? r.receitaMes[m] / r.qtdAprovMes[m] : 0);
      }

      /* ------------------------------------------------ KPIs */
      G.kpi("kpiReceita", moedaCurta(r.receita),
        `${inteiro(r.qtdAprovada)} aprovadas · movimentação ${moedaCurta(r.movimentacao)}`);
      G.sparkline("kpiReceitaExtra", receitas, meses, moedaCurta, C.primaria);

      G.kpi("kpiTransacoes", inteiro(r.qtd), r.qtd ? "aprovadas e não aprovadas no filtro" : "sem transações no filtro");
      G.proporcao("kpiTransacoesExtra", r.qtd ? (r.qtdAprovada / r.qtd) * 100 : 0,
        `${pct(r.qtd ? (r.qtdAprovada / r.qtd) * 100 : 0)} aprovadas`,
        `${inteiro(r.qtd - r.qtdAprovada)} não aprovadas`, C.qtd);

      G.kpi("kpiTicket", moeda(ticket), "por transação aprovada");
      G.sparkline("kpiTicketExtra", tickets, meses, moeda, C.qtd);

      G.kpi("kpiPdvComMovimento", inteiro(r.pdvsAtivos), `de ${inteiro(parque)} máquinas no parque filtrado`);
      G.proporcao("kpiPdvComMovimentoExtra", parque ? (r.pdvsAtivos / parque) * 100 : 0,
        `${pct(parque ? (r.pdvsAtivos / parque) * 100 : 0)} do parque`,
        `${inteiro(parque - r.pdvsAtivos)} sem movimento`);

      /* ------------------------------------------------ composição (roscas) */
      const fTipo = G.fatias(r.receitaTipo, D.tipo);
      G.desenhar("gReceitaTipoPct", G.rosca(fTipo.rotulos, fTipo.valores, fTipo.cores, TPL_RECEITA_PCT),
        G.layoutRosca(moedaCurta(r.receita), "receita"));
      G.legenda("lgReceitaTipoPct", fTipo.rotulos, fTipo.valores, fTipo.cores, moedaCurta);

      const fBand = G.fatias(r.receitaBandeira, D.bandeira);
      G.desenhar("gReceitaBandeiraPct", G.rosca(fBand.rotulos, fBand.valores, fBand.cores, TPL_RECEITA_PCT),
        G.layoutRosca(`${fBand.rotulos.length}`, fBand.rotulos.length === 1 ? "bandeira" : "bandeiras"));
      G.legenda("lgReceitaBandeiraPct", fBand.rotulos, fBand.valores, fBand.cores, moedaCurta);

      /* ------------------------------------------------ receita por tipo */
      const rTipo = G.ranking(r.receitaTipo, D.tipo, true);
      G.desenhar(
        "gReceitaTipo",
        [{
          type: "bar", x: rTipo.rotulos, y: rTipo.valores, marker: { color: C.primaria },
          hovertemplate: "<b>%{x}</b><br>Receita: R$ %{y:,.2f}<extra></extra>",
        }],
        G.layoutBase({
          yaxis: G.eixoValor({ tickprefix: "R$ " }),
          xaxis: G.eixoCategoria({ tickangle: G.angulo(rTipo.rotulos) }),
          bargap: 0.5,
        })
      );

      /* ------------------------------------------------ QUANTIDADE por tipo */
      const rQtdTipo = G.ranking(r.qtdTipo, D.tipo, false);
      const info = new Map();
      D.tipo.forEach((nome, i) =>
        info.set(nome, {
          movimentacao: r.movTipo[i],
          aprovadas: r.qtdAprovTipo[i],
          taxa: r.qtdTipo[i] ? (r.qtdAprovTipo[i] / r.qtdTipo[i]) * 100 : 0,
        })
      );
      const totalQtd = rQtdTipo.valores.reduce((a, b) => a + b, 0) || 1;
      G.desenhar(
        "gMovimentacaoTipo",
        [{
          type: "bar", orientation: "h", x: rQtdTipo.valores, y: rQtdTipo.rotulos,
          marker: { color: C.qtd },
          customdata: rQtdTipo.rotulos.map((nome, i) => {
            const a = info.get(nome);
            return [pct((rQtdTipo.valores[i] / totalQtd) * 100), inteiro(a.aprovadas), pct(a.taxa), moeda(a.movimentacao)];
          }),
          hovertemplate:
            "<b>%{y}</b><br>%{x:,.0f} transações (%{customdata[0]} do total)" +
            "<br>Aprovadas: %{customdata[1]} (%{customdata[2]})" +
            "<br>Movimentação: %{customdata[3]}<extra></extra>",
        }],
        G.layoutBase({
          margin: { l: 118, r: 24, t: 10, b: 40 },
          xaxis: G.eixoValor(),
          yaxis: G.eixoCategoria(),
          bargap: 0.45,
        })
      );

      /* ------------------------------------------------ transações por mês (empilhado) */
      const naoAprovadas = qtds.map((q, i) => q - aprovadas[i]);
      G.desenhar(
        "gTransacoesMes",
        [
          {
            type: "bar", name: "Aprovadas", x: meses, y: aprovadas,
            marker: { color: C.qtd, line: { color: C.card, width: 1.5 } },
            hovertemplate: "<b>%{x}</b><br>Aprovadas: %{y:,.0f}<extra></extra>",
          },
          {
            type: "bar", name: "Não aprovadas", x: meses, y: naoAprovadas,
            marker: { color: C.neutra, line: { color: C.card, width: 1.5 } },
            hovertemplate: "<b>%{x}</b><br>Não aprovadas: %{y:,.0f}<extra></extra>",
          },
        ],
        G.layoutBase({
          barmode: "stack",
          showlegend: true,
          legend: { orientation: "h", x: 0, y: 1.12, traceorder: "normal", font: { size: 12, family: G.FONTE, color: C.txt2 } },
          margin: { l: 56, r: 16, t: 30, b: 40 },
          yaxis: G.eixoValor(),
          xaxis: G.eixoCategoria(),
          bargap: 0.45,
          hovermode: "x unified",
        })
      );

      /* ------------------------------------------------ receita mensal */
      G.desenhar(
        "gReceitaMensal",
        [{
          type: "scatter", mode: "lines+markers", x: meses, y: receitas,
          line: { color: C.primaria, width: 2.5, shape: "spline", smoothing: 0.6 },
          marker: { size: 8, color: C.card, line: { color: C.primaria, width: 2.5 } },
          fill: "tozeroy",
          fillcolor: "rgba(255,90,31,.08)",
          hovertemplate: "<b>%{x}</b><br>Receita: R$ %{y:,.2f}<extra></extra>",
        }],
        G.layoutBase({
          yaxis: G.eixoValor({ tickprefix: "R$ " }),
          xaxis: G.eixoCategoria(),
          hovermode: "x unified",
        })
      );
    },
  };
})(window.App);
