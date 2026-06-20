import { describe, expect, test } from 'vitest';
import { ERAS } from '../state';
import {
  BUILDINGS,
  buildingCost,
  buildingMaterialCost,
  lumenOutput,
  energyUpkeep,
  energyProduction,
  fuelUpkeep,
  fuelProduction,
  materialsProduction,
  exoticRequired,
  exoticProduction,
  maintenanceUpkeep,
} from './buildings';

describe('BUILDINGS catalog', () => {
  test('defines exactly two buildings per era — a light source and a secondary', () => {
    expect(Object.keys(BUILDINGS)).toHaveLength(ERAS.length * 2);
  });

  test('every era light source named in ERAS exists in BUILDINGS at that era', () => {
    for (const era of ERAS) {
      expect(BUILDINGS[era.lightSource]).toBeDefined();
      expect(BUILDINGS[era.lightSource].phase).toBe(era.id);
    }
  });

  test('every building defines a happinessPerUnit', () => {
    for (const id of Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]) {
      expect(typeof BUILDINGS[id].happinessPerUnit).toBe('number');
    }
  });

  test('gentle Fire Age and Lamp Age lights raise happiness', () => {
    for (const id of ['campfire', 'torch', 'candle', 'oilLamp'] as const) {
      expect(BUILDINGS[id].happinessPerUnit).toBeGreaterThan(0);
    }
  });

  test('every building from the Gas Age on costs happiness', () => {
    for (const era of ERAS.filter((e) => e.id >= 3)) {
      expect(BUILDINGS[era.lightSource].happinessPerUnit).toBeLessThan(0);
    }
  });

  test('Fire Age and Lamp Age buildings draw no energy, fuel, or exotic matter', () => {
    for (const id of ['campfire', 'torch', 'candle', 'oilLamp'] as const) {
      expect(BUILDINGS[id].energyConsumedPerUnit).toBe(0);
      expect(BUILDINGS[id].fuelConsumedPerUnit).toBe(0);
      expect(BUILDINGS[id].exoticRequiredPerUnit).toBe(0);
    }
  });

  test('Electric Age through Nuclear Age lights consume energy', () => {
    for (const id of ['incandescentBulb', 'arcLamp', 'ledLamp', 'nuclearLightGrid'] as const) {
      expect(BUILDINGS[id].energyConsumedPerUnit).toBeGreaterThan(0);
    }
  });

  test('Gas Lamp consumes fuel directly instead of energy (Gas Age has no power grid yet)', () => {
    expect(BUILDINGS.gasLamp.energyConsumedPerUnit).toBe(0);
    expect(BUILDINGS.gasLamp.fuelConsumedPerUnit).toBeGreaterThan(0);
  });

  test('Fusion Age through Cosmic Age lights require exotic matter reserve instead of energy', () => {
    for (const id of [
      'fusionSun',
      'planetaryLightGrid',
      'orbitalMirror',
      'starReflector',
      'dysonSphere',
      'artificialStar',
      'galaxyNetwork',
      'cosmicBeacon',
    ] as const) {
      expect(BUILDINGS[id].exoticRequiredPerUnit).toBeGreaterThan(0);
      expect(BUILDINGS[id].energyConsumedPerUnit).toBe(0);
    }
  });

  test('Gas Works is the first fuel refinery', () => {
    expect(BUILDINGS.gasWorks.fuelProducedPerUnit).toBeGreaterThan(0);
  });

  test('Power Plant and Transformer Station burn fuel to produce energy', () => {
    for (const id of ['powerPlant', 'transformerStation'] as const) {
      expect(BUILDINGS[id].fuelConsumedPerUnit).toBeGreaterThan(0);
      expect(BUILDINGS[id].energyProducedPerUnit).toBeGreaterThan(0);
    }
  });

  test('Chip Factory and Nuclear Reactor produce materials', () => {
    expect(BUILDINGS.chipFactory.materialsPerUnit).toBeGreaterThan(0);
    expect(BUILDINGS.nuclearReactor.materialsPerUnit).toBeGreaterThan(0);
  });

  // Materials stay a live stream past the Nuclear Age too (issue #2: not just
  // a megastructure savings account) - every Fusion Age+ secondary keeps
  // producing them.
  test('every Fusion Age and later secondary also produces materials', () => {
    for (const id of [
      'fusionReactor',
      'compactFusionFactory',
      'spaceElevator',
      'asteroidMining',
      'swarmFabricator',
      'stellarConstructor',
      'blackHoleHarvester',
      'realityFoundry',
    ] as const) {
      expect(BUILDINGS[id].materialsPerUnit).toBeGreaterThan(0);
    }
  });

  // Late-game sink (issue #9): Orbital Age+ light sources cost lumens upkeep
  // per owned unit, scaling with how much they themselves produce, so
  // unchecked late-game building eventually plateaus instead of running away.
  test('Orbital Age and later light sources carry a maintenance upkeep', () => {
    for (const era of ERAS.filter((e) => e.id >= 10)) {
      expect(BUILDINGS[era.lightSource].maintenancePerUnit).toBeGreaterThan(0);
    }
  });

  test('buildings before the Orbital Age carry no maintenance upkeep', () => {
    for (const era of ERAS.filter((e) => e.id < 10)) {
      expect(BUILDINGS[era.lightSource].maintenancePerUnit).toBe(0);
    }
  });

  test('Orbital Age and later buildings cost materials to build, a one-time megastructure cost', () => {
    for (const era of ERAS.filter((e) => e.id >= 10)) {
      expect(buildingMaterialCost(era.lightSource)).toBeGreaterThan(0);
    }
  });

  test('every era light source produces more lumens than the previous era', () => {
    for (let i = 1; i < ERAS.length; i++) {
      expect(BUILDINGS[ERAS[i]!.lightSource].lumensPerUnit).toBeGreaterThan(
        BUILDINGS[ERAS[i - 1]!.lightSource].lumensPerUnit
      );
    }
  });
});

