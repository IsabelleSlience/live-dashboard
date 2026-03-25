# Live Dashboard

这是我基于原作者项目继续维护的一版个人使用分支。

这版的重点不是重写底层，而是把“实时状态、今日时间线、浏览器活动、音乐、心情记录”整理成更适合日常查看的一套页面。

## 现在这版主要有什么

- macOS 前台活动上报
- 浏览器标题清洗、同页聚合、可点击 URL
- QQ 音乐后台识别和今日歌单
- 24 小时时段网格与时间段明细
- 5 分钟无交互自动进入 idle
- 歌单下方的“今日心情”便签

## 相对原版本，我主要改了什么

### 1. QQ 音乐后台识别链路重做

原始方案更偏前台窗口识别，对“QQ 音乐后台放歌”不够稳定。

现在改成：

- macOS Agent 通过系统媒体会话读取后台音乐
- 重点兼容 `QQ音乐`
- 后端把当前音乐写进 `device_states.extra.music`
- 后端单独维护 `music_history`

结果是：

- “音乐喵”看的是当前真实音乐状态
- “今日歌单”不再依赖前台时间线
- QQ 音乐打开但没播放、退出、重新播放，不会再把整条上报链路打崩

### 2. 浏览器活动现在支持可点击 URL

现在不是只看浏览器标签标题了。

macOS Agent 会在前台应用是浏览器时，额外抓当前标签页 URL；后端会做一层轻度隐私处理后再存储：

- 去掉 query
- 去掉 hash
- 去掉账号密码信息
- 敏感站点或敏感路径直接不保存 URL
- 一些明显像 UUID / token / 超长 ID 的路径段会替换成 `:id`

前端这些地方都能直接点开：

- 浏览器历史
- 当前任务
- 查看当前任务明细
- 其他时段任务的详情弹窗
- 相关网页列表

### 3. 浏览器历史不再那么碎

我重点处理了两类问题：

- 浏览器窗口标题尾巴太多
- 同一个网页被切成很多碎记录

现在会先做标题规范化，例如去掉：

- ` - Google Chrome - Isabelle`
- ` - 内存用量高 - 921 MB`
- 一些浏览器 profile 尾巴

同时：

- 连续相同网页会自动合并
- 1 分钟内的同一网页会在明细中继续合并
- 单条记录不再出现“点开后还是自己”的无意义展开
- 多条记录才会显示明确的展开/收起提示

### 4. 任务时间线重做

我保留了原项目的整体气质，但把“怎么读时间线”改得更适合自己用。

现在页面主要分成两部分：

- 当前任务：最近一段时间我主要在做什么
- 其他时段任务：按全天 24 小时网格去看某一段时间

具体改动：

- 当前任务按更适合阅读的方式聚合
- 其他时段任务用 24 小时网格展示
- 每小时 6 个 10 分钟格子
- 支持点选/拖选一个时间段看详情
- 增加“查看今天全部”
- 时间段详情里会列出相关网页和累计时长

### 5. 5 分钟无交互会正确进入 idle

之前会出现一种情况：

- 页面已经显示“正在忙别的喵”
- 但后端还在继续记活动
- 设备状态也不真的暗下去

现在 macOS Agent 会检测系统空闲时间，默认 5 分钟无鼠标键盘输入时：

- agent 上报 `idle`
- 后端不写入活动记录
- 设备状态会立即变为离线/暗下去
- 当前标题和 URL 会清空

### 6. 增加了“今日心情”组件

在歌单下面新增了一块心情便签：

- 所有人都可以看
- 编辑时需要输入密码
- 内容存在后端数据库里，不是前端本地缓存
- 没写内容时也会显示空状态，不会直接消失

## 现在这版的数据链路

### `/api/current`

当前状态主要来自这里。前端会读到：

- 当前应用
- `display_title`
- `page_url`
- 在线状态
- 电量信息
- 当前音乐 `extra.music`

### `/api/timeline`

当前时间线接口返回两类数据：

- `segments`
  用于当前任务、浏览器历史、其他时段任务
- `music_history`
  用于今日歌单

这意味着：

- 音乐喵看 `extra.music`
- 今日歌单看 `music_history`
- 浏览器相关 URL 来自 `segments.page_url`

### `/api/mood`

心情便签通过这个接口读写：

- `GET /api/mood`
- `POST /api/mood`

是否允许编辑取决于是否配置了 `MOOD_NOTE_PASSWORD`。

## 当前主要技术栈

- 后端：Bun + TypeScript + SQLite
- 前端：Next.js 15 + React 19 + Tailwind CSS 4
- macOS Agent：Python + AppleScript + `media-control`
- Windows Agent：Python
- Android Agent：Shell

## 关键文件

- `agents/macos/agent.py`
  macOS 前台窗口、浏览器 URL、idle、QQ 音乐采集
- `packages/backend/src/routes/report.ts`
  活动上报、URL 脱敏、音乐写入、idle 处理
- `packages/backend/src/routes/timeline.ts`
  时间线和音乐历史输出
- `packages/backend/src/routes/mood.ts`
  心情便签接口
- `packages/backend/src/db.ts`
  `activities`、`device_states`、`music_history`、`mood_notes`
- `packages/frontend/src/components/BrowserHistory.tsx`
  浏览器历史聚合和展开
