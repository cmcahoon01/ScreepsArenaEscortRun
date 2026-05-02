import { getObjectsByPrototype, getObjectById } from 'game/utils';
import { Creep, StructureSpawn, StructureRampart, StructureExtension, Source, ConstructionSite } from 'game/prototypes';
import { detectFortifiedMiner } from "./StructureUtils.mjs";

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
    }
    
    /**
     * Refresh all cached values. Should be called once per game tick.
     */
    refresh() {
        // Cache all creeps
        this.allCreeps = getObjectsByPrototype(Creep);
        this.myCreeps = this.allCreeps.filter(c => c.my);
        this.enemyCreeps = this.allCreeps.filter(c => !c.my);
        
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
}
