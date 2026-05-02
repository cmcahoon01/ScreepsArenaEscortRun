import { RESOURCE_ENERGY } from 'game/constants';

/**
 * Manages energy calculations across spawn and extensions.
 * Provides centralized access to total available energy for build decisions.
 */
export class EnergyManager {
    /**
     * @param {GameState} gameState - The game state service for cached game objects
     */
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Calculate total available energy from spawn and all extensions.
     * @returns {number} Total energy available across all energy-storing structures
     */
    getTotalEnergy() {
        let totalEnergy = 0;

        // Get energy from spawn
        const spawn = this.gameState.getMySpawn();
        if (spawn && spawn.store) {
            totalEnergy += spawn.store[RESOURCE_ENERGY] || 0;
        }

        // Get energy from all extensions (now cached in GameState)
        const extensions = this.gameState.getMyExtensions();
        for (const extension of extensions) {
            if (extension.store) {
                totalEnergy += extension.store[RESOURCE_ENERGY] || 0;
            }
        }

        return totalEnergy;
    }
}
