import type { GameState, ResourceId } from '../state';

const RESOURCE_LABELS: Record<ResourceId, string> = {
  lumens: 'Lumens',
  energy: 'Energy',
  happiness: 'Happiness',
  contrast: 'Contrast',
  wonder: 'Wonder',
};

/** Renders the resource readout panel, skipping resources not yet revealed to the player. */
export function renderResourcePanel(container: HTMLElement, state: GameState): void {
  container.innerHTML = '';
  container.className = 'panel';

  for (const id of Object.keys(state.resources) as ResourceId[]) {
    if (state.hiddenResources.includes(id)) {
      continue;
    }
    const row = document.createElement('div');
    row.className = 'resource-row';

    const label = document.createElement('span');
    label.textContent = RESOURCE_LABELS[id];

    const value = document.createElement('span');
    value.textContent = formatResourceValue(id, state.resources[id]);

    row.append(label, value);
    container.appendChild(row);
  }
}

function formatResourceValue(id: ResourceId, value: number): string {
  if (id === 'happiness') {
    return `${Math.round(value * 100)}%`;
  }
  return value.toFixed(1);
}
