import { MapTopology } from '../constants.mjs';
import { chebyshevDistance } from './RangeUtils.mjs';


export function positionNStepsAwayFromOurSpawn(gameState, N) {
    const ourSpawnCoordinates = gameState.getWeAreTop() ? MapTopology.TOP_SPAWN_COORDINATES : MapTopology.BOTTOM_SPAWN_COORDINATES;
    const enemySpawnCoordinates = gameState.getWeAreTop() ? MapTopology.BOTTOM_SPAWN_COORDINATES : MapTopology.TOP_SPAWN_COORDINATES;
    let y = MapTopology.TOP_SPAWN_COORDINATES.y + N;
    let x = MapTopology.TOP_SPAWN_COORDINATES.y + N;
    if (y > MapTopology.ARENA_CENTER){
        x = MapTopology.ARENA_CENTER * 2 - y;
    }
    y = Math.min(Math.max(y, MapTopology.TOP_SPAWN_COORDINATES.y), MapTopology.BOTTOM_SPAWN_COORDINATES.y);
    x = Math.min(Math.max(x, MapTopology.TOP_SPAWN_COORDINATES.x), MapTopology.MAP_CENTER.x);
    if (!gameState.getWeAreTop()) {
        y =  MapTopology.MAP_CENTER.y * 2 - y;
    }
    return { x, y };
}

export function positionNStepsAwayFromEnemySpawn(gameState, N) {
    const ourSpawnCoordinates = gameState.getWeAreTop() ? MapTopology.TOP_SPAWN_COORDINATES : MapTopology.BOTTOM_SPAWN_COORDINATES;
    const enemySpawnCoordinates = gameState.getWeAreTop() ? MapTopology.BOTTOM_SPAWN_COORDINATES : MapTopology.TOP_SPAWN_COORDINATES;
    const totalPath = chebyshevDistance(ourSpawnCoordinates, enemySpawnCoordinates);
    return positionNStepsAwayFromOurSpawn(gameState, totalPath - N);
}

export function numStepsAwayFromOurSpawn(gameState, position) {
    const ourSpawnCoordinates = gameState.getWeAreTop() ? MapTopology.TOP_SPAWN_COORDINATES : MapTopology.BOTTOM_SPAWN_COORDINATES;
    return chebyshevDistance(position, ourSpawnCoordinates);
}

export function numStepsAwayFromEnemySpawn(gameState, position) {
    const enemySpawnCoordinates = gameState.getWeAreTop() ? MapTopology.BOTTOM_SPAWN_COORDINATES : MapTopology.TOP_SPAWN_COORDINATES;
    return chebyshevDistance(position, enemySpawnCoordinates);
}