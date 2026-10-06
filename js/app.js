/* =========================================================================
   app.js — ponto de entrada (substitui o main.py)

   Cria os Models, entrega-os aos Controllers e tenta abrir a base salva.
   ========================================================================= */

(function (App) {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const painel = new App.models.PainelModel();
    const filtro = new App.models.FiltroModel();

    const dashboard = new App.controllers.DashboardController(painel, filtro);
    const filtros = new App.controllers.FiltroController(filtro, painel);
    const importacao = new App.controllers.ImportacaoController(dashboard);

    dashboard.iniciar();
    filtros.iniciar();
    importacao.iniciar();

    /* exposto para depuração no console (F12): App.instancia.painel.cubo etc. */
    App.instancia = { painel, filtro, dashboard, filtros, importacao };

    importacao.restaurarBaseSalva();
  });
})(window.App);
