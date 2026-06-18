import './styles.css';
import { createInitialState, type GameState, type ResourceId, type BuildingId } from './state';
import { loadFromLocalStorage, saveToLocalStorage, clearLocalStorage } from './game/save';
import { tick, totalLightOutput } from './systems/automation';
import { applyHappiness } from './systems/happiness';
import { applyContrast } from './systems/contrast';
import { applyWonder } from './systems/wonder';
import { applyDarkness } from './systems/darkness';
import { resolveEnding } from './systems/endings';
import { buyBuilding, BUILDINGS, buildingCost } from './game/buildings';
import { availableResearch, buyResearch, RESEARCH } from './game/research';
import { tickEvents, EVENTS } from './game/events';
import { isBuildingUnlocked } from './systems/progression';
import { priorityShare } from './systems/priorities';
import { mountBackground, updateBackground } from './render/background';
import { mountVillage, updateVillage } from './render/village';
import { mountCity, updateCity } from './render/city';
import { mountPlanet, updatePlanet } from './render/planet';
import { mountUniverse, updateUniverse } from './render/universe';
import { applyTheme } from './ui/theme';
import { renderBuildingButtons } from './ui/buttons';
import { renderResearchCard, renderEventCard } from './ui/cards';
import { renderPrioritySlider } from './ui/sliders';
import { canAfford } from './game/resources';

const TICKS_PER_SECOND = 5;
const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
const AUTOSAVE_INTERVAL_MS = 10_000;

const RESOURCE_LABELS: Record<ResourceId, string> = {
  lumens: 'Lumens',
  energy: 'Energy',
  happiness: 'Happiness',
  contrast: 'Contrast',
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

const buildingButtons = document.createElement('div');
app.appendChild(buildingButtons);

const researchPanel = document.createElement('div');
researchPanel.className = 'research-panel';
app.appendChild(researchPanel);

const eventPanel = document.createElement('div');
eventPanel.className = 'event-panel';
app.appendChild(eventPanel);

const priorityPanel = document.createElement('div');
priorityPanel.className = 'priority-panel';
app.appendChild(priorityPanel);

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

function sceneBucket(phase: number): SceneBucket {
  if (phase >= 4) return 4;
  if (phase >= 3) return 3;
  if (phase >= 2) return 2;
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

let resourceRowIds: ResourceId[] = [];
const resourceValueRefs = new Map<ResourceId, HTMLSpanElement>();

function formatResourceValue(id: ResourceId, value: number): string {
  if (id === 'happiness') {
    return `${Math.round(value * 100)}%`;
  }
  return value.toFixed(1);
}

function rebuildResourcePanel(state: GameState): void {
  resourcePanel.innerHTML = '';
  resourcePanel.className = 'panel';
  resourceValueRefs.clear();
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
    resourcePanel.appendChild(row);
    resourceValueRefs.set(id, value);
  }
}

function patchResourcePanel(state: GameState): void {
  for (const id of resourceRowIds) {
    resourceValueRefs.get(id)!.textContent = formatResourceValue(id, state.resources[id]);
  }
}

// --- Building buttons: rebuilt only when the unlocked/owned set changes;
// affordability (which flips every tick as lumens accumulate) is patched by
// toggling `disabled` on the cached buttons instead of rebuilding them. ---

let buildingButtonRefs: { id: BuildingId; button: HTMLButtonElement; cost: number }[] = [];

function rebuildBuildingButtons(state: GameState): void {
  renderBuildingButtons(buildingButtons, state, (id) => setState(buyBuilding(state, id)));
  buildingButtonRefs = (Object.keys(BUILDINGS) as BuildingId[])
    .filter((id) => isBuildingUnlocked(state, id))
    .map((id, i) => ({
      id,
      button: buildingButtons.children[i] as HTMLButtonElement,
      cost: buildingCost(id, state.buildings[id]),
    }));
}

function patchBuildingButtons(state: GameState): void {
  for (const ref of buildingButtonRefs) {
    ref.button.disabled = !canAfford(state, 'lumens', ref.cost);
  }
}

// --- Research cards: same pattern as building buttons. ---

let researchCardRefs: { id: keyof typeof RESEARCH; button: HTMLButtonElement; cost: number }[] = [];

function rebuildResearchPanel(state: GameState): void {
  researchPanel.innerHTML = '';
  researchCardRefs = availableResearch(state).map((card) => {
    const button = renderResearchCard(card, canAfford(state, 'lumens', card.cost), (id) =>
      setState(buyResearch(state, id))
    ) as HTMLButtonElement;
    researchPanel.appendChild(button);
    return { id: card.id, button, cost: card.cost };
  });
}

function patchResearchPanel(state: GameState): void {
  for (const ref of researchCardRefs) {
    ref.button.disabled = !canAfford(state, 'lumens', ref.cost);
  }
}

function rebuildEventPanel(state: GameState): void {
  eventPanel.innerHTML = '';
  if (state.activeEvent) {
    eventPanel.appendChild(renderEventCard(EVENTS[state.activeEvent.id]));
  }
}

// --- Priority sliders: rebuilt when the visible set or weights change
// (i.e. only on user interaction or a phase reveal), never on a plain tick. ---

function rebuildPriorityPanel(state: GameState): void {
  priorityPanel.innerHTML = '';
  for (const resource of ['lumens', 'energy', 'happiness', 'contrast', 'wonder'] as const) {
    if (state.hiddenResources.includes(resource)) {
      continue;
    }
    const sharePercent = priorityShare(state, resource) * 100;
    priorityPanel.appendChild(
      renderPrioritySlider(resource, state.priorities[resource], sharePercent, (next) => {
        setState({ ...state, priorities: { ...state.priorities, [resource]: next } });
      })
    );
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
    priorities: state.priorities,
  });
}

let lastStructureSignature = '';

function render(): void {
  const totalLight = totalLightOutput(state);

  ensureSceneMounted(state.phase);
  updateBackground(backgroundHandle, state, totalLight);
  updateScene(state, totalLight);
  applyTheme(state, totalLight);

  const signature = structureSignature(state);
  if (signature !== lastStructureSignature) {
    lastStructureSignature = signature;
    rebuildResourcePanel(state);
    rebuildBuildingButtons(state);
    rebuildResearchPanel(state);
    rebuildEventPanel(state);
    rebuildPriorityPanel(state);
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
  next = applyContrast(next);
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

  if (dirty) {
    render();
    dirty = false;
  }

  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(frame);

setInterval(() => saveToLocalStorage(state), AUTOSAVE_INTERVAL_MS);
window.addEventListener('beforeunload', () => saveToLocalStorage(state));
