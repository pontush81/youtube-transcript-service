'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 100, price: 49, perCredit: '0.49' },
  { id: 'pro', name: 'Pro', credits: 500, price: 149, perCredit: '0.30', popular: true },
  { id: 'mega', name: 'Mega', credits: 2000, price: 449, perCredit: '0.22' },
];

export default function CreditsPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits');
        if (res.ok) {
          const data = await res.json();
          setCredits(data.balance);
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, []);

  async function handlePurchase(packageId: string) {
    setPurchasing(packageId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: packageId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        alert('Något gick fel. Försök igen.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Något gick fel. Försök igen.');
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Credits</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Köp credits för att chatta med din kunskapsbas
        </p>

        {success && (
          <div className="mb-8 p-4 bg-green-100 text-green-700 rounded-lg text-center">
            Köpet genomfördes! Dina credits har lagts till.
          </div>
        )}

        {canceled && (
          <div className="mb-8 p-4 bg-yellow-100 text-yellow-700 rounded-lg text-center">
            Köpet avbröts.
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-block bg-white dark:bg-gray-800 rounded-lg px-6 py-4 shadow">
            <span className="text-gray-600 dark:text-gray-400">Ditt saldo: </span>
            <span className="text-2xl font-bold">
              {loading ? '...' : credits ?? 0}
            </span>
            <span className="text-gray-600 dark:text-gray-400"> credits</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${
                pkg.popular ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {pkg.popular && (
                <div className="text-center mb-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    Populär
                  </span>
                </div>
              )}
              <h2 className="text-xl font-bold text-center mb-2">{pkg.name}</h2>
              <div className="text-center mb-4">
                <span className="text-3xl font-bold">{pkg.credits}</span>
                <span className="text-gray-600 dark:text-gray-400"> credits</span>
              </div>
              <div className="text-center mb-4">
                <span className="text-2xl font-bold">{pkg.price} kr</span>
              </div>
              <div className="text-center text-sm text-gray-500 mb-6">
                {pkg.perCredit} kr per fråga
              </div>
              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={purchasing !== null}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  pkg.popular
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {purchasing === pkg.id ? 'Laddar...' : 'Köp'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>1 credit = 1 chattfråga</p>
          <p>Att lägga till innehåll är gratis</p>
        </div>
      </div>
    </div>
  );
}
