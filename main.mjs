import { EscortCreep } from 'arena/season_3/escort_run/basic';
import { Flag, getObjectsByPrototype } from 'game';

// Example code:
const escortCreep = getObjectsByPrototype(EscortCreep).find(i => i.my);
const flag = getObjectsByPrototype(Flag).find(i => i.my);

export function loop() {
    escortCreep.moveTo(flag);
}
