import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'PG-NEXUS | Masan Consumer',
  description: 'Nền tảng Đào tạo Kỹ năng PG Masan Consumer',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PG-NEXUS' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#C8102E',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A1A28',
              color: '#F0F0F8',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              fontSize: '0.875rem',
              maxWidth: '380px',
            },
            success: { iconTheme: { primary: '#FFB800', secondary: '#1A0A00' } },
            error: { iconTheme: { primary: '#C8102E', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
