import { FighterJob } from './FighterJob.mjs';
import { PaladinJob } from './PaladinJob.mjs';
import { ArcherJob } from './ArcherJob.mjs';
import { HaulerJob } from './HaulerJob.mjs';
import { Miner1Job } from './Miner1Job.mjs';
import { Miner2Job } from './Miner2Job.mjs';
import { MuleJob } from './MuleJob.mjs';
import { ClericJob } from './ClericJob.mjs';
import { TugJob } from './TugJob.mjs';
import { BlockerJob } from './BlockerJob.mjs';
import { PioneerJob } from './PioneerJob.mjs';
import { TurretJob } from './TurretJob.mjs';

export const Jobs = Object.freeze({
    fighter: FighterJob,
    paladin: PaladinJob,
    archer: ArcherJob,
    hauler: HaulerJob,
    miner1: Miner1Job,
    miner2: Miner2Job,
    mule: MuleJob,
    cleric: ClericJob,
    tug: TugJob,
    blocker: BlockerJob,
    pioneer: PioneerJob,
    turret: TurretJob,
});
