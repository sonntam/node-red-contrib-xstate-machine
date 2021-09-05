const { spawn }     = require('child_process');
const path          = require('path');
const { JSDOM }     = require("jsdom");
const commandExists = require('command-exists-promise');

const cache         = require('../src/smcat-render-cache');

var renderTTLSeconds = 3600*24*28; // 4 weeks

const smcatPath = path.resolve(
    path.join(
        path.dirname(
            require.resolve('state-machine-cat')
        ),'..','..','bin','smcat.mjs'
    )
);

let RED = null;

function initFcn(pRED) {
    // Save reference to RED for future reference
    RED = pRED;
    

    //TODO: Do some cache cleanup if necessary
}

async function renderDotFcn(smcatStr, options) {
    var buf = Buffer.alloc(0);
    var errbuf = Buffer.alloc(0);
    var idTimeout;
    var terminated = false;

    if( !smcatStr ) return null;

    let smcatProc = spawn('node',[smcatPath, '-I', 'smcat', '-T', 'dot', '-o', '-']);
    let dotProc   = spawn('dot',['-Tsvg', '-Kdot']);

    smcatProc.stdout.on('data', (data) => {
        if( terminated )
            smcatProc.kill();
        else
            dotProc.stdin.write(data);
    });

    smcatProc.stderr.on('data', (data) => {
        let str = data.toString('utf8');
        if( !str.match(/Invalid asm\.js/si) ) {
            if( options.logOutput )
                console.error(`smcat stderr: ${str}`);

            errbuf = Buffer.concat([errbuf, data]);
        }
    });

    smcatProc.on('close', (code) => {

        if( code !== 0 && options.logOutput )
            console.log(`smcat renderer process exited with error code ${code}.`);
        
        if( !terminated ) {
            dotProc.stdin.end();
        }

        if( code !== 0 ) dotProc.kill();
    });

    dotProc.on('error', (err) => {
        if( options.logOutput )
            console.error('Failed to start "dot" process.');
    })

    dotProc.stdout.on('data', (data) => {
        buf = Buffer.concat([buf, data]);
    });

    dotProc.stdout.on('end',  () => {
        if( idTimeout ) {
            clearTimeout(idTimeout);
            idTimeout = null;
        } 
    });

    dotProc.stderr.on('data', (data) => {
        let str = data.toString('utf8');
        if( options.logOutput )
            console.error(`dot stderr: ${str}`);
        
        errbuf = Buffer.concat([errbuf, data]);
    });

    let promise = new Promise( (resolve,reject) => {
        dotProc.on('close', (code) => {
            if( idTimeout ) {
                clearTimeout(idTimeout);
                idTimeout = null;
            } 

            if( code !== 0 && options.logOutput )
                console.log(`dot renderer process exited with error code ${code}.`);

            smcatProc.kill();

            let result;
            
            result = ( terminated ? null : { 
                data: code === 0 ? buf.toString('utf8') : null, 
                code: code === null ? 1 : code,
                err:  code !== 0 ? errbuf.toString('utf8') : null
            });

            terminated = true;

            if( options.onDone && typeof options.onDone === "function" )
                options.onDone(result);

            resolve(result);
        });
    });

    smcatProc.stdin.write(Buffer.from(smcatStr));
    smcatProc.stdin.end();

    // Start timeout
    if( options.timeoutMs ) {
        idTimeout = setTimeout( () => {
            if( options.logOutput )
                console.error("Renderer process timeout. Terminating process.");

            terminated = true;
            smcatProc.kill();
            dotProc.kill();

            /*if( options.onDone && typeof options.onDone === "function" )
                options.onDone(null);*/

        }, options.timeoutMs)
    }

    return await promise;
}

