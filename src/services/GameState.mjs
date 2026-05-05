import { getObjectsByPrototype, getObjectById } from 'game/utils';
import { Creep, StructureSpawn, StructureRampart, StructureExtension, Source, ConstructionSite, StructureContainer } from 'game/prototypes';
import { detectFortifiedMiner } from "./StructureUtils.mjs";
import { findFlagBlockingEnemy, selectFlagKiller, hasAttackCapability } from "./combat/CombatUtils.mjs";
import {BuildConfig, MapTopology, MINER_JOB_NAMES} from "../constants.mjs";
import { TugChain } from "./TugChain.mjs";
import { chebyshevDistance } from "./RangeUtils.mjs";

export class GameState {
    constructor() {
        this.creepRoster = new Map(); // id → jobName, updated each tick by CreepController
        this.mySpawn = null;
        this.enemySpawn = null;
        this.myCreeps = [];
        this.enemyCreeps = [];
        this.allCreeps = [];
        this.ramparts = [];
        this.myExtensions = [];
        this.sources = [];
        this.myConstructionSites = [];
        this.fortifiedMiner = null;
        this.hasBuiltMiner = false;
        this._tugChain = new TugChain();
        this.payloadMoving = false;
        this.payloadId = null;
        this.enemyEscortCreepId = null;
        this.flag = null;
        this.enemyFlag = null;
        this.flagKillerId = null;
        this.blockerEverBuilt = false;
        this.blockerEverDied = false;
        this.enemyHasCombatUnit = false;
        this.miningContainerPos = null;
        this.miningContainerId = null;
        this.combatMode = 'idle';
        this.retreatTarget = null;
        this.idleTarget = null;
        this.weAreTop = false;
    }

    updateCreepRoster(rosterMap) {
        this.creepRoster = rosterMap;
    }

    getCreepJobName(id) {
        return this.creepRoster.get(String(id)) ?? null;
    }

    refresh() {
        this.allCreeps = getObjectsByPrototype(Creep);
        this.myCreeps = this.allCreeps.filter(c => c.my);
        this.enemyCreeps = this.allCreeps.filter(c => !c.my);
        this.enemyHasCombatUnit = this.enemyCreeps.some(e => hasAttackCapability(e));

        const spawns = getObjectsByPrototype(StructureSpawn);
        this.mySpawn = spawns.find(s => s.my) || null;
        this.enemySpawn = spawns.find(s => !s.my) || null;

        this.ramparts = getObjectsByPrototype(StructureRampart);

        const allExtensions = getObjectsByPrototype(StructureExtension);
        this.myExtensions = allExtensions.filter(e => e.my);

        this.sources = getObjectsByPrototype(Source);

        const allConstructionSites = getObjectsByPrototype(ConstructionSite);
        this.myConstructionSites = allConstructionSites.filter(c => c.my);

        if (this.miningContainerPos && !this.miningContainerId) {
            const containers = getObjectsByPrototype(StructureContainer);
            const container = containers.find(c =>
                c.x === this.miningContainerPos.x && c.y === this.miningContainerPos.y
            );
            if (container) {
                this.miningContainerId = container.id;
            }
        }

        this.fortifiedMiner = detectFortifiedMiner(this);

        // Use creepRoster (populated last tick by CreepController) for miner/blocker checks
        const rosterJobNames = Array.from(this.creepRoster.values());
        this.hasBuiltMiner = rosterJobNames.some(jobName => MINER_JOB_NAMES.has(jobName));

        const hasBlockerNow = rosterJobNames.some(jobName => jobName === 'blocker');
        if (hasBlockerNow) {
            this.blockerEverBuilt = true;
        } else if (this.blockerEverBuilt) {
            this.blockerEverDied = true;
        }

        // Maintain flag killer assignment
        const flagBlocker = findFlagBlockingEnemy(this, this.enemyCreeps);
        if (!flagBlocker) {
            this.flagKillerId = null;
        } else {
            const currentKillerAlive = this.flagKillerId &&
                this.myCreeps.some(c => c.id === this.flagKillerId);
            if (!currentKillerAlive) {
                this.flagKillerId = selectFlagKiller(this, flagBlocker);
            }
        }

        // Prune dead creeps from tug chain
        this._tugChain.prune();
    }

