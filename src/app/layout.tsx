import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import 'react-toastify/dist/ReactToastify.css';
const inter = Inter({ subsets: ['latin'] })
export const metadata: Metadata = {
  title: 'Video Editor',
  description: 'Welcome to the Video Editor app'
}
  import { ToastContainer } from 'react-toastify';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
         <ToastContainer position="top-right"/>
        {children}
        </body>
     
    </html>
  )
}
