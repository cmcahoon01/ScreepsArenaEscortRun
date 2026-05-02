import { getObjectById } from 'game/utils';
import { Jobs } from '../jobs/JobRegistry.mjs';
import { DEFAULT_TIER } from '../constants.mjs';

// Controller class to manage all creeps
export class ScreepController {
    constructor() {
        this.creeps = [];
    }

    // Add a new creep to the controller
    addCreep(id, jobName, tier, winObjective, gameState) {
        if (!Jobs[jobName]) {
            console.log(`Warning: Unknown job type '${jobName}'`);
            return;
        }
        const JobClass = Jobs[jobName];
        const activeCreep = new JobClass(id, jobName, tier || DEFAULT_TIER, this, winObjective, gameState);
        this.creeps.push(activeCreep);
    }

    // Update all creeps - remove dead ones and call actions for alive ones
    updateCreeps(winObjective, gameState) {
        // Filter out dead creeps and keep alive ones
        this.creeps = this.creeps.filter(activeCreep => {
            const creep = getObjectById(activeCreep.id);
            
            // If creep has does not exist it's dead - remove it
            if (!creep || !creep.exists) {
                console.log(`Removing dead creep ${activeCreep.id}`);
                return false;
            }
            
            // Creep is alive, call its action function
            // Skip if creep is still spawning
            if (!creep.spawning) {
                activeCreep.act();
            }
            
            return true;
        });
    }

    // Check if there's any creep with the specified job role alive
    hasCreepOfRole(jobName) {
        return this.creeps.some(activeCreep => activeCreep.jobName === jobName);
    }
}
