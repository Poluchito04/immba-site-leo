import { defineConfig } from 'vite'
import { resolve } from 'path'
export default defineConfig({
  build: { rollupOptions: { input: {
    main: resolve(__dirname, 'index.html'),
    faculty: resolve(__dirname, 'faculty.html'),
    admin: resolve(__dirname, 'admin.html'),
    page: resolve(__dirname, 'page.html'),
    downloads: resolve(__dirname, 'downloads.html'),
    marketplace: resolve(__dirname, 'marketplace.html'),
    project: resolve(__dirname, 'project.html')
  } } }
})
