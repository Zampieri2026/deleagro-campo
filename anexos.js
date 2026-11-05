/* DELEAGRO Campo — anexos (oitivas em vídeo, documentos, fotos de marcas) e desenho livre de marcas.
   Os arquivos ficam no IndexedDB do aparelho (store "anexos"); o caso guarda só os metadados. */
'use strict';

const fmtTam = b => !b ? '' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
const fmtDur = s => { if (!s || !isFinite(s)) return ''; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const ROT_ORIGEM = { oitiva: 'Oitiva em vídeo', video: 'Vídeo', audio: 'Gravação de áudio', documento: 'Documento', foto: 'Foto', desenho: 'Desenho de marca' };

/* SHA-256 em blocos (não carrega o vídeo inteiro na memória) */
async function sha256Blob(blob) {
  try {
    if (window.hashwasm && hashwasm.createSHA256) {
      const h = await hashwasm.createSHA256(); h.init();
      const BL = 8 * 1024 * 1024;
      for (let i = 0; i < blob.size; i += BL) h.update(new Uint8Array(await blob.slice(i, i + BL).arrayBuffer()));
      return h.digest('hex');
    }
    const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return ''; }
}

/* Quadro do vídeo + duração */
function infoVideo(blob) {
  return new Promise(ok => {
    const v = document.createElement('video'), url = URL.createObjectURL(blob);
    let feito = false;
    const fim = r => { if (feito) return; feito = true; URL.revokeObjectURL(url); ok(r); };
    const t = setTimeout(() => fim({ duracao: isFinite(v.duration) ? v.duration : 0, thumb: '' }), 9000);
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.onloadedmetadata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch (e) {} };
    v.onseeked = () => {
      try {
        const k = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
        cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
        clearTimeout(t); fim({ duracao: v.duration, thumb: cv.width ? cv.toDataURL('image/jpeg', 0.75) : '', w: v.videoWidth, h: v.videoHeight });
      } catch (e) { clearTimeout(t); fim({ duracao: v.duration, thumb: '' }); }
    };
    v.onerror = () => { clearTimeout(t); fim({ duracao: 0, thumb: '' }); };
    v.src = url;
  });
}

function duracaoAudio(blob) {
  return new Promise(ok => {
    const a = document.createElement('audio'), url = URL.createObjectURL(blob);
    const t = setTimeout(() => { URL.revokeObjectURL(url); ok(0); }, 6000);
    a.preload = 'metadata'; a.onloadedmetadata = () => { clearTimeout(t); URL.revokeObjectURL(url); ok(isFinite(a.duration) ? a.duration : 0); };
    a.onerror = () => { clearTimeout(t); URL.revokeObjectURL(url); ok(0); }; a.src = url;
  });
}

/* Processa um arquivo e grava no aparelho; devolve os metadados que ficam no caso */
async function criarAnexo(c, file, origem, extra = {}) {
  const meta = {
    id: uid(), casoId: c.id, origem, nome: file.name || (origem + '-' + Date.now()), tipo: file.type || '',
    tamanho: file.size || 0, modificado: file.lastModified || null, ts: Date.now(), legenda: extra.legenda || '', ...extra
  };
  const [hash, pos] = await Promise.all([sha256Blob(file), origem === 'desenho' ? null : posicaoAtual()]);
  meta.sha256 = hash;
  if (pos) { meta.appLat = pos.lat; meta.appLng = pos.lng; meta.appPrec = pos.prec; }
  if (meta.tipo.startsWith('video/')) Object.assign(meta, await infoVideo(file));
  else if (meta.tipo.startsWith('audio/') && !meta.duracao) meta.duracao = await duracaoAudio(file);
  else if (meta.tipo.startsWith('image/')) {
    try { const r = await reduzirImagem(file, 420); meta.thumb = r.data; meta.dimOriginal = r.wOrig + '×' + r.hOrig; } catch (e) {}
    if (origem !== 'desenho') Object.assign(meta, await lerExif(file));
  }
  await DB.putAnexo({ ...meta, blob: file });
  return meta;
}

