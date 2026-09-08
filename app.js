(() => {
  'use strict';

  const cfg = window.MAUZI_CONFIG || {};
  const $ = id => document.getElementById(id);
  const els = {
    appTitle:$('appTitle'), installBtn:$('installBtn'), adminCard:$('adminCard'), accessForm:$('accessForm'),
    accessName:$('accessName'), folderUrl:$('folderUrl'), adminKey:$('adminKey'), sourceStatus:$('sourceStatus'),
    manageBtn:$('manageBtn'), managerPanel:$('managerPanel'), refreshSharesBtn:$('refreshSharesBtn'), shareList:$('shareList'),
    viewerCard:$('viewerCard'), viewerName:$('viewerName'), librarySection:$('librarySection'), folderName:$('folderName'),
    trackCount:$('trackCount'), trackList:$('trackList'), emptyState:$('emptyState'), reloadBtn:$('reloadBtn'), shareBtn:$('shareBtn'),
    playFolderBtn:$('playFolderBtn'), folderNav:$('folderNav'), searchInput:$('searchInput'), lyricsPanel:$('lyricsPanel'),
    lyricsTitle:$('lyricsTitle'), lyricsBody:$('lyricsBody'), closeLyricsBtn:$('closeLyricsBtn'), lyricsSmallerBtn:$('lyricsSmallerBtn'),
    lyricsLargerBtn:$('lyricsLargerBtn'), lyricsSizeBtn:$('lyricsSizeBtn'), player:$('player'), miniCover:$('miniCover'),
    nowTitle:$('nowTitle'), nowAlbum:$('nowAlbum'), lyricsBtn:$('lyricsBtn'), currentTime:$('currentTime'), duration:$('duration'),
    seekBar:$('seekBar'), shuffleBtn:$('shuffleBtn'), prevBtn:$('prevBtn'), playBtn:$('playBtn'), nextBtn:$('nextBtn'),
    repeatBtn:$('repeatBtn'), repeatBadge:$('repeatBadge'), audio:$('audio'), toast:$('toast')
  };

  const state = {
    tracks:[], filtered:[], currentIndex:-1, currentFolder:'__all__', shareToken:'', accessName:'', viewerMode:false,
    repeat:localStorage.getItem('mauzi.repeat') || 'all', shuffle:localStorage.getItem('mauzi.shuffle') === '1',
    lyricsCache:new Map(), deferredInstall:null, isSeeking:false,
    lyricsFontSize:Math.max(16, Math.min(40, Number(localStorage.getItem('mauzi.lyricsSize')) || 20))
  };

  els.appTitle.textContent = cfg.appName || 'Mauzi Música';
  document.title = cfg.appName || 'Mauzi Música';

  function apiReady() {
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(String(cfg.apiUrl || ''));
  }

  function toast(msg, ms=3000) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove('show'), ms);
  }

  function setStatus(msg) { els.sourceStatus.textContent = msg || ''; }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function jsonp(params, timeoutMs=30000) {
    if (!apiReady()) return Promise.reject(new Error('Falta configurar la URL de Google Apps Script en config.js.'));
    return new Promise((resolve, reject) => {
      const callback = `__mauzi_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = new URL(cfg.apiUrl);
      Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, String(v ?? '')));
      url.searchParams.set('callback', callback);
      const script = document.createElement('script');
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        script.remove();
        try { delete window[callback]; } catch { window[callback] = undefined; }
      };
      window[callback] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('No se pudo conectar con Google Apps Script.')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('La solicitud tardó demasiado.')); }, timeoutMs);
      script.src = url.toString();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  function baseShareUrl(token) {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('share', token);
    return url.toString();
  }

  async function copyText(text, msg='Enlace copiado.') {
    try { await navigator.clipboard.writeText(text); toast(msg); }
    catch { window.prompt('Copie este enlace:', text); }
  }

  async function createAccess(e) {
    e.preventDefault();
    if (!apiReady()) return toast('Primero configure Apps Script en config.js.');
    const name = els.accessName.value.trim();
    const folder = els.folderUrl.value.trim();
    const adminKey = els.adminKey.value;
    if (!name || !folder || !adminKey) return;

    sessionStorage.setItem('mauzi.adminKey', adminKey);
    setStatus('Creando acceso privado…');
    els.accessForm.querySelector('button[type="submit"]').disabled = true;
    try {
      const data = await jsonp({action:'createShare', adminKey, name, folder}, 35000);
      if (!data?.ok) throw new Error(data?.error || 'No se pudo crear el acceso.');
      state.shareToken = data.share;
      await loadShare(data.share, {viewer:false});
      const url = baseShareUrl(data.share);
      await copyText(url, `Enlace de ${data.name} copiado.`);
      setStatus(data.warning || 'Acceso creado correctamente. El enlace ya está copiado.');
      els.accessName.value = '';
      els.folderUrl.value = '';
      if (!els.managerPanel.classList.contains('hidden')) await loadShares();
    } catch (err) {
      setStatus(err.message);
      toast(err.message, 4600);
    } finally {
      els.accessForm.querySelector('button[type="submit"]').disabled = false;
    }
  }

  async function loadShare(token, {viewer=state.viewerMode}={}) {
    token = String(token || '').trim();
    if (!token) return;
    if (!apiReady()) {
      toast('Falta configurar la URL de Apps Script.');
      return;
    }
    state.shareToken = token;
    state.currentFolder = '__all__';
    els.searchInput.value = '';
    if (viewer) {
      els.viewerCard.classList.remove('hidden');
      els.adminCard.classList.add('hidden');
      els.shareBtn.classList.add('hidden');
    }
    try {
      const data = await jsonp({action:'list', share:token}, 35000);
      if (!data?.ok) throw new Error(data?.error || 'No se pudo abrir esta biblioteca.');
      state.accessName = data.accessName || data.folderName || 'Música';
      state.tracks = (data.tracks || []).map((t,i) => ({...t, _index:i}));
      state.currentIndex = -1;
      state.filtered = state.tracks.slice();
      state.lyricsCache.clear();
      els.viewerName.textContent = state.accessName;
      els.folderName.textContent = state.accessName;
      els.trackCount.textContent = String(state.tracks.length);
      els.librarySection.classList.remove('hidden');
      renderFolders();
      applyFilter();
      if (!state.tracks.length) els.emptyState.classList.remove('hidden');
    } catch (err) {
      els.librarySection.classList.add('hidden');
      if (viewer) {
        els.viewerName.textContent = 'Acceso no disponible';
        els.viewerCard.querySelector('p').textContent = err.message;
      }
      toast(err.message, 5000);
    }
  }

  async function loadShares() {
    const adminKey = els.adminKey.value || sessionStorage.getItem('mauzi.adminKey') || '';
    if (!adminKey) return toast('Escriba primero su clave de administrador.');
    els.adminKey.value = adminKey;
    sessionStorage.setItem('mauzi.adminKey', adminKey);
    els.shareList.innerHTML = '<div class="status-text">Cargando…</div>';
    try {
      const data = await jsonp({action:'listShares', adminKey});
      if (!data?.ok) throw new Error(data?.error || 'No se pudieron leer los accesos.');
      const shares = data.shares || [];
      els.shareList.innerHTML = shares.length ? shares.map(s => {
        const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString('es-GT') : '';
        return `<div class="share-row" data-share="${escapeHtml(s.share)}">
          <div class="share-meta"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.folderName)}${date ? ' · ' + escapeHtml(date) : ''}</span></div>
          <div class="share-actions">
            <button type="button" data-action="open">Abrir</button>
            <button type="button" data-action="copy">Copiar</button>
            <button type="button" class="danger-btn" data-action="revoke">Revocar</button>
          </div>
        </div>`;
      }).join('') : '<div class="status-text">Todavía no ha creado accesos.</div>';
    } catch (err) {
      els.shareList.innerHTML = `<div class="status-text">${escapeHtml(err.message)}</div>`;
      toast(err.message, 4200);
    }
  }

  async function revokeShare(token) {
    const adminKey = els.adminKey.value || sessionStorage.getItem('mauzi.adminKey') || '';
    if (!adminKey) return toast('Falta su clave de administrador.');
    if (!confirm('¿Revocar este enlace? Dejará de funcionar inmediatamente.')) return;
    try {
      const data = await jsonp({action:'revokeShare', adminKey, share:token});
      if (!data?.ok) throw new Error(data?.error || 'No se pudo revocar.');
      toast('Acceso revocado.');
      if (state.shareToken === token) {
        state.shareToken = '';
        els.librarySection.classList.add('hidden');
      }
      await loadShares();
    } catch (err) { toast(err.message, 4200); }
  }

  function folderLabel(path) { return path || 'Principal'; }

  function renderFolders() {
    const paths = [...new Set(state.tracks.map(t => t.path || ''))].sort((a,b) => a.localeCompare(b,'es',{numeric:true}));
    const all = `<button class="folder-chip active" type="button" data-folder="__all__">Todas <small>${state.tracks.length}</small></button>`;
    const chips = paths.map(path => {
      const count = state.tracks.filter(t => (t.path || '') === path).length;
      return `<button class="folder-chip" type="button" data-folder="${escapeHtml(path)}">${escapeHtml(folderLabel(path))} <small>${count}</small></button>`;
    }).join('');
    els.folderNav.innerHTML = all + chips;
  }

  function applyFilter() {
    const q = els.searchInput.value.trim().toLocaleLowerCase('es');
    state.filtered = state.tracks.filter(t => {
      const folderOk = state.currentFolder === '__all__' || (t.path || '') === state.currentFolder;
      const searchOk = !q || `${t.title} ${t.album || ''} ${t.path || ''}`.toLocaleLowerCase('es').includes(q);
      return folderOk && searchOk;
    });
    renderTracks();
  }

  function renderTracks() {
    if (!state.filtered.length) {
      els.trackList.innerHTML = '';
      els.emptyState.classList.remove('hidden');
      return;
    }
    els.emptyState.classList.add('hidden');
    els.trackList.innerHTML = state.filtered.map((track, visibleIndex) => {
      const realIndex = state.tracks.indexOf(track);
      const active = realIndex === state.currentIndex ? ' active' : '';
      const lyric = track.lyricId ? '<span class="lyric-dot" title="Tiene letra"></span>' : '';
      return `<button class="track${active}" data-index="${realIndex}" type="button">
        <span class="track-index">${String(visibleIndex+1).padStart(2,'0')}</span>
        <span class="track-copy"><span class="track-title">${escapeHtml(track.title)}</span><span class="track-sub">${escapeHtml(track.album || state.accessName)}</span></span>
        <span class="track-icons">${lyric}<span>▶</span></span>
      </button>`;
    }).join('');
  }

  async function playIndex(index, autoplay=true) {
    if (!state.tracks.length) return;
    index = Number(index);
    if (!Number.isInteger(index) || index < 0 || index >= state.tracks.length) return;
    state.currentIndex = index;
    const track = state.tracks[index];
    els.player.classList.remove('hidden');
    els.audio.src = track.streamUrl;
    els.nowTitle.textContent = track.title;
    els.nowAlbum.textContent = track.album || state.accessName || 'Mauzi Música';
    setCover(track.coverUrl);
    renderTracks();
    loadLyricsForTrack(track, false);
    updateMediaSession(track);
    if (autoplay) {
      try { await els.audio.play(); }
      catch { toast('Toque ▶ para iniciar la reproducción.'); }
    }
  }

  function playCurrentFolder() {
    if (!state.filtered.length) return toast('No hay canciones en esta vista.');
    playIndex(state.tracks.indexOf(state.filtered[0]), true);
  }

  function setCover(url) {
    els.miniCover.style.backgroundImage = url ? `url("${String(url).replace(/"/g,'%22')}")` : '';
    els.miniCover.querySelector('span').style.opacity = url ? '0' : '1';
  }

  function togglePlay() {
    if (state.currentIndex < 0 && state.filtered.length) return playIndex(state.tracks.indexOf(state.filtered[0]), true);
    if (els.audio.paused) els.audio.play().catch(() => toast('No se pudo iniciar el audio.'));
    else els.audio.pause();
  }

  function queueIndices() {
    const source = state.currentFolder === '__all__' ? state.tracks : state.tracks.filter(t => (t.path || '') === state.currentFolder);
    return source.map(t => state.tracks.indexOf(t));
  }

  function nextTrack(manual=false) {
    const queue = queueIndices();
    if (!queue.length) return;
    if (state.shuffle && queue.length > 1) {
      let n; do { n = queue[Math.floor(Math.random()*queue.length)]; } while (n === state.currentIndex);
      return playIndex(n,true);
    }
    const pos = queue.indexOf(state.currentIndex);
    if (pos >= 0 && pos < queue.length-1) return playIndex(queue[pos+1],true);
    if (state.repeat === 'all' || manual) return playIndex(queue[0],true);
    els.audio.pause();
  }

  function prevTrack() {
    const queue = queueIndices();
    if (!queue.length) return;
    if (els.audio.currentTime > 4) { els.audio.currentTime = 0; return; }
    const pos = queue.indexOf(state.currentIndex);
    playIndex(pos > 0 ? queue[pos-1] : queue[queue.length-1], true);
  }

  function cycleRepeat() {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    localStorage.setItem('mauzi.repeat',state.repeat);
    updateRepeatUI();
    toast(state.repeat === 'off' ? 'Repetición desactivada' : state.repeat === 'one' ? 'Repetir una canción' : 'Repetir la carpeta/lista');
  }

  function updateRepeatUI() {
    els.repeatBtn.classList.toggle('active', state.repeat !== 'off');
    els.repeatBadge.textContent = state.repeat === 'one' ? '1' : state.repeat === 'all' ? '∞' : '';
    els.audio.loop = state.repeat === 'one';
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    localStorage.setItem('mauzi.shuffle', state.shuffle ? '1' : '0');
    els.shuffleBtn.classList.toggle('active',state.shuffle);
    toast(state.shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado');
  }

  function fmt(sec) {
    if (!Number.isFinite(sec)) return '0:00';
    sec = Math.max(0,Math.floor(sec));
    return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
  }

  async function loadLyricsForTrack(track, openPanel=false) {
    els.lyricsTitle.textContent = track.title;
    if (openPanel) els.lyricsPanel.classList.add('open');
    if (!track.lyricId) {
      els.lyricsBody.innerHTML = '<div class="lyrics-placeholder"><div class="empty-icon">Aa</div><p>Esta canción no tiene letra. Agregue un archivo <strong>.txt</strong> con el mismo nombre del audio.</p></div>';
      return;
    }
    if (state.lyricsCache.has(track.lyricId)) return renderLyrics(track,state.lyricsCache.get(track.lyricId));
    els.lyricsBody.innerHTML = '<div class="lyrics-placeholder"><p>Cargando letra…</p></div>';
    try {
      const data = await jsonp({action:'lyrics', share:state.shareToken, id:track.lyricId, resourceKey:track.lyricResourceKey || ''});
      if (!data?.ok) throw new Error(data?.error || 'No se pudo leer la letra.');
      const lyricData = {text:data.text || ''};
      state.lyricsCache.set(track.lyricId,lyricData);
      if (state.tracks[state.currentIndex]?.id === track.id) renderLyrics(track,lyricData);
    } catch (err) {
      els.lyricsBody.innerHTML = `<div class="lyrics-placeholder"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderLyrics(track, lyricData) {
    els.lyricsTitle.textContent = track.title;
    els.lyricsBody.innerHTML = `<div class="lyrics-plain">${escapeHtml(lyricData.text)}</div>`;
  }

  function applyLyricsSize() {
    document.documentElement.style.setProperty('--lyrics-font-size', `${state.lyricsFontSize}px`);
    els.lyricsSizeBtn.textContent = String(state.lyricsFontSize);
    localStorage.setItem('mauzi.lyricsSize', String(state.lyricsFontSize));
  }

  function changeLyricsSize(delta) {
    state.lyricsFontSize = Math.max(16, Math.min(40, state.lyricsFontSize + delta));
    applyLyricsSize();
  }

  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    const artwork = track.coverUrl ? [{src:track.coverUrl,sizes:'512x512'},{src:track.coverUrl,sizes:'256x256'}] : [];
    try { navigator.mediaSession.metadata = new MediaMetadata({title:track.title,album:track.album || state.accessName || '',artwork}); } catch {}
  }

  function bindMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const actions = {play:()=>els.audio.play(),pause:()=>els.audio.pause(),previoustrack:prevTrack,nexttrack:()=>nextTrack(true)};
    for (const [action,handler] of Object.entries(actions)) try { navigator.mediaSession.setActionHandler(action,handler); } catch {}
  }

  els.accessForm.addEventListener('submit', createAccess);
  els.manageBtn.addEventListener('click', async () => {
    els.managerPanel.classList.toggle('hidden');
    if (!els.managerPanel.classList.contains('hidden')) await loadShares();
  });
  els.refreshSharesBtn.addEventListener('click', loadShares);
  els.shareList.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const row = btn.closest('.share-row');
    const token = row?.dataset.share || '';
    if (btn.dataset.action === 'copy') copyText(baseShareUrl(token));
    else if (btn.dataset.action === 'open') window.open(baseShareUrl(token),'_blank','noopener');
    else if (btn.dataset.action === 'revoke') revokeShare(token);
  });

  els.reloadBtn.addEventListener('click', () => loadShare(state.shareToken,{viewer:state.viewerMode}));
  els.shareBtn.addEventListener('click', () => state.shareToken && copyText(baseShareUrl(state.shareToken)));
  els.playFolderBtn.addEventListener('click', playCurrentFolder);
  els.searchInput.addEventListener('input',applyFilter);
  els.folderNav.addEventListener('click', e => {
    const btn = e.target.closest('.folder-chip');
    if (!btn) return;
    state.currentFolder = btn.dataset.folder;
    els.folderNav.querySelectorAll('.folder-chip').forEach(b => b.classList.toggle('active', b === btn));
    applyFilter();
  });
  els.trackList.addEventListener('click', e => {
    const btn = e.target.closest('.track');
    if (btn) playIndex(Number(btn.dataset.index),true);
  });

  els.playBtn.addEventListener('click',togglePlay);
  els.prevBtn.addEventListener('click',prevTrack);
  els.nextBtn.addEventListener('click',()=>nextTrack(true));
  els.repeatBtn.addEventListener('click',cycleRepeat);
  els.shuffleBtn.addEventListener('click',toggleShuffle);
  els.lyricsBtn.addEventListener('click',() => {
    const track = state.tracks[state.currentIndex];
    if (track) loadLyricsForTrack(track,true);
  });
  els.closeLyricsBtn.addEventListener('click',()=>els.lyricsPanel.classList.remove('open'));
  els.lyricsSmallerBtn.addEventListener('click',()=>changeLyricsSize(-2));
  els.lyricsLargerBtn.addEventListener('click',()=>changeLyricsSize(2));
  els.lyricsSizeBtn.addEventListener('click',()=>{state.lyricsFontSize=20;applyLyricsSize();});

  els.audio.addEventListener('play',()=>{els.playBtn.textContent='❚❚';els.playBtn.setAttribute('aria-label','Pausar');});
  els.audio.addEventListener('pause',()=>{els.playBtn.textContent='▶';els.playBtn.setAttribute('aria-label','Reproducir');});
  els.audio.addEventListener('loadedmetadata',()=>{els.duration.textContent=fmt(els.audio.duration);});
  els.audio.addEventListener('timeupdate',()=>{
    if (!state.isSeeking && Number.isFinite(els.audio.duration) && els.audio.duration>0) els.seekBar.value=String(Math.round((els.audio.currentTime/els.audio.duration)*1000));
    els.currentTime.textContent=fmt(els.audio.currentTime);
  });
  els.audio.addEventListener('durationchange',()=>els.duration.textContent=fmt(els.audio.duration));
  els.audio.addEventListener('ended',()=>{if(state.repeat!=='one')nextTrack(false);});
  els.audio.addEventListener('error',()=>toast('No pude reproducir este archivo. Revise que esa carpeta del coro esté compartida como “Cualquier persona con el enlace”.',5000));

  els.seekBar.addEventListener('input',()=>{
    state.isSeeking=true;
    if(Number.isFinite(els.audio.duration))els.currentTime.textContent=fmt((Number(els.seekBar.value)/1000)*els.audio.duration);
  });
  els.seekBar.addEventListener('change',()=>{
    if(Number.isFinite(els.audio.duration))els.audio.currentTime=(Number(els.seekBar.value)/1000)*els.audio.duration;
    state.isSeeking=false;
  });

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstall=e;els.installBtn.classList.remove('hidden');});
  els.installBtn.addEventListener('click',async()=>{
    if(!state.deferredInstall)return toast('En iPhone: Compartir → Añadir a pantalla de inicio.');
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall=null;
    els.installBtn.classList.add('hidden');
  });
  window.addEventListener('appinstalled',()=>els.installBtn.classList.add('hidden'));

  updateRepeatUI();
  els.shuffleBtn.classList.toggle('active',state.shuffle);
  applyLyricsSize();
  bindMediaSession();
  els.adminKey.value = sessionStorage.getItem('mauzi.adminKey') || '';

  if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

  const params = new URLSearchParams(location.search);
  const share = params.get('share');
  if (share) {
    state.viewerMode = true;
    loadShare(share,{viewer:true});
  } else if (!apiReady()) {
    setStatus('Antes de subir a GitHub, pegue la URL de Apps Script en config.js.');
  }
})();
