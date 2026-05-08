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

    _distance(a, b) {
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    }

    _getStoredEnergy(structure) {
        if (!structure || !structure.store) {
            return 0;
        }
        return structure.store[RESOURCE_ENERGY] || 0;
    }

    getEnergyBySpawnId() {
        const spawns = this.gameState.getMySpawns();
        const extensions = this.gameState.getMyExtensions();
        const energyBySpawnId = new Map();

        for (const spawn of spawns) {
            energyBySpawnId.set(spawn.id, this._getStoredEnergy(spawn));
        }

        for (const extension of extensions) {
            if (!extension || !extension.store) continue;

            let closestSpawn = null;
            let closestDistance = Infinity;
            for (const candidate of spawns) {
                const candidateDistance = this._distance(extension, candidate);
                if (!closestSpawn || candidateDistance < closestDistance) {
                    closestSpawn = candidate;
                    closestDistance = candidateDistance;
                }
            }

            if (closestSpawn) {
                const previous = energyBySpawnId.get(closestSpawn.id) || 0;
                energyBySpawnId.set(closestSpawn.id, previous + this._getStoredEnergy(extension));
            }
        }

        return energyBySpawnId;
    }

    /**
     * Get available energy for a specific spawn.
     * @param {Object} spawn - Spawn structure
     * @param {Map<string, number>} energyBySpawnId - Optional cached energy map
     * @returns {number} Energy currently available to that spawn
     */
    getSpawnEnergy(spawn, energyBySpawnId = null) {
        if (!spawn) {
            return 0;
        }
        const map = energyBySpawnId || this.getEnergyBySpawnId();
        return map.get(spawn.id) || 0;
    }

    /**
     * Calculate total available energy from spawn and all extensions.
     * @returns {number} Total energy available across all energy-storing structures
     */
    getTotalEnergy() {
        let totalEnergy = 0;
        for (const energy of this.getEnergyBySpawnId().values()) {
            totalEnergy += energy;
        }
        return totalEnergy;
    }
}
