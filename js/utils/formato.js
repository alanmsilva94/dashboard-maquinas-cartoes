/* =========================================================================
   utils/formato.js — formatação pt-BR de moeda, inteiro e percentual
   ========================================================================= */

(function (App) {
  "use strict";

  const nfMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const nfMoeda0 = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
  const nfInt = new Intl.NumberFormat("pt-BR");
  const nfDec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  App.utils.formato = {
    moeda: (v) => nfMoeda.format(v || 0),
    moedaCurta: (v) => nfMoeda0.format(v || 0),
    inteiro: (v) => nfInt.format(v || 0),
    decimal: (v) => nfDec.format(v || 0),
    pct: (v) => nfDec.format(v || 0) + "%",
    mb: (bytes) => (bytes / 1048576).toFixed(2) + " MB",
    /* "2026-03" -> "mar/26" */
    rotuloMes: (am) => `${MESES_CURTOS[+am.slice(5) - 1]}/${am.slice(2, 4)}`,
    dataHora: (d) =>
      `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
  };
})(window.App);
