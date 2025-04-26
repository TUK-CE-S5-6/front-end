// api.js
import axios from 'axios';

const BASE_URL = 'http://175.116.3.178:8000';

export const createAxiosInstance = (token = null) => {
  const resolvedToken = token || localStorage.getItem('authToken'); // ✅ 없으면 localStorage에서 가져오기

  const instance = axios.create({ baseURL: BASE_URL });

  instance.interceptors.request.use(
    (config) => {
      if (resolvedToken) {
        config.headers.Authorization = `Bearer ${resolvedToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  return instance;
};

