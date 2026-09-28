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

### 1. 저장소와 Neo 확인

```sh
<NEO_EXECUTABLE> version
git clone https://github.com/machbase/neo-app-kuka-demo.git neo-app-kuka-demo
```

### 2. JSH 시작

실행 중인 Neo DB의 실제 Machbase 포트를 확인하고 프로젝트를 명시적으로 마운트합니다.
아래 `5656`은 기본값이므로 설치 환경과 다르면 바꿉니다.

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656
```

### 3. 데이터 확인과 적재

JSH에서 다음을 실행합니다. 공개 CSV 30개는 저장소에 포함되어 있어 별도 다운로드가
필요 없습니다. `verify-data.js`는 DB를 변경하지 않고 33,271프레임·450시나리오를 확인합니다.

```text
cd /work/neo-app-kuka-demo
./scripts/verify-data.js
./scripts/schema.js
./scripts/seed.js
```

`schema.js`는 프레임 DATA와 태그 METADATA를 함께 관리하는 단일
`NEO_APP_ROBOT_MOTION` TAG 테이블을 만들며 기존 데이터를 삭제하지 않습니다.

`seed.js`는 실행할 때마다 다음을 새 실행으로 추가합니다.

- 공개 CSV 30개 전체: 33,271프레임, 450개 시나리오, 원래 간격 기준 약 1시간 42분 21초
- 세 모델의 12초 Axis Showcase와 10초 Pick & Place 생성 동작
- 모든 행이 성공한 뒤에만 기록되는 완료 마커

TAG 입력은 transaction rollback을 지원하지 않습니다. 실패한 실행은 일부 행이 남을 수
있지만 완료 마커가 없어 API가 선택하지 않습니다. 스크립트는 실행 ID와 실패 전 입력
행 수를 출력합니다.

성공하면 `ok:true`, 실행 ID, `publicFrames:33271`, `publicScenarios:450`이 출력됩니다.
실패한 실행은 완료 마커가 없으므로 노출되지 않습니다. 원인을 고친 뒤 `seed.js`를 다시
실행하면 새 실행으로 적재됩니다.

### 4. 서버 실행 — JSH 세션 A

서버는 foreground로 실행되므로 이 세션을 열어 둡니다.

```text
cd /work/neo-app-kuka-demo/app
./server.js --host 127.0.0.1 --port 56802
```

### 5. 검증 — 별도 OS 셸/JSH 세션 B

서버가 실행 중인 상태에서 별도 OS 셸에서 실행합니다.

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  /work/neo-app-kuka-demo/scripts/check.js --url http://127.0.0.1:56802
```

`PASS: 11 robot API checks`를 확인합니다.

### 6. 브라우저 열기

브라우저에서 **http://127.0.0.1:56802/** 를 엽니다. 서버 종료는 세션 A에서 `Ctrl+C`입니다.

## JSH 단축 명령

프로젝트 root(`/work/neo-app-kuka-demo`)에서 JSH의 `pkg run`으로 실행합니다.

| 명령 | 용도 |
| --- | --- |
| `pkg run verify-data` | 포함된 CSV를 비파괴 검사 |
| `pkg run schema` | 현재 스키마 생성, 기존 데이터 보존 |
| `pkg run seed` | 새 완료 실행 적재 |
| `pkg run start` | foreground 서버 실행 — 세션 A |
| `pkg run check` | 실행 중인 서버 검사 — 세션 B |
| `pkg run migrate-tag-metadata -- --confirm` | **기존 2테이블 업그레이드 전용, 앱 데이터 삭제** |

서버 옵션은 `pkg run start -- --port 56803`처럼 `--` 뒤에 둡니다. 검증한 Neo 8.7.0
빌드는 구분자가 없으면 `--port`를 `pkg` 옵션으로 처리해 거부합니다.

## 기존 2테이블 스키마 업그레이드

fresh checkout에서는 실행하지 않습니다. 이전 스키마를 사용 중일 때만 서버를 멈추고
아래 명령을 한 번 실행합니다. 이 앱의 `NEO_APP_ROBOT_MOTION`, `NEO_APP_ROBOT_RUN`, 과거
`NEO_APP_LEROBOT_MOTION`을 영구 삭제한 뒤 현재 단일 테이블을 만들고 데이터를 다시 적재합니다.

```text
cd /work/neo-app-kuka-demo
./scripts/migrate-tag-metadata.js --confirm
./scripts/seed.js
```

## OS 셸에서 서버 직접 실행

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656 \
  /work/neo-app-kuka-demo/app/server.js --host 127.0.0.1 --port 56802
```

## 신뢰할 수 있는 네트워크에서 외부 접속

```text
cd /work/neo-app-kuka-demo
pkg run start -- --host 0.0.0.0 --port 56802
```

외부 브라우저에서는 `http://<서버-IP>:56802/`를 사용합니다. 방화벽에는 앱 포트만
허용하고 Machbase DB 포트는 공개하지 마십시오. Teach 쓰기 API에는 인증이 없으므로
공용 인터넷에 직접 노출하지 말고 reverse proxy 인증이나 IP 제한을 적용합니다.

