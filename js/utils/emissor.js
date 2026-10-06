/* =========================================================================
   utils/emissor.js — publicação/assinatura de eventos

   É o que mantém o MVC desacoplado: o Model avisa "mudei", o Controller
   escuta e manda a View redesenhar. A View nunca conhece o Model.
   ========================================================================= */

(function (App) {
  "use strict";

  class Emissor {
    constructor() {
      this._ouvintes = new Map();
    }

    on(evento, fn) {
      if (!this._ouvintes.has(evento)) this._ouvintes.set(evento, new Set());
      this._ouvintes.get(evento).add(fn);
      return () => this._ouvintes.get(evento).delete(fn);
    }

    emit(evento, dados) {
      const lista = this._ouvintes.get(evento);
      if (lista) lista.forEach((fn) => fn(dados));
    }
  }

  App.utils.Emissor = Emissor;
})(window.App);
