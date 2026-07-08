export default function manifest() {
  return {
    name: 'Financial Planning & Analysis',
    short_name: 'FPA',
    description: 'A modern, premium expense and income dashboard',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#6366f1',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
