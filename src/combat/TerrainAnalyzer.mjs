import { getTerrainAt } from 'game/utils';
import { TERRAIN_WALL, TERRAIN_SWAMP } from 'game/constants';
import { MapTopology } from '../constants.mjs';

/**
 * Handles terrain and position validation.
 * Provides utilities for checking position validity, terrain types, and obstacles.
 */
export class TerrainAnalyzer {
    /**
     * Check if a position is within the arena bounds.
     * @param {Object} pos - Position with x and y coordinates
     * @returns {boolean} True if position is within bounds
     */
    static isValidPosition(pos) {
        return pos.x >= 0 && pos.x < MapTopology.ARENA_SIZE && 
               pos.y >= 0 && pos.y < MapTopology.ARENA_SIZE;
    }

    /**
     * Check if a position is a wall.
     * @param {Object} pos - Position with x and y coordinates
     * @returns {boolean} True if position is a wall
     */
    static isWall(pos) {
        return getTerrainAt(pos) === TERRAIN_WALL;
    }

    /**
     * Check if a position is a swamp.
     * @param {Object} pos - Position with x and y coordinates
     * @returns {boolean} True if position is a swamp
     */
    static isSwamp(pos) {
        return getTerrainAt(pos) === TERRAIN_SWAMP;
    }

    /**
     * Check if a position is blocked by a creep.
     * For better performance with repeated checks, use buildCreepPositionMap() and hasCreepInMap().
     * @param {Object} pos - Position with x and y coordinates
     * @param {Array} allCreeps - Array of all creeps
     * @returns {boolean} True if position is blocked by a creep
     */
    static hasCreep(pos, allCreeps) {
        return allCreeps.some(c => c.x === pos.x && c.y === pos.y);
    }
    
    /**
     * Build a position lookup map for creeps for O(1) position checks.
     * Use this when checking multiple positions against the same set of creeps.
     * @param {Array} allCreeps - Array of all creeps
     * @returns {Set<string>} Set of position keys in format "x,y"
     */
    static buildCreepPositionMap(allCreeps) {
        return new Set(allCreeps.map(c => `${c.x},${c.y}`));
    }
    
    /**
     * Check if a position is blocked by a creep using a pre-built position map.
     * This is O(1) vs O(n) for hasCreep().
     * @param {Object} pos - Position with x and y coordinates
     * @param {Set<string>} creepPositionMap - Position map from buildCreepPositionMap()
     * @returns {boolean} True if position is blocked by a creep
     */
    static hasCreepInMap(pos, creepPositionMap) {
        return creepPositionMap.has(`${pos.x},${pos.y}`);
    }

    /**
     * Check if a position is blocked by an obstacle structure.
     * @param {Object} pos - Position with x and y coordinates
     * @param {Array} allStructures - Array of all structures
     * @returns {boolean} True if position has an obstacle (wall or enemy rampart)
     */
    static hasObstacle(pos, allStructures) {
        return allStructures.some(s => 
            s.x === pos.x && s.y === pos.y && 
            (s.constructor.name === 'StructureWall' || 
             (s.constructor.name === 'StructureRampart' && !s.my))
        );
    }
}
