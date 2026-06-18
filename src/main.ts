import './styles.css';
import { createInitialState, type GameState } from './state';
import { loadFromLocalStorage, saveToLocalStorage } from './game/save';
import { tick, totalLightOutput } from './systems/automation';
import { applyHappiness } from './systems/happiness';
import { applyContrast } from './systems/contrast';
import { applyWonder } from './systems/wonder';
import { applyDarkness } from './systems/darkness';
import { resolveEnding } from './systems/endings';
import { buyBuilding } from './game/buildings';
import { availableResearch, buyResearch } from './game/research';
import { tickEvents, EVENTS } from './game/events';
import { renderBackground } from './render/background';
import { renderVillage } from './render/village';
import { renderCity } from './render/city';
import { renderPlanet } from './render/planet';
import { renderUniverse } from './render/universe';
import { applyTheme } from './ui/theme';
import { renderResourcePanel } from './ui/panels';
import { renderBuildingButtons } from './ui/buttons';
import { renderResearchCard, renderEventCard } from './ui/cards';
import { renderPrioritySlider } from './ui/sliders';
import { canAfford } from './game/resources';

const TICKS_PER_SECOND = 5;
const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
const AUTOSAVE_INTERVAL_MS = 10_000;

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

function render(): void {
  const totalLight = totalLightOutput(state);
  renderBackground(scene, state, totalLight);
  if (state.phase >= 4) {
    renderUniverse(scene, state, totalLight);
  } else if (state.phase >= 3) {
    renderPlanet(scene, state, totalLight);
  } else if (state.phase >= 2) {
    renderCity(scene, state, totalLight);
  } else {
    renderVillage(scene, state, totalLight);
  }
  applyTheme(state, totalLight);
  renderResourcePanel(resourcePanel, state);
  renderBuildingButtons(buildingButtons, state, (id) => {
    setState(buyBuilding(state, id));
  });

  researchPanel.innerHTML = '';
  for (const card of availableResearch(state)) {
    researchPanel.appendChild(
      renderResearchCard(card, canAfford(state, 'lumens', card.cost), (id) => {
        setState(buyResearch(state, id));
      })
    );
  }

  eventPanel.innerHTML = '';
  if (state.activeEvent) {
    eventPanel.appendChild(renderEventCard(EVENTS[state.activeEvent.id]));
  }

  priorityPanel.innerHTML = '';
  for (const resource of ['lumens', 'energy', 'happiness', 'contrast', 'wonder'] as const) {
    if (state.hiddenResources.includes(resource)) {
      continue;
    }
    priorityPanel.appendChild(
      renderPrioritySlider(resource, state.priorities[resource], (next) => {
        setState({ ...state, priorities: { ...state.priorities, [resource]: next } });
      })
    );
  }

  renderEndingOverlay(state.ending);
}

const ENDING_MESSAGES: Record<'infiniteLight' | 'balance', string> = {
  infiniteLight: 'Infinite Light: the numbers grow forever. The stars are gone.',
  balance: 'Things shine because something else does not.',
};

function renderEndingOverlay(ending: GameState['ending']): void {
  endingOverlay.innerHTML = '';
  if (!ending) {
    endingOverlay.classList.remove('visible');
    return;
  }
  endingOverlay.classList.add('visible', `ending-${ending}`);
  const message = document.createElement('p');
  message.textContent = ENDING_MESSAGES[ending];
  endingOverlay.appendChild(message);
}

function advance(): void {
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

  while (accumulator >= SECONDS_PER_TICK) {
    advance();
    accumulator -= SECONDS_PER_TICK;
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
