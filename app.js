const audio = document.getElementById("audio");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const nowTitle = document.getElementById("nowTitle");
const nowMeta = document.getElementById("nowMeta");
const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const seek = document.getElementById("seek");
const curTime = document.getElementById("curTime");
const durTime = document.getElementById("durTime");
const vol = document.getElementById("vol");
const cacheStatus = document.getElementById("cacheStatus");
const netStatus = document.getElementById("netStatus");
const refreshBtn = document.getElementById("refreshBtn");
const uploadBtn = document.getElementById("uploadBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const loopBtn = document.getElementById("loopBtn");
const playlistSelect = document.getElementById("playlistSelect");
const playlistViewBtn = document.getElementById("playlistViewBtn");
const playlistClearBtn = document.getElementById("playlistClearBtn");
const playlistName = document.getElementById("playlistName");
const playlistCreateBtn = document.getElementById("playlistCreateBtn");
const queueList = document.getElementById("queueList");
const queueClearBtn = document.getElementById("queueClearBtn");
const importUrl = document.getElementById("importUrl");
const importBtn = document.getElementById("importBtn");
const importHint = document.getElementById("importHint");

let tracks = [];
let localTracks = [];
let sessionLocalTracks = [];
let currentIndex = -1;
let currentTrackId = "";
let seeking = false;
let shuffleOn = false;
let loopMode = "off"; // off | one | all
let playHistory = [];
let playlists = [];
let playlistFilterId = "";
let selectedPlaylistId = "";
let playQueue = [];

const STORAGE = {
  playlists: "mf_playlists",
  localTracks: "mf_local_tracks",
  prefs: "mf_prefs",
  queue: "mf_queue",
};

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function titleFromFile(name) {
  const base = name
    .replace(/\.mp3$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return base
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

async function getTracksFromJson() {
  const res = await fetch("./musics.json", { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.tracks;
  if (!Array.isArray(items)) return null;
  return items
    .map((item) => {
      if (typeof item === "string") {
        const name = decodeURIComponent(item.split("/").pop() || item);
        return {
          url: item,
          title: titleFromFile(name),
        };
      }
      const name = decodeURIComponent((item.url || "").split("/").pop() || "");
      return {
        url: item.url,
        title: item.title || titleFromFile(name),
      };
    })
    .filter((t) => t.url);
}

async function getTracksFromDir() {
  const res = await fetch("./musics/", { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = Array.from(doc.querySelectorAll("a"))
    .map((a) => a.getAttribute("href"))
    .filter(Boolean)
    .filter(
      (h) =>
        h.toLowerCase().endsWith(".mp3") || h.toLowerCase().includes(".mp3?"),
    );

  if (!links.length) return [];

  return links.map((href) => {
    const clean = decodeURIComponent(href).replace(/\\/g, "/");
    const parts = clean.split("/");
    const file = parts[parts.length - 1].split("?")[0];
    const url = clean.startsWith("http")
      ? clean
      : `./musics/${encodeURIComponent(file)}`;
    return { url, title: titleFromFile(file) };
  });
}

async function loadTracks() {
  listEl.innerHTML = "";
  emptyEl.hidden = true;
  cacheStatus.textContent = "Scanning library...";

  let items = null;
  try {
    items = await getTracksFromJson();
  } catch (err) {
    items = null;
  }

  if (!items) {
    try {
      items = await getTracksFromDir();
    } catch (err) {
      items = [];
    }
  }

  tracks = buildTrackList(items || []);
  if (!tracks.length) {
    emptyEl.hidden = false;
    cacheStatus.textContent = "No tracks to cache.";
    return;
  }

  renderList();
  renderQueue();
  cacheAllTracks();
}

function renderList() {
  listEl.innerHTML = "";
  const visible = getPlaybackList();
  visible.forEach((track, index) => {
    const row = document.createElement("div");
    row.className = "track";
    row.setAttribute("role", "listitem");
    row.innerHTML = `
      <div>
        <div class="track-title">${track.title}</div>
        <div class="track-meta">${track.meta}</div>
      </div>
      <div class="track-actions">
        <button class="ghost mini" data-action="add">Add</button>
        <button class="ghost mini" data-action="queue">Next</button>
        <span>Play</span>
      </div>
    `;
    row.addEventListener("click", () => playAtIndex(visible, index));
    row.querySelector('[data-action="add"]').addEventListener("click", (e) => {
      e.stopPropagation();
      addTrackToSelectedPlaylist(track.id);
    });
    row
      .querySelector('[data-action="queue"]')
      .addEventListener("click", (e) => {
        e.stopPropagation();
        addToQueue(track.id);
      });
    listEl.appendChild(row);
  });
}

function updateActive() {
  const visible = getPlaybackList();
  Array.from(listEl.children).forEach((el, idx) => {
    const track = visible[idx];
    el.classList.toggle("active", track?.id === currentTrackId);
  });
}

function playAtIndex(list, index) {
  if (index < 0 || index >= list.length) return;
  const track = list[index];
  currentIndex = index;
  currentTrackId = track.id;
  seek.value = 0;
  seek.max = 0;
  audio.src = track.url;
  audio.load();
  audio.play();
  nowTitle.textContent = track.title;
  nowMeta.textContent = track.meta;
  playBtn.textContent = "Pause";
  updateActive();
}

playBtn.addEventListener("click", () => {
  if (!audio.src) {
    const list = getPlaybackList();
    playAtIndex(list, 0);
    return;
  }
  if (audio.paused) {
    audio.play();
    playBtn.textContent = "Pause";
  } else {
    audio.pause();
    playBtn.textContent = "Play";
  }
});

prevBtn.addEventListener("click", () => {
  const list = getPlaybackList();
  if (list.length === 0) return;
  playAtIndex(list, getPrevIndex(list));
});

nextBtn.addEventListener("click", () => {
  const list = getPlaybackList();
  if (list.length === 0) return;
  playAtIndex(list, getNextIndex(list));
});

function applySeekFromEvent(event) {
  if (!Number.isFinite(audio.duration)) return;
  const rect = seek.getBoundingClientRect();
  const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
  const pct = rect.width ? x / rect.width : 0;
  audio.currentTime = pct * audio.duration;
}

seek.addEventListener("click", (event) => {
  applySeekFromEvent(event);
});

audio.addEventListener("timeupdate", () => {
  if (!Number.isFinite(audio.duration)) return;
  seek.value = audio.currentTime;
  curTime.textContent = formatTime(audio.currentTime);
  durTime.textContent = formatTime(audio.duration);
});

audio.addEventListener("loadedmetadata", () => {
  if (!Number.isFinite(audio.duration)) return;
  seek.max = audio.duration;
  durTime.textContent = formatTime(audio.duration);
});

audio.addEventListener("durationchange", () => {
  if (!Number.isFinite(audio.duration)) return;
  seek.max = audio.duration;
});

audio.addEventListener("ended", () => {
  if (loopMode === "one") {
    audio.currentTime = 0;
    audio.play();
    return;
  }
  if (playQueue.length) {
    playNextFromQueue();
    return;
  }
  const list = getPlaybackList();
  if (loopMode === "off" && currentIndex === list.length - 1 && !shuffleOn) {
    playBtn.textContent = "Play";
    return;
  }
  nextBtn.click();
});

function applyVolumeFromEvent(event) {
  const rect = vol.getBoundingClientRect();
  const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
  const pct = rect.width ? x / rect.width : 0;
  vol.value = Math.round(pct * 100);
  audio.volume = Number(vol.value) / 100;
}

vol.addEventListener("click", (event) => {
  applyVolumeFromEvent(event);
});

function updateNetwork() {
  if (navigator.onLine) {
    netStatus.textContent = "Online";
    netStatus.style.color = "#1bb48f";
  } else {
    netStatus.textContent = "Offline";
    netStatus.style.color = "#e8b048";
  }
}

window.addEventListener("online", updateNetwork);
window.addEventListener("offline", updateNetwork);

refreshBtn.addEventListener("click", loadTracks);
uploadBtn.addEventListener("click", addLocalFiles);
shuffleBtn.addEventListener("click", toggleShuffle);
loopBtn.addEventListener("click", cycleLoop);
playlistCreateBtn.addEventListener("click", createPlaylist);
queueClearBtn.addEventListener("click", clearQueue);
importBtn.addEventListener("click", importFromUrl);
playlistViewBtn.addEventListener("click", () => {
  playlistFilterId = selectedPlaylistId || "";
  playHistory = [];
  const list = getPlaybackList();
  if (!list.find((track) => track.id === currentTrackId)) {
    audio.pause();
    audio.src = "";
    currentIndex = -1;
    currentTrackId = "";
    playBtn.textContent = "Play";
  }
  savePrefs();
  renderList();
});
playlistClearBtn.addEventListener("click", () => {
  playlistFilterId = "";
  playHistory = [];
  savePrefs();
  renderList();
});
playlistSelect.addEventListener("change", () => {
  selectedPlaylistId = playlistSelect.value;
  playlistFilterId = selectedPlaylistId || "";
  playHistory = [];
  const list = getPlaybackList();
  if (!list.find((track) => track.id === currentTrackId)) {
    audio.pause();
    audio.src = "";
    currentIndex = -1;
    currentTrackId = "";
    playBtn.textContent = "Play";
  }
  savePrefs();
  renderList();
});

async function cacheAllTracks() {
  if (!("serviceWorker" in navigator)) {
    cacheStatus.textContent = "Service worker not supported.";
    return;
  }
  const urls = tracks.filter((t) => t.cacheable).map((t) => t.url);
  if (!urls.length) {
    cacheStatus.textContent = "No tracks to cache.";
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "CACHE_TRACKS", urls });
    cacheStatus.textContent = `Caching ${urls.length} tracks for offline...`;
  } catch (err) {
    cacheStatus.textContent = "Offline cache failed to initialize.";
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "CACHE_PROGRESS") {
      cacheStatus.textContent = `Cached ${data.done}/${data.total} tracks`;
    }
    if (data.type === "CACHE_DONE") {
      cacheStatus.textContent = `Offline cache ready (${data.total} tracks)`;
    }
  });
}

updateNetwork();
loadState();
loadTracks();

function buildTrackList(remoteTracks) {
  const normalizedRemote = remoteTracks.map((track) => ({
    ...track,
    id: `remote:${track.url}`,
    meta: track.url,
    cacheable: true,
    source: "remote",
  }));
  const normalizedLocal = [...localTracks, ...sessionLocalTracks].map(
    (track) => ({
      ...track,
      id: track.id,
      meta: `Local • ${track.name}`,
      cacheable: false,
      source: "local",
    }),
  );
  return [...normalizedLocal, ...normalizedRemote];
}

function getPlaybackList() {
  return playlistFilterId
    ? tracks.filter((track) => isTrackInPlaylist(track.id, playlistFilterId))
    : tracks;
}

function resolveCurrentIndex(list) {
  if (!currentTrackId) return -1;
  return list.findIndex((track) => track.id === currentTrackId);
}

function getNextIndex(list) {
  if (list.length === 0) return 0;
  if (playQueue.length) {
    const nextId = playQueue.shift();
    saveQueue();
    renderQueue();
    const idx = list.findIndex((track) => track.id === nextId);
    if (idx >= 0) return idx;
  }
  if (shuffleOn) {
    let next = resolveCurrentIndex(list);
    if (list.length === 1) return next < 0 ? 0 : next;
    while (next === resolveCurrentIndex(list)) {
      next = Math.floor(Math.random() * list.length);
    }
    const cur = resolveCurrentIndex(list);
    if (cur >= 0) playHistory.push(cur);
    return next;
  }
  const current = resolveCurrentIndex(list);
  const next = current + 1;
  if (next >= list.length) return loopMode === "all" ? 0 : current;
  return next;
}

function getPrevIndex(list) {
  if (list.length === 0) return 0;
  if (shuffleOn && playHistory.length) {
    return playHistory.pop();
  }
  const current = resolveCurrentIndex(list);
  const prev = current - 1;
  if (prev < 0) return loopMode === "all" ? list.length - 1 : 0;
  return prev;
}

function toggleShuffle() {
  shuffleOn = !shuffleOn;
  playHistory = [];
  shuffleBtn.textContent = shuffleOn ? "Shuffle: On" : "Shuffle";
  savePrefs();
}

function cycleLoop() {
  if (loopMode === "off") loopMode = "all";
  else if (loopMode === "all") loopMode = "one";
  else loopMode = "off";
  loopBtn.textContent =
    loopMode === "off"
      ? "Loop: Off"
      : loopMode === "all"
        ? "Loop: All"
        : "Loop: One";
  savePrefs();
}

async function addLocalFiles() {
  if (!("showOpenFilePicker" in window)) {
    cacheStatus.textContent =
      "Local upload needs Chrome File System Access API.";
    return;
  }

  try {
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: "Audio",
          accept: {
            "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac"],
          },
        },
      ],
    });

    const files = await Promise.all(handles.map((h) => h.getFile()));
    const newLocal = [];
    const sessionOnly = [];

    for (const file of files) {
      const id = `local:${file.name}:${file.size}`;
      const title = titleFromFile(file.name);
      const url = URL.createObjectURL(file);
      const entry = { id, name: file.name, title, url };
      const dataUrl = await tryReadAsDataUrl(file);
      if (dataUrl) {
        newLocal.push({ ...entry, url: dataUrl });
      } else {
        sessionOnly.push(entry);
      }
    }

    if (newLocal.length) {
      localTracks = [...localTracks, ...newLocal];
      saveLocalTracks();
    }
    if (sessionOnly.length) {
      sessionLocalTracks = [...sessionLocalTracks, ...sessionOnly];
    }

    tracks = buildTrackList(tracks.filter((t) => t.source === "remote"));
    renderList();
    if (currentIndex === -1 && tracks.length > 0) {
      const list = getPlaybackList();
      playAtIndex(list, 0);
    }
    const savedMsg = newLocal.length
      ? `Saved ${newLocal.length} local track(s).`
      : "";
    const sessionMsg = sessionOnly.length
      ? ` ${sessionOnly.length} track(s) are session-only (storage limit).`
      : "";
    cacheStatus.textContent = `Added ${newLocal.length + sessionOnly.length} local tracks.${savedMsg}${sessionMsg}`;
  } catch (err) {
    // user cancelled
  }
}

