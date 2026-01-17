import React from 'react';
import useModelStore from '../../store/modelStore';
import GraphCanvas from '../common/GraphCanvas';

const MainWorkspace = () => {
    const { selectedModel } = useModelStore();

    return (
        <div className="workspace">
            {selectedModel ? (
                <GraphCanvas />
            ) : (
                <div className="watermark">
                    <h1>String Lights</h1>
                    <p>Drop ONNX model here or use Explorer</p>
                </div>
            )}
        </div>
    );
};

export default MainWorkspace;
