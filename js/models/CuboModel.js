/* =========================================================================
   models/CuboModel.js — fatos + cadastros -> cubo compacto (substitui o analytics.py)

   Por que um cubo: os filtros rodam no navegador a cada clique. Agregar as
   transações em PDV × mês × canal × tipo × bandeira × status, com os textos
   trocados por índices, deixa a reagregação barata e a base salva pequena.

   O formato é o mesmo do projeto Python, então bases salvas pela versão
   anterior continuam abrindo.
   ========================================================================= */

(function (App) {
  "use strict";

  const T = App.utils.texto;
  const FMT = App.utils.formato;

  /* dimensão de PDV vazia, para PDV que transacionou sem estar cadastrado */
  function dimensaoOrfa(pdv, semLocal) {
    return {
      pdv: pdv,
      igreja_id: "Sem cadastro",
      igreja: "Sem cadastro",
      desc_igreja: "Não informado",
      regiao: semLocal,
      estado: semLocal,
      municipio: semLocal,
      modelo: "Não informado",
      serie: "Não informado",
      status_igreja: "Não informado",
      tipo_imovel: "Não informado",
      membros: 0,
    };
  }

  const CuboModel = {
    COLUNAS: ["pdv", "mes", "canal", "tipo", "bandeira", "status", "valor", "qtd"],

    montar(base, rotuloFonte) {
      const { fatos, igrejas, maquinas } = base;
      const cfg = App.Config;
      const regras = cfg.regras;
      const semLocal = regras.semLocalidade;

      /* dimensão de PDV: máquina + cadastro da igreja */
      const dimPorPdv = new Map();
      for (const maquina of maquinas.values()) {
        const igreja = igrejas.get(maquina.igreja_id) || {};
        dimPorPdv.set(maquina.pdv, {
          pdv: maquina.pdv,
          igreja_id: maquina.igreja_id || "Sem cadastro",
          igreja: igreja.igreja_fantasia || igreja.igreja_nome || "Sem cadastro",
          desc_igreja: igreja.igreja_desc || "Não informado",
          regiao: igreja.regiao || semLocal,
          estado: igreja.estado || semLocal,
          municipio: igreja.municipio || semLocal,
          modelo: maquina.modelo,
          serie: maquina.numero_serie,
          status_igreja: igreja.status_igreja || "Não informado",
          tipo_imovel: igreja.tipo_imovel || "Não informado",
          membros: igreja.qtd_membros || 0,
        });
      }

      /* PDV que transacionou sem cadastro não pode sumir do dashboard */
      let orfaos = 0;
      for (const fato of fatos) {
        if (!dimPorPdv.has(fato.pdv)) {
          orfaos++;
          dimPorPdv.set(fato.pdv, dimensaoOrfa(fato.pdv, semLocal));
        }
      }

      const listaPdv = T.ordenarPt(new Set(dimPorPdv.keys()));
      const listaMes = Array.from(new Set(fatos.map((f) => f.anoMes))).sort();
      const listaCanal = T.ordenarPt(new Set(fatos.map((f) => f.canal)));
      const listaTipo = T.ordenarPt(new Set(fatos.map((f) => f.tipo)));
      const listaBandeira = T.ordenarPt(new Set(fatos.map((f) => f.bandeira)));
      const listaStatus = T.ordenarPt(new Set(fatos.map((f) => f.status)));

      const iPdv = T.indexar(listaPdv);
      const iMes = T.indexar(listaMes);
      const iCanal = T.indexar(listaCanal);
      const iTipo = T.indexar(listaTipo);
      const iBand = T.indexar(listaBandeira);
      const iStatus = T.indexar(listaStatus);

      /* agrega em PDV × mês × canal × tipo × bandeira × status */
      const grupos = new Map();
      for (const f of fatos) {
        const k =
          `${iPdv.get(f.pdv)}|${iMes.get(f.anoMes)}|${iCanal.get(f.canal)}|` +
          `${iTipo.get(f.tipo)}|${iBand.get(f.bandeira)}|${iStatus.get(f.status)}`;
        const atual = grupos.get(k);
        if (atual) {
          atual[0] += f.valor;
          atual[1] += 1;
        } else {
          grupos.set(k, [f.valor, 1]);
        }
      }

      const linhas = [];
      for (const [k, [valor, qtd]] of grupos) {
        const p = k.split("|");
        linhas.push([+p[0], +p[1], +p[2], +p[3], +p[4], +p[5], Math.round(valor * 100) / 100, qtd]);
      }

      const statusAprovados = new Set(regras.statusAprovados.map(T.slug));
      const dimensao = listaPdv.map((p) => dimPorPdv.get(p));

      return {
        meta: {
          gerado_em: FMT.dataHora(new Date()),
          titulo: cfg.marca.titulo,
          subtitulo: cfg.marca.subtitulo,
          periodo_inicio: listaMes.length ? FMT.rotuloMes(listaMes[0]) : "-",
          periodo_fim: listaMes.length ? FMT.rotuloMes(listaMes[listaMes.length - 1]) : "-",
          qtd_transacoes: fatos.length,
          linhas_cubo: linhas.length,
          min_transacoes_ativo: regras.minTransacoesAtivo || 1,
          rotulo_sem_localidade: semLocal,
          fonte: rotuloFonte,
          avisos: base.avisos || [],
          orfaos: orfaos,
        },
        dicionarios: {
          pdv: listaPdv,
          ano_mes: listaMes,
          ano_mes_rotulo: listaMes.map(FMT.rotuloMes),
          canal: listaCanal,
          tipo: listaTipo,
          bandeira: listaBandeira,
          status: listaStatus,
          status_aprovado: listaStatus.map((s) => statusAprovados.has(T.slug(s))),
          regiao: T.ordenarPt(new Set(dimensao.map((d) => d.regiao))),
          desc_igreja: T.ordenarPt(new Set(dimensao.map((d) => d.desc_igreja))),
          estado: T.ordenarPt(new Set(dimensao.map((d) => d.estado))),
          modelo: T.ordenarPt(new Set(dimensao.map((d) => d.modelo))),
        },
        dim_pdv: dimensao,
        fatos: { colunas: CuboModel.COLUNAS, linhas },
        paleta: cfg.paleta,
      };
    },

    /* confere se um objeto (base salva ou .json importado) tem cara de cubo */
    valido(cubo) {
      return !!(
        cubo &&
        cubo.meta &&
        cubo.dicionarios &&
        Array.isArray(cubo.dim_pdv) &&
        cubo.fatos &&
        Array.isArray(cubo.fatos.linhas)
      );
    },
  };

  App.models.CuboModel = CuboModel;
})(window.App);
