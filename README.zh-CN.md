# Neo Robot Motion Lab

[한국어](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [English](README.en.md)

这是一个独立的 Machbase Neo JSH 应用，可将公开的 KUKA LBR iiwa 运动数据呈现为
交互式三维展示。项目包含 30 名参与者、450 个场景的 33,271 个实测帧、3 种机器人
模型、生成动作、关节滑块以及位置 IK 目标。本应用仅用于仿真和可视化，不控制真实机器人。

服务器和 CLI 在 Neo JSH 中运行，页面使用项目内置的 Three.js。无需 Node.js、npm install、
前端构建或外部 CDN。

## 要求

- Git、Machbase Neo **8.7.0 或更高版本**以及正在运行的 Neo DB
- 支持 WebGL 的浏览器

## 快速开始

### 1. 检查 Neo 并克隆仓库

```sh
<NEO_EXECUTABLE> version
git clone https://github.com/machbase/neo-app-kuka-demo.git neo-app-kuka-demo
```

### 2. 启动 JSH

先确认运行中 Neo DB 的实际 Machbase 端口。`5656` 是默认值，实际端口不同时请替换。

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656
```

### 3. 验证并载入数据

30 个公开 CSV 已包含在仓库中，无需单独下载。`verify-data.js` 不修改 DB，只验证
33,271 帧和 450 个场景。

```text
cd /work/neo-app-kuka-demo
./scripts/verify-data.js
./scripts/schema.js
./scripts/seed.js
```

`schema.js` 创建一个同时包含帧 DATA 和标签 METADATA 的 `NEO_APP_ROBOT_MOTION`，不会
删除现有数据。成功时会输出 `ok:true`、`publicFrames:33271` 和 `publicScenarios:450`。

`seed.js` 每次执行都会新增一组完整数据：

- 30 个公开 CSV：33,271 帧、450 个场景，保留原始间隔时约 1 小时 42 分 21 秒；
- 3 个模型各自的 12 秒 Axis Showcase 和 10 秒 Pick & Place；
- 仅在全部帧写入成功后生成的完成标记。

TAG 写入不支持 transaction rollback。失败时可能留下部分行，但由于没有完成标记，API
不会选择该次运行。修复原因后重新执行 `seed.js`。

### 4. 启动服务器 — JSH 会话 A

服务器在 foreground 中运行，请保持此会话打开。

```text
cd /work/neo-app-kuka-demo/app
./server.js --host 127.0.0.1 --port 56802
```

### 5. 验证 — 另一个 OS shell/JSH 会话 B

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  /work/neo-app-kuka-demo/scripts/check.js --url http://127.0.0.1:56802
```

确认输出 `PASS: 11 robot API checks`。

### 6. 打开浏览器

打开 **http://127.0.0.1:56802/**。在会话 A 中按 `Ctrl+C` 停止服务器。

## JSH 快捷命令

请在项目根目录（`/work/neo-app-kuka-demo`）执行。

| 命令 | 用途 |
| --- | --- |
| `pkg run verify-data` | 非破坏性检查内置 CSV |
| `pkg run schema` | 创建当前 schema 并保留已有数据 |
| `pkg run seed` | 新增一个完成的运行 |
| `pkg run start` | 在会话 A 运行 foreground 服务器 |
| `pkg run check` | 在会话 B 检查服务器 |

应用选项应放在 `--` 之后，例如 `pkg run start -- --port 56803`。

## 从 OS shell 直接启动服务器

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656 \
  /work/neo-app-kuka-demo/app/server.js --host 127.0.0.1 --port 56802
```

## 从可信网络进行外部访问

```text
cd /work/neo-app-kuka-demo
pkg run start -- --host 0.0.0.0 --port 56802
```

外部浏览器使用 `http://<server-ip>:56802/`。不要公开 DB 端口。Teach 写入 API 没有认证，
因此不要直接暴露到公共互联网；请使用 reverse proxy 认证或 IP 白名单。

DB 配置来自 `NEO_APP_DB_HOST`、`NEO_APP_DB_PORT`、`NEO_APP_DB_USER` 和
`NEO_APP_DB_PASSWORD`。默认值为 `127.0.0.1`、`5656`、`sys`、`manager`。应用不会
自动读取 `.env`。

## 展示模式

- **Full playback**：加载全部 33,271 帧并自动播放 30 名用户的数据。关闭
  `Skip long idle gaps` 后可保留原始的 1 小时 42 分 21 秒时间线。明确选择
  Full playback 时，当前机器人模型保持不变。在 KR 6 和 iisy 上，原始 iiwa 关节信号
  会被 retarget 到各模型安全的 Studio 关节范围，而图表仍显示原始数值。
- **Scenario**：选择 User 1–30 和 Scenario 1–15。单个动作约 3.1–15.8 秒。
- **Studio**：为三个模型播放 Axis Showcase 或 Pick & Place。
- **Teach**：无需硬件，通过 XYZ IK 目标点或关节滑块捕获 2–8 个姿态。Preview 以
  10 Hz 在姿态间平滑插值，`Save & Replay` 将完成的仿真动作保存到 Machbase。只有带有
  完成标记的动作才会显示在各模型的 Motion memory 列表中。该功能不是实机控制或实测动作。

Teach 的使用顺序为：`选择 Teach → 移动目标点或关节 → 至少两次 Capture Pose → Preview
→ Save & Replay → 从 Motion memory 再次读取`。

可选模型为 LBR iiwa 7 R800、KR 6 R900-2 和 LBR iisy 3 R760。页面支持相机旋转缩放、
0.5×–10× 播放、时间轴定位、关节控制、XYZ IK 和末端轨迹。Motion Signature 支持时间轴
缩放与平移、全局缩略图、当前位置跟随、Reset 以及逐帧数值查看。

## API

| 端点 | 作用 |
| --- | --- |
| `GET /api/health` | 独立于 DB 的服务器状态 |
| `GET /api/robots` | 三个模型和数据总览 |
| `GET /api/scenarios` | 450 个场景元数据 |
| `GET /api/trajectory?mode=full` | 全部 33,271 帧 |
| `GET /api/trajectory?mode=scenario&user=1&task=1` | 一个实测场景 |
| `GET /api/trajectory?mode=studio&model=kr6-r900-2&motion=showcase` | 生成动作 |
| `GET /api/teach/motions?model=iiwa7-r800` | 已保存的访客仿真动作列表 |
| `GET /api/teach/motion?id=<motion-id>` | 读取一个已完成的访客动作 |
| `POST /api/teach/motions` | 验证并插值 2–8 个关节姿态，然后保存动作 |

响应格式为 `{ok:true,data}` / `{ok:false,error:{code,message}}`。原始 CSV、服务器源码、
凭据和 Git 文件不会通过 HTTP 公开。TAG appender 完成后，帧的查询可见性可能短暂落后于
完成标记；此时读取会暂时返回 `MOTION_NOT_READY`，浏览器会在有限时间内重试。成功的
DB 查询响应还包含供页面 SQL 面板使用的 `query:{label,sql}`。

## SQL 教程：先用元数据筛选，再读取帧

以下只读 SQL 可在 Neo Web UI SQL 编辑器或 Neo SQL shell 中直接运行。

| 区域 | 主要列 | 含义 |
| --- | --- | --- |
| DATA | `NAME`, `TIME`, `VALUE`, `J2`–`J7`, `PLAYBACK_MS` | 按时间排列的关节帧。`VALUE` 是 J1，关节值使用 radians。 |
| METADATA | `TAG_KIND`, `RUN_ID`, `SOURCE_KIND`, `MODEL_ID`, `USER_NO`, `TASK_NO` | 在读取 DATA 前筛选运行、来源、模型和场景。 |
| METADATA | `FRAME_COUNT`, `DURATION_MS`, `START_TIME`, `END_TIME` | 提供预期行数和 DATA 时间范围。 |

### 1. 先查看有哪些数据

```sql
SELECT TAG_KIND, SOURCE_KIND, MODEL_ID, RUN_ID, SCENARIO_ID,
       USER_NO, TASK_NO, FRAME_COUNT, DURATION_MS
FROM NEO_APP_ROBOT_MOTION METADATA
ORDER BY _LAST_UPDATE_TIME DESC
LIMIT 20;
```

### 2. 在最新完成的运行中筛选参与者和场景

下面通过元数据只选择 User 1 的公开场景。

```sql
WITH latest AS (
    SELECT RUN_ID
    FROM NEO_APP_ROBOT_MOTION METADATA
    WHERE TAG_KIND = 'RUN'
      AND LOGICAL_NAME = 'iiwa7-r800/public-all'
    ORDER BY _LAST_UPDATE_TIME DESC
    LIMIT 1
)
SELECT m.USER_NO, m.TASK_NO, m.FRAME_COUNT, m.DURATION_MS
FROM NEO_APP_ROBOT_MOTION METADATA m, latest r
WHERE m.RUN_ID = r.RUN_ID
  AND m.TAG_KIND = 'MOTION'
  AND m.SOURCE_KIND = 'public'
  AND m.USER_NO = 1
ORDER BY m.TASK_NO;
```

### 3. 读取一个场景的关节帧

```sql
WITH latest AS (
    SELECT RUN_ID, START_TIME, END_TIME
    FROM NEO_APP_ROBOT_MOTION METADATA
    WHERE TAG_KIND = 'RUN'
      AND LOGICAL_NAME = 'iiwa7-r800/public-all'
    ORDER BY _LAST_UPDATE_TIME DESC
    LIMIT 1
)
SELECT d.PLAYBACK_MS,
       d.VALUE AS J1, d.J2, d.J3, d.J4, d.J5, d.J6, d.J7
FROM NEO_APP_ROBOT_MOTION d, latest r
WHERE d.NAME = r.RUN_ID || '/public/user-1-task-1'
  AND d.TIME BETWEEN r.START_TIME AND r.END_TIME
ORDER BY d.TIME, d.SAMPLE_NO
LIMIT 20;
```

### 4. 从全部 public 帧中读取样本

删除 `LIMIT 100` 后可读取最新完成运行的全部 33,271 帧。

```sql
WITH latest AS (
    SELECT RUN_ID, START_TIME, END_TIME
    FROM NEO_APP_ROBOT_MOTION METADATA
    WHERE TAG_KIND = 'RUN'
      AND LOGICAL_NAME = 'iiwa7-r800/public-all'
    ORDER BY _LAST_UPDATE_TIME DESC
    LIMIT 1
)
SELECT d.PLAYBACK_MS, d.USER_NO, d.TASK_NO,
       d.VALUE AS J1, d.J2, d.J3, d.J4, d.J5, d.J6, d.J7
FROM NEO_APP_ROBOT_MOTION d, latest r
WHERE d.RUN_ID = r.RUN_ID
  AND d.TAG_KIND = 'MOTION'
  AND d.SOURCE_KIND = 'public'
  AND d.TIME BETWEEN r.START_TIME AND r.END_TIME
ORDER BY d.TIME, d.USER_NO, d.SAMPLE_NO
LIMIT 100;
```

### 5. 读取 Studio 生成动作

下面读取 KR 6 Axis Showcase 的前 20 帧。

```sql
WITH latest AS (
    SELECT RUN_ID, START_TIME, END_TIME
    FROM NEO_APP_ROBOT_MOTION METADATA
    WHERE TAG_KIND = 'RUN'
      AND LOGICAL_NAME = 'iiwa7-r800/public-all'
    ORDER BY _LAST_UPDATE_TIME DESC
    LIMIT 1
)
SELECT d.PLAYBACK_MS,
       d.VALUE AS J1, d.J2, d.J3, d.J4, d.J5, d.J6
FROM NEO_APP_ROBOT_MOTION d, latest r
WHERE d.NAME = r.RUN_ID || '/studio/kr6-r900-2/showcase'
  AND d.TIME BETWEEN r.START_TIME AND r.END_TIME
ORDER BY d.TIME, d.SAMPLE_NO
LIMIT 20;
```

### 6. 按模型筛选并读取 Teach 动作

```sql
SELECT RUN_ID, MODEL_ID, FRAME_COUNT, DURATION_MS, START_TIME, END_TIME
FROM NEO_APP_ROBOT_MOTION METADATA
WHERE TAG_KIND = 'RUN'
  AND SOURCE_KIND = 'visitor-simulation'
  AND MODEL_ID = 'iiwa7-r800'
ORDER BY _LAST_UPDATE_TIME DESC
LIMIT 20;
```

读取最近完成的 Teach 动作：

```sql
WITH latest_teach AS (
    SELECT RUN_ID, START_TIME, END_TIME
    FROM NEO_APP_ROBOT_MOTION METADATA
    WHERE TAG_KIND = 'RUN'
      AND SOURCE_KIND = 'visitor-simulation'
      AND MODEL_ID = 'iiwa7-r800'
    ORDER BY _LAST_UPDATE_TIME DESC
    LIMIT 1
)
SELECT d.PLAYBACK_MS,
       d.VALUE AS J1, d.J2, d.J3, d.J4, d.J5, d.J6, d.J7
FROM NEO_APP_ROBOT_MOTION d, latest_teach r
WHERE d.NAME = r.RUN_ID || '/motion'
  AND d.TIME BETWEEN r.START_TIME AND r.END_TIME
ORDER BY d.TIME, d.SAMPLE_NO;
```

核心模式是`先在 METADATA 中选择候选 → 再通过精确 NAME 和 TIME 范围读取 DATA`。应用使用
positional `?` bind，而不是拼接 SQL；页面的 **Last executed query** 面板会显示展开后的完整 SQL。

## 许可证

- Dataset for Collaborative Robotics v3，DOI
  [`10.17632/4fr33dkrjt.3`](https://doi.org/10.17632/4fr33dkrjt.3)：CC BY 4.0
- KR 6 / LBR iisy 模型：Apache 2.0
- LBR iiwa 7 模型：MIT
- Three.js r186：MIT

完整说明见 [Third-party notices](THIRD_PARTY_NOTICES.md)。本项目不是 KUKA 官方产品。
