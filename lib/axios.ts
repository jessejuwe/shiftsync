import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token interceptor when ready
// api.interceptors.request.use((config) => { ... });
