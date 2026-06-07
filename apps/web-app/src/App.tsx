import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Cpu, Sparkles, Upload, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import './App.css';

function App() {
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [engineProvider, setEngineProvider] = useState<'webgpu' | 'wasm' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<any>(null);

  const workerRef = useRef<Worker | null>(null);

  // 1. Initialize Web Worker
  useEffect(() => {
    // Create the worker using Vite's native worker import syntax
    workerRef.current = new Worker(
      new URL('./ort-worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Listen to worker messages
    workerRef.current.onmessage = (e: MessageEvent) => {
      const { type, provider, outputs, detail } = e.data;

      switch (type) {
        case 'LOAD_SUCCESS':
          setEngineProvider(provider);
          setModelLoaded(true);
          setLoading(false);
          setErrorMsg(null);
          break;
        case 'RUN_SUCCESS':
          setOutputs(outputs);
          setLoading(false);
          setErrorMsg(null);
          break;
        case 'ERROR':
          setErrorMsg(detail);
          setLoading(false);
          break;
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // 2. Handle file upload (converts uploaded ONNX file to ArrayBuffer)
  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.onnx')) {
      setErrorMsg("Please upload a valid .onnx model file.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setModelLoaded(false);
    setEngineProvider(null);
    setOutputs(null);

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const modelBytes = new Uint8Array(arrayBuffer);
      
      // Send load command to worker
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'LOAD',
          payload: { modelBytes }
        });
      }
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read file.");
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // 3. Run a mock/toy inference (assumes standard input names for the test model)
  const runTestInference = () => {
    if (!workerRef.current || !modelLoaded) return;

    setLoading(true);
    setErrorMsg(null);

    // Mock input tensor: [1, 2] shape float32 array
    const mockInputData = new Float32Array([1.0, 2.0]);
    const mockInputs = {
      // Key should match the model's actual input node name
      "X": {
        data: mockInputData,
        shape: [1, 2],
        type: 'float32'
      }
    };

    workerRef.current.postMessage({
      type: 'RUN',
      payload: { inputs: mockInputs }
    });
  };

  return (
    <div className="app-container">
      {/* 1. Header Bar */}
      <header className="app-header">
        <div className="logo-section">
          <Sparkles className="icon-spark" />
          <h1>StringLights v2</h1>
          <span className="badge">Web Inference Hub</span>
        </div>
        
        {/* WebGPU/WASM Fallback warning badge */}
        <div className="status-section">
          {engineProvider === 'wasm' && (
            <div className="status-badge warning-badge">
              <ShieldAlert className="badge-icon" />
              <span>WASM 모드 동작 중 - 성능 저하 가능</span>
            </div>
          )}
          {engineProvider === 'webgpu' && (
            <div className="status-badge success-badge">
              <Cpu className="badge-icon" />
              <span>WebGPU 가속 구동 중</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Dashboard Layout */}
      <main className="dashboard-grid">
        {/* Left Control Card */}
        <div className="card control-card">
          <h2>Model Environment Setup</h2>
          <p className="card-desc">Upload an ONNX model file to load it into the browser session.</p>

          <div className="upload-zone">
            <input 
              type="file" 
              id="onnx-upload" 
              accept=".onnx" 
              onChange={handleModelUpload}
              disabled={loading}
              className="hidden-file-input"
            />
            <label htmlFor="onnx-upload" className="upload-label">
              <Upload className="upload-icon" />
              <span>Choose ONNX File</span>
            </label>
          </div>

          <div className="info-panel">
            <div className="info-row">
              <span className="info-label">Status:</span>
              <span className={`info-val ${modelLoaded ? 'text-success' : 'text-muted'}`}>
                {loading ? 'Processing...' : modelLoaded ? 'Model Loaded' : 'No Model Loaded'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Engine:</span>
              <span className="info-val highlight-val">
                {engineProvider ? engineProvider.toUpperCase() : 'N/A'}
              </span>
            </div>
          </div>

          <button 
            onClick={runTestInference} 
            disabled={!modelLoaded || loading}
            className="btn btn-primary"
          >
            <Play className="btn-icon" />
            <span>Run Test Inference</span>
          </button>
        </div>

        {/* Right Output Card */}
        <div className="card output-card">
          <h2>Inference Result Console</h2>
          <p className="card-desc">Outputs from Web Worker execution session will be printed below.</p>

          {errorMsg && (
            <div className="error-banner">
              <AlertCircle className="error-icon" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="console-display">
            {loading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <span>Executing session in Web Worker...</span>
              </div>
            ) : outputs ? (
              <pre className="output-json">
                {JSON.stringify(outputs, null, 2)}
              </pre>
            ) : (
              <div className="empty-console">
                <CheckCircle2 className="empty-icon" />
                <span>Console is empty. Load a model and trigger run.</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
