/* =========================================================================
   views/LocalidadeView.js — Página 2: Análise de PDV por Localidade
   ========================================================================= */

(function (App) {
  "use strict";

  const G = App.views.GraficoView;
  const { esc } = App.utils.texto;
  const { moeda, moedaCurta, inteiro, pct, decimal } = App.utils.formato;

  const TPL_MAQ = "<b>%{label}</b><br>%{value:,.0f} máquinas<br>%{percent}<extra></extra>";

  function miniRoscas(rMaq, D) {
    const caixa = document.getElementById("miniRoscas");
    if (!caixa) return;

    const total = rMaq.valores.reduce((a, b) => a + b, 0);
    const limpar = () => caixa.querySelectorAll(".mini-rosca-canvas").forEach((c) => G.apagar(c.id));

    if (!total) {
      limpar();
      caixa.innerHTML = '<p class="empty-inline">Nenhuma máquina para os filtros selecionados.</p>';
      caixa.dataset.assinatura = "";
      return;
    }

    /* só refaz o HTML quando o conjunto de regiões muda */
    const assinatura = rMaq.rotulos.join("|");
    if (caixa.dataset.assinatura !== assinatura) {
      limpar();
      caixa.innerHTML = rMaq.rotulos
        .map(
          (nome, i) => `<div class="mini-rosca">
             <div class="mini-rosca-canvas" id="miniRosca${i}"></div>
             <p class="mini-rosca-nome" title="${esc(nome)}">${esc(nome)}</p>
           </div>`
        )
        .join("");
      caixa.dataset.assinatura = assinatura;
    }

    rMaq.rotulos.forEach((nome, i) => {
      const valor = rMaq.valores[i];
      const parte = (valor / total) * 100;
      G.desenhar(
        "miniRosca" + i,
        [{
          type: "pie", hole: 0.72, labels: [nome, "Outras regiões"], values: [valor, total - valor],
          sort: false, textinfo: "none",
          marker: { colors: [rMaq.cores[i], G.COR.fundo2], line: { width: 0 } },
          hovertemplate: TPL_MAQ,
        }],
        G.layoutBase({
          margin: { l: 4, r: 4, t: 4, b: 4 },
          xaxis: undefined,
          yaxis: undefined,
          annotations: [{
            text: `<b>${pct(parte)}</b><br><span style="font-size:9px;color:${G.COR.txt3}">${inteiro(valor)} máq.</span>`,
            showarrow: false,
            font: { family: G.FONTE, size: 13.5, color: G.COR.txt },
            x: 0.5,
            y: 0.5,
          }],
        })
      );
    });
  }

  App.views.LocalidadeView = {
    /* chamado quando uma base nova entra: as mini-roscas são recriadas */
    reiniciar() {
      const mini = document.getElementById("miniRoscas");
      if (mini) {
        mini.dataset.assinatura = "";
        mini.innerHTML = "";
      }
    },

    render(r, D) {
      const C = G.COR;
      const parque = r.pdvsFiltrados.length;

      G.kpi("kpiQtdPdv", inteiro(parque), `${inteiro(r.pdvsAtivos)} com movimento no período`);
      G.proporcao("kpiQtdPdvExtra", parque ? (r.pdvsAtivos / parque) * 100 : 0,
        `${inteiro(r.pdvsAtivos)} ativos`, `${inteiro(r.pdvsInativos)} inativos`);
      G.kpi("kpiQtdIgrejas", inteiro(r.qtdIgrejas),
        r.qtdIgrejas ? `média de ${decimal(parque / r.qtdIgrejas)} máquinas por unidade` : "nenhuma unidade no filtro");
      G.kpi("kpiPdvsAtivos", inteiro(r.pdvsAtivos),
        parque ? `${pct((r.pdvsAtivos / parque) * 100)} do parque filtrado` : "sem máquinas no filtro");
      /* tendência: máquinas com movimento em cada mês do período */
      const mesesK = [], ativasK = [];
      for (let m = r.mesDe; m <= r.mesAte; m++) {
        mesesK.push(D.ano_mes_rotulo[m]);
        ativasK.push(r.pdvMesAtivo[m].size);
      }
      G.sparkline("kpiPdvsAtivosExtra", ativasK, mesesK, (v) => `${inteiro(v)} máquinas`, C.qtd);
      G.kpi("kpiReceitaPorMaquina", moedaCurta(r.pdvsAtivos ? r.receita / r.pdvsAtivos : 0),
        "receita média por máquina ativa");

      /* ativos × inativos */
      const rotAtivo = ["Ativos", "Inativos"];
      const valAtivo = [r.pdvsAtivos, r.pdvsInativos];
      const corAtivo = [C.primaria, C.neutra];
      G.desenhar("gPdvAtivoInativo", G.rosca(rotAtivo, valAtivo, corAtivo, TPL_MAQ),
        G.layoutRosca(parque ? pct((r.pdvsAtivos / parque) * 100) : "—", "ativos"));
      G.legenda("lgPdvAtivoInativo", rotAtivo, valAtivo, corAtivo, inteiro);

      /* máquinas por região */
      const rMaq = G.fatias(r.maquinasRegiao, D.regiao);
      G.desenhar("gMaquinasRegiao", G.rosca(rMaq.rotulos, rMaq.valores, rMaq.cores, TPL_MAQ),
        G.layoutRosca(inteiro(parque), "máquinas"));
      G.legenda("lgMaquinasRegiao", rMaq.rotulos, rMaq.valores, rMaq.cores, inteiro);

      /* receita por região */
      const rRec = G.ranking(r.receitaRegiao, D.regiao, true);
      G.desenhar(
        "gReceitaRegiao",
        [{
          type: "bar", x: rRec.rotulos, y: rRec.valores,
          /* "Sem localidade" em âmbar: é pendência de cadastro, não uma região */
          marker: { color: rRec.rotulos.map((n) => (n === App.Config.regras.semLocalidade ? C.alerta : C.primaria)) },
          hovertemplate: "<b>%{x}</b><br>Receita: R$ %{y:,.2f}<extra></extra>",
        }],
        G.layoutBase({
          yaxis: G.eixoValor({ tickprefix: "R$ " }),
          xaxis: G.eixoCategoria({ tickangle: G.angulo(rRec.rotulos) }),
          bargap: 0.4,
        })
      );

      /* transações por região */
      const rQtd = G.ranking(r.qtdRegiao, D.regiao, false);
      G.desenhar(
        "gTransacoesRegiao",
        [{
          type: "bar", orientation: "h", x: rQtd.valores, y: rQtd.rotulos,
          marker: { color: rQtd.rotulos.map((n) => (n === App.Config.regras.semLocalidade ? C.alerta : C.qtd)) },
          hovertemplate: "<b>%{y}</b><br>%{x:,.0f} transações<extra></extra>",
        }],
        G.layoutBase({ margin: { l: 140, r: 24, t: 10, b: 40 }, xaxis: G.eixoValor(), yaxis: G.eixoCategoria(), bargap: 0.4 })
      );

      /* receita por descrição de igreja, com máquinas e ticket no tooltip */
      const rDesc = G.ranking(r.receitaDesc, D.desc_igreja, false);
      const info = new Map();
      D.desc_igreja.forEach((nome, i) =>
        info.set(nome, {
          maquinas: r.maquinasDesc[i],
          transacoes: r.qtdDesc[i],
          porMaquina: r.maquinasDesc[i] ? r.receitaDesc[i] / r.maquinasDesc[i] : 0,
        })
      );
      G.desenhar(
        "gReceitaDescIgreja",
        [{
          type: "bar", orientation: "h", x: rDesc.valores, y: rDesc.rotulos, marker: { color: C.primaria },
          customdata: rDesc.rotulos.map((n) => {
            const a = info.get(n);
            return [inteiro(a.maquinas), inteiro(a.transacoes), moeda(a.porMaquina)];
          }),
          hovertemplate:
            "<b>%{y}</b><br>Receita: R$ %{x:,.2f}<br>Máquinas: %{customdata[0]}" +
            "<br>Transações: %{customdata[1]}<br>Receita por máquina: %{customdata[2]}<extra></extra>",
        }],
        G.layoutBase({
          margin: { l: 140, r: 28, t: 10, b: 40 },
          xaxis: G.eixoValor({ tickprefix: "R$ " }),
          yaxis: G.eixoCategoria(),
          bargap: 0.42,
        })
      );

      /* máquinas por descrição de igreja */
      const fDesc = G.fatias(r.maquinasDesc, D.desc_igreja);
      G.desenhar("gMaquinasDescIgreja", G.rosca(fDesc.rotulos, fDesc.valores, fDesc.cores, TPL_MAQ),
        G.layoutRosca(inteiro(parque), "máquinas"));
      G.legenda("lgMaquinasDescIgreja", fDesc.rotulos, fDesc.valores, fDesc.cores, inteiro);

      /* mini roscas: todas as regiões (sem agrupar em "Outros"), mesma cor da rosca acima */
      const rTodas = G.ranking(r.maquinasRegiao, D.regiao, true);
      rTodas.cores = rTodas.rotulos.map((n) => {
        const i = rMaq.rotulos.indexOf(n);
        return i >= 0 ? rMaq.cores[i] : G.COR.neutra;
      });
      miniRoscas(rTodas, D);

      /* utilização mensal: UMA medida (% do parque); a quantidade vai no tooltip */
      const meses = [], ativas = [], utilizacao = [];
      const base = parque || 1;
      for (let m = r.mesDe; m <= r.mesAte; m++) {
        meses.push(D.ano_mes_rotulo[m]);
        const n = r.pdvMesAtivo[m].size;
        ativas.push(n);
        utilizacao.push((n / base) * 100);
      }

      G.desenhar(
        "gUtilizacaoMensal",
        [{
          type: "bar", name: "Utilização do parque", x: meses, y: utilizacao,
          marker: { color: C.primaria },
          customdata: ativas.map((n) => [inteiro(n), inteiro(parque)]),
          hovertemplate:
            "<b>%{x}</b><br>Utilização: %{y:.1f}% do parque" +
            "<br>%{customdata[0]} de %{customdata[1]} máquinas com movimento<extra></extra>",
        }],
        G.layoutBase({
          margin: { l: 56, r: 16, t: 10, b: 42 },
          yaxis: G.eixoValor({ range: [0, 105], dtick: 25, ticksuffix: "%" }),
          xaxis: G.eixoCategoria(),
          bargap: 0.55,
        })
      );
    },
  };
})(window.App);
