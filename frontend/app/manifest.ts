import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TaskPulse',
    short_name: 'TaskPulse',
    description: 'Smart and minimalist task management app',
    start_url: '/',
    display: 'standalone',
    background_color: '#1b1d27',
    theme_color: '#f5f5ff',
    icons: [
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      }
    ],
  }
}
