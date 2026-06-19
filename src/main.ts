import './styles.css';
import { createInitialState, FINAL_ERA, type GameState, type ResourceId, type BuildingId } from './state';
import { loadFromLocalStorage, saveToLocalStorage, clearLocalStorage } from './game/save';
import { tick, totalLightOutput, canPowerBuilding, DEFAULT_DAY_LENGTH } from './systems/automation';
import { applyHappiness } from './systems/happiness';
import { applyWonder } from './systems/wonder';
import { applyDarkness } from './systems/darkness';
import { resolveEnding } from './systems/endings';
import { buyBuilding, BUILDINGS, buildingCost } from './game/buildings';
import { availableResearch, buyResearch, researchCost, RESEARCH } from './game/research';
import { tickEvents, EVENTS } from './game/events';
import { isBuildingUnlocked } from './systems/progression';
import { mountBackground, updateBackground } from './render/background';
import { mountVillage, updateVillage } from './render/village';
import { mountCity, updateCity } from './render/city';
import { mountPlanet, updatePlanet } from './render/planet';
import { mountUniverse, updateUniverse } from './render/universe';
import { applyTheme } from './ui/theme';
import { renderBuildingButtons } from './ui/buttons';
import { renderResearchCard, renderEventCard } from './ui/cards';
import { canAfford } from './game/resources';
import { formatNumber } from './ui/format';
import { buildingMaterialCost } from './game/buildings';

const TICKS_PER_SECOND = 5;
const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
const AUTOSAVE_INTERVAL_MS = 10_000;

const RESOURCE_LABELS: Record<ResourceId, string> = {
  lumens: 'Lumens',
  energy: 'Energy',
  fuel: 'Fuel',
  materials: 'Materials',
  exotic: 'Exotic Matter',
  happiness: 'Happiness',
  wonder: 'Wonder',
};

let state: GameState = loadFromLocalStorage() ?? createInitialState();
let dirty = true;

const app = document.getElementById('app')!;

const scene = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
scene.classList.add('scene');
app.appendChild(scene);

const resourcePanel = document.createElement('div');
app.appendChild(resourcePanel);

// Manual restart, available any time (not just from the ending overlay) -
// confirm() guards it since it permanently wipes the save.
const manualRestartButton = document.createElement('button');
manualRestartButton.className = 'restart-button manual-restart-button';
manualRestartButton.textContent = 'Restart';
manualRestartButton.addEventListener('click', () => {
  if (!window.confirm('Restart from the beginning? This wipes your current progress.')) {
    return;
  }
  clearLocalStorage();
  setState(createInitialState());
});
app.appendChild(manualRestartButton);

const buildingButtons = document.createElement('div');
app.appendChild(buildingButtons);

const researchPanel = document.createElement('div');
researchPanel.className = 'research-panel';
app.appendChild(researchPanel);

const eventPanel = document.createElement('div');
eventPanel.className = 'event-panel';
app.appendChild(eventPanel);

const endingOverlay = document.createElement('div');
endingOverlay.className = 'ending-overlay';
app.appendChild(endingOverlay);

function setState(next: GameState): void {
  state = next;
  dirty = true;
}

// --- Scene: background is mounted once and patched every tick; the
// phase-specific scene (village/city/planet/universe) is only torn down and
// remounted when the player actually crosses a phase boundary, not every
// tick. This is the fix for the "laggy/unplayable" full-DOM-rebuild bug. ---

const backgroundHandle = mountBackground(scene);

type SceneBucket = 1 | 2 | 3 | 4;

// Fire Age/Lamp Age (1-2, Camp/Hamlet) get the village scene; Gas Age
// through Cold Fusion Age (3-9, Village..Planet City) share the terrestrial
// city renderer (just more towers worth of light, not a new scene); Orbital
// Age/Stellar Age (10-11, Orbital/Stellar Civilization) get the globe; Dyson
// Age on (12-15, Dyson Civilization..Cosmic Civilization) share the universe
// renderer.
function sceneBucket(phase: number): SceneBucket {
  if (phase >= 12) return 4;
  if (phase >= 10) return 3;
  if (phase >= 3) return 2;
  return 1;
}

