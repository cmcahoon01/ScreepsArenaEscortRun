import { MapTopology, DEFAULT_TIER, BuildConfig } from '../constants.mjs';
import { TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT } from 'game/constants';
import {EnergyManager} from "./EnergyManager.mjs";
import {BuildStrategy} from "./BuildStrategy.mjs";

/**
 * Manages spawn queue and tracks pending spawns.
 * Handles the coordination between spawn requests and creep memory addition.
 */
export class BuildQueue {
    constructor(screepController, gameState) {
        this.screepController = screepController;
        this.gameState = gameState;
        this.energyManager = new EnergyManager(gameState);
        this.buildStrategy = new BuildStrategy(gameState);
        // Track pending spawn jobs per spawn id
        this.pendingSpawns = new Map(); // spawnId -> {job: string, tier: number}
    }

    getMySpawns() {
        return this.gameState.getMySpawns();
    }

    /**
     * Attempt to spawn the next creep in the build order.
     * Coordinates between BuildStrategy to decide what to build,
     * EnergyManager to check available resources, and BuildQueue to spawn.
     * @returns {boolean} True if spawn was successful, false otherwise
     */
    trySpawnNextCreep() {
        const availableSpawns = this.getMySpawns().filter(spawn => spawn && !spawn.spawning);
        if (availableSpawns.length === 0) {
            return false;
        }

        let spawnedAny = false;
        const creepsForStrategy = this.screepController.creeps.map(c => ({ jobName: c.jobName }));
        const energyBySpawnId = this.energyManager.getEnergyBySpawnId();

        for (const pendingSpawn of this.pendingSpawns.values()) {
            creepsForStrategy.push({ jobName: pendingSpawn.job });
        }

        for (const spawn of availableSpawns) {
            // Get the next creep to build from strategy, including pending/planned spawns
            const nextCreep = this.buildStrategy.getNextCreepToBuild(creepsForStrategy);
            if (!nextCreep) {
                continue;
            }

            const spawnEnergy = energyBySpawnId.get(spawn.id) || 0;
            if (this.trySpawn(spawn, nextCreep, spawnEnergy)) {
                spawnedAny = true;
                creepsForStrategy.push({ jobName: nextCreep.job });
            }
        }

        return spawnedAny;
    }

    /**
     * Check if there's a spawning creep that hasn't been added to memory yet.
     * Adds the creep to the controller once it starts spawning.
     */
    checkAndAddSpawningCreep() {
        const spawns = this.getMySpawns();

        const liveSpawnIds = new Set(spawns.map(spawn => spawn.id));

        for (const spawn of spawns) {
            const pendingSpawn = this.pendingSpawns.get(spawn.id);
            if (spawn.spawning && pendingSpawn) {
                const creepId = spawn.spawning.creep.id;

                if (creepId === undefined) {
                    console.log(`Spawning creep ID is undefined for spawn ${spawn.id}`);
                    continue;
                }

                // Check if this creep is already in our controller
                const alreadyAdded = this.screepController.creeps.some(c => c.id === creepId);

                if (!alreadyAdded) {
                    // Add the creep to memory with its job and tier
                    this.screepController.addCreep(creepId, pendingSpawn.job, pendingSpawn.tier, this.gameState);
                }

                // Clear pending job once we've checked and processed it
                this.pendingSpawns.delete(spawn.id);
            } else if (pendingSpawn && !spawn.spawning) {
                // Clear pending job if this spawn is no longer spawning
                this.pendingSpawns.delete(spawn.id);
            }
        }

        for (const spawnId of Array.from(this.pendingSpawns.keys())) {
            if (!liveSpawnIds.has(spawnId)) {
                this.pendingSpawns.delete(spawnId);
            }
        }
    }

