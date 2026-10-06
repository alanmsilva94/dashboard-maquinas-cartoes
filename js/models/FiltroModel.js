/* =========================================================================
   models/FiltroModel.js — estado dos filtros, da página e da tabela

   Guarda só ÍNDICES (posição no dicionário do cubo). Toda alteração emite
   "mudou", que o DashboardController escuta para recalcular e redesenhar.
   ========================================================================= */

(function (App) {
  "use strict";

  const todos = (n) => new Set(Array.from({ length: n }, (_, i) => i));

  class FiltroModel extends App.utils.Emissor {
    constructor() {
      super();
      this.definicoes = []; /* [{ chave, titulo, opcoes }] */
      this.nMeses = 0;
      this.mesDe = 0;
      this.mesAte = 0;
      this.selecao = {};    /* chave -> Set de índices marcados */
      this.pagina = "p1";
      this.tabela = { coluna: "receita", desc: true, abertos: new Set(), busca: "" };
    }

    /* chamado a cada nova base: todos os filtros voltam a "Todos" */
    configurar(dicionarios) {
      /* para acrescentar ou tirar um filtro, edite esta lista */
      this.definicoes = [
        { chave: "regiao", titulo: "Região", opcoes: dicionarios.regiao },
        { chave: "estado", titulo: "Estado", opcoes: dicionarios.estado },
        { chave: "desc_igreja", titulo: "Descrição da unidade", opcoes: dicionarios.desc_igreja },
        { chave: "tipo", titulo: "Tipo de transação", opcoes: dicionarios.tipo },
        { chave: "bandeira", titulo: "Bandeira", opcoes: dicionarios.bandeira },
      ];
      this.nMeses = dicionarios.ano_mes.length;
      this.tabela.abertos.clear();
      this.tabela.busca = "";
      this._resetar();
    }

    _resetar() {
      this.mesDe = 0;
      this.mesAte = Math.max(0, this.nMeses - 1);
      this.definicoes.forEach((f) => {
        this.selecao[f.chave] = todos(f.opcoes.length);
      });
    }

    /* ---------------------------------------------------- consultas */

    definicao(chave) {
      return this.definicoes.find((f) => f.chave === chave);
    }

    periodoCompleto() {
      return this.mesDe === 0 && this.mesAte === this.nMeses - 1;
    }

    filtrado(chave) {
      const f = this.definicao(chave);
      return f ? this.selecao[chave].size !== f.opcoes.length : false;
    }

    resumo(chave) {
      const f = this.definicao(chave);
      const sel = this.selecao[chave].size;
      const total = f.opcoes.length;
      if (sel === total) return `Todos (${total})`;
      if (sel === 0) return "Nenhum";
      if (sel === 1) return f.opcoes[Array.from(this.selecao[chave])[0]];
      return `${sel} de ${total}`;
    }

    /* ---------------------------------------------------- alterações */

    marcar(chave, indice, marcado) {
      if (marcado) this.selecao[chave].add(indice);
      else this.selecao[chave].delete(indice);
      this.emit("mudou");
    }

    marcarVarios(chave, indices, marcado) {
      indices.forEach((i) => (marcado ? this.selecao[chave].add(i) : this.selecao[chave].delete(i)));
      this.emit("mudou");
    }

    limparFiltro(chave) {
      this.selecao[chave] = todos(this.definicao(chave).opcoes.length);
      this.emit("mudou");
    }

    /* de > até é corrigido puxando o outro extremo, como na versão anterior */
    definirPeriodo(de, ate, quemMudou) {
      if (de > ate) {
        if (quemMudou === "de") ate = de;
        else de = ate;
      }
      this.mesDe = de;
      this.mesAte = ate;
      this.emit("mudou");
    }

    limparPeriodo() {
      this.mesDe = 0;
      this.mesAte = Math.max(0, this.nMeses - 1);
      this.emit("mudou");
    }

    limparTudo() {
      this._resetar();
      this.emit("mudou");
    }

    /* ---------------------------------------------------- tabela e página */

    ordenarPor(coluna) {
      if (this.tabela.coluna === coluna) this.tabela.desc = !this.tabela.desc;
      else {
        this.tabela.coluna = coluna;
        this.tabela.desc = coluna !== "nome";
      }
      this.emit("tabela");
    }

    alternarEstado(idx) {
      if (this.tabela.abertos.has(idx)) this.tabela.abertos.delete(idx);
      else this.tabela.abertos.add(idx);
      this.emit("tabela");
    }

    /* abre todos os estados indicados ou, se já estiverem todos abertos, fecha */
    alternarTodos(indices) {
      const todosAbertos = indices.length && indices.every((i) => this.tabela.abertos.has(i));
      this.tabela.abertos.clear();
      if (!todosAbertos) indices.forEach((i) => this.tabela.abertos.add(i));
      this.emit("tabela");
    }

    buscar(texto) {
      this.tabela.busca = texto || "";
      this.emit("tabela");
    }

    irPara(pagina) {
      this.pagina = pagina;
      this.emit("pagina", pagina);
    }
  }

  App.models.FiltroModel = FiltroModel;
})(window.App);
