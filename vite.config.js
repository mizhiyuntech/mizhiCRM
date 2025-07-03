import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { splitVendorChunkPlugin } from 'vite'

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production'
  
  return {
    plugins: [
      react({
        // Enable Fast Refresh
        fastRefresh: true,
        // Optimize dependencies
        include: "**/*.{jsx,tsx}",
      }),
      splitVendorChunkPlugin(),
      // Bundle analyzer
      process.env.ANALYZE && visualizer({
        filename: 'dist/bundle-analysis.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      })
    ].filter(Boolean),
    
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@services': resolve(__dirname, 'src/services'),
        '@assets': resolve(__dirname, 'src/assets'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@stores': resolve(__dirname, 'src/stores'),
      },
    },
    
    build: {
      // Target modern browsers for better optimization
      target: 'esnext',
      
      // Optimize chunks
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor dependencies
            'react-vendor': ['react', 'react-dom'],
            'ui-vendor': ['antd', '@ant-design/icons'],
            'utility-vendor': ['lodash-es', 'date-fns', 'axios'],
            'chart-vendor': ['recharts', 'chart.js'],
          },
          // Optimize chunk file names
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
            if (facadeModuleId) {
              const fileName = facadeModuleId.split('/').pop() || 'chunk'
              return `js/${fileName.replace('.js', '')}-[hash].js`
            }
            return 'js/[name]-[hash].js'
          },
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const extType = assetInfo.name?.split('.').pop()
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType || '')) {
              return `images/[name]-[hash][extname]`
            }
            if (/woff2?|eot|ttf|otf/i.test(extType || '')) {
              return `fonts/[name]-[hash][extname]`
            }
            return `assets/[name]-[hash][extname]`
          }
        },
        
        // External dependencies (for libraries)
        external: (id) => {
          // Don't bundle peer dependencies in library mode
          return false
        }
      },
      
      // Optimize build
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },
      
      // Source maps
      sourcemap: isProduction ? true : 'inline',
      
      // Chunk size warnings
      chunkSizeWarningLimit: 500,
      
      // Improve build performance
      reportCompressedSize: false,
    },
    
    server: {
      port: 3000,
      open: true,
      cors: true,
      // Proxy API calls during development
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    
    preview: {
      port: 4173,
      open: true,
    },
    
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'antd',
        'axios',
        'lodash-es',
        'date-fns'
      ],
      exclude: [
        // Exclude problematic dependencies
      ],
    },
    
    // CSS optimization
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
        generateScopedName: isProduction 
          ? '[hash:base64:8]' 
          : '[name]__[local]___[hash:base64:5]'
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`
        }
      },
      postcss: {
        plugins: [
          require('autoprefixer'),
          require('cssnano')({
            preset: 'default',
          }),
        ]
      }
    },
    
    // Environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    
    // Esbuild optimization
    esbuild: {
      jsxInject: `import React from 'react'`,
      // Remove console logs in production
      drop: isProduction ? ['console', 'debugger'] : [],
    },
  }
})