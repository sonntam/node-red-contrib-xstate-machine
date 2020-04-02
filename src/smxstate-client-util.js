// This code runs within the browser
if( !RED ) {
    var RED = {}
}
RED.smxstate = (function() {

    function getCurrentlySelectedNodeId() {
        let selector = $('#red-ui-sidebar-smxstate-display-selected');
        let value    = selector.val();

        if( !value ) return null;

        return {
            id: value,
            rootId:  selector.children('option:selected').attr('data-reveal-id'),
            aliasId: selector.children('option:selected').attr('data-alias-id'),
            label:   selector.children('option:selected').text()
        };
    }

    var animationStack = [];
    var animationBusy  = false;
    function animateFcn(data) {
        
        // Limit to 10 updates per second
        if( data && (data.state.changed === true || data.state.changed === undefined) ) { animationStack.push(data); }
        if( !animationBusy && animationStack.length > 0 ) {
            animationBusy = true;

            // Do the actual animation and data update
            let data = animationStack.shift();

            // Recurse into state
            function getStatepaths(state, parentState) {
                if( typeof state === "string" ) return [(parentState ? parentState + "." + state : state)]; 
                
                if( !state ) return parentState;
                
                let substates = Object.keys(state);
                
                let statePaths = [];
                for( let substate of substates ) {
                    let substatePath = parentState ? parentState + "." + substate : substate;
                    if( state[substate] ) statePaths.push(substatePath);
                    statePaths = statePaths.concat(getStatepaths(state[substate], substatePath));
                }
                //console.log(statePaths)
                return statePaths;
            }

            let activeStates = getStatepaths(data.state.state);

            // Reset all other states
            let elements = $(
                '#red-ui-sidebar-smxstate-content svg g.graph g:not([class="edge"])'
            );
            
            elements.children('*[stroke][stroke!="transparent"]').attr('stroke','#000000');

            // Style active states
            for( let activeState of activeStates ) {
                elements
                    .has('title:contains(' + data.machineId + '.' + activeState + '/)')
                    .has('title:not(:contains(/initial))')
                    .children('*[stroke][stroke!="transparent"]')
                    .attr('stroke','#FF0000');
            }

            let contextElement = RED.utils.createObjectElement( data.state.context, {
                key: /*true*/null,
                typeHint: "Object",
                hideKey: false
             } );

            $('#red-ui-sidebar-smxstate-context-data').html(contextElement)

            setTimeout(() => {
                animationBusy = false;
                animateFcn();
            }, 100);
            if( animationStack.length > 5 ) animationStack = animationStack.splice(-5);
        }
    }

    function displayFcn() {
        idObj = getCurrentlySelectedNodeId();
        
        // Clear graphics and get a new one
        $('#red-ui-sidebar-smxstate-graph').empty();
        
        // Show spinner
        $('#red-ui-sidebar-smxstate-graph').before(
            $('<div id="red-ui-sidebar-smxstate-spinner">').append(
                '<i class="fa fa-circle-o-notch fa-spin fa-5x fa-fw"></i> <span>Loading...</span>'
            ).css( {
                textAlign: "center",
                margin: "10px"
            })
        );

        $.ajax({
            url: "smxstate/"+idObj.id+"/getgraph",
            type:"POST",
            success: function(resp) {
                $('#red-ui-sidebar-smxstate-spinner').remove();
                RED.notify(`Successfully rendered state-graph for ${idObj.label}`,{type:"success",id:"smxstate"});
                
                $('#red-ui-sidebar-smxstate-graph').replaceWith($(resp).attr("id", "red-ui-sidebar-smxstate-graph"));
            },
            error: function(jqXHR,textStatus,errorThrown) {
                $('#red-ui-sidebar-smxstate-spinner').remove();
                if (jqXHR.status == 404) {
                    RED.notify(RED._("node-red:common.notification.error",{message:"resource not found"}),"error");
                } else if (jqXHR.status == 500) {
                    RED.notify("Rendering of the state machine failed.","error");
                } else if (jqXHR.status == 0) {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.no-response")}),"error");
                } else {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.unexpected",{status:jqXHR.status,message:textStatus})}),"error");
                }
            }    
        });
    }

    function resetFcn() {

        // Get selected machine and reset state and context to initial ones
        let idObj    = getCurrentlySelectedNodeId();

        if( !idObj ) return;

        $.ajax({
            url: "smxstate/"+idObj.id+"/reset",
            type:"POST",
            success: function(resp) {
                RED.notify("State machine " + idObj.id + " was reset.", { type:"success", id:"smxstate" });
            },
            error: function(jqXHR,textStatus,errorThrown) {
                if (jqXHR.status == 404) {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.not-deployed")}),"error");
                } else if (jqXHR.status == 500) {
                    RED.notify("Error during reset. See logs for more info.","error");
                } else if (jqXHR.status == 0) {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.no-response")}),"error");
                } else {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.unexpected",{status:jqXHR.status,message:textStatus})}),"error");
                }
            }    
        });
    }

    function addStatemachineToSidebar(id, label, rootId, aliasId) {
        $('#red-ui-sidebar-smxstate-display-selected').append(
            $('<option>')
                .attr("value", id)
                .attr("data-reveal-id", rootId)
                .attr("data-alias-id", aliasId ? aliasId : id)
                .text(label)
        );
    }

    function deleteStatemachineFromSidebar(id) {
        $('#red-ui-sidebar-smxstate-display-selected').children('[value="' + id + '"]').remove();
    }


    function initFcn() {
        // Build DOM
        let content = $('<div>'); //.css({position: "relative", height: "100%"});
        let toolbar = $('<div class="red-ui-sidebar-header" style="text-align: left;">')
            .append(
                $('<form>')
                    .css("margin", 0)
                    .append($('<label>')
                        .attr("for", "red-ui-sidebar-smxstate-display-selected")
                        .text("State machine to view:")
                    )
                    .append($('<select id="red-ui-sidebar-smxstate-display-selected">')
                        .change( () => { RED.smxstate.display(); })
                        .css("width", "100%")
                        .append($('<option disabled selected value=>').text("-- select machine instance --"))
                    )
                    .append('<br>', $('<span class="button-group">')
                        .append($('<a href="#" id="red-ui-sidebar-smxstate-revealRoot" class="red-ui-sidebar-header-button">')
                            .append(
                                '<i class="fa fa-search-minus"></i>'
                            )
                            .click(() => { RED.smxstate.revealRoot(); })
                        ),
                        $('<span class="button-group">')
                        .append($('<a href="#" id="red-ui-sidebar-smxstate-reveal" class="red-ui-sidebar-header-button">')
                            .append(
                                '<i class="fa fa-search-plus"></i>'
                            )
                            .click(() => { RED.smxstate.reveal(); })
                        ),
                        $('<span class="button-group">')
                        .append($('<a href="#" id="red-ui-sidebar-smxstate-reset" class="red-ui-sidebar-header-button">')
                            .append(
                                '<i class="fa fa-undo"></i>',
                                '&nbsp;<span>reset</span>'
                            )
                            .click(() => { RED.smxstate.reset(); })
                        ),
                        $('<span class="button-group">')
                        .append($('<a href="#" id="red-ui-sidebar-smxstate-refresh" class="red-ui-sidebar-header-button">')
                            .append(
                                '<i class="fa fa-refresh"></i>',
                                '&nbsp;<span>refresh graph</span>'
                            )
                            .click(() => { RED.smxstate.display(); })
                        )
                    )
            );
        
        RED.popover.tooltip(toolbar.find('#red-ui-sidebar-smxstate-reset'),"Reset to initial state");
        RED.popover.tooltip(toolbar.find('#red-ui-sidebar-smxstate-revealRoot'),"Reveal instance in flow");
        RED.popover.tooltip(toolbar.find('#red-ui-sidebar-smxstate-reveal'),"Reveal prototype in flow");

        let smxcontext = $('<div id="red-ui-sidebar-smxstate-context">')
            .append(
                $('<div id="red-ui-sidebar-smxstate-context-header">').text("Context data:")
            ).append('<span id="red-ui-sidebar-smxstate-context-data" class="red-ui-debug-msg-payload">')
        let smxdisplay = $('<div id="red-ui-sidebar-smxstate-content">').append('<svg id="red-ui-sidebar-smxstate-graph">');

        toolbar.appendTo(content);
        smxcontext.appendTo(content);
        smxdisplay.appendTo(content);
        

        // Populate list
        var that = this;
        setTimeout( () => {
            that.refresh();
        }, 1000);

        return {
            content: content,
            footer: toolbar
        };
    }

    function refreshFcn() {
        let nodes = RED.nodes.filterNodes({type: "smxstate"});
        
        // The RED.nodes.filterNodes function returns all nodes (including 
        // deactivated ones) except of instances within subflows. Actually
        // only a prototype-node within each subflow prototype is returned 
        // (no instances!).
        // 
        // The property
        //     node.d
        // is true for deactivated nodes and the function
        //     RED.workspaces.contains( node.z )
        // returns false for prototype nodes within subflows
        // 
        // Because the node-red interface is lacking needed functionality we 
        // instead request the data from the server every time.

        // Clear list
        $('#red-ui-sidebar-smxstate-display-selected option:not([disabled])').remove();

        // Get node ids from server
        $.ajax({
            url: "smxstate/getnodes",
            type:"GET",
            success: function(resp) {
                if( !Array.isArray(resp) ) resp = [resp];
                for( let e of resp ) {
                    addStatemachineToSidebar(e.id, e.path.labels.join('/'), e.rootId, e.alias);
                }
            },
            error: function(jqXHR,textStatus,errorThrown) {
                if (jqXHR.status == 404) {
                    RED.notify(RED._("node-red:common.notification.error",{message:"resource not found"}),"error");
                } else if (jqXHR.status == 500) {
                    RED.notify("Rendering of the state machine failed.","error");
                } else if (jqXHR.status == 0) {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.no-response")}),"error");
                } else {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.unexpected",{status:jqXHR.status,message:textStatus})}),"error");
                }
            }    
        });
    }

    function revealFcn() {
        let idObj = getCurrentlySelectedNodeId();

        if(!idObj) return;

        // Reveal the prototype node within a subflow if it's in a subflow
        RED.view.reveal(idObj.aliasId);
    }

    function revealRootFcn() {

        let idObj = getCurrentlySelectedNodeId();

        if(!idObj) return;

        // Reveal the root instance of the node
        RED.view.reveal(idObj.rootId);
    }

    return {
        init: initFcn,
        display: displayFcn,
        reset: resetFcn,
        refresh: refreshFcn,
        addStatemachineToSidebar: addStatemachineToSidebar,
        deleteStatemachineFromSidebar: deleteStatemachineFromSidebar,
        animate: animateFcn,
        revealRoot: revealRootFcn,
        reveal: revealFcn
    };
})();