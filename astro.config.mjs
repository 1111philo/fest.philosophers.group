import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://fest.philosophers.group',
  integrations: [react()],
});
