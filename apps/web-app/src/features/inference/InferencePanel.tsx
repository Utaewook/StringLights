import React, { useRef, useState } from 'react';
import { Upload, Play, Loader2, AlertCircle } from 'lucide-react';
import { useWorker }     from '../../contexts/WorkerContext';
import { useModelStore } from '../../store/modelStore';
import { useUIStore }    from '../../store/uiStore';

type DataMode = 'zeros' | 'random';

export default function InferencePanel() {
  const { handleModelUpload, handleRunInference } = useWorker();
  const modelMeta      = useModelStore((s) => s.modelMeta);
  const { isModelLoading, isInferenceRunning, errorMsg, engineProvider } = useUIStore();

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [dataMode, setDataMode]     = useState<DataMode>('zeros');
  const [batchSize, setBatchSize]   = useState(1);
  const [dragOver, setDragOver]     = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleModelUpload(file);
    e.target.value = '';   // allow re-upload of same file
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleModelUpload(file);
  };

  const isLoading = isModelLoading || isInferenceRunning;

  return (
    <div className="inference-panel">
      {/* ── Upload Zone ────────────────────────────────────────────── */}
      <section className="panel-section">
        <div className="panel-section-title">Model Upload</div>

        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''} ${isLoading ? 'upload-disabled' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".onnx"
            onChange={onFileChange}
            className="hidden-file-input"
            disabled={isLoading}
          />
          {isModelLoading ? (
            <div className="upload-loading">
              <Loader2 className="spin-icon" size={28} />
              <span>Processing Surgery…</span>
            </div>
          ) : (
            <>
              <Upload className="upload-icon" size={28} />
              <span className="upload-label-text">Upload ONNX File</span>
              <span className="upload-hint">Click or drag · Max 50MB</span>
            </>
          )}
        </div>
      </section>

      {/* ── Error Banner ──────────────────────────────────────────── */}
      {errorMsg && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Model Status ──────────────────────────────────────────── */}
      {modelMeta && (
        <section className="panel-section">
          <div className="panel-section-title">Model Info</div>
          <div className="model-status-panel">
            <div className="status-row">
              <span className="status-label">Engine</span>
              <span className={`status-value ${engineProvider ? 'loaded' : 'muted'}`}>
                {engineProvider ? engineProvider.toUpperCase() : 'Loading…'}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Nodes</span>
              <span className="status-value loaded">{modelMeta.nodes.length}</span>
            </div>
            <div className="status-row">
              <span className="status-label">Inputs</span>
              <span className="status-value loaded">{modelMeta.inputNames.length}</span>
            </div>
            <div className="status-row">
              <span className="status-label">Intermediate</span>
              <span className="status-value loaded">{modelMeta.intermediateOutputNames.length}</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Input Configuration ───────────────────────────────────── */}
      {modelMeta && modelMeta.inputs.length > 0 && (
        <section className="panel-section">
          <div className="panel-section-title">Model Inputs</div>
          <div className="input-config-list">
            {modelMeta.inputs.map((inp) => (
              <div className="input-config-item" key={inp.name}>
                <div className="input-config-name">{inp.name}</div>
                <div className="input-config-meta">
                  <span className="input-config-shape">
                    [{inp.shape.map((d) => (d === -1 ? 'N' : d)).join(', ')}]
                  </span>
                  <span className="input-config-dtype">{inp.dtype}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Data mode tabs */}
          <div className="data-mode-tabs">
            {(['zeros', 'random'] as DataMode[]).map((m) => (
              <button
                key={m}
                className={`data-mode-btn ${dataMode === m ? 'active' : ''}`}
                onClick={() => setDataMode(m)}
              >
                {m === 'zeros' ? 'Zero Tensors' : 'Random Tensors'}
              </button>
            ))}
          </div>

          {/* Batch size (only show if any dynamic dim exists) */}
          {modelMeta.inputs.some((inp) => inp.shape.includes(-1)) && (
            <div className="batch-size-row">
              <label className="batch-size-label">Batch Size (N)</label>
              <input
                type="number"
                className="batch-size-input"
                min={1}
                max={512}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, Number(e.target.value)))}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Run Button ────────────────────────────────────────────── */}
      {modelMeta && (
        <section className="panel-section">
          <button
            id="run-inference-btn"
            className="btn btn-primary run-btn"
            onClick={() => handleRunInference(dataMode, batchSize)}
            disabled={isLoading || !engineProvider}
          >
            {isInferenceRunning ? (
              <>
                <Loader2 className="spin-icon" size={16} />
                <span>Running Inference…</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Run Inference</span>
              </>
            )}
          </button>
        </section>
      )}
    </div>
  );
}
