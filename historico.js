/* DELEAGRO Campo — montagem do histórico do BO
   Fontes: entrevista informal com o comunicante ou relato do próprio policial.
   Entrada: gravação de áudio (anexo), ditado por voz, relato livre e roteiro de perguntas.
   A montagem é feita no aparelho, por regras fixas: nada é enviado a servidores. */
'use strict';

const DESC_NATUREZA = {
  abigeato: 'a subtração de animais (abigeato)',
  roubo_animal: 'o roubo de animais',
  recep_animal: 'a receptação de animais de origem ilícita',
  maquinario: 'a subtração de máquinas/implementos agrícolas',
  gps: 'a subtração de equipamentos de agricultura de precisão (GPS)',
  defensivos: 'a subtração de defensivos/insumos agrícolas',
  graos: 'a subtração de grãos/produção agrícola',
  receptacao: 'a receptação de bens de origem rural',
  estelionato: 'a prática de estelionato envolvendo negociação rural',
  apropriacao: 'a apropriação indébita de bens rurais',
  marca: 'a supressão/alteração de marca em animais',
  agrario: 'a invasão/esbulho de propriedade rural',
  outro: 'a prática de delito patrimonial no meio rural'
};

/* Roteiro de entrevista: p = pergunta exibida; f = frase do histórico ({r} = resposta) */
const ROTEIRO = {
  comum: [
    { id: 'quando', p: 'Quando e como o fato foi percebido?', f: 'O fato foi percebido {r}.' },
    { id: 'ultimo', p: 'Quando os bens foram vistos pela última vez?', f: 'Os bens foram vistos pela última vez {r}.' },
    { id: 'onde', p: 'Onde exatamente estavam (invernada, galpão, lavoura)?', f: 'Encontravam-se {r}.' },
    { id: 'acesso', p: 'Como os autores acessaram o local?', f: 'Quanto ao acesso, {r}.' },
    { id: 'vestigios', p: 'Que vestígios foram encontrados?', f: 'No local foram observados os seguintes vestígios: {r}.' },
    { id: 'veiculos', p: 'Veículos ou pessoas estranhas vistos na região?', f: 'Sobre movimentação suspeita, {r}.' },
    { id: 'suspeita', p: 'Desconfia de alguém? Por quê?', f: 'Quanto à autoria, {r}.' },
    { id: 'cameras', p: 'Há câmeras na propriedade ou nas proximidades?', f: 'Sobre câmeras de monitoramento, {r}.' },
    { id: 'prejuizo', p: 'Qual o prejuízo estimado?', f: 'O prejuízo estimado é de {r}.' }
  ],
  animal: [
    { id: 'contagem', p: 'Como foi apurada a falta (contagem, data)?', f: 'A falta foi apurada {r}.' },
    { id: 'marcas', p: 'Marca, brinco ou sinais dos animais?', f: 'Os animais possuem {r}.' },
    { id: 'iagro', p: 'Saldo na Iagro e documentos dos animais?', f: 'Quanto à documentação junto à Iagro, {r}.' },
    { id: 'abate', p: 'Houve abate no local? Vestígios de carcaça?', f: 'Quanto a abate no local, {r}.' }
  ],
  maquina: [
    { id: 'equip', p: 'Equipamento, marca, modelo e nº de série?', f: 'Trata-se de {r}.' },
    { id: 'rastreio', p: 'Possui telemetria/rastreamento? Último sinal?', f: 'Quanto a rastreamento, {r}.' },
    { id: 'guarda', p: 'Como o equipamento estava guardado?', f: 'O equipamento estava {r}.' }
  ],
  insumo: [
    { id: 'produto', p: 'Produto, quantidade, embalagem e lote?', f: 'Foram subtraídos {r}.' },
    { id: 'nf', p: 'Possui notas fiscais? De quem comprou?', f: 'Quanto à documentação, {r}.' },
    { id: 'armaz', p: 'Onde e como estava armazenado?', f: 'O produto estava armazenado {r}.' }
  ],
  fraude: [
    { id: 'negocio', p: 'Como foi a negociação (anúncio, contato, valores)?', f: 'A negociação ocorreu da seguinte forma: {r}.' },
    { id: 'pagamento', p: 'Como foi feito o pagamento? Contas/Pix?', f: 'Quanto ao pagamento, {r}.' },
    { id: 'contato', p: 'Telefones, perfis e nomes usados pelo autor?', f: 'O autor utilizou {r}.' }
  ],
  geral: []
};
const roteiroDe = c => [...ROTEIRO.comum, ...(ROTEIRO[natureza(c.natureza).grupo] || [])];

