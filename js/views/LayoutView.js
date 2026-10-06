/* =========================================================================
   views/LayoutView.js — moldura do painel: menu, topo, avisos, toasts,
   tela de espera e overlay de carregamento
   ========================================================================= */

(function (App) {
  "use strict";

  const { esc } = App.utils.texto;
  const { inteiro, moeda, pct } = App.utils.formato;
  const el = (id) => document.getElementById(id);
  const ICO_ALERTA = '<svg class="ico"><use href="#i-alerta"/></svg>';

  App.views.LayoutView = {
    /* título da aba e textos da marca vêm do config.js */
    aplicarMarca(marca) {
      document.title = marca.titulo;
      const forte = document.querySelector(".brand-text strong");
      const sub = document.querySelector(".brand-text small");
      if (forte) forte.textContent = marca.nome || marca.titulo;
      if (sub) sub.textContent = marca.sub || marca.subtitulo;
    },

    /* handlers: navegar(pagina) · recolher() · imprimir() · exportarCsv() · irParaEstados() */
    ligar(h) {
      const fecharMenu = () => document.body.classList.remove("menu-aberto");
      document.querySelectorAll(".nav-item").forEach((botao) =>
        botao.addEventListener("click", () => {
          fecharMenu();
          h.navegar(botao.dataset.pagina);
        })
      );
      /* celular/tablet: o menu é uma gaveta */
      el("btnMenu").addEventListener("click", () => document.body.classList.add("menu-aberto"));
      el("fundoMenu").addEventListener("click", fecharMenu);
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") fecharMenu();
      });
      el("btnAtualizarDados").addEventListener("click", fecharMenu);
      el("btnRecolher").addEventListener("click", h.recolher);
      el("imprimir").addEventListener("click", h.imprimir);
      el("exportarCsv").addEventListener("click", h.exportarCsv);
      el("avisoHost").addEventListener("click", (ev) => {
        if (ev.target.closest("#irParaEstados")) h.irParaEstados();
      });
    },

    mostrarPagina(destino) {
      let ativo = null;
      document.querySelectorAll(".nav-item").forEach((b) => {
        const sim = b.dataset.pagina === destino;
        b.classList.toggle("is-active", sim);
        if (sim) ativo = b;
      });
      document.querySelectorAll(".page").forEach((p) => (p.hidden = p.id !== destino));
      if (ativo) this.tituloDaPagina(ativo);
      window.scrollTo({ top: 0 });
    },

    tituloDaPagina(botao) {
      el("tituloPagina").textContent = botao.dataset.titulo;
      el("descricaoPagina").textContent = botao.dataset.descricao;
    },

    /* no desktop recolhe o menu; na gaveta (telas pequenas) só fecha */
    alternarMenu() {
      if (window.matchMedia("(max-width: 1024px)").matches) {
        document.body.classList.remove("menu-aberto");
        return;
      }
      document.body.classList.toggle("sidebar-collapsed");
      const recolhido = document.body.classList.contains("sidebar-collapsed");
      el("btnRecolher").setAttribute("aria-label", recolhido ? "Expandir menu" : "Recolher menu");
      el("btnRecolher").title = recolhido ? "Expandir menu" : "Recolher menu";
    },

    /* alterna entre a tela de espera e o painel */
    mostrarPainel(temDados, marca) {
      document.body.classList.toggle("sem-dados", !temDados);
      ["exportarCsv", "imprimir"].forEach((id) => {
        const b = el(id);
        if (b) b.disabled = !temDados;
      });

      if (temDados) {
        const ativo = document.querySelector(".nav-item.is-active");
        if (ativo) this.tituloDaPagina(ativo);
        return;
      }

      el("statusTexto").textContent = "aguardando base";
      el("statusFonte").textContent = "nenhuma planilha importada";
      el("statusPill").classList.remove("is-ok");
      el("statusPill").classList.add("is-atencao");
      el("avisoHost").innerHTML = "";
      /* o topo não deve anunciar uma análise que ainda não existe */
      el("tituloPagina").textContent = (marca.titulo || "Dashboard").replace(/^Dashboard\s*-\s*/, "");
      el("descricaoPagina").textContent = "Importe a base de dados para montar as análises.";
      this.geracao("aguardando importação");
    },

    geracao(texto) {
      document.querySelectorAll("[data-geracao]").forEach((x) => (x.textContent = texto || "—"));
    },

    status(qtd, periodo, fonte) {
      el("statusTexto").textContent = `${inteiro(qtd)} transações no filtro`;
      el("statusFonte").textContent = `· ${periodo} · ${fonte || "base importada"}`;
      const pill = el("statusPill");
      pill.classList.toggle("is-ok", qtd > 0);
      pill.classList.toggle("is-atencao", qtd === 0);
    },

    /* avisos: colunas não reconhecidas e PDVs sem localidade */
    avisos(lista) {
      el("avisoHost").innerHTML = lista
        .map((a) => {
          if (a.tipo === "semLocalidade") {
            return `
            <div class="aviso">
              <span class="aviso-ico" aria-hidden="true">${ICO_ALERTA}</span>
              <p>
                <strong>${esc(inteiro(a.pdvs))} PDVs sem localidade</strong>
                (${esc(pct(a.partePdv))} do parque) movimentaram ${esc(moeda(a.receita))},
                ${esc(pct(a.parteReceita))} da receita. Eles ficam fora do ranking por estado —
                confira o <code>ID_Unidade</code> na aba Maquinas e o Estado na aba Unidades.
              </p>
              <button class="aviso-link" type="button" id="irParaEstados">
                Ver na consulta por estado <svg class="ico ico-sm"><use href="#i-seta"/></svg>
              </button>
            </div>`;
          }
          return `
          <div class="aviso">
            <span class="aviso-ico" aria-hidden="true">${ICO_ALERTA}</span>
            <p><strong>${esc(a.titulo)}</strong> ${esc(a.detalhe || "")}
               Os valores aparecem como “Não informado” até a coluna ser reconhecida.</p>
          </div>`;
        })
        .join("");
    },

    carregando(ativo, texto) {
      const caixa = el("carregando");
      if (!caixa) return;
      if (texto) el("carregandoTexto").textContent = texto;
      caixa.hidden = !ativo;
    },

    toast(texto, tipo) {
      const host = el("toastHost");
      if (!host) return;
      const t = document.createElement("div");
      t.className = "toast" + (tipo ? " is-" + tipo : "");
      t.textContent = texto;
      host.appendChild(t);
      setTimeout(() => t.classList.add("is-out"), 3200);
      setTimeout(() => t.remove(), 3800);
    },

    /* entrega um arquivo gerado no navegador (CSV, base .json) */
    baixar(conteudo, nome, tipo) {
      const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
})(window.App);
