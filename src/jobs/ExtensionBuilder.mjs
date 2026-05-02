import { getRange, getTerrainAt } from 'game/utils';
import { StructureExtension } from 'game/prototypes';
import { TERRAIN_WALL, ERR_NOT_IN_RANGE } from 'game/constants';
import { createConstructionSite } from 'game';
import { isAdjacent } from '../services/RangeUtils.mjs';
import { MapTopology } from '../constants.mjs';
import { TerrainAnalyzer } from '../combat/TerrainAnalyzer.mjs';

/**
 * Manages extension construction for miners.
 * Handles creation and building of extension construction sites.
 */
export class ExtensionBuilder {
    /**
     * Get positions around a creep for placing extensions.
     * Returns only the empty spaces (not the source or walls).
     * @param {Object} creep - The miner creep
     * @param {Object} source - The source to avoid
     * @returns {Array} Array of valid positions for extensions
     */
    static getExtensionPositions(creep, source) {
        const positions = [];
        const offsets = [
            { dx: 0, dy: -1 }, // TOP
            { dx: 1, dy: -1 }, // TOP_RIGHT
            { dx: 1, dy: 0 },  // RIGHT
            { dx: 1, dy: 1 },  // BOTTOM_RIGHT
            { dx: 0, dy: 1 },  // BOTTOM
            { dx: -1, dy: 1 }, // BOTTOM_LEFT
            { dx: -1, dy: 0 }, // LEFT
            { dx: -1, dy: -1 } // TOP_LEFT
        ];
        
        for (const offset of offsets) {
            const pos = { x: creep.x + offset.dx, y: creep.y + offset.dy };
            
            // Skip if out of bounds
            if (!TerrainAnalyzer.isValidPosition(pos)) {
                continue;
            }
            
            // Skip if this is the source position
            if (source && pos.x === source.x && pos.y === source.y) {
                continue;
            }
            
            positions.push(pos);
        }
        
        return positions;
    }

    /**
     * Create extension construction sites around a creep.
     * @param {Object} creep - The miner creep
     * @param {Object} source - The source to avoid
     * @returns {number} Number of construction sites created
     */
    static createExtensionSites(creep, source) {
        const extensionPositions = this.getExtensionPositions(creep, source);
        
        // Create construction sites (limit to MapTopology.EXTENSIONS_PER_MINER)
        let created = 0;
        for (const pos of extensionPositions) {
            if (created >= MapTopology.EXTENSIONS_PER_MINER) break;
            if (getTerrainAt(pos) === TERRAIN_WALL) continue;
            
            const result = createConstructionSite(pos, StructureExtension);
            if (result.object) {
                created++;
            } else {
                console.log("failed to create an extension site:");
                console.log(result);
            }
        }
        
        if (created < MapTopology.EXTENSIONS_PER_MINER) {
            console.log(`Could only create ${created} extension sites`);
        }
        
        return created;
    }

    /**
     * Build nearby construction sites.
     * @param {Object} creep - The miner creep
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {boolean} True if building action was taken
     */
    static buildNearbyConstructionSites(creep, gameState) {
        // Combine filters: get my construction sites that are adjacent in one pass
        const allConstructionSites = gameState.getMyConstructionSites();
        const nearbyConstructionSites = allConstructionSites.filter(site => 
            isAdjacent(creep, site)
        );
        
        if (nearbyConstructionSites.length > 0) {
            // Build the nearest construction site
            const target = creep.findClosestByRange(nearbyConstructionSites);
            if (target) {
                const buildResult = creep.build(target);
                if (buildResult === ERR_NOT_IN_RANGE) {
                    console.log(`Creep ${creep.id} not in range of construction site`);
                }
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if all extensions nearby are built (construction is complete).
     * @param {Object} creep - The miner creep
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {boolean} True if all extensions are built
     */
    static areExtensionsComplete(creep, gameState) {
        // Combine filters: get my extensions that are adjacent in one pass
        const allExtensions = gameState.getMyExtensions();
        const nearbyExtensions = allExtensions.filter(ext => isAdjacent(creep, ext));
        
        return nearbyExtensions.length >= MapTopology.EXTENSIONS_PER_MINER;
    }

    /**
     * Fill extensions with energy.
     * Transfers energy to the least full extension nearby.
     * @param {Object} creep - The miner creep
     * @param {string} resourceType - The resource type to transfer (e.g., RESOURCE_ENERGY)
     * @param {GameState} gameState - The game state service for cached game objects
     * @returns {boolean} True if transfer action was taken
     */
    static fillExtensions(creep, resourceType, gameState) {
        // Combine filters: get my extensions that are adjacent in one pass
        const allExtensions = gameState.getMyExtensions();
        const nearbyExtensions = allExtensions.filter(ext => isAdjacent(creep, ext));
        
        if (nearbyExtensions.length > 0) {
            // Find the least full extension
            let leastFullExtension = null;
            let minEnergy = Infinity;
            
            for (const ext of nearbyExtensions) {
                const energy = ext.store[resourceType] || 0;
                const capacity = ext.store.getCapacity(resourceType);
                
                // Only consider extensions that are not full
                if (energy < capacity && energy < minEnergy) {
                    minEnergy = energy;
                    leastFullExtension = ext;
                }
            }
            
            if (leastFullExtension) {
                const transferResult = creep.transfer(leastFullExtension, resourceType);
                if (transferResult === ERR_NOT_IN_RANGE) {
                    console.log(`Creep ${creep.id} not in range of extension`);
                }
                return true;
            }
        }
        
        return false;
    }
}
