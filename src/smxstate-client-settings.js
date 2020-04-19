// This code runs within the browser
if( !RED ) {
    var RED = {}
}
if( !RED.smxstate ) {
    RED.smxstate = {};
}

RED.smxstate.settings = (function() {

    function setFcn(prop,val,success) {
        return $.ajax({
            url: "smxstate/settings",
            type:"POST",
            data: { property: prop, value: val },
            success: success,
            error: function(jqXHR,textStatus,errorThrown) {
                if (jqXHR.status == 404) {
                    RED.notify(RED._("node-red:common.notification.error",{message:"resource not found"}),"error");
                } else if (jqXHR.status == 500) {
                    RED.notify("smxstate: Unable to set property " + prop + ".","error");
                } else if (jqXHR.status == 0) {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.no-response")}),"error");
                } else {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.unexpected",{status:jqXHR.status,message:textStatus})}),"error");
                }
            }    
        });

    }

    function getFcn(prop, success) {
        return $.ajax({
            url: "smxstate/settings",
            type:"GET",
            data: { property: prop },
            success: (resp) => { 
                if( resp && typeof resp === "object" && resp.hasOwnProperty(prop) ) {
                    resp = resp[prop];
                } else resp = null;
                
                if(success && typeof success === "function") 
                    success(resp); 
            },
            error: function(jqXHR,textStatus,errorThrown) {
                if (jqXHR.status == 404) {
                    RED.notify(RED._("node-red:common.notification.error",{message:"resource not found"}),"error");
                } else if (jqXHR.status == 500) {
                    RED.notify("smxstate: Retrieval of property " + prop + " failed.","error");
                } else if (jqXHR.status == 0) {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.no-response")}),"error");
                } else {
                    RED.notify(RED._("node-red:common.notification.error",{message:RED._("node-red:common.notification.errors.unexpected",{status:jqXHR.status,message:textStatus})}),"error");
                }
            }    
        });
    }

    return {
        set: setFcn,
        get: getFcn
    }
})();