let mountedBucket: SceneBucket | null = null;
let sceneRoot: SVGGElement | null = null;
let updateScene: (state: GameState, totalLight: number) => void = () => {};

function ensureSceneMounted(phase: number): void {
  const bucket = sceneBucket(phase);
  if (bucket === mountedBucket) {
    return;
  }
  sceneRoot?.remove();
  mountedBucket = bucket;
  if (bucket === 1) {
    const handle = mountVillage(scene);
    sceneRoot = handle.root;
    updateScene = (s, t) => updateVillage(handle, s, t);
  } else if (bucket === 2) {
    const handle = mountCity(scene);
    sceneRoot = handle.root;
    updateScene = (s, t) => updateCity(handle, s, t);
  } else if (bucket === 3) {
    const handle = mountPlanet(scene);
    sceneRoot = handle.root;
    updateScene = (s, t) => updatePlanet(handle, s, t);
  } else {
    const handle = mountUniverse(scene);
    sceneRoot = handle.root;
    updateScene = (s, t) => updateUniverse(handle, s, t);
  }
}

// --- Resource panel: rows are built once per visible-resource-set and
// patched (text only) every tick. ---

/** Below this, happiness is visibly throttling lumen production (automation.ts's tick()). */
const LOW_HAPPINESS_THRESHOLD = 0.5;

let resourceRowIds: ResourceId[] = [];
const resourceValueRefs = new Map<ResourceId, HTMLSpanElement>();
const resourceRowRefs = new Map<ResourceId, HTMLDivElement>();
let happinessNoteRef: HTMLSpanElement | null = null;
/** Balance ending's threshold — shown as a meter so "why do I need wonder" has a visible answer. */
const WONDER_GOAL = RESEARCH.balancedUniverse.wonderRequired!;
let wonderMeterRef: HTMLDivElement | null = null;
let wonderMeterFillRef: HTMLDivElement | null = null;
let darknessIndicatorRef: HTMLDivElement | null = null;

function formatResourceValue(id: ResourceId, value: number): string {
  if (id === 'happiness') {
    return `${Math.round(value * 100)}%`;
  }
  return formatNumber(value);
}

function rebuildResourcePanel(state: GameState): void {
  resourcePanel.innerHTML = '';
  resourcePanel.className = 'panel';
  resourceValueRefs.clear();
  resourceRowRefs.clear();
  happinessNoteRef = null;
  wonderMeterRef = null;
  wonderMeterFillRef = null;
  resourceRowIds = (Object.keys(state.resources) as ResourceId[]).filter(
    (id) => !state.hiddenResources.includes(id)
  );
  for (const id of resourceRowIds) {
    const row = document.createElement('div');
    row.className = 'resource-row';
    const label = document.createElement('span');
    label.textContent = RESOURCE_LABELS[id];
    const value = document.createElement('span');
    row.append(label, value);
    if (id === 'happiness') {
      happinessNoteRef = document.createElement('span');
      happinessNoteRef.className = 'resource-note';
      happinessNoteRef.textContent = 'production reduced';
      row.append(happinessNoteRef);
    }
    resourcePanel.appendChild(row);
    resourceValueRefs.set(id, value);
    resourceRowRefs.set(id, row);

    // Wonder is the Balance ending's currency (research.ts's
    // balancedUniverse.wonderRequired) — a meter under its row makes that
    // legible instead of it just being a number that goes up.
    if (id === 'wonder') {
      wonderMeterRef = document.createElement('div');
      wonderMeterRef.className = 'wonder-meter';
      wonderMeterFillRef = document.createElement('div');
      wonderMeterFillRef.className = 'wonder-meter-fill';
      wonderMeterRef.appendChild(wonderMeterFillRef);
      resourcePanel.appendChild(wonderMeterRef);
    }
  }

  // Cosmic Age (the final era): the endgame goal ("eliminate darkness via
  // the research chain, OR preserve it for Balance") is otherwise invisible
  // — darkness is hidden from the resource list entirely (it's not in
  // ResourceId, it's a top-level GameState field).
  darknessIndicatorRef = null;
  if (state.phase >= FINAL_ERA) {
    darknessIndicatorRef = document.createElement('div');
    darknessIndicatorRef.className = 'darkness-indicator';
    resourcePanel.appendChild(darknessIndicatorRef);
  }
}

