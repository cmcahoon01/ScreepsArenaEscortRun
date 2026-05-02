import { LEFT, RIGHT } from 'game/constants';
import { MapTopology, DEFAULT_TIER } from '../constants.mjs';

/**
 * Manages spawn queue and tracks pending spawns.
 * Handles the coordination between spawn requests and creep memory addition.
 */
export class BuildQueue {
    constructor(screepController, gameState) {
        this.screepController = screepController;
        this.gameState = gameState;
        // Track the job type and tier of the creep currently being spawned
        this.pendingSpawn = null; // Will be {job: string, tier: number}
    }

    /**
     * Check if there's a spawning creep that hasn't been added to memory yet.
     * Adds the creep to the controller once it starts spawning.
     * @param {Object} winObjective - The win objective to pass to new creeps
     */
    checkAndAddSpawningCreep(winObjective) {
        const spawn = this.gameState.getMySpawn();
        
        // If spawn is spawning a creep and we have a pending job
        if (spawn && spawn.spawning && this.pendingSpawn) {
            const creepId = spawn.spawning.creep.id;

            if (creepId === undefined) {
                console.log("spawning creep undefined");
                return;
            }
            
            // Check if this creep is already in our controller
            const alreadyAdded = this.screepController.creeps.some(c => c.id === creepId);
            
            if (!alreadyAdded) {
                // Add the creep to memory with its job and tier
                this.screepController.addCreep(creepId, this.pendingSpawn.job, this.pendingSpawn.tier, winObjective, this.gameState);
            }
            // Clear pending job once we've checked and processed it
            this.pendingSpawn = null;
        } else if (this.pendingSpawn && (!spawn || !spawn.spawning)) {
            // Clear pending job if spawn is no longer spawning but we still have a pending job
            this.pendingSpawn = null;
        }
    }

    /**
     * Set spawn directions based on game state and team position.
     * Initially spawns towards win objective, then inverts after initial transfer.
     * 
     * Note: setDirections() controls where the spawned creep will move to/appear relative
     * to the spawn. For example, setting [LEFT] causes the creep to appear/move to the 
     * left of the spawn structure.
     * 
     * @param {Object} spawn - The spawn structure
     * @param {Object} winObjective - The win objective construction site
     */
    setSpawnDirections(spawn, winObjective) {
        if (!spawn || !winObjective) {
            return;
        }

        const hasInitialized = this.gameState.getHasInitializedWinObjective();
        
        // Determine which side of the map we're on (left vs right of center)
        const isOnLeftSide = spawn.x < MapTopology.ARENA_CENTER;
        
        if (!hasInitialized) {
            // Before initial transfer: spawn creeps towards win objective on our side
            // Win objective should be near our spawn, on the same side of the map
            if (isOnLeftSide) {
                spawn.setDirections(MapTopology.LEFT_FIRST_SPAWNING);
            } else {
                spawn.setDirections(MapTopology.RIGHT_FIRST_SPAWNING);
            }
        } else {
            // After initial transfer: spawn creeps towards enemy
            // Enemy is on the opposite side of the map
            if (isOnLeftSide) {
                spawn.setDirections(MapTopology.RIGHT_FIRST_SPAWNING);
            } else {
                spawn.setDirections(MapTopology.LEFT_FIRST_SPAWNING);
            }
        }
    }

    /**
     * Attempt to spawn a creep with the given configuration.
     * @param {Object} nextCreep - Creep configuration with job, tier, body, and cost
     * @param {number} availableEnergy - Total energy available for spawning
     * @param {Object} winObjective - The win objective to determine spawn direction
     * @returns {boolean} True if spawn was successful, false otherwise
     */
    trySpawn(nextCreep, availableEnergy, winObjective) {
        const spawn = this.gameState.getMySpawn();
        
        // Check if spawn exists and is not currently spawning
        if (!spawn || spawn.spawning) {
            return false;
        }

        // Check if we have enough energy
        if (availableEnergy < nextCreep.cost) {
            return false;
        }

        // Set spawn directions based on game state
        this.setSpawnDirections(spawn, winObjective);

        // Try to spawn the creep
        const result = spawn.spawnCreep(nextCreep.body);
        if (result && result.object && !result.error) {
            // Mark the job and tier as pending - we'll add it to memory once spawn.spawning is available
            this.pendingSpawn = { job: nextCreep.job, tier: nextCreep.tier || DEFAULT_TIER };
            console.log(`Started spawning ${nextCreep.job} tier ${nextCreep.tier || DEFAULT_TIER} (cost: ${nextCreep.cost}, available energy: ${availableEnergy})`);
            return true;
        }

        return false;
    }
}
