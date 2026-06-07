import React, { useEffect, useState, useRef } from 'react';
import {
    getModels, uploadModel, uploadModelFile,
    getDatasets, getTensors, getRuns,
    getDatasetOutputs, getRunTrace
} from '../../api/client';
import useModelStore from '../../store/modelStore';
import useUIStore from '../../store/uiStore';
import useNotificationStore from '../../store/notificationStore';
import usePlaybackStore from '../../store/playbackStore';
import InputActionModal from '../input-management/InputActionModal';
import RunInferenceModal from './RunInferenceModal';

import TreeItem from './TreeItem';

const ModelExplorer = () => {
    const [models, setModels] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Stores
    const { setRightPanelOpen, setSelectedNode: setSelectedNodeUI } = useUIStore(); // UI Store for right panel
    const { addNotification } = useNotificationStore();
    const {
        selectedModel, setSelectedModel,
        datasets, setDatasets,
        selectedDataset, setSelectedDataset,
        datasetTensors, setDatasetTensors,
        setSelectedNode
    } = useModelStore();

    const { setTraceData } = usePlaybackStore();

    // Expansion States
    const [expandedModels, setExpandedModels] = useState(new Set());
    const [expandedModelDatasets, setExpandedModelDatasets] = useState(new Set());
    const [expandedDatasets, setExpandedDatasets] = useState(new Set());
    const [expandedInputs, setExpandedInputs] = useState(new Set());

    // Output Expansion States
    const [expandedOutputs, setExpandedOutputs] = useState(new Set());
    const [datasetOutputs, setDatasetOutputs] = useState({}); // datasetId -> [{run_id, run_name, files}]

    // Run Expansion States
    const [expandedModelRuns, setExpandedModelRuns] = useState(new Set()); // For "Runs" folder under Model
    const [modelRuns, setModelRuns] = useState({}); // modelId -> [Run]

    // Modal & Menu states
    const [isModalOpen, setIsModalOpen] = useState(false); // Input Action Modal
    const [isRunModalOpen, setIsRunModalOpen] = useState(false); // Run Inference Modal
    const [modalMode, setModalMode] = useState(null);
    const [targetModel, setTargetModel] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null);

    // --- Handlers ---
    const toggleExpandModel = async (e, modelId) => {
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

    const toggleExpandOutput = async (e, modelId, datasetId) => {
        if (e) e.stopPropagation();
        const next = new Set(expandedOutputs);
        const isExpanding = !next.has(datasetId);
        if (isExpanding) next.add(datasetId);
        else next.delete(datasetId);
        setExpandedOutputs(next);

        if (isExpanding) {
            try {
                const outputs = await getDatasetOutputs(modelId, datasetId);
                setDatasetOutputs(prev => ({ ...prev, [datasetId]: outputs }));
            } catch (error) {
                console.error("Failed to load outputs:", error);
            }
        }
    };

    const toggleExpandModelRuns = async (e, modelId) => {
        if (e) e.stopPropagation();
        const next = new Set(expandedModelRuns);
        const isExpanding = !next.has(modelId);
        if (isExpanding) next.add(modelId);
        else next.delete(modelId);
        setExpandedModelRuns(next);

        if (isExpanding) {
            try {
                const runs = await getRuns(modelId);
                setModelRuns(prev => ({ ...prev, [modelId]: runs }));
            } catch (error) {
                console.error("Failed to load runs:", error);
            }
        }
    };

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

    const handleOpenRunModal = (e, model) => {
        e.stopPropagation();
        setTargetModel(model);
        setIsRunModalOpen(true);
    };

    const handleTensorClick = (tensor) => {
        const mockNode = {
            name: tensor.tensor_name || tensor.name,
            op_type: 'Tensor',
            attributes: {
                size_bytes: tensor.size_bytes,
                filename: tensor.name,
                shape: tensor.shape || [],
                dtype: tensor.dtype || 'unknown',
                statistics: tensor.statistics || {}
            },
            inputs: [],
            outputs: []
        };
        setSelectedNode(mockNode);
        setRightPanelOpen(true);
    };

    const handleRunClick = async (run, model) => {
        // 1. Auto-switch to the model if it's not selected
        if (!selectedModel || selectedModel.id !== model.id) {
            setGlobalSelectedModel(model);
        }

        // 2. Load Trace Data
        try {
            // No need to fetch trace here, just showing run details
            // If we needed it, we could call getRunTrace(run.id)
        } catch (error) {
            console.error("Failed to load run details:", error);
        }

        // Show details in Right Panel
        const metrics = run.metrics || {};
        const details = {
            name: run.name || `Run ${new Date(run.start_time).toLocaleString()}`,
            id: run.id,
            status: run.status,
            duration: metrics?.total_duration || "N/A",
            tensors: metrics
        };

        const mockNode = {
            name: "Run Details",
            op_type: 'RunInfo',
            attributes: details,
            inputs: [],
            outputs: []
        };

        setSelectedNode(mockNode);
        setRightPanelOpen(true);
    };

    const handlePlayTrace = async (e, run, model) => {
        e.stopPropagation();

        // Auto-switch model
        if (!selectedModel || selectedModel.id !== model.id) {
            setGlobalSelectedModel(model);
        }

        try {
            const traceData = await getRunTrace(run.id);
            setTraceData(run.id, traceData);
        } catch (error) {
            addNotification("Failed to load trace data", "error");
        }
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
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsLoading(true);
        try {
            await uploadModel(files);
            await fetchModels();
            addNotification("Model uploaded successfully", "success");
        } catch (error) {
            addNotification("Upload failed: " + error.message, "error");
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const [targetModelForUpload, setTargetModelForUpload] = useState(null);
    const appendFileInputRef = useRef(null);

    const handleAppendFileChange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !targetModelForUpload) return;

        setIsLoading(true);
        try {
            await uploadModelFile(targetModelForUpload.id, files);
            addNotification("File added successfully", "success");
            await fetchModels(); // Refresh status
        } catch (error) {
            addNotification("Failed to add file: " + error.message, "error");
        } finally {
            setIsLoading(false);
            if (appendFileInputRef.current) appendFileInputRef.current.value = '';
            setTargetModelForUpload(null);
        }
    };

    const handleMissingFileClick = (e, model) => {
        e.stopPropagation();
        addNotification(`Missing files: ${model.meta.missing_files?.join(', ')}. Please upload them.`, "warning", 5000);
        setTargetModelForUpload(model);
        setTimeout(() => appendFileInputRef.current?.click(), 100);
    };

    const handleNoDatasetClick = (e, model) => {
        e.stopPropagation();
        addNotification("No input data found. Please add a dataset first.", "warning");
        handleOpenMenu(e, model); // Open the "Add Input" menu
    };

    return (
        <div className="model-explorer">
            <div className="explorer-actions">
                <input
                    type="file"
                    multiple
                    accept=".onnx,.data,.json,.pth"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <input
                    type="file"
                    multiple
                    ref={appendFileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleAppendFileChange}
                />
                <button className="primary-btn upload-model-btn" onClick={handleUploadClick} disabled={isLoading}>
                    {isLoading ? 'Uploading...' : 'Upload Model'}
                </button>
            </div>

            <div className="model-list tree-view-container">
                {models.length === 0 && (
                    <div className="empty-message">No models found</div>
                )}

                {models.map(model => {
                    const status = model.meta?.status || "READY";
                    const isMissingFiles = status === "MISSING_FILES";
                    const hasDatasets = (datasets[model.id] || []).length > 0;
                    const isReady = !isMissingFiles && hasDatasets;

                    return (
                        <TreeItem
                            key={model.id}
                            level={0}
                            label={model.filename}
                            expanded={expandedModels.has(model.id)}
                            onToggle={(e) => toggleExpandModel(e, model.id)}
                            onClick={() => setSelectedModel(model)}
                            isActive={selectedModel?.id === model.id}
                            actions={
                                isReady ? (
                                    <button
                                        className="run-inference-btn"
                                        onClick={(e) => handleOpenRunModal(e, model)}
                                        title="Run Inference"
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#4caf50', fontSize: '14px', fontWeight: 'bold', marginLeft: '8px'
                                        }}
                                    >
                                        ▶
                                    </button>
                                ) : (
                                    <button
                                        className="warning-btn"
                                        onClick={(e) => isMissingFiles ? handleMissingFileClick(e, model) : handleNoDatasetClick(e, model)}
                                        title={isMissingFiles ? "Missing Files" : "No Input Data"}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#f44336', fontSize: '14px', fontWeight: 'bold', marginLeft: '8px'
                                        }}
                                    >
                                        !
                                    </button>
                                )
                            }
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

                                            {/* Level 3: Outputs Folder */}
                                            <TreeItem
                                                level={3}
                                                label="Outputs"
                                                expanded={expandedOutputs.has(ds.id)}
                                                onToggle={(e) => toggleExpandOutput(e, model.id, ds.id)}
                                            >
                                                {(datasetOutputs[ds.id] || []).length === 0 ? (
                                                    <div className="tree-empty-item" style={{ paddingLeft: '74px' }}>No outputs</div>
                                                ) : (
                                                    datasetOutputs[ds.id].map((runOutput) => (
                                                        <TreeItem
                                                            key={runOutput.run_id}
                                                            level={4}
                                                            label={runOutput.run_name}
                                                        >
                                                            {runOutput.files.map((file, fIdx) => (
                                                                <TreeItem
                                                                    key={fIdx}
                                                                    level={5}
                                                                    label={file.name}
                                                                    isLeaf={true}
                                                                    onClick={() => handleTensorClick({
                                                                        tensor_name: file.name,
                                                                        name: file.filename,
                                                                        size_bytes: file.size_bytes,
                                                                        shape: file.shape,
                                                                        dtype: file.dtype,
                                                                        statistics: file.statistics
                                                                    })}
                                                                />
                                                            ))}
                                                        </TreeItem>
                                                    ))
                                                )}
                                            </TreeItem>
                                        </TreeItem>
                                    ))
                                )}
                            </TreeItem>

                            {/* Level 1: Runs (Sibling of Datasets) */}
                            <TreeItem
                                level={1}
                                label="Runs"
                                expanded={expandedModelRuns.has(model.id)}
                                onToggle={(e) => toggleExpandModelRuns(e, model.id)}
                            >
                                {(modelRuns[model.id] || []).length === 0 ? (
                                    <div className="tree-empty-item" style={{ paddingLeft: '42px' }}>No runs</div>
                                ) : (
                                    modelRuns[model.id].map(run => {
                                        // Find dataset name
                                        const dsList = datasets[model.id] || [];
                                        const ds = dsList.find(d => d.id === run.dataset_id);
                                        const dsName = ds ? ds.name : 'Unknown';

                                        return (
                                            <TreeItem
                                                key={run.id}
                                                level={2}
                                                label={run.name || `${dsName}_${new Date(run.start_time).toLocaleString()}`}
                                                isLeaf={true}
                                                onClick={() => handleRunClick(run, model)}
                                                actions={
                                                    <button
                                                        className="play-trace-btn"
                                                        onClick={(e) => handlePlayTrace(e, run, model)}
                                                        title="Play Trace Animation"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)' }}
                                                    >
                                                        ▶
                                                    </button>
                                                }
                                            />
                                        );
                                    })
                                )}
                            </TreeItem>
                        </TreeItem>
                    );
                })}
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

            {isRunModalOpen && (
                <RunInferenceModal
                    model={targetModel}
                    onClose={() => setIsRunModalOpen(false)}
                />
            )}
        </div>
    );
};
export default ModelExplorer;
