'use strict';

// The page is ours; only live test data and artifact URLs come from this API.

const API_ORIGIN = 'https://sharpemu.inferno-tools.com';
const REFRESH_INTERVAL = 15_000;

const icons = {
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>',
  fail:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"></path></svg>',
  flask:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v4l-5 9a3 3 0 0 0 3 5h10a3 3 0 0 0 3-5l-5-9V3M8 12h8"></path></svg>',
  clock:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
  rotate:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"></path><path d="M18.5 10A7 7 0 0 0 6 8l-2 4M5.5 14A7 7 0 0 0 18 16l2-4"></path></svg>',
  unavailable:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m6 6 12 12"></path></svg>',
  external:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-9 9"></path><path d="M19 13v6H5V5h6"></path></svg>',
  play:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"></path></svg>',
};

const verdicts = {
  mergeable: { label: 'Mergeable', icon: icons.check },
  regression: { label: 'Regression', icon: icons.fail },
  testing: { label: 'Testing', icon: icons.flask },
  pending: { label: 'Pending', icon: icons.clock },
  stale: { label: 'Needs rebase', icon: icons.rotate },
  unavailable: { label: 'Unavailable', icon: icons.unavailable },
  closed: { label: 'Closed', icon: icons.unavailable },
};

const elements = {
  clock: document.querySelector('#clock'),
  connection: document.querySelector('#connection'),
  connectionLabel: document.querySelector('#connection-label'),
  repoLink: document.querySelector('#repo-link'),
  filters: document.querySelector('#filters'),
  search: document.querySelector('#search'),
  refresh: document.querySelector('#refresh'),
  error: document.querySelector('#error'),
  list: document.querySelector('#pr-list'),
  detail: document.querySelector('#detail'),
  resultCount: document.querySelector('#result-count'),
  countOpen: document.querySelector('#count-open'),
  countMergeable: document.querySelector('#count-mergeable'),
  countRegression: document.querySelector('#count-regression'),
  countTesting: document.querySelector('#count-testing'),
  countRebase: document.querySelector('#count-rebase'),
  queueLabel: document.querySelector('#queue-label'),
  updatedLabel: document.querySelector('#updated-label'),
  queuePulse: document.querySelector('.queue-pulse'),
};

const dashboard = {
  data: null,
  filter: 'all',
  query: '',
  selected: null,
  loading: false,
};

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function safeUrl(value, fallback = '#') {
  try {
    const url = new URL(value, API_ORIGIN);
    return url.protocol === 'https:' ? url.href : fallback;
  } catch {
    return fallback;
  }
}

function shortSha(sha) {
  return sha ? escapeHtml(sha.slice(0, 8)) : 'unknown';
}

