import { EscortCreep } from 'arena/season_3/escort_run/basic';
import { Flag, getObjectsByPrototype } from 'game';

import { ScreepController } from './src/controllers/ScreepController.mjs';
import { BuildOrder } from './src/controllers/BuildOrder.mjs';
import { GameState } from './src/services/GameState.mjs';
import { PayloadJob } from './src/jobs/PayloadJob.mjs';
import { CombatCoordinator } from './src/controllers/CombatCoordinator.mjs';

const screepController = new ScreepController();
const gameState = new GameState(screepController);
const buildOrder = new BuildOrder(screepController, gameState);
const escortCreep = getObjectsByPrototype(EscortCreep).find(i => i.my);
const enemyEscortCreep = getObjectsByPrototype(EscortCreep).find(i => !i.my);
const flag = getObjectsByPrototype(Flag).find(i => i.my);
const enemyFlag = getObjectsByPrototype(Flag).find(i => !i.my);
const payloadJob = escortCreep
    ? new PayloadJob(escortCreep.id, 'payload', 1, screepController, gameState, flag)
    : null;

// Save the enemy escort creep ID at game start for per-tick live tracking
gameState.initializeEnemyEscortCreep(enemyEscortCreep);
// Store our flag so combat jobs can reference it
gameState.setFlag(flag);
// Store the enemy flag so the blocker job can rush to it
gameState.setEnemyFlag(enemyFlag);

export function loop() {
    // Refresh game state cache once per tick
    gameState.refresh();

    // Determine group-level combat engagement (engage / disengage together)
    CombatCoordinator.tick(gameState);

    // Check if there's a spawning creep that needs to be added to memory
    buildOrder.checkAndAddSpawningCreep();

    // Try to spawn the next creep in the build order
    buildOrder.trySpawnNextCreep();

    // Use the controller to update all creeps
    screepController.updateCreeps(gameState);

    // Run the payload job (moves the EscortCreep toward the flag)
    if (payloadJob) {
        payloadJob.act();
    }
}