describe('buildingCost', () => {
  test('base cost equals the building base cost when none owned', () => {
    expect(buildingCost('campfire', 0)).toBe(BUILDINGS.campfire.baseCost);
  });

  test('cost scales up with each owned unit', () => {
    const first = buildingCost('campfire', 0);
    const second = buildingCost('campfire', 1);
    expect(second).toBeGreaterThan(first);
  });
});

describe('buildingMaterialCost', () => {
  test('zero for buildings before the Orbital Age', () => {
    expect(buildingMaterialCost('campfire')).toBe(0);
    expect(buildingMaterialCost('powerPlant')).toBe(0);
  });

  test('positive from the Orbital Age on', () => {
    expect(buildingMaterialCost('orbitalMirror')).toBeGreaterThan(0);
    expect(buildingMaterialCost('dysonSphere')).toBeGreaterThan(0);
  });
});

describe('lumenOutput', () => {
  test('zero owned produces zero lumens', () => {
    expect(lumenOutput('campfire', 0)).toBe(0);
  });

  test('output scales linearly with owned count', () => {
    expect(lumenOutput('campfire', 2)).toBe(BUILDINGS.campfire.lumensPerUnit * 2);
  });
});

describe('energyUpkeep / energyProduction', () => {
  test('Fire Age building requires no energy', () => {
    expect(energyUpkeep('campfire', 5)).toBe(0);
  });

  test('Power Plant output scales linearly with owned count', () => {
    expect(energyProduction('powerPlant', 4)).toBe(BUILDINGS.powerPlant.energyProducedPerUnit * 4);
  });
});

describe('fuelUpkeep / fuelProduction', () => {
  test('zero owned produces zero fuel', () => {
    expect(fuelProduction('gasWorks', 0)).toBe(0);
  });

  test('Gas Works output scales linearly with owned count', () => {
    expect(fuelProduction('gasWorks', 3)).toBe(BUILDINGS.gasWorks.fuelProducedPerUnit * 3);
  });

  test('Power Plant fuel upkeep scales linearly with owned count', () => {
    expect(fuelUpkeep('powerPlant', 2)).toBe(BUILDINGS.powerPlant.fuelConsumedPerUnit * 2);
  });
});

describe('materialsProduction', () => {
  test('zero owned produces zero materials', () => {
    expect(materialsProduction('nuclearReactor', 0)).toBe(0);
  });

  test('Nuclear Reactor output scales linearly with owned count', () => {
    expect(materialsProduction('nuclearReactor', 3)).toBe(BUILDINGS.nuclearReactor.materialsPerUnit * 3);
  });

  test('buildings without a materials byproduct produce none', () => {
    expect(materialsProduction('campfire', 10)).toBe(0);
  });
});

describe('exoticRequired / exoticProduction', () => {
  test('zero owned produces zero exotic matter', () => {
    expect(exoticProduction('fusionReactor', 0)).toBe(0);
  });

  test('Fusion Reactor output scales linearly with owned count', () => {
    expect(exoticProduction('fusionReactor', 3)).toBe(BUILDINGS.fusionReactor.exoticProducedPerUnit * 3);
  });

  test('Fusion Sun exotic reserve requirement scales linearly with owned count', () => {
    expect(exoticRequired('fusionSun', 2)).toBe(BUILDINGS.fusionSun.exoticRequiredPerUnit * 2);
  });
});

describe('maintenanceUpkeep', () => {
  test('zero owned costs no maintenance', () => {
    expect(maintenanceUpkeep('orbitalMirror', 0)).toBe(0);
  });

  test('scales linearly with owned count', () => {
    expect(maintenanceUpkeep('orbitalMirror', 3)).toBe(BUILDINGS.orbitalMirror.maintenancePerUnit * 3);
  });

  test('buildings with no maintenance upkeep cost nothing', () => {
    expect(maintenanceUpkeep('campfire', 100)).toBe(0);
  });
});