async function importFromUrl() {
  const url = (importUrl.value || "").trim();
  if (!url) return;
  importBtn.disabled = true;
  importHint.textContent = "Downloading...";
  try {
    const res = await fetch("./api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      importHint.textContent = data.error || "Import failed.";
      importBtn.disabled = false;
      return;
    }
    importHint.textContent = `Saved to /musics: ${data.file}`;
    importUrl.value = "";
    await loadTracks();
  } catch (err) {
    importHint.textContent = "Import failed.";
  } finally {
    importBtn.disabled = false;
  }
}

function tryReadAsDataUrl(file) {
  return new Promise((resolve) => {
    // Avoid blowing localStorage for very large files.
    if (file.size > 3 * 1024 * 1024) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result || "");
        // Test localStorage capacity.
        const probeKey = "mf_probe";
        localStorage.setItem(probeKey, "x");
        localStorage.removeItem(probeKey);
        return resolve(dataUrl);
      } catch (err) {
        return resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function loadState() {
  try {
    playlists = JSON.parse(localStorage.getItem(STORAGE.playlists) || "[]");
  } catch {
    playlists = [];
  }
  try {
    localTracks = JSON.parse(localStorage.getItem(STORAGE.localTracks) || "[]");
  } catch {
    localTracks = [];
  }
  try {
    const prefs = JSON.parse(localStorage.getItem(STORAGE.prefs) || "{}");
    shuffleOn = Boolean(prefs.shuffleOn);
    loopMode = prefs.loopMode || "off";
    selectedPlaylistId = prefs.selectedPlaylistId || "";
    playlistFilterId = prefs.playlistFilterId || "";
  } catch {
    shuffleOn = false;
    loopMode = "off";
    selectedPlaylistId = "";
    playlistFilterId = "";
  }
  shuffleBtn.textContent = shuffleOn ? "Shuffle: On" : "Shuffle";
  loopBtn.textContent =
    loopMode === "off"
      ? "Loop: Off"
      : loopMode === "all"
        ? "Loop: All"
        : "Loop: One";
  renderPlaylistSelect();
  try {
    playQueue = JSON.parse(localStorage.getItem(STORAGE.queue) || "[]");
  } catch {
    playQueue = [];
  }
  renderQueue();
}

function savePrefs() {
  localStorage.setItem(
    STORAGE.prefs,
    JSON.stringify({
      shuffleOn,
      loopMode,
      selectedPlaylistId,
      playlistFilterId,
    }),
  );
}

function saveQueue() {
  localStorage.setItem(STORAGE.queue, JSON.stringify(playQueue));
}

function saveLocalTracks() {
  localStorage.setItem(STORAGE.localTracks, JSON.stringify(localTracks));
}

function savePlaylists() {
  localStorage.setItem(STORAGE.playlists, JSON.stringify(playlists));
}

function renderPlaylistSelect() {
  playlistSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select playlist";
  playlistSelect.appendChild(placeholder);
  playlists.forEach((pl) => {
    const opt = document.createElement("option");
    opt.value = pl.id;
    opt.textContent = pl.name;
    playlistSelect.appendChild(opt);
  });
  playlistSelect.value = selectedPlaylistId || "";
}

function createPlaylist() {
  const name = (playlistName.value || "").trim();
  if (!name) return;
  const id = `pl:${Date.now()}`;
  playlists.push({ id, name, trackIds: [] });
  playlistName.value = "";
  selectedPlaylistId = id;
  savePlaylists();
  savePrefs();
  renderPlaylistSelect();
}

function addTrackToSelectedPlaylist(trackId) {
  if (!selectedPlaylistId) {
    cacheStatus.textContent = "Create or select a playlist first.";
    return;
  }
  const playlist = playlists.find((pl) => pl.id === selectedPlaylistId);
  if (!playlist) return;
  if (!playlist.trackIds.includes(trackId)) {
    playlist.trackIds.push(trackId);
    savePlaylists();
    cacheStatus.textContent = "Added to playlist.";
  }
}

function isTrackInPlaylist(trackId, playlistId) {
  const playlist = playlists.find((pl) => pl.id === playlistId);
  if (!playlist) return false;
  return playlist.trackIds.includes(trackId);
}

function addToQueue(trackId) {
  playQueue.push(trackId);
  saveQueue();
  renderQueue();
  cacheStatus.textContent = "Queued for next.";
}

function clearQueue() {
  playQueue = [];
  saveQueue();
  renderQueue();
}

function playNextFromQueue() {
  if (!playQueue.length) return;
  const nextId = playQueue.shift();
  saveQueue();
  renderQueue();
  const list = getPlaybackList();
  const idx = list.findIndex((track) => track.id === nextId);
  if (idx >= 0) {
    playAtIndex(list, idx);
  } else {
    nextBtn.click();
  }
}

function renderQueue() {
  queueList.innerHTML = "";
  if (!playQueue.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Queue is empty.";
    queueList.appendChild(empty);
    return;
  }
  const list = getPlaybackList();
  playQueue.forEach((id, idx) => {
    const track =
      list.find((t) => t.id === id) || tracks.find((t) => t.id === id);
    const row = document.createElement("div");
    row.className = "queue-item";
    row.innerHTML = `
      <div>${track ? track.title : "Unavailable track"}</div>
      <button class="ghost mini" data-idx="${idx}">Remove</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      playQueue.splice(idx, 1);
      saveQueue();
      renderQueue();
    });
    queueList.appendChild(row);
  });
}
