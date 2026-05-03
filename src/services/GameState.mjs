import { getObjectsByPrototype, getObjectById } from 'game/utils';
import { Creep, StructureSpawn, StructureRampart, StructureExtension, Source, ConstructionSite } from 'game/prototypes';
import { detectFortifiedMiner } from "./StructureUtils.mjs";
import { CombatUtils } from "./CombatUtils.mjs";

/**
 * GameState service that caches expensive game object queries per tick.
 * This reduces redundant getObjectsByPrototype calls across multiple modules.
 * 
 * Usage:
 *   const gameState = new GameState();
 *   gameState.refresh(); // Call once per tick
 *   const mySpawn = gameState.getMySpawn();
 *   const enemies = gameState.getEnemyCreeps();
 */
export class GameState {
    constructor(screepController) {
        this.screepController = screepController;
        this.mySpawn = null;
        this.enemySpawn = null;
        this.myCreeps = [];
        this.enemyCreeps = [];
        this.allCreeps = [];
        this.ramparts = [];
        this.myExtensions = [];
        this.sources = [];
        this.myConstructionSites = [];
        this.fortifiedMiner = null; // Cached detection of enemy miner on rampart near corner
        this.hasBuiltMiner = false;
        this.hasInitializedWinObjective = false; // Flag to track if initial win objective transfer has been performed
        this.tugChain = []; // Array of creep IDs forming a tug chain to help move creeps without MOVE parts
        this.payloadMoving = false; // Whether the payload is in the moving-to-flag state
        this.payloadId = null; // ID of the payload (EscortCreep)
        this.enemyEscortCreepId = null; // ID of the enemy escort creep, saved at game start
        this.flag = null; // Our flag (the win-objective position)
        this.enemyFlag = null; // The enemy's flag (the enemy win-objective position)
        this.flagKillerId = null; // ID of the single combat unit assigned to kill the flag blocker
        this.blockerEverBuilt = false; // True once we have ever spawned a blocker
        this.blockerEverDied = false;  // True once a blocker was built and subsequently died
        this.enemyHasCombatUnit = false; // True if any enemy has attack or ranged_attack body parts
    }
    
    /**
     * Refresh all cached values. Should be called once per game tick.
     */
    refresh() {
        // Cache all creeps
        this.allCreeps = getObjectsByPrototype(Creep);
        this.myCreeps = this.allCreeps.filter(c => c.my);
        this.enemyCreeps = this.allCreeps.filter(c => !c.my);
        this.enemyHasCombatUnit = this.enemyCreeps.some(e => CombatUtils.hasAttackCapability(e));
        
        // Cache spawns
        const spawns = getObjectsByPrototype(StructureSpawn);
        this.mySpawn = spawns.find(s => s.my) || null;
        this.enemySpawn = spawns.find(s => !s.my) || null;
        
        // Cache ramparts
        this.ramparts = getObjectsByPrototype(StructureRampart);
        
        // Cache extensions
        const allExtensions = getObjectsByPrototype(StructureExtension);
        this.myExtensions = allExtensions.filter(e => e.my);
        
        // Cache sources
        this.sources = getObjectsByPrototype(Source);
        
        // Cache construction sites
        const allConstructionSites = getObjectsByPrototype(ConstructionSite);
        this.myConstructionSites = allConstructionSites.filter(c => c.my);
        
        // Cache fortified miner detection
        this.fortifiedMiner = detectFortifiedMiner(this);

        // Check if we have built a miner
        this.hasBuiltMiner = this.screepController.hasCreepOfRole('miner');

        // Track blocker lifecycle: once a blocker has been built and later dies, never rebuild
        const hasBlockerNow = this.screepController.hasCreepOfRole('blocker');
        if (hasBlockerNow) {
            this.blockerEverBuilt = true;
        } else if (this.blockerEverBuilt) {
            this.blockerEverDied = true;
        }

        // Maintain the flag killer assignment
        // Select one combat unit to hunt down the flag blocker; clear when no blocker is present.
        const flagBlocker = CombatUtils.findFlagBlockingEnemy(this, this.enemyCreeps);
        if (!flagBlocker) {
            this.flagKillerId = null;
        } else {
            const currentKillerAlive = this.flagKillerId &&
                this.myCreeps.some(c => c.id === this.flagKillerId);
            if (!currentKillerAlive) {
                this.flagKillerId = CombatUtils.selectFlagKiller(this, flagBlocker);
            }
        }
        
        // Validate and clean up tug chain - remove any dead creeps
        if (this.tugChain.length > 0) {
            this.tugChain = this.tugChain.filter(id => {
                const creep = getObjectById(id);
                return creep && creep.exists;
            });
        }
    }
    
    /**
     * Get the player's spawn.
     * @returns {StructureSpawn|null}
     */
    getMySpawn() {
        return this.mySpawn;
    }
    
    /**
     * Get the enemy's spawn.
     * @returns {StructureSpawn|null}
     */
    getEnemySpawn() {
        return this.enemySpawn;
    }
    
    /**
     * Get all friendly creeps.
     * @returns {Creep[]}
     */
    getMyCreeps() {
        return this.myCreeps;
    }
    
    /**
     * Get all enemy creeps.
     * @returns {Creep[]}
     */
    getEnemyCreeps() {
        return this.enemyCreeps;
    }
    
    /**
     * Get all creeps (friendly and enemy).
     * @returns {Creep[]}
     */
    getAllCreeps() {
        return this.allCreeps;
    }
    
    /**
     * Get all ramparts.
     * @returns {StructureRampart[]}
     */
    getRamparts() {
        return this.ramparts;
    }
    
    /**
     * Get friendly ramparts (ramparts that belong to us).
     * @returns {StructureRampart[]}
     */
    getMyRamparts() {
        return this.ramparts.filter(r => r.my);
    }
    
