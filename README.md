# Neo Robot Motion Lab

[한국어](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [English](README.en.md)

공개 KUKA LBR iiwa 동작 데이터 전체를 인터랙티브 3차원 쇼케이스로 보여주는 독립형
Machbase Neo JSH 앱입니다. 30명·450개 시나리오의 33,271개 실측 프레임, 세 가지
로봇 모델, 생성 동작, 관절 슬라이더와 위치 기반 IK 목표점을 제공합니다.

서버와 CLI는 Machbase Neo JSH에서 실행하고, 브라우저는 저장소에 포함된 Three.js를
사용합니다. Node.js 런타임, npm 설치, 프런트엔드 빌드, 외부 CDN이 필요 없습니다.
이 앱은 시뮬레이션·시각화 데모이며 실제 로봇을 제어하지 않습니다.

## 요구사항과 기본 주소

- Git, Machbase Neo **8.7.0 이상**, 실행 중인 Neo DB
- WebGL을 지원하는 브라우저

OS 셸에서 `<NEO_EXECUTABLE> version`으로 Neo 제품 버전을 확인합니다.

| 용도 | 기본 주소 |
| --- | --- |
| Neo HTTP / SQL 셸 | `http://127.0.0.1:5654` |
| Machbase DB | `127.0.0.1:5656` |
| Robot Motion Lab | `http://127.0.0.1:56802` |

## 빠른 시작

OS 셸에서 저장소를 받은 뒤 프로젝트를 명시적으로 마운트해 JSH를 시작합니다.

```sh
git clone <REPOSITORY_URL> neo-app-starter
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-starter=/absolute/path/to/neo-app-starter \
  -e NEO_APP_DB_PORT=5656
```

JSH에서 스키마와 전체 데이터를 준비합니다.

```text
cd /work/neo-app-starter
./scripts/schema.js
./scripts/seed.js
```

`schema.js`는 `NEO_APP_ROBOT_MOTION`, `NEO_APP_ROBOT_RUN` TAG 테이블을 만들며 기존
테이블과 데이터를 삭제하거나 변경하지 않습니다. 기존 `NEO_APP_SAMPLE`도 유지합니다.

`seed.js`는 실행할 때마다 다음을 새 실행으로 추가합니다.

- 공개 CSV 30개 전체: 33,271프레임, 450개 시나리오, 원래 간격 기준 약 1시간 42분 21초
- 세 모델의 12초 Axis Showcase와 10초 Pick & Place 생성 동작
- 모든 행이 성공한 뒤에만 기록되는 완료 마커

TAG 입력은 transaction rollback을 지원하지 않습니다. 실패한 실행은 일부 행이 남을 수
있지만 완료 마커가 없어 API가 선택하지 않습니다. 스크립트는 실행 ID와 실패 전 입력
행 수를 출력합니다.

서버를 foreground로 실행합니다.

```text
cd /work/neo-app-starter/app
./server.js --host 127.0.0.1 --port 56802
```

브라우저에서 **http://127.0.0.1:56802/** 를 엽니다. 종료는 JSH에서 `Ctrl+C`입니다.

`package.json` 단축 명령은 JSH의 `pkg run`용입니다.

```text
cd /work/neo-app-starter
pkg run schema
pkg run seed
pkg run download-lerobot
pkg run import-lerobot
pkg run start
pkg run check
```

서버 옵션은 `pkg run start -- --port 56803`처럼 `--` 뒤에 둡니다. 검증한 Neo 8.7.0
빌드는 구분자가 없으면 `--port`를 `pkg` 옵션으로 처리해 거부합니다.

OS 셸에서 바로 실행할 수도 있습니다.

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-starter=/absolute/path/to/neo-app-starter \
  -e NEO_APP_DB_PORT=5656 \
  /work/neo-app-starter/app/server.js --host 127.0.0.1 --port 56802
```

DB 설정은 JSH 환경의 `NEO_APP_DB_HOST`, `NEO_APP_DB_PORT`, `NEO_APP_DB_USER`,
`NEO_APP_DB_PASSWORD`를 읽습니다. 기본값은 `127.0.0.1`, `5656`, `sys`, `manager`이며
`.env` 파일은 자동으로 읽지 않습니다.

## 대용량 데이터 적재

LeRobot의 compact 상태·동작 Parquet는 기본 저장소에 포함하지 않으며 Hugging Face에서
한 번 내려받습니다.
31.98GiB RLDS 전체판과 LeRobot 영상은 사용하지 않습니다.

### 1. 스키마 생성

JSH에서 프로젝트 루트로 이동한 뒤 실행합니다.

```text
cd /work/neo-app-starter
./scripts/schema.js
```

이 명령은 `NEO_APP_ROBOT_MOTION`, `NEO_APP_ROBOT_RUN`, `NEO_APP_LEROBOT_MOTION`을
생성합니다. `IF NOT EXISTS` 방식이라 기존 행을 삭제하지 않습니다.

### 2. LeRobot 상태·동작 적재

먼저 8,849,485바이트 Parquet 한 파일을 받습니다. 여기에는 20Hz로 기록된 149,985개
프레임과 3,000개 episode가 모두 들어 있습니다.

```text
./scripts/download-lerobot.js
```

기본 저장 위치는 `/work/neo-app-starter/data/lerobot/stanford-kuka-state.parquet`이며 Git에
포함되지 않습니다. 다른 마운트에 저장하려면 다운로드에는 `--dir`, import에는 `--file`을
사용합니다. 먼저 DB 연결과 파싱을 확인할 때는 2행만 적재합니다.

```text
./scripts/import-lerobot.js --limit 2
```

전체 LeRobot 변환판을 적재하려면 다음을 실행합니다.

```text
./scripts/import-lerobot.js
```

전체 149,985행을 성공한 경우에만 완료 마커가 저장됩니다. `--limit` 또는 실패 실행은
부분 행을 남기지만 플레이에는 사용되지 않습니다. `observation.state`는 관절각이 아니라
`[x, y, z, qx, qy, qz, qw]` 말단장치 pose이며, `action`은
`[dx, dy, dz, drx, dry, drz, gripper]`입니다. 화면은 XYZ를 IK로 재구성합니다. 원본에는
실제 관절각이 없으므로 재구성된 로봇 자세는 가능한 한 가지 해입니다. RLDS 31.98GiB,
영상, Depth, Optical Flow는 다운로드하지 않습니다.

## 데모 모드

- **Full playback**: 공개 프레임 전체를 불러와 사용자 1–30을 자동 재생합니다. 원래
  사용자별 타임스탬프와 시나리오 간격을 보존합니다. `Skip long idle gaps`를 켜면
  시나리오 사이 대기만 줄이고, 끄면 전체 1시간 42분 21초 타임라인이 됩니다.
- **Scenario**: 사용자 1–30과 시나리오 1–15를 선택합니다. 개별 동작은 약 3.1–15.8초입니다.
- **Studio**: 12초 Axis Showcase와 10초 Pick & Place를 재생합니다. KR 6 또는 iisy를
  선택하면 Studio로 자동 전환합니다.
- **LeRobot**: Episode를 선택하거나 149,985개 Cartesian pose 전체를 재생합니다. XYZ 경로를
  IK로 재구성하며, `Load all`을 눌러야 전체 상태가 브라우저로 전송됩니다.

카메라 회전·확대, 0.5×–10× 속도, 타임라인 탐색, 관절 슬라이더, XYZ IK 목표점,
말단 궤적과 관절 차트를 지원합니다. 브라우저가 reduced motion을 요청하면 자동 재생하지 않습니다.

## API

| 엔드포인트 | 용도 |
| --- | --- |
| `GET /api/health` | DB와 분리된 서버 상태 |
| `GET /api/robots` | 세 모델과 전체 데이터 요약 |
| `GET /api/scenarios` | 450개 시나리오 메타데이터 |
| `GET /api/trajectory?mode=full` | 실측 33,271프레임 전체 |
| `GET /api/trajectory?mode=scenario&user=1&task=1` | 선택한 실측 시나리오 |
| `GET /api/trajectory?mode=studio&model=kr6-r900-2&motion=showcase` | 생성 동작 |
| `GET /api/datasets` | 기본·LeRobot 적재 여부 |
| `GET /api/lerobot/episodes` | LeRobot 3,000개 에피소드 |
| `GET /api/lerobot/trajectory?episode=0` | LeRobot 한 에피소드 |

응답은 `{ok:true,data}` / `{ok:false,error:{code,message}}` 형식입니다. 모델·모드·사용자·
시나리오·동작을 DB 작업 전에 검증합니다. 원본 CSV, 서버 소스, 자격정보, Git 파일은
HTTP로 제공하지 않습니다.

## 검증

서버와 다른 JSH 프로세스에서 실행합니다.

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-starter=/absolute/path/to/neo-app-starter \
  /work/neo-app-starter/scripts/check.js --url http://127.0.0.1:56802
```

검사는 앱·모델·450개 시나리오, 실제 시나리오, 생성 동작, 전체 프레임과 순서·관절 수,
출처, 잘못된 입력의 실패를 확인합니다. 자세한 내용은 [검증 기록](doc/validation.md),
[호환성 정책](doc/compatibility.md), [외부 자료 고지](THIRD_PARTY_NOTICES.md)를 참고하세요.

## 데이터와 모델 라이선스

- *Dataset for Collaborative Robotics* v3, DOI
  [`10.17632/4fr33dkrjt.3`](https://doi.org/10.17632/4fr33dkrjt.3): CC BY 4.0
- KR 6 R900-2, LBR iisy 3 R760: `kroshu/kuka_robot_descriptions`, Apache 2.0
- LBR iiwa 7 R800: `facebookresearch/differentiable-robot-model`, MIT
- Three.js r186: MIT

KUKA 이름은 모델 식별에만 사용하며 이 저장소는 KUKA 공식 제품이 아닙니다.