    getMySpawn() { return this.mySpawn; }
    getEnemySpawn() { return this.enemySpawn; }
    getMyCreeps() { return this.myCreeps; }
    getEnemyCreeps() { return this.enemyCreeps; }
    getAllCreeps() { return this.allCreeps; }
    getRamparts() { return this.ramparts; }
    getMyRamparts() { return this.ramparts.filter(r => r.my); }
    getMyExtensions() { return this.myExtensions; }
    getSources() { return this.sources; }
    getMyConstructionSites() { return this.myConstructionSites; }
    getFortifiedMiner() { return this.fortifiedMiner; }
    getHasBuiltMiner() { return this.hasBuiltMiner; }
    getBlockerEverDied() { return this.blockerEverDied; }
    getEnemyHasCombatUnit() { return this.enemyHasCombatUnit; }
    getWeAreTop() { return this.weAreTop; }

    getTugChain() { return this._tugChain; }

    setTugChain(ids) {
        const arr = Array.isArray(ids) ? ids : [ids];
        const chain = new TugChain(arr[0]);
        for (let i = 1; i < arr.length; i++) {
            chain.extend(arr[i]);
        }
        this._tugChain = chain;
    }

    addToTugChain(creepId) {
        this._tugChain.extend(creepId);
    }

    clearTugChain() {
        this._tugChain.clear();
    }

    isPayloadMoving() { return this.payloadMoving; }
    setPayloadMoving(moving) { this.payloadMoving = moving; }
    getPayloadId() { return this.payloadId; }
    setPayloadId(id) { this.payloadId = id; }

    initializeEnemyEscortCreep(enemyEscortCreep) {
        this.enemyEscortCreepId = enemyEscortCreep ? enemyEscortCreep.id : null;
    }

    getEnemyEscortCreepId() { return this.enemyEscortCreepId; }

    isEnemyEscortCreepOnRampart() {
        if (!this.enemyEscortCreepId) return false;
        const enemyEscortCreep = getObjectById(this.enemyEscortCreepId);
        if (!enemyEscortCreep) return false;
        return this.ramparts.some(r => !r.my && r.x === enemyEscortCreep.x && r.y === enemyEscortCreep.y);
    }

    isEnemyEscortCreepApproachingGoal() {
        if (!this.enemyEscortCreepId) return false;
        const enemyEscortCreep = getObjectById(this.enemyEscortCreepId);
        if (!enemyEscortCreep) return false;
        const ourFlag = this.flag;
        if (!ourFlag) return false;
        return chebyshevDistance(enemyEscortCreep, ourFlag) < BuildConfig.AGGRESSIVE_TRIGGER_DISTANCE;
    }

    isEnemyPayloadOnRightSide() {
        if (!this.enemyEscortCreepId) return false;
        const enemyPayload = getObjectById(this.enemyEscortCreepId);
        if (!enemyPayload) return false;
        return enemyPayload.x >= MapTopology.ARENA_CENTER;
    }

    setFlag(flag) { this.flag = flag; }
    getFlag() { return this.flag; }
    setEnemyFlag(flag) { this.enemyFlag = flag; }
    getEnemyFlag() { return this.enemyFlag; }
    getFlagKillerId() { return this.flagKillerId; }
    setFlagKillerId(id) { this.flagKillerId = id; }

    setMiningContainerPos(x, y) { this.miningContainerPos = { x, y }; }
    getMiningContainerPos() { return this.miningContainerPos; }
    getMiningContainerId() { return this.miningContainerId; }

    isCombatEngaged() { return this.combatMode === 'attack'; }
    setCombatEngaged(engaged) { this.combatMode = engaged ? 'attack' : 'idle'; }
    getCombatMode() { return this.combatMode; }
    setCombatMode(mode) { this.combatMode = mode; }
    getRetreatTarget() { return this.retreatTarget; }
    setRetreatTarget(pos) { this.retreatTarget = pos; }
    getIdleTarget() { return this.idleTarget; }
    setIdleTarget(pos) { this.idleTarget = pos; }
    setTopTeam(flag) {this.weAreTop = (flag.y < MapTopology.MAP_CENTER.y); }
}
