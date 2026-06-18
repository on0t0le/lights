import type { ResearchCard } from '../game/research';
import type { EventDef } from '../game/events';

/** Renders one research card as a simple rectangle with name/cost/description (spec: "simple rectangles with icons"). */
export function renderResearchCard(
  card: ResearchCard,
  affordable: boolean,
  onBuy: (id: ResearchCard['id']) => void
): HTMLElement {
  const button = document.createElement('button');
  button.className = 'research-card';
  button.disabled = !affordable;

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = card.name;

  const cost = document.createElement('span');
  cost.className = 'meta';
  cost.textContent = `Cost: ${card.cost.toFixed(0)} lumens`;

  button.append(name, cost);
  button.addEventListener('click', () => onBuy(card.id));
  return button;
}

/** Renders the currently active random event as a card (spec: "display events as cards"). */
export function renderEventCard(event: EventDef): HTMLElement {
  const div = document.createElement('div');
  div.className = 'event-card';

  const title = document.createElement('span');
  title.className = 'name';
  title.textContent = event.title;

  const description = document.createElement('span');
  description.className = 'meta';
  description.textContent = event.description;

  div.append(title, description);
  return div;
}
