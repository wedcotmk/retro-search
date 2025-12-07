let mini = null;
let episodes = {};
let allChunks = [];
const SHOWING_LIMIT = 50;
let debounceTimer = null;

/* ----------------------------------------
   Load Episodes Metadata (supports "id")
----------------------------------------- */
async function loadEpisodes() {
  const res = await fetch("episodes.json");
  const data = await res.json();

  for (const ep of data) {
    // ep.id should be "Episode1", "Episode95", etc.
    const raw = String(ep.id).trim();

    // Normalize key (ensure it looks like "EpisodeX")
    const key = raw.startsWith("Episode") ? raw : `Episode${raw}`;

    episodes[key] = {
      url: ep.url,
      title: ep.title || "Untitled Episode"
    };
  }
}

/* ----------------------------------------
   Load Search Index
----------------------------------------- */
async function loadIndex() {
  const res = await fetch("search_index.json");
  allChunks = await res.json();

  mini = new MiniSearch({
    fields: ["text"],
    storeFields: ["id", "text", "episode", "title", "timestamp", "url", "position"]
  });

  mini.addAll(allChunks);
}

/* ----------------------------------------
   Timestamp helper
----------------------------------------- */
function formatTimestamp(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ----------------------------------------
   Loose (~10-word window) phrase search
----------------------------------------- */
function loosePhraseMatch(text, queryPhrase) {
  if (!text) return false;

  const q = queryPhrase.trim();
  if (!q) return false;

  // Single-word? No phrase constraint
  if (!q.includes(" ")) return true;

  const qWords = q.toLowerCase().split(/\s+/);
  const first = qWords[0];
  const last = qWords[qWords.length - 1];

  const lower = text.toLowerCase();
  const firstIdx = lower.indexOf(first);
  const lastIdx = lower.indexOf(last);

  if (firstIdx === -1 || lastIdx === -1) return false;

  // Rough spacing estimation
  const approxWordsBetween = Math.abs((lastIdx - firstIdx) / 5);
  return approxWordsBetween <= 10;
}

/* ----------------------------------------
   Render Results
----------------------------------------- */
function renderResults(results) {
  const out = document.getElementById("results");
  out.innerHTML = "";

  const limited = results.slice(0, SHOWING_LIMIT);

  for (const r of limited) {
    const ep = episodes[r.episode]; // Episode5, Episode96, etc.
    if (!ep) continue;

    const ts = Math.floor(r.timestamp || 0);
    const jumpLink = `${r.url}&t=${ts}s`;

    const div = document.createElement("div");
    div.className = "result";

    div.innerHTML = `
      <div class="title-row">
        <span class="ep-title">${ep.title}</span>
        <span class="ep-meta">
          • Episode ${r.episode.replace("Episode", "")}
          • ${formatTimestamp(ts)}
        </span>
      </div>

      <div class="snippet">${r.text}</div>

      <a class="jump" href="${jumpLink}" target="_blank">Jump to timestamp</a>
    `;

    out.appendChild(div);
  }

  if (results.length > SHOWING_LIMIT) {
    const more = document.createElement("div");
    more.className = "more-results";
    more.textContent = `Showing top ${SHOWING_LIMIT} of ${results.length} results…`;
    out.appendChild(more);
  }
}

/* ----------------------------------------
   Main Search with debounce
----------------------------------------- */
function performSearch(q) {
  if (!mini) return;

  let baseResults = mini.search(q, { fuzzy: 0.2 });

  // Apply loose phrase match
  baseResults = baseResults.filter(r => loosePhraseMatch(r.text, q));

  renderResults(baseResults);
}

function setupSearch() {
  const box = document.getElementById("searchBox");

  box.addEventListener("input", () => {
    const q = box.value;

    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      if (q.trim().length < 2) {
        document.getElementById("results").innerHTML = "";
        return;
      }
      performSearch(q);
    }, 200);
  });
}

/* ----------------------------------------
   Start App
----------------------------------------- */
async function start() {
  await loadEpisodes();
  await loadIndex();
  setupSearch();
}

start();
