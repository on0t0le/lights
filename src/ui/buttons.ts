import type { BuildingId, GameState } from '../state';
import { BUILDINGS, buildingCost } from '../game/buildings';
import { isBuildingUnlocked } from '../systems/progression';
import { canAfford } from '../game/resources';

/**
 * Renders one buy-button per unlocked building, across all phases up to the
 * player's current phase. `onBuy` is called with the building id when
 * clicked; the caller owns the state update + re-render.
 */
export function renderBuildingButtons(
  container: HTMLElement,
  state: GameState,
  onBuy: (id: BuildingId) => void
): void {
  container.innerHTML = '';
  container.className = 'buildings';

  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    if (!isBuildingUnlocked(state, id)) {
      continue;
    }

    const def = BUILDINGS[id];
    const owned = state.buildings[id];
    const cost = buildingCost(id, owned);

    const button = document.createElement('button');
    button.className = 'building-button';
    button.disabled = !canAfford(state, 'lumens', cost);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${def.name} (${owned})`;

    const meta = document.createElement('span');
    meta.className = 'meta';
    const parts = [`Cost: ${cost.toFixed(1)} lumens`];
    if (def.lumensPerUnit > 0) {
      parts.push(`+${def.lumensPerUnit}/tick`);
    }
    if (def.energyProducedPerUnit > 0) {
      parts.push(`+${def.energyProducedPerUnit} energy/tick`);
    }
    if (def.energyConsumedPerUnit > 0) {
      parts.push(`-${def.energyConsumedPerUnit} energy/tick`);
    }
    meta.textContent = parts.join(' · ');

    button.append(name, meta);
    button.addEventListener('click', () => onBuy(id));
    container.appendChild(button);
  }
}
