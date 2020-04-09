module.exports = function (RED) {
	"use strict";
	var vm        = require("vm");
	var util      = require("util");
	var xstate    = require('xstate');
	var smcat     = require('../src/smcat-render');
	var immutable = require('immutable');
	xstate.smcat  = require('../src/xstate-smcat');

	var registeredNodeIDs = [];
	var activeId = null;
	var renderTimeoutMs = 20000;

	function sendWrapper(node, sendFcn, _msgid, msgArr, cloneMsg) {
		// Copied from function node
		if (msgArr == null) {
            return;
        } else if (!util.isArray(msgArr)) {
            msgArr = [msgArr];
        }
		var msgCount = 0;
		
		// We only have one msg output (2nd output), ignore all the others
		if (!util.isArray(msgArr[0])) {
			msgArr[0] = [msgArr[0]];
		}

		// shallow clone the msgArr because we may delete some elements
		msgArr[0] = [...msgArr[0]];
		msgArr.splice(1);

		for (let n=0; n < msgArr[0].length; n++) {
			let msg = msgArr[0][n];
			if (msg !== null && msg !== undefined) {
				if (typeof msg === 'object' && !Buffer.isBuffer(msg) && !util.isArray(msg)) {
					if (msgCount === 0 && cloneMsg !== false) {
						msgArr[0][n] = RED.util.cloneMessage(msgArr[0][n]);
						msg = msgArr[0][n];
					}
					msg._msgid = _msgid;
					msgCount++;
				} else {
					let type = typeof msg;
					if (type === 'object') {
						type = Buffer.isBuffer(msg)?'Buffer':(util.isArray(msg)?'Array':'Date');
					}
					node.error("Trying to send invalid message type.");
				}
			}
		}
        
        if (msgCount>0) {
			// Send to 2nd output
            sendFcn.call(node,[null, ...msgArr]);
        }
	}

	function getSandbox(node) {
		return {
			console:console,
            util:util,
            Buffer:Buffer,
			Date: Date,
			xstate: {
				Machine: xstate.Machine,
				assign: xstate.assign,
				actions: xstate.actions,
				sendUpdate: xstate.sendUpdate,
				spawn: xstate.spawn,
				after: xstate.after,
				State: xstate.State
			},
            RED: {
                util: RED.util
            },
            __node__: {
                id: node.id,
                name: node.name,
                log: function() {
                    node.log.apply(node, arguments);
                },
                error: function() {
                    node.error.apply(node, arguments);
                },
                warn: function() {
                    node.warn.apply(node, arguments);
                },
                debug: function() {
                    node.debug.apply(node, arguments);
                },
                trace: function() {
                    node.trace.apply(node, arguments);
				},
				send: function(send, id, msgs, cloneMsg) {
                    sendWrapper(node, send, id, msgs, cloneMsg);
                },
            },
            env: {
                get: function(envVar) {
                    var flow = node._flow;
                    return flow.getSetting(envVar);
                }
            },
            setTimeout: function () {
                var func = arguments[0];
                var timerId;
                arguments[0] = function() {
                    sandbox.clearTimeout(timerId);
                    try {
                        func.apply(this,arguments);
                    } catch(err) {
                        node.error(err,{});
                    }
                };
                timerId = setTimeout.apply(this,arguments);
                node.outstandingTimers.push(timerId);
                return timerId;
            },
            clearTimeout: function(id) {
                clearTimeout(id);
                var index = node.outstandingTimers.indexOf(id);
                if (index > -1) {
                    node.outstandingTimers.splice(index,1);
                }
            },
            setInterval: function() {
                var func = arguments[0];
                var timerId;
                arguments[0] = function() {
                    try {
                        func.apply(this,arguments);
                    } catch(err) {
                        node.error(err,{});
                    }
                };
                timerId = setInterval.apply(this,arguments);
                node.outstandingIntervals.push(timerId);
                return timerId;
            },
            clearInterval: function(id) {
                clearInterval(id);
                var index = node.outstandingIntervals.indexOf(id);
                if (index > -1) {
                    node.outstandingIntervals.splice(index,1);
                }
            }
        };
	}

	function getFunctionText(node) {
		return `
var result = null;
result = (function(__send__,__done__){
	var node = {
		id:__node__.id,
		name:__node__.name,
		log:__node__.log,
		warn:__node__.warn,
		error:__node__.error,
		debug:__node__.debug,
		trace:__node__.trace,
		status:__node__.status,
		send:function(msgs,cloneMsg){__node__.send(__send__,null,msgs,cloneMsg);},
		done:__done__
	}
	${node.config.xstateDefinition}
})(send,done);
`
	}

	function getXStateClock(node) {
		return {
			setTimeout: (fn, timeout) => {
				// Trap exceptions
				var fnHook = () => {
					try {
						fn.apply(null);
					} catch(err) {
						node.error(`Error during delayed event: ${err}`);
						// ? TODO: halt statemachine
					}
				}
				return setTimeout(fnHook,timeout);
			},
			clearTimeout: (id) => {
				return clearTimeout(id);
			}
		};
	}

	function makeStateObject(state) {
		return {
			state: state.value,
			changed: state.changed,
			done: state.done,
			event: state.event,
			context: state.context
		}
	}

	function restartMachine(node) {

		if( !node ) return;

		let context = node.context();
		
		if( !context || !context.xstate || !context.xstate.blueprint ) return;

		let service = context.xstate.service;
		if( service )
			service.stop();

		let machine = xstate.Machine(
			context.xstate.blueprint.toJS(),
			context.xstate.machineConfig ? context.xstate.machineConfig : undefined);

		service = xstate.interpret(machine, {
			clock: context.xstate.clock
		});

		context.xstate.service = service;
		context.xstate.machine = machine;

		let transitionFcn = (state) => {
			node.status({fill: 'green', shape: 'dot', text: 'state: ' + JSON.stringify(state.value)});

			let payload = {
				state: state.value,
				changed: state.changed,
				done: state.done,
				activities: state.activities,
				actions: state.actions,
				event: state.event,
				context: state.context
			};

			try {
				if( context.xstate.listeners ) {
					let listeners = context.xstate.listeners;

					if( Array.isArray(listeners) ) {
						for( let listener of listeners ) {
							listener(payload);
						}
					} else {
						listeners(payload);
					}
				}
			} catch(err) {
				node.error(`Error while executing listeners: ${err}`);
			}

			// Output
			node.send([[{
				topic: "state",
				payload: payload
			}]]);
			
			// Publish to editor
			// Runtime only sends data if there are client connections/subscriptions
			if( activeId == node.id ) {
				RED.comms.publish("smxstate_transition",{
					type: 'transition',
					id: node.id,
					state: makeStateObject(state),
					machineId: context.xstate.blueprint.get('id')
				});
			}
		};

		let dataChangedFcn = (context, previousContext) => {

			// Output
			node.send([[{
				topic: "context",
				payload: context
			}]]);
			
			// Publish to editor
			// Runtime only sends data if there are client connections/subscriptions
			if( activeId == node.id ) {
				RED.comms.publish("smxstate_transition",{
					type: 'context',
					id: node.id,
					context: context,
					machineId: node.context().xstate.blueprint.get('id')
				});
			}
		};

		service
			.onTransition( (state) => transitionFcn(state) )
			.onChange( (context, previousContext) => dataChangedFcn(context, previousContext) )
			.start();
	}

	function getNodeParentPath(node) {
		let id = node.id;

		let path = [];
		let subflowInst = [], subflowProt = [];
		let f = node._flow;

		path.unshift((node.name ? node.name : node.type) + ` (${node._alias ? node._alias : node.id})`);
		while( f.TYPE === "subflow" ) {
			id = f.id;
			subflowProt.unshift( f.subflowDef.id );
			subflowInst.unshift( f.subflowInstance.id );

			let subflowName = f.subflowInstance.name ? f.subflowInstance.name : f.subflowDef.name;
			if( f.parent !== "subflow" ) {
				path.unshift( subflowName + ` (${f.subflowInstance.id})`);
			} else {
				path.unshift( subflowName + ` (${f.subflowDef.id})`);
			}

			f = f.parent;
		}
		path.unshift(f.flow.label)
		
		return {
			rootId: id,
			flowId: f.id,
			path: {
				labels: path,
				subflowInstance: subflowInst,
				subflowPrototype: subflowProt
			}
		};
	}

	function StateMachineNode (config) {
		RED.nodes.createNode(this, config);

		// Keep track of node ids
		let nodePath = getNodeParentPath(this);
		let nodeinfo = Object.assign({
			id: this.id,        // ID of the instance of the node
			name: this.name,
			alias: this._alias,	// This identifies the node prototype within subflows
		}, nodePath);

		registeredNodeIDs.push(nodeinfo);

		var node = this;
		var nodeContext = this.context();

		// array of active timers
		this.outstandingIntervals = [];
		this.outstandingTimers    = []; 

		// init the node status
		node.status({fill: 'red', shape: 'ring', text: 'invalid setup'});
		node.config = config;
		
		// Send new node info to the UI
		RED.comms.publish('smxstate', { type: 'add', data: nodeinfo });

		// Create xstate state-machine
		var vmcontext = vm.createContext(getSandbox(this));
		vmcontext.send = node.send;
		vmcontext.done = node.done;

		try {
			this.initscript = vm.createScript(getFunctionText(this), {
				filename: 'SMXSTATE node:'+this.id+(this.name?' ['+this.name+']':''),
				displayErrors: true
			});

			this.initscript.runInContext(vmcontext);
			
			let smobj, smcfg, smlisteners;

			if( vmcontext.result.hasOwnProperty('machine') ) {
				smobj  = vmcontext.result.machine;
				if( vmcontext.result.hasOwnProperty('config') ) {
					smcfg = vmcontext.result.config;
				}
				if( vmcontext.result.hasOwnProperty('listeners') ) {
					smlisteners = vmcontext.result.listeners;
				}
			} else {
				smobj  = vmcontext.result;
			}

			if( !smobj.hasOwnProperty("id") ) {
				smobj.id = node.id;
			}

			smobj.id = smobj.id.replace(/[^a-zA-Z0-9\.\s\n\r]/gi,'');

			nodeContext.xstate = { 
				blueprint: immutable.fromJS(smobj),
				machineConfig: smcfg,
				listeners: smlisteners,
				clock: getXStateClock(node)
			};

			restartMachine(node);

		} catch(err) {
			this.error(err);
		}

		node.on('input', function (msg, send, done) {

			try {
				if( msg.hasOwnProperty("topic") && typeof msg.topic === "string" ) {
					if( msg.topic === "reset" ) {
						restartMachine( node );
					} else {
						nodeContext.xstate.service.send(msg.topic, msg.payload);
					}
				}
				else
					throw( "No event (msg.topic) is defined." );

				done();
			} catch(err) {
				done(err);
			}
		});

		node.on('close', function (removed, done) {
			// Removing a node within a subflow or removing a subflow containing this node does not set removed to true!
			RED.comms.publish('smxstate', { 
					type: 'delete',
					removed: removed,
					data: registeredNodeIDs.filter(e => e.id === this.id )
				}
			);

			nodeContext.xstate.service.stop();

			registeredNodeIDs = registeredNodeIDs.filter(e => e.id != this.id);

			done();
        });
	}
	RED.nodes.registerType('smxstate', StateMachineNode);

	RED.httpAdmin.get("/smxstate/:method", RED.auth.needsPermission("smxstate.read"), function(req,res) {
		switch(req.params.method) {
			case 'getnodes':
				try {
					res.status(200).send(registeredNodeIDs);
				} catch(err) {
					res.sendStatus(500);
					node.error(`GET Command failed: ${err.toString()}`);
				}
				break;
			default:
				res.sendStatus(404);
				node.error(`Invalid method: ${req.params.method}`);
				break;
		}
	});

	RED.httpAdmin.post("/smxstate/:id/:method", RED.auth.needsPermission("smxstate.write"), function(req,res) {
		var node = RED.nodes.getNode(req.params.id);
		if (node != null) {
			switch(req.params.method) {
				case 'getgraph':
					try {
						// Render state machine using smcat
						let smcat_machine = xstate.smcat.toSmcat(node.context().xstate.machine);

						// Render in separate process with 10s timeout
						console.time('render');
						smcat.render(smcat_machine, {
							onDone: (output) => {
								let smcat_svg;

								console.timeEnd('render');
								if( !!output && output.code === 0 ) {
									smcat_svg = output.data;
								} else {
									res.sendStatus(500);
									if( !!output )
										node.error(`Rendering of state machine failed: Render process returned error code ${output.code}: ${output.err}`);
									else
										node.error(`Rendering of state machine failed: Render process timed out.`);
									
									return;
								}

								smcat_svg = smcat_svg.match(/<svg.*?>.*?<\/svg>/si)[0];
								res.status(200).send(smcat_svg);

								// Send update for context/state
								let context = node.context().xstate;

								setTimeout( () => {
									RED.comms.publish("smxstate_transition",{
										type: 'transition',
										id: node.id,
										state: makeStateObject(context.service.state),
										machineId: context.blueprint.get('id')
									});
								}, 100);

								setTimeout( () => {
									RED.comms.publish("smxstate_transition",{
										type: 'context',
										id: node.id,
										context: context.service.state.context,
										machineId: context.blueprint.get('id')
									});
								}, 100);
							}, 
							timeoutMs: renderTimeoutMs,
							logOutput: true,
							renderer: 'smcat'
						});
						
						// Save the last provied graph ID
						activeId = req.params.id;
						//res.sendStatus(200);
					} catch(err) {
						res.sendStatus(500);
						node.error(`Rendering of state machine failed: ${err.toString()}`);
					}
					break;
				case 'reset':
					try {
						restartMachine(node);
						res.sendStatus(200);
					} catch(err) {
						res.sendStatus(500);
						node.error(`Reset of state machine failed: ${err.toString()}`);
					}
					break;
				default:
					res.sendStatus(404);
					node.error(`Invalid method: ${req.params.method}`);
					break;
			}
			
		} else {
			res.sendStatus(404);
		}
	});
};
