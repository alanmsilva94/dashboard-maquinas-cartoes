/* =========================================================================
   models/BaseSalvaModel.js — persistência da base importada no navegador

   Guarda o cubo para que o gestor importe a pasta UMA vez e, nas próximas
   aberturas do index.html, o painel já monte sozinho.

   Onde: IndexedDB (funciona em file:// e tem cota de centenas de MB), com
   queda para localStorage (~5 MB) e, se nem ele existir, só a sessão.
   O cubo vai comprimido com gzip (CompressionStream, nativo).

   O nome do banco é o mesmo da versão anterior: quem já tinha importado a
   base continua com ela salva.
   ========================================================================= */

(function (App) {
  "use strict";

  const BANCO = "dashboard_maquinas_cartoes";
  const DEPOSITO = "base";
  const VERSAO_ESQUEMA = App.Config.versaoEsquema;
  const CHAVE_LS = "dashboard_maquinas_cartoes:base";

  const temIndexedDB = (() => {
    try {
      return typeof indexedDB !== "undefined" && indexedDB !== null;
    } catch (erro) {
      return false;
    }
  })();

  const temCompressao = typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

  /* ------------------------------------------------------------ compressão */

  async function comprimir(texto) {
    if (!temCompressao) return { dado: texto, comprimido: false };
    const fluxo = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
    return { dado: await new Response(fluxo).blob(), comprimido: true };
  }

  async function descomprimir(dado, comprimido) {
    if (!comprimido) return typeof dado === "string" ? dado : await new Response(dado).text();
    const blob = dado instanceof Blob ? dado : new Blob([dado]);
    const fluxo = blob.stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(fluxo).text();
  }

  /* ------------------------------------------------------------ IndexedDB */

  function abrir() {
    return new Promise((resolve, reject) => {
      const pedido = indexedDB.open(BANCO, 1);
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        if (!db.objectStoreNames.contains(DEPOSITO)) db.createObjectStore(DEPOSITO);
      };
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error || new Error("IndexedDB indisponível"));
      pedido.onblocked = () => reject(new Error("IndexedDB bloqueado por outra aba"));
    });
  }

  function transacao(db, modo, executar) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEPOSITO, modo);
      const deposito = tx.objectStore(DEPOSITO);
      let resultado;
      try {
        resultado = executar(deposito);
      } catch (erro) {
        reject(erro);
        return;
      }
      tx.oncomplete = () => resolve(resultado && resultado.result !== undefined ? resultado.result : resultado);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("transação abortada"));
    });
  }

  /* ------------------------------------------------------------ API */

  const Base = {
    disponivel() {
      return temIndexedDB || typeof localStorage !== "undefined";
    },

    /* grava o cubo e um resumo legível (pasta, data, tamanho) */
    async salvar(cubo, pasta) {
      const json = JSON.stringify(cubo);
      const { dado, comprimido } = await comprimir(json);
      const bytes = comprimido ? dado.size : json.length;
      const resumo = {
        esquema: VERSAO_ESQUEMA,
        pasta: pasta || "",
        salvo_em: new Date().toISOString(),
        gerado_em: cubo.meta.gerado_em,
        qtd_transacoes: cubo.meta.qtd_transacoes,
        periodo: `${cubo.meta.periodo_inicio} a ${cubo.meta.periodo_fim}`,
        bytes: bytes,
        comprimido: comprimido,
      };

      if (temIndexedDB) {
        let db;
        try {
          db = await abrir();
          await transacao(db, "readwrite", (d) => {
            d.put(dado, "cubo");
            d.put(resumo, "resumo");
          });
          db.close();
          return resumo;
        } catch (erro) {
          if (db) try { db.close(); } catch (e) {}
          /* cai para o localStorage abaixo */
          if (erro && erro.name === "QuotaExceededError") throw erro;
        }
      }

      /* queda: localStorage exige texto, então o gzip vira base64 */
      const texto = comprimido ? await blobParaBase64(dado) : json;
      localStorage.setItem(CHAVE_LS, JSON.stringify({ resumo: resumo, dado: texto }));
      return resumo;
    },

    /* devolve { cubo, resumo } ou null */
    async carregar() {
      if (temIndexedDB) {
        let db;
        try {
          db = await abrir();
          const resumo = await transacao(db, "readonly", (d) => pedido(d.get("resumo")));
          const dado = await transacao(db, "readonly", (d) => pedido(d.get("cubo")));
          db.close();
          if (resumo && dado && resumo.esquema === VERSAO_ESQUEMA) {
            return { cubo: JSON.parse(await descomprimir(dado, resumo.comprimido)), resumo: resumo };
          }
          if (resumo && resumo.esquema !== VERSAO_ESQUEMA) await Base.limpar();
        } catch (erro) {
          if (db) try { db.close(); } catch (e) {}
        }
      }

      try {
        const cru = localStorage.getItem(CHAVE_LS);
        if (!cru) return null;
        const { resumo, dado } = JSON.parse(cru);
        if (!resumo || resumo.esquema !== VERSAO_ESQUEMA) {
          localStorage.removeItem(CHAVE_LS);
          return null;
        }
        const bruto = resumo.comprimido ? base64ParaBlob(dado) : dado;
        return { cubo: JSON.parse(await descomprimir(bruto, resumo.comprimido)), resumo: resumo };
      } catch (erro) {
        return null;
      }
    },

    /* só o resumo, sem descomprimir o cubo (usado na janela de atualização) */
    async resumo() {
      if (temIndexedDB) {
        let db;
        try {
          db = await abrir();
          const r = await transacao(db, "readonly", (d) => pedido(d.get("resumo")));
          db.close();
          if (r && r.esquema === VERSAO_ESQUEMA) return r;
        } catch (erro) {
          if (db) try { db.close(); } catch (e) {}
        }
      }
      try {
        const cru = localStorage.getItem(CHAVE_LS);
        if (!cru) return null;
        const { resumo } = JSON.parse(cru);
        return resumo && resumo.esquema === VERSAO_ESQUEMA ? resumo : null;
      } catch (erro) {
        return null;
      }
    },

    async limpar() {
      if (temIndexedDB) {
        let db;
        try {
          db = await abrir();
          await transacao(db, "readwrite", (d) => {
            d.delete("cubo");
            d.delete("resumo");
          });
          db.close();
        } catch (erro) {
          if (db) try { db.close(); } catch (e) {}
        }
      }
      try {
        localStorage.removeItem(CHAVE_LS);
      } catch (erro) {
        /* nada a fazer */
      }
    },
  };

  /* envolve um IDBRequest para o helper de transação */
  function pedido(req) {
    const envelope = {};
    req.onsuccess = () => {
      envelope.result = req.result;
    };
    return envelope;
  }

  function blobParaBase64(blob) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result).split(",")[1]);
      leitor.onerror = () => reject(leitor.error);
      leitor.readAsDataURL(blob);
    });
  }

  function base64ParaBlob(base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes]);
  }

  /* comprimir/descomprimir também servem para exportar e importar a base em arquivo */
  Base.comprimir = comprimir;
  Base.descomprimir = descomprimir;

  App.models.BaseSalvaModel = Base;
})(window.App);
