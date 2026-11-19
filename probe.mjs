#!/usr/bin/env node
/**
 * 服务端探针：探测各线路真实 HTTP 状态，输出 status.js 与 status.json
 *
 * 为什么不在浏览器里探？
 *   <img> 探 favicon 的老办法只能区分“能解码成图片 / 不能”，
 *   404 的 HTML 页面、Cloudflare 的 403 挑战页、CORS 拒绝，全都变成同一种 onerror，
 *   于是正常站点被误判成“无法访问”。而且跨域 fetch 拿不到状态码。
 *   只有服务端探测才能拿到真实 status code。
 *
 * 用法：node probe.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const ACCEPT =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';

const TIMEOUT_MS = 9000;
const RETRY = 1; // 失败后补测一次，避免网络抖动造成假红

/** 探测目标：key 必须和 index.html 里 li 的 data-key 一致 */
const TARGETS = [
  { key: 'main', url: 'https://svipcun.com/' },
  { key: 'backup', url: 'https://zixibar.net/' },
  { key: 'tg', url: 'https://t.me/+BqpS4kl16EkzNGZl' },
  { key: 'status', url: 'https://zixibar.github.io/status/' },
];

function classify(status, headers) {
  const mitigated = (headers.get('cf-mitigated') || '').toLowerCase();
  if (mitigated === 'challenge') return { state: 'blocked', note: 'CF 挑战' };
  if (status === 403 || status === 429) return { state: 'blocked', note: '被拦截' };
  if (status >= 500) return { state: 'down', note: '服务端错误' };
  if (status >= 400) return { state: 'down', note: 'HTTP ' + status };
  return { state: 'ok', note: '' };
}

async function probeOnce(url) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: ACCEPT,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });
    const ms = Date.now() - started;
    const { state, note } = classify(res.status, res.headers);
    // 及时释放连接，避免长时间占用
    if (res.body) res.body.cancel().catch(() => {});
    return { state, status: res.status, ms, note };
  } catch (err) {
    const ms = Date.now() - started;
    const timeout = err && (err.name === 'AbortError' || err.name === 'TimeoutError');
    return {
      state: 'down',
      status: 0,
      ms,
      note: timeout ? '超时' : '连接失败',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url) {
  let last = null;
  for (let i = 0; i <= RETRY; i++) {
    last = await probeOnce(url);
    if (last.state === 'ok') return last;
  }
  return last;
}

(async () => {
  const startedAt = Date.now();
  const entries = await Promise.all(
    TARGETS.map(async (t) => [t.key, await probe(t.url)])
  );

  const targets = Object.fromEntries(entries);
  const payload = {
    updated: new Date().toISOString(),
    source: 'github-actions',
    cost_ms: Date.now() - startedAt,
    targets,
  };

  const json = JSON.stringify(payload, null, 2);

  writeFileSync(join(__dirname, 'status.json'), json + '\n', 'utf8');
  writeFileSync(
    join(__dirname, 'status.js'),
    'window.__PROBE_STATUS__ = ' + JSON.stringify(payload) + ';\n',
    'utf8'
  );

  for (const [k, v] of entries) {
    console.log(
      `${k.padEnd(8)} ${String(v.state).padEnd(8)} status=${String(v.status).padEnd(4)} ${v.ms}ms ${v.note || ''}`
    );
  }
  console.log(`\nwritten: status.json / status.js  (${Date.now() - startedAt}ms)`);
})();
