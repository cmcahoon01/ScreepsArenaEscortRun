import { MapTopology } from '../constants.mjs';
import { chebyshevDistance } from './RangeUtils.mjs';


export function positionNStepsAwayFromSpawn(gameState, N) {
    const ourSpawnCoordinates = gameState.getWeAreTop() ? MapTopology.TOP_SPAWN_COORDINATES : MapTopology.BOTTOM_SPAWN_COORDINATES;
    const enemySpawnCoordinates = gameState.getWeAreTop() ? MapTopology.BOTTOM_SPAWN_COORDINATES : MapTopology.TOP_SPAWN_COORDINATES;
    let y = MapTopology.TOP_SPAWN_COORDINATES.y + N;
    let x = MapTopology.TOP_SPAWN_COORDINATES.y + N;
    if (y > MapTopology.ARENA_CENTER){
        x = y - ( MapTopology.ARENA_CENTER - y);
    }
    y = Math.min(Math.max(y, MapTopology.TOP_SPAWN_COORDINATES.y), MapTopology.BOTTOM_SPAWN_COORDINATES.y);
    x = Math.min(Math.max(x, MapTopology.TOP_SPAWN_COORDINATES.x), MapTopology.BOTTOM_SPAWN_COORDINATES.x);
    if (!gameState.getWeAreTop()) {
        y =  MapTopology.ARENA_CENTER - y;
    }
    return { x, y };
}

export function numStepsAwayFromOurSpawn(gameState, position) {
    const ourSpawnCoordinates = gameState.getWeAreTop() ? MapTopology.TOP_SPAWN_COORDINATES : MapTopology.BOTTOM_SPAWN_COORDINATES;
    return chebyshevDistance(position, ourSpawnCoordinates);
}

export function numStepsAwayFromEnemySpawn(gameState, position) {
    const enemySpawnCoordinates = gameState.getWeAreTop() ? MapTopology.BOTTOM_SPAWN_COORDINATES : MapTopology.TOP_SPAWN_COORDINATES;
    return chebyshevDistance(position, enemySpawnCoordinates);
}

export function positionNStepsAwayFromEnemySpawn(gameState, N) {
    const ourSpawnCoordinates = gameState.getWeAreTop() ? MapTopology.TOP_SPAWN_COORDINATES : MapTopology.BOTTOM_SPAWN_COORDINATES;
    const enemySpawnCoordinates = gameState.getWeAreTop() ? MapTopology.BOTTOM_SPAWN_COORDINATES : MapTopology.TOP_SPAWN_COORDINATES;
    const totalPath = chebyshevDistance(ourSpawnCoordinates, enemySpawnCoordinates);
    return positionNStepsAwayFromSpawn(gameState, totalPath - N);
}