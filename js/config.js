/* =========================================================================
   config.js — configuração central (substitui o config.py)

   Altere aqui a identidade e as regras de negócio. Nenhum outro arquivo
   precisa ser editado para os ajustes do dia a dia.

   Os arquivos são carregados como <script> comum (não como módulo ES) porque
   o Chrome e o Edge bloqueiam `import` em páginas abertas por file:// — e o
   painel precisa abrir com duplo clique, direto da pasta da rede.
   ========================================================================= */

window.App = window.App || { utils: {}, models: {}, views: {}, controllers: {} };

App.Config = {
  /* ---------------------------------------------------------- identidade */
  marca: {
    titulo: "Dashboard - Máquinas de Cartões",
    subtitulo: "Receita e cobertura de PDVs",
    /* o menu lateral não quebra linha: use rótulos curtos */
    nome: "Máquinas de Cartões",
    sub: "Painel de receita",
  },

  /* paleta das roscas: a mesma de css/01-tokens.css (--serie-1 a --serie-8).
     Validada para contraste e daltonismo; a ordem é fixa — cada categoria
     mantém a mesma cor quando os filtros mudam. O CSS tem prioridade. */
  paleta: ["#E8531A", "#2A6FC9", "#159F74", "#7A4FC4", "#D9578A", "#3E8A18", "#2B9FD0", "#B9363B"],

  /* ---------------------------------------------------------- colunas
     Apelidos EXTRA de cabeçalho, para quando a planilha usar um nome que o
     leitor ainda não conhece. Ex.: "igreja_desc": ["Classificação da Unidade"] */
  aliasColunasExtra: {
    igreja_desc: [],
    regiao: [],
    estado: [],
    municipio: [],
    modelo: [],
    tipo: [],
    bandeira: [],
    valor: [],
    status: [],
    data: [],
    pdv: [],
    igreja_id: [],
  },

  /* ---------------------------------------------------------- regras */
  regras: {
    /* status que contam como RECEITA; comparados sem acento e sem caixa */
    statusAprovados: [
      "aprovada", "aprovado", "autorizada", "autorizado", "confirmada", "confirmado",
      "concluida", "concluido", "paga", "pago", "efetivada", "liquidada", "sucesso",
      "capturada",
    ],
    /* PDV ATIVO = pelo menos N transações aprovadas no período filtrado */
    minTransacoesAtivo: 1,
    /* rótulo das transações da aba Pix (vira "Tipo" e "Bandeira") */
    rotuloPix: "Pix",
    /* rótulo único para PDV sem localidade identificável */
    semLocalidade: "Sem localidade",
  },

  /* aviso no log quando o cubo agregado passar deste número de linhas */
  limiteLinhasCubo: 250000,

  /* subir este número invalida bases salvas em formato antigo */
  versaoEsquema: 1,
};
