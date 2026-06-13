import React, { useRef, useState, useCallback } from 'react';
import {
  Upload, Play, Loader2, AlertCircle,
  FileText, Database, X, CheckCircle2,
} from 'lucide-react';
import { useWorker }     from '../../contexts/WorkerContext';
import { useModelStore } from '../../store/modelStore';
import { useUIStore }    from '../../store/uiStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type DataMode = 'zeros' | 'random';

interface SelectedFile {
  file: File;
  role: 'model' | 'data';   // model = .onnx, data = everything else
  sizeStr: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_BYTES = 50 * 1024 * 1024;

// ─── Component ───────────────────────────────────────────────────────────────

export default function InferencePanel() {
  const { handleModelUpload, handleRunInference } = useWorker();
  const modelMeta = useModelStore((s) => s.modelMeta);
  const { isModelLoading, isInferenceRunning, errorMsg, engineProvider } = useUIStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragOver,   setDragOver]   = useState(false);
  const [dataMode,   setDataMode]   = useState<DataMode>('zeros');
  const [batchSize,  setBatchSize]  = useState(1);

  // ── Derived state ──────────────────────────────────────────────────────────
  const modelFiles  = selectedFiles.filter((f) => f.role === 'model');
  const totalBytes  = selectedFiles.reduce((s, f) => s + f.file.size, 0);
  const totalSizeStr = formatFileSize(totalBytes);

  const validationError: string | null =
    modelFiles.length > 1   ? 'Only one .onnx file can be uploaded at a time.' :
    totalBytes > MAX_BYTES   ? `Total size ${totalSizeStr} exceeds the 50MB limit.` :
    null;

  const canUpload =
    selectedFiles.length > 0 &&
    modelFiles.length === 1 &&
    !validationError;

  const isLoading = isModelLoading || isInferenceRunning;

  // ── File management ────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: File[]) => {
    setSelectedFiles((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        // Deduplicate by filename
        if (!next.some((x) => x.file.name === f.name)) {
          next.push({
            file:    f,
            role:    f.name.toLowerCase().endsWith('.onnx') ? 'model' : 'data',
            sizeStr: formatFileSize(f.size),
          });
        }
      }
      return next;
    });
  }, []);

  const removeFile = (name: string) =>
    setSelectedFiles((prev) => prev.filter((f) => f.file.name !== name));

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';   // allow re-selection of same files
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!isLoading) addFiles(Array.from(e.dataTransfer.files));
  };

  const onUpload = async () => {
    if (!canUpload || isLoading) return;
    await handleModelUpload(selectedFiles.map((sf) => sf.file));
    setSelectedFiles([]);   // reset chip list after successful upload kick-off
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="inference-panel">

      {/* ── Upload Zone ──────────────────────────────────────────────────── */}
      <section className="panel-section">
        <div className="panel-section-title">Model Upload</div>

        {/* Drop target — always visible */}
        <div
          className={`upload-zone${dragOver ? ' drag-over' : ''}${isLoading ? ' upload-disabled' : ''}`}
          onDragOver={(e) => { e.preventDefault(); if (!isLoading) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".onnx,.data"
            multiple
            onChange={onFileChange}
            className="hidden-file-input"
            disabled={isLoading}
          />
          <Upload className="upload-icon" size={20} />
          <span className="upload-label-text">
            {selectedFiles.length > 0 ? 'Click or drag to add more files' : 'Click or drag files here'}
          </span>
          <span className="upload-hint">.onnx + .onnx.data (optional) · Max 50MB</span>
        </div>

        {/* File chips */}
        {selectedFiles.length > 0 && (
          <div className="chip-list">
            {selectedFiles.map((sf) => (
              <div key={sf.file.name} className={`file-chip file-chip-${sf.role}`}>
                {sf.role === 'model'
                  ? <FileText size={13} className="chip-icon" />
                  : <Database size={13} className="chip-icon" />
                }
                <span className="chip-name">{sf.file.name}</span>
                <span className="chip-size">{sf.sizeStr}</span>
                <button
                  className="chip-remove"
                  onClick={(e) => { e.stopPropagation(); removeFile(sf.file.name); }}
                  title="Remove"
                  disabled={isLoading}
                >
                  <X size={11} />
                </button>
              </div>
            ))}

            {/* Summary + validation */}
            <div className="chip-footer">
              <span className={`chip-total${totalBytes > MAX_BYTES ? ' chip-total-error' : ''}`}>
                Total: {totalSizeStr} / 50MB
              </span>
              {validationError && (
                <span className="chip-validation-error">
                  <AlertCircle size={11} />
                  {validationError}
                </span>
              )}
            </div>

            {/* Upload button — only visible when chips are present */}
            <button
              id="upload-analyze-btn"
              className="btn btn-primary upload-action-btn"
              onClick={onUpload}
              disabled={!canUpload || isLoading}
            >
              {isModelLoading ? (
                <>
                  <Loader2 className="spin-icon" size={14} />
                  <span>Processing Surgery…</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Upload &amp; Analyze</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Model Info ────────────────────────────────────────────────────── */}
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
              <span className="status-label">Opset</span>
              <span className="status-value loaded">{modelMeta.opsetVersion}</span>
            </div>
            {modelMeta.hadExternalData && (
              <div className="status-row">
                <span className="status-label">Ext. Data</span>
                <span className="status-value status-inlined">
                  <CheckCircle2 size={11} />
                  Inlined
                </span>
              </div>
            )}
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

      {/* ── Input Configuration ───────────────────────────────────────────── */}
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

          <div className="data-mode-tabs">
            {(['zeros', 'random'] as DataMode[]).map((m) => (
              <button
                key={m}
                className={`data-mode-btn${dataMode === m ? ' active' : ''}`}
                onClick={() => setDataMode(m)}
              >
                {m === 'zeros' ? 'Zero Tensors' : 'Random Tensors'}
              </button>
            ))}
          </div>

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

      {/* ── Run Inference ─────────────────────────────────────────────────── */}
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
