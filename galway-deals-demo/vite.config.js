import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development, /api calls go to the Flask server on port 5000.
// On Vercel, vercel.json routes /api to the Python function instead.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
});
