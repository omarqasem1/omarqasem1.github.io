/* Publications page: renders data/publications.json with search, filters,
   abstracts and BibTeX. Edit the data file, not this script. */
(function () {
  var root = document.getElementById('pub-app');
  if (!root) return;

  var TYPES = [
    { key: 'journal', label: 'Journal articles' },
    { key: 'conference', label: 'Conference papers' },
    { key: 'preprint', label: 'Preprints' }
  ];
  var state = { q: '', type: 'all', topic: 'all', year: 'all' };
  var pubs = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function boldMe(authors) {
    return esc(authors).replace(/\b(O\. Qasem|Omar Qasem)\b/g, '<strong>$1</strong>');
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ''); }

  function makeBibtex(p) {
    if (p.bibtex) return p.bibtex;
    var first = (p.authors.split(',')[0] || 'paper').trim().split(' ').pop();
    var key = slug(first) + p.year + slug(p.title.split(' ')[0]);
    var authors = p.authors.split(',').map(function (a) { return a.trim(); }).join(' and ');
    var kind = p.type === 'journal' ? 'article' : (p.type === 'conference' ? 'inproceedings' : 'misc');
    var lines = ['@' + kind + '{' + key + ',',
      '  title = {' + p.title + '},',
      '  author = {' + authors + '},',
      '  ' + (kind === 'article' ? 'journal' : (kind === 'inproceedings' ? 'booktitle' : 'howpublished')) + ' = {' + p.venue + '},',
      '  year = {' + p.year + '}'];
    if (p.doi) lines[lines.length - 1] += ',', lines.push('  doi = {' + p.doi + '}');
    lines.push('}');
    return lines.join('\n');
  }

  function matches(p) {
    if (state.type !== 'all' && p.type !== state.type) return false;
    if (state.topic !== 'all' && (p.topics || []).indexOf(state.topic) < 0) return false;
    if (state.year !== 'all' && String(p.year) !== state.year) return false;
    if (state.q) {
      var hay = (p.title + ' ' + p.authors + ' ' + p.venue + ' ' + (p.topics || []).join(' ')).toLowerCase();
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    }
    return true;
  }

  function card(p, i) {
    var links = [];
    if (p.doi) links.push('<a href="https://doi.org/' + esc(p.doi) + '" target="_blank" rel="noopener">DOI</a>');
    if (p.arxiv) links.push('<a href="https://arxiv.org/abs/' + esc(p.arxiv) + '" target="_blank" rel="noopener">arXiv</a>');
    if (p.pdf) links.push('<a href="' + esc(p.pdf) + '" target="_blank" rel="noopener">PDF</a>');
    var btns = '';
    if (p.abstract) btns += '<button type="button" class="pub-btn" data-act="abs" data-i="' + i + '" aria-expanded="false">Abstract</button>';
    btns += '<button type="button" class="pub-btn" data-act="bib" data-i="' + i + '">Copy BibTeX</button>';
    var badges = '';
    if (p.status && p.status !== 'published') badges += '<span class="badge badge-status">' + esc(p.status) + '</span>';
    if (p.award) badges += '<span class="badge badge-award">' + esc(p.award) + '</span>';
    var details = p.details ? ', ' + esc(p.details) : '';
    return '<li class="pub">' +
      '<div>' +
        '<p class="title">' + esc(p.title) + '</p>' +
        '<p class="venue">' + boldMe(p.authors) + ' · <em>' + esc(p.venue) + '</em>' + details + '</p>' +
        (badges ? '<p class="badges">' + badges + '</p>' : '') +
        '<p class="links">' + links.join(' ') + btns + '</p>' +
        (p.abstract ? '<div class="abstract" id="abs-' + i + '" hidden>' + esc(p.abstract) + '</div>' : '') +
      '</div>' +
      '<span class="year">' + esc(p.year) + '</span>' +
    '</li>';
  }

  function render() {
    var out = '', total = 0;
    TYPES.forEach(function (t) {
      var list = [];
      pubs.forEach(function (p, i) { if (p.type === t.key && matches(p)) list.push(card(p, i)); });
      total += list.length;
      if (list.length) {
        out += '<section class="pub-section" id="' + t.key + '"><h2>' + t.label +
          ' <span class="count">' + list.length + '</span></h2><ol class="pubs">' + list.join('') + '</ol></section>';
      }
    });
    document.getElementById('pub-count').textContent =
      total + (total === 1 ? ' publication' : ' publications') + (total === pubs.length ? '' : ' of ' + pubs.length);
    document.getElementById('pub-results').innerHTML = out ||
      '<p class="empty">No publications match. <button type="button" class="pub-btn" id="pub-reset">Clear filters</button></p>';
    var reset = document.getElementById('pub-reset');
    if (reset) reset.onclick = clearAll;
  }

  function chipRow(id, items, key) {
    var el = document.getElementById(id);
    el.innerHTML = items.map(function (it) {
      return '<button type="button" class="chip-btn" data-key="' + key + '" data-val="' + esc(it.val) + '" aria-pressed="' +
        (state[key] === it.val) + '">' + esc(it.label) + '</button>';
    }).join('');
  }

  function buildFilters() {
    var types = [{ val: 'all', label: 'All' }].concat(TYPES.filter(function (t) {
      return pubs.some(function (p) { return p.type === t.key; });
    }).map(function (t) { return { val: t.key, label: t.label.replace(' articles', 's').replace(' papers', 's') }; }));
    chipRow('f-type', types, 'type');
    var topics = {};
    pubs.forEach(function (p) { (p.topics || []).forEach(function (t) { topics[t] = (topics[t] || 0) + 1; }); });
    var tlist = Object.keys(topics).sort(function (a, b) { return topics[b] - topics[a]; });
    chipRow('f-topic', [{ val: 'all', label: 'All topics' }].concat(tlist.map(function (t) { return { val: t, label: t }; })), 'topic');
    var years = Array.from(new Set(pubs.map(function (p) { return String(p.year); }))).sort().reverse();
    var sel = document.getElementById('f-year');
    sel.innerHTML = '<option value="all">All years</option>' + years.map(function (y) { return '<option>' + y + '</option>'; }).join('');
  }

  function refreshChips() {
    root.querySelectorAll('.chip-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(state[b.dataset.key] === b.dataset.val));
    });
  }
  function clearAll() {
    state = { q: '', type: 'all', topic: 'all', year: 'all' };
    document.getElementById('f-q').value = '';
    document.getElementById('f-year').value = 'all';
    refreshChips(); render();
  }

  function copy(text, btn) {
    function done() { var t = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(function () { btn.textContent = t; }, 1500); }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { window.prompt('Copy the BibTeX:', text); }
      document.body.removeChild(ta);
    }
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('chip-btn')) { state[b.dataset.key] = b.dataset.val; refreshChips(); render(); return; }
    var i = b.dataset.i;
    if (b.dataset.act === 'abs') {
      var box = document.getElementById('abs-' + i), open = box.hidden;
      box.hidden = !open; b.setAttribute('aria-expanded', String(open));
    } else if (b.dataset.act === 'bib') copy(makeBibtex(pubs[i]), b);
  });
  document.getElementById('f-q').addEventListener('input', function (e) { state.q = e.target.value.trim(); render(); });
  document.getElementById('f-year').addEventListener('change', function (e) { state.year = e.target.value; render(); });

  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'data/publications.json?v=' + Date.now());
  xhr.onload = function () {
    try {
      pubs = JSON.parse(xhr.responseText).publications.slice().sort(function (a, b) { return b.year - a.year; });
      buildFilters(); render();
    } catch (err) { fail(); }
  };
  xhr.onerror = fail; xhr.send();
  function fail() {
    document.getElementById('pub-results').innerHTML =
      '<p class="empty">The list could not load. See all papers on <a href="https://scholar.google.com/citations?user=aSBOyrMAAAAJ&amp;hl=en">Google Scholar</a>.</p>';
  }
})();
