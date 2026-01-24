import React, { useState } from 'react';
import useModelStore from '../../store/modelStore';
import { api } from '../../api/client';

const InputManager = () => {
    const { selectedModel } = useModelStore();
    const [dynamicAxes, setDynamicAxes] = useState({});
    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    if (!selectedModel) return null;

    // Get all dynamic axes (dim_param or unnamed) from inputs
    // We can use the meta information already provided by the backend
    const inputs = selectedModel.meta.inputs;

    // Extract unique dynamic axes names
    const dynamicAxisParams = new Set();
    inputs.forEach(input => {
        input.shape.forEach(dim => {
            if (dim === null || typeof dim === 'string') {
                // In our current backend, dynamic is null. 
                // We might need to adjust or just ask for a generic "Batch Size" if it's always the first dim.
                // For now, let's look for nulls and provide a generic input if any found.
            }
        });
    });

    const hasDynamicAxes = inputs.some(i => i.shape.includes(null));

    const handleGenerate = async () => {
        setGenerating(true);
        setStatus({ type: '', message: '' });
        try {
            // Flatten dynamic axes for the request.
            // Simplified: if there's any null, we send a default batch size of 100 for all.
            // In a real app, we'd map specific param names.
            const axesPayload = {};
            // Our backend generate_dummy_inputs uses dim_param if available, else 100.

            const response = await api.post(`/datasets/${selectedModel.id}/inputs/generate`, {
                dynamic_axes: dynamicAxes
            });
            setStatus({ type: 'success', message: 'Inputs generated successfully!' });
        } catch (error) {
            setStatus({ type: 'error', message: `Generation failed: ${error.response?.data?.detail || error.message}` });
        } finally {
            setGenerating(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setStatus({ type: '', message: '' });
        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post(`/datasets/${selectedModel.id}/inputs/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStatus({ type: 'success', message: 'Inputs uploaded and validated!' });
        } catch (error) {
            setStatus({ type: 'error', message: `Upload failed: ${error.response?.data?.detail || error.message}` });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="input-manager">
            <div className="inspector-section">
                <h3>Model Inputs</h3>
                <ul className="io-list">
                    {inputs.map((input, idx) => (
                        <li key={idx} className="io-item">
                            <div className="io-row">
                                <span className="io-name">{input.name}</span>
                                <span className="io-shape-badge">{input.dtype}</span>
                            </div>
                            <div className="io-shape-badge">
                                [{input.shape.map(s => s === null ? '?' : s).join(', ')}]
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="inspector-section">
                <h3>1. Auto Generate</h3>
                <p className="help-text">Generate dummy data for all inputs. Batch sizes (?) default to 100.</p>

                {hasDynamicAxes && (
                    <div className="axis-input-group">
                        <label>Default Dynamic Dim:</label>
                        <input
                            type="number"
                            defaultValue={100}
                            onChange={(e) => setDynamicAxes({ "batch": parseInt(e.target.value) || 100 })}
                        />
                    </div>
                )}

                <button
                    className="primary-btn"
                    onClick={handleGenerate}
                    disabled={generating}
                >
                    {generating ? 'Generating...' : 'Generate Dummy Data'}
                </button>
            </div>

            <div className="inspector-section">
                <h3>2. Upload NPZ</h3>
                <p className="help-text">Upload a .npz file containing all required input tensors.</p>
                <input
                    type="file"
                    accept=".npz"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="npz-upload"
                />
                <button
                    className="secondary-btn"
                    onClick={() => document.getElementById('npz-upload').click()}
                    disabled={uploading}
                >
                    {uploading ? 'Checking...' : 'Upload .npz File'}
                </button>
            </div>

            {status.message && (
                <div className={`status-banner ${status.type}`}>
                    {status.message}
                </div>
            )}
        </div>
    );
};

export default InputManager;
