/* ============================================================
 * UptimeRobot Status Page — 数据获取与渲染
 * ============================================================ */
(function () {
  'use strict';

  const CFG = window.STATUS_CONFIG;
  const API_URL = 'https://api.uptimerobot.com/v2/getMonitors';

  /* ---------- 状态映射 ---------- */
  const STATUS = {
    0: { key: 'paused', text: '已暂停', cls: 'warn' },
    1: { key: 'new', text: '待检测', cls: 'warn' },
    2: { key: 'up', text: '运行正常', cls: 'ok' },
    8: { key: 'seems-down', text: '疑似故障', cls: 'down' },
    9: { key: 'down', text: '服务中断', cls: 'down' },
  };

  const LOG_TYPES = { 1: '故障', 2: '恢复', 98: '开始监控', 99: '暂停' };

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const els = {
    siteName: $('siteName'),
    heroBanner: $('heroBanner'),
    heroPulse: $('heroPulse'),
    heroTitle: $('heroTitle'),
    heroSub: $('heroSub'),
    heroBadge: $('heroBadge'),
    statUptime: $('statUptime'),
    statResponse: $('statResponse'),
    statOnline: $('statOnline'),
    statIncidents: $('statIncidents'),
    monitors: $('monitors'),
    incidents: $('incidents'),
    updatedAt: $('updatedAt'),
    refreshBtn: $('refreshBtn'),
    refreshNote: $('refreshNote'),
    tooltip: $('tooltip'),
    brandDot: $('brandDot'),
  };

  /* ---------- 初始化 ---------- */
  document.title = CFG.siteName + ' · Status';
  els.siteName.textContent = CFG.siteName;
  els.refreshNote.textContent = `每 ${CFG.refreshInterval} 秒自动刷新`;

  /* ---------- 构建每日时间范围 ---------- */
  function buildDailyRanges(days) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const DAY = 86400;
    const endToday = Math.floor(todayStart.getTime() / 1000) + DAY - 1;
    const ranges = [];
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const e = endToday - i * DAY;
      const s = e - DAY + 1;
      ranges.push(`${s}_${e}`);
      const d = new Date(s * 1000);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
    return { ranges: ranges.join('-'), labels };
  }

  /* ---------- 请求数据 ---------- */
  async function fetchMonitors() {
    const days = CFG.uptimeDays;
    const { ranges, labels } = buildDailyRanges(days);
    const body = new URLSearchParams({
      api_key: CFG.apiKey,
      format: 'json',
      logs: '1',
      logs_limit: '100',
      log_start_date: String(Math.floor(Date.now() / 1000) - days * 86400),
      response_times: '1',
      response_times_limit: String(CFG.responseTimePoints),
      custom_uptime_ratios: '1-7-30-90',
      custom_uptime_ranges: ranges,
    });

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      if (res.status === 429) {
        const ra = parseInt(res.headers.get('Retry-After') || '', 10);
        err.retryAfter = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 300) : (CFG.rateLimitRetry || 60);
      }
      throw err;
    }
    const json = await res.json();
    if (json.stat !== 'ok') {
      throw new Error(json.error ? json.error.message : 'API 返回错误');
    }
    return { monitors: json.monitors, labels };
  }

  /* ---------- 工具函数 ---------- */
  const fmtRatio = (v) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    return n.toFixed(n >= 99.9995 ? 3 : 2) + '%';
  };
  const fmtMs = (v) => (v == null || isNaN(v) ? '—' : Math.round(v) + 'ms');
  const fmtTime = (ts) => {
    const d = new Date(ts * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const fmtDuration = (sec) => {
    if (!sec || sec <= 0) return '<1 分钟';
    const m = Math.floor(sec / 60);
    if (m < 60) return m + ' 分钟';
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小时 ${m % 60} 分钟`;
    return `${Math.floor(h / 24)} 天 ${h % 24} 小时`;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- 渲染：总览横幅 ---------- */
  function renderHero(monitors) {
    const downCount = monitors.filter((m) => m.status === 9 || m.status === 8).length;
    const pausedCount = monitors.filter((m) => m.status === 0).length;
    const upCount = monitors.filter((m) => m.status === 2).length;

    let state, title, sub, badge;
    if (downCount === 0) {
      state = 'ok';
      title = '所有系统运行正常';
      sub = `${upCount} 个服务全部在线 · 持续监控中`;
      badge = 'OPERATIONAL';
    } else if (downCount < monitors.length) {
      state = 'warn';
      title = '部分服务异常';
      sub = `${downCount} 个服务出现故障，正在处理`;
      badge = 'PARTIAL OUTAGE';
    } else {
      state = 'down';
      title = '服务大面积中断';
      sub = `所有服务均不可用，请稍后重试`;
      badge = 'MAJOR OUTAGE';
    }

    els.heroBanner.dataset.state = state;
    els.heroPulse.dataset.state = state;
    els.heroTitle.textContent = title;
    els.heroSub.textContent = sub;
    els.heroBadge.innerHTML = `<span class="hero-badge">${badge}</span>`;
    els.brandDot.dataset.state = state;
    if (pausedCount > 0 && downCount === 0) {
      els.heroSub.textContent += ` · ${pausedCount} 个已暂停`;
    }
  }

  /* ---------- 渲染：统计卡片 ---------- */
  function renderStats(monitors) {
    const ratios90 = [];
    let rtSum = 0, rtCount = 0, incidents = 0;
    let up = 0;

    monitors.forEach((m) => {
      const r = (m.custom_uptime_ratio || '').split('-');
      const r90 = parseFloat(r[3]);
      if (!isNaN(r90)) ratios90.push(r90);

      const rt = m.response_times || [];
      rt.forEach((p) => { rtSum += p.value; rtCount++; });

      (m.logs || []).forEach((l) => { if (l.type === 1) incidents++; });
      if (m.status === 2) up++;
    });

    const avgUptime = ratios90.length ? ratios90.reduce((a, b) => a + b, 0) / ratios90.length : NaN;
    const avgRt = rtCount ? rtSum / rtCount : NaN;

    els.statUptime.textContent = fmtRatio(avgUptime);
    els.statResponse.textContent = fmtMs(avgRt);
    els.statOnline.textContent = `${up}/${monitors.length}`;
    els.statIncidents.textContent = String(incidents);
  }

  /* ---------- 渲染：90 天条形图 ---------- */
  function barColorClass(ratio) {
    if (ratio >= 99.99) return 'b-perfect';
    if (ratio >= 99) return 'b-good';
    if (ratio >= 95) return 'b-warn';
    return 'b-bad';
  }

  function renderUptimeBars(m, labels) {
    const ranges = (m.custom_uptime_ranges || '').split('-');
    const wrap = document.createElement('div');
    wrap.className = 'uptime-bars';

    ranges.forEach((v, i) => {
      const ratio = parseFloat(v);
      const bar = document.createElement('div');
      bar.className = 'u-bar ' + (isNaN(ratio) ? 'b-none' : barColorClass(ratio));
      const dateLabel = labels[i] || '';
      bar.addEventListener('mouseenter', (e) => showTooltip(e, `${dateLabel} · ${isNaN(ratio) ? '无数据' : fmtRatio(ratio)}`));
      bar.addEventListener('mousemove', moveTooltip);
      bar.addEventListener('mouseleave', hideTooltip);
      wrap.appendChild(bar);
    });
    return wrap;
  }

  /* ---------- 渲染：响应时间折线 ---------- */
  function renderSparkline(m) {
    const data = (m.response_times || []).slice().sort((a, b) => a.datetime - b.datetime);
    const W = 260, H = 48, PAD = 4;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'sparkline');
    svg.setAttribute('preserveAspectRatio', 'none');

    if (data.length < 2) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', W / 2); t.setAttribute('y', H / 2 + 4);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'spark-empty');
      t.textContent = '暂无数据';
      svg.appendChild(t);
      return { svg, latest: null };
    }

    const vals = data.map((p) => p.value);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const pts = data.map((p, i) => {
      const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((p.value - min) / span) * (H - PAD * 2);
      return [x, y];
    });

    const gid = 'sg' + Math.random().toString(36).slice(2, 8);
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#34D399" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#34D399" stop-opacity="0"/>
      </linearGradient>`;
    svg.appendChild(defs);

    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    area.setAttribute('d', linePath + ` L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`);
    area.setAttribute('fill', `url(#${gid})`);
    svg.appendChild(area);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#34D399');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('class', 'spark-line');
    svg.appendChild(line);

    const last = pts[pts.length - 1];
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]);
    dot.setAttribute('r', '3.5');
    dot.setAttribute('class', 'spark-dot');
    svg.appendChild(dot);

    return { svg, latest: vals[vals.length - 1], avg: vals.reduce((a, b) => a + b, 0) / vals.length };
  }

  /* ---------- 渲染：监控卡片 ---------- */
  function renderMonitorCard(m, labels) {
    const st = STATUS[m.status] || STATUS[1];
    const ratios = (m.custom_uptime_ratio || '').split('-');

    const card = document.createElement('article');
    card.className = 'monitor glass fade-in';

    const head = document.createElement('div');
    head.className = 'm-head';
    head.innerHTML = `
      <div class="m-title">
        <span class="m-status-dot ${st.cls}"></span>
        <div>
          <h3>${esc(m.friendly_name)}</h3>
        </div>
      </div>
      <span class="m-pill ${st.cls}">${st.text}</span>`;
    card.appendChild(head);

    // uptime bars
    const barsSec = document.createElement('div');
    barsSec.className = 'm-bars-sec';
    const barsHead = document.createElement('div');
    barsHead.className = 'm-bars-head';
    barsHead.innerHTML = `<span>近 ${CFG.uptimeDays} 天可用率</span><span class="mono m-uptime-90">${fmtRatio(ratios[3])}</span>`;
    barsSec.appendChild(barsHead);
    barsSec.appendChild(renderUptimeBars(m, labels));
    card.appendChild(barsSec);

    // ratios row
    const ratioRow = document.createElement('div');
    ratioRow.className = 'm-ratios';
    [['24 小时', ratios[0]], ['7 天', ratios[1]], ['30 天', ratios[2]], ['90 天', ratios[3]]].forEach(([label, val]) => {
      const cell = document.createElement('div');
      cell.className = 'm-ratio';
      cell.innerHTML = `<span class="m-ratio-label">${label}</span><span class="mono m-ratio-val">${fmtRatio(val)}</span>`;
      ratioRow.appendChild(cell);
    });
    card.appendChild(ratioRow);

    // sparkline
    const sparkSec = document.createElement('div');
    sparkSec.className = 'm-spark-sec';
    const { svg, latest, avg } = renderSparkline(m);
    const sparkHead = document.createElement('div');
    sparkHead.className = 'm-bars-head';
    sparkHead.innerHTML = `<span>响应时间</span><span class="mono m-rt">${latest != null ? fmtMs(latest) : '—'} <em>avg ${fmtMs(avg)}</em></span>`;
    sparkSec.appendChild(sparkHead);
    sparkSec.appendChild(svg);
    card.appendChild(sparkSec);

    return card;
  }

  /* ---------- 渲染：故障历史 ---------- */
  function renderIncidents(monitors) {
    const events = [];
    monitors.forEach((m) => {
      (m.logs || []).forEach((l) => {
        if (l.type === 1 || l.type === 2) {
          events.push({
            name: m.friendly_name,
            type: l.type,
            datetime: l.datetime,
            duration: l.type === 1 ? l.duration : 0,
            reason: l.reason && l.reason.detail ? l.reason.detail : '',
          });
        }
      });
    });
    events.sort((a, b) => b.datetime - a.datetime);

    els.incidents.innerHTML = '';
    if (!events.length) {
      els.incidents.innerHTML = '<div class="incident-empty"><span class="ok-icon">✓</span> 近 ' + CFG.uptimeDays + ' 天无故障记录，一切安好</div>';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'incident-list';
    events.slice(0, 20).forEach((ev) => {
      const li = document.createElement('li');
      li.className = 'incident-item ' + (ev.type === 1 ? 'is-down' : 'is-up');
      li.innerHTML = `
        <span class="i-dot"></span>
        <div class="i-body">
          <div class="i-title">
            <strong>${esc(ev.name)}</strong>
            <span class="i-tag ${ev.type === 1 ? 'down' : 'up'}">${ev.type === 1 ? '故障' : '恢复'}</span>
            ${ev.type === 1 ? `<span class="i-dur mono">持续 ${fmtDuration(ev.duration)}</span>` : ''}
          </div>
          <div class="i-meta mono">${fmtTime(ev.datetime)}${ev.reason ? ' · ' + esc(ev.reason) : ''}</div>
        </div>`;
      list.appendChild(li);
    });
    els.incidents.appendChild(list);
  }

  /* ---------- Tooltip ---------- */
  function showTooltip(e, text) {
    els.tooltip.textContent = text;
    els.tooltip.hidden = false;
    moveTooltip(e);
  }
  function moveTooltip(e) {
    const pad = 12;
    const r = els.tooltip.getBoundingClientRect();
    let x = e.clientX - r.width / 2;
    let y = e.clientY - r.height - pad;
    x = Math.max(8, Math.min(window.innerWidth - r.width - 8, x));
    if (y < 8) y = e.clientY + pad + 8;
    els.tooltip.style.left = x + 'px';
    els.tooltip.style.top = y + 'px';
  }
  function hideTooltip() { els.tooltip.hidden = true; }

  /* ---------- 主流程 ---------- */
  let countdownTimer = null;
  let retryTimer = null;

  async function load(isFirst) {
    if (!isFirst) els.refreshBtn.classList.add('spinning');
    let rateLimited = false;
    try {
      const { monitors, labels } = await fetchMonitors();
      renderHero(monitors);
      renderStats(monitors);

      els.monitors.innerHTML = '';
      monitors.forEach((m, i) => {
        const card = renderMonitorCard(m, labels);
        card.style.animationDelay = (i * 90) + 'ms';
        els.monitors.appendChild(card);
      });

      renderIncidents(monitors);

      const now = new Date();
      const p = (n) => String(n).padStart(2, '0');
      els.updatedAt.textContent = `更新于 ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    } catch (err) {
      console.error('[status] fetch failed:', err);
      if (err && err.status === 429) {
        rateLimited = true;
        handleRateLimit(err.retryAfter || 60, isFirst);
      } else if (isFirst) {
        els.heroBanner.dataset.state = 'down';
        els.heroTitle.textContent = '数据加载失败';
        els.heroSub.textContent = String(err.message || err);
        els.heroBadge.innerHTML = '<span class="hero-badge">ERROR</span>';
        els.monitors.innerHTML = '';
      } else {
        // 后台刷新失败：保留现有数据，仅提示
        els.updatedAt.textContent = '本次刷新失败，下个周期自动重试';
      }
    } finally {
      els.refreshBtn.classList.remove('spinning');
      if (!rateLimited) scheduleNext();
    }
  }

  /* ---------- 429 频率限制：倒计时后自动重试 ---------- */
  function handleRateLimit(seconds, isFirst) {
    clearInterval(countdownTimer);
    clearInterval(retryTimer);
    let left = seconds;
    const text = () => `API 频率超限（免费版 10 次/分钟），${left} 秒后自动重试`;

    if (isFirst) {
      els.heroBanner.dataset.state = 'warn';
      els.heroPulse.dataset.state = 'warn';
      els.heroTitle.textContent = '请求频率超限';
      els.heroSub.textContent = text();
      els.heroBadge.innerHTML = '<span class="hero-badge">RATE LIMITED</span>';
    } else {
      els.updatedAt.textContent = text();
    }

    retryTimer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(retryTimer);
        load(isFirst);
        return;
      }
      (isFirst ? els.heroSub : els.updatedAt).textContent = text();
    }, 1000);
  }

  function scheduleNext() {
    clearInterval(retryTimer);
    clearInterval(countdownTimer);
    let left = CFG.refreshInterval;
    countdownTimer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(countdownTimer);
        load(false);
      }
    }, 1000);
  }

  els.refreshBtn.addEventListener('click', () => load(false));

  load(true);
})();
