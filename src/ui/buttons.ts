import type { BuildingId, GameState } from '../state';
import { BUILDINGS, buildingCost, buildingMaterialCost } from '../game/buildings';
import { isBuildingVisible } from '../systems/progression';
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
 * Renders the current fuel balance (Gas Age on) next to the power summary,
 * so a player adding Power Plants can see fuel draw outpacing Gas Works
 * production *before* it becomes an oscillating brownout (issue #11) -
 * instead of just discovering it via dimmed lights.
 */
function renderFuelSummary(state: GameState): HTMLElement {
  const { produced, consumed, fuelRatio } = resolveFuel(state);
  const summary = document.createElement('div');
  summary.className = 'power-summary fuel-summary';
  summary.classList.toggle('deficit', fuelRatio < 1);
  summary.textContent = `Fuel: ${produced.toFixed(0)} produced · ${consumed.toFixed(0)} consumed · ${formatNumber(state.resources.fuel)} stockpile`;
  return summary;
}

/**
 * Resource/power gating for a building's buy button. Recomputed every tick
 * (not just on structural rebuild) since lumens/energy/fuel/exotic ratios
 * all drift tick to tick without changing which buildings are unlocked.
 */
export function buildingButtonStatus(
  state: GameState,
  id: BuildingId
): { disabled: boolean; statusText: string; unmet: boolean } {
  const def = BUILDINGS[id];
  const owned = state.buildings[id];
  const cost = buildingCost(id, owned);
  const materialCost = buildingMaterialCost(id);
  const powerable = canPowerBuilding(state, id);
  const { fuelRatio } = resolveFuel(state);
  const { energyRatio } = resolveEnergy(state, fuelRatio);
  const { exoticRatio } = resolveExotic(state);
  const affordable = canAfford(state, 'lumens', cost) && canAfford(state, 'materials', materialCost);
  const needsMaterials = materialCost > 0 && !canAfford(state, 'materials', materialCost);
  const needsLumens = !canAfford(state, 'lumens', cost);

  let statusText = '';
  let unmet = false;
  if (!powerable) {
    statusText = 'Needs power';
    unmet = true;
  } else if (owned > 0 && def.energyConsumedPerUnit > 0 && energyRatio < 1) {
    statusText = `Dimmed — ${Math.round(energyRatio * 100)}% power`;
    unmet = true;
  } else if (owned > 0 && def.fuelConsumedPerUnit > 0 && fuelRatio < 1) {
    statusText = fuelRatio <= 0 ? 'Idle — no fuel' : `Dimmed — ${Math.round(fuelRatio * 100)}% fuel`;
    unmet = true;
  } else if (owned > 0 && def.exoticRequiredPerUnit > 0 && exoticRatio < 1) {
    statusText = `Dimmed — ${Math.round(exoticRatio * 100)}% exotic reserve`;
    unmet = true;
  } else if (needsMaterials) {
    statusText = 'Needs materials';
    unmet = true;
  } else if (needsLumens) {
    statusText = 'Needs lumens';
    unmet = true;
  }

  return { disabled: !affordable || !powerable, statusText, unmet };
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

  if (state.phase >= 2) {
    container.appendChild(renderPowerSummary(state));
  }
  if (state.phase >= 3 && !state.hiddenResources.includes('fuel')) {
    container.appendChild(renderFuelSummary(state));
  }

  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    if (!isBuildingVisible(state, id)) {
      continue;
    }

    const def = BUILDINGS[id];
    const owned = state.buildings[id];
    const cost = buildingCost(id, owned);
    const materialCost = buildingMaterialCost(id);
    const { disabled, statusText, unmet } = buildingButtonStatus(state, id);

    const button = document.createElement('button');
    button.className = 'building-button';
    button.disabled = disabled;

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
      parts.push(`+${def.lumensPerUnit} lumens/tick`);
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
    meta.textContent = parts.join(' · ');

    // Reserved status line (issue #8): always appended, even when empty, so
    // a tile's resource-shortfall phrase appearing/disappearing each tick
    // never resizes the tile or reflows the grid. `unmet` (issue #10) covers
    // every "you can't run this yet" case — not just the hard-disabled
    // unaffordable one — and names which resource is short. Patched every
    // tick by patchBuildingButtons (issue #16) since resource ratios drift
    // tick to tick without a structural rebuild.
    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = statusText;
    button.classList.toggle('unmet', unmet);

    button.append(name, costLine);
    if (parts.length > 0) {
      button.append(meta);
    }
    button.append(status);
    button.addEventListener('click', () => onBuy(id));
    container.appendChild(button);
  }
}
