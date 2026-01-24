
import React from 'react';
import useNotificationStore from '../../store/notificationStore';
import './ToastContainer.css';

const ToastContainer = () => {
    const { notifications, removeNotification } = useNotificationStore();

    return (
        <div className="toast-container">
            {notifications.map(notif => (
                <div
                    key={notif.id}
                    className={`toast-notification ${notif.type}`}
                    onClick={() => removeNotification(notif.id)}
                >
                    <div className="toast-message">{notif.message}</div>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
