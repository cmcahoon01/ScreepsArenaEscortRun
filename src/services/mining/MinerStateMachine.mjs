/**
 * Manages state transitions for miner creeps.
 * Handles the state machine logic for miners (moving, mining, building, depositing).
 */
export class MinerStateMachine {
    /**
     * Initialize miner memory.
     * @param {Object} memory - Miner's memory object
     * @param {number} minerIndex - The 0-based index of this miner
     * @param {Object} assignedSource - The source assigned to this miner
     */
    static initialize(memory, minerIndex, assignedSource) {
        memory.sourceId = assignedSource.id;
        memory.targetX = null;
        memory.targetY = null;
        memory.state = 'moving_to_position';
        memory.stage = 1; // Stage 1: building extensions
        memory.extensionsCreated = false;
        memory.initialized = true;
    }

    /**
     * Check if miner has arrived at target position.
     * @param {Object} creep - The miner creep
     * @param {Object} memory - Miner's memory object
     * @returns {boolean} True if at target position
     */
    static isAtTargetPosition(creep, memory) {
        return creep.x === memory.targetX && creep.y === memory.targetY;
    }

    /**
     * Set the target mining position.
     * @param {Object} memory - Miner's memory object
     * @param {Object} position - Target position with x and y
     */
    static setTargetPosition(memory, position) {
        memory.targetX = position.x;
        memory.targetY = position.y;
    }

    /**
     * Transition to mining state.
     * @param {Object} memory - Miner's memory object
     */
    static transitionToMining(memory) {
        memory.state = 'mining';
    }

    /**
     * Transition to stage 2 (filling extensions).
     * @param {Object} memory - Miner's memory object
     */
    static transitionToStage2(memory) {
        memory.stage = 2;
    }

    /**
     * Mark extensions as created.
     * @param {Object} memory - Miner's memory object
     */
    static markExtensionsCreated(memory) {
        memory.extensionsCreated = true;
    }

    /**
     * Check if in moving to position state.
     * @param {Object} memory - Miner's memory object
     * @returns {boolean} True if in moving state
     */
    static isMovingToPosition(memory) {
        return memory.state === 'moving_to_position';
    }

    /**
     * Check if in mining state.
     * @param {Object} memory - Miner's memory object
     * @returns {boolean} True if in mining state
     */
    static isMining(memory) {
        return memory.state === 'mining';
    }

    /**
     * Check if in stage 1 (building extensions).
     * @param {Object} memory - Miner's memory object
     * @returns {boolean} True if in stage 1
     */
    static isStage1(memory) {
        return memory.stage === 1;
    }

    /**
     * Check if in stage 2 (filling extensions).
     * @param {Object} memory - Miner's memory object
     * @returns {boolean} True if in stage 2
     */
    static isStage2(memory) {
        return memory.stage === 2;
    }

    /**
     * Check if extensions have been created.
     * @param {Object} memory - Miner's memory object
     * @returns {boolean} True if extensions created
     */
    static extensionsCreated(memory) {
        return memory.extensionsCreated;
    }

    /**
     * Get the target position.
     * @param {Object} memory - Miner's memory object
     * @returns {Object|null} Target position or null if not set
     */
    static getTargetPosition(memory) {
        if (memory.targetX !== null && memory.targetY !== null) {
            return { x: memory.targetX, y: memory.targetY };
        }
        return null;
    }
}
