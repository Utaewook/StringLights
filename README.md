# String Lights

String Lights is a web-based platform that allows you to visually trace the inference process of Deep Learning/Machine Learning models (e.g., ONNX) and replay it as an animation.

---

## Key Features

### Model Structure Exploration
- ONNX Model Upload
- Visualization of Model Node/Operation Graph
- Inspection of Input/Output Tensor Specs (shape, dtype)

### Inference Process Replay
- Replay execution order based on actual inference
- Highlight Nodes/Operations (Lighting effect)
- Monitor changes in summary statistics (shape/dtype) of key tensors during execution

### Timeline Control
- Play / Pause
- Speed Control (0.25x ~ 4.0x)
- Time Travel (Slider)
- Reverse Play (Replay)

### Input Data Processing
- Generate Input Tensors based on Model Spec
- User Input UI for Tensors based on Model Spec
    - Upload Example Data (npz, pkl, etc.)
    - Manual Tensor Input via UI

---

## Project Goals
- Low-cost / Rapid Demo Implementation
- Run the entire system via Docker on a Local PC or Laptop

---

## Project Development
### Container Configuration
1. Frontend: Web UI, Graph Exploration, Animation/Timeline Replay, User I/O
2. Backend: Data Upload/Download, Metadata Management, Run Creation, WebSocket/Worker Relay & Management
3. Model Run Worker: Execute Inference and Generate Traces
4. Database: Store Model/Run Metadata

### Project Directory Structure
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

## Local Demo Execution

```bash
# Instructions will be added once demo development is complete
```