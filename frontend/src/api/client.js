const API_BASE = 'http://localhost:8000';

// Generate a random session ID on page load.
// This ID is lost when the page is refreshed (memory only), effectively isolating the session.
// If we wanted it to persist across refreshes but not tabs, we'd use sessionStorage.
// But valid requirement: "Refresh = Reset" -> Memory is best.
const SESSION_ID = crypto.randomUUID();

console.log("Current Session ID:", SESSION_ID);

export const uploadModel = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/models/upload`, {
        method: 'POST',
        headers: {
            'X-Session-Id': SESSION_ID,
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Upload failed');
    }

    return response.json();
};

export const getModels = async () => {
    // Pass session_id to backend to filter models
    const response = await fetch(`${API_BASE}/models?session_id=${SESSION_ID}`);

    if (!response.ok) {
        throw new Error('Failed to fetch models');
    }

    return response.json();
};
