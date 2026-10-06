/* =========================================================================
   utils/uf.js — nome por extenso das 27 unidades da federação

   A planilha traz só a sigla; a tabela por estado mostra "SP · São Paulo" e a
   busca aceita os dois. Valor que não é sigla conhecida aparece como veio.
   ========================================================================= */

(function (App) {
  "use strict";

  const NOMES = {
    AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
    DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
    MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
    PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
    SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
  };

  App.utils.uf = {
    /* "SP" -> "São Paulo"; outro texto -> null */
    nome: (sigla) => NOMES[String(sigla || "").trim().toUpperCase()] || null,
  };
})(window.App);
