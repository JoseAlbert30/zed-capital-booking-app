/**
 * API Configuration
 * 
 * Centralized API base URL configuration.
 * To change the API endpoint, either:
 * 1. Set NEXT_PUBLIC_API_URL environment variable in .env.local
 * 2. Or modify the fallback URL below
 * 
 * Examples:
 * - Local: http://localhost:8000/api
 * - Network: http://192.168.1.203:8000/api
 * - Production: https://api.yourdomain.com/api
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Get the base URL for storage files
 * Storage files are served from /api/storage/
 */
export const getStorageUrl = (path: string) => {
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}/api/storage/${path}`;
};

/**
 * Get the full API endpoint URL
 */
export const getApiUrl = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint}`;
};
