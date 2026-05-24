import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────
export const authAPI = {
  googleLogin: (credential) => api.post("/api/auth/google", { credential }),
  getMe: () => api.get("/api/auth/me"),
  logout: () => api.post("/api/auth/logout"),
};

// ── Listings ─────────────────────────────
export const listingsAPI = {
  getAll: (params) => api.get("/api/listings", { params }),
  getOne: (id) => api.get(`/api/listings/${id}`),
  create: (formData) => api.post("/api/listings", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  update: (id, formData) => api.put(`/api/listings/${id}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  delete: (id) => api.delete(`/api/listings/${id}`),
  toggleSold: (id) => api.patch(`/api/listings/${id}/sold`),
  toggleWishlist: (id) => api.post(`/api/listings/${id}/wishlist`),
  removeImage: (id, publicId) => api.delete(`/api/listings/${id}/images/${encodeURIComponent(publicId)}`),
};

// ── Chats ─────────────────────────────────
export const chatsAPI = {
  getAll: () => api.get("/api/chats"),
  getOne: (id) => api.get(`/api/chats/${id}`),
  start: (listingId) => api.post("/api/chats", { listingId }),
  send: (id, data) => api.post(`/api/chats/${id}/messages`, data),
};

// ── Users ─────────────────────────────────
export const usersAPI = {
  getWishlist: () => api.get("/api/users/me/wishlist"),
  getNotifications: () => api.get("/api/users/me/notifications"),
  markAllRead: () => api.put("/api/users/me/notifications/read-all"),
  updateProfile: (data) => api.put("/api/users/me", data),
  getProfile: (id) => api.get(`/api/users/${id}`),
  rate: (id, stars) => api.post(`/api/users/${id}/rate`, { stars }),
};

// ── AI ────────────────────────────────────
export const aiAPI = {
  generateDescription: (data) => api.post("/api/ai/generate-description", data),
  suggestPrice: (data) => api.post("/api/ai/suggest-price", data),
  generateTags: (data) => api.post("/api/ai/generate-tags", data),
  detectSpam: (data) => api.post("/api/ai/detect-spam", data),
  assistant: (data) => api.post("/api/ai/assistant", data),
  negotiationTips: (data) => api.post("/api/ai/negotiation-tips", data),
};

export default api;
