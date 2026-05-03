import { WORK } from 'game/constants';
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
