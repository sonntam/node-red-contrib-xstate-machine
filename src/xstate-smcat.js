// Converter for XSTATE machines to SMCAT format for visualization
// It does not support all features
const indentString = require('indent-string');

const typeSep = '/';
const finalNodeSuffix = "Node";

function sanitizeStateId(state) {
    let sanitizeStateId = String(state);
    sanitizeStateId = sanitizeStateId.replaceAll('"', "'");
    return sanitizeStateId;
}

function getStateId(state, type) {
    return "\"" + sanitizeStateId(state.id) + typeSep + (type === undefined ? state.type : type) + "\"";
}

function getStateAction(actionTrigger) {
    if(!actionTrigger || actionTrigger.length == 0 )  return null;

    actionTrigger = actionTrigger
        .filter( e => !e.hasOwnProperty('id') || !e.id.startsWith("xstate.after(") )
        .filter( e => !e.hasOwnProperty('sendId') || !e.sendId.startsWith("xstate.after(") )
        .filter( e => ( e.type ? true : false) );

    let actionNames = [];

    actionNames = actionTrigger.map( e => {
        if( e.hasOwnProperty('type') && e.type === 'xstate.invoke') {
            return "invoke::" + (e.src ? e.src : e.id);
        }
        return e.id ? e.id : e.type;
    });

    return actionNames
        .map( e => e.replace(/['";,{}\[\]]\s/sgi,'') + '()' )
        .join(' ');
}

function getStateCode(state) {
    let code = [];

    if( state.onEntry && state.onEntry.length > 0 ) {
        let actionDef = getStateAction( state.onEntry );
        if( actionDef )
            code.push( "entry/ " + actionDef );
    }

    if( state.activities && state.activities.length > 0 ) {
        let actionDef = getStateAction( state.activities );
        if( actionDef )
            code.push( "do/ " + actionDef );
    }

    if( state.onExit && state.onExit.length > 0 ) {
        let actionDef = getStateAction( state.onExit );
        if( actionDef )
            code.push( "exit/ " + actionDef );
    }

    return code.join('\n');
}

function typeMap(intype) {
    const mapping = {
        atomic: "regular",
        compound: "regular",
        final: "regular",
    }

    if( mapping[intype] ) return mapping[intype];
    else return intype;
}

function createChildrenStates(parentState,level) {

    if( !level ) level = 0;

    let transitionsDef = createTransitions(parentState).join(";\n");
    let statesDef = [];

    if( transitionsDef ) transitionsDef += ';';

    for( let [state,stateObj] of Object.entries(parentState.states) ){
        let stateDef = getStateId(stateObj) + ` [label="${state}" type=${typeMap(stateObj.type)}]`;
        let transitionDef = '';

        let code = getStateCode(stateObj);
        if( code ) stateDef += " :\n" + indentString(code, 4);

        // Recurse
        let childDefs = createChildrenStates(stateObj, level+1);

        if( childDefs.states ) stateDef += ' {\n' + indentString(childDefs.states, 4*(level+1)) + '\n}';
        if( childDefs.transitions ) transitionsDef += "\n" + childDefs.transitions;

        statesDef.push(stateDef);

        // Add additional final state in the diagram for "the" final state
        if( stateObj.type === "final" ) {
            statesDef.push(getStateId(stateObj) + finalNodeSuffix + ' [label="" type=final]');
        }
    }

    // Initial state for compound/parallel state
    if( statesDef.length > 0 && parentState.type !== "parallel" ) {
        let rootNode = getClosestChildState( parentState, parentState.initialStateNodes[0] );
        if( rootNode ) {
            statesDef.unshift(getStateId(parentState, "initial"));
            transitionsDef = statesDef[0] + " => " + getStateId(rootNode) + ";" + transitionsDef;
        }
    }
    return  { 
        states: statesDef.length > 0 ? statesDef.join(',\n') + ";" : null,
        transitions: transitionsDef.length > 0 ? transitionsDef : null
     };
}

function getClosestChildState(parent, child) {

    if( !(child.parent) ) return null;

    if( child.parent === parent ) // Found it
        return child;
    
    return getClosestChildState(parent, child.parent);
}

function convertMilliseconds(ms) {

    // Try seconds, minutes, hours, days, weeks
    let s = ms/1000;
    if( s != Math.round(s) ) return `${ms} ms`;

    let min = s/60;
    if( min != Math.round(min) ) return `${s} s`;

    let h = min/60;
    if( h != Math.round(h) ) return `${min} min`;

    let d = h/24;
    if( d != Math.round(d) ) return `${h} h`;

    let w = d/7;
    if( w != Math.round(w) ) return `${d} d`;

    return `${w} w`;
}

function getTransitionEvent(transition) {
    if( transition.hasOwnProperty("delay") ) {
        return 'after ' + convertMilliseconds(transition.delay);
    } else {
        if( transition.event.startsWith('done.') ) {
            return 'done';
        } else {
            return transition.event;
        }
    }
}

function createTransitions(parentState) {
    let transitionsDef = [];

    // If this state is a final state, create another "always" transition from this target state to the real final state node
    if( parentState.type === "final" )
        transitionsDef.push( getStateId(parentState) + " => " + getStateId(parentState) + finalNodeSuffix );

    for( let transition of parentState.transitions ) {
        let transitionDefs = [];

        if( !transition.source ) {
            console.warn(`State "${parentState.id}" has got a transition for event ${transition.event} with no source state.`);
            continue;
        }

        if( !transition.target ) {
            // Self transition
            transitionDefs.push( getStateId( transition.source ) + " => " + getStateId( transition.source ) );
        } else {
            for( let targetState of transition.target ) {
                transitionDefs.push( getStateId( transition.source ) + " => " + getStateId( targetState ) );
            }
        }
        

        if( transition.internal )
            transitionDefs = transitionDefs.map( (e) => e + ' [type=internal]' );

        let transitionLabel = '';
        
        if( transition.event ) transitionLabel += getTransitionEvent(transition);
        if( transition.cond ) {
            if( Array.isArray(transition.cond) ) {
                if( transition.cond.length > 0 )
                    transitionLabel += " [" + transition.cond.reduce( (a,e) => (!a?e.name:a + " && " + e.name), "" ) + "]";
            }
            else
                transitionLabel += " [" + transition.cond.name + "]";
        }  
    
        if( transition.actions ) {
            if( Array.isArray(transition.actions) ) {
                if( transition.actions.length > 0 )
                    transitionLabel +=  " / " + transition.actions.reduce( (a,e) => (!a? (e.type + "()"):(a + ", " + e.type + "()")), "" );
            }
            else
                transitionLabel += " / " + transition.actions.type + "()";
        } 
        
        if( transitionLabel ) transitionDefs = transitionDefs.map( (e) => e + " : " + transitionLabel.trim());

        transitionsDef = transitionsDef.concat(transitionDefs);
    }

    return transitionsDef;
}

exports.toSmcat = function(machine) {

    let smcat = createChildrenStates(machine);

    return smcat.states + "\n\n" + smcat.transitions;

}