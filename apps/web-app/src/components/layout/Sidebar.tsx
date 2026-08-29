import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  title: string;
  side: 'left' | 'right';
  isOpen: boolean;
  children: React.ReactNode;
}

export default function Sidebar({ title, side, isOpen, children }: SidebarProps) {
  return (
    <aside
      className={`sidebar sidebar-${side} ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}
    >
      <div className="sidebar-header">
        <span className="sidebar-title">{title}</span>
      </div>
      <div className="sidebar-body">{children}</div>
    </aside>
  );
}
