import { DEFAULT_TIER, MapTopology } from '../../constants.mjs';
import { calculateCost } from '../../services/BodyPartService.mjs';

export class ActiveCreep {
    constructor(id, jobName, tier, controller, gameState) {
        if (new.target === ActiveCreep) {
            throw new TypeError("Cannot construct ActiveCreep instances directly");
        }
        this.id = id;
        this.jobName = jobName;
        this.tier = tier || DEFAULT_TIER;
        this.controller = controller;
        this.gameState = gameState;
        this.memory = {};
    }

    act() {
        throw new Error("Method 'act()' must be implemented by subclass");
    }

    static get BODY() {
        throw new Error("Static property 'BODY' must be defined by subclass");
    }

    static get COST() {
        throw new Error("Static property 'COST' must be defined by subclass");
    }

    static get JOB_NAME() {
        throw new Error("Static property 'JOB_NAME' must be defined by subclass");
    }

    static getTierBody(tier) {
        if (tier === 1) return this.BODY;
        throw new Error(`Tier ${tier} not defined for ${this.name}. Override getTierBody() to support multiple tiers.`);
    }

    static getTierCost(tier) {
        return calculateCost(this.getTierBody(tier));
    }

    getBody() {
        return this.constructor.getTierBody(this.tier);
    }

    idle(creep) {
        creep.moveTo(MapTopology.MAP_CENTER);
    }
}
