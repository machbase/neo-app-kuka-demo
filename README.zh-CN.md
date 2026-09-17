# Neo Robot Motion Lab

[한국어](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [English](README.en.md)

这是一个独立的 Machbase Neo JSH 应用，可将公开的 KUKA LBR iiwa 运动数据呈现为
交互式三维展示。项目包含 30 名参与者、450 个场景的 33,271 个实测帧、3 种机器人
模型、生成动作、关节滑块以及位置 IK 目标。本应用仅用于仿真和可视化，不控制真实机器人。

服务器和 CLI 在 Neo JSH 中运行，页面使用项目内置的 Three.js。无需 Node.js、npm install、
前端构建或外部 CDN。需要 Machbase Neo **8.7.0 或更高版本**。

## 快速开始

在 OS shell 中启动带显式挂载的 JSH：

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-starter=/absolute/path/to/neo-app-starter \
  -e NEO_APP_DB_PORT=5656
```

在 JSH 中创建表并载入全部数据：

```text
cd /work/neo-app-starter
./scripts/schema.js
./scripts/seed.js
```

`schema.js` 创建 `NEO_APP_ROBOT_MOTION` 和 `NEO_APP_ROBOT_RUN`，不会删除或修改已有表。
`seed.js` 每次执行都会新增一组完整数据：

- 30 个公开 CSV：33,271 帧、450 个场景，保留原始间隔时约 1 小时 42 分 21 秒；
- 3 个模型各自的 12 秒 Axis Showcase 和 10 秒 Pick & Place；
- 仅在全部帧写入成功后生成的完成标记。

TAG 写入不支持 transaction rollback。失败时可能留下部分行，但由于没有完成标记，API
不会选择该次运行。

```text
cd /work/neo-app-starter/app
./server.js --host 127.0.0.1 --port 56802
```

打开 **http://127.0.0.1:56802/**。在 JSH 中按 `Ctrl+C` 停止服务器。

也可以使用 JSH 的 `pkg run`：

```text
cd /work/neo-app-starter
pkg run schema
pkg run seed
pkg run download-lerobot
pkg run import-lerobot
pkg run start
pkg run check
```

应用选项应放在 `--` 之后，例如 `pkg run start -- --port 56803`。

DB 配置来自 `NEO_APP_DB_HOST`、`NEO_APP_DB_PORT`、`NEO_APP_DB_USER` 和
`NEO_APP_DB_PASSWORD`。默认值为 `127.0.0.1`、`5656`、`sys`、`manager`。应用不会
自动读取 `.env`。

## 加载大型数据集

不使用 31.98GiB 的 RLDS 全量版本，也不下载 LeRobot 视频。只从 Hugging Face 下载一次
8,849,485 字节的 compact state/action Parquet。

```text
cd /work/neo-app-starter
./scripts/schema.js
./scripts/download-lerobot.js
./scripts/import-lerobot.js --limit 2
./scripts/import-lerobot.js
```

Parquet 包含全部 149,985 帧、3,000 个 episode，采样率为 20Hz。默认保存到
`data/lerobot/stanford-kuka-state.parquet`。只有全部导入成功后才写入完成标记。
`observation.state` 不是七个关节角，而是末端执行器 pose
`[x, y, z, qx, qy, qz, qw]`。画面用 XYZ 和逆运动学重建一种可能的机器人姿态；原数据
不含实测关节角。

## 展示模式

- **Full playback**：加载全部 33,271 帧并自动播放 30 名用户的数据。关闭
  `Skip long idle gaps` 后可保留原始的 1 小时 42 分 21 秒时间线。
- **Scenario**：选择 User 1–30 和 Scenario 1–15。单个动作约 3.1–15.8 秒。
- **Studio**：为三个模型播放 Axis Showcase 或 Pick & Place。
- **LeRobot**：选择一个 Episode，或明确加载全部 149,985 个状态帧。

可选模型为 LBR iiwa 7 R800、KR 6 R900-2 和 LBR iisy 3 R760。页面支持相机旋转缩放、
0.5×–10× 播放、时间轴定位、关节控制、XYZ IK、末端轨迹和同步关节图表。

## API

| 端点 | 作用 |
| --- | --- |
| `GET /api/health` | 独立于 DB 的服务器状态 |
| `GET /api/robots` | 三个模型和数据总览 |
| `GET /api/scenarios` | 450 个场景元数据 |
| `GET /api/trajectory?mode=full` | 全部 33,271 帧 |
| `GET /api/trajectory?mode=scenario&user=1&task=1` | 一个实测场景 |
| `GET /api/trajectory?mode=studio&model=kr6-r900-2&motion=showcase` | 生成动作 |
| `GET /api/datasets` | 各数据集的加载状态 |
| `GET /api/lerobot/episodes` | LeRobot Episode 列表 |
| `GET /api/lerobot/trajectory?episode=0` | 一个 LeRobot Episode |

响应格式为 `{ok:true,data}` / `{ok:false,error:{code,message}}`。原始 CSV、服务器源码、
凭据和 Git 文件不会通过 HTTP 公开。

详细验证方法请参见 [English README](README.en.md)、[验证记录](doc/validation.md)和
[兼容性策略](doc/compatibility.md)。

## 许可证

- Dataset for Collaborative Robotics v3，DOI
  [`10.17632/4fr33dkrjt.3`](https://doi.org/10.17632/4fr33dkrjt.3)：CC BY 4.0
- KR 6 / LBR iisy 模型：Apache 2.0
- LBR iiwa 7 模型：MIT
- Three.js r186：MIT

完整说明见 [Third-party notices](THIRD_PARTY_NOTICES.md)。本项目不是 KUKA 官方产品。
