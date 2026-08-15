/* ============================================================
 * 站点配置 — 只需修改这里
 * ============================================================ */
window.STATUS_CONFIG = {
  // UptimeRobot API Key（建议使用 Read-Only Key，ur- 开头）
  apiKey: 'ur2523928-aa791a010b5f4b5df4486aff',

  // 站点名称（显示在左上角 / 浏览器标题）
  siteName: '服务状态监控',

  // 自动刷新间隔（秒）
  refreshInterval: 60,

  // 遇到 429 频率限制时的默认重试等待（秒）
  // 注意：UptimeRobot 免费版限制 10 次请求/分钟，多开标签页会叠加计数
  rateLimitRetry: 60,

  // 90 天可用率条形图的天数
  uptimeDays: 90,

  // 响应时间折线图取最近多少个数据点
  responseTimePoints: 48,
};
