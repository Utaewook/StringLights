
import React, { useState, useEffect } from 'react';
import { getDatasets, createRun } from '../../api/client';

const RunInferenceModal = ({ model, onClose }) => {
    const [datasets, setDatasets] = useState([]);
    const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
    const [selectedDatasetId, setSelectedDatasetId] = useState(null);
    const [runStatus, setRunStatus] = useState({ type: '', message: '' });
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        if (model) {
            loadDatasets();
        }
    }, [model]);

    const loadDatasets = async () => {
        setIsLoadingDatasets(true);
        try {
            const list = await getDatasets(model.id);
            setDatasets(list);
            if (list.length > 0) setSelectedDatasetId(list[0].id);
        } catch (error) {
            console.error("Failed to load datasets:", error);
        } finally {
            setIsLoadingDatasets(false);
        }
    };


    const handleRun = async () => {
        if (!selectedDatasetId) return;

        setIsRunning(true);
        setRunStatus({ type: '', message: '' });

        try {
            const response = await createRun(model.id, selectedDatasetId);

            // Add run to global store for polling (We need to implement this store next)
            // But for now, let's just show start notification

            // Close modal immediately
            onClose();

            // We will rely on a global poller to show "Completion" toast.
            // For now, assume the poller is managing it. 
            // If poller is not ready, we at least show "Started" here.

            // Actually, let's dispatch a custom event or use store to trigger polling
            window.dispatchEvent(new CustomEvent('run-started', { detail: { runId: response.id } }));

        } catch (error) {
            setRunStatus({
                type: 'error',
                message: `Failed to start run: ${error.message}`
            });
            setIsRunning(false); // Only stop running state on error
        }
    };

    if (!model) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Run Inference: {model.filename}</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Select Input Dataset:</label>
                        {isLoadingDatasets ? (
                            <div className="loading-spinner small">Loading datasets...</div>
                        ) : datasets.length === 0 ? (
                            <p className="empty-text">No datasets available. Please generate or upload inputs first.</p>
                        ) : (
                            <select
                                className="dataset-select"
                                value={selectedDatasetId}
                                onChange={(e) => setSelectedDatasetId(e.target.value)}
                            >
                                {datasets.map(ds => (
                                    <option key={ds.id} value={ds.id}>
                                        {ds.name} ({ds.type}) - {new Date(ds.created_at * 1000).toLocaleString()}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {runStatus.message && (
                        <div className={`status-banner ${runStatus.type}`}>
                            {runStatus.message}
                        </div>
                    )}

                    <div className="form-actions">
                        <button
                            className="secondary-btn"
                            onClick={onClose}
                            disabled={isRunning}
                        >
                            Cancel
                        </button>
                        <button
                            className="primary-btn"
                            onClick={handleRun}
                            disabled={isRunning || datasets.length === 0}
                        >
                            {isRunning ? 'Starting...' : 'Run Inference'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RunInferenceModal;
