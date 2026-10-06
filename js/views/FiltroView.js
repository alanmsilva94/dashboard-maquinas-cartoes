/* =========================================================================
   views/FiltroView.js — barra de filtros: multiselects, período e chips

   Desenha a partir do FiltroModel e devolve as intenções do usuário pelos
   handlers do FiltroController. Não altera estado por conta própria.
   ========================================================================= */

(function (App) {
  "use strict";

  const { esc } = App.utils.texto;
  const el = (id) => document.getElementById(id);

  const CARET =
    '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 3l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

  function fecharPopovers() {
    document.querySelectorAll("#filtroCampos .ms.is-open").forEach((ms) => {
      ms.classList.remove("is-open");
      ms.querySelector(".ms-pop").hidden = true;
      ms.querySelector(".ms-toggle").setAttribute("aria-expanded", "false");
    });
  }

  App.views.FiltroView = {
    fecharPopovers,

    /* (re)cria os campos para uma base nova */
    montar(filtro, rotulosMes) {
      el("filtroCampos").innerHTML = filtro.definicoes
        .map(
          (f) => `
        <div class="ms" data-chave="${esc(f.chave)}">
          <button class="ms-toggle" type="button" aria-expanded="false">
            <span class="ms-label">${esc(f.titulo)}</span>
            <span class="ms-value" data-resumo="${esc(f.chave)}"></span>
          </button>
          <span class="ms-caret" aria-hidden="true">${CARET}</span>
          <div class="ms-pop" hidden>
            <div class="ms-actions">
              <button type="button" data-acao="todos">Marcar todos</button>
              <button type="button" data-acao="nenhum">Limpar</button>
            </div>
            ${f.opcoes.length > 8
              ? '<div class="ms-search"><input type="search" placeholder="Buscar…" aria-label="Buscar opção"></div>'
              : ""}
            <div class="ms-list">
              ${f.opcoes
                .map(
                  (o, i) => `
                <label class="ms-item" title="${esc(o)}">
                  <input type="checkbox" data-chave="${esc(f.chave)}" value="${i}" checked>
                  <span>${esc(o)}</span>
                </label>`
                )
                .join("")}
            </div>
            <p class="ms-vazio" hidden>Nada encontrado.</p>
          </div>
        </div>`
        )
        .join("");

      this._rotulosMes = rotulosMes;
      const opcoes = rotulosMes.map((m, i) => `<option value="${i}">${esc(m)}</option>`).join("");
      el("mesDe").innerHTML = opcoes;
      el("mesAte").innerHTML = opcoes;
      this.atualizar(filtro);
    },

    /* sincroniza checkboxes, selects, resumos e chips com o Model */
    atualizar(filtro) {
      el("mesDe").value = String(filtro.mesDe);
      el("mesAte").value = String(filtro.mesAte);

      document.querySelectorAll('#filtroCampos input[type="checkbox"][data-chave]').forEach((cb) => {
        cb.checked = filtro.selecao[cb.dataset.chave].has(parseInt(cb.value, 10));
      });

      filtro.definicoes.forEach((f) => {
        const alvo = document.querySelector(`[data-resumo="${f.chave}"]`);
        if (alvo) alvo.textContent = filtro.resumo(f.chave);
        const ms = document.querySelector(`.ms[data-chave="${f.chave}"]`);
        if (ms) ms.classList.toggle("is-filled", filtro.filtrado(f.chave));
      });

      this.renderChips(filtro);
    },

    renderChips(filtro) {
      const caixa = el("chips");
      if (!caixa) return;
      const rotulos = this._rotulosMes || [];
      const chips = [];

      if (!filtro.periodoCompleto()) {
        const rotulo =
          filtro.mesDe === filtro.mesAte
            ? rotulos[filtro.mesDe]
            : `${rotulos[filtro.mesDe]} – ${rotulos[filtro.mesAte]}`;
        chips.push(`<button class="chip" type="button" data-periodo="1" title="Remover filtro">
             <strong>Período:</strong> ${esc(rotulo)} <span class="chip-x" aria-hidden="true">×</span>
           </button>`);
      }

      filtro.definicoes.forEach((f) => {
        if (!filtro.filtrado(f.chave)) return;
        chips.push(`<button class="chip" type="button" data-chave="${esc(f.chave)}" title="Remover filtro">
             <strong>${esc(f.titulo)}:</strong> ${esc(filtro.resumo(f.chave))}
             <span class="chip-x" aria-hidden="true">×</span>
           </button>`);
      });

      const limpar = el("limparTudo");
      if (limpar) limpar.hidden = !chips.length;
      caixa.innerHTML = chips.length
        ? chips.join("")
        : '<span class="chip-vazio">Nenhum — período completo e todas as opções marcadas.</span>';
    },

    /* handlers: marcar(chave, i, ok) · marcarVarios(chave, [i], ok) · periodo(de, ate, quem)
                 limparFiltro(chave) · limparPeriodo() · limparTudo() · podeAbrir() */
    ligar(h) {
      const campos = el("filtroCampos");

      campos.addEventListener("click", (ev) => {
        const toggle = ev.target.closest(".ms-toggle");
        if (toggle) {
          const ms = toggle.closest(".ms");
          const abrindo = !ms.classList.contains("is-open");
          fecharPopovers();
          ms.classList.toggle("is-open", abrindo);
          toggle.setAttribute("aria-expanded", String(abrindo));
          ms.querySelector(".ms-pop").hidden = !abrindo;
          if (abrindo) {
            const busca = ms.querySelector('input[type="search"]');
            if (busca) busca.focus();
          }
          return;
        }

        const acao = ev.target.closest("[data-acao]");
        if (acao) {
          const ms = acao.closest(".ms");
          /* "Marcar todos"/"Limpar" valem só para o que a busca está mostrando */
          const indices = Array.from(ms.querySelectorAll('input[type="checkbox"]'))
            .filter((cb) => !cb.closest(".ms-item").hidden)
            .map((cb) => parseInt(cb.value, 10));
          h.marcarVarios(ms.dataset.chave, indices, acao.dataset.acao === "todos");
        }
      });

      campos.addEventListener("change", (ev) => {
        const cb = ev.target;
        if (!cb.matches('input[type="checkbox"][data-chave]')) return;
        h.marcar(cb.dataset.chave, parseInt(cb.value, 10), cb.checked);
      });

      campos.addEventListener("input", (ev) => {
        if (!ev.target.matches('input[type="search"]')) return;
        const ms = ev.target.closest(".ms");
        const termo = ev.target.value.trim().toLowerCase();
        let visiveis = 0;
        ms.querySelectorAll(".ms-item").forEach((item) => {
          const bate = item.textContent.trim().toLowerCase().includes(termo);
          item.hidden = !bate;
          if (bate) visiveis++;
        });
        ms.querySelector(".ms-vazio").hidden = visiveis > 0;
      });

      document.addEventListener("click", (ev) => {
        if (!ev.target.closest(".ms")) fecharPopovers();
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") fecharPopovers();
      });

      ["mesDe", "mesAte"].forEach((id) =>
        el(id).addEventListener("change", () =>
          h.periodo(parseInt(el("mesDe").value, 10), parseInt(el("mesAte").value, 10), id === "mesDe" ? "de" : "ate")
        )
      );

      el("btnFiltros").addEventListener("click", () => {
        if (!h.podeAbrir()) return;
        const painel = el("filtroPainel");
        const abrindo = painel.hidden;
        painel.hidden = !abrindo;
        el("btnFiltros").classList.toggle("is-open", abrindo);
        el("btnFiltros").setAttribute("aria-expanded", String(abrindo));
      });

      el("limparTudo").addEventListener("click", h.limparTudo);

      el("chips").addEventListener("click", (ev) => {
        const chip = ev.target.closest(".chip");
        if (!chip) return;
        if (chip.dataset.periodo) return h.limparPeriodo();
        if (chip.dataset.chave) h.limparFiltro(chip.dataset.chave);
      });
    },
  };
})(window.App);
