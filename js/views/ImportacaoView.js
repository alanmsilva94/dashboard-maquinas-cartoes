/* =========================================================================
   views/ImportacaoView.js — janela "Atualizar dados" e seu log
   ========================================================================= */

(function (App) {
  "use strict";

  const { inteiro, dataHora } = App.utils.formato;
  const el = (id) => document.getElementById(id);

  const contagem = { avisos: 0, erros: 0 };

  function atualizarContador() {
    const alvo = el("logContador");
    if (!alvo) return;
    const partes = [];
    if (contagem.erros) partes.push(`${contagem.erros} erro(s)`);
    if (contagem.avisos) partes.push(`${contagem.avisos} aviso(s)`);
    alvo.textContent = partes.join(" · ");
  }

  function escrever(texto, classe) {
    const area = el("logDados");
    if (!area) return;
    const linha = document.createElement("p");
    linha.className = "log-linha" + (classe ? " " + classe : "");
    const hora = document.createElement("time");
    hora.textContent = new Date().toLocaleTimeString("pt-BR");
    linha.append(hora, texto);
    area.appendChild(linha);
    area.scrollTop = area.scrollHeight;
    if (classe === "log-aviso") contagem.avisos++;
    if (classe === "log-erro") contagem.erros++;
    atualizarContador();
  }

  /* Lê o que foi solto na área: arquivos avulsos ou uma pasta inteira (só o
     primeiro nível, como no seletor). Devolve { arquivos, nome }. */
  async function lerSoltos(dados) {
    const itens = Array.from(dados.items || []);
    const entradas = itens.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
    const pasta = entradas.find((e) => e.isDirectory);
    if (!pasta) return { arquivos: Array.from(dados.files || []), nome: "arquivos soltos" };

    const leitor = pasta.createReader();
    const todas = [];
    /* readEntries entrega em lotes: repete até vir vazio */
    for (;;) {
      const lote = await new Promise((ok, falha) => leitor.readEntries(ok, falha));
      if (!lote.length) break;
      todas.push(...lote);
    }
    const arquivos = await Promise.all(
      todas.filter((e) => e.isFile).map((e) => new Promise((ok, falha) => e.file(ok, falha)))
    );
    return { arquivos, nome: pasta.name };
  }

  const View = {
    /* objeto de log entregue aos Models (eles não conhecem o DOM) */
    log: {
      info: (t) => escrever(t),
      aviso: (t) => escrever("⚠ " + t, "log-aviso"),
      erro: (t) => escrever("✕ " + t, "log-erro"),
      ok: (t) => escrever("✓ " + t, "log-ok"),
      limpar: () => {
        const area = el("logDados");
        if (area) area.innerHTML = "";
        contagem.avisos = contagem.erros = 0;
        atualizarContador();
      },
    },

    abrir() {
      el("modalDados").hidden = false;
      el("btnEscolherPasta").focus();
    },

    fechar() {
      el("modalDados").hidden = true;
      el("btnAtualizarDados").focus();
    },

    aberta: () => !el("modalDados").hidden,

    ocupado(ativo, mensagem) {
      ["btnEscolherPasta", "btnRelerPasta", "btnAbrirBase", "btnExportarBase"].forEach((id) => {
        const b = el(id);
        if (b) b.disabled = ativo;
      });
      el("statusDados").textContent = mensagem || "";
    },

    pasta(nome) {
      el("pastaEscolhida").textContent = nome ? `Pasta: ${nome}` : "Nenhuma pasta escolhida ainda.";
    },

    botoes({ reler, exportar }) {
      if (reler !== undefined) el("btnRelerPasta").hidden = !reler;
      if (exportar !== undefined) el("btnExportarBase").hidden = !exportar;
    },

    baseSalva(resumo) {
      const alvo = el("baseSalvaInfo");
      el("btnApagarSalva").hidden = !resumo;
      if (!resumo) {
        alvo.textContent = "Nenhuma base salva neste navegador.";
        return;
      }
      alvo.textContent =
        `Base salva: ${resumo.pasta || "pasta escolhida"} · ${resumo.periodo} · ` +
        `${inteiro(resumo.qtd_transacoes)} transações · importada em ${dataHora(new Date(resumo.salvo_em))}`;
    },

    /* sem SheetJS não há como ler .xlsx: o botão some */
    desativar() {
      el("btnAtualizarDados").hidden = true;
    },

    /* abre o seletor de pastas clássico (funciona em file://) */
    abrirSeletorPasta() {
      el("inputPasta").value = "";
      el("inputPasta").click();
    },

    abrirSeletorBase() {
      el("inputBase").value = "";
      el("inputBase").click();
    },

    /* handlers: escolherPasta · relerPasta · apagarSalva · exportarBase · abrirBase
                 arquivosDaPasta(files, nomePasta) · arquivoDeBase(file) · importarDaTelaVazia */
    ligar(h) {
      el("btnAtualizarDados").addEventListener("click", h.abrirJanela);
      el("btnFecharModal").addEventListener("click", () => View.fechar());
      el("btnFecharRodape").addEventListener("click", () => View.fechar());

      /* áreas de soltar (tela de espera e janela): clique abre o seletor */
      document.querySelectorAll("[data-zona-soltar]").forEach((zona) => {
        const naTelaVazia = !zona.closest("#modalDados");
        const clicar = () => (naTelaVazia ? h.importarDaTelaVazia() : h.escolherPasta());
        zona.addEventListener("click", clicar);
        zona.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            clicar();
          }
        });
        zona.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "copy";
          zona.classList.add("is-sobre");
        });
        zona.addEventListener("dragleave", () => zona.classList.remove("is-sobre"));
        zona.addEventListener("drop", async (ev) => {
          ev.preventDefault();
          zona.classList.remove("is-sobre");
          try {
            const { arquivos, nome } = await lerSoltos(ev.dataTransfer);
            if (arquivos.length) h.arquivosSoltos(arquivos, nome);
          } catch (erro) {
            View.abrir();
            View.log.erro("não foi possível ler o que foi solto: " + erro.message);
          }
        });
      });
      /* soltar fora da área não deve fazer o navegador abrir o arquivo */
      ["dragover", "drop"].forEach((tipo) => window.addEventListener(tipo, (ev) => ev.preventDefault()));
      el("modalDados").addEventListener("click", (ev) => {
        if (ev.target === el("modalDados")) View.fechar();
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && View.aberta()) View.fechar();
      });

      el("btnEscolherPasta").addEventListener("click", h.escolherPasta);
      el("btnRelerPasta").addEventListener("click", h.relerPasta);
      el("btnApagarSalva").addEventListener("click", h.apagarSalva);
      el("btnExportarBase").addEventListener("click", h.exportarBase);
      el("btnAbrirBase").addEventListener("click", () => View.abrirSeletorBase());
      const importar = el("btnImportar");
      if (importar) importar.addEventListener("click", h.importarDaTelaVazia);

      el("inputPasta").addEventListener("change", (ev) => {
        const arquivos = Array.from(ev.target.files || []);
        if (!arquivos.length) return;
        const caminho = arquivos[0].webkitRelativePath || "";
        h.arquivosDaPasta(arquivos, caminho.includes("/") ? caminho.split("/")[0] : "seleção manual");
      });

      el("inputBase").addEventListener("change", (ev) => {
        const arquivo = ev.target.files && ev.target.files[0];
        if (arquivo) h.arquivoDeBase(arquivo);
      });
    },
  };

  App.views.ImportacaoView = View;
})(window.App);
