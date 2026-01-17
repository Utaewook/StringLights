import React, { useEffect, useState, useRef } from 'react';
import { getModels, uploadModel, getDatasets, getTensors } from '../../api/client';
import useModelStore from '../../store/modelStore';
import useUIStore from '../../store/uiStore';
import InputActionModal from '../input-management/InputActionModal';

import TreeItem from './TreeItem';

const ModelExplorer = () => {
    const [models, setModels] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Stores
    const { setRightPanelOpen } = useUIStore();
    const {
        selectedModel, setSelectedModel,
        datasets, setDatasets,
        selectedDataset, setSelectedDataset,
        datasetTensors, setDatasetTensors,
        setSelectedNode
    } = useModelStore();

    // Expansion States
    const [expandedModels, setExpandedModels] = useState(new Set());
    const [expandedModelDatasets, setExpandedModelDatasets] = useState(new Set()); // Level 1: "Datasets" folder
    const [expandedDatasets, setExpandedDatasets] = useState(new Set()); // Level 2: Individual Datasets
    const [expandedInputs, setExpandedInputs] = useState(new Set()); // Level 3: "Inputs" folder
    // Note: Outputs are static/placeholder for now

    // Modal & Menu states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState(null);
    const [targetModel, setTargetModel] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null); // { x, y, model }

    // --- Handlers ---
    const toggleExpandModel = async (e, modelId) => {
        // e is optional if called from TreeItem directly via onToggle
        if (e) e.stopPropagation();

        const next = new Set(expandedModels);
        const isExpanding = !next.has(modelId);
        if (isExpanding) next.add(modelId);
        else next.delete(modelId);
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

    const toggleExpandModelDatasets = (e, modelId) => {
        if (e) e.stopPropagation();
        const next = new Set(expandedModelDatasets);
        if (!next.has(modelId)) next.add(modelId);
        else next.delete(modelId);
        setExpandedModelDatasets(next);
    };

    const toggleExpandDataset = (e, modelId, datasetId) => {
        if (e) e.stopPropagation();
        const next = new Set(expandedDatasets);
        if (!next.has(datasetId)) next.add(datasetId);
        else next.delete(datasetId);
        setExpandedDatasets(next);
    };

    const toggleExpandInput = async (e, modelId, datasetId) => {
        if (e) e.stopPropagation();
        const next = new Set(expandedInputs);
        const isExpanding = !next.has(datasetId);
        if (isExpanding) next.add(datasetId);
        else next.delete(datasetId);
        setExpandedInputs(next);

        if (isExpanding) {
            try {
                const tensorList = await getTensors(modelId, datasetId);
                setDatasetTensors(datasetId, tensorList);
            } catch (error) {
                console.error("Failed to load tensors:", error);
            }
        }
    };

    // ... (Menu & Modal handlers same as before) ...
    const handleOpenMenu = (e, model) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuAnchor({ x: rect.right, y: rect.top, model: model });
    };
    const closeMenu = () => setMenuAnchor(null);
    const handleSelectOption = (mode) => {
        setTargetModel(menuAnchor.model);
        setModalMode(mode);
        setIsModalOpen(true);
        closeMenu();
    };
    // ...

    const handleTensorClick = (tensor) => {
        const mockNode = {
            name: tensor.tensor_name,
            op_type: 'Tensor',
            attributes: {
                size_bytes: tensor.size_bytes,
                filename: tensor.name
            },
            inputs: [],
            outputs: []
        };
        setSelectedNode(mockNode);
        setRightPanelOpen(true); // Automatically open inspector
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
        const handleClickOutside = () => closeMenu();
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsLoading(true);
        try {
            await uploadModel(file);
            await fetchModels();
        } catch (error) {
            alert("Upload failed: " + error.message);
        } finally {
            setIsLoading(false);
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

            <div className="model-list tree-view-container">
                {models.length === 0 && (
                    <div className="empty-message">No models found</div>
                )}

                {models.map(model => (
                    <TreeItem
                        key={model.id}
                        level={0}
                        label={model.filename}
                        expanded={expandedModels.has(model.id)}
                        onToggle={(e) => toggleExpandModel(e, model.id)}
                        onClick={() => setSelectedModel(model)}
                        isActive={selectedModel?.id === model.id}
                    >
                        {/* Level 1: Datasets Group Folder */}
                        <TreeItem
                            level={1}
                            label="Datasets"
                            expanded={expandedModelDatasets.has(model.id)}
                            onToggle={(e) => toggleExpandModelDatasets(e, model.id)}
                            actions={
                                <button
                                    className="add-input-btn"
                                    onClick={(e) => handleOpenMenu(e, model)}
                                    title="Add Input Data"
                                >
                                    +
                                </button>
                            }
                        >
                            {/* Level 2: Individual Datasets */}
                            {(datasets[model.id] || []).length === 0 ? (
                                <div className="tree-empty-item" style={{ paddingLeft: '42px' }}>No datasets</div>
                            ) : (
                                datasets[model.id].map(ds => (
                                    <TreeItem
                                        key={ds.id}
                                        level={2}
                                        label={ds.name}
                                        expanded={expandedDatasets.has(ds.id)}
                                        onToggle={(e) => toggleExpandDataset(e, model.id, ds.id)}
                                        onClick={() => setSelectedDataset(ds)}
                                        isActive={selectedDataset?.id === ds.id}
                                        actions={<span className="input-tag">{ds.type}</span>}
                                    >
                                        {/* Level 3: Inputs Folder */}
                                        <TreeItem
                                            level={3}
                                            label="Inputs"
                                            expanded={expandedInputs.has(ds.id)}
                                            onToggle={(e) => toggleExpandInput(e, model.id, ds.id)}
                                        >
                                            {/* Level 4: Tensors */}
                                            {(datasetTensors[ds.id] || []).length === 0 ? (
                                                <div className="tree-empty-item" style={{ paddingLeft: '74px' }}>No tensors</div>
                                            ) : (
                                                datasetTensors[ds.id].map((tensor, idx) => (
                                                    <TreeItem
                                                        key={idx}
                                                        level={4}
                                                        label={tensor.tensor_name}
                                                        isLeaf={true}
                                                        onClick={() => handleTensorClick(tensor)}
                                                    />
                                                ))
                                            )}
                                        </TreeItem>

                                        {/* Level 3: Outputs Folder (Placeholder) */}
                                        <TreeItem
                                            level={3}
                                            label="Outputs"
                                            isLeaf={false} // Treat as folder
                                            expanded={false} // Always closed for now
                                        // onToggle not needed strictly if always closed, or empty handler
                                        />
                                    </TreeItem>
                                ))
                            )}
                        </TreeItem>
                    </TreeItem>
                ))}
            </div>

            {menuAnchor && (
                <div
                    className="action-menu"
                    style={{
                        position: 'fixed',
                        top: `${menuAnchor.y}px`,
                        left: `${menuAnchor.x}px`
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
