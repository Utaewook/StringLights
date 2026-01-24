import React, { useState } from 'react';
import { api } from '../../api/client';
import useModelStore from '../../store/modelStore';

const InputActionModal = ({ model, onClose, initialMode = null }) => {
    const [mode, setMode] = useState(initialMode); // 'auto' or 'manual'
    const [name, setName] = useState('');
    const [batchSize, setBatchSize] = useState(100);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const { addDataset } = useModelStore();

    if (!model) return null;

    const handleGenerate = async () => {
        setIsLoading(true);
        setStatus({ type: '', message: '' });
        try {
            const axes = {};
            // Simplified: apply same batch size to all dynamic dims
            if (model.meta && model.meta.inputs) {
                model.meta.inputs.forEach(input => {
                    input.shape.forEach((dim, idx) => {
                        if (dim === null) axes[`dim_${idx}`] = batchSize;
                    });
                });
            }

            const response = await api.post(`/datasets/${model.id}/inputs/generate`, {
                name: name || "Generated Input",
                dynamic_axes: axes
            });

            addDataset(model.id, {
                id: response.id,
                name: response.name,
                type: 'Auto',
                created_at: Date.now() / 1000
            });
            setStatus({ type: 'success', message: 'Input data generated successfully!' });
            setTimeout(onClose, 1500);
        } catch (error) {
            setStatus({ type: 'error', message: `Failed: ${error.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        setStatus({ type: '', message: '' });
        const formData = new FormData();
        formData.append('file', file);
        if (name) formData.append('name', name);

        try {
            const response = await api.post(`/datasets/${model.id}/inputs/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            addDataset(model.id, {
                id: response.id,
                name: response.name,
                type: 'Manual',
                created_at: Date.now() / 1000
            });
            setStatus({ type: 'success', message: 'Input file uploaded and validated!' });
            setTimeout(onClose, 1500);
        } catch (error) {
            setStatus({ type: 'error', message: `Upload failed: ${error.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Manage Inputs: {model.filename}</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Dataset Name:</label>
                        <input
                            type="text"
                            placeholder="e.g. Zero Tensors, Large Batch..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="text-input"
                        />
                    </div>

                    {!mode ? (
                        <div className="mode-selection">
                            <button className="mode-btn no-icon" onClick={() => setMode('auto')}>
                                <div className="btn-text">
                                    <strong>Auto Generate</strong>
                                    <span>Create dummy data for testing</span>
                                </div>
                            </button>
                            <button className="mode-btn no-icon" onClick={() => setMode('manual')}>
                                <div className="btn-text">
                                    <strong>Upload File</strong>
                                    <span>Upload custom .npz data</span>
                                </div>
                            </button>
                        </div>
                    ) : mode === 'auto' ? (
                        <div className="auto-gen-form">
                            <p className="form-desc">Generate dummy data using model properties.</p>
                            <div className="form-group">
                                <label>Batch Size (for dynamic axes):</label>
                                <input
                                    type="number"
                                    value={batchSize}
                                    onChange={e => setBatchSize(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className="form-actions">
                                <button className="primary-btn" onClick={handleGenerate} disabled={isLoading}>
                                    {isLoading ? 'Generating...' : 'Generate'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="manual-upload-form">
                            <p className="form-desc">Upload a .npz file that matches the model inputs.</p>
                            <div className="upload-area">
                                <input
                                    type="file"
                                    accept=".npz"
                                    id="modal-npz-upload"
                                    onChange={handleUpload}
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="modal-npz-upload" className="upload-label">
                                    {isLoading ? 'Uploading & Validating...' : 'Select .npz File'}
                                </label>
                            </div>
                        </div>
                    )}

                    {status.message && (
                        <div className={`status-banner ${status.type}`}>
                            {status.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InputActionModal;
