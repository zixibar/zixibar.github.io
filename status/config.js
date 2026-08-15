/**
 * ============================================================
 *  UptimeRobot 状态页 - 配置文件
 *  部署到 GitHub Pages 前，请修改下面的配置
 * ============================================================
 */
window.CONFIG = {
  // 页面标题（显示在顶部）
  siteName: '📡 服务状态页',

  // 页面副标题
  subtitle: '由 UptimeRobot 监控 · 每 30 秒自动刷新',

  // ⚠️ UptimeRobot API Key（必填）
  // 获取位置：UptimeRobot 控制台 → My Settings → API Settings
  // 推荐使用 Read-Only API Key（只读，更安全）
  apiKey: 'ur2523928-aa791a010b5f4b5df4486aff',

  // 自动刷新间隔（毫秒），默认 30 秒
  refreshMs: 30000,

  // 可用率统计周期（天），默认 [7, 30, 90]
  uptimeDays: [7, 30, 90],

  // 是否显示监控目标的 URL 链接
  showUrl: true
};
