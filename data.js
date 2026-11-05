/* Dados de referência — DELEAGRO Campo */
'use strict';

const NATUREZAS = [
  { id: 'abigeato', nome: 'Furto de semovente (abigeato)', cap: 'Art. 155, §6º, CP', grupo: 'animal' },
  { id: 'roubo_animal', nome: 'Roubo de semovente', cap: 'Art. 157, CP', grupo: 'animal' },
  { id: 'recep_animal', nome: 'Receptação de animal', cap: 'Art. 180-A, CP', grupo: 'animal' },
  { id: 'maquinario', nome: 'Furto/roubo de máquinas e implementos', cap: 'Arts. 155/157, CP', grupo: 'maquina' },
  { id: 'gps', nome: 'Furto/roubo de GPS e agricultura de precisão', cap: 'Arts. 155/157, CP', grupo: 'maquina' },
  { id: 'defensivos', nome: 'Furto/roubo de defensivos e insumos', cap: 'Arts. 155/157, CP', grupo: 'insumo' },
  { id: 'graos', nome: 'Furto/roubo de grãos, produção ou combustível', cap: 'Arts. 155/157, CP', grupo: 'insumo' },
  { id: 'receptacao', nome: 'Receptação de bens rurais', cap: 'Art. 180, CP', grupo: 'geral' },
  { id: 'estelionato', nome: 'Estelionato no meio rural', cap: 'Art. 171, CP', grupo: 'fraude' },
  { id: 'apropriacao', nome: 'Apropriação indébita (gado, insumos, máquinas)', cap: 'Art. 168, CP', grupo: 'fraude' },
  { id: 'marca', nome: 'Supressão ou alteração de marca em animais', cap: 'Art. 162, CP', grupo: 'animal' },
  { id: 'agrario', nome: 'Conflito agrário com violência / esbulho', cap: 'Art. 161, §1º, II, CP', grupo: 'geral' },
  { id: 'outro', nome: 'Outro delito patrimonial rural', cap: '', grupo: 'geral' }
];

const PAPEIS = [
  { id: 'vitima', nome: 'Vítima', cor: '#2f6f4f' },
  { id: 'comunicante', nome: 'Comunicante', cor: '#3a5f8a' },
  { id: 'testemunha', nome: 'Testemunha', cor: '#7a6a2a' },
  { id: 'suspeito', nome: 'Suspeito', cor: '#9a3324' }
];

const CATEGORIAS_BEM = [
  { id: 'animal', nome: 'Semovente (animal)' },
  { id: 'maquina', nome: 'Máquina / implemento / veículo' },
  { id: 'eletronico', nome: 'GPS / eletrônico / agricultura de precisão' },
  { id: 'insumo', nome: 'Defensivo / fertilizante / semente' },
  { id: 'producao', nome: 'Grãos / produção / combustível' },
  { id: 'outro', nome: 'Outro bem' }
];

const SITUACOES_BEM = ['Subtraído', 'Recuperado', 'Apreendido', 'Restituído', 'Não localizado'];

/* Checklists: comuns + específicos por grupo/natureza */
const CHECK_COMUM = [
  { s: 'Local', itens: [
    ['c1', 'Isolar e preservar o local; registrar horário de chegada da equipe'],
    ['c2', 'Coordenadas GPS do local do fato e dos pontos de acesso'],
    ['c3', 'Fotografar porteiras, cercas, cadeados, arames cortados e acessos'],
    ['c4', 'Rastros de veículos (medir bitola/largura de pneus) e pegadas'],
    ['c5', 'Requisitar perícia de local quando houver vestígios'],
    ['c6', 'Levantar câmeras de propriedades vizinhas, postos, pedágios e rodovias']
  ]},
  { s: 'Vítima e propriedade', itens: [
    ['c7', 'Qualificar vítima e comunicante; colher termo de declaração'],
    ['c8', 'Documentos de propriedade/posse dos bens (notas fiscais, contratos)'],
    ['c9', 'Funcionários, ex-funcionários, arrendatários e prestadores com acesso'],
    ['c10', 'Ouvir vizinhos e confrontantes; ocorrências semelhantes na região']
  ]},
  { s: 'Formalização', itens: [
    ['c11', 'BO registrado/complementado no SIGO'],
    ['c12', 'Auto de apreensão e, se o caso, auto de reconhecimento'],
    ['c13', 'Auto de avaliação (direta ou indireta) dos bens'],
    ['c14', 'Termo de restituição/entrega ou nomeação de depositário'],
    ['c15', 'Pesquisa de antecedentes e vínculos dos suspeitos']
  ]}
];

