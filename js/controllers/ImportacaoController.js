/* =========================================================================
   controllers/ImportacaoController.js — pasta de planilhas -> cubo -> painel

   Orquestra: PlanilhaModel (lê .xlsx) -> CuboModel (agrega) ->
   DashboardController.carregar() -> BaseSalvaModel (guarda no navegador).

   Limite do navegador: um HTML aberto por file:// não lê um caminho digitado
   ("\\host\pasta"); só a pasta escolhida no seletor nativo. Onde a API de
   diretórios existe (página servida por http/https), a permissão é guardada e
   "Reler pasta" funciona com um clique.
   ========================================================================= */

(function (App) {
  "use strict";

  const M = App.models;
  const V = App.views;
  const View = V.ImportacaoView;
  const log = View.log;
  const { inteiro, mb } = App.utils.formato;

  class ImportacaoController {
    constructor(dashboard) {
      this.dashboard = dashboard;
      this.pastaHandle = null; /* só existe onde a API de diretórios funciona */
      this.nomePasta = null;
    }

    iniciar() {
      if (typeof XLSX === "undefined") {
        View.desativar();
        return;
      }
      View.ligar({
        abrirJanela: () => this.abrirJanela(),
        importarDaTelaVazia: () => {
          this.abrirJanela();
          this.escolherPasta();
        },
        escolherPasta: () => this.escolherPasta(),
        relerPasta: () => this.relerPasta(),
        apagarSalva: () => this.apagarBaseSalva(),
        exportarBase: () => this.exportarBase(),
        arquivosDaPasta: (arquivos, nome) => {
          this.nomePasta = nome;
          this.pastaHandle = null;
          View.pasta(nome);
          this.processar(arquivos, `pasta ${nome}`);
        },
        arquivoDeBase: (arquivo) => this.abrirArquivoDeBase(arquivo),
        arquivosSoltos: (arquivos, nome) => {
          this.abrirJanela();
          this.nomePasta = nome;
          this.pastaHandle = null;
          View.pasta(nome);
          this.processar(arquivos, nome === "arquivos soltos" ? nome : `pasta ${nome}`);
        },
      });
    }

    async abrirJanela() {
      View.abrir();
      View.baseSalva(await M.BaseSalvaModel.resumo());
    }

    /* ---------------------------------------------------- leitura da pasta */

    async processar(arquivos, rotuloFonte) {
      log.limpar();
      View.ocupado(true, "Lendo as planilhas…");
      try {
        const base = await M.PlanilhaModel.ler(arquivos, log);
        log.info("montando as análises…");
        await new Promise((r) => setTimeout(r, 0));

        const cubo = M.CuboModel.montar(base, rotuloFonte);
        if (cubo.meta.orfaos) log.aviso(`${cubo.meta.orfaos} PDV(s) com transação e sem cadastro na aba Maquinas`);
        if (cubo.meta.linhas_cubo > App.Config.limiteLinhasCubo) {
          log.aviso(`cubo grande (${inteiro(cubo.meta.linhas_cubo)} linhas): os filtros podem ficar mais lentos`);
        }

        this.dashboard.carregar(cubo);
        await this.salvarBase(cubo, rotuloFonte);

        log.ok(
          `${base.planilhas} planilha(s), ${inteiro(cubo.meta.qtd_transacoes)} transações, ` +
            `período de ${cubo.meta.periodo_inicio} a ${cubo.meta.periodo_fim}`
        );
        View.botoes({ reler: true, exportar: true });
        View.ocupado(false, "Dashboard atualizado.");
        V.LayoutView.toast(
          `Dashboard atualizado: ${base.planilhas} planilha(s), ${inteiro(cubo.meta.qtd_transacoes)} transações.`,
          "ok"
        );
        if (base.avisos.length) {
          V.LayoutView.toast(`${base.avisos.length} coluna(s) da planilha não foram reconhecidas — veja o aviso no topo.`, "aviso");
        }
      } catch (erro) {
        log.erro(erro.message);
        View.ocupado(false, "Nada foi alterado. O dashboard segue com os dados anteriores.");
        V.LayoutView.toast("Não foi possível ler a pasta. Veja o detalhe na janela.", "aviso");
      }
    }

    /* caminho A: API de diretórios (http/https) — guarda a permissão */
    async coletarDoHandle(handle) {
      const arquivos = [];
      for await (const entrada of handle.values()) {
        if (entrada.kind === "file" && M.PlanilhaModel.ehPlanilha(entrada.name)) {
          arquivos.push(await entrada.getFile());
        }
      }
      return arquivos;
    }

    async escolherPasta() {
      if (window.showDirectoryPicker) {
        try {
          const handle = await window.showDirectoryPicker({ mode: "read" });
          this.pastaHandle = handle;
          this.nomePasta = handle.name;
          View.pasta(handle.name);
          await this.processar(await this.coletarDoHandle(handle), `pasta ${handle.name}`);
          return;
        } catch (erro) {
          if (erro && erro.name === "AbortError") return; /* usuário cancelou */
          log.info("seletor avançado indisponível neste modo; abrindo o seletor do sistema");
        }
      }
      /* caminho B: seletor de pastas do sistema (funciona em file://) */
      View.abrirSeletorPasta();
    }

    async relerPasta() {
      const h = this.pastaHandle;
      if (!h) return View.abrirSeletorPasta(); /* sem handle: reabre o seletor */
      if ((await h.queryPermission({ mode: "read" })) !== "granted" &&
          (await h.requestPermission({ mode: "read" })) !== "granted") {
        log.erro("permissão de leitura recusada para a pasta.");
        return;
      }
      await this.processar(await this.coletarDoHandle(h), `pasta ${this.nomePasta}`);
    }

    /* ---------------------------------------------------- base salva */

    async salvarBase(cubo, rotuloFonte) {
      const B = M.BaseSalvaModel;
      if (!B.disponivel()) {
        log.aviso("este navegador não permite guardar a base; ela vale só para esta sessão");
        return;
      }
      try {
        const resumo = await B.salvar(cubo, this.nomePasta || rotuloFonte);
        log.ok(`base salva no navegador (${mb(resumo.bytes)}) — na próxima vez o painel abre pronto`);
        View.baseSalva(resumo);
      } catch (erro) {
        log.aviso(
          erro && erro.name === "QuotaExceededError"
            ? "base grande demais para o armazenamento do navegador; vale só para esta sessão"
            : "não foi possível salvar a base: " + (erro && erro.message ? erro.message : erro)
        );
      }
    }

    /* na abertura: sobe a base salva antes de mostrar a tela de espera */
    async restaurarBaseSalva() {
      const B = M.BaseSalvaModel;
      if (!B.disponivel()) return;

      V.LayoutView.carregando(true, "Procurando base salva…");
      const resumo = await B.resumo();
      if (!resumo) {
        V.LayoutView.carregando(false);
        return;
      }

      V.LayoutView.carregando(true, `Carregando a base salva (${resumo.periodo})…`);
      try {
        const salvo = await B.carregar();
        if (!salvo || !M.CuboModel.valido(salvo.cubo)) throw new Error("base salva ilegível");
        salvo.cubo.meta.fonte = `base salva · ${resumo.pasta || "pasta importada"}`;
        this.dashboard.carregar(salvo.cubo);
        this.nomePasta = resumo.pasta || null;
        View.pasta(this.nomePasta);
        View.botoes({ reler: true, exportar: true });
        V.LayoutView.toast("Base salva carregada. Use Atualizar dados para trocar a pasta.", "ok");
      } catch (erro) {
        await B.limpar();
        V.LayoutView.toast("A base salva estava corrompida e foi descartada.", "aviso");
      } finally {
        V.LayoutView.carregando(false);
        View.baseSalva(await B.resumo());
      }
    }

    async apagarBaseSalva() {
      await M.BaseSalvaModel.limpar();
      View.baseSalva(null);
      log.ok("base salva apagada. Ao reabrir o arquivo, o painel pedirá a importação.");
      V.LayoutView.toast("Base salva apagada.", "aviso");
    }

    /* ---------------------------------------------------- base em arquivo
       Substitui o antigo EMBUTIR_DADOS / --salvar-json: quem importou exporta
       um .json.gz, e outro gestor abre esse arquivo sem precisar das planilhas. */

    async exportarBase() {
      const cubo = this.dashboard.painel.cubo;
      if (!cubo) return;
      const { dado, comprimido } = await M.BaseSalvaModel.comprimir(JSON.stringify(cubo));
      const nome = `base_dashboard_${cubo.dicionarios.ano_mes[0] || ""}_a_${
        cubo.dicionarios.ano_mes[cubo.dicionarios.ano_mes.length - 1] || ""
      }.json${comprimido ? ".gz" : ""}`;
      V.LayoutView.baixar(dado, nome, comprimido ? "application/gzip" : "application/json");
      log.ok(`base exportada: ${nome}`);
    }

    async abrirArquivoDeBase(arquivo) {
      log.limpar();
      View.ocupado(true, "Abrindo arquivo de base…");
      try {
        const gz = /\.gz$/i.test(arquivo.name);
        const texto = await M.BaseSalvaModel.descomprimir(arquivo, gz);
        const cubo = JSON.parse(texto);
        if (!M.CuboModel.valido(cubo)) throw new Error("o arquivo não é uma base deste painel.");
        cubo.meta.fonte = `arquivo ${arquivo.name}`;
        this.dashboard.carregar(cubo);
        this.nomePasta = arquivo.name;
        await this.salvarBase(cubo, cubo.meta.fonte);
        View.botoes({ exportar: true });
        View.ocupado(false, "Dashboard atualizado.");
        log.ok(`${inteiro(cubo.meta.qtd_transacoes)} transações, de ${cubo.meta.periodo_inicio} a ${cubo.meta.periodo_fim}`);
        V.LayoutView.toast("Base carregada do arquivo.", "ok");
      } catch (erro) {
        log.erro("não foi possível abrir: " + erro.message);
        View.ocupado(false, "Nada foi alterado.");
      }
    }
  }

  App.controllers.ImportacaoController = ImportacaoController;
})(window.App);
