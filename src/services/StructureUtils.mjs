import { WORK, ERR_NOT_IN_RANGE, RESOURCE_ENERGY, OK } from 'game/constants';
import { MapTopology } from '../constants.mjs';

/**
 * Detect if there's an enemy miner on a rampart near a corner source.
 * A "miner" is defined as a creep with WORK parts.
 * A "corner source" is one with y < 30 or y > 70.
 * @returns {Object|null} Object with {creep, rampart, source} if detected, null otherwise
 * @private
 */
export function detectFortifiedMiner(gameState) {
    // Filter corner sources
    const cornerSources = gameState.sources.filter(source =>
        source.y < MapTopology.CORNER_TOP_THRESHOLD ||
        source.y > MapTopology.CORNER_BOTTOM_THRESHOLD
    );

    if (cornerSources.length === 0) {
        return null;
    }

    // Get enemy ramparts (ramparts that don't belong to us)
    const enemyRamparts = gameState.ramparts.filter(r => !r.my);

    if (enemyRamparts.length === 0) {
        return null;
    }

    // Create a map of rampart positions for efficient lookup
    const rampartPositions = new Map();
    enemyRamparts.forEach(rampart => {
        rampartPositions.set(`${rampart.x},${rampart.y}`, rampart);
    });

    // Check each enemy creep to see if it's a miner on a rampart near a corner source
    for (const creep of gameState.enemyCreeps) {
        // Check if this creep has WORK parts (is a miner)
        const hasWorkParts = creep.body.some(bodyPart => bodyPart.type === WORK);
        if (!hasWorkParts) {
            continue;
        }

        // Check if this creep is on an enemy rampart
        const posKey = `${creep.x},${creep.y}`;
        const rampart = rampartPositions.get(posKey);
        if (!rampart) {
            continue;
        }

        // Check if this creep is near a corner source (within range 2)
        // Range 2 allows for sources in corners with ramparts blocking direct adjacency
        for (const source of cornerSources) {
            const dx = Math.abs(creep.x - source.x);
            const dy = Math.abs(creep.y - source.y);
            const distance = Math.max(dx, dy); // Chebyshev distance

            if (distance <= 2) {
                // Found a fortified miner!
                return {
                    creep: creep,
                    rampart: rampart,
                    source: source
                };
            }
        }
    }

    return null;
}

/**
 * Perform the initial win objective transfer.
 * Withdraws energy from spawn and builds the win objective once at game start.
 * 
 * @param {Creep} creep - The creep performing the transfer
 * @param {GameState} gameState - The game state service
 * @param {ConstructionSite} winObjective - The win objective construction site
 * @returns {boolean} True if the creep should continue with this action, false if it should move to normal behavior
 */
export function performInitialWinObjectiveTransfer(creep, gameState, winObjective) {
    // If the win objective has already been initialized, skip this
    if (gameState.getHasInitializedWinObjective()) {
        return false;
    }

    const spawn = gameState.getMySpawn();
    const usedCapacity = creep.store[RESOURCE_ENERGY] || 0;
    
    if (!spawn) {
        // No spawn exists, can't withdraw. Skip this initialization.
        gameState.setHasInitializedWinObjective();
        return false;
    }
    
    if (usedCapacity === 0) {
        // Withdraw from spawn
        const withdrawResult = creep.withdraw(spawn, RESOURCE_ENERGY);
        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(spawn);
        } else if (withdrawResult !== OK) {
            // Withdraw failed for some reason (e.g., spawn is empty, creep is full)
            // Set flag to prevent getting stuck in this state
            gameState.setHasInitializedWinObjective();
            console.log(`Creep ${creep.id} failed to withdraw from spawn: ${withdrawResult}`);
        }
        return true;
    } else {
        // Build the win objective (creep has energy)
        const buildResult = creep.build(winObjective);
        if (buildResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(winObjective);
        } else if (buildResult === OK) {
            // Successfully built, set the flag
            gameState.setHasInitializedWinObjective();
        } else {
            // Build failed for some other reason, set flag to prevent getting stuck
            gameState.setHasInitializedWinObjective();
            console.log(`Creep ${creep.id} failed to build win objective: ${buildResult}`);
        }
        return true;
    }
}