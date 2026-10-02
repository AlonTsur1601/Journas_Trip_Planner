export function worldViewportLimits(width: number, height: number, bearing: number, zoom: number, centerY: number) {
  const minZoom = Math.max(0, Math.log2(Math.hypot(width, height) / 512) + 0.01);
  const angle = bearing * Math.PI / 180;
  const halfHeight = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / (2 * 512 * 2 ** Math.max(zoom, minZoom));
  return { minZoom, centerY: Math.max(halfHeight, Math.min(1 - halfHeight, centerY)), halfHeight };
}