async function renderSMCatFcn(smcatStr, options) {
    var buf = Buffer.alloc(0);
    var errbuf = Buffer.alloc(0);
    var idTimeout;
    var terminated = false;

    if( !smcatStr ) return null;

    let proc = spawn('node',[smcatPath, '-I', 'smcat', '-T', 'svg', '-o', '-']);

    proc.stdout.on('data', (data) => {
        buf = Buffer.concat([buf, data]);
    });

    proc.stdout.on('end', () => {
        if( idTimeout ) {
            clearTimeout(idTimeout);
            idTimeout = null;
        } 
    });
    
    proc.stderr.on('data', (data) => {
        let str = data.toString('utf8');
        if( !str.match(/Invalid asm\.js/si) ) {
            if( options.logOutput )
                console.error(`smcat stderr: ${str}`);

            errbuf = Buffer.concat([errbuf, data]);
        }
    });

    proc.stdin.write(Buffer.from(smcatStr));
    proc.stdin.end();

    let promise = new Promise((resolve, reject) => {
        proc.on('close', (code) => {
            if( idTimeout ) {
                clearTimeout(idTimeout);
                idTimeout = null;
            } 

            if( code !== 0 && options.logOutput )
                console.log(`smcat renderer process exited with error code ${code}.`);

            let result = (terminated ? null : { 
                    data: code === 0 ? buf.toString('utf8') : null, 
                    code: code,
                    err:  errbuf.toString('utf8')
            });

            terminated = true;

            if( options.onDone && typeof options.onDone === "function" )
                options.onDone(result);

            resolve(result);
        });
    });

    // Start timeout
    if( options.timeoutMs ) {
        idTimeout = setTimeout( () => {
            if( options.logOutput )
                console.error("Renderer process timeout. Terminating process.");

            terminated = true;
            proc.kill();
/*
            if( options.onDone && typeof options.onDone === "function" )
                options.onDone(null);*/

        }, options.timeoutMs)
    }

    return await promise;
}

async function renderFcn(smcatStr, timeoutMs, logOutput, callback) {

    if( !smcatStr ) return null;

    var options = await normalizeOptions(...(Array.prototype.slice.call(arguments,1)) );

    switch( options.renderer.toLowerCase() ) {
        case 'smcat':
            return await renderSMCatFcn(smcatStr, options);
        case 'dot':
            return await renderDotFcn(smcatStr, options);
        default:
            return null;
    }
}

// These are functions that modify smcat svg output to improve the presentation
// of state-machines
function getBBoxFromCoordinates(pCoords) {
    let coordPairs = pCoords
        .split(/[\smlhvcsqtaz]+/i)
        .filter(pE => pE)
        .map(pE => pE.split(",").map(pEi => parseFloat(pEi)));

    let xCoords = coordPairs.map(pE => pE[0]);
    let yCoords = coordPairs.map(pE => pE[1]);

    return {
        left: Math.min(...xCoords),
        right: Math.max(...xCoords),
        top: Math.min(...yCoords),
        bottom: Math.max(...yCoords)
    };
}

function getClusterParts(pClusterElement) {
    let elements = {
        separatorLine: null,
        outerPath: null,
        clusterType: "default"
    };

    elements.separatorLine = pClusterElement.querySelector(
        "polygon:not([stroke-dasharray])"
    );
    elements.outerPath = pClusterElement.querySelector("path");

    // Check if this may be a parallel cluster state
    if (!elements.outerPath) {
        elements.outerPath = pClusterElement.querySelector(
            "polygon[stroke-dasharray]"
        );
        elements.clusterType = "parallel";
    }

    // Sanity check
    if (!elements.separatorLine || !elements.outerPath) return null;

    return elements;
}

function adjustParallelCluster(pClusterParts) {
    const parent = pClusterParts.outerPath.parentNode;
    let bboxOuter = getBBoxFromCoordinates(
        pClusterParts.outerPath.getAttribute("points")
    );
    let bboxSeparator = getBBoxFromCoordinates(
        pClusterParts.separatorLine.getAttribute("points")
    );

    let lineElement = parent.ownerDocument.createElement("line");

    lineElement.setAttribute("stroke-dasharray", "5,2");
    lineElement.setAttribute(
        "stroke",
        pClusterParts.separatorLine.getAttribute("stroke")
    );
    lineElement.setAttribute("x1", bboxOuter.left);
    lineElement.setAttribute("y1", bboxSeparator.top);
    lineElement.setAttribute("x2", bboxOuter.right);
    lineElement.setAttribute("y2", bboxSeparator.top);

    parent.removeChild(pClusterParts.separatorLine);
    parent.append(lineElement);
}

