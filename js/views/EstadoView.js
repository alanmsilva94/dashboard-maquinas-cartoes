/* =========================================================================
   views/EstadoView.js — Página 3: Consulta por Estado (gráfico + tabela dinâmica)

   Recebe a consulta pronta do PainelModel (linhas já ordenadas e filtradas
   pela busca, municípios dos estados abertos, totais) e só desenha. Cliques e
   digitação viram chamadas aos handlers que o Controller registra em `ligar()`.
   ========================================================================= */

(function (App) {
  "use strict";

  const G = App.views.GraficoView;
  const { esc } = App.utils.texto;
  const { moeda, moedaCurta, inteiro, pct, decimal } = App.utils.formato;
  const UF = App.utils.uf;

  const el = (id) => document.getElementById(id);
  const CHEV = '<svg class="ico ico-sm"><use href="#i-chev-dir"/></svg>';

  function barra(parte) {
    const largura = Math.max(0, Math.min(100, parte));
    return `<div class="barra-celula"><span class="barra"><i style="width:${largura.toFixed(1)}%"></i></span>` +
      `<em>${esc(pct(parte))}</em></div>`;
  }

  function celulas(l, parte, titulo) {
    return `
      <td class="num">${esc(inteiro(l.pdvs))}</td>
      <td class="num">${esc(inteiro(l.igrejas))}</td>
      <td class="num">${esc(inteiro(l.transacoes))}</td>
      <td class="num receita">${esc(moeda(l.receita))}</td>
      <td class="num">${esc(moeda(l.ticket))}</td>
      <td class="col-barra"${titulo ? ` title="${titulo}"` : ""}>${barra(parte)}</td>`;
  }

  /* "SP" vira selo + nome por extenso; outro texto aparece como veio */
  function nomeEstado(nome) {
    const extenso = UF.nome(nome);
    return extenso
      ? `<span class="uf">${esc(String(nome).toUpperCase())}</span><span>${esc(extenso)}</span>`
      : `<span>${esc(nome)}</span>`;
  }

  function linhaEstado(item, totalReceita, semLocalidade) {
    const l = item.linha;
    const html = [`
      <tr class="linha-estado${item.aberto ? " is-active" : ""}${semLocalidade ? " linha-sem-localidade" : ""}"
          data-estado="${l.idx}" tabindex="0" role="button" aria-expanded="${item.aberto}">
        <th scope="row">
          <div class="celula-estado">
            <span class="abrir" aria-hidden="true">${CHEV}</span>
            ${semLocalidade ? `<span>${esc(l.nome)}</span><span class="badge is-warn">sem cadastro</span>` : nomeEstado(l.nome)}
          </div>
        </th>
        ${celulas(l, (l.receita / (totalReceita || 1)) * 100)}
      </tr>`];

    if (!item.aberto) return html.join("");
    if (!item.filhos.length) {
      html.push('<tr class="linha-municipio"><th scope="row">Sem municípios no filtro</th><td colspan="6"></td></tr>');
      return html.join("");
    }
    item.filhos.forEach((f) =>
      html.push(`
        <tr class="linha-municipio">
          <th scope="row">${esc(f.nome)}</th>
          ${celulas(f, (f.receita / (l.receita || 1)) * 100, "participação dentro do estado")}
        </tr>`)
    );
    return html.join("");
  }

  App.views.EstadoView = {
    /* handlers: { ordenar(coluna), alternar(idxEstado), alternarTodos(), buscar(texto) } */
    ligar(handlers) {
      el("tabelaEstados").querySelectorAll("th[data-ordenar]").forEach((th) => {
        th.addEventListener("click", () => handlers.ordenar(th.dataset.ordenar));
      });
      const corpo = el("tabelaEstadosCorpo");
      corpo.addEventListener("click", (ev) => {
        const linha = ev.target.closest(".linha-estado");
        if (linha) handlers.alternar(parseInt(linha.dataset.estado, 10));
      });
      corpo.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const linha = ev.target.closest(".linha-estado");
        if (!linha) return;
        ev.preventDefault();
        handlers.alternar(parseInt(linha.dataset.estado, 10));
      });
      el("btnAbrirTodos").addEventListener("click", handlers.alternarTodos);
      let espera = null;
      el("buscaEstados").addEventListener("input", (ev) => {
        clearTimeout(espera);
        espera = setTimeout(() => handlers.buscar(ev.target.value.trim()), 160);
      });
    },

    /* base nova: a busca volta vazia */
    reiniciar() {
      el("buscaEstados").value = "";
    },

    render(c) {
      const C = G.COR;
      const t = c.totais;

      G.kpi("kpiEstados", inteiro(c.qtdEstados),
        c.temSemLocal
          ? `${inteiro(t.pdvs)} PDVs · ${inteiro(c.semLocalPdvs)} sem localidade`
          : `${inteiro(t.pdvs)} PDVs no filtro`);
      G.kpi("kpiMunicipios", inteiro(c.municipios),
        c.qtdEstados ? `média de ${decimal(c.municipios / c.qtdEstados)} por estado` : "—");
      G.kpi("kpiEstadoLider", c.lider ? (UF.nome(c.lider.nome) || c.lider.nome) : "—",
        c.lider ? `${moedaCurta(c.lider.receita)} · ${pct((c.lider.receita / (t.receita || 1)) * 100)} da receita` : "—");
      G.kpi("kpiReceitaMediaEstado", moedaCurta(c.qtdComReceita ? t.receita / c.qtdComReceita : 0),
        `entre ${inteiro(c.qtdComReceita)} estado(s) com receita`);

      /* só estados reais e uma medida só: transações, PDVs e ticket no tooltip */
      const nomes = c.porReceita.map((l) => l.nome);
      G.desenhar(
        "gEstados",
        [{
          type: "bar",
          name: "Receita",
          x: nomes,
          y: c.porReceita.map((l) => l.receita),
          marker: { color: C.primaria },
          customdata: c.porReceita.map((l) => [
            UF.nome(l.nome) || l.nome, inteiro(l.transacoes), inteiro(l.pdvs), moeda(l.ticket),
            pct((l.receita / (t.receita || 1)) * 100),
          ]),
          hovertemplate:
            "<b>%{customdata[0]}</b><br>Receita: R$ %{y:,.2f} (%{customdata[4]})" +
            "<br>Transações: %{customdata[1]}<br>PDVs: %{customdata[2]}<br>Ticket médio: %{customdata[3]}<extra></extra>",
        }],
        G.layoutBase({
          margin: { l: 64, r: 16, t: 10, b: 44 },
          yaxis: G.eixoValor({ tickprefix: "R$ " }),
          xaxis: G.eixoCategoria({ tickangle: G.angulo(nomes) }),
          bargap: 0.45,
        })
      );

      this.renderTabela(c);
    },

    renderTabela(c) {
      const corpo = el("tabelaEstadosCorpo");
      const rodape = el("tabelaEstadosRodape");
      if (!corpo) return;

      const abertos = c.linhas.concat(c.semLocal || []).filter((i) => i.aberto).length;
      const total = c.linhas.length + (c.semLocal ? 1 : 0);
      el("btnAbrirTodosTexto").textContent = total && abertos === total ? "Fechar todos" : "Abrir todos";
      el("btnAbrirTodos").disabled = !!c.busca;

      const t = c.totais;
      if (!c.linhas.length && !c.semLocal) {
        corpo.innerHTML = `<tr><td colspan="7" class="empty-inline">${
          c.busca ? `Nada encontrado para “${esc(c.busca)}”.` : "Nenhum estado no filtro."
        }</td></tr>`;
      } else {
        const html = c.linhas.map((item) => linhaEstado(item, t.receita, false));
        if (c.semLocal) html.push(linhaEstado(c.semLocal, t.receita, true));
        corpo.innerHTML = html.join("");
      }

      rodape.innerHTML = c.qtdEstados || c.temSemLocal
        ? `<tr>
            <th scope="row">Total (${esc(inteiro(c.qtdEstados))} estados${c.temSemLocal ? " + sem localidade" : ""})</th>
            <td class="num">${esc(inteiro(t.pdvs))}</td>
            <td class="num">${esc(inteiro(t.igrejas))}</td>
            <td class="num">${esc(inteiro(t.transacoes))}</td>
            <td class="num receita">${esc(moeda(t.receita))}</td>
            <td class="num">${esc(moeda(t.ticket))}</td>
            <td class="col-barra">${barra(100)}</td>
          </tr>`
        : "";

      /* indicador de ordenação no cabeçalho */
      document.querySelectorAll("#tabelaEstados th[data-ordenar]").forEach((th) => {
        if (th.dataset.ordenar === c.tabela.coluna) {
          th.setAttribute("aria-sort", c.tabela.desc ? "descending" : "ascending");
          const seta = th.querySelector(".seta");
          if (seta) seta.textContent = c.tabela.desc ? "▼" : "▲";
        } else {
          th.removeAttribute("aria-sort");
        }
      });
    },
  };
})(window.App);
