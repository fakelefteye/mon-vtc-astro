// Lecture et sauvegarde des tarifs via Vercel Blob (avec fallback sur site.config.ts)
import { siteConfig, type PricingConfig } from '../config/site.config';

const BLOB_PATHNAME = 'vtc-pricing-config.json';

export async function getPricing(): Promise<PricingConfig> {
  try {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: 'vtc-pricing' });
    const blob = blobs.find((b) => b.pathname === BLOB_PATHNAME);
    if (blob) {
      const res = await fetch(blob.url, { cache: 'no-store' });
      if (res.ok) return (await res.json()) as PricingConfig;
    }
  } catch {
    // Blob non configuré ou indisponible → utilise les valeurs par défaut
  }
  return siteConfig.pricing;
}

export async function savePricing(pricing: PricingConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_PATHNAME, JSON.stringify(pricing), {
      access: 'public',
      addRandomSuffix: false,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return { ok: false, error: msg };
  }
}
