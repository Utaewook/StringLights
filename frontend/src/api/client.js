const API_BASE = 'http://localhost:8000';

// Initialize session ID from localStorage or generate new one
// Per user feedback, we need persistence to see models after refresh
let SESSION_ID = localStorage.getItem('session_id');
if (!SESSION_ID) {
    SESSION_ID = crypto.randomUUID();
    // We will save this to localStorage only if user consents? 
    // Ideally yes, but for now let's save it to make the app work.
    // The CookieConsent component will handle the "policy" aspect later.
    localStorage.setItem('session_id', SESSION_ID);
}

console.log("Current Session ID:", SESSION_ID);

export const uploadModel = async (files) => {
    const formData = new FormData();
    // Support both single file and FileList/Array
    const fileList = files instanceof FileList ? Array.from(files) : (Array.isArray(files) ? files : [files]);

    fileList.forEach(file => {
        formData.append('files', file);
    });

    const response = await fetch(`${API_BASE}/models/upload`, {
        method: 'POST',
        headers: {
            'X-Session-Id': SESSION_ID,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed');
    }

    return response.json();
};

export const uploadModelFile = async (modelId, files) => {
    const formData = new FormData();
    const fileList = files instanceof FileList ? Array.from(files) : (Array.isArray(files) ? files : [files]);

    fileList.forEach(file => {
        formData.append('files', file);
    });

    const response = await fetch(`${API_BASE}/models/${modelId}/upload_file`, {
        method: 'POST',
        headers: {
            'X-Session-Id': SESSION_ID,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed');
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

// Simple wrapper for API calls to match axios-like usage in some components
export const api = {
    post: async (path, data, config = {}) => {
        const url = `${API_BASE}${path}`;
        const isFormData = data instanceof FormData;

        const headers = {
            'X-Session-Id': SESSION_ID,
            ...config.headers,
        };

        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: isFormData ? data : JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw { response: { data: errorData }, message: errorData.detail || response.statusText };
        }

        return response.json();
    }
};

export const getDatasets = async (modelId) => {
    const response = await fetch(`${API_BASE}/datasets/${modelId}/datasets`);
    if (!response.ok) throw new Error('Failed to fetch datasets');
    return response.json();
};

export const getTensors = async (modelId, datasetId) => {
    const response = await fetch(`${API_BASE}/datasets/${modelId}/datasets/${datasetId}/tensors`);
    if (!response.ok) throw new Error('Failed to fetch tensors');
    return response.json();
};

export const createRun = async (modelId, datasetId) => {
    const response = await api.post('/runs/', { model_id: modelId, dataset_id: datasetId });
    return response;
};

export const getRun = async (runId) => {
    const response = await fetch(`${API_BASE}/runs/${runId}`);
    if (!response.ok) throw new Error('Failed to fetch run status');
    return response.json();
};

export const getRunTrace = async (runId) => {
    const response = await fetch(`${API_BASE}/runs/${runId}/trace`);
    if (!response.ok) throw new Error('Failed to fetch run trace');
    return response.json();
};
