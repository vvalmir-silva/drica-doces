import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// Separa bibliotecas (React, Supabase, ícones) do código da loja: melhor cache entre versões.
export default defineConfig({
  plugins:[react()],
  server:{host:'0.0.0.0'},
  build:{rollupOptions:{output:{manualChunks(id){
    if(!id.includes('node_modules'))return;
    if(id.includes('@supabase'))return 'supabase';
    if(id.includes('lucide-react'))return 'icons';
    if(/node_modules\/(react|react-dom|scheduler)\//.test(id))return 'react';
  }}}}
});
