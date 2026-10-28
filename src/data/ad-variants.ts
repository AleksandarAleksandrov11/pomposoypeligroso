/**
 * Versión del inicio (hero) según el anuncio de Meta del que llega la visita.
 *
 * El script del <head> (Base.astro) lee utm_content y, si no encaja con ninguna regla, utm_campaign;
 * guarda la versión en sessionStorage (pyp_ad_variant) y pone data-ad="<versión>" en <html> antes
 * del primer pintado. Hero.astro pinta todas las versiones y el CSS muestra solo la activa.
 *
 * Coincidencia: el texto de la regla aparece en el parámetro, sin distinguir mayúsculas.
 * Si el nombre real de la campaña de cierre no contiene ninguna de estas palabras, añádelo aquí.
 */
export type AdVariant = 'descubrir' | 'cierre';

export const DEFAULT_VARIANT: AdVariant = 'descubrir';

export const AD_VARIANT_RULES: { variant: AdVariant; match: string[] }[] = [
  // La campaña de cierre (MOFU/BOFU) se llama CERRAR
  { variant: 'cierre', match: ['cerrar', 'cierre', 'retargeting', 'remarketing', 'mofu', 'bofu'] },
  { variant: 'descubrir', match: ['descubrir', 'tofu'] },
];

function matchVariant(value: string | null | undefined): AdVariant | null {
  const v = (value ?? '').toLowerCase();
  if (!v) return null;
  for (const rule of AD_VARIANT_RULES) {
    if (rule.match.some((m) => v.includes(m.toLowerCase()))) return rule.variant;
  }
  return null;
}

/** Versión a partir de los parámetros del anuncio, o null si no encajan con ninguna regla. */
export function pickVariant(utmContent?: string | null, utmCampaign?: string | null): AdVariant | null {
  return matchVariant(utmContent) ?? matchVariant(utmCampaign);
}

/**
 * Preselección del formulario según el anuncio (utm_content). Si el nombre de un anuncio permite
 * deducir la edad o la experiencia, añade aquí una regla; la opción queda marcada pero no avanza sola.
 * Vacía hasta conocer los nombres reales de los anuncios.
 */
export const AD_PRESELECT: { match: string; age_range?: string; experience?: string }[] = [];

export function pickPreselect(utmContent?: string | null): { age_range?: string; experience?: string } | null {
  const v = (utmContent ?? '').toLowerCase();
  if (!v) return null;
  const rule = AD_PRESELECT.find((r) => v.includes(r.match.toLowerCase()));
  return rule ? { age_range: rule.age_range, experience: rule.experience } : null;
}
