import type { BuildingId, GameState } from '../state';
import { BUILDINGS, buildingCost, buildingMaterialCost } from '../game/buildings';
import { isBuildingUnlocked } from '../systems/progression';
import { canAfford } from '../game/resources';
import { canPowerBuilding, resolveEnergy, resolveFuel, resolveExotic } from '../systems/automation';
import { formatNumber } from './format';

/** Signed +/- formatting shared by lumen/energy/happiness meta lines. */
function signed(value: number, digits = 0): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

/**
 * Renders the current power balance above the building list, so the
 * power -> light relationship (Solar Farm/Power Plant feed the lights that
 * actually fill the planet) is visible instead of silent.
 */
function renderPowerSummary(state: GameState): HTMLElement {
  const { energyProduced, energyConsumed, consumersActive } = resolveEnergy(state);
  const surplus = energyProduced - energyConsumed;
  const summary = document.createElement('div');
  summary.className = 'power-summary';
  summary.classList.toggle('deficit', !consumersActive);
  summary.textContent = `Power: ${energyProduced.toFixed(0)} produced · ${energyConsumed.toFixed(0)} consumed · ${signed(surplus)} surplus`;
  return summary;
}

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

  const { energyRatio } = resolveEnergy(state);
  const { active: fuelActive } = resolveFuel(state);
  const { exoticRatio } = resolveExotic(state);
  if (state.phase >= 2) {
    container.appendChild(renderPowerSummary(state));
  }

  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    if (!isBuildingUnlocked(state, id)) {
      continue;
    }

    const def = BUILDINGS[id];
    const owned = state.buildings[id];
    const cost = buildingCost(id, owned);
    const materialCost = buildingMaterialCost(id);
    const powerable = canPowerBuilding(state, id);
    const affordable = canAfford(state, 'lumens', cost) && canAfford(state, 'materials', materialCost);

    const button = document.createElement('button');
    button.className = 'building-button';
    button.disabled = !affordable || !powerable;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${def.name} (${owned})`;

    // Cost sits on its own line (block .meta), separate from the details
    // line below it — otherwise the cost and the production/upkeep summary
    // ran together with no visual break.
    const costLine = document.createElement('span');
    costLine.className = 'meta';
    costLine.textContent =
      materialCost > 0
        ? `Cost: ${formatNumber(cost)} lumens + ${formatNumber(materialCost)} materials`
        : `Cost: ${formatNumber(cost)} lumens`;

    const meta = document.createElement('span');
    meta.className = 'meta';
    const parts: string[] = [];
    if (def.lumensPerUnit > 0) {
      parts.push(`+${def.lumensPerUnit}/tick`);
    }
    if (def.energyProducedPerUnit > 0) {
      parts.push(`+${def.energyProducedPerUnit} energy/tick`);
    }
    if (def.energyConsumedPerUnit > 0) {
      parts.push(`-${def.energyConsumedPerUnit} energy/tick`);
    }
    if (def.materialsPerUnit > 0) {
      parts.push(`+${def.materialsPerUnit} materials/tick`);
    }
    if (def.fuelProducedPerUnit > 0) {
      parts.push(`+${def.fuelProducedPerUnit} fuel/tick`);
    }
    if (def.fuelConsumedPerUnit > 0) {
      parts.push(`-${def.fuelConsumedPerUnit} fuel/tick`);
    }
    if (def.exoticProducedPerUnit > 0) {
      parts.push(`+${def.exoticProducedPerUnit} exotic/tick`);
    }
    if (def.exoticRequiredPerUnit > 0) {
      parts.push(`needs ${def.exoticRequiredPerUnit} exotic reserve/unit`);
    }
    if (def.maintenancePerUnit > 0) {
      parts.push(`-${def.maintenancePerUnit} lumens/tick upkeep`);
    }
    if (def.happinessPerUnit !== 0) {
      parts.push(`Happiness ${signed(def.happinessPerUnit * 100, 1)}%`);
    }
    if (!powerable) {
      parts.push('Needs power');
    } else if (owned > 0 && def.energyConsumedPerUnit > 0 && energyRatio < 1) {
      parts.push(`Dimmed — ${Math.round(energyRatio * 100)}% power`);
    } else if (owned > 0 && def.fuelConsumedPerUnit > 0 && !fuelActive) {
      parts.push('Idle — no fuel');
    } else if (owned > 0 && def.exoticRequiredPerUnit > 0 && exoticRatio < 1) {
      parts.push(`Dimmed — ${Math.round(exoticRatio * 100)}% exotic reserve`);
    } else if (materialCost > 0 && !canAfford(state, 'materials', materialCost)) {
      parts.push('Needs materials');
    }
    meta.textContent = parts.join(' · ');

    button.append(name, costLine);
    if (parts.length > 0) {
      button.append(meta);
    }
    button.addEventListener('click', () => onBuy(id));
    container.appendChild(button);
  }
}
