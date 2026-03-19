# Monika Now — 实时状态面板
**部署日期**：2026-03-19

---

## 我的修改

### 新增功能

1. **mac_reporter.py** — macOS 状态采集脚本
   - 每 5 秒采集前台应用和窗口标题
   - 使用 AppleScript 读取 QQ 音乐播放信息（歌名、歌手、专辑、播放状态、进度）
   - 上报数据到 Zeabur Backend

2. **MusicStatus.tsx** — 音乐状态组件
   - 在前端展示当前播放的歌曲信息
   - 区分播放/暂停状态，显示不同表情和文案

3. **Backend 支持 music 字段** — 修改 `packages/backend/src/routes/report.ts`
   - 在 `extra` 数据结构中添加 `music` 字段存储逻辑
   - 修复了 music 处理代码被错误包裹在 `body.extra` 判断内的 bug

4. **前端类型定义** — 修改 `packages/frontend/src/lib/api.ts`
   - 在 `DeviceState.extra` 类型中添加 `music` 字段定义

---

## 部署流程

1. 在 Zeabur 创建服务项目，连接 GitHub 仓库
2. 配置环境变量：`DEVICE_TOKEN_1`、`HASH_SECRET`
3. 添加持久化存储（SQLite 数据库）
4. Git 推送后自动部署

---

## 遇到的问题与解决

### 1. TypeScript 编译错误

**错误**：`Property 'music' does not exist on type '{ battery_percent?: number }'`

**原因**：`api.ts` 中 `DeviceState` 的 `extra` 类型定义缺少 `music` 字段

**解决**：在 `extra` 类型中添加完整的 `music` 字段定义

---

### 2. Backend 数据无法存储

**现象**：mac_reporter 日志显示上报成功，但 `/api/current` 返回的 `extra` 始终为空

**原因**：`report.ts` 中处理 `body.music` 的代码被包裹在 `if (body.extra ...)` 判断内，但实际发送的数据中 `music` 在顶层，`extra` 为 `undefined`，导致整个处理逻辑被跳过

**解决**：将 music 处理逻辑移到 `body.extra` 判断外部，独立处理 `body.music`

---

### 3. Zeabur 部署未生效

**现象**：点击"重新部署"后，镜像哈希值未变化，代码实际未更新

**原因**：Zeabur 的"重新部署"有时仅重启容器，未触发重新构建

**解决**：在控制台强制重新构建，或修改环境变量触发重建

---

## 技术细节

### QQ 音乐检测

使用 AppleScript 直接控制 QQ 音乐应用获取播放信息，而非 `nowplaying-cli`。原因：QQ 音乐未向 macOS 系统媒体中心注册，`nowplaying-cli` 无法读取。

### 数据上报格式

```json
{
  "app_id": "QQMusic",
  "window_title": "Serial Killer - Lana Del Rey",
  "timestamp": "2026-03-19T12:00:00Z",
  "music": {
    "title": "Serial Killer",
    "artist": "Lana Del Rey",
    "album": "Unreleased",
    "playing": true,
    "duration": 273,
    "elapsedTime": 19
  }
}
```

---

## 待办

- [ ] 配置 launchd 实现 mac_reporter.py 开机自启动
- [ ] 优化音乐状态更新逻辑，减少重复上报
- [ ] 前端增加专辑封面显示
- [ ] 支持 Spotify、Apple Music 等其他音乐平台

---

**最后更新**：2026-03-19 13:07
