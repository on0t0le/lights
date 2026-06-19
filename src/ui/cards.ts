import type { ResearchCard } from '../game/research';
import { BUILDINGS } from '../game/buildings';
import type { EventDef } from '../game/events';
import { effectSummary } from '../game/events';
import { formatNumber } from './format';

const BRANCH_LABEL: Record<NonNullable<ResearchCard['branch']>, string> = {
  eliminate: '[Eliminate]',
  preserve: '[Preserve]',
};

/**
 * Human-readable summary of what buying this card actually gives - mirrors
 * events.ts's effectSummary, built from the same fields that drive the
 * mechanics (lumenMultiplier, unlocks, darknessDelta, branch, wonderRequired)
 * so "what will this give me" never needs guessing.
 */
function cardEffectSummary(card: ResearchCard): string {
  const parts: string[] = [];
  if (card.branch) {
    parts.push(BRANCH_LABEL[card.branch]);
  }
  if (card.lumenMultiplier && card.lumenMultiplier !== 1) {
    const pct = Math.round((card.lumenMultiplier - 1) * 100);
    parts.push(`Lumen production ${pct >= 0 ? '+' : ''}${pct}%`);
  }
  if (card.unlocks?.length) {
    parts.push(`Unlocks: ${card.unlocks.map((id) => BUILDINGS[id].name).join(', ')}`);
  }
  if (card.darknessDelta) {
    const pct = Math.round(card.darknessDelta * 100);
    parts.push(`Darkness ${pct >= 0 ? '+' : ''}${pct}%`);
  }
  if (card.wonderRequired) {
    parts.push(`Requires ${card.wonderRequired} wonder`);
  }
  return parts.join(' · ');
}

/**
 * Renders one research card as a simple rectangle with name/cost/description
 * (spec: "simple rectangles with icons"). `displayCost` is the actual price
 * `buyResearch` will charge (research.ts's researchCost, after the materials
 * discount, issue #2/#10) — callers must pass that instead of `card.cost`
 * so the shown price never drifts out of sync with what's actually charged.
 */
export function renderResearchCard(
  card: ResearchCard,
  displayCost: number,
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
  cost.textContent = `Cost: ${formatNumber(displayCost)} lumens`;

  button.append(name, cost);

  const summary = cardEffectSummary(card);
  if (summary) {
    const effect = document.createElement('span');
    effect.className = 'meta effect';
    effect.textContent = summary;
    button.append(effect);
  }

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

  const summary = effectSummary(event.effect);
  if (summary) {
    const effect = document.createElement('span');
    effect.className = 'meta effect';
    effect.textContent = summary;
    div.append(effect);
  }

  return div;
}
