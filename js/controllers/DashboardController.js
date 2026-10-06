/* =========================================================================
   controllers/DashboardController.js — liga os Models às Views do painel

   Fluxo:  FiltroModel "mudou"  ->  PainelModel.agregar()  ->  View da página
   Só a página visível é desenhada; as outras ficam marcadas como "sujas" e
   são desenhadas quando o usuário navega até elas.
   ========================================================================= */

(function (App) {
  "use strict";

  const V = App.views;
  const { inteiro } = App.utils.formato;

  class DashboardController {
    constructor(painel, filtro) {
      this.painel = painel;
      this.filtro = filtro;
      this.ultimo = null;
      this.sujas = new Set();
    }

    iniciar() {
      V.GraficoView.lerTokens();
      V.LayoutView.aplicarMarca(App.Config.marca);

      V.LayoutView.ligar({
        navegar: (p) => this.filtro.irPara(p),
        recolher: () => {
          V.LayoutView.alternarMenu();
          setTimeout(V.GraficoView.redimensionar, 260);
        },
        imprimir: () => window.print(),
        exportarCsv: () => this.exportarCsv(),
        irParaEstados: () => this.filtro.irPara("p3"),
      });

      V.EstadoView.ligar({
        ordenar: (col) => this.filtro.ordenarPor(col),
        alternar: (idx) => this.filtro.alternarEstado(idx),
        alternarTodos: () => {
          if (this.ultimo) this.filtro.alternarTodos(this.painel.linhasEstado(this.ultimo).map((l) => l.idx));
        },
        buscar: (texto) => this.filtro.buscar(texto),
      });

      this.filtro.on("mudou", () => this.atualizar());
      this.filtro.on("tabela", () => this.redesenharTabela());
      this.filtro.on("pagina", (p) => {
        V.LayoutView.mostrarPagina(p);
        this.renderPaginaAtual();
        V.GraficoView.redimensionar();
      });

      let espera = null;
      window.addEventListener("resize", () => {
        clearTimeout(espera);
        espera = setTimeout(V.GraficoView.redimensionar, 180);
      });

      V.LayoutView.mostrarPainel(false, App.Config.marca);
    }

    /* troca a base inteira (importação, base salva ou arquivo .json) */
    carregar(cubo) {
      V.GraficoView.apagarTodos();
      V.LocalidadeView.reiniciar();
      V.EstadoView.reiniciar();

      this.painel.carregar(cubo);
      this.filtro.configurar(this.painel.dic);
      V.FiltroView.montar(this.filtro, this.painel.dic.ano_mes_rotulo);
      V.LayoutView.geracao(cubo.meta.gerado_em);
      V.LayoutView.mostrarPainel(true);

      this.atualizar();
      V.GraficoView.redimensionar();
    }

    atualizar() {
      if (!this.painel.temDados) return;
      this.ultimo = this.painel.agregar(this.filtro);
      ["p1", "p2", "p3"].forEach((p) => this.sujas.add(p));
      this.renderPaginaAtual();

      V.FiltroView.atualizar(this.filtro);
      V.LayoutView.status(this.ultimo.qtd, this.rotuloPeriodo(), this.painel.cubo.meta.fonte);
      V.LayoutView.avisos(this.painel.avisos(this.ultimo));
    }

    renderPaginaAtual() {
      const p = this.filtro.pagina;
      if (!this.painel.temDados || !this.ultimo || !this.sujas.has(p)) return;
      const D = this.painel.dic;
      if (p === "p1") V.ReceitaView.render(this.ultimo, D);
      else if (p === "p2") V.LocalidadeView.render(this.ultimo, D);
      else V.EstadoView.render(this.painel.consultaEstados(this.ultimo, this.filtro.tabela));
      this.sujas.delete(p);
      V.GraficoView.redimensionar();
    }

    /* ordenar ou abrir um estado só mexe na tabela */
    redesenharTabela() {
      if (!this.ultimo) return;
      V.EstadoView.renderTabela(this.painel.consultaEstados(this.ultimo, this.filtro.tabela));
    }

    rotuloPeriodo() {
      const r = this.painel.dic.ano_mes_rotulo;
      const f = this.filtro;
      return f.mesDe === f.mesAte ? r[f.mesDe] : `${r[f.mesDe]} a ${r[f.mesAte]}`;
    }

    /* recorte filtrado por PDV: separador ";" e vírgula decimal (Excel pt-BR) */
    exportarCsv() {
      if (!this.ultimo) return;
      const linhas = this.painel.recortePorPdv(this.ultimo);
      const dec = (v) => v.toFixed(2).replace(".", ",");
      const cabecalho = ["PDV", "Unidade", "Descricao", "Regiao", "Estado", "Municipio", "Modelo",
        "Transacoes", "Movimentacao", "Receita"];
      const corpo = linhas.map((d) =>
        [d.pdv, d.igreja, d.desc_igreja, d.regiao, d.estado, d.municipio, d.modelo,
          d.transacoes, dec(d.movimentacao), dec(d.receita)]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      );
      const csv = "﻿" + [cabecalho.join(";")].concat(corpo).join("\r\n");
      const D = this.painel.dic;
      V.LayoutView.baixar(csv, `pdvs_${D.ano_mes[this.filtro.mesDe]}_a_${D.ano_mes[this.filtro.mesAte]}.csv`,
        "text/csv;charset=utf-8;");
      V.LayoutView.toast(`${inteiro(linhas.length)} PDVs exportados.`, "ok");
    }
  }

  App.controllers.DashboardController = DashboardController;
})(window.App);
