import React, { useEffect, useState, useRef } from 'react';
import { getModels, uploadModel, getDatasets } from '../api/client';
import useModelStore from '../store/modelStore';
import InputActionModal from './InputActionModal';

const ModelExplorer = () => {
    const [models, setModels] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);
    const { selectedModel, setSelectedModel, datasets, setDatasets } = useModelStore();
    const [expandedModels, setExpandedModels] = useState(new Set());

    // Modal & Menu states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState(null);
    const [targetModel, setTargetModel] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null); // { x, y, model }

    const toggleExpand = async (e, modelId) => {
        e.stopPropagation();
        const isExpanding = !expandedModels.has(modelId);

        const next = new Set(expandedModels);
        if (next.has(modelId)) next.delete(modelId);
        else next.add(modelId);
        setExpandedModels(next);

        if (isExpanding) {
            try {
                const datasetList = await getDatasets(modelId);
                setDatasets(modelId, datasetList);
            } catch (error) {
                console.error("Failed to load datasets:", error);
            }
        }
    };

    const handleOpenMenu = (e, model) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuAnchor({
            x: rect.right,
            y: rect.top,
            model: model
        });
    };

    const closeMenu = () => setMenuAnchor(null);

    const handleSelectOption = (mode) => {
        setTargetModel(menuAnchor.model);
        setModalMode(mode);
        setIsModalOpen(true);
        closeMenu();
    };

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
        // Close menu on outside click
        const handleClickOutside = () => closeMenu();
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
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
                <button className="primary-btn upload-model-btn" onClick={handleUploadClick} disabled={isLoading}>
                    {isLoading ? 'Uploading...' : 'Upload Model'}
                </button>
            </div>

            <div className="model-list">
                {models.length === 0 && (
                    <div className="empty-message">No models found</div>
                )}
                {models.map((model) => (
                    <div key={model.id} className="model-entry">
                        <div
                            className={`model-item ${selectedModel?.id === model.id ? 'active' : ''}`}
                            onClick={() => setSelectedModel(model)}
                        >
                            <span
                                className={`chevron ${expandedModels.has(model.id) ? 'expanded' : ''}`}
                                onClick={(e) => toggleExpand(e, model.id)}
                            >
                                ▶
                            </span>
                            <div className="model-name" title={model.filename}>{model.filename}</div>
                            <button
                                className="add-input-btn"
                                onClick={(e) => handleOpenMenu(e, model)}
                                title="Add Input Data"
                            >
                                +
                            </button>
                        </div>

                        {expandedModels.has(model.id) && (
                            <div className="model-sub-list">
                                {(datasets[model.id] || []).length === 0 ? (
                                    <div className="sub-item empty">No input sets yet</div>
                                ) : (
                                    datasets[model.id].map((ds, idx) => {
                                        return (
                                            <div key={ds.id || idx} className="sub-item input-item">
                                                <span className="input-filename text-ellipsis" title={ds.name}>
                                                    {ds.name}
                                                </span>
                                                <span className="input-tag">{ds.type}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {menuAnchor && (
                <div
                    className="action-menu"
                    style={{
                        position: 'fixed',
                        top: `${menuAnchor.y}px`,
                        left: `${menuAnchor.x}px` // Appear strictly to the right of the button/panel
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="menu-option" onClick={() => handleSelectOption('auto')}>
                        Auto Generate
                    </div>
                    <div className="menu-option" onClick={() => handleSelectOption('manual')}>
                        Upload File
                    </div>
                </div>
            )}

            {isModalOpen && (
                <InputActionModal
                    model={targetModel}
                    initialMode={modalMode}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default ModelExplorer;
