# node-red-contrib-xstate-machine

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
