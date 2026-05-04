import { FighterJob } from '../../jobs/FighterJob.mjs';
import { PaladinJob } from '../../jobs/PaladinJob.mjs';
import { ArcherJob } from '../../jobs/ArcherJob.mjs';
import { HaulerJob } from '../../jobs/HaulerJob.mjs';
import { MinerJob } from '../../jobs/MinerJob.mjs';
import { MuleJob } from '../../jobs/MuleJob.mjs';
import { ClericJob } from '../../jobs/ClericJob.mjs';
import { TugJob } from '../../jobs/TugJob.mjs';
import { BlockerJob } from '../../jobs/BlockerJob.mjs';

// Frozen registry mapping job names to their classes
export const Jobs = Object.freeze({
    fighter: FighterJob,
    paladin: PaladinJob,
    archer: ArcherJob,
    hauler: HaulerJob,
    miner: MinerJob,
    mule: MuleJob,
    cleric: ClericJob,
    tug: TugJob,
    blocker: BlockerJob
});