function metaAnexo(m) {
  const L = [['Tipo', ROT_ORIGEM[m.origem] || m.origem], ['Arquivo', m.nome + (m.tamanho ? ' (' + fmtTam(m.tamanho) + ')' : '')]];
  if (m.duracao) L.push(['Duração', fmtDur(m.duracao)]);
  if (m.dimOriginal) L.push(['Resolução', m.dimOriginal + ' px']);
  if (m.exifData) L.push(['Captura (EXIF)', fmtDH(m.exifData)]);
  if (m.modificado) L.push(['Data do arquivo', fmtDH(m.modificado)]);
  L.push(['Inserido no app em', fmtDH(m.ts)]);
  if (m.exifLat) L.push(['GPS (EXIF)', m.exifLat + ', ' + m.exifLng]);
  if (m.appLat) L.push(['GPS do aparelho', m.appLat + ', ' + m.appLng + (m.appPrec ? ' (±' + m.appPrec + ' m)' : '')]);
  if (m.aparelho) L.push(['Aparelho', m.aparelho]);
  if (m.sha256) L.push(['SHA-256', m.sha256]);
  return L;
}

/* Lista de anexos dentro dos formulários */
function htmlAnexos(lista) {
  if (!lista || !lista.length) return '<p class="muted">Nenhum anexo.</p>';
  return `<div class="anexos">${lista.map(m => `<button type="button" class="anx" data-anx="${m.id}">
    ${m.thumb ? `<img src="${m.thumb}" alt="">` : `<span class="anx-ico">${m.tipo === 'application/pdf' ? 'PDF' : m.tipo.startsWith('video/') ? '▶' : m.tipo.startsWith('audio/') ? '♪' : 'ARQ'}</span>`}
    ${m.tipo.startsWith('video/') || m.tipo.startsWith('audio/') ? `<span class="anx-play">▶ ${fmtDur(m.duracao)}</span>` : ''}
    <span class="anx-t">${esc(m.legenda || ROT_ORIGEM[m.origem])}</span></button>`).join('')}</div>`;
}

/* Visualizador de um anexo; ao fechar, volta ao formulário de origem */
async function verAnexo(c, dono, m, voltar) {
  const reg = await DB.getAnexo(m.id);
  const url = reg && reg.blob ? URL.createObjectURL(reg.blob) : '';
  let midia = '<p class="warn">Arquivo não encontrado neste aparelho.</p>';
  if (url && m.tipo.startsWith('video/')) midia = `<video class="full" src="${url}" controls playsinline preload="metadata"></video>`;
  else if (url && m.tipo.startsWith('audio/')) midia = `<audio class="full" src="${url}" controls preload="metadata"></audio>`;
  else if (url && m.tipo.startsWith('image/')) midia = `<img class="full${m.origem === 'desenho' ? ' desenho' : ''}" src="${url}" alt="">`;
  else if (url) midia = `<p><a class="btn ghost" href="${url}" target="_blank" rel="noopener">Abrir ${esc(m.nome)}</a></p>`;
  const sair = () => { if (url) URL.revokeObjectURL(url); voltar(); };
  abrirFolha(`<h2>${esc(ROT_ORIGEM[m.origem] || 'Anexo')}</h2>${midia}
    <label class="f"><span>Legenda / descrição</span><input id="anxleg" value="${esc(m.legenda)}" placeholder="${m.origem === 'oitiva' ? 'Ex.: oitiva da vítima no local' : 'Ex.: NF de compra de 12 novilhas'}"></label>
    <dl class="meta">${metaAnexo(m).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="row end"><button class="btn danger ghost" data-del>Excluir</button>${url ? '<button class="btn ghost" data-share>Compartilhar</button>' : ''}<button class="btn" data-ok>Salvar</button></div>`, el => {
    $('[data-ok]', el).onclick = async () => { m.legenda = $('#anxleg', el).value; await DB.salvar(c); sair(); };
    const sh = $('[data-share]', el); if (sh) sh.onclick = () => compartilharArquivo(m.nome, reg.blob, m.tipo || 'application/octet-stream');
    $('[data-del]', el).onclick = async () => {
      if (!(await confirmar('Excluir este anexo do aparelho?', 'Excluir'))) return voltar();
      dono.anexos = (dono.anexos || []).filter(x => x !== m); await DB.apagarAnexo(m.id); await DB.salvar(c); sair(); toast('Anexo excluído');
    };
  });
}

