import { EnergyManager } from './EnergyManager.mjs';
import { BuildQueue } from './BuildQueue.mjs';
import { BuildStrategy } from './BuildStrategy.mjs';

/**
 * Orchestrates the build order system by coordinating energy management,
 * build strategy decisions, and spawn queue management.
 */
export class BuildOrder {
    constructor(screepController, winObjective, gameState) {
        this.screepController = screepController;
        this.winObjective = winObjective;
        this.gameState = gameState;
        
        // Initialize component managers
        this.energyManager = new EnergyManager(gameState);
        this.buildQueue = new BuildQueue(screepController, gameState);
        this.buildStrategy = new BuildStrategy(gameState);
    }

    /**
     * Check if there's a spawning creep that hasn't been added to memory yet.
     * Delegates to BuildQueue.
     */
    checkAndAddSpawningCreep() {
        this.buildQueue.checkAndAddSpawningCreep(this.winObjective);
    }

    /**
     * Attempt to spawn the next creep in the build order.
     * Coordinates between BuildStrategy to decide what to build,
     * EnergyManager to check available resources, and BuildQueue to spawn.
     * @returns {boolean} True if spawn was successful, false otherwise
     */
    trySpawnNextCreep() {
        // Get the next creep to build from strategy
        const nextCreep = this.buildStrategy.getNextCreepToBuild(this.screepController.creeps);
        if (!nextCreep) {
            return false;
        }

        // Check available energy
        const totalEnergy = this.energyManager.getTotalEnergy();

        // Try to spawn using the build queue
        return this.buildQueue.trySpawn(nextCreep, totalEnergy, this.winObjective);
    }
}
