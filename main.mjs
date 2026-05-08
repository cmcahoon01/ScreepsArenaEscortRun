import { getObjectsByPrototype } from 'game';

import { CreepController } from './src/controllers/CreepController.mjs';
import { GameState } from './src/services/GameState.mjs';
import { CombatCoordinator } from './src/controllers/CombatCoordinator.mjs';
import { BuildQueue } from "./src/controllers/BuildQueue.mjs";
import {StructureSpawn} from 'game/prototypes';


const screepController = new CreepController();
const gameState = new GameState();
const buildQueue = new BuildQueue(screepController, gameState);
const mySpawn = getObjectsByPrototype(StructureSpawn).find(i => i.my);


gameState.setTopTeam(mySpawn);

export function loop() {
    gameState.refresh();

    CombatCoordinator.tick(gameState);

    buildQueue.checkAndAddSpawningCreep();

    buildQueue.trySpawnNextCreep();

    screepController.updateCreeps(gameState);

}
