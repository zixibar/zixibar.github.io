/**
 * ============================================================
 *  UptimeRobot 状态页 - 主逻辑（纯前端，可直接部署到 GitHub Pages）
 *
 *  原理：
 *    浏览器直接调用 UptimeRobot v2 API（POST 表单请求）
 *    UptimeRobot 对 getMonitors 接口返回 CORS 头（Access-Control-Allow-Origin: *），
 *    所以无需后端代理即可跨域调用。
 *
 *  依赖：config.js（在 index.html 中先加载，提供 window.CONFIG）
 * ============================================================
 */

(function () {
  'use strict';

  // ===== 从 config.js 读取配置 =====
  const CONFIG = window.CONFIG || {};
  const API_KEY = CONFIG.apiKey || '';
  const REFRESH_MS = CONFIG.refreshMs || 30000;
  const UPTIME_DAYS = CONFIG.uptimeDays || [7, 30, 90];
  const SHOW_URL = CONFIG.showUrl !== false;
  const API_URL = 'https://api.uptimerobot.com/v2/getMonitors';

  // UptimeRobot 状态码 → 中文状态
  const STATUS_MAP = {
    0: { text: '暂停', cls: 'paused' },
    1: { text: '未激活', cls: 'unknown' },
    2: { text: '运行正常', cls: 'up' },
    8: { text: '似乎宕机', cls: 'down' },
    9: { text: '已宕机', cls: 'down' }
  };

  // ===== 工具函数 =====

  /** XSS 防护：转义 HTML 特殊字符 */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /** 格式化响应时间为人类可读（如 1.2s / 350ms） */
  function formatMs(ms) {
    if (ms == null || isNaN(ms)) return '--';
    if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
    return Math.round(ms) + 'ms';
  }

  /** 某天 0 点的 unix 时间戳（秒） */
  function dayStartUnix(daysAgo) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return Math.floor(d.getTime() / 1000);
  }

  /**
   * 生成 custom_uptime_ranges 参数
   * UptimeRobot 格式：多个 "开始unix_结束unix" 范围用 "-" 连接
   * 例：近7天、近30天、近90天 → "ts6_tsNow-ts29_tsNow-ts89_tsNow"
   */
  function buildUptimeRanges(daysList) {
    const end = dayStartUnix(0) + 86400; // 明天 0 点（今天结束）
    return daysList
      .map((days) => `${dayStartUnix(days - 1)}_${end}`)
      .join('-');
  }

  /** 根据可用率返回样式（颜色） */
  function uptimeStyle(pct) {
    if (pct == null || isNaN(pct)) return { cls: 'unknown', color: '#95a5a6' };
    if (pct >= 99.9) return { cls: 'good', color: '#2ecc71' };
    if (pct >= 99.0) return { cls: 'warn', color: '#f1c40f' };
    return { cls: 'warn', color: '#e74c3c' };
  }

  // ===== 数据获取 =====

  /**
   * 调用 UptimeRobot API 获取监控列表
   * POST 表单请求（与官方文档一致）
   */
  async function fetchMonitors() {
    // 构造表单体（URLSearchParams 自动处理编码）
    const body = new URLSearchParams({
      api_key: API_KEY,
      format: 'json',
      custom_uptime_ranges: buildUptimeRanges(UPTIME_DAYS),
      response_times: 1 // 附带最近响应时间记录
    });

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    return res.json();
  }

  // ===== 渲染 =====

  /** 渲染单个监控卡片 */
  function renderMonitor(m) {
    const st = STATUS_MAP[m.status] || STATUS_MAP[1];

    // 最近一次响应时间
    const rt = m.response_times && m.response_times.length
      ? m.response_times[m.response_times.length - 1].value
      : null;

    // 可用率：custom_uptime_ranges 数组（与请求周期顺序一致）
    const uptimes = (m.custom_uptime_ranges || []).map(Number);

    const el = document.createElement('div');
    el.className = 'monitor ' + st.cls;

    // ---- 头部：名称 + 状态徽章 ----
    const head = document.createElement('div');
    head.className = 'monitor-head';

    const nameBox = document.createElement('div');
    nameBox.className = 'monitor-name';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = m.friendly_name || m.url || '未命名监控';
    nameBox.appendChild(nameSpan);

    if (SHOW_URL && m.url) {
      const urlSpan = document.createElement('span');
      urlSpan.className = 'monitor-url';
      urlSpan.textContent = m.url;
      nameBox.appendChild(urlSpan);
    }
    head.appendChild(nameBox);

    const badge = document.createElement('span');
    badge.className = 'badge ' + st.cls;
    badge.innerHTML = '<span class="dot"></span>' + st.text;
    head.appendChild(badge);

    el.appendChild(head);

    // ---- 统计行：各周期可用率 + 最近响应 ----
    const stats = document.createElement('div');
    stats.className = 'monitor-stats';

    UPTIME_DAYS.forEach((days, i) => {
      const pct = uptimes[i];
      const style = uptimeStyle(pct);
      const stat = document.createElement('div');
      stat.className = 'stat';
      const value = (pct != null && !isNaN(pct)) ? pct.toFixed(2) + '%' : '--';
      stat.innerHTML = `
        <div class="s-label">近${days}天可用率</div>
        <div class="s-value ${style.cls}">${value}</div>`;
      stats.appendChild(stat);
    });

    const rtStat = document.createElement('div');
    rtStat.className = 'stat';
    rtStat.innerHTML = `
      <div class="s-label">最近响应</div>
      <div class="s-value">${formatMs(rt)}</div>`;
    stats.appendChild(rtStat);

    el.appendChild(stats);

    // ---- 可用率进度条（用第一个周期，即最短周期） ----
    const bar = document.createElement('div');
    bar.className = 'uptime-bar';
    const p0 = uptimes[0];
    const style0 = uptimeStyle(p0);
    const width = (p0 != null && !isNaN(p0)) ? Math.max(p0, 0) : 0;
    bar.innerHTML = `<div style="width:${width}%;background:${style0.color}"></div>`;
    el.appendChild(bar);

    return el;
  }

  /** 渲染整体概览 */
  function renderOverview(monitors) {
    let ok = 0, down = 0, paused = 0, unknown = 0;
    monitors.forEach((m) => {
      if (m.status === 2) ok++;
      else if (m.status === 8 || m.status === 9) down++;
      else if (m.status === 0) paused++;
      else unknown++;
    });

    const setVal = (id, val, cls) => {
      const el = document.getElementById(id);
      el.textContent = val;
      el.className = 'ov-value ' + (cls || '');
    };

    // 整体状态文字 + 颜色
    let statusText = '--', statusCls = '';
    if (monitors.length === 0) {
      statusText = '无监控项';
    } else if (down > 0) {
      statusText = '部分故障';
      statusCls = 'warn';
    } else if (unknown > 0) {
      statusText = '数据异常';
      statusCls = 'unknown';
    } else {
      statusText = '一切正常';
      statusCls = 'ok';
    }
    setVal('ov-status-value', statusText, statusCls);
    setVal('ov-operational-value', ok);
    setVal('ov-down-value', down);
    setVal('ov-paused-value', paused);

    // 整体状态卡片左边框着色
    document.getElementById('ov-status').style.borderLeftColor =
      down > 0 ? 'var(--warn)' : (unknown > 0 ? 'var(--unknown)' : 'var(--ok)');
  }

  /** 主加载流程 */
  async function loadData() {
    const list = document.getElementById('monitor-list');

    try {
      if (!API_KEY) {
        throw new Error('未配置 API Key，请修改 config.js 中的 apiKey');
      }

      const data = await fetchMonitors();

      if (data.stat !== 'ok' || !data.monitors) {
        const msg = data.error && data.error.message
          ? data.error.message
          : (data.error ? JSON.stringify(data.error) : '接口返回异常');
        throw new Error(msg);
      }

      const monitors = data.monitors;

      // 渲染概览
      renderOverview(monitors);

      // 渲染列表（宕机优先 → 正常 → 暂停）
      list.innerHTML = '';
      if (monitors.length === 0) {
        list.innerHTML = '<div class="loading">暂无监控项</div>';
      } else {
        const order = { 8: 0, 9: 0, 2: 1, 1: 2, 0: 3 };
        monitors.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
        monitors.forEach((m) => list.appendChild(renderMonitor(m)));
      }

      // 更新时间
      document.getElementById('last-update').textContent =
        '最后更新：' + new Date().toLocaleTimeString('zh-CN', { hour12: false });

    } catch (err) {
      // 显示错误（含 CORS / Key 无效 / 网络等提示）
      list.innerHTML = `<div class="error-box">⚠️ 加载失败：${escapeHtml(err.message)}
        <br><small>请检查 config.js 中的 apiKey 是否正确，以及网络能否访问 api.uptimerobot.com</small></div>`;
    }
  }

  // ===== 启动 =====
  // 应用配置
  if (CONFIG.siteName) document.getElementById('site-name').textContent = CONFIG.siteName;
  if (CONFIG.subtitle) document.getElementById('site-subtitle').textContent = CONFIG.subtitle;
  document.title = CONFIG.siteName || '服务状态页';

  // 首次加载 + 定时刷新
  loadData();
  setInterval(loadData, REFRESH_MS);
})();