/* ----- Desenho livre da marca ----- */
function abrirDesenho(aoSalvar, aoCancelar) {
  abrirFolha(`<h2>Desenhar marca</h2>
    <p class="muted">Desenhe com o dedo a marca (ferro) como aparece no animal.</p>
    <div class="pad-wrap"><canvas id="cvm"></canvas></div>
    <div class="row wrap tools">
      <span class="muted">Traço:</span>
      <button type="button" class="btn ghost sm" data-esp="4">Fino</button>
      <button type="button" class="btn sm" data-esp="9">Médio</button>
      <button type="button" class="btn ghost sm" data-esp="16">Grosso</button>
      <button type="button" class="btn ghost sm" data-grade>Grade</button>
      <button type="button" class="btn ghost sm" data-undo>Desfazer</button>
      <button type="button" class="btn ghost sm" data-limpar>Limpar</button>
    </div>
    <label class="f"><span>Descrição da marca</span><input id="dleg" placeholder="Ex.: letras JS no quarto traseiro esquerdo"></label>
    <div class="row end"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="button" class="btn" data-ok>Salvar desenho</button></div>`, el => {
    const cv = $('#cvm', el), ctx = cv.getContext('2d');
    const lado = Math.min(el.clientWidth - 32, 520), dpr = window.devicePixelRatio || 1;
    cv.style.width = cv.style.height = lado + 'px'; cv.width = cv.height = Math.round(lado * dpr);
    let esp = 9, grade = true, tracos = [], atual = null;
    const pinta = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      if (grade) { ctx.strokeStyle = '#e8e2cf'; ctx.lineWidth = 1; for (let i = 1; i < 8; i++) { const p = cv.width * i / 8; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, cv.height); ctx.moveTo(0, p); ctx.lineTo(cv.width, p); ctx.stroke(); } }
      ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
      for (const t of tracos) {
        ctx.lineWidth = t.e * cv.width / 400; ctx.beginPath();
        t.p.forEach(([x, y], i) => i ? ctx.lineTo(x * cv.width, y * cv.height) : ctx.moveTo(x * cv.width, y * cv.height));
        if (t.p.length === 1) ctx.lineTo(t.p[0][0] * cv.width + .01, t.p[0][1] * cv.height);
        ctx.stroke();
      }
    };
    const ponto = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); atual = { e: esp, p: [ponto(e)] }; tracos.push(atual); pinta(); };
    cv.onpointermove = e => { if (!atual) return; atual.p.push(ponto(e)); pinta(); };
    cv.onpointerup = cv.onpointercancel = () => { atual = null; };
    el.querySelectorAll('[data-esp]').forEach(b => b.onclick = () => { esp = +b.dataset.esp; el.querySelectorAll('[data-esp]').forEach(x => x.classList.toggle('ghost', x !== b)); });
    $('[data-grade]', el).onclick = () => { grade = !grade; pinta(); };
    $('[data-undo]', el).onclick = () => { tracos.pop(); pinta(); };
    $('[data-limpar]', el).onclick = () => { tracos = []; pinta(); };
    $('[data-cancel]', el).onclick = aoCancelar;
    $('[data-ok]', el).onclick = () => {
      if (!tracos.length) return toast('Desenhe a marca antes de salvar');
      const g = grade; grade = false; pinta();
      cv.toBlob(b => { grade = g; aoSalvar(new File([b], 'marca-' + Date.now() + '.png', { type: 'image/png' }), $('#dleg', el).value); }, 'image/png');
    };
    pinta();
  });
}

/* ----- Imagens para o PDF ----- */
async function dataURLDeAnexo(m, max = 1400) {
  if (m.tipo.startsWith('video/')) return m.thumb ? { data: m.thumb, w: m.w || 4, h: m.h || 3, fmt: 'JPEG' } : null;
  if (!m.tipo.startsWith('image/')) return null;
  const reg = await DB.getAnexo(m.id); if (!reg || !reg.blob) return null;
  try {
    const r = await reduzirImagem(reg.blob, max);
    return { data: r.data, w: r.w, h: r.h, fmt: 'JPEG' };
  } catch (e) { return null; }
}

/* ----- Backup com anexos ----- */
function blobParaBase64(blob) { return new Promise((ok, err) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = err; fr.readAsDataURL(blob); }); }
function base64ParaBlob(b64, tipo) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: tipo }); }
