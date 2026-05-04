# Design Analysis: ScreepsArenaEscortRun

This document analyzes the current software architecture, the design patterns
in use, and provides concrete recommendations for improving long-term
maintainability and extensibility.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Design Patterns in Use](#2-design-patterns-in-use)
3. [Strengths](#3-strengths)
4. [Naming Conventions](#4-naming-conventions)
5. [File and Module Structure](#5-file-and-module-structure)
6. [Service Design and Separation of Concerns](#6-service-design-and-separation-of-concerns)
7. [DRY Violations](#7-dry-violations)
8. [Dead Code](#8-dead-code)
9. [Logic Redesign Recommendations](#9-logic-redesign-recommendations)
10. [Software Principles](#10-software-principles)

---

## 1. Architecture Overview

The codebase is a Screeps Arena bot for the *Escort Run* game mode. The entry
point is `main.mjs`, which wires together top-level singletons and drives a
single `loop()` function that the Screeps engine calls once per tick.

**Directory layout (simplified):**

```
main.mjs
src/
  constants.mjs          ← all hard-coded values and tuning parameters
  controllers/           ← orchestrators (spawning, combat coordination)
  jobs/                  ← concrete creep role implementations
  services/
    GameState.mjs        ← per-tick game object cache + shared state
    BodyPartService.mjs  ← body-part cost calculations
    RangeUtils.mjs       ← range helpers
    StructureUtils.mjs   ← structure queries
    TugChainService.mjs  ← tug-chain movement coordination
    combat/              ← combat utilities and AI helpers
    jobs/                ← abstract base classes for jobs
    mining/              ← mining helpers (state machine, strategies)
```

**Game loop (per tick):**

```
gameState.refresh()           → update all cached game objects
CombatCoordinator.tick()      → decide group-level engage / disengage
buildOrder.checkAndAdd...()   → detect newly spawned creeps
buildOrder.trySpawnNext...()  → spawn the next creep in the build order
screepController.updateCreeps() → run act() on every live creep
payloadJob.act()              → move the EscortCreep toward the flag
```

---

## 2. Design Patterns in Use

### 2.1 Template Method
`ActiveCreep` → `MeleeJob` / `RangedJob` → concrete job classes form a
three-level hierarchy. The abstract base (`ActiveCreep`) declares the `act()`
contract; the intermediate classes (`MeleeJob`, `RangedJob`) implement the
shared combat skeleton; and concrete jobs (e.g. `FighterJob`, `ClericJob`)
fill in the variation points (`performHealing`, `shouldHealDuringIdle`,
static `BODY`/`COST` properties).

### 2.2 Strategy
Multiple areas replace hard-coded algorithms with substitutable objects:

- `SourceAssignmentStrategy` — which source a miner mines.
- `ContainerPlacementStrategy` — where to place the mining container.
- `BuildStrategy` — which creep to build next.

### 2.3 State Machine
Two explicit state machines exist:

- `MinerStateMachine` — tracks a miner through `moving_to_position` → `mining`
  (stage 1 → stage 2).
- `PayloadJob` — a two-state machine (`waiting` / `moving`) with a guarded
  transition.

### 2.4 Registry / Factory
`JobRegistry.Jobs` is a frozen map from string job name to class. Combined with
`ScreepController.addCreep()` it acts as a simple factory: callers pass a job
name, and the correct subclass is instantiated without the caller depending on
the concrete type.

### 2.5 Observer / Per-Tick Cache
`GameState.refresh()` re-queries all expensive Screeps API calls once per tick
and exposes the results through accessor methods. This is effectively a
*cache-refresh* pattern that avoids duplicate `getObjectsByPrototype` calls
across modules within the same tick.

### 2.6 Coordinator / Mediator
`CombatCoordinator` centralises the engage/disengage decision for the whole
group. Individual combat jobs consult `gameState.isCombatEngaged()` rather
than each independently computing whether to fight. This prevents the
oscillation and inconsistency that arises when every unit makes its own
independent decision.

### 2.7 Hysteresis
`CombatCoordinator` deliberately uses two different radii (engage vs.
disengage) to prevent rapid toggling when enemies hover near the threshold.
This is a well-known control-theory technique applied to game AI.

### 2.8 Command
Every creep role exposes a single `act()` method. `ScreepController` iterates
creeps and calls `act()` without knowing or caring about each role's internal
logic — a lightweight version of the Command pattern.

---

## 3. Strengths

- **Constants centralized.** `constants.mjs` is the single source of truth for
  every tuning parameter, making balance changes easy and keeping magic numbers
  out of logic files.
- **GameState caching.** Calling `getObjectsByPrototype` once per tick rather
  than once per creep per tick is an important performance win in an
  environment where CPU is capped.
- **Well-documented.** JSDoc comments describe intent, parameters, and return
  types throughout the codebase.
- **Hysteresis on combat transitions.** The dual-radius engage/disengage logic
  is a thoughtful solution to a subtle game AI problem.
- **Configurable build order.** The `BuildConfig.INITIAL_BUILD` array makes it
  easy to change the opening without touching logic code.
- **Abstract base guards.** `new.target` checks in `ActiveCreep` and
  `MeleeJob`/`RangedJob` constructors prevent accidental direct instantiation.

---

## 4. Naming Conventions

### 4.1 "Screep" vs. "Creep"

`ScreepController` uses the portmanteau "Screep" (Screeps + Creep) while
every other file in the project uses "Creep" or "Job". This inconsistency
makes the controller harder to find and the naming feels like an early
placeholder that was never updated.

**Recommendation:** Rename `ScreepController` → `CreepController`.

### 4.2 File names vs. exported class names

Several service files have a `*Service` suffix in both the file name and the
class name (`KitingBehaviorService.mjs` / `KitingBehavior`,
`TerrainAnalyzerService.mjs` / `TerrainAnalyzer`). The suffix appears in the
file name but not in the class name, creating a mismatch that makes
auto-imports confusing.

**Recommendation:** Align file name and exported name. Either:

- Use the suffix in both: `KitingBehaviorService.mjs` exports
  `KitingBehaviorService`, or
- Drop it from both: `KitingBehavior.mjs` exports `KitingBehavior`.

The second option is preferred because the file's location inside
`services/combat/` already communicates that it is a service.

### 4.3 State strings as raw literals

`MinerStateMachine` uses plain string literals (`'moving_to_position'`,
`'mining'`) directly in the `memory` object, but the corresponding check
methods (`isMovingToPosition`, `isMining`) hide those strings. The state
names are not exported, so adding a new caller must guess the string values.

**Recommendation:** Export a `MinerState` constants object (analogous to
`PayloadConfig.STATE_WAITING` / `STATE_MOVING`) and use it in both the state
machine and anywhere the strings would otherwise be hardcoded.

### 4.4 Mixed format in `INITIAL_BUILD`

The build order array mixes two formats:

```js
INITIAL_BUILD: [
    {job: 'miner', tier: 1},  // object format
    'blocker',                  // plain string
    ...
]
```

`BuildStrategy.getNextCreepToBuild` compensates with
`buildItem.job || buildItem`, which is a code smell indicating the data
model is ambiguous.

**Recommendation:** Swap to just a string format. Create a new job for tier 1 and tier 2 miners.

```js
INITIAL_BUILD: [
    'miner1',
    'blocker',
    'mule',
    'miner2',
    'mule',
]
```

---

## 5. File and Module Structure

### 5.1 Split job hierarchy

Concrete job implementations live in `src/jobs/`, while their abstract base
classes live in `src/services/jobs/`. This means the class hierarchy is
physically split across two directories with no clear rationale:

```
src/jobs/FighterJob.mjs           extends MeleeJob
src/services/jobs/MeleeJob.mjs    extends ActiveCreep
src/services/jobs/ActiveCreep.mjs (root abstract base)
```

Any developer following an inheritance chain must jump between directories.

**Recommendation:** Consolidate the entire job hierarchy into `src/jobs/`,
using a `base/` subdirectory for the abstract classes:

```
src/jobs/
  base/
    ActiveCreep.mjs
    MeleeJob.mjs
    RangedJob.mjs
  FighterJob.mjs
  ClericJob.mjs
  MinerJob.mjs
  ...
  JobRegistry.mjs
```

### 5.2 Static-only classes that are not true services

`CombatUtils`, `KitingBehavior`, `TerrainAnalyzer`, `TugChainService`,
`BodyPartCalculator`, and several others consist entirely of `static` methods
with no instance state. There is no need to instantiate them; they are
effectively namespaced collections of functions.

In modern ES modules, plain exported functions achieve the same result with
less boilerplate, are directly tree-shakeable, and cannot be accidentally
instantiated:

```js
// Before
export class CombatUtils {
    static hasAttackCapability(creep) { ... }
}
// Usage: CombatUtils.hasAttackCapability(c)

// After
export function hasAttackCapability(creep) { ... }
// Usage: hasAttackCapability(c)  (imported by name)
```

**Recommendation:** Convert the following to plain module functions:
`CombatUtils`, `KitingBehavior`, `TerrainAnalyzer`, `TugChainService`,
`BodyPartCalculator`, `RangeUtils`, `StructureUtils`, `MinerStateMachine`,
`ExtensionBuilder`, `SourceAssignmentStrategy`, `ContainerPlacementStrategy`.

Keep classes only where instantiation and instance state are genuinely needed
(e.g. `ActiveCreep` and subclasses, `GameState`, `BuildOrder`).

### 5.3 Consolidate the `services/jobs/` subdirectory

Once the job hierarchy is consolidated (see 5.1) and the static-only utilities
are converted to module functions (see 5.2), `services/jobs/` would be empty
and `services/` would contain only genuinely stateful services. This makes the
distinction between "service" (stateful, injected) and "utility" (stateless,
imported) explicit in the file structure.

---

## 6. Service Design and Separation of Concerns

### 6.1 `GameState` is a God Object

`GameState` currently owns:

- Cached game object queries (creeps, spawns, structures, sources)
- Combat state (engaged/disengaged, flag-killer assignment)
- Mining state (container position, container ID)
- Payload state (payload ID, payload moving flag)
- Tug-chain state (chain array, lifecycle)
- Blocker lifecycle tracking (ever-built, ever-died)
- Enemy escort creep tracking

This violates the **Single Responsibility Principle** (SRP). A module that
changes for combat reasons, mining reasons, payload reasons, and spawn reasons
is fragile and difficult to understand in isolation.

**Recommendation:** Split `GameState` into focused, domain-specific state
classes, each refreshed through a single `refresh()` call or injected where
needed:

```
WorldSnapshot   ← per-tick read-only view of game objects (creeps, structures)
CombatState     ← engaged flag, flag-killer ID, enemy escort tracking
PayloadState    ← payload ID, moving flag, tug-chain
MiningState     ← container pos/ID, blocker lifecycle
```

`WorldSnapshot` replaces the caching role of today's `GameState`. The domain
states hold persistent (cross-tick) information about their respective systems
and are each owned by the controller that manages that system.

### 6.2 `CombatUtils.selectFlagKiller` accesses `screepController` directly

```js
// src/services/combat/CombatUtils.mjs
const controllerCreeps = gameState.screepController.creeps;
```

This bypasses `GameState`'s accessor API and creates a hidden coupling between
a service utility and the concrete `ScreepController` implementation. If
`ScreepController` is ever renamed or restructured, `CombatUtils` breaks
silently.

**Recommendation:** Add a `getCreepJobName(creepId)` (or similar) accessor to
`GameState` so that `CombatUtils` never needs to reach into the controller
directly.

### 6.3 `GameState` holds a reference to `ScreepController`

The dependency injection flows: `ScreepController` → `GameState` constructor.
But `GameState` then calls back into `screepController.hasCreepOfRole()` and
exposes `screepController.creeps` to consumers. This is a circular-ish
dependency that makes `GameState` harder to unit-test and reason about.

**Recommendation:** Rather than injecting the controller, have the controller
push relevant information into state each tick (e.g., call
`gameState.updateCreepRoster(creepRoleMap)` from within
`screepController.updateCreeps()`). This keeps the flow unidirectional.

---

## 7. DRY Violations

### 7.1 Tug-chain joining logic duplicated between `TugJob` and `BlockerJob`

`TugJob._joinOrLeadChain` and `BlockerJob._actAsTug` implement nearly
identical logic for joining an existing tug chain: move toward the last chain
member, and when adjacent, insert at position 0 if the chain has a single
member, or append otherwise. Any bug fix in one must be manually replicated in
the other.

**Recommendation:** Extract the shared join logic into a single utility
function (e.g. `joinTugChain(creepId, creep, gameState)`) in
`TugChainService` (or a separate `TugChainUtils` module) and have both jobs
call it.

### 7.2 Idle movement to map center is copy-pasted

Both `MeleeJob.idle()` and `RangedJob.idle()` independently compute the center
position:

```js
const mapSize = MapTopology.ARENA_SIZE;
const centerPos = { x: mapSize / 2, y: mapSize / 2 };
creep.moveTo(centerPos);
```

**Recommendation:** Export a `MAP_CENTER` constant from `constants.mjs` (or
compute it once from `MapTopology`) so this pattern does not need to be
repeated, and move the `idle()` implementation up to `ActiveCreep` as a
protected helper.

### 7.3 Chebyshev distance computed inline in multiple places

The Chebyshev distance formula
`Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))` appears in at least
four different files (`PayloadJob`, `MinerJob`, `TugJob`, `GameState`).

**Recommendation:** Add a `chebyshevDistance(a, b)` helper to `RangeUtils`
(alongside the existing `isInRangedAttackRange` etc.) and use it everywhere.

---

## 8. Dead Code

### 8.1 Commented-out defensive retreat logic

`MeleeJob.act()` and `RangedJob.act()` both contain commented-out calls to
`CombatUtils.handleDefensiveRetreat`:

```js
// const inDefensiveMode = CombatUtils.handleDefensiveRetreat(creep, this.gameState);
const inDefensiveMode = false;
```

The `handleDefensiveRetreat`, `shouldAdoptDefensivePosture`, and
`findDefensiveRampartPosition` methods in `CombatUtils` are therefore fully
unreachable at runtime.

**Recommendation:** Remove unused code

### 8.2 `EXTENSIONS_PER_MINER: 0`

`MapTopology.EXTENSIONS_PER_MINER` is set to `0`. If extensions are never
built, this constant (and any code that reads it) serves no purpose.

**Recommendation:** remove the constant and any associated code paths.

---

## 9. Logic Redesign Recommendations

### 9.1 Adopt a Finite State Machine (FSM) or Behaviour Tree for creep AI

The most impactful long-term improvement would be to replace the nested
`if`/`else` chains inside each `act()` method with a more explicit control
structure. Today a typical `act()` reads:

```js
if (!result || result.mode === 'idle') { ... return; }
if (result.mode === 'payload_priority') { ... return; }
if (!this.gameState.isCombatEngaged()) { ... return; }
// standard mode
```

As new modes, priorities, or unit types are added, these chains grow and
interact in hard-to-predict ways.

**Option A — Explicit FSM:** Give each job a `this.state` property and a
`transitions` table. The `act()` method becomes a single `switch (this.state)`
with well-defined entry and exit conditions. `MinerJob` already approximates
this through `MinerStateMachine`; the same pattern should be applied to all
combat jobs.

**Option B — Behaviour Tree:** Implement a lightweight BT library (or a
simple priority-selector pattern). Each behavior is a small, testable node.
The tree composes them declaratively:

```
Selector
  ├── Sequence (enemy payload approaching)
  │     ├── Condition: enemyPayloadActive
  │     └── Action: attackOrChasePayload
  ├── Sequence (combat engaged)
  │     ├── Condition: isCombatEngaged
  │     └── Action: attackOrMoveToEnemy
  └── Action: idleAtCenter
```

This makes the priority ordering explicit, self-documenting, and trivially
extensible — adding a new behavior is adding a new node, not modifying an
existing chain. <-- prefered.

### 9.2 Decompose `CombatUtils.selectPrimaryTarget`

`selectPrimaryTarget` currently returns a discriminated union with three modes
(`idle`, `payload_priority`, `standard`) and callers must handle all three
with matching `if` chains. The function is responsible for target selection,
mode classification, and range filtering simultaneously.

**Recommendation:** Break it into focused functions:
- `getEnemyPayloadIfActive(gameState)` → `Creep | null`
- `getValidTargets(gameState)` → `Creep[]`
- `getFlagBlocker(gameState)` → `Creep | null`
- `getMovementTarget(creep, validTargets, gameState)` → `Object`

Callers compose these into a decision sequence that is easier to follow and
test independently.

### 9.3 Tug-chain architecture

The tug chain is currently a raw array of IDs stored inside `GameState`.
Multiple disconnected classes (`TugJob`, `BlockerJob`, `MinerJob`,
`PayloadJob`, `TugChainService`) read and write it directly. Any ordering
invariant (e.g., leader at index 0, subject last) must be enforced everywhere
independently.

**Recommendation:** Encapsulate the tug chain in a `TugChain` class with
methods `claim(leaderId, subjectId)`, `extend(followerId)`, `isLeader(id)`,
`isSubject(id)`, `clear()`, and `tick(target, gameState)` (which today is
`TugChainService.moveChain`). Store a single `TugChain` instance in the
relevant state class; no raw array is ever passed around.

### 9.4 Build strategy extensibility

Adding a new creep type today requires:
1. Creating a new `*Job` class.
2. Adding it to `JobRegistry`.
3. Adding it to `BuildStrategy.getNextCreepToBuild` (and potentially to the
   `creepCounts` object and any phase-2 ratio logic).

Steps 2 and 3 violate the **Open/Closed Principle**: existing logic must be
modified to accommodate a new type.

**Recommendation:** Move phase-2 build logic out of `BuildStrategy` and into a
configurable policy object in `constants.mjs`, similar to `INITIAL_BUILD`:

```js
PHASE2_BUILD: [
    { job: 'fighter', weight: 5 },
    { job: 'cleric',  weight: 1 },
]
```

`BuildStrategy` would then iterate this list and compute the deficit
generically, without knowing the job names. Adding a new phase-2 unit type
becomes a data change, not a code change.

---

## 10. Software Principles

### Single Responsibility Principle (SRP)
`GameState` should be split (see §6.1). Each new class should have one reason
to change: `WorldSnapshot` changes when the Screeps API changes; `CombatState`
changes when combat strategy changes; `MiningState` changes when the resource
economy changes.

### Open/Closed Principle (OCP)
The build system should be open for extension (new job types) without modifying
existing code (see §9.4). The BT / FSM recommendation in §9.1 also supports
OCP: a new behavior is a new node, not a modification to an existing chain.

### Liskov Substitution Principle (LSP)
The `ActiveCreep → MeleeJob → FighterJob` hierarchy is well-designed: any
`MeleeJob` can be substituted for an `ActiveCreep`. Maintaining this requires
that all subclasses honor the `act()` contract (never throw, always return
cleanly). The current `BODY` / `COST` static abstract properties are
appropriate but should have a clearer "abstract" documentation note so
contributors know they are mandatory.

### Interface Segregation Principle (ISP)
`GameState` exposes ~30 accessor methods to every consumer, even though most
consumers only need a handful. Splitting `GameState` into domain state objects
(§6.1) naturally enforces ISP: a combat job receives only `WorldSnapshot` and
`CombatState`, not the full kitchen-sink object.

### Dependency Inversion Principle (DIP)
Jobs currently depend on the concrete `GameState` class. If `GameState` ever
changes its interface, all jobs break. Defining a minimal `IGameState`
interface (via JSDoc `@typedef`) and having jobs accept that type makes the
dependency explicit and allows tests to pass in a lightweight mock.

### Don't Repeat Yourself (DRY)
Address the three duplications identified in §7 (tug-chain join logic, center
idle movement, Chebyshev distance).

### KISS (Keep It Simple, Stupid)
Prefer plain module functions over static-method classes for utilities (§5.2).
The class wrapper adds cognitive overhead without benefit when there is no
instance state. Simpler constructs are easier to read, test, and refactor.

### Fail Loudly
Several `act()` methods silently return early when data is missing (e.g.
`getObjectById` returns null). In a game, silent failures can produce confusing
behavior that is hard to diagnose. Consider adding structured logging (a
`debug(msg)` helper that can be toggled) so that unexpected null lookups
produce a visible trace.
