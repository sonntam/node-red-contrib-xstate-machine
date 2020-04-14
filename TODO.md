TODO
====

 - [x] Add sidebar with dropdown where one can select all defined state-machines and show a visualization of the current state including data context
 - [x] Do server-side SVG visualization drawing of the state machine using [`RED.comms`](https://github.com/node-red/node-red/blob/master/packages/node_modules/%40node-red/runtime/lib/api/comms.js)
 - [x] Do client side updating of the visualizations using CSS (active state/active transitions)
 - [x] Incorporate xstate
 - [x] Incorporate state-machine-cat (use node.js program server-side)
 - [x] Figure out how [`RED.comms`](https://github.com/node-red/node-red/blob/master/packages/node_modules/%40node-red/runtime/lib/api/comms.js) works, a good example is the [debug node client side HTML](https://github.com/node-red/node-red/blob/master/packages/node_modules/%40node-red/nodes/core/common/21-debug.html) and the [debug node server side JS](https://github.com/node-red/node-red/blob/master/packages/node_modules/%40node-red/nodes/core/common/21-debug.js)
 - [x] Client side `RED.comms` is [here](https://github.com/node-red/node-red/blob/master/packages/node_modules/%40node-red/editor-client/src/js/comms.js)
 - [ ] Add checkbox to enable/disable state chart animation
 - [ ] Create more tests
 - [ ] Check if the user can overutilize the node-red server and do something about it
 - [x] Check browser compatibility
   - [x] Google chrome (80.0.3987.149)
   - ❌ IE 11.719 - not loading correctly
   - [x] Edge (44.18362.449.0)
   - [x] Firefox (75.0)
   - [x] Opera (67.0.3575.137)
   - [ ] Safari
 - [ ] Update the editor UI sidebar when machine is added/deleted accordingly
 - [ ] Write more examples
 - [ ] Implement functionality to be able to open the state-machine visualization in a new window
 - [ ] Maybe provide a third output that can send events to other statemachines using a `smxstate.send()` function of some sorts.
 - [ ] See what it takes to put the visualization onto node-red-dashboard
 - [ ] Revisit the rendering process timeout of 10 seconds because [RasPi2 performance seems to be too low for the cat example](https://discourse.nodered.org/t/announcement-node-red-contrib-xstate-machine-flexible-state-machines-for-node-red/24262/6?u=sonntam)
 - [ ] Implement caching for the visualization graphics