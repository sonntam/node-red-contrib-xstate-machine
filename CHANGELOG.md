# node-red-contrib-xstate-machine

## 1.3.0

### Minor Changes

- ea32705: Update dependencies to latest minor version

### Patch Changes

- bf0a6e7: Fix problem with usage of setTimeout and clearTimeout

## 1.2.4

### Patch Changes

- 59683a8: Update and fix versions of some dependencies (jsdom, smcat, xstate)
- 4ff63ce: Fix visualization of service invocations in xstate

## 1.2.3

### Patch Changes

- 4b6a016: Fix intellisense errors for xstate and util packages in monaco editor

## 1.2.2

### Patch Changes

- c506a42: Fixed display of transition actions

## 1.2.1

### Patch Changes

- c8e2d6a: Fixed display of state actions due to change in xstate

## 1.2.0

### Minor Changes

- b2a90cd: Set minimum required node.js version to 12.0
- d32cce7: update dependencies

## 1.1.1

### Patch Changes

- cd848e4: Updated dependencies xstate smcat and checked compatibility with node-red 1.1.0

## 1.1.0

### Minor Changes

- 9cfd832: Allow use of flow. context. and global. functions within smxstate

### Patch Changes

- fb4eefe: Changed smxstate node output labels to "stateChanged" and "msgOutput"
- 5e274dc: Updated dependencies

## 1.0.0

### Major Changes

- 020db5c: Breaking change: Event data read from an external message's payload property is now also available within the payload property of the event. You will have to change your statemachines that process external event data accordingly. See README.md section "Migrating from 0.X to 1.X" for more details.

## 0.3.0

### Minor Changes

- 2d05f27: Added caching for state machine visualization renderings to speed up display on low-end hardware
- 15e5cf7: Implemented custom settings for smxstate node (caching, renderer settings, ...)
- 7af5b43: If available native graphviz dot can now be used as renderer instead of viz.js

### Patch Changes

- 78ecaf3: Fixed problem with rendering of empty action objects
- fc14fb9: Update docs to reflect the extended sidebar settings
- 576e5c8: Update dependencies xstate and clone

## 0.2.1

### Patch Changes

- 634cc0a: Fixed firefox/opera/edge incompatibility issue

## 0.2.0

### Minor Changes

- 565dfe9: Fixed "context" msg being sent if data did not change

### Patch Changes

- 3a2859d: Fixed whitespace in do/ action labels in visualization

## 0.1.5

### Patch Changes

- 859d06a: Added some events to default machine
- 7827d09: Fixed problem with initial state of compound states in visualization
- 12ac1fd: Added some code for backwards compatibility to node-red 0.20.x

## 0.1.4

### Patch Changes

- 48b7eff: Fixed bug in default machine: Added missing assign function. Also updated the usable xstate functions within the vm.
- bd26e46: Readme typo fixes

## 0.1.3

### Patch Changes

- Removed previous context in context update message as it doesn't seem to work --> xstate

## 0.1.2

### Patch Changes

- a4ac0a6: Prevent double messaging about context on machine startup
- 6750fba: Stop the default node from babbling too much
- 4046931: Make default node use assign() action to set context

## 0.1.1

### Patch Changes

- 2b66d37: bumped dependencies and removed unnecessary dependencies
- 3059a0b: Double the rendering timeout to 20 seconds for now (issue #1)
- 6bf948f: Fix typo in README
- 2b66d37: Added changesets and some tests

## 0.1.0

- Initial version