    /**
     * Get all friendly extensions.
     * @returns {StructureExtension[]}
     */
    getMyExtensions() {
        return this.myExtensions;
    }
    
    /**
     * Get all sources.
     * @returns {Source[]}
     */
    getSources() {
        return this.sources;
    }
    
    /**
     * Get all friendly construction sites.
     * @returns {ConstructionSite[]}
     */
    getMyConstructionSites() {
        return this.myConstructionSites;
    }
    
    /**
     * Get the fortified miner detection result.
     * Returns an object with {creep, rampart, source} if a fortified miner is detected.
     * @returns {Object|null} Fortified miner info or null if none detected
     */
    getFortifiedMiner() {
        return this.fortifiedMiner;
    }

    /**
     * Get whether a miner is alive.
     * @return {boolean} True if a miner has been built, false otherwise
     */
    getHasBuiltMiner() {
        return this.hasBuiltMiner;
    }

    /**
     * Get whether a blocker was ever built and has since died.
     * When true, no further blockers should be spawned.
     * @returns {boolean} True if a blocker was built and is no longer alive
     */
    getBlockerEverDied() {
        return this.blockerEverDied;
    }

    /**
     * Get whether any enemy creep has an attack or ranged_attack body part.
     * Cached once per tick in refresh().
     * @returns {boolean} True if the enemy has at least one combat-capable unit
     */
    getEnemyHasCombatUnit() {
        return this.enemyHasCombatUnit;
    }

    /**
     * Get whether the win objective has been initialized with initial transfer.
     * @return {boolean} True if initial win objective transfer has been performed, false otherwise
     */
    getHasInitializedWinObjective() {
        return this.hasInitializedWinObjective;
    }

    /**
     * Set the flag indicating that the initial win objective transfer has been performed.
     */
    setHasInitializedWinObjective() {
        this.hasInitializedWinObjective = true;
    }

    /**
     * Get the tug chain array containing IDs of creeps forming a chain to help move creeps.
     * @return {string[]} Array of creep IDs in the tug chain
     */
    getTugChain() {
        return this.tugChain;
    }

    /**
     * Set the tug chain array.
     * @param {string[]} tugChain - Array of creep IDs
     */
    setTugChain(tugChain) {
        this.tugChain = tugChain;
    }

    /**
     * Add a creep ID to the tug chain.
     * @param {string} creepId - The ID of the creep to add
     */
    addToTugChain(creepId) {
        if (!this.tugChain.includes(creepId)) {
            this.tugChain.push(creepId);
        }
    }

    /**
     * Clear the tug chain array.
     */
    clearTugChain() {
        this.tugChain = [];
    }

    /**
     * Get whether the payload is currently in the moving-to-flag state.
     * @returns {boolean}
     */
    isPayloadMoving() {
        return this.payloadMoving;
    }

    /**
     * Set whether the payload is currently in the moving-to-flag state.
     * @param {boolean} moving
     */
    setPayloadMoving(moving) {
        this.payloadMoving = moving;
    }

    /**
     * Get the ID of the payload (EscortCreep).
     * @returns {string|null}
     */
    getPayloadId() {
        return this.payloadId;
    }

    /**
     * Set the ID of the payload (EscortCreep).
     * @param {string|null} id
     */
    setPayloadId(id) {
        this.payloadId = id;
    }

    /**
     * Initialize the enemy escort creep tracking at game start.
     * Saves the enemy escort creep's ID for use in per-tick live checks.
     * Should be called once before the main game loop begins.
     * @param {Object|null} enemyEscortCreep - The enemy escort creep object
     */
    initializeEnemyEscortCreep(enemyEscortCreep) {
        this.enemyEscortCreepId = enemyEscortCreep ? enemyEscortCreep.id : null;
    }

    /**
     * Get the ID of the enemy escort creep (saved at game start).
     * @returns {string|null}
     */
    getEnemyEscortCreepId() {
        return this.enemyEscortCreepId;
    }

    /**
     * Check if the enemy escort creep is currently on an enemy rampart.
     * This is a live check performed each tick using cached game state.
     * Returns false if the enemy escort creep cannot be found (dead or missing).
     * @returns {boolean} True if the enemy escort creep is currently on an enemy rampart
     */
    isEnemyEscortCreepOnRampart() {
        if (!this.enemyEscortCreepId) {
            return false;
        }
        const enemyEscortCreep = getObjectById(this.enemyEscortCreepId);
        if (!enemyEscortCreep) {
            return false;
        }
        return CombatUtils.isOnEnemyRampart(enemyEscortCreep, this.ramparts);
    }

    /**
     * Store a reference to our flag (the win-objective destination).
     * @param {Flag|null} flag
     */
    setFlag(flag) {
        this.flag = flag;
    }

    /**
     * Get our flag (the win-objective destination).
     * @returns {Flag|null}
     */
    getFlag() {
        return this.flag;
    }

    /**
     * Store a reference to the enemy's flag (the enemy win-objective destination).
     * @param {Flag|null} flag
     */
    setEnemyFlag(flag) {
        this.enemyFlag = flag;
    }

    /**
     * Get the enemy's flag (the enemy win-objective destination).
     * @returns {Flag|null}
     */
    getEnemyFlag() {
        return this.enemyFlag;
    }

    /**
     * Get the ID of the single combat unit assigned to kill the flag blocker.
     * @returns {string|null}
     */
    getFlagKillerId() {
        return this.flagKillerId;
    }

    /**
     * Set the ID of the single combat unit assigned to kill the flag blocker.
     * @param {string|null} id
     */
    setFlagKillerId(id) {
        this.flagKillerId = id;
    }
}
