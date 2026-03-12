import axios from 'axios';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://10.184.34.191:5000/api/v1',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to requests if it exists
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle token expiration
API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                const response = await axios.post(
                    `${API.defaults.baseURL}/auth/refresh-token`,
                    { refreshToken }
                );

                if (response.data.success) {
                    localStorage.setItem('accessToken', response.data.data.accessToken);
                    originalRequest.headers.Authorization = `Bearer ${response.data.data.accessToken}`;
                    return API(originalRequest);
                }
            } catch (refreshError) {
                // Redirect to login
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default API;