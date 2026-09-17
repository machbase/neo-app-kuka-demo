# Neo Robot Motion Lab

[한국어](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [English](README.en.md)

公開KUKA LBR iiwa動作データをインタラクティブな3Dショーケースにする、スタンドアロンの
Machbase Neo JSHアプリです。30人・450シナリオの33,271実測フレーム、3種類のロボット、
生成モーション、関節スライダー、位置IKターゲットを収録しています。実機制御は行いません。

サーバーとCLIはNeo JSH、画面はローカル同梱のThree.jsで動作します。Node.js、npm install、
フロントエンドビルド、外部CDNは不要です。Machbase Neo **8.7.0以降**が必要です。

## クイックスタート

OSシェルでJSHを起動します。

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656
```

JSHでスキーマと全データを準備します。

```text
cd /work/neo-app-kuka-demo
./scripts/schema.js
./scripts/seed.js
```

`schema.js`は`NEO_APP_ROBOT_MOTION`と`NEO_APP_ROBOT_RUN`を作成し、既存テーブルを
削除しません。`seed.js`は実行ごとに以下の新しい完了runを追加します。

- 公開CSV 30ファイル：33,271フレーム、450シナリオ、元の間隔で約1時間42分21秒
- 3モデルそれぞれの12秒Axis Showcaseと10秒Pick & Place
- 全フレーム成功後にのみ書き込まれる完了マーカー

TAG入力にはtransaction rollbackがありません。途中で失敗した行は残る場合がありますが、
完了マーカーがないためAPIから選択されません。

```text
cd /work/neo-app-kuka-demo/app
./server.js --host 127.0.0.1 --port 56802
```

**http://127.0.0.1:56802/** を開きます。終了はJSHで`Ctrl+C`です。

JSHの短縮コマンドも利用できます。

```text
cd /work/neo-app-kuka-demo
pkg run schema
pkg run seed
pkg run download-lerobot
pkg run import-lerobot
pkg run start
pkg run check
```

オプションは`pkg run start -- --port 56803`のように`--`の後へ渡します。

DB接続は`NEO_APP_DB_HOST`、`NEO_APP_DB_PORT`、`NEO_APP_DB_USER`、
`NEO_APP_DB_PASSWORD`を使用します。デフォルトは`127.0.0.1`、`5656`、`sys`、
`manager`です。`.env`は自動読込しません。

## 大容量データの読み込み

31.98GiBのRLDS全版とLeRobotの動画は使用しません。8,849,485バイトのcompact
state/action ParquetだけをHugging Faceから一度ダウンロードします。

```text
cd /work/neo-app-kuka-demo
./scripts/schema.js
./scripts/download-lerobot.js
./scripts/import-lerobot.js --limit 2
./scripts/import-lerobot.js
```

Parquetには20Hzの149,985フレーム、3,000 episodeがすべて含まれます。既定の保存先は
`data/lerobot/stanford-kuka-state.parquet`です。全行が成功した場合だけ完了マーカーを
書き込みます。`observation.state`は関節角ではなく
`[x, y, z, qx, qy, qz, qw]`のエンドエフェクタposeです。画面はXYZからIKで一つの姿勢を
再構成します。実測関節角は元データに含まれません。

## デモモード

- **Full playback**：33,271フレームを読み込み、30人分を自動再生します。
  `Skip long idle gaps`を無効にすると元の1時間42分21秒を再現します。
- **Scenario**：User 1–30とScenario 1–15から1件を選びます。各動作は約3.1–15.8秒です。
- **Studio**：3モデルでAxis ShowcaseまたはPick & Placeを再生します。
- **LeRobot**：Episodeを選択するか、明示的に149,985フレームを読み込みます。

モデルはLBR iiwa 7 R800、KR 6 R900-2、LBR iisy 3 R760から選択できます。カメラ、
0.5×–10×速度、シーク、関節操作、XYZ IK、軌跡、同期関節チャートを提供します。

## API

| エンドポイント | 内容 |
| --- | --- |
| `GET /api/health` | DBとは独立したサーバー状態 |
| `GET /api/robots` | 3モデルとデータ概要 |
| `GET /api/scenarios` | 450シナリオの一覧 |
| `GET /api/trajectory?mode=full` | 全33,271フレーム |
| `GET /api/trajectory?mode=scenario&user=1&task=1` | 選択シナリオ |
| `GET /api/trajectory?mode=studio&model=kr6-r900-2&motion=showcase` | 生成モーション |
| `GET /api/datasets` | 各データセットの読み込み状態 |
| `GET /api/lerobot/episodes` | LeRobotエピソード一覧 |
| `GET /api/lerobot/trajectory?episode=0` | LeRobotの1エピソード |

応答は`{ok:true,data}` / `{ok:false,error:{code,message}}`です。元CSV、サーバーソース、
認証情報、GitファイルはHTTP公開しません。

検証方法と履歴は[English README](README.en.md)、[検証記録](doc/validation.md)、
[互換性ポリシー](doc/compatibility.md)を参照してください。

## ライセンス

- Dataset for Collaborative Robotics v3、DOI
  [`10.17632/4fr33dkrjt.3`](https://doi.org/10.17632/4fr33dkrjt.3)：CC BY 4.0
- KR 6 / LBR iisyモデル：Apache 2.0
- LBR iiwa 7モデル：MIT
- Three.js r186：MIT

詳細は[Third-party notices](THIRD_PARTY_NOTICES.md)にあります。本アプリはKUKA公式製品ではありません。
