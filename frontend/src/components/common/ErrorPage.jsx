import React from 'react';

const ErrorPage = ({ code = 500, message = "Something went wrong" }) => {
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1e1e1e',
            color: '#cccccc',
            fontFamily: 'Segoe UI, sans-serif'
        }}>
            <h1 style={{
                fontSize: '120px',
                fontWeight: '200',
                margin: '0',
                opacity: '0.2'
            }}>
                {code}
            </h1>
            <div style={{
                fontSize: '24px',
                marginBottom: '20px',
                fontWeight: '500'
            }}>
                {message}
            </div>
            <p style={{
                maxWidth: '400px',
                textAlign: 'center',
                color: '#858585',
                marginBottom: '30px'
            }}>
                The server encountered an error or is unreachable. Please check your connection or try again later.
            </p>
            <button
                onClick={() => window.location.reload()}
                style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: '#007fd4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer'
                }}
            >
                Reload Application
            </button>
        </div>
    );
};

export default ErrorPage;
