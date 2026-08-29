import React, { useRef, useState, useCallback } from 'react';
import {
  Upload, Play, Loader2, AlertCircle,
  FileText, Database, X, CheckCircle2,
} from 'lucide-react';
import { useWorker }     from '../../contexts/WorkerContext';
import { useModelStore } from '../../store/modelStore';
import { useUIStore }    from '../../store/uiStore';
import { Button } from '../../components/ui/Button';
import { Input }  from '../../components/ui/Input';
import { Label }  from '../../components/ui/Label';
import { Alert }  from '../../components/ui/Alert';
import { Tabs }   from '../../components/ui/Tabs';
import './InferencePanel.css';

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
        <div className="panel-section-title">Model upload</div>

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
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => { e.stopPropagation(); removeFile(sf.file.name); }}
                  title="Remove file"
                  aria-label={`Remove ${sf.file.name}`}
                  disabled={isLoading}
                >
                  <X />
                </Button>
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
            <Button
              id="upload-analyze-btn"
              className="ds-btn-block"
              onClick={onUpload}
              disabled={!canUpload || isLoading}
            >
              {isModelLoading ? (
                <>
                  <Loader2 className="spin-icon" />
                  <span>Running graph surgery…</span>
                </>
              ) : (
                <>
                  <Upload />
                  <span>Upload and analyze</span>
                </>
              )}
            </Button>
          </div>
        )}
      </section>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {errorMsg && (
        <Alert variant="destructive" icon={<AlertCircle />}>
          {errorMsg}
        </Alert>
      )}

      {/* ── Model Info ────────────────────────────────────────────────────── */}
      {modelMeta && (
        <section className="panel-section">
          <div className="panel-section-title">Model info</div>
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
          <div className="panel-section-title">Model inputs</div>
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

          <Tabs<DataMode>
            tabs={[
              { value: 'zeros',  label: 'Zero tensors' },
              { value: 'random', label: 'Random tensors' },
            ]}
            value={dataMode}
            onValueChange={setDataMode}
          />

          {modelMeta.inputs.some((inp) => inp.shape.includes(-1)) && (
            <div className="ds-field">
              <Label htmlFor="batch-size">Batch size (N)</Label>
              <Input
                id="batch-size"
                type="number"
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
          <Button
            id="run-inference-btn"
            className="ds-btn-block"
            onClick={() => handleRunInference(dataMode, batchSize)}
            disabled={isLoading || !engineProvider}
          >
            {isInferenceRunning ? (
              <>
                <Loader2 className="spin-icon" />
                <span>Running inference…</span>
              </>
            ) : (
              <>
                <Play />
                <span>Run inference</span>
              </>
            )}
          </Button>
        </section>
      )}
    </div>
  );
}