function patchResourcePanel(state: GameState): void {
  for (const id of resourceRowIds) {
    resourceValueRefs.get(id)!.textContent = formatResourceValue(id, state.resources[id]);
  }
  const happinessRow = resourceRowRefs.get('happiness');
  if (happinessRow) {
    const low = state.resources.happiness < LOW_HAPPINESS_THRESHOLD;
    happinessRow.classList.toggle('low', low);
    if (happinessNoteRef) {
      happinessNoteRef.classList.toggle('visible', low);
    }
  }
  if (wonderMeterFillRef) {
    const fraction = Math.min(1, state.resources.wonder / WONDER_GOAL);
    wonderMeterFillRef.style.width = `${(fraction * 100).toFixed(1)}%`;
  }
  if (darknessIndicatorRef) {
    const eliminated = Math.round((1 - state.darkness) * 100);
    const branch = state.research.includes('darknessPreservation') ? 'Preserve' : 'Eliminate';
    darknessIndicatorRef.textContent = `Darkness eliminated: ${eliminated}% (${branch} branch)`;
  }
}

// --- Building buttons: rebuilt only when the unlocked/owned set changes;
// affordability (which flips every tick as lumens accumulate) is patched by
// toggling `disabled` on the cached buttons instead of rebuilding them. ---

let buildingButtonRefs: { id: BuildingId; button: HTMLButtonElement; cost: number }[] = [];

function rebuildBuildingButtons(snapshot: GameState): void {
  renderBuildingButtons(buildingButtons, snapshot, (id) => setState(buyBuilding(state, id)));
  // Query actual building buttons rather than indexing `children` directly —
  // renderBuildingButtons prepends a non-button `.power-summary` div from
  // Phase 2 onward, which previously shifted every ref off by one and made
  // the per-tick disabled-state patch (patchBuildingButtons) target the
  // wrong button.
  const buttons = buildingButtons.querySelectorAll<HTMLButtonElement>('button.building-button');
  buildingButtonRefs = (Object.keys(BUILDINGS) as BuildingId[])
    .filter((id) => isBuildingUnlocked(snapshot, id))
    .map((id, i) => ({
      id,
      button: buttons[i]!,
      cost: buildingCost(id, snapshot.buildings[id]),
    }));
}

function patchBuildingButtons(state: GameState): void {
  for (const ref of buildingButtonRefs) {
    const materialCost = buildingMaterialCost(ref.id);
    ref.button.disabled =
      !canAfford(state, 'lumens', ref.cost) ||
      !canAfford(state, 'materials', materialCost) ||
      !canPowerBuilding(state, ref.id);
  }
}

// --- Research cards: same pattern as building buttons. ---

let researchCardRefs: { id: keyof typeof RESEARCH; button: HTMLButtonElement; cost: number }[] = [];

function rebuildResearchPanel(snapshot: GameState): void {
  researchPanel.innerHTML = '';
  researchCardRefs = availableResearch(snapshot).map((card) => {
    const cost = researchCost(snapshot, card.id);
    const button = renderResearchCard(card, cost, canAfford(snapshot, 'lumens', cost), (id) =>
      setState(buyResearch(state, id))
    ) as HTMLButtonElement;
    researchPanel.appendChild(button);
    return { id: card.id, button, cost };
  });
}

function patchResearchPanel(state: GameState): void {
  // Recompute cost every tick rather than trusting the cached ref: materials
  // (and so researchCost's discount) keep accruing between structural
  // rebuilds, so a stale ref.cost would drift from what buyResearch actually
  // charges (issue #10).
  for (const ref of researchCardRefs) {
    const cost = researchCost(state, ref.id);
    ref.button.disabled = !canAfford(state, 'lumens', cost);
  }
}

function rebuildEventPanel(state: GameState): void {
  eventPanel.innerHTML = '';
  if (state.activeEvent) {
    eventPanel.appendChild(renderEventCard(EVENTS[state.activeEvent.id]));
  }
}

const ENDING_MESSAGES: Record<'infiniteLight' | 'balance', string> = {
  infiniteLight: 'Infinite Light: the numbers grow forever. The stars are gone.',
  balance: 'Things shine because something else does not.',
};

