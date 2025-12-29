import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MainWorkspace from './MainWorkspace';
import ModelExplorer from './ModelExplorer';
import useUIStore from '../store/uiStore';

import NodeInspector from './NodeInspector';

const Layout = () => {
    const { leftPanelOpen, rightPanelOpen } = useUIStore();

    return (
        <div className="app-container">
            <Header />
            <div className="main-content">
                <Sidebar title="EXPLORER" side="left" isOpen={leftPanelOpen}>
                    <ModelExplorer />
                </Sidebar>

                <MainWorkspace />

                <Sidebar title="INSPECTOR" side="right" isOpen={rightPanelOpen}>
                    <NodeInspector />
                </Sidebar>
            </div>
        </div>
    );
};

export default Layout;
