# Neo Robot Motion Lab

[한국어](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [English](README.en.md)

公開KUKA LBR iiwa動作データをインタラクティブな3Dショーケースにする、スタンドアロンの
Machbase Neo JSHアプリです。30人・450シナリオの33,271実測フレーム、3種類のロボット、
生成モーション、関節スライダー、位置IKターゲットを収録しています。実機制御は行いません。

サーバーとCLIはNeo JSH、画面はローカル同梱のThree.jsで動作します。Node.js、npm install、
フロントエンドビルド、外部CDNは不要です。

## 必要条件

- Git、Machbase Neo **8.7.0以降**、実行中のNeo DB
- WebGL対応ブラウザ

## クイックスタート

### 1. Neoの確認とclone

```sh
<NEO_EXECUTABLE> version
git clone https://github.com/machbase/neo-app-kuka-demo.git neo-app-kuka-demo
```

### 2. JSHの起動

実行中のNeo DBのMachbaseポートを確認します。`5656`はデフォルト値なので、実際の
ポートが異なる場合は変更してください。

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656
```

### 3. データ確認とロード

公開CSV 30ファイルはリポジトリに含まれ、別途ダウンロードは不要です。
`verify-data.js`はDBを変更せず、33,271フレーム・450シナリオを確認します。

```text
cd /work/neo-app-kuka-demo
./scripts/verify-data.js
./scripts/schema.js
./scripts/seed.js
```

`schema.js`はフレームDATAとタグMETADATAを持つ単一の`NEO_APP_ROBOT_MOTION`を作成し、
既存データは削除しません。成功時は`ok:true`、`publicFrames:33271`、
`publicScenarios:450`が表示されます。

- 公開CSV 30ファイル：33,271フレーム、450シナリオ、元の間隔で約1時間42分21秒
- 3モデルそれぞれの12秒Axis Showcaseと10秒Pick & Place
- 全フレーム成功後にのみ書き込まれる完了マーカー

TAG入力にはtransaction rollbackがありません。途中で失敗した行は残る場合がありますが、
完了マーカーがないためAPIから選択されません。原因を修正して`seed.js`を再実行します。

### 4. サーバー起動 — JSHセッションA

サーバーはforegroundで動作するため、このセッションを開いたままにします。

```text
cd /work/neo-app-kuka-demo/app
./server.js --host 127.0.0.1 --port 56802
```

### 5. 検証 — 別のOSシェル/JSHセッションB

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  /work/neo-app-kuka-demo/scripts/check.js --url http://127.0.0.1:56802
```

`PASS: 11 robot API checks`を確認します。

### 6. ブラウザ

**http://127.0.0.1:56802/** を開きます。終了はセッションAで`Ctrl+C`です。

## JSH短縮コマンド

プロジェクトroot（`/work/neo-app-kuka-demo`）で実行します。

| コマンド | 用途 |
| --- | --- |
| `pkg run verify-data` | 同梱CSVの非破壊チェック |
| `pkg run schema` | 現行schema作成、既存データ保持 |
| `pkg run seed` | 新しい完了runを追加 |
| `pkg run start` | セッションAでforegroundサーバー起動 |
| `pkg run check` | セッションBでサーバー検証 |

オプションは`pkg run start -- --port 56803`のように`--`の後へ渡します。

## OSシェルから直接サーバー起動

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656 \
  /work/neo-app-kuka-demo/app/server.js --host 127.0.0.1 --port 56802
```

## 信頼できるネットワークからの外部アクセス

```text
cd /work/neo-app-kuka-demo
pkg run start -- --host 0.0.0.0 --port 56802
```

外部では`http://<server-ip>:56802/`を開きます。DBポートを公開しないでください。
Teach書き込みAPIには認証がないため、公開インターネットへ直接公開せず、reverse proxy認証
またはIP制限を使用してください。

DB接続は`NEO_APP_DB_HOST`、`NEO_APP_DB_PORT`、`NEO_APP_DB_USER`、
`NEO_APP_DB_PASSWORD`を使用します。デフォルトは`127.0.0.1`、`5656`、`sys`、
`manager`です。`.env`は自動読込しません。

## デモモード

- **Full playback**：33,271フレームを読み込み、30人分を自動再生します。
  `Skip long idle gaps`を無効にすると元の1時間42分21秒を再現します。明示的に
  Full playbackを選択した場合、現在選択しているロボットモデルを維持します。KR 6と
  iisyでは、元のiiwa関節信号を各モデルの安全なStudio範囲にretargetし、チャートには
  元の値を表示します。
- **Scenario**：User 1–30とScenario 1–15から1件を選びます。各動作は約3.1–15.8秒です。
- **Studio**：3モデルでAxis ShowcaseまたはPick & Placeを再生します。
- **Teach**：ハードウェアを使わず、XYZ IKターゲットまたは関節スライダーで2～8個の
  姿勢を記録します。Previewは姿勢間を10 Hzで補間し、`Save & Replay`は完成した
  シミュレーション動作をMachbaseへ保存します。完了マーカーを持つ動作だけがモデル別の
  Motion memory一覧に表示されます。実機制御や実測動作ではありません。

Teachは`Teachを選択 → ターゲットまたは関節を移動 → Capture Poseを2回以上 → Preview
→ Save & Replay → Motion memoryから再取得`の順で使用します。

モデルはLBR iiwa 7 R800、KR 6 R900-2、LBR iisy 3 R760から選択できます。カメラ、
0.5×–10×速度、シーク、関節操作、XYZ IK、軌跡を提供します。Motion Signatureでは、
時間軸のズームと移動、全体ミニマップ、現在位置の追従、Reset、フレーム値の確認ができます。

## API

| エンドポイント | 内容 |
| --- | --- |
| `GET /api/health` | DBとは独立したサーバー状態 |
| `GET /api/robots` | 3モデルとデータ概要 |
| `GET /api/scenarios` | 450シナリオの一覧 |
| `GET /api/trajectory?mode=full` | 全33,271フレーム |
| `GET /api/trajectory?mode=scenario&user=1&task=1` | 選択シナリオ |
| `GET /api/trajectory?mode=studio&model=kr6-r900-2&motion=showcase` | 生成モーション |
| `GET /api/teach/motions?model=iiwa7-r800` | 保存済みシミュレーション動作一覧 |
| `GET /api/teach/motion?id=<motion-id>` | 完了した観覧者動作の再取得 |
| `POST /api/teach/motions` | 2～8個の関節姿勢を検証・補間して保存 |

応答は`{ok:true,data}` / `{ok:false,error:{code,message}}`です。元CSV、サーバーソース、
認証情報、GitファイルはHTTP公開しません。TAG appender直後にフレームの参照可能化が
完了マーカーより少し遅れる場合、再取得は一時的な`MOTION_NOT_READY`を返し、ブラウザが
短時間だけ再試行します。DBを参照した成功応答には画面SQLパネル用の
`query:{label,sql}`も含まれます。

## SQLチュートリアル：メタデータで絞り込み、フレームを読む

次の読み取り専用SQLはNeo Web UIのSQLエディタまたはNeo SQLシェルで実行できます。

| 領域 | 主なカラム | 意味 |
| --- | --- | --- |
| DATA | `NAME`, `TIME`, `VALUE`, `J2`–`J7`, `PLAYBACK_MS` | 時系列の関節フレーム。`VALUE`はJ1、関節値はradiansです。 |
| METADATA | `TAG_KIND`, `RUN_ID`, `SOURCE_KIND`, `MODEL_ID`, `USER_NO`, `TASK_NO` | DATAを読む前にrun・出典・モデル・シナリオを絞り込みます。 |
| METADATA | `FRAME_COUNT`, `DURATION_MS`, `START_TIME`, `END_TIME` | 期待行数とDATA時間範囲です。 |

### 1. 利用可能なデータを確認

```sql
SELECT TAG_KIND, SOURCE_KIND, MODEL_ID, RUN_ID, SCENARIO_ID,
       USER_NO, TASK_NO, FRAME_COUNT, DURATION_MS
FROM NEO_APP_ROBOT_MOTION METADATA
ORDER BY _LAST_UPDATE_TIME DESC
LIMIT 20;
```

### 2. 最新の完了runで参加者とシナリオを絞り込み

User 1の公開シナリオだけをメタカラムで選択します。

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

### 3. 1シナリオの関節フレームを読む

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

### 4. 全publicフレームからサンプルを読む

`LIMIT 100`を外すと、最新の完了runにある33,271フレームを読みます。

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

### 5. Studio生成モーションを読む

次はKR 6 Axis Showcaseの最初の20フレームです。

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

### 6. Teachモーションをモデルで絞り込み、再取得

```sql
SELECT RUN_ID, MODEL_ID, FRAME_COUNT, DURATION_MS, START_TIME, END_TIME
FROM NEO_APP_ROBOT_MOTION METADATA
WHERE TAG_KIND = 'RUN'
  AND SOURCE_KIND = 'visitor-simulation'
  AND MODEL_ID = 'iiwa7-r800'
ORDER BY _LAST_UPDATE_TIME DESC
LIMIT 20;
```

最新の完了Teachモーションを読みます。

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

基本パターンは`METADATAで候補選択 → 正確なNAMEとTIME範囲でDATA取得`です。アプリは
値をpositional `?`でbindし、画面の**Last executed query**パネルには読みやすい完成SQLを表示します。

## ライセンス

- Dataset for Collaborative Robotics v3、DOI
  [`10.17632/4fr33dkrjt.3`](https://doi.org/10.17632/4fr33dkrjt.3)：CC BY 4.0
- KR 6 / LBR iisyモデル：Apache 2.0
- LBR iiwa 7モデル：MIT
- Three.js r186：MIT

詳細は[Third-party notices](THIRD_PARTY_NOTICES.md)にあります。本アプリはKUKA公式製品ではありません。