DB 설정은 JSH 환경의 `NEO_APP_DB_HOST`, `NEO_APP_DB_PORT`, `NEO_APP_DB_USER`,
`NEO_APP_DB_PASSWORD`를 읽습니다. 기본값은 `127.0.0.1`, `5656`, `sys`, `manager`이며
`.env` 파일은 자동으로 읽지 않습니다.

## 데모 모드

- **Full playback**: 공개 프레임 전체를 불러와 사용자 1–30을 자동 재생합니다. 원래
  사용자별 타임스탬프와 시나리오 간격을 보존합니다. `Skip long idle gaps`를 켜면
  시나리오 사이 대기만 줄이고, 끄면 전체 1시간 42분 21초 타임라인이 됩니다. 명시적으로
  Full playback을 선택하면 현재 선택한 로봇 모델을 유지합니다. KR 6과 iisy에서는 원본
  iiwa 관절 신호를 각 모델의 안전한 Studio 관절 범위로 retarget하며 차트는 원본값을 표시합니다.
- **Scenario**: 사용자 1–30과 시나리오 1–15를 선택합니다. 개별 동작은 약 3.1–15.8초입니다.
- **Studio**: 12초 Axis Showcase와 10초 Pick & Place를 재생합니다. KR 6 또는 iisy를
  선택하면 Studio로 자동 전환합니다.
- **Teach**: 하드웨어 없이 XYZ IK 목표점이나 관절 슬라이더로 2–8개 자세를 캡처합니다.
  Preview는 자세 사이를 10 Hz로 부드럽게 보간하고, `Save & Replay`는 완성된 시뮬레이션
  동작을 Machbase에 저장합니다. 완료 마커가 기록된 동작만 모델별 Motion memory 목록에
  나타나며 다시 불러올 수 있습니다. 실제 로봇을 제어하거나 실측한 동작이 아닙니다.

Teach는 `Teach 선택 → 목표점 또는 관절 이동 → Capture Pose 2회 이상 → Preview →
Save & Replay → Motion memory에서 재조회` 순서로 사용합니다.

카메라 회전·확대, 0.5×–10× 속도, 타임라인 탐색, 관절 슬라이더, XYZ IK 목표점과
말단 궤적을 지원합니다. Motion Signature는 시간축 확대·이동, 전체 미니맵, 현재 위치 추적,
Reset과 프레임별 상세값 조회를 제공합니다. 브라우저가 reduced motion을 요청하면 자동 재생하지 않습니다.

## API

| 엔드포인트 | 용도 |
| --- | --- |
| `GET /api/health` | DB와 분리된 서버 상태 |
| `GET /api/robots` | 세 모델과 전체 데이터 요약 |
| `GET /api/scenarios` | 450개 시나리오 메타데이터 |
| `GET /api/trajectory?mode=full` | 실측 33,271프레임 전체 |
| `GET /api/trajectory?mode=scenario&user=1&task=1` | 선택한 실측 시나리오 |
| `GET /api/trajectory?mode=studio&model=kr6-r900-2&motion=showcase` | 생성 동작 |
| `GET /api/teach/motions?model=iiwa7-r800` | 저장된 관람객 시뮬레이션 동작 목록 |
| `GET /api/teach/motion?id=<motion-id>` | 완료된 관람객 동작 재조회 |
| `POST /api/teach/motions` | 2–8개 관절 자세를 검증·보간해 새 동작으로 저장 |

응답은 `{ok:true,data}` / `{ok:false,error:{code,message}}` 형식입니다. 모델·모드·사용자·
시나리오·동작을 DB 작업 전에 검증합니다. 원본 CSV, 서버 소스, 자격정보, Git 파일은
HTTP로 제공하지 않습니다. TAG appender 직후 완료 마커보다 프레임 조회 가시성이 잠깐
늦을 수 있으며, 이때 동작 재조회는 일시적인 `MOTION_NOT_READY`를 반환하고 브라우저는
짧게 재시도합니다.

## 검증 범위

`check.js`는 앱·모델·450개 시나리오, 실제 시나리오, 생성 동작, 전체 프레임과 순서·관절 수,
출처, 잘못된 재생·Teach 입력의 실패를 확인합니다. 검사 자체는 관람객 동작을 저장하지
않습니다. 자세한 내용은 [검증 기록](doc/validation.md),
[호환성 정책](doc/compatibility.md), [외부 자료 고지](THIRD_PARTY_NOTICES.md)를 참고하세요.

## 데이터와 모델 라이선스

- *Dataset for Collaborative Robotics* v3, DOI
  [`10.17632/4fr33dkrjt.3`](https://doi.org/10.17632/4fr33dkrjt.3): CC BY 4.0
- KR 6 R900-2, LBR iisy 3 R760: `kroshu/kuka_robot_descriptions`, Apache 2.0
- LBR iiwa 7 R800: `facebookresearch/differentiable-robot-model`, MIT
- Three.js r186: MIT

KUKA 이름은 모델 식별에만 사용하며 이 저장소는 KUKA 공식 제품이 아닙니다.
