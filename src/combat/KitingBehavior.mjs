import { getRange, findInRange, getObjectsByPrototype } from 'game/utils';
import { EFFECT_SLOWDOWN } from "arena/season_1/construct_and_control/basic/constants";
import { AreaEffect } from 'game/prototypes';
import { TerrainAnalyzer } from './TerrainAnalyzer.mjs';

/**
 * Handles tactical positioning for ranged units.
 * Implements kiting behavior to maintain optimal distance from enemies.
 */
export class KitingBehavior {
    /**
     * Get all valid adjacent positions that a unit can move to.
     * @param {Object} unit - The unit to get positions for
     * @param {Array} allCreeps - Array of all creeps
     * @param {Array} allStructures - Array of all structures
     * @returns {Array} Array of valid positions
     */
    static getValidAdjacentPositions(unit, allCreeps, allStructures) {
        const adjacentOffsets = [
            { x: 0, y: -1 },   // TOP
            { x: 1, y: -1 },   // TOP_RIGHT
            { x: 1, y: 0 },    // RIGHT
            { x: 1, y: 1 },    // BOTTOM_RIGHT
            { x: 0, y: 1 },    // BOTTOM
            { x: -1, y: 1 },   // BOTTOM_LEFT
            { x: -1, y: 0 },   // LEFT
            { x: -1, y: -1 }   // TOP_LEFT
        ];
        
        // Build position lookup map once for O(1) lookups instead of O(n) per check
        const creepPositionMap = TerrainAnalyzer.buildCreepPositionMap(allCreeps);
        
        const validPositions = [];
        
        for (const offset of adjacentOffsets) {
            const pos = { x: unit.x + offset.x, y: unit.y + offset.y };
            
            // Check if position is within bounds
            if (!TerrainAnalyzer.isValidPosition(pos)) {
                continue;
            }
            
            // Check if position is a wall
            if (TerrainAnalyzer.isWall(pos)) {
                continue;
            }
            
            // Check if position is blocked by a creep (O(1) with map)
            if (TerrainAnalyzer.hasCreepInMap(pos, creepPositionMap)) {
                continue;
            }
            
            // Check if position is blocked by an obstacle structure
            if (TerrainAnalyzer.hasObstacle(pos, allStructures)) {
                continue;
            }
            
            validPositions.push(pos);
        }
        
        return validPositions;
    }

    /**
     * Find the nearest enemy to a position.
     * @param {Object} position - Position with x and y coordinates
     * @param {Array} enemies - Array of enemy creeps (must not be empty)
     * @returns {Object} The nearest enemy
     */
    static findNearestEnemy(position, enemies) {
        if (enemies.length === 0) {
            return null;
        }
        
        let nearestEnemy = enemies[0];
        let minRange = getRange(position, nearestEnemy);
        
        for (let i = 1; i < enemies.length; i++) {
            const range = getRange(position, enemies[i]);
            if (range < minRange) {
                minRange = range;
                nearestEnemy = enemies[i];
            }
        }
        
        return nearestEnemy;
    }

    /**
     * Find the best retreat position from enemies.
     * Selects the position that maximizes distance from enemies while avoiding swamps and slowdown effects.
     * @param {Object} unit - The unit to find retreat position for
     * @param {Array} enemies - Array of enemy creeps
     * @param {Array} allCreeps - Array of all creeps
     * @param {Array} allStructures - Array of all structures
     * @returns {Object|null} Best retreat position or null if no valid positions
     */
    static findBestRetreatPosition(unit, enemies, allCreeps, allStructures) {
        // Guard against empty enemies array
        if (enemies.length === 0) {
            console.log("No enemies to retreat from!");
            return null;
        }
        
        const validPositions = this.getValidAdjacentPositions(unit, allCreeps, allStructures);
        
        if (validPositions.length === 0) {
            return null; // No valid positions to move to
        }
        
        // Find the closest enemy to each position
        const positionsWithDistances = validPositions.map(pos => {
            const minEnemyDistance = Math.min(...enemies.map(enemy => getRange(pos, enemy)));
            return { pos, minEnemyDistance };
        });
        
        // Find the maximum distance from enemies
        const maxDistance = Math.max(...positionsWithDistances.map(p => p.minEnemyDistance));
        
        // Filter positions that have maximum distance from enemies
        let bestPositions = positionsWithDistances
            .filter(p => p.minEnemyDistance === maxDistance)
            .map(p => p.pos);
        
        // If only one position, return it
        if (bestPositions.length === 1) {
            return bestPositions[0];
        }

        const areaEffects = getObjectsByPrototype(AreaEffect);

        // If there are ties, avoid stepping on swamp tiles or slowdown area effects
        const nonSwampPositions = bestPositions.filter(pos => {
            if (TerrainAnalyzer.isSwamp(pos)) return false;

            // findInRange with range 0 finds effects exactly on that tile
            const effectsHere = findInRange(pos, areaEffects, 0);
            // Exclude if any slowdown effect is present
            return !effectsHere.some(e => e.effect === EFFECT_SLOWDOWN);
        });
        
        // Use non-swamp positions if available, otherwise use all best positions
        if (nonSwampPositions.length > 0) {
            bestPositions = nonSwampPositions;
        }
        
        // If only one position after swamp filtering, return it
        if (bestPositions.length === 1) {
            return bestPositions[0];
        }
        
        // If there are still ties, use the furthest Euclidean distance from nearest enemy
        let furthestPosition = bestPositions[0];
        let closestEnemy = this.findNearestEnemy(furthestPosition, enemies);
        let maxSquaredDistance = (furthestPosition.x - closestEnemy.x) ** 2 + 
                                 (furthestPosition.y - closestEnemy.y) ** 2;
        
        for (let i = 1; i < bestPositions.length; i++) {
            const pos = bestPositions[i];
            const nearestEnemy = this.findNearestEnemy(pos, enemies);
            const squaredDistance = (pos.x - nearestEnemy.x) ** 2 + 
                                    (pos.y - nearestEnemy.y) ** 2;
            
            if (squaredDistance > maxSquaredDistance) {
                maxSquaredDistance = squaredDistance;
                furthestPosition = pos;
            }
        }
        
        return furthestPosition;
    }
}