function hist(c) {
  if (!c.historico) c.historico = { fonte: 'entrevista', comunicanteId: '', roteiro: {}, relato: '', texto: '', anexos: [], editado: false };
  return c.historico;
}

/* ----- montagem do texto ----- */
const NOME = p => (p.nome || '').toUpperCase();
const listaPt = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join('; ') + ' e ' + arr[arr.length - 1];
const semPonto = s => String(s || '').trim().replace(/[.;\s]+$/, '');

function montarHistorico(c) {
  const h = hist(c), L = c.local, P = [];
  const com = c.pessoas.find(p => p.id === h.comunicanteId);
  const desc = DESC_NATUREZA[c.natureza] || DESC_NATUREZA.outro;
  const quando = [L.dataFato && 'em ' + fmtData(L.dataFato), L.horaFato && 'por volta das ' + L.horaFato + ' horas'].filter(Boolean).join(', ');
  const onde = [L.propriedade ? 'propriedade rural denominada ' + L.propriedade : 'propriedade rural',
    L.municipio && 'município de ' + L.municipio, L.endereco && 'com acesso por ' + semPonto(L.endereco),
    L.referencia && 'referência: ' + semPonto(L.referencia)].filter(Boolean).join(', ');
  const coord = L.lat && L.lng ? ' (coordenadas geográficas ' + L.lat + ', ' + L.lng + ')' : '';

  // 1. abertura
  if (h.fonte === 'policial') {
    P.push(`Registra-se que a equipe policial da ${c.unidade || 'DELEAGRO'}${c.responsavel ? ', sob responsabilidade de ' + c.responsavel : ''}, em diligência${L.dataComunicacao ? ' realizada em ' + fmtData(L.dataComunicacao) : ''}, compareceu à ${onde}${coord}, onde apurou ${desc}${quando ? ', ocorrida ' + quando : ''}.`);
    const vit = c.pessoas.filter(p => p.papel === 'vitima' && p.nome);
    if (vit.length) P.push(`Figura${vit.length > 1 ? 'm' : ''} como vítima${vit.length > 1 ? 's' : ''} ${listaPt(vit.map(v => NOME(v) + (v.relacao ? ' (' + semPonto(v.relacao) + ')' : '')))}.`);
  } else {
    const quem = com ? (com.papel === 'vitima' ? 'a vítima ' : 'o(a) comunicante ') + NOME(com) + (com.relacao ? ', ' + semPonto(com.relacao) : '') : 'o(a) comunicante';
    P.push(`Noticia ${quem}, ${desc}${quando ? ', ocorrida ' + quando : ''}, na ${onde}${coord}.`);
  }

  // 2. roteiro
  const frases = roteiroDe(c).filter(q => (h.roteiro[q.id] || '').trim()).map(q => q.f.replace('{r}', semPonto(h.roteiro[q.id])));
  if (frases.length) P.push((h.fonte === 'policial' ? 'Apurou-se que ' : 'Segundo informado, ') + frases.map((f, i) => i ? f : f.charAt(0).toLowerCase() + f.slice(1)).join(' '));

  // 3. relato livre
  if ((h.relato || '').trim()) P.push(h.fonte === 'policial' ? h.relato.trim() : 'Em entrevista, relatou, em síntese: ' + h.relato.trim());

  // 4. bens
  const sit = {};
  c.bens.forEach(b => {
    const q = Number(b.quantidade) || 1;
    const det = [b.raca, b.pelagem, b.marca && 'marca ' + semPonto(b.marca), b.brinco && 'brinco/chip ' + b.brinco, b.fabricante, b.modelo, b.serie && 'nº de série ' + b.serie, b.lote && 'lote ' + b.lote].filter(Boolean).join(', ');
    const item = q + ' ' + (b.descricao || catBem(b.categoria).nome).toLowerCase() + (det ? ' (' + det + ')' : '') + (b.valor ? ', com valor ' + (q > 1 ? 'unitário ' : '') + 'estimado de ' + moeda(b.valor) : '');
    (sit[b.situacao || 'Subtraído'] = sit[b.situacao || 'Subtraído'] || []).push(item);
  });
  const verbo = { 'Subtraído': 'Foram subtraídos', 'Recuperado': 'Foram recuperados', 'Apreendido': 'Foram apreendidos', 'Restituído': 'Foram restituídos', 'Não localizado': 'Não foram localizados' };
  Object.entries(sit).forEach(([s, it]) => P.push(`${verbo[s] || s}: ${listaPt(it)}.`));
  const tot = c.bens.reduce((s, b) => s + (Number(b.valor) || 0) * (Number(b.quantidade) || 1), 0);
  if (tot) P.push(`O valor total estimado dos bens é de ${moeda(tot)}.`);

  // 5. suspeitos e testemunhas
  const sus = c.pessoas.filter(p => p.papel === 'suspeito');
  if (sus.length) P.push(`Como possível(is) autor(es) foi(ram) apontado(s): ${listaPt(sus.map(s => (NOME(s) || 'pessoa não identificada') + (s.apelido ? ', vulgo "' + s.apelido + '"' : '') + (s.veiculos ? ', utilizando ' + semPonto(s.veiculos) : '') + (s.indicios ? ', havendo como elementos ' + semPonto(s.indicios) : '')))}.`);
  const tes = c.pessoas.filter(p => p.papel === 'testemunha' && p.nome);
  if (tes.length) P.push(`Foi(ram) indicada(s) como testemunha(s): ${listaPt(tes.map(t => NOME(t) + (t.relacao ? ' (' + semPonto(t.relacao) + ')' : '')))}.`);

  // 6. providências e registros
  const feitas = itensChecklist(c).filter(([id]) => c.checklist[id]?.ok).map(([id, t]) => semPonto(t).charAt(0).toLowerCase() + semPonto(t).slice(1) + (c.checklist[id].obs ? ' (' + semPonto(c.checklist[id].obs) + ')' : ''));
  if (feitas.length) P.push(`Diligências realizadas: ${listaPt(feitas)}.`);
  const nOit = c.pessoas.reduce((s, p) => s + (p.anexos || []).filter(m => m.origem === 'oitiva').length, 0) + (h.anexos || []).length;
  const regs = [c.fotos.length && c.fotos.length + ' fotografia(s) do local', nOit && nOit + ' gravação(ões) de áudio/vídeo'].filter(Boolean);
  if (regs.length) P.push(`Os registros produzidos (${listaPt(regs)}) foram preservados com data, localização e hash SHA-256.`);

  return P.join('\n\n');
}

