import React, { useEffect, useState, useRef } from 'react';
import { getModels, uploadModel } from '../api/client';
import useModelStore from '../store/modelStore';

const ModelExplorer = () => {
    const [models, setModels] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);
    const { selectedModel, setSelectedModel } = useModelStore();

    const fetchModels = async () => {
        try {
            const data = await getModels();
            setModels(data);
        } catch (error) {
            console.error("Failed to load models:", error);
        }
    };

    useEffect(() => {
        fetchModels();
    }, []);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        try {
            await uploadModel(file);
            await fetchModels(); // Refresh list
        } catch (error) {
            alert("Upload failed: " + error.message);
        } finally {
            setIsLoading(false);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="model-explorer">
            <div className="explorer-actions">
                <input
                    type="file"
                    accept=".onnx"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <button className="primary-btn" onClick={handleUploadClick} disabled={isLoading}>
                    {isLoading ? 'Uploading...' : 'Upload Model'}
                </button>
            </div>

            <div className="model-list">
                {models.length === 0 && (
                    <div className="empty-message">No models found</div>
                )}
                {models.map((model) => (
                    <div
                        key={model.id}
                        className={`model-item ${selectedModel?.id === model.id ? 'active' : ''}`}
                        onClick={() => setSelectedModel(model)}
                    >
                        <div className="model-icon">📦</div>
                        <div className="model-info">
                            <div className="model-name" title={model.filename}>{model.filename}</div>
                            <div className="model-meta">
                                {model.meta.graph_name || 'Unnamed Graph'} • Opset {model.meta.opset_import[0]?.version}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ModelExplorer;
