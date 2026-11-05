/* DELEAGRO Campo — aplicativo de campo para investigação de crimes rurais.
   Todos os dados ficam no próprio aparelho (IndexedDB). */
'use strict';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const hoje = () => new Date().toISOString().slice(0, 10);
const agoraHora = () => new Date().toTimeString().slice(0, 5);
const fmtData = d => d ? d.split('-').reverse().join('/') : '';
const fmtDH = ts => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const natureza = id => NATUREZAS.find(n => n.id === id) || NATUREZAS[NATUREZAS.length - 1];
const papel = id => PAPEIS.find(p => p.id === id) || PAPEIS[0];
const catBem = id => CATEGORIAS_BEM.find(c => c.id === id) || CATEGORIAS_BEM[CATEGORIAS_BEM.length - 1];
const moeda = v => v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';

/* ---------- identidade visual: logotipos oficiais (arquivos logo-deleagro.png e logo-pcms.png) ---------- */
const LOGOS = { deleagro: 'logo-deleagro.png', pcms: 'logo-pcms.png' };
const LOGO_DATA = {};
function logoImg(k, rot) {
  return `<img class="logo" src="${LOGOS[k]}" alt="${rot}" onerror="this.outerHTML='<span class=&quot;logo-fb&quot;>${rot}</span>'">`;
}
const logos = () => `<div class="logos">${logoImg('pcms', 'PCMS')}${logoImg('deleagro', 'DELEAGRO')}</div>`;
function marca(titulo, sub, acao = '') {
  return `<header class="brand"><div class="brand-in">${logos()}${acao}</div><div class="brand-tit"><h1>${titulo}</h1><small>${sub}</small></div></header>`;
}
function carregarLogosPDF() {
  Object.entries(LOGOS).forEach(([k, src]) => {
    const im = new Image();
    im.onload = () => { try { const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0); LOGO_DATA[k] = { data: cv.toDataURL('image/png'), r: im.naturalWidth / im.naturalHeight }; } catch (e) {} };
    im.src = src;
  });
}

/* ---------- armazenamento (IndexedDB com reserva em memória) ---------- */
const DB = {
  db: null, mem: new Map(), persistente: false,
  async abrir() {
    try {
      this.db = await new Promise((ok, err) => {
        const r = indexedDB.open('deleagro-campo', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('casos', { keyPath: 'id' });
        r.onsuccess = () => ok(r.result);
        r.onerror = () => err(r.error);
      });
      this.persistente = true;
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    } catch (e) { this.db = null; this.persistente = false; }
  },
  tx(modo) { return this.db.transaction('casos', modo).objectStore('casos'); },
  async todos() {
    if (!this.db) return [...this.mem.values()];
    return new Promise((ok, err) => { const r = this.tx('readonly').getAll(); r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error); });
  },
  async salvar(c) {
    c.atualizado = Date.now();
    if (!this.db) { this.mem.set(c.id, structuredClone(c)); return; }
    return new Promise((ok, err) => { const r = this.tx('readwrite').put(c); r.onsuccess = ok; r.onerror = () => err(r.error); });
  },
  async apagar(id) {
    if (!this.db) { this.mem.delete(id); return; }
    return new Promise((ok, err) => { const r = this.tx('readwrite').delete(id); r.onsuccess = ok; r.onerror = () => err(r.error); });
  }
};

