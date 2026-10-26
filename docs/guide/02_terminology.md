# Terminology

This document defines the core terms of this project.
Use each term with the meaning that this document gives.

- ASD-STE100 permits these terms as technical names. See section 2.1 of [06_writing_standard.md](./06_writing_standard.md).
- Do not use the words in the "Do not use" column for the same thing.
- In replies to the user, use the term in the "Korean term" column. This applies rule K7 of the writing standard.

---

## Graph Surgery

Graph Surgery changes an ONNX model so that its intermediate tensors are also graph outputs.
Then one inference run returns all of these tensors.

- The surgery promotes all intermediate tensors in one pass. The user does not select nodes. See [ADR 0001](../decisions/0001-promote-all-intermediate-outputs.md).
- Shape inference runs before the promotion. The surgery promotes only the tensors that get a complete type from shape inference.
- The metadata lists each tensor that the surgery cannot promote in `unpromotableOutputNames`.
- The surgery does not promote the tensors inside a subgraph (`If`, `Loop`, or `Scan`). A subgraph runs only on a condition, so its tensors are not in the main graph.

**Constraints:**

- Only the backend (`apps/backend`) does Graph Surgery. It uses the `onnx` library.
- The surgery runs in a child process, with a timeout of 90 seconds.
- For the coding rules, see [04_convention.md](./04_convention.md).

## Web Inference

Web Inference runs the ONNX model in the browser of the user, with `onnxruntime-web`.
The server does not run inference. Thus, the small memory of the server stays free for Graph Surgery.

- The `InferenceSession` runs in a Web Worker. Thus, a large model does not stop the UI.
- For the data flow, see [03_architecture.md](./03_architecture.md).

## WebGPU fallback and the WASM Mode badge

The worker tries WebGPU first.
If the worker cannot create a WebGPU session, it creates a WASM (WebAssembly) session. A WASM session runs on the CPU.

When the session uses WASM, the UI shows the badge `WASM Mode — Performance May Be Degraded`.
The badge tells the user that inference can be slow.

---

## Term list

### Model and graph

| Term | Meaning | Do not use | Korean term |
| --- | --- | --- | --- |
| ONNX model | The `.onnx` file that the user uploads. | | ONNX 모델 |
| Node | One operator in the graph of the model, for example `Conv`. | | 노드 |
| Intermediate tensor | A tensor that a node produces. It is not a graph output of the original model. | activation, intermediate node, intermediate output | 중간 텐서 |
| Graph output | A tensor that a run of the model returns. | | 그래프 출력 |
| Promote | To add an intermediate tensor to the graph outputs. Graph Surgery does this. | expose, re-export | 승격하다 |
| Shape inference | The `onnx` step that calculates the dtype and the shape of each tensor (`onnx.shape_inference.infer_shapes`). | | 형태 추론 |
| Opset | The version of the ONNX operator set that the model uses. | | opset(연산자 집합 버전) |
| External data | The weight files beside the `.onnx` file. The user uploads them with the model. | | 외부 데이터 파일 |
| Subgraph | A graph inside an `If`, `Loop`, or `Scan` node. | | 서브그래프 |
| dtype | The element type of a tensor, for example `float32` or `int64`. | data type | dtype(원소 자료형) |
| Dynamic axis | An axis that has no fixed length in the model. | | 동적 축 |
| Batch size | The length that the app gives to the first axis of each input, if that axis is dynamic. The app gives 1 to the other dynamic axes. | | 배치 크기 |

### Backend

In this project, the word "backend" means the server only.

| Term | Meaning | Do not use | Korean term |
| --- | --- | --- | --- |
| Graph Surgery | See the section above. "Surgery" is the short form. | | 그래프 수술 |
| Metadata | The `meta.json` file that the backend returns with the changed model. It lists the inputs, the outputs, the nodes, and the tensors that the surgery cannot promote. | | 메타데이터 |
| Child process | The process that runs Graph Surgery (`run_surgery_isolated`). | | 자식 프로세스 |
| Temporary directory | The directory `apps/backend/temp/<uuid>/` of one request. | temp dir, workspace | 임시 디렉터리 |
| Upload limit | The limit of 50MB on the uploaded ZIP file. | upload cap, size cap | 업로드 제한 |
| Request limit | The limit of 55MB on the full HTTP request (`MAX_REQUEST_BYTES`). | | 요청 크기 제한 |
| Extraction limit | The limits on the extracted files: 150MB for all files, and 80MB for the model. | | 압축 해제 제한 |
| OOM | Out of memory. The kernel stops a container that uses more memory than its limit. | | 메모리 부족(OOM) |

### Frontend

| Term | Meaning | Do not use | Korean term |
| --- | --- | --- | --- |
| Web Inference | See the section above. | | 웹 추론 |
| Worker | The Web Worker in `src/ort-worker.ts`. It runs the session. | | 워커 |
| Session | The `InferenceSession` of `onnxruntime-web`. | Ort session | 추론 세션 |
| Execution provider | The runtime that runs the session: `webgpu` or `wasm`. | engine, backend | 실행 공급자 |
| WASM Mode badge | See the section above. | | WASM 모드 배지 |
| Synthetic input | An input tensor that the app makes from zeros or from random values. | | 합성 입력 |
| Tensor statistics | The minimum, maximum, mean, and standard deviation of a tensor, with a flag for `NaN` and a flag for `Inf` (`TensorStats`). | stats | 텐서 통계 |
| Inspector | The panel that shows the dtype, the shape, and the tensor statistics of the selected node. | | 인스펙터 |
| Playback | The feature that steps through the forward pass of the model. | replay | 재생 |
| Playback step | One step of the playback. Each step shows one node. | replay step | 재생 단계 |
| Store | A Zustand store in `src/store/`. | | 스토어 |

### Project documents

| Term | Meaning | Do not use | Korean term |
| --- | --- | --- | --- |
| Issue | A file in `docs/issues/` that records one problem. | ticket, bug report | 이슈 |
| ADR | A file in `docs/decisions/` that records one decision and its trade-offs. | | ADR(결정 기록) |
| Post-mortem | A file in `docs/history/` that records a resolved problem. | | 사후 분석 |
| Design system | The vendored components and tokens in `src/styles/ds/`. See [ADR 0003](../decisions/0003-adopt-shadcn-design-system.md). | | 디자인 시스템 |

---

## Next documents

- [CLAUDE.md (session rules and trigger routing)](../../CLAUDE.md)
- [Project overview (01_project_overview.md)](./01_project_overview.md)
- [Architecture and data flow (03_architecture.md)](./03_architecture.md)
- [Coding rules (04_convention.md)](./04_convention.md)
- [Deployment and certificate lifecycle (05_deployment.md)](./05_deployment.md)
