import React, { useState, useEffect } from 'react';

const CookieConsent = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consented = localStorage.getItem('cookie_consent');
        if (!consented) {
            setVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookie_consent', 'true');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-tertiary)', // Using theme var
            color: 'var(--text-primary)',
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            zIndex: 1000,
            borderTop: '1px solid var(--border-color)'
        }}>
            <div style={{ marginRight: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    We use cookies and local storage to maintain your session and manage your models.
                    By continuing to use this site, you agree to our use of these technologies.
                </p>
            </div>
            <button
                onClick={handleAccept}
                style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                Accept
            </button>
        </div>
    );
};

export default CookieConsent;
