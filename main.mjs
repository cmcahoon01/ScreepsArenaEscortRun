import { EscortCreep } from 'arena/season_3/escort_run/basic';
import { Flag, getObjectsByPrototype } from 'game';

import { CreepController } from './src/controllers/CreepController.mjs';
import { BuildOrder } from './src/controllers/BuildOrder.mjs';
import { GameState } from './src/services/GameState.mjs';
import { PayloadJob } from './src/jobs/PayloadJob.mjs';
import { CombatCoordinator } from './src/controllers/CombatCoordinator.mjs';

const screepController = new CreepController();
const gameState = new GameState();
const buildOrder = new BuildOrder(screepController, gameState);
const escortCreep = getObjectsByPrototype(EscortCreep).find(i => i.my);
const enemyEscortCreep = getObjectsByPrototype(EscortCreep).find(i => !i.my);
const flag = getObjectsByPrototype(Flag).find(i => i.my);
const enemyFlag = getObjectsByPrototype(Flag).find(i => !i.my);
const payloadJob = escortCreep
    ? new PayloadJob(escortCreep.id, 'payload', 1, screepController, gameState, flag)
    : null;

gameState.initializeEnemyEscortCreep(enemyEscortCreep);
gameState.setFlag(flag);
gameState.setEnemyFlag(enemyFlag);
gameState.setTopTeam(flag);

export function loop() {
    gameState.refresh();

    CombatCoordinator.tick(gameState);

    buildOrder.checkAndAddSpawningCreep();

    buildOrder.trySpawnNextCreep();

    screepController.updateCreeps(gameState);

    if (payloadJob) {
        payloadJob.act();
    }
}