const CHECK_ESPECIFICO = {
  animal: { s: 'Semoventes', itens: [
    ['a1', 'Contagem do rebanho e diferença apurada (data da última contagem)'],
    ['a2', 'Saldo/ficha sanitária do rebanho na Iagro (comprovante)'],
    ['a3', 'Certidão de registro da marca (ferro) e desenho/foto da marca'],
    ['a4', 'Brincos, SISBOV, chips, sinais particulares e fotos dos animais'],
    ['a5', 'Vestígios de abate no local (vísceras, couro, sangue) — perícia'],
    ['a6', 'Embarcadouro improvisado, marcas de caminhão boiadeiro'],
    ['a7', 'Consultar GTAs emitidas no período e na região (Iagro)'],
    ['a8', 'Diligências em frigoríficos, leilões, açougues e compradores'],
    ['a9', 'Comunicar barreiras/fiscalização (PRF, PMA, DOF, Iagro)'],
    ['a10', 'Animais recuperados: conferência de marca e comunicação à Iagro']
  ]},
  maquina: { s: 'Máquinas e eletrônicos', itens: [
    ['m1', 'Número de série, chassi/PIN, modelo e ano de cada item'],
    ['m2', 'Notas fiscais e registros de manutenção (concessionária)'],
    ['m3', 'Telemetria/rastreamento do fabricante (último sinal e localização)'],
    ['m4', 'Comunicar fabricante e revendas para bloqueio/alerta de série'],
    ['m5', 'Diligências em revendas, oficinas e anúncios de usados (internet)'],
    ['m6', 'Verificar desmonte/adulteração de identificação em apreensões']
  ]},
  insumo: { s: 'Defensivos, insumos e produção', itens: [
    ['i1', 'Notas fiscais, lotes, quantidades e embalagens subtraídas'],
    ['i2', 'Comunicar fabricante/distribuidor com números de lote'],
    ['i3', 'Verificar comercialização irregular (Iagro / revendas)'],
    ['i4', 'Produto apreendido: checar registro e origem (Lei 14.785/2023)'],
    ['i5', 'Grãos/combustível: tickets de balança, armazéns e compradores'],
    ['i6', 'Produto estrangeiro: avaliar atribuição federal (contrabando)']
  ]},
  fraude: { s: 'Fraude / estelionato', itens: [
    ['f1', 'Conversas, anúncios, perfis e números usados pelo autor'],
    ['f2', 'Comprovantes de pagamento, contas e chaves Pix envolvidas'],
    ['f3', 'Contratos, recibos, GTAs e notas da negociação'],
    ['f4', 'Representação/requisição de dados bancários e telemáticos'],
    ['f5', 'Identificar transportador e destino dos bens entregues']
  ]},
  geral: { s: 'Específico', itens: [
    ['g1', 'Delimitar objeto material e vínculo com a atividade rural'],
    ['g2', 'Verificar se há violência/grave ameaça e número de envolvidos'],
    ['g3', 'Avaliar atribuição (DELEAGRO, unidade local ou federal)']
  ]}
};

