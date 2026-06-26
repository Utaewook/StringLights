# CLAUDE.md

이 파일은 AI 에이전트(Claude Code, Antigravity 등)가 본 저장소에서 작업할 때 참고하는 **트리거 라우터이자 통합 규칙 문서**입니다.
이 문서는 에이전트 시작 시 자동으로 로드되며, 아키텍처 및 개념은 `docs/*.md`로 위임하고, 절차 및 규칙의 단일 출처(SoT)를 제공합니다.

---

## 1. 런타임 및 개발 환경

- **Backend (`apps/backend`):** Python 3.12+ (FastAPI).
  - 의존성: `requirements.txt` (`pip install -r requirements.txt`).
  - 실행: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- **Frontend (`apps/web-app`):** Node 20+ (React, TS, Vite).
  - 의존성: `package.json` (`npm install`).
  - 실행: `npm run dev` (기본 포트 `5173` 또는 `3000`).
- **Production (`build`):** Docker & Nginx.
  - 빌드/실행: `/build` 디렉토리 내 `docker-compose.yml` 및 `Dockerfile` 기반 작동.

---

## 2. 트리거 라우팅 (Trigger Routing)

> 아래 경로/파일을 수정할 때는 **시작 전 지정된 문서를 먼저 읽고** 아키텍처 계약을 확인하세요.

| 건드리는 대상 (경로/파일) | 먼저 읽을 문서 | 비고 / 핵심 제약 조건 |
| --- | --- | --- |
| `apps/backend/app/services/**` (그래프 수정) | `docs/03_architecture.md` | **서버 내 ONNX 추론 절대 금지**, Graph Surgery 시 `Semaphore(1)` 적용 |
| `apps/backend/app/main.py` (API 진입점) | `docs/01_project_overview.md` | **50MB 업로드 제한** 필수 적용 (초과 시 400 Bad Request 즉시 리턴) |
| `apps/web-app/src/contexts/WorkerContext.tsx` | `docs/03_architecture.md` | Web Worker 내 `InferenceSession` 구동, 메모리 해제(`release()`) 처리 |
| `apps/web-app/src/**` (프론트엔드 UI 수정) | `docs/01_project_overview.md` | WebGPU 미지원 시 WASM 자동 폴백 및 UI 배지 노출 ("WASM 모드 동작 중 - 성능 저하 가능") |
| `build/**` (도커 및 Nginx 환경 설정) | `docs/03_architecture.md` | Nginx 리버스 프록시 및 컨테이너별 메모리 하드 리밋(Limits) 준수 |
| Git 브랜치, 태그, 커밋 작성 시 | `docs/04_convention.md` | Conventional Commits 포맷 및 브랜치 전략 준수 |

---

## 3. 세션 시작 3단계 체크리스트 (Session Start Checklist)

작업 세션을 시작할 때 다음 단계를 차례대로 수행하세요.

### 1단계: Git 상태 확인 및 동기화 (on `develop` branch)
1. 반드시 `develop` 브랜치에 위치해 있는지 확인하고 원격과 동기화합니다.
   ```bash
   git status
   git pull origin develop
   ```
2. 최근 3-5개의 커밋 내역을 확인하여 이전 진행 상황을 파악합니다.
   ```bash
   git log -n 5 --oneline
   ```
3. 작업 폴더에 임시 파일이나 이전 빌드 잔재가 없는지 확인합니다.

### 2단계: 로컬 개발 환경 점검
1. 백엔드 가상환경(`venv`) 활성화 및 포트 `8000` 점검.
2. 프론트엔드 `npm install` 상태 및 포트 `5173` / `3000` 점검.

### 3단계: 코어 제약사항 셀프 체크
- [ ] **No Backend Inference:** 백엔드에서는 절대 `onnxruntime`을 임포트하거나 실행하지 않습니다. 오직 `onnx` 그래프 조작만 수행합니다.
- [ ] **Strict Queueing:** Graph Surgery API 엔드포인트에는 `asyncio.Semaphore(1)`을 적용하여 동시 실행을 제한합니다.
- [ ] **50MB Upload Limit:** 백엔드 업로드 용량은 엄격히 50MB로 제한합니다.
- [ ] **Resource Cleanup:** 업로드 및 Graph Surgery 처리 후 생성된 모든 디스크/메모리 상의 임시 파일은 `finally` 블록에서 즉시 완전히 삭제합니다.
- [ ] **Frontend Memory Management:** 새 모델 로드 전에 기존 `InferenceSession`의 `release()`를 반드시 호출하고 미사용 텐서를 명시적으로 해제합니다.
- [ ] **WebGPU Fallback Badge:** WebGPU 로드 실패 시 WASM 모드 배지를 화면에 즉시 노출합니다.

---

## 4. 세션 종료 체크리스트 (Session End Checklist)

1. **Clean Workspace:** 임시 파일(예: `temp_in_*`, `temp_out_*`)이 로컬 저장소에 남아있지 않도록 제거합니다.
2. **Branch Check:** 모든 커밋은 `develop` 브랜치에 수행해야 합니다. `main` 브랜치로의 직접적인 커밋은 **엄격히 금지**됩니다.
3. **Commit Message:** Conventional Commits 규격을 엄격히 준수합니다 (자세히: `docs/04_convention.md`).

---

## 5. 에이전트 전용 행동 강령 (AI Assistant Specific Rules)

- **Thinking Language:** 모든 사고 과정(Reasoning/Thinking)은 **영어(English)**로 수행합니다.
- **Response Language:** 사용자에게 답할 때는 오직 **한국어(Korean)**로 정중하고 구조화된 어조를 사용합니다.
- **Active Grilling:** 설계나 요건이 모호한 작업을 수행하기 전에 반드시 **/grill-me** (또는 `grill-me` 스킬) 실행을 제안하고 설계를 검증받습니다.
- **Style Reference:** UI 컴포넌트를 설계할 때는 항상 **`legacy-v1`** 브랜치의 스타일과 레이아웃을 확인하고 일관되게 작성합니다.
- **No Unauthorized Installs:** 허가 없이 임의로 외부 라이브러리나 패키지를 설치하지 마세요. (사용자 사전 승인 필수)
- **Atomic Commits:** 기능 단위, 버그 수정, 리팩토링은 절대 묶어서 커밋하지 않고 동작 가능한 단위로 잘게 쪼개어 개별 커밋합니다.
- **Git History Honesty:** 실수로 커밋을 묶어 올렸거나 에러를 냈다면, 이를 덮기 위해 강제 푸시(`git push -f`)나 히스토리 수정(`git reset`)을 독단적으로 수행하지 않고 에러 상태를 사용자에게 투명하게 설명한 뒤 복구 허락을 받습니다.

---

## 6. 언제 `/grill-me`를 사용해야 하는가?

- 신규 서브시스템 혹은 주요 컴포넌트를 처음으로 설계할 때.
- 요구사항의 범위가 모호할 때 (예: 특정 오류 코드 발생 시의 예외 처리 범위 등).
- 상반된 아키텍처적 트레이드오프가 있는 여러 구현안이 대치할 때.
- 백엔드 Graph Surgery의 API 규격이나 통신 계약을 변경해야 할 때.