function rebuildEndingOverlay(ending: GameState['ending']): void {
  endingOverlay.innerHTML = '';
  endingOverlay.classList.remove('visible', 'ending-infiniteLight', 'ending-balance');
  if (!ending) {
    return;
  }
  endingOverlay.classList.add('visible', `ending-${ending}`);
  const message = document.createElement('p');
  message.textContent = ENDING_MESSAGES[ending];
  endingOverlay.appendChild(message);
  const restartButton = document.createElement('button');
  restartButton.className = 'restart-button';
  restartButton.textContent = 'Restart';
  restartButton.addEventListener('click', () => {
    // A reload would trigger the beforeunload autosave handler below, which
    // would write the just-ended state straight back to localStorage before
    // the page even unloads, undoing the clear. Reset in-memory instead.
    clearLocalStorage();
    setState(createInitialState());
  });
  endingOverlay.appendChild(restartButton);
}

/** Cheap signature of everything that affects panel *structure* (not raw resource numbers, which flow every tick). */
function structureSignature(state: GameState): string {
  return JSON.stringify({
    phase: state.phase,
    buildings: state.buildings,
    research: state.research,
    hiddenResources: state.hiddenResources,
    activeEvent: state.activeEvent?.id ?? null,
    ending: state.ending,
  });
}

let lastStructureSignature = '';

// Visual scene (sun/moon/clouds/sky) runs every animation frame so motion is
// smooth at display refresh rate, independent of the 5Hz sim tick.
function renderVisuals(renderState: GameState, totalLight: number): void {
  ensureSceneMounted(renderState.phase);
  updateBackground(backgroundHandle, renderState, totalLight);
  updateScene(renderState, totalLight);
  applyTheme(renderState, totalLight);
}

// Panels (resources/buttons/research/events/ending) only need to
// repaint when the underlying state actually changed - gated by `dirty`.
function renderPanels(state: GameState): void {
  const signature = structureSignature(state);
  if (signature !== lastStructureSignature) {
    lastStructureSignature = signature;
    rebuildResourcePanel(state);
    rebuildBuildingButtons(state);
    rebuildResearchPanel(state);
    rebuildEventPanel(state);
    rebuildEndingOverlay(state.ending);
  }

  patchResourcePanel(state);
  patchBuildingButtons(state);
  patchResearchPanel(state);
}

function advance(): void {
  // Once an ending is locked in, the simulation halts (the overlay says so;
  // it should actually be true). See systems/endings.ts.
  if (state.ending) {
    return;
  }
  let next = tick(state);
  next = tickEvents(next, Math.random);
  next = applyHappiness(next);
  next = applyDarkness(next);
  next = applyWonder(next);
  next = resolveEnding(next);
  setState(next);
}

// Fixed-timestep loop driven by requestAnimationFrame: production logic
// always advances in whole SECONDS_PER_TICK steps regardless of frame rate.
let accumulator = 0;
let lastFrameTime = performance.now();

function frame(now: number): void {
  const delta = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  accumulator += delta;

  if (!state.ending) {
    while (accumulator >= SECONDS_PER_TICK) {
      advance();
      accumulator -= SECONDS_PER_TICK;
    }
  }

  // Interpolate the clock by the leftover fraction of a tick so the sun/moon
  // glide continuously instead of snapping once per sim tick. Frozen (subTick
  // 0) once an ending is locked - the halted sim shouldn't keep drifting.
  const subTick = state.ending ? 0 : Math.min(1, accumulator / SECONDS_PER_TICK);
  const renderState: GameState =
    subTick === 0
      ? state
      : {
          ...state,
          dayNightClock: (state.dayNightClock + subTick * DEFAULT_DAY_LENGTH) % 1,
          tick: state.tick + subTick,
        };
  renderVisuals(renderState, totalLightOutput(renderState));

  if (dirty) {
    renderPanels(state);
    dirty = false;
  }

  requestAnimationFrame(frame);
}

renderPanels(state);
renderVisuals(state, totalLightOutput(state));
requestAnimationFrame(frame);

setInterval(() => saveToLocalStorage(state), AUTOSAVE_INTERVAL_MS);
window.addEventListener('beforeunload', () => saveToLocalStorage(state));
