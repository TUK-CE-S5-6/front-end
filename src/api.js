// api.js
import axios from 'axios';

const BASE_URL =
  'http://175.116.3.178:8000';

export const createAxiosInstance = (token = null) => {
  const instance = axios.create({ baseURL: BASE_URL });
  instance.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  return instance;
};
