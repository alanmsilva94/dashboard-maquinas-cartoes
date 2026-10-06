/* =========================================================================
   models/PlanilhaModel.js — leitura das planilhas .xlsx (substitui o etl.py)

   Entra: lista de File (os .xlsx da pasta). Sai: { fatos, igrejas, maquinas,
   avisos }. Não toca no DOM: as mensagens vão para o `log` recebido, que o
   Controller liga à View da janela de importação.

   Regras mantidas do Python:
     * acha as abas mesmo com variação de acento/caixa ("Cartões", "CARTAO");
     * acha as colunas do mesmo jeito ("Valor transação", "valor_transacao");
     * empilha Cartões e Pix em uma tabela de fatos com esquema estável;
     * Pix entra com Tipo = Bandeira = rótulo do Pix.
   ========================================================================= */

(function (App) {
  "use strict";

  const T = App.utils.texto;

  /* ------------------------------------------------------------ dicionários
     Para aceitar um novo cabeçalho sem mexer aqui, use aliasColunasExtra (config.js). */

  const ABAS = {
    igrejas: ["igrejas", "igreja", "cadastroigrejas", "unidades"],
    maquinas: ["maquinas", "maquina", "pdvs", "pdv", "terminais", "pos"],
    cartoes: ["cartoes", "cartao", "cartaodecredito", "vendascartao", "transacoescartao"],
    pix: ["pix", "transacoespix", "vendaspix"],
  };

  const COLS_IGREJAS = {
    igreja_id: ["ID", "Id Igreja", "ID_Igreja", "Codigo"],
    igreja_nome: ["Nome", "Razao Social"],
    igreja_fantasia: ["N Fantasia", "Nome Fantasia"],
    igreja_desc: [
      "Descricao da Unidade", "Desc Unidade", "Desc Igreja", "Desc.Igreja", "Desc. Igreja", "Descricao Igreja", "Descricao da Igreja",
      "Desc da Igreja", "Tipo Igreja", "Tipo de Igreja", "Classificacao",
      "Classificacao da Unidade", "Classificacao Igreja", "Perfil Igreja",
    ],
    endereco: ["Endereco"],
    estado: ["Estado", "UF"],
    municipio: ["Municipio", "Cidade"],
    bairro: ["Bairro"],
    regiao: ["Desc.Regiao", "Desc Regiao", "Regiao"],
    status_igreja: ["Status"],
    qtd_membros: ["Qtd.Membros", "Qtd Membros", "Membros"],
    tipo_imovel: ["Tipo Imovel", "Tipo do Imovel"],
  };

  const COLS_MAQUINAS = {
    pdv: ["PDV", "Pdv", "Ponto de Venda"],
    numero_serie: ["N de serie", "Numero de serie", "Serie", "Serial"],
    modelo: ["Modelo"],
    igreja_id: ["ID_Unidade", "ID Unidade", "ID_Igreja", "ID Igreja", "IdIgreja", "ID"],
  };

  const COLS_CARTOES = {
    data: ["Data", "Data Transacao", "Data da Venda"],
    pdv: ["Pdv", "PDV"],
    tipo: ["Tipo", "Tipo Transacao", "Modalidade"],
    bandeira: ["Bandeira"],
    valor: ["Valor", "Valor Transacao"],
    status: ["Status", "Situacao"],
  };

  const COLS_PIX = {
    data: ["Data", "Data Transacao"],
    status: ["Status", "Situacao"],
    pdv: ["PDV", "Pdv"],
    valor: ["Valor transacao", "Valor", "Valor da transacao"],
  };

  /* nome humano de cada campo, para os avisos não citarem chaves internas */
  const ROTULO_CAMPO = {
    igreja_id: "ID da unidade", igreja_nome: "Nome", igreja_fantasia: "Nome fantasia",
    igreja_desc: "Descrição da unidade", endereco: "Endereço", estado: "Estado",
    municipio: "Município", bairro: "Bairro", regiao: "Região", status_igreja: "Status da unidade",
    qtd_membros: "Qtd. de membros", tipo_imovel: "Tipo de imóvel", pdv: "PDV",
    numero_serie: "Nº de série", modelo: "Modelo", data: "Data", tipo: "Tipo",
    bandeira: "Bandeira", valor: "Valor", status: "Status",
  };

  /* ------------------------------------------------------------ apoio */

  function identificarAba(nome, cabecalhos) {
    const s = T.slug(nome);
    for (const [tipo, aliases] of Object.entries(ABAS)) {
      if (aliases.some((a) => T.slug(a) === s)) return tipo;
    }
    for (const [tipo, aliases] of Object.entries(ABAS)) {
      if (aliases.some((a) => s.includes(T.slug(a)))) return tipo;
    }
    /* sem nome reconhecível: tenta pelas colunas presentes */
    const cols = cabecalhos.map(T.slug);
    if (cols.includes("bandeira") && cols.includes("valor")) return "cartoes";
    if (cols.some((c) => c.includes("valortransacao"))) return "pix";
    if (cols.includes("idigreja") || (cols.includes("modelo") && cols.includes("pdv"))) return "maquinas";
    if (cols.includes("descregiao") || cols.includes("qtdmembros")) return "igrejas";
    return null;
  }

  function aliasesDe(destino, base) {
    const extra = (App.Config.aliasColunasExtra && App.Config.aliasColunasExtra[destino]) || [];
    return extra.concat(base);
  }

  /* Mapeia as colunas da aba para o esquema interno. Coluna ausente vira
     "Não informado" em TODAS as linhas — por isso o aviso mostra o nome humano
     do campo e os cabeçalhos que existem, para o próximo passo ser óbvio. */
  function mapear(cabecalhos, mapa, aba, log, avisos) {
    const resolvido = {};
    const ausentes = [];
    const usados = [];

    for (const [destino, base] of Object.entries(mapa)) {
      const real = T.acharColuna(cabecalhos, aliasesDe(destino, base));
      resolvido[destino] = real;
      const rotulo = ROTULO_CAMPO[destino] || destino;
      if (real) usados.push(`${rotulo} ← "${real}"`);
      else ausentes.push(rotulo);
    }

    log.info(`  ${aba}: ${usados.join(" · ")}`);

    if (ausentes.length) {
      log.aviso(
        `${aba}: não encontrei a coluna de ${ausentes.join(", ")}. ` +
          `Cabeçalhos da planilha: ${cabecalhos.join(", ")}.`
      );
      log.aviso(
        "esses campos ficarão como “Não informado”. Acrescente o nome certo em " +
          "aliasColunasExtra, no js/config.js, e recarregue a página."
      );
      /* a mesma ausência se repete em cada mês: um aviso só na faixa do topo */
      const titulo = `Coluna de ${ausentes.join(", ")} não encontrada na aba ${aba}`;
      if (!avisos.some((a) => a.titulo === titulo)) {
        avisos.push({ titulo, detalhe: `Cabeçalhos disponíveis: ${cabecalhos.join(", ")}.` });
      }
    }
    return resolvido;
  }

  /* o relatório de colunas é igual em todos os meses: só na 1ª aba de cada tipo */
  function logUmaVez(vistas, chave, log) {
    if (vistas.has(chave)) return Object.assign({}, log, { info: () => {} });
    vistas.add(chave);
    return log;
  }

  const pausa = () => new Promise((r) => setTimeout(r, 0)); /* deixa a tela repintar */

  /* ------------------------------------------------------------ API */

  const PlanilhaModel = {
    ehPlanilha: (nome) => /\.xlsx?$/i.test(nome) && !nome.startsWith("~$"),

    async ler(arquivos, log) {
      if (typeof XLSX === "undefined") throw new Error("Biblioteca SheetJS (vendor/xlsx.full.min.js) não carregada.");

      const regras = App.Config.regras;
      const SEM_LOCAL = regras.semLocalidade;
      const statusAprovados = new Set(regras.statusAprovados.map(T.slug));
      const rotuloPix = regras.rotuloPix;

      const fatos = [];
      const igrejas = new Map();
      const maquinas = new Map();
      const avisos = [];
      const abasVistas = new Set();
      let descartadas = 0;

      const planilhas = arquivos
        .filter((f) => PlanilhaModel.ehPlanilha(f.name))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!planilhas.length) throw new Error("Nenhum arquivo .xlsx encontrado na pasta escolhida.");

      for (const arquivo of planilhas) {
        log.info(`lendo ${arquivo.name}`);
        await pausa();

        let livro;
        try {
          livro = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true });
        } catch (erro) {
          log.aviso(`${arquivo.name}: não foi possível abrir (${erro.message})`);
          continue;
        }

        const reconhecidas = new Set();

        for (const nomeAba of livro.SheetNames) {
          const linhas = XLSX.utils.sheet_to_json(livro.Sheets[nomeAba], { defval: null, raw: true });
          if (!linhas.length) continue;

          const cabecalhos = Object.keys(linhas[0]);
          const tipoAba = identificarAba(nomeAba, cabecalhos);
          if (!tipoAba) {
            log.info(`  aba ignorada: "${nomeAba}"`);
            continue;
          }
          reconhecidas.add(tipoAba);

          if (tipoAba === "igrejas") {
            const col = mapear(cabecalhos, COLS_IGREJAS, "Unidades", logUmaVez(abasVistas, "igrejas", log), avisos);
            for (const linha of linhas) {
              const id = T.chave(linha[col.igreja_id]);
              if (!id) continue;
              const loc = (campo, fn) =>
                T.naoInformado(linha[col[campo]]) ? SEM_LOCAL : fn(T.texto(linha[col[campo]], SEM_LOCAL));
              igrejas.set(id, {
                igreja_id: id,
                igreja_nome: T.texto(linha[col.igreja_nome], "Sem cadastro"),
                igreja_fantasia: T.texto(linha[col.igreja_fantasia], null),
                igreja_desc: T.texto(linha[col.igreja_desc], "Não informado"),
                regiao: loc("regiao", T.capitalizar),
                estado: loc("estado", (t) => t.toUpperCase()),
                municipio: loc("municipio", T.capitalizar),
                status_igreja: T.capitalizar(T.texto(linha[col.status_igreja], "Não informado")),
                tipo_imovel: T.capitalizar(T.texto(linha[col.tipo_imovel], "Não informado")),
                qtd_membros: Math.round(T.paraFloat(linha[col.qtd_membros]) || 0),
              });
            }
          } else if (tipoAba === "maquinas") {
            const col = mapear(cabecalhos, COLS_MAQUINAS, "Maquinas", logUmaVez(abasVistas, "maquinas", log), avisos);
            for (const linha of linhas) {
              const pdv = T.chave(linha[col.pdv]);
              if (!pdv) continue;
              maquinas.set(pdv, {
                pdv: pdv,
                igreja_id: T.chave(linha[col.igreja_id]),
                modelo: T.texto(linha[col.modelo], "Não informado").toUpperCase(),
                numero_serie: T.texto(linha[col.numero_serie], "Não informado"),
              });
            }
          } else {
            const cartao = tipoAba === "cartoes";
            const col = mapear(
              cabecalhos,
              cartao ? COLS_CARTOES : COLS_PIX,
              cartao ? "Cartões" : "Pix",
              logUmaVez(abasVistas, tipoAba, log),
              avisos
            );

            for (const linha of linhas) {
              const data = T.paraData(linha[col.data]);
              const pdv = T.chave(linha[col.pdv]);
              const valor = T.paraFloat(linha[col.valor]);
              if (!data || !pdv || valor === null) {
                descartadas++;
                continue;
              }
              const status = T.capitalizar(T.texto(linha[col.status], "Não informado"));
              fatos.push({
                anoMes: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`,
                pdv: pdv,
                canal: cartao ? "Cartão" : "Pix",
                tipo: cartao ? T.capitalizar(T.texto(linha[col.tipo], "Não informado")) : rotuloPix,
                bandeira: cartao ? T.capitalizar(T.texto(linha[col.bandeira], "Não informado")) : rotuloPix,
                status: status,
                aprovada: statusAprovados.has(T.slug(status)),
                valor: valor,
              });
            }
          }
        }

        for (const esperada of ["cartoes", "pix"]) {
          if (!reconhecidas.has(esperada)) log.aviso(`${arquivo.name}: aba de ${esperada} não encontrada`);
        }
      }

      /* coluna localizada, mas vazia em todas as unidades: o filtro sai com uma opção só */
      const conferirVazia = (campo, padrao) => {
        if (!igrejas.size) return;
        const valores = new Set();
        igrejas.forEach((ig) => valores.add(ig[campo]));
        if (valores.size === 1 && valores.has(padrao)) {
          const rotulo = ROTULO_CAMPO[campo] || campo;
          log.aviso(`a coluna de ${rotulo} foi localizada, mas está vazia em todas as unidades`);
          avisos.push({
            titulo: `Coluna de ${rotulo} vazia na aba Unidades`,
            detalhe: "A coluna existe, mas nenhuma linha tem valor preenchido.",
          });
        }
      };
      conferirVazia("igreja_desc", "Não informado");
      conferirVazia("regiao", SEM_LOCAL);
      conferirVazia("estado", SEM_LOCAL);

      if (!fatos.length) throw new Error("Nenhuma transação válida foi encontrada nas abas Cartões/Pix.");
      if (!maquinas.size) throw new Error("Aba 'Maquinas' não encontrada — ela liga o PDV à unidade.");
      if (descartadas) log.aviso(`${descartadas} linha(s) descartada(s) por data, PDV ou valor inválidos`);
      if (!fatos.some((f) => f.aprovada)) {
        log.aviso("nenhum status foi reconhecido como aprovado — confira statusAprovados no js/config.js");
      }

      return { fatos, igrejas, maquinas, avisos, planilhas: planilhas.length };
    },
  };

  App.models.PlanilhaModel = PlanilhaModel;
})(window.App);