/* ----- aba Histórico ----- */
function abaHist(c) {
  const h = hist(c);
  const pessoasOpc = c.pessoas.filter(p => p.papel === 'comunicante' || p.papel === 'vitima');
  const fala = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const grava = !!(navigator.mediaDevices && window.MediaRecorder);
  return `
  <section class="box"><h2>Fonte do histórico</h2>
    <div class="seg2">
      <button class="${h.fonte === 'entrevista' ? 'on' : ''}" data-hfonte="entrevista">Entrevista com o comunicante</button>
      <button class="${h.fonte === 'policial' ? 'on' : ''}" data-hfonte="policial">Relato do policial</button></div>
    ${h.fonte === 'entrevista' ? `<label class="f"><span>Comunicante / vítima entrevistado(a)</span><select data-h="comunicanteId">
      <option value="">${pessoasOpc.length ? 'Selecione' : 'Cadastre o comunicante na aba Pessoas'}</option>
      ${pessoasOpc.map(p => `<option value="${p.id}" ${h.comunicanteId === p.id ? 'selected' : ''}>${esc(p.nome || '(sem nome)')} — ${papel(p.papel).nome}</option>`).join('')}</select></label>` : ''}
  </section>
  <section class="box"><h2>Gravação</h2>
    <p class="muted small">${h.fonte === 'entrevista' ? 'Grave a conversa informal (com ciência do entrevistado) para consulta posterior.' : 'Grave sua narrativa do que foi constatado no local.'}</p>
    <div class="row wrap">
      ${grava ? `<button class="btn" data-acao="gravar-audio" id="btnGrava">● Gravar áudio</button><span id="tempoGrava" class="muted"></span>` : ''}
      <label class="btn ghost file">Anexar áudio/vídeo<input type="file" accept="audio/*,video/*" data-hist-anx hidden></label></div>
    <div data-histanx>${htmlAnexos(h.anexos)}</div>
  </section>
  <section class="box"><h2>Relato livre</h2>
    <p class="muted small">${fala ? 'Toque em “Ditar” e fale; o texto aparece no campo.' : 'Para ditar, toque no campo e use o microfone do teclado do celular.'} O reconhecimento de voz do sistema pode usar servidores da Apple/Google; para conteúdo sigiloso, prefira digitar.</p>
    ${fala ? `<div class="row"><button class="btn ghost" data-acao="ditar" id="btnDita">🎤 Ditar</button><span id="statusDita" class="muted"></span></div>` : ''}
    <label class="f"><textarea data-h="relato" id="relatoLivre" rows="7" placeholder="${h.fonte === 'entrevista' ? 'O que o comunicante contou, com as palavras dele…' : 'Narrativa do policial: o que foi constatado, diligências, pessoas ouvidas…'}">${esc(h.relato)}</textarea></label>
  </section>
  <section class="box"><h2>Roteiro de perguntas</h2>
    <p class="muted small">Respostas curtas; cada uma vira uma frase do histórico. Deixe em branco o que não se aplica.</p>
    ${roteiroDe(c).map(q => `<label class="f"><span>${esc(q.p)}</span><input data-hr="${q.id}" value="${esc(h.roteiro[q.id])}"></label>`).join('')}
  </section>
  <section class="box"><h2>Histórico do BO</h2>
    <p class="muted small">Montado com os dados de todas as abas. Revise e ajuste antes de lançar no SIGO.</p>
    <div class="row wrap"><button class="btn" data-acao="montar-hist">${h.texto ? 'Remontar histórico' : 'Montar histórico'}</button>
      ${h.texto ? '<button class="btn ghost" data-acao="copiar-hist">Copiar</button>' : ''}</div>
    <label class="f"><textarea data-h="texto" id="textoHist" rows="16" placeholder="Toque em “Montar histórico”.">${esc(h.texto)}</textarea></label>
  </section>`;
}

