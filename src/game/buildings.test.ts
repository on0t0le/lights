import { describe, expect, test } from 'vitest';
import { BUILDINGS, buildingCost, lumenOutput, energyUpkeep, energyProduction } from './buildings';

describe('BUILDINGS catalog', () => {
  test('defines the four Phase 1, three Phase 2, three Phase 3, and three Phase 4 buildings', () => {
    expect(Object.keys(BUILDINGS).sort()).toEqual(
      [
        'candle',
        'lantern',
        'lighthouse',
        'streetlamp',
        'powerPlant',
        'neonSign',
        'stadiumLights',
        'solarFarm',
        'fusionReactor',
        'orbitalMirror',
        'dysonSwarm',
        'whiteDwarfReactor',
        'stellarMirror',
      ].sort()
    );
  });

  test('Phase 1/2/3/4 buildings are tagged with their phase', () => {
    for (const id of ['candle', 'lantern', 'streetlamp', 'lighthouse'] as const) {
      expect(BUILDINGS[id].phase).toBe(1);
    }
    for (const id of ['powerPlant', 'neonSign', 'stadiumLights'] as const) {
      expect(BUILDINGS[id].phase).toBe(2);
    }
    for (const id of ['solarFarm', 'fusionReactor', 'orbitalMirror'] as const) {
      expect(BUILDINGS[id].phase).toBe(3);
    }
    for (const id of ['dysonSwarm', 'whiteDwarfReactor', 'stellarMirror'] as const) {
      expect(BUILDINGS[id].phase).toBe(4);
    }
  });

  test('White Dwarf Reactor produces energy and consumes none', () => {
    expect(BUILDINGS.whiteDwarfReactor.energyProducedPerUnit).toBeGreaterThan(0);
    expect(BUILDINGS.whiteDwarfReactor.energyConsumedPerUnit).toBe(0);
  });

  test('Dyson Swarm and Stellar Mirror produce a lot of light but consume energy', () => {
    for (const id of ['dysonSwarm', 'stellarMirror'] as const) {
      expect(BUILDINGS[id].lumensPerUnit).toBeGreaterThan(BUILDINGS.orbitalMirror.lumensPerUnit);
      expect(BUILDINGS[id].energyConsumedPerUnit).toBeGreaterThan(0);
    }
  });

  test('Solar Farm and Fusion Reactor produce energy and consume none', () => {
    for (const id of ['solarFarm', 'fusionReactor'] as const) {
      expect(BUILDINGS[id].energyProducedPerUnit).toBeGreaterThan(0);
      expect(BUILDINGS[id].energyConsumedPerUnit).toBe(0);
    }
  });

  test('Orbital Mirror produces a lot of light but consumes energy', () => {
    expect(BUILDINGS.orbitalMirror.lumensPerUnit).toBeGreaterThan(BUILDINGS.lighthouse.lumensPerUnit);
    expect(BUILDINGS.orbitalMirror.energyConsumedPerUnit).toBeGreaterThan(0);
  });

  test('Power Plant produces energy and consumes none', () => {
    expect(BUILDINGS.powerPlant.energyProducedPerUnit).toBeGreaterThan(0);
    expect(BUILDINGS.powerPlant.energyConsumedPerUnit).toBe(0);
  });

  test('Neon Sign and Stadium Lights consume energy and produce none', () => {
    for (const id of ['neonSign', 'stadiumLights'] as const) {
      expect(BUILDINGS[id].energyConsumedPerUnit).toBeGreaterThan(0);
      expect(BUILDINGS[id].energyProducedPerUnit).toBe(0);
    }
  });
});

describe('buildingCost', () => {
  test('base cost equals the building base cost when none owned', () => {
    expect(buildingCost('candle', 0)).toBe(BUILDINGS.candle.baseCost);
  });

  test('cost scales up with each owned unit', () => {
    const first = buildingCost('candle', 0);
    const second = buildingCost('candle', 1);
    expect(second).toBeGreaterThan(first);
  });
});

describe('lumenOutput', () => {
  test('zero owned produces zero lumens', () => {
    expect(lumenOutput('candle', 0)).toBe(0);
  });

  test('output scales linearly with owned count', () => {
    expect(lumenOutput('candle', 2)).toBe(BUILDINGS.candle.lumensPerUnit * 2);
  });
});

describe('energyUpkeep', () => {
  // Spec: energy consumption is introduced in Phase 2 (City), not Phase 1.
  // All four Village buildings run on no energy; the field exists for later phases.
  test('no Phase 1 building requires energy', () => {
    expect(energyUpkeep('candle', 5)).toBe(0);
    expect(energyUpkeep('lantern', 5)).toBe(0);
    expect(energyUpkeep('streetlamp', 5)).toBe(0);
    expect(energyUpkeep('lighthouse', 5)).toBe(0);
  });

  test('Phase 2 consumers require energy proportional to owned count', () => {
    expect(energyUpkeep('neonSign', 3)).toBe(BUILDINGS.neonSign.energyConsumedPerUnit * 3);
    expect(energyUpkeep('stadiumLights', 2)).toBe(BUILDINGS.stadiumLights.energyConsumedPerUnit * 2);
  });
});

describe('energyProduction', () => {
  test('zero owned produces zero energy', () => {
    expect(energyProduction('powerPlant', 0)).toBe(0);
  });

  test('Power Plant output scales linearly with owned count', () => {
    expect(energyProduction('powerPlant', 4)).toBe(BUILDINGS.powerPlant.energyProducedPerUnit * 4);
  });

  test('Phase 1 buildings produce no energy', () => {
    expect(energyProduction('candle', 10)).toBe(0);
  });
});
