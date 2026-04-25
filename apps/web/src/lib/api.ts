import axios from "axios";
import { API_URL } from "../config";

const createRequestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Crucial for httpOnly cookies
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue: any[] = [];
let csrfToken: string | null = null;

const unsafeMethods = new Set(["post", "put", "patch", "delete"]);
const csrfExemptEndpoints = ["/auth/login", "/auth/register", "/auth/csrf"];

const isUnsafeRequest = (method?: string) => unsafeMethods.has((method || "get").toLowerCase());
const isCsrfExempt = (url?: string) => csrfExemptEndpoints.some((endpoint) => url?.includes(endpoint));

const rememberCsrfToken = (data: unknown) => {
  if (data && typeof data === "object" && "csrfToken" in data && typeof (data as { csrfToken?: unknown }).csrfToken === "string") {
    csrfToken = (data as { csrfToken: string }).csrfToken;
  }
};

const ensureCsrfToken = async () => {
  if (csrfToken) {
    return csrfToken;
  }

  const response = await axios.get(`${API_URL}/auth/csrf`, {
    withCredentials: true,
    headers: {
      "X-Request-ID": createRequestId(),
    },
  });
  rememberCsrfToken(response.data);
  return csrfToken;
};

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};

  if (!config.headers["X-Request-ID"] && !config.headers["x-request-id"]) {
    config.headers["X-Request-ID"] = createRequestId();
  }

  if (isUnsafeRequest(config.method) && !isCsrfExempt(config.url)) {
    const token = await ensureCsrfToken();
    if (token) {
      config.headers["X-CSRF-Token"] = token;
    }
  }

  return config;
});

// Response Interceptor for Silent Refresh
api.interceptors.response.use(
  (response) => {
    rememberCsrfToken(response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 401 Unauthorized + not already a retry + not critical auth endpoints
    const authEndpoints = ["/auth/login", "/auth/me", "/auth/refresh"];
    const isAuthRequest = authEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await api.get("/auth/refresh"); // Backend updates the cookie
        rememberCsrfToken(refreshResponse.data);
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Only redirect if we are NOT already on the login page to avoid infinite reload loops
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
