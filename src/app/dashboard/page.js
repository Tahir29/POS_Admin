import Link from 'next/link';
import { getDb, COLLECTIONS } from '@/lib/mongo';

async function getCounts() {
  const db = await getDb();
  const [abandonedCarts, wishlist, recentlyViewed, customers] = await Promise.all([
    db.collection(COLLECTIONS.ABANDONED_CARTS).estimatedDocumentCount(),
    db.collection(COLLECTIONS.WISHLIST).estimatedDocumentCount(),
    db.collection(COLLECTIONS.RECENTLY_VIEWED).estimatedDocumentCount(),
    db.collection(COLLECTIONS.CUSTOMERS).estimatedDocumentCount(),
  ]);
  return { abandonedCarts, wishlist, recentlyViewed, customers };
}

const CARDS = [
  { key: 'abandonedCarts', label: 'Abandoned Carts', href: '/dashboard/abandoned-carts' },
  { key: 'wishlist',       label: 'Wishlist Items',  href: '/dashboard/wishlist' },
  { key: 'recentlyViewed', label: 'Recently Viewed',  href: '/dashboard/recently-viewed' },
  { key: 'customers',      label: 'Customer Profiles', href: '/dashboard/customers' },
];

export default async function DashboardHomePage() {
  const counts = await getCounts();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{counts[card.key]}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