    /**
     * Set spawn directions based on job type and the closest source.
     * Miners, mules, and blockers spawn toward the closest source.
     * All other jobs spawn in the opposite direction (away from the closest source).
     *
     * Note: setDirections() controls where the spawned creep will appear relative
     * to the spawn. For example, setting [LEFT] causes the creep to appear to the
     * left of the spawn structure.
     *
     * @param {Object} spawn   - The spawn structure
     * @param {string} jobName - The job name of the creep being spawned
     */
    setSpawnDirections(spawn, jobName) {
        if (!spawn) {
            return;
        }

        const sources = this.gameState.getSources();
        if (!sources || sources.length === 0) {
            // Fallback: spawn toward enemy side of map
            const isOnLeftSide = spawn.x < MapTopology.ARENA_CENTER;
            spawn.setDirections(isOnLeftSide ? MapTopology.RIGHT_FIRST_SPAWNING : MapTopology.LEFT_FIRST_SPAWNING);
            return;
        }

        // Find the closest source to the spawn
        const closestSource = sources.reduce((closest, s) => {
            const d1 = Math.hypot(s.x - spawn.x, s.y - spawn.y);
            const d2 = Math.hypot(closest.x - spawn.x, closest.y - spawn.y);
            return d1 < d2 ? s : closest;
        });

        const primaryDir = this._getPrimaryDirection(spawn, closestSource);

        if (BuildConfig.SOURCE_FACING_JOBS.includes(jobName)) {
            // Spawn toward the closest source
            spawn.setDirections(this._getDirectionsFrom(primaryDir));
        } else {
            // Spawn in the opposite direction (away from the closest source)
            spawn.setDirections(this._getDirectionsFrom(this._getOppositeDirection(primaryDir)));
        }
    }

    /**
     * Compute the primary 8-way direction constant from one position toward another.
     * In Screeps Arena y increases downward.
     * @param {{x: number, y: number}} from - Source position
     * @param {{x: number, y: number}} to   - Target position
     * @returns {number} A Screeps Arena direction constant (TOP, RIGHT, etc.)
     */
    _getPrimaryDirection(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        if (dx === 0 && dy === 0) {
            // Fallback: use map-side logic when the source is at the same position as the spawn
            return from.x < MapTopology.ARENA_CENTER ? RIGHT : LEFT;
        }

        const angle = Math.atan2(dy, dx) * 180 / Math.PI; // degrees, y-axis positive downward

        if (angle >= -22.5 && angle < 22.5)   return RIGHT;
        if (angle >= 22.5  && angle < 67.5)   return BOTTOM_RIGHT;
        if (angle >= 67.5  && angle < 112.5)  return BOTTOM;
        if (angle >= 112.5 && angle < 157.5)  return BOTTOM_LEFT;
        if (angle >= 157.5 || angle < -157.5) return LEFT;
        if (angle >= -157.5 && angle < -112.5) return TOP_LEFT;
        if (angle >= -112.5 && angle < -67.5) return TOP;
        return TOP_RIGHT; // -67.5 to -22.5
    }

    /**
     * Return the direction constant directly opposite to the given one.
     * Directions are numbered 1–8 in clockwise order starting at TOP, so
     * shifting by 4 positions (half of 8) produces the 180° opposite direction.
     * @param {number} dir - A Screeps Arena direction constant
     * @returns {number} The opposite direction constant
     */
    _getOppositeDirection(dir) {
        return ((dir - 1 + 4) % 8) + 1;
    }

    /**
     * Build an ordered direction array with primaryDir first, then the remaining
     * seven directions continuing clockwise.
     * @param {number} primaryDir - The preferred direction constant
     * @returns {number[]} All 8 direction constants starting with primaryDir
     */
    _getDirectionsFrom(primaryDir) {
        const ordered = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        const idx = ordered.indexOf(primaryDir);
        if (idx === -1) {
            return ordered;
        }
        return [...ordered.slice(idx), ...ordered.slice(0, idx)];
    }

    /**
     * Attempt to spawn a creep with the given configuration.
     * @param {Object} spawn - Spawn structure to use
     * @param {Object} nextCreep - Creep configuration with job, tier, body, and cost
     * @param {number} availableEnergy - Energy available to the selected spawn
     * @returns {boolean} True if spawn was successful, false otherwise
     */
    trySpawn(spawn, nextCreep, availableEnergy) {
        // Check if spawn exists and is not currently spawning
        if (!spawn || spawn.spawning) {
            return false;
        }

        // Check if we have enough energy
        if (availableEnergy < nextCreep.cost) {
            return false;
        }

        // Set spawn directions based on job type
        this.setSpawnDirections(spawn, nextCreep.job);

        // Try to spawn the creep
        const result = spawn.spawnCreep(nextCreep.body);
        if (result && result.object && !result.error) {
            // Mark the job and tier as pending - we'll add it to memory once spawn.spawning is available
            this.pendingSpawns.set(spawn.id, { job: nextCreep.job, tier: nextCreep.tier || DEFAULT_TIER });
            this.gameState.setHighestBuildStep(Math.max(this.gameState.getHighestBuildStep(), nextCreep.buildStep || 0));
            return true;
        }

        return false;
    }
}
