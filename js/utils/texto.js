/* =========================================================================
   utils/texto.js — normalização de texto, número e data (substitui utils.py)

   Tolera as variações das planilhas feitas à mão: acentos, caixa, espaços
   extras, "R$ 1.234,56", datas em texto ou como serial do Excel.
   ========================================================================= */

(function (App) {
  "use strict";

  /* 'Desc.Região ' -> 'descregiao'. Base de toda comparação de nomes. */
  function slug(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  /* devolve o cabeçalho real cujo slug bate com um dos apelidos */
  function acharColuna(cabecalhos, aliases) {
    const mapa = new Map();
    cabecalhos.forEach((c) => mapa.set(slug(c), c));
    for (const alias of aliases) {
      const k = slug(alias);
      if (mapa.has(k)) return mapa.get(k);
    }
    /* segunda passada: correspondência parcial ('valortransacao' em 'valordatransacao') */
    for (const alias of aliases) {
      const k = slug(alias);
      if (!k) continue;
      for (const [chave, real] of mapa) {
        if (chave.includes(k) || k.includes(chave)) return real;
      }
    }
    return null;
  }

  /* tira espaços das pontas, colapsa os internos; vazio, "-" e "nan" viram padrão */
  function texto(v, padrao) {
    if (v === null || v === undefined) return padrao;
    const t = String(v).trim().replace(/\s+/g, " ");
    if (!t || t === "-" || t.toLowerCase() === "nan") return padrao;
    return t;
  }

  /* equivale ao .str.title() do pandas ("Centro-Oeste", não "Centro-oeste") */
  function capitalizar(t) {
    return t.replace(/\p{L}+/gu, (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  }

  const naoInformado = (v) => texto(v, "") === "";

  /* padroniza chaves de junção (PDV / ID): 1234.0 -> "1234", maiúsculas */
  function chave(v) {
    if (v === null || v === undefined) return null;
    const t = String(v).trim().replace(/\.0$/, "").toUpperCase();
    if (!t || t === "NAN" || t === "NONE") return null;
    return t;
  }

  /* aceita 1234.56 | "1.234,56" | "R$ 1.234,56" | "(50,00)" */
  function paraFloat(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (v === null || v === undefined) return null;

    let t = String(v).trim().replace(/r\$/gi, "").replace(/[\s ]/g, "");
    if (!t) return null;

    let negativo = false;
    if (t.startsWith("(") && t.endsWith(")")) {
      negativo = true;
      t = t.slice(1, -1);
    }
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");

    const n = parseFloat(t);
    if (!isFinite(n)) return null;
    return negativo ? -n : n;
  }

  /* aceita Date | serial do Excel | "dd/mm/aaaa" | "aaaa-mm-dd" */
  function paraData(v) {
    if (v instanceof Date && !isNaN(v)) return v;
    if (typeof v === "number" && isFinite(v)) {
      return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    }
    if (!v) return null;

    const t = String(v).trim();
    let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      let ano = parseInt(m[3], 10);
      if (ano < 100) ano += 2000;
      return new Date(ano, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    }
    m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    const d = new Date(t);
    return isNaN(d) ? null : d;
  }

  /* os rótulos vêm de planilha: sempre escapar antes de injetar HTML */
  const esc = (t) =>
    String(t === null || t === undefined ? "" : t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const ordenarPt = (conjunto) => Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const indexar = (lista) => {
    const m = new Map();
    lista.forEach((v, i) => m.set(v, i));
    return m;
  };

  App.utils.texto = {
    slug, acharColuna, texto, capitalizar, naoInformado, chave,
    paraFloat, paraData, esc, ordenarPt, indexar,
  };
})(window.App);