const Pref = {
  get(k, d) { try { const v = localStorage.getItem('dc_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dc_' + k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- estado ---------- */
const S = { casos: [], tela: 'lista', casoId: null, aba: 'local', busca: '', filtro: '' };
const casoAtual = () => S.casos.find(c => c.id === S.casoId);

function novoCaso() {
  return {
    id: uid(), criado: Date.now(), atualizado: Date.now(),
    natureza: 'abigeato', bo: '', ip: '', unidade: 'DELEAGRO', responsavel: Pref.get('responsavel', ''),
    local: { propriedade: '', municipio: '', endereco: '', referencia: '', lat: '', lng: '', precisao: '',
      dataFato: hoje(), horaFato: '', dataComunicacao: hoje(), descricao: '', modus: '' },
    fotos: [], pessoas: [], bens: [], checklist: {}, notas: ''
  };
}

let salvarTimer = null;
function salvarDepois(c) {
  clearTimeout(salvarTimer);
  salvarTimer = setTimeout(() => DB.salvar(c).then(() => marcaSalvo()).catch(() => toast('Falha ao salvar')), 400);
}
function marcaSalvo() { const el = $('#salvo'); if (el) { el.textContent = 'Salvo ' + agoraHora(); } }

/* ---------- interface: toast e diálogos próprios (sem alert/confirm) ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2400);
}
function confirmar(msg, rotulo = 'Confirmar', perigo = true) {
  return new Promise(ok => {
    const m = $('#modal');
    m.innerHTML = `<div class="sheet"><p>${esc(msg)}</p><div class="row">
      <button class="btn ghost" data-r="0">Cancelar</button>
      <button class="btn ${perigo ? 'danger' : ''}" data-r="1">${esc(rotulo)}</button></div></div>`;
    m.classList.add('on');
    m.onclick = e => { const r = e.target.dataset.r; if (r !== undefined || e.target === m) { m.classList.remove('on'); m.innerHTML = ''; ok(r === '1'); } };
  });
}
function abrirFolha(html, aoMontar) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet big">${html}</div>`;
  m.classList.add('on');
  m.onclick = e => { if (e.target === m) fecharFolha(); };
  if (aoMontar) aoMontar(m.firstElementChild);
}
function fecharFolha() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; }

/* ---------- renderização principal ---------- */
function render() {
  const app = $('#app');
  if (S.tela === 'lista') app.innerHTML = telaLista();
  else if (S.tela === 'caso') app.innerHTML = telaCaso();
  else if (S.tela === 'leis') app.innerHTML = telaLeis();
  else if (S.tela === 'ajustes') app.innerHTML = telaAjustes();
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tela === (S.tela === 'caso' ? 'lista' : S.tela)));
  $('.tabbar').style.display = S.tela === 'caso' ? 'none' : '';
  window.scrollTo(0, 0);
}

/* ----- lista de ocorrências ----- */
function telaLista() {
  const q = S.busca.toLowerCase();
  const lista = S.casos
    .filter(c => !S.filtro || c.natureza === S.filtro)
    .filter(c => !q || [c.bo, c.ip, c.local.propriedade, c.local.municipio, ...c.pessoas.map(p => p.nome)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.atualizado - a.atualizado);
  const aviso = DB.persistente ? '' : `<div class="warn">Armazenamento local indisponível neste ambiente: os registros ficam só até fechar a página. Instale o app pelo endereço próprio para guardar os dados no aparelho.</div>`;
  return `
  ${marca('DELEAGRO <b>Campo</b>', 'Polícia Civil de Mato Grosso do Sul', '<button class="btn" data-acao="novo">+ Ocorrência</button>')}
  <main>
    ${aviso}
    <div class="busca">
      <input type="search" placeholder="Buscar por BO, IP, propriedade, município ou nome" value="${esc(S.busca)}" data-campo-busca>
      <select data-filtro><option value="">Todas as naturezas</option>
        ${NATUREZAS.map(n => `<option value="${n.id}" ${S.filtro === n.id ? 'selected' : ''}>${esc(n.nome)}</option>`).join('')}
      </select>
    </div>
    ${lista.length ? lista.map(cardCaso).join('') : `<div class="vazio"><p>Nenhuma ocorrência registrada.</p><p>Toque em <b>+ Ocorrência</b> para iniciar o levantamento de campo.</p></div>`}
  </main>`;
}
function cardCaso(c) {
  const n = natureza(c.natureza);
  const tot = itensChecklist(c).length, feitos = itensChecklist(c).filter(([id]) => c.checklist[id]?.ok).length;
  const vit = c.pessoas.filter(p => p.papel === 'vitima').map(p => p.nome).filter(Boolean)[0];
  return `<button class="card" data-abrir="${c.id}">
    <div class="card-h"><span class="tag">${esc(n.nome)}</span><span class="muted">${fmtDH(c.atualizado)}</span></div>
    <div class="card-t">${esc(c.local.propriedade || 'Propriedade não informada')}${c.local.municipio ? ' — ' + esc(c.local.municipio) : ''}</div>
    <div class="card-m">${c.bo ? 'BO ' + esc(c.bo) + ' · ' : ''}${vit ? 'Vítima: ' + esc(vit) + ' · ' : ''}${c.pessoas.length} pessoa(s) · ${c.bens.length} bem(ns) · ${c.fotos.length} foto(s)</div>
    <div class="prog"><i style="width:${tot ? Math.round(feitos / tot * 100) : 0}%"></i></div>
  </button>`;
}

/* ----- ocorrência ----- */
const ABAS = [['local', 'Local'], ['pessoas', 'Pessoas'], ['bens', 'Bens'], ['check', 'Checklist'], ['rel', 'Relatório']];
function telaCaso() {
  const c = casoAtual(); if (!c) { S.tela = 'lista'; return telaLista(); }
  const corpo = { local: abaLocal, pessoas: abaPessoas, bens: abaBens, check: abaCheck, rel: abaRel }[S.aba](c);
  return `
  <header class="top sticky"><button class="btn ghost sm" data-acao="voltar">‹ Ocorrências</button>
    <span id="salvo" class="muted">${DB.persistente ? 'Salvo automaticamente' : 'Sem armazenamento'}</span></header>
  <nav class="seg">${ABAS.map(([id, t]) => `<button data-aba="${id}" class="${S.aba === id ? 'on' : ''}">${t}${contAba(c, id)}</button>`).join('')}</nav>
  <main>${corpo}</main>`;
}
function contAba(c, id) {
  const n = id === 'pessoas' ? c.pessoas.length : id === 'bens' ? c.bens.length : 0;
  return n ? ` <b class="cnt">${n}</b>` : '';
}

const campo = (rot, path, val, tipo = 'text', extra = '') =>
  `<label class="f"><span>${rot}</span><input type="${tipo}" data-c="${path}" value="${esc(val)}" ${extra}></label>`;
const area = (rot, path, val, ph = '') =>
  `<label class="f"><span>${rot}</span><textarea data-c="${path}" rows="4" placeholder="${esc(ph)}">${esc(val)}</textarea></label>`;

function abaLocal(c) {
  const L = c.local;
  const mapa = L.lat && L.lng ? `<a class="btn ghost sm" href="https://maps.apple.com/?ll=${esc(L.lat)},${esc(L.lng)}&q=Local%20do%20fato" target="_blank" rel="noopener">Abrir no mapa</a>` : '';
  return `
  <section class="box"><h2>Identificação</h2>
    <label class="f"><span>Natureza</span><select data-c="natureza">
      ${NATUREZAS.map(n => `<option value="${n.id}" ${c.natureza === n.id ? 'selected' : ''}>${esc(n.nome)}${n.cap ? ' — ' + esc(n.cap) : ''}</option>`).join('')}</select></label>
    <div class="g2">${campo('Nº do BO', 'bo', c.bo, 'text', 'inputmode="numeric"')}${campo('Nº do IP', 'ip', c.ip)}</div>
    <div class="g2">${campo('Unidade', 'unidade', c.unidade)}${campo('Responsável', 'responsavel', c.responsavel)}</div>
  </section>
  <section class="box"><h2>Local do fato</h2>
    ${campo('Propriedade (fazenda/sítio)', 'local.propriedade', L.propriedade)}
    <div class="g2">${campo('Município', 'local.municipio', L.municipio)}${campo('Ponto de referência', 'local.referencia', L.referencia)}</div>
    ${campo('Endereço / acesso', 'local.endereco', L.endereco)}
    <div class="g3">${campo('Latitude', 'local.lat', L.lat, 'text', 'inputmode="decimal"')}${campo('Longitude', 'local.lng', L.lng, 'text', 'inputmode="decimal"')}${campo('Precisão (m)', 'local.precisao', L.precisao, 'text', 'inputmode="numeric"')}</div>
    <div class="row"><button class="btn" data-acao="gps">Capturar GPS</button>${mapa}</div>
  </section>
  <section class="box"><h2>Datas</h2>
    <div class="g3">${campo('Data do fato', 'local.dataFato', L.dataFato, 'date')}${campo('Hora (aprox.)', 'local.horaFato', L.horaFato, 'time')}${campo('Comunicação', 'local.dataComunicacao', L.dataComunicacao, 'date')}</div>
  </section>
  <section class="box"><h2>Descrição</h2>
    ${area('Descrição do local e vestígios', 'local.descricao', L.descricao, 'Acessos, cercas, porteiras, rastros, vestígios de abate, embarcadouro…')}
    ${area('Modus operandi', 'local.modus', L.modus, 'Como os autores agiram, horário provável, veículos, rota de fuga…')}
  </section>
  <section class="box"><h2>Fotos <small class="muted">${c.fotos.length}</small></h2>
    <label class="btn file">Tirar / escolher fotos<input type="file" accept="image/*" multiple data-acao="fotos" hidden></label>
    <div class="fotos">${c.fotos.map(f => `<figure><img src="${f.data}" alt="" data-foto="${f.id}"><figcaption>${esc(f.legenda || fmtDH(f.ts))}</figcaption></figure>`).join('')}</div>
  </section>
  <section class="box"><h2>Anotações</h2>${area('Notas livres da equipe', 'notas', c.notas)}</section>
  <button class="btn danger block" data-acao="apagar-caso">Excluir ocorrência</button>`;
}

function abaPessoas(c) {
  const grupos = PAPEIS.map(p => {
    const ps = c.pessoas.filter(x => x.papel === p.id);
    return `<section class="box"><h2><i class="dot" style="background:${p.cor}"></i>${p.nome}s <small class="muted">${ps.length}</small>
      <button class="btn sm" data-nova-pessoa="${p.id}">+ ${p.nome}</button></h2>
      ${ps.length ? ps.map(x => `<button class="item" data-pessoa="${x.id}">
        <b>${esc(x.nome || '(sem nome)')}</b>${x.apelido ? ' <span class="muted">“' + esc(x.apelido) + '”</span>' : ''}
        <span class="muted">${[x.cpf && 'CPF ' + x.cpf, x.telefone, x.relacao].filter(Boolean).map(esc).join(' · ')}</span></button>`).join('') : '<p class="muted">Nenhum registro.</p>'}
    </section>`;
  });
  return grupos.join('');
}

function formPessoa(c, x) {
  const novo = !c.pessoas.includes(x);
  const susp = x.papel === 'suspeito';
  const f = (rot, k, tipo = 'text', extra = '') => `<label class="f"><span>${rot}</span><input type="${tipo}" name="${k}" value="${esc(x[k])}" ${extra}></label>`;
  const a = (rot, k, ph = '') => `<label class="f"><span>${rot}</span><textarea name="${k}" rows="3" placeholder="${esc(ph)}">${esc(x[k])}</textarea></label>`;
  abrirFolha(`
    <h2>${novo ? 'Nova pessoa' : 'Editar pessoa'}</h2>
    <form id="fp">
      <label class="f"><span>Condição</span><select name="papel">${PAPEIS.map(p => `<option value="${p.id}" ${x.papel === p.id ? 'selected' : ''}>${p.nome}</option>`).join('')}</select></label>
      ${f('Nome completo', 'nome')}
      <div class="g2">${f('Apelido / vulgo', 'apelido')}${f('Data de nascimento', 'nasc', 'date')}</div>
      <div class="g2">${f('CPF', 'cpf', 'text', 'inputmode="numeric"')}${f('RG / órgão', 'rg')}</div>
      ${f('Filiação', 'filiacao')}
      <div class="g2">${f('Telefone', 'telefone', 'tel')}${f('Profissão', 'profissao')}</div>
      ${f('Endereço', 'endereco')}
      ${f('Relação com o fato / com a vítima', 'relacao', 'text', 'placeholder="Ex.: proprietário, capataz, vizinho, comprador"')}
      ${susp ? f('Veículos / placas', 'veiculos') + a('Características físicas e sinais', 'caracteristicas') + a('Elementos de autoria', 'indicios', 'Câmeras, reconhecimento, GTA, conversas, apreensões…') : ''}
      ${a('Síntese das declarações', 'relato')}
      <div class="row end">
        ${novo ? '' : '<button type="button" class="btn danger ghost" data-del>Excluir</button>'}
        <button type="button" class="btn ghost" data-cancel>Cancelar</button>
        <button class="btn">Salvar</button></div>
    </form>`, el => {
    const form = $('#fp', el);
    form.papel.onchange = () => { Object.assign(x, Object.fromEntries(new FormData(form))); formPessoa(c, x); };
    $('[data-cancel]', el).onclick = fecharFolha;
    const del = $('[data-del]', el);
    if (del) del.onclick = async () => { if (await confirmar('Excluir esta pessoa?', 'Excluir')) { c.pessoas = c.pessoas.filter(p => p !== x); await DB.salvar(c); render(); } };
    form.onsubmit = async e => {
      e.preventDefault();
      Object.assign(x, Object.fromEntries(new FormData(form)));
      if (!c.pessoas.includes(x)) c.pessoas.push(x);
      await DB.salvar(c); fecharFolha(); render(); toast('Pessoa salva');
    };
  });
}

function abaBens(c) {
  const total = c.bens.reduce((s, b) => s + (Number(b.valor) || 0) * (Number(b.quantidade) || 1), 0);
  return `<section class="box"><h2>Bens <small class="muted">${c.bens.length}</small><button class="btn sm" data-acao="novo-bem">+ Bem</button></h2>
    ${c.bens.length ? c.bens.map(b => `<button class="item" data-bem="${b.id}">
      <b>${esc(b.quantidade || 1)}× ${esc(b.descricao || catBem(b.categoria).nome)}</b>
      <span class="muted">${[catBem(b.categoria).nome, b.situacao, b.marca && 'Marca: ' + b.marca, b.serie && 'Série: ' + b.serie, moeda(b.valor)].filter(Boolean).map(esc).join(' · ')}</span></button>`).join('') : '<p class="muted">Nenhum bem cadastrado.</p>'}
    ${total ? `<p class="total">Valor estimado total: <b>${moeda(total)}</b></p>` : ''}
  </section>`;
}

function formBem(c, b) {
  const novo = !c.bens.includes(b);
  const f = (rot, k, tipo = 'text', extra = '') => `<label class="f"><span>${rot}</span><input type="${tipo}" name="${k}" value="${esc(b[k])}" ${extra}></label>`;
  const animal = b.categoria === 'animal', maq = b.categoria === 'maquina' || b.categoria === 'eletronico', ins = b.categoria === 'insumo' || b.categoria === 'producao';
  abrirFolha(`
    <h2>${novo ? 'Novo bem' : 'Editar bem'}</h2>
    <form id="fb">
      <label class="f"><span>Categoria</span><select name="categoria">${CATEGORIAS_BEM.map(x => `<option value="${x.id}" ${b.categoria === x.id ? 'selected' : ''}>${x.nome}</option>`).join('')}</select></label>
      ${f('Descrição', 'descricao', 'text', `placeholder="${animal ? 'Ex.: novilhas nelore' : maq ? 'Ex.: receptor GPS StarFire' : 'Ex.: herbicida 20 L'}"`)}
      <div class="g2">${f('Quantidade', 'quantidade', 'number', 'min="1" inputmode="numeric"')}
        <label class="f"><span>Situação</span><select name="situacao">${SITUACOES_BEM.map(s => `<option ${b.situacao === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
      ${animal ? `<div class="g2">${f('Espécie', 'especie', 'text', 'placeholder="Bovino, equino, ovino…"')}${f('Raça', 'raca')}</div>
        <div class="g3">${f('Sexo', 'sexo')}${f('Idade / era', 'idade')}${f('Pelagem', 'pelagem')}</div>
        <div class="g2">${f('Marca (ferro)', 'marca')}${f('Brinco / SISBOV / chip', 'brinco')}</div>` : ''}
      ${maq ? `<div class="g2">${f('Fabricante', 'fabricante')}${f('Modelo', 'modelo')}</div>
        <div class="g2">${f('Nº de série / chassi / PIN', 'serie')}${f('Ano', 'ano', 'text', 'inputmode="numeric"')}</div>
        ${f('Placa / outros identificadores', 'placa')}` : ''}
      ${ins ? `<div class="g2">${f('Fabricante / marca comercial', 'fabricante')}${f('Lote', 'lote')}</div>
        ${f('Unidade (L, kg, sacas, t)', 'unidade')}` : ''}
      <div class="g2">${f('Valor unitário estimado (R$)', 'valor', 'number', 'step="0.01" inputmode="decimal"')}${f('Nota fiscal / documento', 'nf')}</div>
      <label class="f"><span>Sinais particulares / observações</span><textarea name="obs" rows="3">${esc(b.obs)}</textarea></label>
      <div class="row end">
        ${novo ? '' : '<button type="button" class="btn danger ghost" data-del>Excluir</button>'}
        <button type="button" class="btn ghost" data-cancel>Cancelar</button>
        <button class="btn">Salvar</button></div>
    </form>`, el => {
    const form = $('#fb', el);
    form.categoria.onchange = () => { Object.assign(b, Object.fromEntries(new FormData(form))); formBem(c, b); };
    $('[data-cancel]', el).onclick = fecharFolha;
    const del = $('[data-del]', el);
    if (del) del.onclick = async () => { if (await confirmar('Excluir este bem?', 'Excluir')) { c.bens = c.bens.filter(x => x !== b); await DB.salvar(c); render(); } };
    form.onsubmit = async e => {
      e.preventDefault();
      Object.assign(b, Object.fromEntries(new FormData(form)));
      if (!c.bens.includes(b)) c.bens.push(b);
      await DB.salvar(c); fecharFolha(); render(); toast('Bem salvo');
    };
  });
}

function secoesChecklist(c) {
  const n = natureza(c.natureza);
  const esp = CHECK_ESPECIFICO[n.grupo] || CHECK_ESPECIFICO.geral;
  const secs = [CHECK_COMUM[0], CHECK_COMUM[1], esp, CHECK_COMUM[2]];
  if (n.grupo === 'geral' && c.bens.some(b => b.categoria === 'animal')) secs.splice(3, 0, CHECK_ESPECIFICO.animal);
  return secs;
}
const itensChecklist = c => secoesChecklist(c).flatMap(s => s.itens);

function abaCheck(c) {
  const its = itensChecklist(c), feitos = its.filter(([id]) => c.checklist[id]?.ok).length;
  return `<p class="muted">Roteiro para <b>${esc(natureza(c.natureza).nome)}</b> — ${feitos} de ${its.length} concluídos.</p>
    <div class="prog big"><i style="width:${Math.round(feitos / its.length * 100)}%"></i></div>
    ${secoesChecklist(c).map(s => `<section class="box"><h2>${esc(s.s)}</h2>
      ${s.itens.map(([id, t]) => { const v = c.checklist[id] || {}; return `<div class="chk ${v.ok ? 'ok' : ''}">
        <label><input type="checkbox" data-chk="${id}" ${v.ok ? 'checked' : ''}><span>${esc(t)}</span></label>
        <input class="obs" placeholder="Observação" data-chkobs="${id}" value="${esc(v.obs)}"></div>`; }).join('')}
    </section>`).join('')}`;
}

/* ----- relatório ----- */
function textoRelatorio(c) {
  const n = natureza(c.natureza), L = c.local, linhas = [];
  const add = (...l) => linhas.push(...l);
  add('LEVANTAMENTO DE CAMPO — ' + (c.unidade || 'DELEAGRO').toUpperCase(), '');
  add('Natureza: ' + n.nome + (n.cap ? ' (' + n.cap + ')' : ''));
  if (c.bo) add('BO: ' + c.bo); if (c.ip) add('IP: ' + c.ip);
  if (c.responsavel) add('Responsável: ' + c.responsavel);
  add('', '1. LOCAL E DATA');
  add('Propriedade: ' + (L.propriedade || '—') + (L.municipio ? ', ' + L.municipio : ''));
  if (L.endereco) add('Acesso: ' + L.endereco); if (L.referencia) add('Referência: ' + L.referencia);
  if (L.lat && L.lng) add('Coordenadas: ' + L.lat + ', ' + L.lng + (L.precisao ? ' (±' + L.precisao + ' m)' : ''));
  add('Data do fato: ' + (fmtData(L.dataFato) || '—') + (L.horaFato ? ' por volta das ' + L.horaFato : '') + (L.dataComunicacao ? ' · Comunicação: ' + fmtData(L.dataComunicacao) : ''));
  if (L.descricao) add('', 'Descrição do local: ' + L.descricao);
  if (L.modus) add('', 'Modus operandi: ' + L.modus);
  add('', '2. PESSOAS ENVOLVIDAS');
  if (!c.pessoas.length) add('Nenhuma pessoa cadastrada.');
  PAPEIS.forEach(p => c.pessoas.filter(x => x.papel === p.id).forEach(x => {
    const q = [x.apelido && 'vulgo "' + x.apelido + '"', x.nasc && 'nascido(a) em ' + fmtData(x.nasc), x.cpf && 'CPF ' + x.cpf, x.rg && 'RG ' + x.rg,
      x.filiacao && 'filho(a) de ' + x.filiacao, x.profissao, x.endereco && 'residente em ' + x.endereco, x.telefone && 'tel. ' + x.telefone].filter(Boolean).join(', ');
    add('• ' + p.nome.toUpperCase() + ': ' + (x.nome || '(não identificado)') + (q ? ', ' + q : '') + '.');
    if (x.relacao) add('  Relação com o fato: ' + x.relacao);
    if (x.veiculos) add('  Veículos: ' + x.veiculos);
    if (x.caracteristicas) add('  Características: ' + x.caracteristicas);
    if (x.indicios) add('  Elementos de autoria: ' + x.indicios);
    if (x.relato) add('  Declarações: ' + x.relato);
  }));
  add('', '3. BENS');
  if (!c.bens.length) add('Nenhum bem cadastrado.');
  let total = 0;
  c.bens.forEach(b => {
    const q = Number(b.quantidade) || 1; total += (Number(b.valor) || 0) * q;
    const det = [b.especie, b.raca, b.sexo, b.idade, b.pelagem, b.marca && 'marca ' + b.marca, b.brinco && 'brinco/chip ' + b.brinco,
      b.fabricante, b.modelo, b.ano, b.serie && 'série ' + b.serie, b.placa, b.lote && 'lote ' + b.lote, b.unidade, b.nf && 'doc. ' + b.nf].filter(Boolean).join(', ');
    add('• ' + q + '× ' + (b.descricao || catBem(b.categoria).nome) + (det ? ' — ' + det : '') + ' [' + (b.situacao || 'Subtraído') + ']' + (b.valor ? ' — ' + moeda(b.valor) + ' cada' : ''));
    if (b.obs) add('  Obs.: ' + b.obs);
  });
  if (total) add('Valor estimado total: ' + moeda(total));
  add('', '4. DILIGÊNCIAS (CHECKLIST)');
  secoesChecklist(c).forEach(s => s.itens.forEach(([id, t]) => {
    const v = c.checklist[id]; if (v && (v.ok || v.obs)) add((v.ok ? '[x] ' : '[ ] ') + t + (v.obs ? ' — ' + v.obs : ''));
  }));
  const pend = itensChecklist(c).filter(([id]) => !c.checklist[id]?.ok);
  if (pend.length) { add('', 'Pendentes:'); pend.forEach(([, t]) => add('[ ] ' + t)); }
  if (c.fotos.length) add('', '5. FOTOGRAFIAS: ' + c.fotos.length + ' registro(s) no aparelho.');
  if (c.notas) add('', 'ANOTAÇÕES: ' + c.notas);
  add('', 'Gerado em ' + fmtDH(Date.now()) + ' — DELEAGRO Campo.');
  return linhas.join('\n');
}
function abaRel(c) {
  return `<section class="box"><h2>Relatório de levantamento</h2>
    <p class="muted">Texto montado a partir de tudo o que foi preenchido. Copie para o SIGO ou para a peça, e revise antes de usar.</p>
    <div class="row wrap">
      <button class="btn" data-acao="pdf">Gerar PDF com fotos</button>
      <button class="btn ghost" data-acao="copiar">Copiar texto</button>
      <button class="btn ghost" data-acao="compartilhar">Compartilhar texto</button>
      <button class="btn ghost" data-acao="exportar-caso">Backup desta ocorrência</button></div>
    <pre class="rel">${esc(textoRelatorio(c))}</pre></section>`;
}

/* ----- legislação ----- */
function telaLeis() {
  const q = (S.buscaLei || '').toLowerCase();
  const grupos = LEGISLACAO.map(g => ({ g: g.g, itens: g.itens.filter(i => !q || (i.t + i.r + i.p).toLowerCase().includes(q)) })).filter(g => g.itens.length);
  return `${marca('Legislação', 'Consulta rápida — resumos')}
  <main>
    <div class="warn info">Resumos para consulta em campo. Confira sempre o texto vigente no Planalto antes de capitular.</div>
    <div class="busca"><input type="search" placeholder="Buscar: semovente, marca, receptação, agrotóxico…" value="${esc(S.buscaLei || '')}" data-busca-lei></div>
    ${grupos.map(g => `<section class="box"><h2>${esc(g.g)}</h2>
      ${g.itens.map(i => `<details class="lei"><summary><b>${esc(i.t)}</b><span class="pena">${esc(i.p)}</span></summary><p>${esc(i.r)}</p></details>`).join('')}</section>`).join('') || '<p class="muted">Nada encontrado.</p>'}
    <p class="muted center"><a href="https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm" target="_blank" rel="noopener">Código Penal compilado (Planalto)</a></p>
  </main>`;
}

/* ----- ajustes ----- */
function telaAjustes() {
  const pin = !!Pref.get('pinHash', null);
  return `${marca('Ajustes', 'Segurança e dados')}
  <main>
    <section class="box"><h2>Responsável padrão</h2>
      <label class="f"><span>Nome e cargo (preenche novas ocorrências)</span><input data-pref="responsavel" value="${esc(Pref.get('responsavel', ''))}"></label></section>
    <section class="box"><h2>Bloqueio por PIN</h2>
      <p class="muted">${pin ? 'Ativo. O app pede o PIN ao abrir e após 5 minutos em segundo plano.' : 'Inativo.'} O PIN impede o acesso casual, mas não criptografa os dados; mantenha também o bloqueio do iPhone ativo.</p>
      <div class="row">${pin ? '<button class="btn ghost" data-acao="pin-off">Desativar PIN</button><button class="btn ghost" data-acao="pin-on">Trocar PIN</button>' : '<button class="btn" data-acao="pin-on">Definir PIN</button>'}</div></section>
    <section class="box"><h2>Backup</h2>
      <p class="muted">${S.casos.length} ocorrência(s) neste aparelho. O backup é um arquivo .json com tudo, inclusive fotos. Guarde em local seguro.</p>
      <div class="row wrap"><button class="btn" data-acao="exportar">Exportar tudo</button>
        <label class="btn ghost file">Importar backup<input type="file" accept="application/json,.json" data-acao="importar" hidden></label></div></section>
    <section class="box"><h2>Apagar dados</h2>
      <button class="btn danger" data-acao="apagar-tudo">Apagar todas as ocorrências</button></section>
    <p class="muted center">DELEAGRO Campo · protótipo v0.1 · dados somente no aparelho</p>
  </main>`;
}

/* ---------- ações ---------- */
function setPath(obj, path, v) { const ks = path.split('.'); let o = obj; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v; }

async function capturarGPS(c) {
  if (!navigator.geolocation) return toast('GPS indisponível neste ambiente');
  toast('Obtendo localização…');
  navigator.geolocation.getCurrentPosition(async p => {
    c.local.lat = p.coords.latitude.toFixed(6); c.local.lng = p.coords.longitude.toFixed(6); c.local.precisao = Math.round(p.coords.accuracy);
    await DB.salvar(c); render(); toast('Coordenadas registradas');
  }, e => toast(e.code === 1 ? 'Permissão de localização negada' : 'Não foi possível obter o GPS'), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}

function reduzirImagem(file, max = 1600) {
  return new Promise((ok, err) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      ok({ data: cv.toDataURL('image/jpeg', 0.82), w: cv.width, h: cv.height, wOrig: img.width, hOrig: img.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); err(); };
    img.src = url;
  });
}
async function sha256Arquivo(file) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return ''; }
}
async function lerExif(file) {
  try {
    if (!window.exifr) return {};
    const x = await exifr.parse(file, { gps: true }) || {};
    const dt = x.DateTimeOriginal || x.CreateDate;
    return {
      exifData: dt instanceof Date ? dt.getTime() : null,
      exifLat: typeof x.latitude === 'number' ? x.latitude.toFixed(6) : '',
      exifLng: typeof x.longitude === 'number' ? x.longitude.toFixed(6) : '',
      exifAlt: typeof x.GPSAltitude === 'number' ? Math.round(x.GPSAltitude) : '',
      aparelho: [x.Make, x.Model].filter(Boolean).join(' '),
      lente: x.LensModel || ''
    };
  } catch (e) { return {}; }
}
function posicaoAtual() {
  return new Promise(ok => {
    if (!navigator.geolocation) return ok(null);
    try {
      navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6), prec: Math.round(p.coords.accuracy) }),
        () => ok(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
    } catch (e) { ok(null); }
  });
}
async function adicionarFotos(c, files) {
  toast('Processando ' + files.length + ' foto(s)…');
  const pos = await posicaoAtual();
  for (const f of files) {
    try {
      const [img, hash, ex] = await Promise.all([reduzirImagem(f), sha256Arquivo(f), lerExif(f)]);
      c.fotos.push({
        id: uid(), data: img.data, w: img.w, h: img.h, legenda: '', ts: Date.now(),
        nomeOriginal: f.name || '', tamanho: f.size || 0, tipo: f.type || '', modificado: f.lastModified || null,
        sha256: hash, dimOriginal: img.wOrig + '×' + img.hOrig, ...ex,
        appLat: pos ? pos.lat : '', appLng: pos ? pos.lng : '', appPrec: pos ? pos.prec : ''
      });
    } catch (e) { toast('Falha em uma foto'); }
  }
  await DB.salvar(c); render(); toast('Fotos adicionadas');
}
function metaFoto(f) {
  const m = [];
  if (f.nomeOriginal) m.push(['Arquivo original', f.nomeOriginal + (f.tamanho ? ' (' + (f.tamanho / 1024 / 1024).toFixed(2) + ' MB)' : '')]);
  if (f.dimOriginal) m.push(['Resolução original', f.dimOriginal + ' px']);
  m.push(['Data/hora da captura (EXIF)', f.exifData ? fmtDH(f.exifData) : 'não disponível']);
  if (f.modificado) m.push(['Data do arquivo', fmtDH(f.modificado)]);
  m.push(['Inserida no app em', fmtDH(f.ts)]);
  m.push(['GPS da foto (EXIF)', f.exifLat ? f.exifLat + ', ' + f.exifLng + (f.exifAlt !== '' && f.exifAlt !== undefined ? ' · alt. ' + f.exifAlt + ' m' : '') : 'não disponível']);
  if (f.appLat) m.push(['GPS do aparelho na inserção', f.appLat + ', ' + f.appLng + (f.appPrec ? ' (±' + f.appPrec + ' m)' : '')]);
  else if (f.lat) m.push(['Coordenadas do local (ficha)', f.lat + ', ' + f.lng]);
  if (f.aparelho) m.push(['Aparelho', f.aparelho + (f.lente ? ' · ' + f.lente : '')]);
  if (f.sha256) m.push(['SHA-256 do original', f.sha256]);
  return m;
}
function verFoto(c, f) {
  abrirFolha(`<img class="full" src="${f.data}" alt="">
    <label class="f"><span>Legenda</span><input id="leg" value="${esc(f.legenda)}" placeholder="Ex.: arame cortado na divisa norte"></label>
    <dl class="meta">${metaFoto(f).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="row end"><button class="btn danger ghost" data-del>Excluir</button><button class="btn" data-ok>Salvar</button></div>`, el => {
    $('[data-ok]', el).onclick = async () => { f.legenda = $('#leg', el).value; await DB.salvar(c); fecharFolha(); render(); };
    $('[data-del]', el).onclick = async () => { if (await confirmar('Excluir esta foto?', 'Excluir')) { c.fotos = c.fotos.filter(x => x !== f); await DB.salvar(c); render(); } };
  });
}

async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Texto copiado'); }
  catch (e) {
    abrirFolha(`<h2>Copiar</h2><p class="muted">Selecione o texto e copie manualmente.</p><textarea class="copia" rows="14">${esc(txt)}</textarea><div class="row end"><button class="btn" data-ok>Fechar</button></div>`,
      el => { const t = $('textarea', el); t.focus(); t.select(); $('[data-ok]', el).onclick = fecharFolha; });
  }
}
async function compartilharArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  try {
    const file = new File([blob], nome, { type: tipo });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: nome }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Arquivo gerado');
  } catch (e) { toast('Exportação indisponível neste ambiente'); }
}
function backupJSON(casos) { return JSON.stringify({ app: 'deleagro-campo', versao: 1, exportado: new Date().toISOString(), casos }, null, 1); }

async function importar(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'deleagro-campo' || !Array.isArray(d.casos)) throw 0;
    let n = 0;
    for (const c of d.casos) { if (c && c.id && c.local) { await DB.salvar(c); n++; } }
    S.casos = await DB.todos(); render(); toast(n + ' ocorrência(s) importada(s)');
  } catch (e) { toast('Arquivo de backup inválido'); }
}

/* ----- PDF único com dados, fotos e metadados ----- */
function montarPDF(c) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 16, LW = W - 2 * M;
  const geradoEm = fmtDH(Date.now());
  let y = M;
  const novaPag = () => { doc.addPage(); y = M + 4; };
  const garante = h => { if (y + h > H - 18) novaPag(); };
  const verde = [168, 132, 28]; // dourado

  // Cabeçalho
  doc.setFillColor(11, 11, 11); doc.rect(0, 0, W, 28, 'F');
  doc.setFillColor(201, 162, 39); doc.rect(0, 28, W, 1.6, 'F');
  let tx = M;
  [['pcms', 'PCMS'], ['deleagro', 'DELEAGRO']].forEach(([k]) => {
    const L = LOGO_DATA[k]; if (!L) return;
    let h = 20, w = h * L.r; if (w > 32) { w = 32; h = w / L.r; }
    try { doc.addImage(L.data, 'PNG', tx, 14 - h / 2, w, h); tx += w + 5; } catch (e) {}
  });
  doc.setTextColor(201, 162, 39); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('LEVANTAMENTO DE CAMPO', tx, 13);
  doc.setTextColor(255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  doc.text((c.unidade || 'DELEAGRO') + ' · Polícia Civil de Mato Grosso do Sul', tx, 20);
  doc.setTextColor(30); y = 37;

  const linhas = textoRelatorio(c).split('\n').slice(2); // remove título textual
  const ehTitulo = l => /^\d\.\s[A-ZÇÃÕÉÍÓÚ]/.test(l) || /^ANOTAÇÕES:/.test(l) || l === 'Pendentes:';
  for (const l of linhas) {
    if (l.startsWith('Gerado em')) continue;
    if (!l.trim()) { y += 2; continue; }
    if (/^5\. FOTOGRAFIAS/.test(l)) continue;
    if (ehTitulo(l) && !/^ANOTAÇÕES:/.test(l)) {
      garante(12); y += 2;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...verde);
      doc.text(l, M, y); doc.setDrawColor(...verde); doc.setLineWidth(0.3); doc.line(M, y + 1.5, W - M, y + 1.5);
      y += 7; doc.setTextColor(30); continue;
    }
    const recuo = /^\s{2}/.test(l) ? 5 : 0;
    doc.setFont('helvetica', /^• /.test(l) ? 'bold' : 'normal'); doc.setFontSize(9.5);
    const partes = doc.splitTextToSize(l.trim(), LW - recuo);
    for (const p of partes) { garante(5); doc.text(p, M + recuo, y); y += 4.6; }
  }

  // Fotografias
  if (c.fotos.length) {
    novaPag();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...verde);
    doc.text('ANEXO FOTOGRÁFICO — ' + c.fotos.length + ' registro(s)', M, y);
    doc.line(M, y + 1.5, W - M, y + 1.5); y += 8; doc.setTextColor(30);
    c.fotos.forEach((f, i) => {
      const meta = metaFoto(f);
      const maxH = 92;
      const r = (f.w && f.h) ? f.h / f.w : 0.75;
      let iw = LW, ih = iw * r; if (ih > maxH) { ih = maxH; iw = ih / r; }
      const blocoMeta = 6 + meta.length * 4.2 + (f.legenda ? 5 : 0);
      garante(ih + blocoMeta + 6);
      try { doc.addImage(f.data, 'JPEG', M + (LW - iw) / 2, y, iw, ih, undefined, 'FAST'); } catch (e) {}
      doc.setDrawColor(180); doc.rect(M + (LW - iw) / 2, y, iw, ih);
      y += ih + 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text('Foto ' + (i + 1) + (f.legenda ? ' — ' : ''), M, y);
      if (f.legenda) { const lw = doc.getTextWidth('Foto ' + (i + 1) + ' — '); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(f.legenda, LW - lw)[0], M + lw, y); }
      y += 5;
      doc.setFontSize(7.8);
      meta.forEach(([k, v]) => {
        doc.setFont('helvetica', 'bold'); doc.text(k + ':', M, y);
        doc.setFont(k.startsWith('SHA') ? 'courier' : 'helvetica', 'normal');
        doc.text(doc.splitTextToSize(String(v), LW - 52)[0], M + 52, y); y += 4.2;
      });
      y += 6;
    });
    garante(16);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(90);
    doc.text(doc.splitTextToSize('As imagens deste anexo são cópias redimensionadas para o relatório. O hash SHA-256 refere-se ao arquivo original no momento da inserção no aplicativo e permite conferir a integridade do original preservado.', LW), M, y);
    doc.setTextColor(30);
  }

  // Rodapé em todas as páginas
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110);
    doc.text('DELEAGRO Campo · ' + (c.bo ? 'BO ' + c.bo + ' · ' : '') + 'gerado em ' + geradoEm, M, H - 8);
    doc.text('Página ' + p + ' de ' + n, W - M, H - 8, { align: 'right' });
  }
  doc.setProperties({ title: 'Levantamento de campo ' + (c.bo || ''), subject: natureza(c.natureza).nome, author: c.responsavel || 'DELEAGRO', creator: 'DELEAGRO Campo' });
  return doc;
}
async function gerarPDF(c) {
  if (!window.jspdf) return toast('Gerador de PDF não carregou');
  toast('Gerando PDF…');
  try {
    const doc = montarPDF(c);
    const nome = 'levantamento-' + (c.bo || c.local.propriedade || c.id).toString().replace(/[^\w-]+/g, '_') + '.pdf';
    const blob = doc.output('blob');
    abrirFolha(`<h2>PDF pronto</h2><p class="muted">${esc(nome)} · ${(blob.size / 1024 / 1024).toFixed(2)} MB · ${doc.getNumberOfPages()} página(s)</p>
      <div class="row wrap"><button class="btn" data-share>Compartilhar / salvar</button><button class="btn ghost" data-ver>Visualizar</button><button class="btn ghost" data-x>Fechar</button></div>`, el => {
      $('[data-x]', el).onclick = fecharFolha;
      $('[data-share]', el).onclick = () => compartilharArquivo(nome, blob, 'application/pdf');
      $('[data-ver]', el).onclick = () => { try { const u = URL.createObjectURL(blob); const w = window.open(u, '_blank'); if (!w) location.href = u; } catch (e) { toast('Visualização indisponível'); } };
    });
  } catch (e) { console.error(e); toast('Falha ao gerar o PDF'); }
}

/* ----- PIN ----- */
async function hashPin(pin, sal) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sal + ':' + pin));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function telaPin(modo) {
  return new Promise(ok => {
    const L = $('#lock'); L.classList.add('on');
    let pin = '', primeiro = null;
    const titulo = () => modo === 'abrir' ? 'Digite o PIN' : primeiro === null ? 'Novo PIN (4 a 8 dígitos)' : 'Confirme o PIN';
    const desenha = msg => {
      L.innerHTML = `<div class="lockbox">${logos()}<h1>DELEAGRO <b>Campo</b></h1><p>${titulo()}</p>
        <div class="dots">${'●'.repeat(pin.length) || '&nbsp;'}</div><p class="erro">${msg || '&nbsp;'}</p>
        <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>
        ${modo !== 'abrir' ? '<button class="btn ghost" data-k="X">Cancelar</button>' : ''}</div>`;
    };
    desenha();
    L.onclick = async e => {
      const k = e.target.dataset.k; if (k === undefined) return;
      if (k === 'X') { L.classList.remove('on'); return ok(false); }
      if (k === '⌫') pin = pin.slice(0, -1);
      else if (k === 'OK') {
        if (pin.length < 4) return desenha('Mínimo de 4 dígitos');
        if (modo === 'abrir') {
          if (await hashPin(pin, Pref.get('pinSal', '')) === Pref.get('pinHash', '')) { L.classList.remove('on'); L.innerHTML = ''; return ok(true); }
          pin = ''; return desenha('PIN incorreto');
        }
        if (primeiro === null) { primeiro = pin; pin = ''; return desenha(); }
        if (pin !== primeiro) { primeiro = null; pin = ''; return desenha('Os PINs não conferem'); }
        const sal = uid(); Pref.set('pinSal', sal); Pref.set('pinHash', await hashPin(pin, sal));
        L.classList.remove('on'); L.innerHTML = ''; return ok(true);
      } else if (pin.length < 8) pin += k;
      desenha();
    };
  });
}
let ocultoEm = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { ocultoEm = Date.now(); return; }
  if (Pref.get('pinHash', null) && ocultoEm && Date.now() - ocultoEm > 5 * 60 * 1000) await telaPin('abrir');
});

/* ---------- eventos delegados ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button, [data-abrir], [data-foto]'); if (!t || t.closest('#modal') || t.closest('#lock')) return;
  const c = casoAtual();
  if (t.dataset.tela) { S.tela = t.dataset.tela; render(); return; }
  if (t.dataset.abrir) { S.casoId = t.dataset.abrir; S.tela = 'caso'; S.aba = 'local'; render(); return; }
  if (t.dataset.aba) { S.aba = t.dataset.aba; render(); return; }
  if (t.dataset.foto) { verFoto(c, c.fotos.find(f => f.id === t.dataset.foto)); return; }
  if (t.dataset.novaPessoa) { formPessoa(c, { id: uid(), papel: t.dataset.novaPessoa }); return; }
  if (t.dataset.pessoa) { formPessoa(c, c.pessoas.find(p => p.id === t.dataset.pessoa)); return; }
  if (t.dataset.bem) { formBem(c, c.bens.find(b => b.id === t.dataset.bem)); return; }
  switch (t.dataset.acao) {
    case 'novo': { const n = novoCaso(); S.casos.push(n); await DB.salvar(n); S.casoId = n.id; S.tela = 'caso'; S.aba = 'local'; render(); break; }
    case 'voltar': S.tela = 'lista'; render(); break;
    case 'gps': capturarGPS(c); break;
    case 'novo-bem': formBem(c, { id: uid(), categoria: natureza(c.natureza).grupo === 'animal' ? 'animal' : natureza(c.natureza).id === 'gps' ? 'eletronico' : natureza(c.natureza).grupo === 'maquina' ? 'maquina' : natureza(c.natureza).grupo === 'insumo' ? 'insumo' : 'outro', quantidade: 1, situacao: 'Subtraído' }); break;
    case 'apagar-caso': if (await confirmar('Excluir esta ocorrência e todos os seus dados? Não há como desfazer.', 'Excluir')) { await DB.apagar(c.id); S.casos = S.casos.filter(x => x !== c); S.tela = 'lista'; render(); toast('Ocorrência excluída'); } break;
    case 'copiar': copiar(textoRelatorio(c)); break;
    case 'compartilhar': try { if (navigator.share) await navigator.share({ title: 'Levantamento ' + (c.bo || ''), text: textoRelatorio(c) }); else copiar(textoRelatorio(c)); } catch (er) { if (er.name !== 'AbortError') copiar(textoRelatorio(c)); } break;
    case 'pdf': gerarPDF(c); break;
    case 'exportar-caso': compartilharArquivo('ocorrencia-' + (c.bo || c.id) + '.json', backupJSON([c]), 'application/json'); break;
    case 'exportar': compartilharArquivo('deleagro-campo-backup-' + hoje() + '.json', backupJSON(S.casos), 'application/json'); break;
    case 'apagar-tudo': if (await confirmar('Apagar TODAS as ocorrências deste aparelho? Faça um backup antes.', 'Apagar tudo')) { for (const x of S.casos) await DB.apagar(x.id); S.casos = []; render(); toast('Dados apagados'); } break;
    case 'pin-on': if (await telaPin('definir')) { toast('PIN definido'); render(); } break;
    case 'pin-off': if (await confirmar('Desativar o bloqueio por PIN?', 'Desativar')) { Pref.set('pinHash', null); render(); } break;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.campoBusca !== undefined) { S.busca = t.value; const pos = t.selectionStart; render(); const n = $('[data-campo-busca]'); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (t.dataset.buscaLei !== undefined) { S.buscaLei = t.value; const pos = t.selectionStart; render(); const n = $('[data-busca-lei]'); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (t.dataset.pref) { Pref.set(t.dataset.pref, t.value); return; }
  const c = casoAtual(); if (!c) return;
  if (t.dataset.c) { setPath(c, t.dataset.c, t.value); salvarDepois(c); }
  if (t.dataset.chkobs) { c.checklist[t.dataset.chkobs] = { ...(c.checklist[t.dataset.chkobs] || {}), obs: t.value }; salvarDepois(c); }
});

document.addEventListener('change', async e => {
  const t = e.target, c = casoAtual();
  if (t.dataset.filtro !== undefined) { S.filtro = t.value; render(); return; }
  if (t.dataset.acao === 'fotos' && t.files.length) { adicionarFotos(c, [...t.files]); return; }
  if (t.dataset.acao === 'importar' && t.files[0]) { importar(t.files[0]); return; }
  if (!c) return;
  if (t.dataset.chk) { c.checklist[t.dataset.chk] = { ...(c.checklist[t.dataset.chk] || {}), ok: t.checked }; await DB.salvar(c); render(); return; }
  if (t.dataset.c === 'natureza') { c.natureza = t.value; await DB.salvar(c); render(); }
});

/* ---------- início ---------- */
(async function iniciar() {
  carregarLogosPDF();
  await DB.abrir();
  try { S.casos = await DB.todos(); } catch (e) { S.casos = []; }
  if (Pref.get('pinHash', null)) await telaPin('abrir');
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  }
})();
