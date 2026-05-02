import { FighterJob } from './fighter.mjs';
import { ArcherJob } from './archer.mjs';
import { HaulerJob } from './hauler.mjs';
import { MinerJob } from './miner.mjs';
import { ClericJob } from './cleric.mjs';
import { TugJob } from './tug.mjs';

// Frozen registry mapping job names to their classes
export const Jobs = Object.freeze({
    fighter: FighterJob,
    archer: ArcherJob,
    hauler: HaulerJob,
    miner: MinerJob,
    cleric: ClericJob,
    tug: TugJob
});
