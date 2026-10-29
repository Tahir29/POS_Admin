import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';

const FAVICON = 'https://luciraonline.myshopify.com/cdn/shop/files/Favicon_New_10.png?crop=center&height=32&v=1767615434&width=32';

export const metadata = {
  title: 'Lucira POS Admin',
  description: 'Internal data viewer for lucira-pos — not part of the POS app itself.',
  robots: { index: false, follow: false },
  icons: { icon: FAVICON, apple: FAVICON },
};

export const viewport = {
  themeColor: '#5A413F',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
