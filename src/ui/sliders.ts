import type { ResourceId } from '../state';

const RESOURCE_LABELS: Record<ResourceId, string> = {
  lumens: 'Lumens',
  energy: 'Energy',
  happiness: 'Happiness',
  contrast: 'Contrast',
  wonder: 'Wonder',
};

/**
 * Renders one automation priority slider (spec: "Automation" priority
 * sliders). The slider holds a relative weight - `sharePercent` is the
 * resource's actual share of the allocation pool (priorities.ts), shown so
 * the player can see the tradeoff land, not just the raw 0..1 weight.
 */
export function renderPrioritySlider(
  resource: ResourceId,
  value: number,
  sharePercent: number,
  onChange: (next: number) => void
): HTMLElement {
  const row = document.createElement('label');
  row.className = 'priority-slider';

  const label = document.createElement('span');
  label.textContent = `${RESOURCE_LABELS[resource]} — ${Math.round(sharePercent)}%`;

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.value = String(value);
  input.addEventListener('input', () => onChange(Number(input.value)));

  row.append(label, input);
  return row;
}
