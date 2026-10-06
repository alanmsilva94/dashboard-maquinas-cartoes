/* =========================================================================
   controllers/FiltroController.js — traduz cliques da barra de filtros em
   alterações no FiltroModel (que, por sua vez, avisa o DashboardController)
   ========================================================================= */

(function (App) {
  "use strict";

  class FiltroController {
    constructor(filtro, painel) {
      this.filtro = filtro;
      this.painel = painel;
    }

    iniciar() {
      const f = this.filtro;
      /* no celular os campos começam recolhidos: os chips já mostram o que vale */
      if (window.matchMedia("(max-width: 640px)").matches) {
        document.getElementById("filtroPainel").hidden = true;
        document.getElementById("btnFiltros").setAttribute("aria-expanded", "false");
      }
      App.views.FiltroView.ligar({
        podeAbrir: () => this.painel.temDados,
        marcar: (chave, i, ok) => f.marcar(chave, i, ok),
        marcarVarios: (chave, lista, ok) => f.marcarVarios(chave, lista, ok),
        periodo: (de, ate, quem) => f.definirPeriodo(de, ate, quem),
        limparFiltro: (chave) => f.limparFiltro(chave),
        limparPeriodo: () => f.limparPeriodo(),
        limparTudo: () => f.limparTudo(),
      });
    }
  }

  App.controllers.FiltroController = FiltroController;
})(window.App);
