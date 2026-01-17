import React from 'react';

const Sidebar = ({ title, children, side = 'left', isOpen }) => {
    if (!isOpen) return null;

    return (
        <div className={`sidebar sidebar-${side}`}>
            <div className="sidebar-header">
                <span className="sidebar-title">{title}</span>
            </div>
            <div className="sidebar-content">
                {children}
            </div>
        </div>
    );
};

export default Sidebar;
