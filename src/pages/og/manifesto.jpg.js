// The manifesto page's share card (lib/ogImage.mjs, renderManifestoOg),
// written to dist/og/manifesto.jpg. A static route, so it wins over the
// per-presentation og/[slug].jpg.js.
import { renderManifestoOg } from '../../lib/ogImage.mjs';

export async function GET() {
  const jpg = await renderManifestoOg();
  return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
}
