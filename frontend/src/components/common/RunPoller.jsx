
import React, { useState, useEffect, useRef } from 'react';
import { getRun } from '../../api/client';
import useNotificationStore from '../../store/notificationStore';

const RunPoller = () => {
    const [activeRuns, setActiveRuns] = useState([]); // List of runIds
    const { addNotification } = useNotificationStore();
    const timerRef = useRef(null);

    // Listen for new runs
    useEffect(() => {
        const handleRunStarted = (event) => {
            const { runId } = event.detail;
            setActiveRuns(prev => [...prev, runId]);
            addNotification(`Run ${runId.slice(0, 8)}... started`, 'info', 1500);
        };

        window.addEventListener('run-started', handleRunStarted);
        return () => window.removeEventListener('run-started', handleRunStarted);
    }, [addNotification]);

    // Polling Logic
    useEffect(() => {
        if (activeRuns.length === 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        const checkRuns = async () => {
            const completed = [];

            for (const runId of activeRuns) {
                try {
                    const run = await getRun(runId);
                    if (run.status === 'COMPLETED') {
                        addNotification(`Inference Completed! (ID: ${runId.slice(0, 8)})`, 'success', 1500);
                        completed.push(runId);
                    } else if (run.status === 'FAILED') {
                        addNotification(`Inference Failed. (ID: ${runId.slice(0, 8)})`, 'error', 3000);
                        completed.push(runId);
                    }
                } catch (error) {
                    console.error("Polling error:", error);
                }
            }

            if (completed.length > 0) {
                setActiveRuns(prev => prev.filter(id => !completed.includes(id)));
            }
        };

        timerRef.current = setInterval(checkRuns, 2000); // Poll every 2 seconds

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [activeRuns, addNotification]);

    return null; // Invisible component
};

export default RunPoller;
