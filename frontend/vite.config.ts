import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Standard Vite + React setup. Dev server runs on port 5173.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