function adjustDefaultCluster(pClusterParts) {
    let bboxOuter = getBBoxFromCoordinates(
        pClusterParts.outerPath.getAttribute("d")
    );
    let bboxSeparator = getBBoxFromCoordinates(
        pClusterParts.separatorLine.getAttribute("points")
    );

    pClusterParts.separatorLine.setAttribute(
        "points",
        `${bboxOuter.left},${bboxSeparator.top} ${bboxOuter.right},${bboxSeparator.top}`
    );
}

function adjustCluster(pClusterElement) {
    // Get relevant elements of cluster
    let clusterParts = getClusterParts(pClusterElement);

    // Sanity check
    if (!clusterParts) return;

    // Adjust according to type
    switch (clusterParts.clusterType) {
        case "parallel":
            adjustParallelCluster(clusterParts);
            break;
        case "default":
            adjustDefaultCluster(clusterParts);
            break;
        default:
            return;
    }
}

function postprocessSVG(svg) {
    const dom = new JSDOM(svg);
    const { document } = dom.window;

    // Get all cluster elements with a state description
    let clusters = Reflect.apply(
        Array.prototype.map,
        document.querySelectorAll("svg g.cluster polygon:not([stroke-dasharray])"),
        [pElement => pElement.parentNode]
    );

    // Adjust clusters
    clusters.forEach(pE => adjustCluster(pE));

    return dom.serialize();
}

async function checkDot() {
    // Check if 'dot' program is on the path
    try {
        return commandExists('dot');
    }
    catch(err) {
        return false;
    }
}

async function normalizeOptions(args) {

    let defOptions = {
        onDone: undefined,
        timeoutMs: 20000,
        logOutput: false,
        renderer: ( await checkDot() ? 'dot' : 'smcat' ),
        forceRedraw: false
    };

    if( arguments.length > 0 ){
        if(typeof arguments[0] === "object") {
            Object.assign(defOptions, arguments[0]);
            if( arguments[1] && typeof arguments[1] === "function" ) defOptions.onDone = arguments[1];
        } else {
            // if( typeof arguments[0] === "function ") {
            const [callback] = Array.prototype.slice.call(arguments,-1);
            if( typeof callback === "function" ) {
                defOptions.onDone = callback;
                Array.prototype.pop.call(arguments);
            } 

            if( arguments.length > 0  && typeof arguments[0] === "number") defOptions.timeoutMs = Array.prototype.shift.call(arguments);
            if( arguments.length > 0  && typeof arguments[0] === "boolean") defOptions.logOutput = Array.prototype.shift.call(arguments);
        }
    }

    return defOptions;
}

async function renderPostProcessingFcn(smcatStr, timeoutMs, logOutput, callback) {
    // This outputs a corrected svg
    if( !smcatStr ) return null;
    
    var options = await normalizeOptions(...(Array.prototype.slice.call(arguments,1)) );
    var onDone  = options.onDone;
    options.onDone = undefined;

    if( !options.forceRedraw  && RED ) {
        let cached = await cache.getCachedRendering(RED, smcatStr);
        if( cached ) return cached;
    }

    var output = await renderFcn(smcatStr, options);

    // Modify output!
    if( !!output && output.code === 0 ) {
        output.data = postprocessSVG(output.data);

        // Callback
        if( onDone && typeof onDone === "function" )
            onDone(output);

        // Cache this render
        if( RED )
            await cache.cacheRendering(RED, smcatStr, output, renderTTLSeconds );   
    }

    return output;
}

async function getRenderersFcn() {
    let renderers = [ 
        'smcat'
    ];

    if( await checkDot() )
        renderers.push('dot');

    return renderers;
}

module.exports = {
    init: initFcn,
    renderRaw: renderFcn,
    render: renderPostProcessingFcn,
    renderTTLSeconds,
    getRenderers: getRenderersFcn
};