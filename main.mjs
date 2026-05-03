import { EscortCreep } from 'arena/season_3/escort_run/basic';
import { Flag, getObjectsByPrototype, RESOURCE_ENERGY } from 'game';

import { ConstructionSite, Creep, Source, StructureSpawn } from 'game/prototypes';
import { CARRY, MOVE, WORK, ERR_NOT_IN_RANGE } from 'game/constants';
import { ScreepController } from './src/controllers/ScreepController.mjs';
import { BuildOrder } from './src/controllers/BuildOrder.mjs';
import { GameState } from './src/services/GameState.mjs';
import { PayloadJob } from './src/jobs/payload.mjs';

const spawn = getObjectsByPrototype(StructureSpawn).find(i => i.my);
const winObjective = getObjectsByPrototype(ConstructionSite).find(i => i.my);
const screepController = new ScreepController();
const gameState = new GameState(screepController);
const buildOrder = new BuildOrder(screepController, winObjective, gameState);
const escortCreep = getObjectsByPrototype(EscortCreep).find(i => i.my);
const enemyEscortCreep = getObjectsByPrototype(EscortCreep).find(i => !i.my);
const flag = getObjectsByPrototype(Flag).find(i => i.my);
const payloadJob = escortCreep
    ? new PayloadJob(escortCreep.id, 'payload', 1, screepController, winObjective, gameState, flag)
    : null;

// Save the enemy escort creep ID at game start for per-tick live tracking
gameState.initializeEnemyEscortCreep(enemyEscortCreep);
// Store our flag so combat jobs can reference it
gameState.setFlag(flag);

export function loop() {
    // Refresh game state cache once per tick
    gameState.refresh();

    // Check if there's a spawning creep that needs to be added to memory
    buildOrder.checkAndAddSpawningCreep();

    // Try to spawn the next creep in the build order
    buildOrder.trySpawnNextCreep();

    // Use the controller to update all creeps
    screepController.updateCreeps(winObjective, gameState);

    // Run the payload job (moves the EscortCreep toward the flag)
    if (payloadJob) {
        payloadJob.act();
    }
}