- `packages/frontend/src/components/DetailedTimeline.tsx`
  当前任务、其他时段任务、时间段详情
- `packages/frontend/src/components/MusicPlaylist.tsx`
  今日歌单与空状态
- `packages/frontend/src/components/MoodNote.tsx`
  今日心情组件
- `packages/frontend/src/components/CurrentStatus.tsx`
  顶部当前状态
- `start-dev.sh`
  本地开发启动脚本

## 数据表

### `activities`

记录活动时间线原始条目。

现在额外包含：

- `display_title`
- `page_url`

### `device_states`

记录每台设备当前最新状态。

额外信息放在 `extra` 里，例如：

- 电量
- 充电状态
- 当前音乐

### `music_history`

记录后台音乐播放历史，用于“今日歌单”。

### `mood_notes`

单行文档表，用于“今日心情”。

## 本地启动

### 开发模式

这版更推荐直接用：

```bash
./start-dev.sh
```

它会：

- 杀掉旧的前端、后端和重复 Agent
- 启动当前源码的后端和前端
- 前端跑在 [http://localhost:3001](http://localhost:3001)
- 后端跑在 `http://localhost:3000`
- 临时把 macOS Agent 指向本地后端
- 退出时恢复原来的 `agents/macos/config.json`

如果你要本地测试“今日心情”编辑功能：

```bash
MOOD_NOTE_PASSWORD="你自己的本地测试密码" ./start-dev.sh
```

如果没设置 `MOOD_NOTE_PASSWORD`：

- 心情组件仍然会显示
- 但只能查看，不能编辑

### 原项目的一键启动脚本

仓库里也保留了：

```bash
./start.sh
```

这个更适合初次本地跑通项目。

### 手动启动

后端：

```bash
cd packages/backend
bun install
HASH_SECRET=你的值 DEVICE_TOKEN_1=你的值 bun run src/index.ts
```

前端：

```bash
cd packages/frontend
bun install
NEXT_PUBLIC_API_BASE=http://localhost:3000 PORT=3001 bun run dev
```

macOS Agent：

```bash
cd agents/macos
python3 agent.py
```

## macOS Agent 依赖和权限

依赖：

```bash
pip install psutil requests
brew install media-control
```

权限：

- 辅助功能权限
- 如果浏览器 URL 抓取需要自动化权限，允许终端控制对应浏览器

## 环境变量

后端常用环境变量：

```env
HASH_SECRET=替换成 openssl rand -hex 32 生成的值
DEVICE_TOKEN_1=替换成 你的token:my-mac:My Mac:macos
DB_PATH=/data/live-dashboard.db
STATIC_DIR=/app/public
PORT=3000
MOOD_NOTE_PASSWORD=只给你自己知道的密码
```

说明：

- `HASH_SECRET`
  用于标题和音乐哈希
- `DEVICE_TOKEN_1`
  设备令牌，格式是 `token:device_id:device_name:platform`
- `DB_PATH`
  SQLite 数据库路径
- `MOOD_NOTE_PASSWORD`
  今日心情编辑密码；不设置则只能查看

## Zeabur 部署

如果你想把它部署成一个可公开访问的网址，实际方式是：

- Zeabur 上部署前后端服务
- 你自己的电脑持续运行 macOS Agent
- Agent 把活动上报到 Zeabur 上的服务
- 页面展示的是你电脑实时上报的数据

### 部署步骤

1. 把当前代码推到你自己的 GitHub 仓库
2. 在 Zeabur 里从 GitHub 部署
3. 使用仓库根目录的 `Dockerfile`
4. 给服务挂一个持久化卷，挂载到 `/data`
5. 配置环境变量
6. 把本机 `agents/macos/config.json` 的 `server_url` 改成 Zeabur 域名

### Zeabur 环境变量

至少需要：

```env
HASH_SECRET=替换成 openssl rand -hex 32 生成的值
DEVICE_TOKEN_1=替换成 你的token:my-mac:My Mac:macos
DB_PATH=/data/live-dashboard.db
STATIC_DIR=/app/public
PORT=3000
MOOD_NOTE_PASSWORD=你自己的心情便签密码
```

### 本机 Agent 配置

部署完成后，把本机 `agents/macos/config.json` 改成：

```json
{
  "server_url": "https://你的-zeabur-域名",
  "token": "上面 DEVICE_TOKEN_1 里的 token 部分",
  "interval_seconds": 5,
  "heartbeat_seconds": 60
}
```

然后在你自己的电脑上启动：

```bash
cd agents/macos
python3 agent.py
```

只要 Agent 持续运行，线上页面就会持续更新。

## 当前已知情况

- 前端开发模式下，`next dev --turbopack` 偶尔会把 `.next` 跑坏，表现为 `500 Internal Server Error`
- 这通常不是业务代码错误，重启前端 dev 服务即可恢复
- 如果同时跑了多个旧的 macOS Agent，可能互相覆盖状态
- 浏览器 URL 是“轻度脱敏后的可点击链接”，不是完全原始 URL

## 后续还可以继续改的方向

- 浏览器网页归类做得更稳一些
- 时段摘要文案再自然一点
- 热力格子的配色继续微调
- 部署和运维文档再正式一点
