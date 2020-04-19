// This code runs within the browser
if( !RED ) {
    var RED = {}
}
let smxstateUtilExports = (function() {

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

    var updateContextStack = [];
    var updateContextBusy  = false;

    function updateContextFcn(data) {
        // Limit to 10 updates per second
        if( data && data.id && data.id === getCurrentlySelectedNodeId().id ) { updateContextStack.push(data.context); }
        if( !updateContextBusy && updateContextStack.length > 0 ) {
            updateContextBusy = true;

            // Do the actual animation and data update
            let context = updateContextStack.shift();

            let contextElement = RED.utils.createObjectElement( context, {
                key: /*true*/null,
                typeHint: "Object",
                hideKey: false
             } );

            $('#red-ui-sidebar-smxstate-context-data').html(contextElement)

            setTimeout(() => {
                updateContextBusy = false;
                updateContextFcn();
            }, 100);
            if( updateContextStack.length > 5 ) updateContextStack = updateContextStack.splice(-5);
        }
    }

    var animationStack = [];
    var animationBusy  = false;

    function animateFcn(data) {
        // Limit to 10 updates per second
        if( data && data.state && (data.state.changed === true || data.state.changed === undefined) ) { animationStack.push(data); }
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
            
            //updateContextFcn(data.state.context);

            setTimeout(() => {
                animationBusy = false;
                animateFcn();
            }, 100);
            if( animationStack.length > 5 ) animationStack = animationStack.splice(-5);
        }
    }

    function setupZoom(container, svgElement) {
        // Zoom & Pan functions
        //const svgelement = document.getElementById("svgImage");
        //const container = document.getElementById("svgContainer");

        var currentViewBoxCfg;
        try {
            currentViewBoxCfg = svgElement.getAttribute("viewBox");
            currentViewBoxCfg = currentViewBoxCfg.split(/[\n\r\s]+/gi);
            if( Array.isArray( currentViewBoxCfg ) && currentViewBoxCfg.length == 4 ) {
                currentViewBoxCfg = currentViewBoxCfg.map( e => parseFloat(e) );
                if( currentViewBoxCfg.some( e => !Number.isFinite(e)) )
                    throw("Invalid viewbox");
            } else {
                throw("Invalid viewbox");
            }
        }
        catch( err ) {
            currentViewBoxCfg = null;
        }

        var viewBox;
        if( !currentViewBoxCfg ) {
            viewBox = { x: 0, y: 0, w: svgElement.clientWidth, h: svgElement.clientHeight }; //getAttribute("width"), h: svgElement.getAttribute("height") };
            svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
        } else {
            viewBox = { x: currentViewBoxCfg[0], y: currentViewBoxCfg[1], w: currentViewBoxCfg[2], h: currentViewBoxCfg[3] };
        }
        
        var isPanning = false;
        var startPoint = { x: 0, y: 0 };
        var endPoint = { x: 0, y: 0 };;
        var scale = 1;

        container.onmousewheel = function (e) {
            e.preventDefault();

            const svgSize = { w: svgElement.clientWidth, h: svgElement.clientHeight };
            var w = viewBox.w;
            var h = viewBox.h;
            var mx = e.offsetX;//mouse x  
            var my = e.offsetY;
            var dw = w * -Math.sign(e.deltaY) * 0.05;
            var dh = h * -Math.sign(e.deltaY) * 0.05;
            var dx = dw * mx / svgSize.w;
            var dy = dh * my / svgSize.h;
            viewBox = { x: viewBox.x + dx, y: viewBox.y + dy, w: viewBox.w - dw, h: viewBox.h - dh };
            scale = svgSize.w / viewBox.w;
            //zoomValue.innerText = `${Math.round(scale * 100) / 100}`;
            svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
        }


        container.onmousedown = function (e) {
            isPanning = true;
            startPoint = { x: e.x, y: e.y };
        }

        container.onmousemove = function (e) {
            if (isPanning) {
                endPoint = { x: e.x, y: e.y };
                var dx = (startPoint.x - endPoint.x) / scale;
                var dy = (startPoint.y - endPoint.y) / scale;
                var movedViewBox = { x: viewBox.x + dx, y: viewBox.y + dy, w: viewBox.w, h: viewBox.h };
                svgElement.setAttribute('viewBox', `${movedViewBox.x} ${movedViewBox.y} ${movedViewBox.w} ${movedViewBox.h}`);
            }
        }

        container.onmouseup = function (e) {
            if (isPanning) {
                endPoint = { x: e.x, y: e.y };
                var dx = (startPoint.x - endPoint.x) / scale;
                var dy = (startPoint.y - endPoint.y) / scale;
                viewBox = { x: viewBox.x + dx, y: viewBox.y + dy, w: viewBox.w, h: viewBox.h };
                svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
                isPanning = false;
            }
        }

        container.onmouseleave = function (e) {
            isPanning = false;
        }
    }

    function displayFcn(forceRedraw = false) {
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
            data: { forceRedraw: forceRedraw },
            success: function(resp) {
                $('#red-ui-sidebar-smxstate-spinner').remove();
                RED.notify(`Successfully rendered state-graph for ${idObj.label}`,{type:"success",id:"smxstate"});
                
                $('#red-ui-sidebar-smxstate-graph').replaceWith($(resp).attr("id", "red-ui-sidebar-smxstate-graph"));
                
                setupZoom( 
                    $('#red-ui-sidebar-smxstate-content')[0],
                    $('#red-ui-sidebar-smxstate-graph')[0] 
                );
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
        let content = $('<div>').css({display: "flex", flexDirection: "column", height: "100%"});
        let toolbar = $('<div class="red-ui-sidebar-header" style="text-align: left;">')
            .append(
                $('<form>')
                    .css({ margin: 0, whiteSpace: "normal" })
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
                            .click(() => { RED.smxstate.display(true); })
                        ),
                        $('<div class="red-ui-sidebar-smxstate-settings">')
                        .css({marginRight: "8px"})
                        .append(
                            '<label for="red-ui-sidebar-smxstate-settings-renderer">Renderer:</label>'
                        )
                        .append(
                            $('<select id="red-ui-sidebar-smxstate-settings-renderer">')
                                .change( (ev) => {
                                    debugger;
                                    RED.smxstate.settings.set('renderer', ev.target.value);
                                })
                        ),
                        $('<div class="red-ui-sidebar-smxstate-settings">')
                        .css({marginRight: "8px"})
                        .append(
                            '<label for="red-ui-sidebar-smxstate-settings-renderTimeoutMs">Render timeout in ms:</label>'
                        )
                        .append(
                            $('<input type="text" id="red-ui-sidebar-smxstate-settings-renderTimeoutMs">')
                                .css("width", "40px")
                                .change( (ev) => { 
                                    debugger; 
                                    try {
                                        let number = Number.parseInt(ev.target.value);
                                        if( Number.isNaN(number) || number <= 0 ) throw("Render timeout must be a strictly positive integer.")
                                        RED.smxstate.settings.set('renderTimeoutMs', number); 
                                    } catch(err) {
                                        RED.notify(err,"error");
                                        // Reset
                                        RED.smxstate.settings.get('renderTimeoutMs', (resp) => {
                                            if( resp ) $(ev.target).val(resp);
                                        })
                                    }
                                })
                        )
                    )
            );
        
        RED.popover.tooltip(toolbar.find('#red-ui-sidebar-smxstate-reset'),"Reset to initial state");
        RED.popover.tooltip(toolbar.find('#red-ui-sidebar-smxstate-revealRoot'),"Reveal instance in flow");
        RED.popover.tooltip(toolbar.find('#red-ui-sidebar-smxstate-reveal'),"Reveal prototype in flow");

        let smxcontext = $('<div id="red-ui-sidebar-smxstate-context">')
            .append(
                $('<div id="red-ui-sidebar-smxstate-context-header">').text("Context data:")
            ).append('<span id="red-ui-sidebar-smxstate-context-data" class="red-ui-debug-msg-payload">');
            
        let smxdisplayhelp = $('<div>').css({ fontSize: "x-small", padding: "8px" }).append('<span><b>Pan:</b> Click+drag / <b>Zoom:</b> Mousewheel</span>');
        let smxdisplay = $('<div id="red-ui-sidebar-smxstate-content">').append('<svg id="red-ui-sidebar-smxstate-graph">');

        toolbar.appendTo(content);
        smxcontext.appendTo(content);
        smxdisplayhelp.appendTo(content);
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
        $('#red-ui-sidebar-smxstate-settings-renderer option').remove();

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

        // Get available renderers from server
        RED.smxstate.settings.get("availableRenderers", (resp) => {
            
            let selectElement = $('#red-ui-sidebar-smxstate-settings-renderer');

            if( resp ) {
                
                if( !Array.isArray(resp) ) resp = [resp];
                for( let e of resp ) {
                    selectElement.append(
                        '<option value="' + e + '">' + e + '</option>'
                    );
                }
            }

            // Set current settings values
            RED.smxstate.settings.get("renderer", (resp) => {
                if( resp ) {
                    selectElement.val(resp);
                }
            });
        });

        RED.smxstate.settings.get("renderTimeoutMs", (resp) => {
            if( resp ) {
                $('#red-ui-sidebar-smxstate-settings-renderTimeoutMs').val(resp);
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

    function updateSettingsFcn(settings) {
        if( settings.hasOwnProperty("renderer") ) {
            $("#red-ui-sidebar-smxstate-settings-renderer").val(settings.renderer); // Don't post event
        }
        if( settings.hasOwnProperty("availableRenderers") ) {
            let o;
            $("#red-ui-sidebar-smxstate-settings-renderer").children('option').attr('disabled','disabled');
            for( o of settings.availableRenderers ) {
                $("#red-ui-sidebar-smxstate-settings-renderer").children('option[value="'+o+'"]')
                    .removeAttr('disabled');
            }
        }
        if( settings.hasOwnProperty("renderTimeoutMs") ) {
            $("#red-ui-sidebar-smxstate-settings-renderTimeoutMs").val(settings.renderTimeoutMs); // Don't post event
        }
    }

    return {
        init: initFcn,
        display: displayFcn,
        reset: resetFcn,
        refresh: refreshFcn,
        addStatemachineToSidebar: addStatemachineToSidebar,
        deleteStatemachineFromSidebar: deleteStatemachineFromSidebar,
        animate: animateFcn,
        updateContext: updateContextFcn,
        revealRoot: revealRootFcn,
        reveal: revealFcn,
        updateSettings: updateSettingsFcn
    };
})();

if( RED.smxstate ) Object.assign(RED.smxstate, smxstateUtilExports);
else RED.smxstate = smxstateUtilExports;
delete smxstateUtilExports;