/* Legislação — resumos para consulta rápida. Conferir sempre o texto vigente. */
const LEGISLACAO = [
  { g: 'Código Penal — patrimônio', itens: [
    { t: 'Furto — art. 155', p: 'Reclusão 1 a 4 anos e multa (caput)',
      r: 'Subtrair, para si ou para outrem, coisa alheia móvel. §1º: aumento de 1/3 se praticado durante o repouso noturno. §2º: furto privilegiado (primário e coisa de pequeno valor). §4º: qualificado (2 a 8 anos) — destruição/rompimento de obstáculo; abuso de confiança, fraude, escalada ou destreza; chave falsa; concurso de duas ou mais pessoas. §5º: veículo automotor levado a outro Estado ou ao exterior (3 a 8 anos).' },
    { t: 'Abigeato — art. 155, §6º', p: 'Reclusão 2 a 5 anos',
      r: 'Subtração de semovente domesticável de produção, ainda que abatido ou dividido em partes no local da subtração (Lei 13.330/2016). Exige animal destinado à produção. Há debate sobre concurso com as qualificadoras do §4º.' },
    { t: 'Roubo — art. 157', p: 'Reclusão 4 a 10 anos e multa',
      r: 'Subtração mediante grave ameaça ou violência à pessoa, ou após reduzi-la à impossibilidade de resistência. §2º: aumento de 1/3 até metade (ex.: concurso de agentes, restrição de liberdade da vítima, veículo levado a outro Estado). §2º-A: aumento de 2/3 com emprego de arma de fogo.' },
    { t: 'Supressão ou alteração de marca em animais — art. 162', p: 'Detenção 6 meses a 3 anos e multa',
      r: 'Suprimir ou alterar, indevidamente, em gado ou rebanho alheio, marca ou sinal indicativo de propriedade.' },
    { t: 'Alteração de limites / esbulho — art. 161', p: 'Detenção 1 a 6 meses e multa',
      r: 'Suprimir ou deslocar tapume, marco ou sinal indicativo de linha divisória para apropriar-se de imóvel alheio. §1º, I: usurpação de águas; II: esbulho possessório — invadir, com violência a pessoa ou grave ameaça, ou mediante concurso de mais de duas pessoas, terreno ou edifício alheio. §3º: propriedade particular sem violência — ação mediante queixa.' },
    { t: 'Dano — art. 163', p: 'Detenção 1 a 6 meses ou multa',
      r: 'Destruir, inutilizar ou deteriorar coisa alheia. Parágrafo único (qualificado): violência ou grave ameaça, substância inflamável ou explosiva, entre outras hipóteses — detenção 6 meses a 3 anos e multa.' },
    { t: 'Introdução ou abandono de animais — art. 164', p: 'Detenção 15 dias a 6 meses ou multa',
      r: 'Introduzir ou deixar animais em propriedade alheia, sem consentimento, desde que do fato resulte prejuízo. Ação mediante queixa.' },
    { t: 'Apropriação indébita — art. 168', p: 'Reclusão 1 a 4 anos e multa',
      r: 'Apropriar-se de coisa alheia móvel de que tem a posse ou detenção. §1º: aumento de 1/3 (ex.: depositário judicial; em razão de ofício, emprego ou profissão). Útil para gado em parceria/arrendamento, insumos ou máquinas confiados.' },
    { t: 'Estelionato — art. 171', p: 'Reclusão 1 a 5 anos e multa',
      r: 'Obter vantagem ilícita induzindo ou mantendo alguém em erro, mediante artifício, ardil ou outro meio fraudulento (ex.: falsa compra de gado com pagamento simulado, falso anúncio de máquinas). §2º-A: fraude eletrônica — 4 a 8 anos. §5º: em regra, ação pública condicionada à representação, com exceções legais.' },
    { t: 'Receptação — art. 180', p: 'Reclusão 1 a 4 anos e multa',
      r: 'Adquirir, receber, transportar, conduzir ou ocultar coisa que sabe ser produto de crime. §1º: receptação qualificada no exercício de atividade comercial ou industrial — 3 a 8 anos. §3º: culposa — detenção 1 mês a 1 ano ou multa.' },
    { t: 'Receptação de animal — art. 180-A', p: 'Reclusão 2 a 5 anos e multa',
      r: 'Adquirir, receber, transportar, conduzir, ocultar, ter em depósito ou vender, com a finalidade de produção ou de comercialização, semovente domesticável de produção, ainda que abatido ou dividido em partes, que deve saber ser produto de crime (Lei 13.330/2016).' },
    { t: 'Associação criminosa — art. 288', p: 'Reclusão 1 a 3 anos',
      r: 'Associarem-se 3 ou mais pessoas para o fim específico de cometer crimes. Aumento até a metade se armada ou com participação de criança ou adolescente.' }
  ]},
  { g: 'Agrotóxicos — Lei 14.785/2023', itens: [
    { t: 'Art. 56', p: 'Reclusão 3 a 9 anos e multa',
      r: 'Produzir, armazenar, transportar, importar, utilizar ou comercializar agrotóxicos, produtos de controle ambiental ou afins não registrados ou não autorizados. Revogou a Lei 7.802/1989.' },
    { t: 'Art. 57', p: 'Reclusão 2 a 4 anos e multa',
      r: 'Condutas com agrotóxicos de uso permitido (comercialização, resíduos e embalagens) em descumprimento às exigências legais. Conferir redação do tipo.' }
  ]},
  { g: 'Crimes ambientais — Lei 9.605/1998', itens: [
    { t: 'Fauna silvestre — art. 29', p: 'Detenção 6 meses a 1 ano e multa', r: 'Matar, perseguir, caçar, apanhar ou utilizar espécimes da fauna silvestre sem autorização.' },
    { t: 'Maus-tratos — art. 32', p: 'Detenção 3 meses a 1 ano e multa', r: 'Abuso, maus-tratos, ferir ou mutilar animais silvestres, domésticos ou domesticados. §1º-A: cão ou gato — reclusão 2 a 5 anos.' },
    { t: 'Incêndio em mata ou floresta — art. 41', p: 'Reclusão 2 a 4 anos e multa', r: 'Provocar incêndio em mata ou floresta. Culposo: detenção 6 meses a 1 ano e multa.' },
    { t: 'Produto tóxico — art. 56', p: 'Reclusão 1 a 4 anos e multa', r: 'Produzir, transportar, armazenar, ter em depósito ou usar produto ou substância tóxica em desacordo com as exigências legais (aplicação residual após a Lei 14.785/2023).' }
  ]},
  { g: 'Outras normas', itens: [
    { t: 'Posse de arma em área rural — Lei 10.826/2003, art. 5º, §5º', p: '—', r: 'Para o residente em área rural, considera-se residência ou domicílio toda a extensão do imóvel rural (Lei 13.870/2019). Posse irregular de uso permitido: art. 12 (detenção 1 a 3 anos e multa); porte: art. 14 (reclusão 2 a 4 anos e multa).' },
    { t: 'Produto impróprio ao consumo — Lei 8.137/1990, art. 7º, IX', p: 'Detenção 2 a 5 anos ou multa', r: 'Vender, ter em depósito para vender ou expor à venda matéria-prima ou mercadoria em condições impróprias ao consumo. Frequente em abate clandestino ligado ao abigeato.' },
    { t: 'Contrabando — art. 334-A, CP', p: 'Reclusão 2 a 5 anos', r: 'Importar ou exportar mercadoria proibida. Atribuição federal; atenção a defensivos e animais vindos da fronteira.' }
  ]}
];
