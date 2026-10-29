import './globals.css';

export const metadata = {
  title: 'Lucira POS Admin',
  description: 'Internal data viewer for lucira-pos — not part of the POS app itself.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
