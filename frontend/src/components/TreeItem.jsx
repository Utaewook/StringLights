import React from 'react';

const TreeItem = ({
    label,
    level = 0,
    expanded,
    onToggle,
    onClick,
    isActive,
    icon,
    actions,
    children,
    isLeaf = false,
    className = ''
}) => {
    // VSCode style indentation: basic padding + level * indent
    const paddingLeft = 10 + (level * 16);

    const handleRowClick = (e) => {
        if (onClick) {
            onClick(e);
        } else if (onToggle) {
            onToggle(e);
        }
    };

    const handleToggleClick = (e) => {
        e.stopPropagation();
        if (onToggle) onToggle(e);
    };

    return (
        <div className={`tree-item-container ${className}`}>
            <div
                className={`tree-item-row ${isActive ? 'active' : ''}`}
                style={{ paddingLeft: `${paddingLeft}px` }}
                onClick={handleRowClick}
            >
                {/* Chevron / Toggle */}
                {!isLeaf ? (
                    <span
                        className={`tree-chevron ${expanded ? 'expanded' : ''}`}
                        onClick={handleToggleClick}
                    >
                        ▶
                    </span>
                ) : (
                    // Spacer for leaf nodes to align with text of folders
                    <span className="tree-chevron-spacer" />
                )}

                {/* Icon (Optional) */}
                {icon && <span className="tree-icon">{icon}</span>}

                {/* Label */}
                <span className="tree-label" title={typeof label === 'string' ? label : ''}>
                    {label}
                </span>

                {/* Actions (e.g. + button, tags) */}
                {actions && <div className="tree-actions">{actions}</div>}
            </div>

            {/* Children (Recursive render) */}
            {expanded && !isLeaf && children && (
                <div className="tree-children">
                    {children}
                </div>
            )}
        </div>
    );
};

export default TreeItem;
