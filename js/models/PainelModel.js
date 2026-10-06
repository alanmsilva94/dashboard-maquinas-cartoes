/* =========================================================================
   models/PainelModel.js — o cubo carregado e todos os cálculos do painel

   Recebe o cubo, monta os índices de cadastro (região, estado, descrição,
   município) e, a cada mudança de filtro, devolve o resultado agregado que as
   Views desenham. Nada aqui conhece HTML ou Plotly.
   ========================================================================= */

(function (App) {
  "use strict";

  const F_PDV = 0, F_MES = 1, F_TIPO = 3, F_BAND = 4, F_STATUS = 5, F_VALOR = 6, F_QTD = 7;

  function mascara(conjunto, tamanho) {
    const m = new Uint8Array(tamanho);
    conjunto.forEach((i) => {
      if (i >= 0 && i < tamanho) m[i] = 1;
    });
    return m;
  }

  class PainelModel {
    constructor() {
      this.cubo = null;
      this.semLocal = App.Config.regras.semLocalidade;
    }

    get temDados() {
      return this.cubo !== null;
    }

    get dic() {
      return this.cubo.dicionarios;
    }

    /* ---------------------------------------------------- vincula um cubo */

    carregar(cubo) {
      const D = cubo.dicionarios;
      const DIM = cubo.dim_pdv;
      this.cubo = cubo;
      this.linhas = cubo.fatos.linhas;
      this.statusOk = D.status_aprovado;
      this.semLocal = (cubo.meta && cubo.meta.rotulo_sem_localidade) || App.Config.regras.semLocalidade;

      /* cubos antigos podem não ter a dimensão de descrição */
      if (!D.desc_igreja || !D.desc_igreja.length) {
        D.desc_igreja = ["Não informado"];
        DIM.forEach((d) => (d.desc_igreja = d.desc_igreja || "Não informado"));
      }

      const iRegiao = App.utils.texto.indexar(D.regiao);
      const iEstado = App.utils.texto.indexar(D.estado);
      const iDesc = App.utils.texto.indexar(D.desc_igreja);

      /* valor fora do dicionário é ACRESCENTADO, nunca jogado no índice 0 */
      const indiceDe = (mapa, lista, valor) => {
        const v = valor === null || valor === undefined || valor === "" ? this.semLocal : String(valor);
        if (!mapa.has(v)) {
          mapa.set(v, lista.length);
          lista.push(v);
        }
        return mapa.get(v);
      };

      const n = D.pdv.length;
      this.nPdv = n;
      this.pdvRegiao = new Int16Array(n);
      this.pdvEstado = new Int16Array(n);
      this.pdvDesc = new Int16Array(n);
      this.pdvMunicipio = new Int32Array(n);
      this.pdvIgreja = new Array(n);

      /* município não é dimensão do cubo: chave COMPOSTA estado + município,
         para homônimos ("Bom Jesus") e "Sem localidade" não se misturarem */
      const iMun = new Map();
      this.munNome = [];
      const munEstado = [];

      DIM.forEach((d, i) => {
        this.pdvRegiao[i] = indiceDe(iRegiao, D.regiao, d.regiao);
        this.pdvEstado[i] = indiceDe(iEstado, D.estado, d.estado);
        this.pdvDesc[i] = indiceDe(iDesc, D.desc_igreja, d.desc_igreja);
        this.pdvIgreja[i] = d.igreja_id;

        const nome = d.municipio || this.semLocal;
        const chave = this.pdvEstado[i] + "|" + nome;
        if (!iMun.has(chave)) {
          iMun.set(chave, this.munNome.length);
          this.munNome.push(nome);
          munEstado.push(this.pdvEstado[i]);
        }
        this.pdvMunicipio[i] = iMun.get(chave);
      });

      this.munDoEstado = Int16Array.from(munEstado);
      this.idxSemLocalidade = D.estado.indexOf(this.semLocal);
    }

    /* ---------------------------------------------------- agregação */

    agregar(filtro) {
      const D = this.dic;
      const s = filtro.selecao;
      const mRegiao = mascara(s.regiao, D.regiao.length);
      const mEstado = mascara(s.estado, D.estado.length);
      const mDesc = mascara(s.desc_igreja, D.desc_igreja.length);
      const mTipo = mascara(s.tipo, D.tipo.length);
      const mBand = mascara(s.bandeira, D.bandeira.length);

      /* parque instalado que sobrevive aos filtros de cadastro */
      const pdvOk = new Uint8Array(this.nPdv);
      const pdvsFiltrados = [];
      for (let p = 0; p < this.nPdv; p++) {
        if (mRegiao[this.pdvRegiao[p]] && mEstado[this.pdvEstado[p]] && mDesc[this.pdvDesc[p]]) {
          pdvOk[p] = 1;
          pdvsFiltrados.push(p);
        }
      }

      const nMes = D.ano_mes.length, nTipo = D.tipo.length, nBand = D.bandeira.length;
      const nReg = D.regiao.length, nDesc = D.desc_igreja.length, nEst = D.estado.length;
      const nMun = this.munNome.length;
      const F64 = (k) => new Float64Array(k);
      const sets = (k) => Array.from({ length: k }, () => new Set());

      const r = {
        mesDe: filtro.mesDe,
        mesAte: filtro.mesAte,
        receita: 0, movimentacao: 0, qtd: 0, qtdAprovada: 0,
        receitaTipo: F64(nTipo), movTipo: F64(nTipo), qtdTipo: F64(nTipo), qtdAprovTipo: F64(nTipo),
        receitaBandeira: F64(nBand),
        receitaMes: F64(nMes), qtdMes: F64(nMes), qtdAprovMes: F64(nMes),
        receitaRegiao: F64(nReg), qtdRegiao: F64(nReg), maquinasRegiao: F64(nReg),
        receitaDesc: F64(nDesc), qtdDesc: F64(nDesc), maquinasDesc: F64(nDesc),
        receitaEstado: F64(nEst), qtdEstado: F64(nEst), qtdAprovEstado: F64(nEst), maquinasEstado: F64(nEst),
        receitaMun: F64(nMun), qtdMun: F64(nMun), qtdAprovMun: F64(nMun), maquinasMun: F64(nMun),
        igrejasEstado: sets(nEst), igrejasMun: sets(nMun), pdvMesAtivo: sets(nMes),
        qtdAprovPorPdv: F64(this.nPdv),
        pdvsFiltrados, pdvOk, mTipo, mBand,
      };

      const L = this.linhas;
      for (let k = 0; k < L.length; k++) {
        const f = L[k];
        const mes = f[F_MES];
        if (mes < filtro.mesDe || mes > filtro.mesAte) continue;
        const p = f[F_PDV];
        if (!pdvOk[p]) continue;
        if (!mTipo[f[F_TIPO]] || !mBand[f[F_BAND]]) continue;

        const valor = f[F_VALOR], qtd = f[F_QTD], tipo = f[F_TIPO];
        const reg = this.pdvRegiao[p], desc = this.pdvDesc[p];
        const est = this.pdvEstado[p], mun = this.pdvMunicipio[p];

        r.movimentacao += valor;
        r.qtd += qtd;
        r.movTipo[tipo] += valor;
        r.qtdTipo[tipo] += qtd;
        r.qtdMes[mes] += qtd;
        r.qtdRegiao[reg] += qtd;
        r.qtdDesc[desc] += qtd;
        r.qtdEstado[est] += qtd;
        r.qtdMun[mun] += qtd;

        if (this.statusOk[f[F_STATUS]]) {
          r.receita += valor;
          r.qtdAprovada += qtd;
          r.receitaTipo[tipo] += valor;
          r.qtdAprovTipo[tipo] += qtd;
          r.receitaBandeira[f[F_BAND]] += valor;
          r.receitaMes[mes] += valor;
          r.qtdAprovMes[mes] += qtd;
          r.receitaRegiao[reg] += valor;
          r.receitaDesc[desc] += valor;
          r.receitaEstado[est] += valor;
          r.receitaMun[mun] += valor;
          r.qtdAprovEstado[est] += qtd;
          r.qtdAprovMun[mun] += qtd;
          r.qtdAprovPorPdv[p] += qtd;
          r.pdvMesAtivo[mes].add(p);
        }
      }

      const minAtivo = this.cubo.meta.min_transacoes_ativo || App.Config.regras.minTransacoesAtivo || 1;
      r.pdvsAtivos = pdvsFiltrados.filter((p) => r.qtdAprovPorPdv[p] >= minAtivo).length;
      r.pdvsInativos = pdvsFiltrados.length - r.pdvsAtivos;
      r.qtdIgrejas = new Set(pdvsFiltrados.map((p) => this.pdvIgreja[p])).size;

      pdvsFiltrados.forEach((p) => {
        r.maquinasRegiao[this.pdvRegiao[p]] += 1;
        r.maquinasDesc[this.pdvDesc[p]] += 1;
        r.maquinasEstado[this.pdvEstado[p]] += 1;
        r.maquinasMun[this.pdvMunicipio[p]] += 1;
        r.igrejasEstado[this.pdvEstado[p]].add(this.pdvIgreja[p]);
        r.igrejasMun[this.pdvMunicipio[p]].add(this.pdvIgreja[p]);
      });

      return r;
    }

    /* ---------------------------------------------------- consulta por estado */

    linhasEstado(r) {
      const linhas = [];
      for (let e = 0; e < this.dic.estado.length; e++) {
        if (!r.maquinasEstado[e] && !r.qtdEstado[e]) continue;
        linhas.push({
          idx: e,
          nome: this.dic.estado[e],
          pdvs: r.maquinasEstado[e],
          igrejas: r.igrejasEstado[e].size,
          transacoes: r.qtdEstado[e],
          receita: r.receitaEstado[e],
          ticket: r.qtdAprovEstado[e] ? r.receitaEstado[e] / r.qtdAprovEstado[e] : 0,
        });
      }
      return linhas;
    }

    municipiosDoEstado(r, idxEstado) {
      const linhas = [];
      for (let m = 0; m < this.munNome.length; m++) {
        if (this.munDoEstado[m] !== idxEstado) continue;
        if (!r.maquinasMun[m] && !r.qtdMun[m]) continue;
        linhas.push({
          nome: this.munNome[m],
          pdvs: r.maquinasMun[m],
          igrejas: r.igrejasMun[m].size,
          transacoes: r.qtdMun[m],
          receita: r.receitaMun[m],
          ticket: r.qtdAprovMun[m] ? r.receitaMun[m] / r.qtdAprovMun[m] : 0,
        });
      }
      return linhas;
    }

    static ordenar(linhas, tabela) {
      const col = tabela.coluna;
      const sinal = tabela.desc ? -1 : 1;
      return linhas.slice().sort((a, b) => {
        if (col === "nome") return sinal * String(a.nome).localeCompare(String(b.nome), "pt-BR");
        return sinal * (a[col] - b[col]);
      });
    }

    /* tudo o que a página 3 precisa, já separado e ordenado.
       `busca` (texto) esconde linhas sem mexer nos totais: o estado aparece se
       a sigla/nome bater, ou abre sozinho mostrando só os municípios que batem. */
    consultaEstados(r, tabela) {
      const T = App.utils.texto;
      const todas = this.linhasEstado(r);
      const linhas = todas.filter((l) => l.nome !== this.semLocal);
      const semLocal = todas.find((l) => l.nome === this.semLocal) || null;
      const comReceita = linhas.filter((l) => l.receita > 0);
      const totalReceita = todas.reduce((a, l) => a + l.receita, 0);

      const termo = T.slug(tabela.busca || "");
      const bate = (texto) => termo && T.slug(texto).includes(termo);

      const montar = (l) => {
        const municipios = PainelModel.ordenar(this.municipiosDoEstado(r, l.idx), tabela);
        const nomeUf = App.utils.uf.nome(l.nome) || "";
        if (termo && !bate(l.nome) && !bate(nomeUf)) {
          const filhos = municipios.filter((m) => bate(m.nome));
          return filhos.length ? { linha: l, aberto: true, filhos } : null;
        }
        const aberto = tabela.abertos.has(l.idx);
        return { linha: l, aberto, filhos: aberto ? municipios : null };
      };

      return {
        linhas: PainelModel.ordenar(linhas, tabela).map(montar).filter(Boolean),
        semLocal: semLocal ? montar(semLocal) : null,
        temSemLocal: !!semLocal,
        semLocalPdvs: semLocal ? semLocal.pdvs : 0,
        idxVisiveis: todas.map((l) => l.idx),
        busca: tabela.busca || "",
        porReceita: linhas.slice().sort((a, b) => b.receita - a.receita),
        lider: comReceita.slice().sort((a, b) => b.receita - a.receita)[0] || null,
        qtdEstados: linhas.length,
        qtdComReceita: comReceita.length,
        municipios: this.munNome.filter(
          (nome, m) => nome !== this.semLocal && (r.maquinasMun[m] > 0 || r.qtdMun[m] > 0)
        ).length,
        totais: {
          receita: totalReceita,
          transacoes: todas.reduce((a, l) => a + l.transacoes, 0),
          pdvs: todas.reduce((a, l) => a + l.pdvs, 0),
          igrejas: r.qtdIgrejas,
          ticket: r.qtdAprovada ? r.receita / r.qtdAprovada : 0,
        },
        tabela: { coluna: tabela.coluna, desc: tabela.desc },
      };
    }

    /* ---------------------------------------------------- avisos */

    avisos(r) {
      const lista = (this.cubo.meta.avisos || []).map((a) => ({ tipo: "coluna", ...a }));
      const e = this.idxSemLocalidade;
      if (e >= 0 && (r.maquinasEstado[e] || r.qtdEstado[e])) {
        const totalPdvs = r.pdvsFiltrados.length;
        lista.push({
          tipo: "semLocalidade",
          pdvs: r.maquinasEstado[e],
          receita: r.receitaEstado[e],
          partePdv: totalPdvs ? (r.maquinasEstado[e] / totalPdvs) * 100 : 0,
          parteReceita: r.receita ? (r.receitaEstado[e] / r.receita) * 100 : 0,
        });
      }
      return lista;
    }

    /* ---------------------------------------------------- recorte por PDV (CSV) */

    recortePorPdv(r) {
      const porPdv = new Map();
      const L = this.linhas;
      for (let k = 0; k < L.length; k++) {
        const f = L[k];
        if (f[F_MES] < r.mesDe || f[F_MES] > r.mesAte) continue;
        const p = f[F_PDV];
        if (!r.pdvOk[p] || !r.mTipo[f[F_TIPO]] || !r.mBand[f[F_BAND]]) continue;
        if (!porPdv.has(p)) porPdv.set(p, { receita: 0, mov: 0, qtd: 0 });
        const acc = porPdv.get(p);
        acc.mov += f[F_VALOR];
        acc.qtd += f[F_QTD];
        if (this.statusOk[f[F_STATUS]]) acc.receita += f[F_VALOR];
      }

      return r.pdvsFiltrados.map((p) => {
        const d = this.cubo.dim_pdv[p];
        const a = porPdv.get(p) || { receita: 0, mov: 0, qtd: 0 };
        return { ...d, transacoes: a.qtd, movimentacao: a.mov, receita: a.receita };
      });
    }
  }

  App.models.PainelModel = PainelModel;
})(window.App);
