# String Lights

String Ligths는 Onnx등 딥러닝/머신러닝 모델의 추론 과정을 시각적으로 추적하고 애니메이션으로 재생할 수 있는 웹 기반 플랫폼입니다.

---

## 핵심 기능

### 모델 구조 탐색
- Onnx 모델 업로드
- 모델의 노드/연산 그래프 시각화
- 입출력 텐서 스펙(shape, dtype) 확인

### 추론 과정 재생
- 실제 추론 기반 실행 순서 재생
- 노드/연산 하이라이트(점등 효과)
- 실쟁 중 주요 텐서 shape/dtype 요약 통계 변화 모니터링

### 타임라인 제어
- 재생 / 정지
- 배속 (0.25x ~ 4.0x)
- 시간 이동(슬라이드)
- 역행 (리플레이)

### 입력 데이터 처리
- 모델 스펙 기반 입력 텐서 생성
- 모델 스펙 기반 텐서 사용자 입력 UI
    - 입력 예시 데이터 업로드 (npz, pkl 등)
    - 입력 예시 데이터 텐서 입력 (UI를 통한)

---

## 프로젝트 목표
- 저비용 / 빠른 데모 구현
- 로컬 PC 혹은 랩탑에서 Docker 기반 전체 시스템 실해 

---

## 프로젝트 개발
### 컨테이너 구성
1. Frontend: 웹 UI, 그래프 탐색, 애니메이션/타임라인 재생, 사용자 입출력
2. Backend: 데이터 업/다운로드, 메타 관리, run 생성, ws/worker 중계 및 관리
3. Model Run worker: 추론 실행 및 트레이스 생성
4. DataBase: 모델/run 메타데이터 저장

### 프로젝트 디렉토리 구조
```
├── backend
│   └── DockerFile
├── db
│   └── DockerFile
├── frontend
│   └── DockerFile
├── logs
│   ├── backend
│   ├── db
│   ├── frontend
│   └── worker
├── worker
│   └── DockerFile
├── docker-compose.yml
└── README.md
```

--- 

## 로컬 데모 실행

```bash
# 데모 개발이 완료될 경우 해당 내용 추가
```