/* ----- gravação de áudio ----- */
const Grav = { rec: null, partes: [], inicio: 0, timer: null, stream: null };
async function alternarGravacao(c) {
  if (Grav.rec) { Grav.rec.stop(); return; }
  try {
    Grav.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) { return toast('Microfone não autorizado'); }
  const tipos = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', ''];
  const tipo = tipos.find(t => !t || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)));
  Grav.rec = new MediaRecorder(Grav.stream, tipo ? { mimeType: tipo } : undefined);
  Grav.partes = []; Grav.inicio = Date.now();
  Grav.rec.ondataavailable = e => e.data.size && Grav.partes.push(e.data);
  Grav.rec.onstop = async () => {
    clearInterval(Grav.timer); Grav.stream.getTracks().forEach(t => t.stop());
    const mt = Grav.rec.mimeType || tipo || 'audio/mp4', ext = mt.includes('webm') ? 'webm' : 'm4a';
    const dur = (Date.now() - Grav.inicio) / 1000;
    const file = new File(Grav.partes, 'gravacao-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.' + ext, { type: mt.split(';')[0] });
    Grav.rec = null;
    const h = hist(c);
    abrirFolha('<h2>Salvando gravação…</h2>');
    try { h.anexos.push(await criarAnexo(c, file, 'audio', { duracao: dur, legenda: h.fonte === 'entrevista' ? 'Entrevista com o comunicante' : 'Relato do policial' })); await DB.salvar(c); toast('Gravação salva'); }
    catch (e) { toast('Falha ao salvar a gravação'); }
    fecharFolha(); render();
  };
  Grav.rec.start(1000);
  const b = $('#btnGrava'); if (b) { b.textContent = '■ Parar gravação'; b.classList.add('danger'); }
  Grav.timer = setInterval(() => { const el = $('#tempoGrava'); if (el) el.textContent = '● ' + fmtDur((Date.now() - Grav.inicio) / 1000); }, 500);
}

/* ----- ditado (reconhecimento de voz do navegador) ----- */
const Dit = { r: null };
function alternarDitado(c) {
  if (Dit.r) { Dit.r.stop(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  const r = new SR(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
  const ta = $('#relatoLivre'), base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
  let finais = '';
  r.onresult = e => {
    let inter = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finais += t.trim() + ' '; else inter += t;
    }
    ta.value = base + finais + inter;
    hist(c).relato = base + finais; salvarDepois(c);
  };
  r.onstart = () => { $('#btnDita').textContent = '■ Parar ditado'; $('#statusDita').textContent = 'Ouvindo…'; };
  r.onerror = e => { toast(e.error === 'not-allowed' ? 'Microfone/ditado não autorizado' : 'Ditado interrompido'); };
  r.onend = () => { Dit.r = null; const b = $('#btnDita'); if (b) b.textContent = '🎤 Ditar'; const s = $('#statusDita'); if (s) s.textContent = ''; hist(c).relato = ta.value; salvarDepois(c); };
  Dit.r = r;
  try { r.start(); } catch (e) { Dit.r = null; toast('Ditado indisponível'); }
}
