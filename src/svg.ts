/**
 * Thin typed wrappers around document.createElementNS for procedurally
 * building SVG scenes. Spec requires everything to be vector-based with
 * no sprites/textures - these are the only primitives the renderers use.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

export function rect(attrs: Record<string, string | number>): SVGRectElement {
  return svgEl('rect', attrs);
}

export function circle(attrs: Record<string, string | number>): SVGCircleElement {
  return svgEl('circle', attrs);
}

export function ellipse(attrs: Record<string, string | number>): SVGEllipseElement {
  return svgEl('ellipse', attrs);
}

export function line(attrs: Record<string, string | number>): SVGLineElement {
  return svgEl('line', attrs);
}

export function path(attrs: Record<string, string | number>): SVGPathElement {
  return svgEl('path', attrs);
}

export function linearGradient(
  id: string,
  stops: { offset: string; color: string }[],
  attrs: Record<string, string | number> = {}
): SVGLinearGradientElement {
  const grad = svgEl('linearGradient', { id, ...attrs });
  for (const stop of stops) {
    grad.appendChild(svgEl('stop', { offset: stop.offset, 'stop-color': stop.color }));
  }
  return grad;
}

export function radialGradient(
  id: string,
  stops: { offset: string; color: string; opacity?: number }[],
  attrs: Record<string, string | number> = {}
): SVGRadialGradientElement {
  const grad = svgEl('radialGradient', { id, ...attrs });
  for (const stop of stops) {
    const stopAttrs: Record<string, string | number> = { offset: stop.offset, 'stop-color': stop.color };
    if (stop.opacity !== undefined) {
      stopAttrs['stop-opacity'] = stop.opacity;
    }
    grad.appendChild(svgEl('stop', stopAttrs));
  }
  return grad;
}

export function clear(el: SVGElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}