function relativeTime(value) {
  if (!value) return 'not tested';

  const seconds = Math.max(0, (Date.now() - Date.parse(value)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function verdictFor(value) {
  return verdicts[value] ?? verdicts.pending;
}

function visiblePullRequests() {
  if (!dashboard.data) return [];

  return dashboard.data.prs.filter((pullRequest) => {
    const matchesFilter =
      dashboard.filter === 'all' || pullRequest.verdict === dashboard.filter;
    const haystack =
      `#${pullRequest.number} ${pullRequest.title} ${pullRequest.author}`.toLowerCase();
    return matchesFilter && haystack.includes(dashboard.query);
  });
}

function renderSummary() {
  const pullRequests = dashboard.data.prs;
  const counts = pullRequests.reduce(
    (result, pullRequest) => {
      result[pullRequest.verdict] = (result[pullRequest.verdict] ?? 0) + 1;
      return result;
    },
    {},
  );

  elements.countOpen.textContent = pullRequests.length;
  elements.countMergeable.textContent = counts.mergeable ?? 0;
  elements.countRegression.textContent = counts.regression ?? 0;
  elements.countTesting.textContent =
    (counts.testing ?? 0) + (counts.pending ?? 0);
  elements.countRebase.textContent = counts.stale ?? 0;

  const running = dashboard.data.queue?.running ?? 0;
  const waiting = dashboard.data.queue?.waiting ?? 0;
  elements.queueLabel.textContent =
    running + waiting > 0
      ? `${running} running · ${waiting} queued`
      : 'Queue idle';
  elements.queuePulse.classList.toggle('is-busy', running + waiting > 0);
  elements.updatedLabel.textContent = `Updated ${new Date(
    dashboard.data.generatedAt,
  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  elements.repoLink.href = safeUrl(dashboard.data.repo?.url);
}

function gameDots(pullRequest) {
  return dashboard.data.games
    .map((game) => {
      const status = pullRequest.games?.[game.id]?.status ?? 'none';
      return `<span
        class="game-dot is-${escapeHtml(status)}"
        title="${escapeHtml(game.name)}: ${escapeHtml(status)}"
      ></span>`;
    })
    .join('');
}

function pullRequestCard(pullRequest) {
  const verdict = verdictFor(pullRequest.verdict);
  const selectedClass =
    pullRequest.number === dashboard.selected ? ' is-selected' : '';

  return `
    <button
      class="pr-card${selectedClass}"
      type="button"
      data-pr="${pullRequest.number}"
      data-verdict="${escapeHtml(pullRequest.verdict)}"
      aria-pressed="${pullRequest.number === dashboard.selected}"
    >
      <span class="verdict-mark" title="${verdict.label}">
        ${verdict.icon}
      </span>
      <span class="pr-card-copy">
        <span class="pr-number-row">
          <span class="pr-number">PR #${pullRequest.number}</span>
          ${pullRequest.draft ? '<span class="draft-label">Draft</span>' : ''}
        </span>
        <span class="pr-title">${escapeHtml(pullRequest.title)}</span>
        <span class="pr-byline">by ${escapeHtml(pullRequest.author)} · ${relativeTime(
          pullRequest.lastTestedAt,
        )}</span>
        <span class="game-dots">${gameDots(pullRequest)}</span>
      </span>
    </button>
  `;
}

function renderList() {
  const pullRequests = visiblePullRequests();
  elements.resultCount.textContent = `${pullRequests.length} result${
    pullRequests.length === 1 ? '' : 's'
  }`;

  if (!pullRequests.length) {
    elements.list.innerHTML =
      '<p class="empty-list">No pull requests match this view.</p>';
    dashboard.selected = null;
    renderDetail();
    return;
  }

  if (!pullRequests.some((pullRequest) => pullRequest.number === dashboard.selected)) {
    dashboard.selected = pullRequests[0].number;
  }

  elements.list.innerHTML = pullRequests.map(pullRequestCard).join('');
}

function gameResult(game, slot) {
  if (!slot) {
    return `
      <article class="game-result">
        <div class="game-result-head">
          <span class="game-name">${escapeHtml(game.name)}</span>
          <span class="game-status">Not tested</span>
        </div>
      </article>
    `;
  }

  const status = escapeHtml(slot.status ?? 'queued');
  const links = [
    slot.evidence
      ? `<a href="${safeUrl(slot.evidence)}" target="_blank" rel="noopener noreferrer">Evidence</a>`
      : '',
    slot.video
      ? `<a href="${safeUrl(slot.video)}" target="_blank" rel="noopener noreferrer">Recording</a>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  return `
    <article class="game-result">
      <div class="game-result-head">
        <span class="game-name">${escapeHtml(game.name)}</span>
        <span class="game-status is-${status}">${status.replace('-', ' ')}</span>
      </div>
      ${slot.stage ? `<p class="game-stage">${escapeHtml(slot.stage)}</p>` : ''}
      ${slot.reason ? `<p class="game-reason">${escapeHtml(slot.reason)}</p>` : ''}
      ${links ? `<div class="game-links">${links}</div>` : ''}
    </article>
  `;
}

function recordingMarkup(game, slot) {
  if (!slot?.video) return '';

  return `
    <figure class="recording">
      <figcaption>
        <span>${escapeHtml(game.name)} · ${escapeHtml(slot.status)}</span>
        <span class="recording-duration">Loading metadata</span>
      </figcaption>
      <div class="recording-frame" data-media-state="loading">
        <video
          controls
          preload="metadata"
          playsinline
          aria-label="${escapeHtml(game.name)} test recording"
          src="${safeUrl(slot.video)}"
        ></video>
        <div class="video-status" aria-live="polite">
          <span class="video-spinner" aria-hidden="true"></span>
          <span class="video-status-label">Loading recording metadata…</span>
        </div>
      </div>
    </figure>
  `;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Recording';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function initializeRecordings() {
  for (const video of elements.detail.querySelectorAll('.recording video')) {
    const frame = video.closest('.recording-frame');
    const figure = video.closest('.recording');
    const duration = figure?.querySelector('.recording-duration');
    const statusLabel = frame?.querySelector('.video-status-label');
    if (!frame) continue;

    const showReady = () => {
      frame.dataset.mediaState = 'ready';
      if (duration) duration.textContent = formatDuration(video.duration);
    };
    const showLoading = () => {
      if (frame.dataset.mediaState !== 'failed') {
        frame.dataset.mediaState = 'loading';
      }
    };
    const showError = () => {
      frame.dataset.mediaState = 'failed';
      if (duration) duration.textContent = 'Unavailable';
      if (statusLabel) {
        statusLabel.textContent =
          'Recording could not be loaded. Use the direct recording link above.';
      }
    };

    video.addEventListener('loadedmetadata', showReady);
    video.addEventListener('canplay', showReady);
    video.addEventListener('loadstart', showLoading);
    video.addEventListener('waiting', showLoading);
    video.addEventListener('error', showError);

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) showReady();
  }
}

function renderDetail() {
  if (!dashboard.data || dashboard.selected == null) {
    elements.detail.innerHTML = `
      <div class="detail-empty">
        <span class="detail-symbol" aria-hidden="true">${icons.flask}</span>
        <p>Select a pull request to inspect its test run.</p>
      </div>
    `;
    return;
  }

  const pullRequest = dashboard.data.prs.find(
    (candidate) => candidate.number === dashboard.selected,
  );
  if (!pullRequest) return;

  const verdict = verdictFor(pullRequest.verdict);
  const recordings = dashboard.data.games
    .map((game) => recordingMarkup(game, pullRequest.games?.[game.id]))
    .filter(Boolean);
  const sourceText = pullRequest.headRepoFull
    ? `branch <code>${escapeHtml(pullRequest.headRef ?? '?')}</code> on
       <strong>${escapeHtml(pullRequest.headRepoFull)}</strong>`
    : '<strong>source fork unavailable</strong>';

  elements.detail.innerHTML = `
    <div class="detail-topline">
      <span class="detail-pr">Pull request #${pullRequest.number}</span>
      <span class="verdict" data-verdict="${escapeHtml(pullRequest.verdict)}">
        ${verdict.icon}
        ${verdict.label}
      </span>
    </div>

    <h2 class="detail-title">
      <a
        href="${safeUrl(pullRequest.url)}"
        target="_blank"
        rel="noopener noreferrer"
      >${escapeHtml(pullRequest.title)}</a>
    </h2>

    <p class="detail-meta">
      Opened by <strong>${escapeHtml(pullRequest.author)}</strong>
      · ${sourceText}
      @ <code>${shortSha(pullRequest.headSha)}</code>
      · targets <code>${escapeHtml(pullRequest.baseBranch)}</code>
      · tested ${relativeTime(pullRequest.lastTestedAt)}
      ${pullRequest.draft ? ' · <strong>draft</strong>' : ''}
    </p>

    <div class="game-results">
      ${dashboard.data.games
        .map((game) => gameResult(game, pullRequest.games?.[game.id]))
        .join('')}
    </div>

    <div class="detail-actions">
      <a
        class="primary-action"
        href="${safeUrl(pullRequest.url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open on GitHub
        ${icons.external}
      </a>
      ${
        recordings.length
          ? `<a class="secondary-action" href="#recordings">${icons.play}${recordings.length} recording${recordings.length === 1 ? '' : 's'}</a>`
          : ''
      }
    </div>

    ${
      recordings.length
        ? `<div class="recordings" id="recordings">${recordings.join('')}</div>`
        : ''
    }
  `;
  initializeRecordings();
}

function selectPullRequest(number) {
  if (dashboard.selected === number) return;
  dashboard.selected = number;

  for (const card of elements.list.querySelectorAll('.pr-card')) {
    const isSelected = Number(card.dataset.pr) === number;
    card.classList.toggle('is-selected', isSelected);
    card.setAttribute('aria-pressed', String(isSelected));
  }

  history.replaceState(null, '', `#pr-${number}`);
  renderDetail();
}

function renderAll() {
  renderSummary();
  renderList();
  renderDetail();
}

async function refresh() {
  if (dashboard.loading) return;
  dashboard.loading = true;
  elements.refresh.classList.add('is-loading');
  elements.refresh.disabled = true;

  try {
    const response = await fetch(`${API_ORIGIN}/api/state`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Runner returned ${response.status}`);

    dashboard.data = await response.json();
    elements.error.hidden = true;
    elements.connection.classList.add('is-live');
    elements.connection.classList.remove('is-error');
    elements.connectionLabel.textContent = 'Live';

    if (dashboard.selected == null) {
      const deepLink = /^#pr-(\d+)$/.exec(location.hash);
      dashboard.selected = deepLink ? Number(deepLink[1]) : null;
    }

    renderAll();
  } catch (error) {
    console.error(error);
    elements.error.hidden = false;
    elements.connection.classList.remove('is-live');
    elements.connection.classList.add('is-error');
    elements.connectionLabel.textContent = 'Retrying';
  } finally {
    dashboard.loading = false;
    elements.refresh.classList.remove('is-loading');
    elements.refresh.disabled = false;
  }
}

elements.filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;

  dashboard.filter = button.dataset.filter;
  for (const filter of elements.filters.querySelectorAll('[data-filter]')) {
    filter.classList.toggle('is-active', filter === button);
  }
  renderList();
  renderDetail();
});

elements.search.addEventListener('input', (event) => {
  dashboard.query = event.target.value.trim().toLowerCase();
  renderList();
  renderDetail();
});

elements.list.addEventListener('click', (event) => {
  const card = event.target.closest('[data-pr]');
  if (card) selectPullRequest(Number(card.dataset.pr));
});

elements.refresh.addEventListener('click', refresh);

function updateClock() {
  elements.clock.textContent = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

updateClock();
setInterval(updateClock, 5_000);
refresh();
setInterval(refresh, REFRESH_INTERVAL);
