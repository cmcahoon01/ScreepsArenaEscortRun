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

    /** True if `id` is the chain leader (index 0). */
    isLeader(id) {
        return this._chain[0] === id;
    }

    /** True if the chain has exactly one member equal to `id`. */
    hasSingleMember(id) {
        return this._chain.length === 1 && this._chain[0] === id;
    }

    /** Returns 0-based position of `id` in the chain, or -1 if not present. */
    getChainPosition(id) {
        return this._chain.indexOf(id);
    }

    get length() {
        return this._chain.length;
    }

    get ids() {
        return [...this._chain];
    }

    /** The last ID in the chain (the subject being towed), or null if empty. */
    get last() {
        return this._chain.length > 0 ? this._chain[this._chain.length - 1] : null;
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
