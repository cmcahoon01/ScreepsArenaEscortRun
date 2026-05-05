export const MinerState = Object.freeze({
    MOVING_TO_POSITION: 'moving_to_position',
    MINING: 'mining',
});

export function initialize(memory, minerIndex, assignedSource) {
    memory.sourceId = assignedSource.id;
    memory.targetX = null;
    memory.targetY = null;
    memory.state = MinerState.MOVING_TO_POSITION;
    memory.initialized = true;
}

export function isAtTargetPosition(creep, memory) {
    return creep.x === memory.targetX && creep.y === memory.targetY;
}

export function setTargetPosition(memory, position) {
    memory.targetX = position.x;
    memory.targetY = position.y;
}

export function transitionToMining(memory) {
    memory.state = MinerState.MINING;
}

export function isMovingToPosition(memory) {
    return memory.state === MinerState.MOVING_TO_POSITION;
}

export function isMining(memory) {
    return memory.state === MinerState.MINING;
}

export function getTargetPosition(memory) {
    if (memory.targetX !== null && memory.targetY !== null) {
        return { x: memory.targetX, y: memory.targetY };
    }
    return null;
}

// Backward-compatible class wrapper
export const MinerStateMachine = {
    initialize,
    isAtTargetPosition,
    setTargetPosition,
    transitionToMining,
    isMovingToPosition,
    isMining,
    getTargetPosition,
};
