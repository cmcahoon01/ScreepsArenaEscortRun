import { getObjectById } from 'game/utils';
import { moveChain } from './TugChainService.mjs';

export class TugChain {
    constructor(subjectId) {
        this._chain = subjectId ? [subjectId] : [];
    }

    claim(subjectId) {
        this._chain = [subjectId];
    }

    setLeader(leaderId) {
        this._chain = [leaderId, ...this._chain];
    }

    extend(id) {
        this._chain.push(id);
    }

    includes(id) {
        return this._chain.includes(id);
    }

    get length() {
        return this._chain.length;
    }

    get ids() {
        return [...this._chain];
    }

    prune() {
        this._chain = this._chain.filter(id => {
            const creep = getObjectById(id);
            return creep && creep.exists;
        });
    }

    clear() {
        this._chain = [];
    }

    tick(target, gameState) {
        return moveChain(this._chain, target, gameState);
    }
}
