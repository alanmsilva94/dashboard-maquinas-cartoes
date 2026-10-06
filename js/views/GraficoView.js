/* =========================================================================
   views/GraficoView.js — tudo o que fala com o Plotly, mais os mini gráficos
   SVG dos KPIs

   Cores, fonte e paleta saem das variáveis CSS (css/01-tokens.css): trocar o
   tema muda também os gráficos. Regras seguidas:
     * a cor acompanha a CATEGORIA, não a posição no ranking — filtrar não
       repinta quem continua na tela;
     * no máximo 8 fatias coloridas; o resto vira "Outros" em cinza;
     * "Sem localidade" usa a cor de alerta e "Não informado" fica neutro;
     * um eixo só por gráfico (a segunda medida vai para o tooltip).
   ========================================================================= */

(function (App) {
  "use strict";

  const { esc } = App.utils.texto;
  const { pct } = App.utils.formato;

  const CONFIG_PLOTLY = {
    displaylogo: false,
    responsive: true,
    scrollZoom: false,
    /* sendDataToCloud/editInChartStudio enviariam os dados para a internet */
    modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "toggleSpikelines", "sendDataToCloud", "editInChartStudio"],
    toImageButtonOptions: { format: "png", filename: "dashboard-maquinas", scale: 2 },
  };

  const MAX_FATIAS = 8;
  const NEUTROS = new Set(["Não informado", "Sem cadastro", "Outros"]);

  const token = (nome, alternativa) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || alternativa;
  };

  const G = {
    COR: {},
    FONTE: "",
    paleta: [],
    desenhados: new Set(),

    lerTokens() {
      G.COR = {
        primaria: token("--primaria", "#FF5A1F"),
        primariaForte: token("--primaria-forte", "#AE3200"),
        qtd: token("--medida-qtd", "#4F5D6B"),
        linha: token("--serie-linha", "#1F2A33"),
        neutra: token("--serie-neutra", "#C9CDD2"),
        alerta: token("--alerta", "#B97000"),
        grade: token("--linha", "#E6E4DF"),
        borda: token("--linha-forte", "#D6D3CC"),
        txt: token("--texto", "#1B1C1A"),
        txt2: token("--texto-2", "#555F6B"),
        txt3: token("--texto-3", "#838C95"),
        card: token("--superficie", "#FFFFFF"),
        fundo2: token("--superficie-3", "#EFEEEB"),
      };
      G.FONTE = token("--fonte", 'system-ui, "Segoe UI", Arial, sans-serif');
      const css = Array.from({ length: MAX_FATIAS }, (_, i) => token(`--serie-${i + 1}`, ""));
      G.paleta = css.every(Boolean) ? css : App.Config.paleta.slice(0, MAX_FATIAS);
    },

    /* ---------------------------------------------------- cor por categoria */

    /* cor estável de um rótulo, pela posição no DICIONÁRIO (não no ranking) */
    corDe(rotulo, dicionario) {
      if (rotulo === App.Config.regras.semLocalidade) return G.COR.alerta;
      if (NEUTROS.has(rotulo)) return G.COR.neutra;
      const coloridos = dicionario.filter((d) => !NEUTROS.has(d) && d !== App.Config.regras.semLocalidade);
      const i = coloridos.indexOf(rotulo);
      return i >= 0 && i < MAX_FATIAS ? G.paleta[i] : G.COR.neutra;
    },

    /* ranking para rosca: até 8 categorias; acima disso as menores viram "Outros".
       Com mais de 8, a cor passa a seguir a posição (não há 9ª cor distinguível). */
    fatias(valores, dicionario) {
      const r = G.ranking(valores, dicionario, true);
      let { rotulos, valores: vals } = r;
      if (rotulos.length > MAX_FATIAS) {
        const resto = vals.slice(MAX_FATIAS - 1).reduce((a, b) => a + b, 0);
        rotulos = rotulos.slice(0, MAX_FATIAS - 1).concat("Outros");
        vals = vals.slice(0, MAX_FATIAS - 1).concat(resto);
      }
      const semLocal = App.Config.regras.semLocalidade;
      const coloridos = dicionario.filter((d) => !NEUTROS.has(d) && d !== semLocal).length;
      const porPosicao = coloridos > MAX_FATIAS;
      let n = 0;
      const cores = rotulos.map((rot) => {
        if (!porPosicao || NEUTROS.has(rot) || rot === semLocal) return G.corDe(rot, dicionario);
        return G.paleta[n++ % MAX_FATIAS];
      });
      return { rotulos, valores: vals, cores };
    },

    /* ---------------------------------------------------- layout */

    layoutBase(extra) {
      const C = G.COR;
      const base = {
        separators: ",.",
        font: { family: G.FONTE, size: 12, color: C.txt2 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 62, r: 16, t: 10, b: 40 },
        showlegend: false,
        hovermode: "closest",
        barcornerradius: 4,
        hoverlabel: {
          bgcolor: C.card,
          bordercolor: C.borda,
          font: { family: G.FONTE, size: 12.5, color: C.txt },
          align: "left",
        },
        xaxis: { gridcolor: C.grade, zeroline: false, linecolor: C.grade, automargin: true },
        yaxis: { gridcolor: C.grade, zeroline: false, linecolor: C.grade, automargin: true },
      };
      const saida = Object.assign(base, extra || {});
      /* Plotly quebra se uma chave de eixo existir valendo undefined (roscas) */
      Object.keys(saida).forEach((k) => saida[k] === undefined && delete saida[k]);
      return saida;
    },

    /* rosca com o total no centro */
    layoutRosca(centro, legenda) {
      return G.layoutBase({
        margin: { l: 8, r: 8, t: 8, b: 8 },
        xaxis: undefined,
        yaxis: undefined,
        annotations: centro
          ? [{
              text: `<b>${esc(centro)}</b>` +
                (legenda ? `<br><span style="font-size:11px;color:${G.COR.txt3}">${esc(legenda)}</span>` : ""),
              showarrow: false,
              font: { family: token("--fonte-titulo", G.FONTE), size: 17, color: G.COR.txt },
              x: 0.5,
              y: 0.5,
            }]
          : [],
      });
    },

    eixoValor: (extra) => Object.assign({ gridcolor: G.COR.grade, zeroline: false, automargin: true }, extra),
    eixoCategoria: (extra) =>
      Object.assign({ gridcolor: "rgba(0,0,0,0)", linecolor: G.COR.grade, automargin: true }, extra),

    rosca(rotulos, valores, cores, template, buraco) {
      return [{
        type: "pie",
        hole: buraco || 0.68,
        labels: rotulos,
        values: valores,
        sort: false,
        direction: "clockwise",
        textinfo: "none", /* os números ficam na legenda HTML */
        marker: { colors: cores, line: { color: G.COR.card, width: 2 } },
        hovertemplate: template,
      }];
    },

    /* inclinação dos rótulos do eixo x conforme quantidade e tamanho */
    angulo(rotulos) {
      const maior = rotulos.reduce((m, x) => Math.max(m, String(x).length), 0);
      if (rotulos.length <= 4 && maior <= 20) return 0;
      if (rotulos.length > 7 || maior > 14) return -30;
      if (rotulos.length > 4 && maior > 9) return -18;
      return 0;
    },

    /* ---------------------------------------------------- desenho */

    marcarVazio(alvo, vazio) {
      const corpo = alvo.closest(".chart-corpo");
      alvo.classList.toggle("is-empty", vazio);
      if (!corpo) return;
      let aviso = corpo.querySelector(".chart-empty");
      if (vazio && !aviso) {
        aviso = document.createElement("p");
        aviso.className = "chart-empty";
        aviso.textContent = "Nenhum dado para os filtros selecionados.";
        corpo.appendChild(aviso);
      } else if (!vazio && aviso) {
        aviso.remove();
      }
    },

    desenhar(id, dados, layout) {
      const alvo = document.getElementById(id);
      if (!alvo) return;

      const vazio =
        !dados || !dados.length || dados.every((t) => (t.values ? !t.values.length : !t.x || !t.x.length));
      G.marcarVazio(alvo, vazio);

      if (vazio) {
        if (G.desenhados.has(id)) {
          Plotly.purge(alvo);
          G.desenhados.delete(id);
        }
        return;
      }
      if (!G.desenhados.has(id)) {
        Plotly.newPlot(alvo, dados, layout, CONFIG_PLOTLY);
        G.desenhados.add(id);
      } else {
        Plotly.react(alvo, dados, layout, CONFIG_PLOTLY);
      }
    },

    apagar(id) {
      if (!G.desenhados.has(id)) return;
      const alvo = document.getElementById(id);
      if (alvo) Plotly.purge(alvo);
      G.desenhados.delete(id);
    },

    apagarTodos() {
      Array.from(G.desenhados).forEach(G.apagar);
    },

    redimensionar() {
      document
        .querySelectorAll(".page:not([hidden]) .chart-canvas, .page:not([hidden]) .mini-rosca-canvas")
        .forEach((c) => G.desenhados.has(c.id) && Plotly.Plots.resize(c));
    },

    /* legenda HTML ao lado da rosca */
    legenda(id, rotulos, valores, cores, formatar) {
      const alvo = document.getElementById(id);
      if (!alvo) return;
      if (!rotulos.length) {
        alvo.innerHTML = '<p class="ms-vazio">Sem dados no filtro.</p>';
        return;
      }
      const total = valores.reduce((a, b) => a + b, 0) || 1;
      alvo.innerHTML = rotulos
        .map(
          (rotulo, i) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${esc(cores[i])}"></span>
          <span class="legend-label" title="${esc(rotulo)}">${esc(rotulo)}</span>
          <span class="legend-value">${esc(formatar(valores[i]))}</span>
          <span class="legend-pct">${esc(pct((valores[i] / total) * 100))} do total</span>
        </div>`
        )
        .join("");
    },

    /* ---------------------------------------------------- mini gráficos dos KPIs */

    /* linha de tendência em SVG puro; title nativo dá o valor de cada mês */
    sparkline(id, valores, rotulos, formatar, cor) {
      const alvo = document.getElementById(id);
      if (!alvo) return;
      if (!valores || valores.length < 2) {
        alvo.innerHTML = "";
        return;
      }
      const L = 240, A = 34, m = 3;
      const max = Math.max(...valores), min = Math.min(...valores);
      const faixa = max - min || 1;
      const pts = valores.map((v, i) => [
        m + (i * (L - 2 * m)) / (valores.length - 1),
        m + (A - 2 * m) * (1 - (v - min) / faixa),
      ]);
      const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
      const c = cor || G.COR.primaria;
      const fim = pts[pts.length - 1];
      alvo.innerHTML = `
        <svg viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img"
             aria-label="Tendência mensal: ${esc(rotulos[0])} a ${esc(rotulos[rotulos.length - 1])}">
          <path d="${d} L${fim[0].toFixed(1)},${A} L${pts[0][0].toFixed(1)},${A} Z" fill="${c}" opacity=".10"/>
          <path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
                vector-effect="non-scaling-stroke"/>
          ${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6" fill="transparent">
              <title>${esc(rotulos[i])}: ${esc(formatar(valores[i]))}</title></circle>`).join("")}
          <circle cx="${fim[0].toFixed(1)}" cy="${fim[1].toFixed(1)}" r="3" fill="${c}"/>
        </svg>`;
    },

    /* barra de proporção com legenda embaixo */
    proporcao(id, parte, rotuloEsq, rotuloDir, cor) {
      const alvo = document.getElementById(id);
      if (!alvo) return;
      const p = Math.max(0, Math.min(100, parte || 0));
      alvo.innerHTML = `
        <div class="progresso" role="img" aria-label="${esc(rotuloEsq)}">
          <i style="width:${p.toFixed(1)}%;background:${cor || G.COR.primaria}"></i>
        </div>
        <div class="kpi-barra-legenda"><span>${esc(rotuloEsq)}</span><span>${esc(rotuloDir)}</span></div>`;
    },
  };

  /* ordena valores junto com rótulos, descartando os zeros */
  G.ranking = function (valores, rotulos, decrescente) {
    const pares = [];
    for (let i = 0; i < valores.length; i++) if (valores[i] > 0) pares.push([rotulos[i], valores[i]]);
    pares.sort((a, b) => (decrescente ? b[1] - a[1] : a[1] - b[1]));
    return { rotulos: pares.map((p) => p[0]), valores: pares.map((p) => p[1]) };
  };

  /* KPI: valor no id e texto de apoio no id + "Apoio" */
  G.kpi = function (id, valor, apoio) {
    const a = document.getElementById(id);
    if (a) a.textContent = valor;
    if (apoio !== undefined) {
      const b = document.getElementById(id + "Apoio");
      if (b) b.textContent = apoio;
    }
  };

  App.views.GraficoView = G;
})(window.App);
