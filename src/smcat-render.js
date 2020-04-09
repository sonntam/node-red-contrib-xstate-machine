const { spawn } = require('child_process');
const path = require('path');
const { JSDOM } = require("jsdom");

const smcatPath = path.resolve(
    path.join(
        path.dirname(
            require.resolve('state-machine-cat')
        ),'..','bin','smcat'
    )
);

function renderDotFcn(smcatStr, options) {
    var buf = Buffer.alloc(0);
    var errbuf = Buffer.alloc(0);
    var idTimeout;
    var terminated = false;
    var logOutput = options.logOutput;

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
            if( logOutput )
                console.error(`smcat stderr: ${str}`);

            errbuf = Buffer.concat([errbuf, data]);
        }
    });

    smcatProc.on('close', (code) => {

        if( code !== 0 && logOutput )
            console.log(`smcat renderer process exited with error code ${code}.`);
        
        if( !terminated )
            dotProc.stdin.end();
    });

    dotProc.on('error', (err) => {
        if( logOutput )
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
        if( logOutput )
            console.error(`dot stderr: ${str}`);
        
        errbuf = Buffer.concat([errbuf, data]);
    });

    dotProc.on('close', (code) => {
        if( idTimeout ) {
            clearTimeout(idTimeout);
            idTimeout = null;
        } 

        if( code !== 0 && logOutput )
            console.log(`dot renderer process exited with error code ${code}.`);

        if( options.onDone && typeof options.onDone === "function" && !terminated )
            options.onDone({ 
                data: code === 0 ? buf.toString('utf8') : null, 
                code: code,
                err:  code !== 0 ? errbuf.toString('utf8') : null
            });
        smcatProc.kill();
        terminated = true;
    });

    smcatProc.stdin.write(Buffer.from(smcatStr));
    smcatProc.stdin.end();

    // Start timeout
    if( options.timeoutMs ) {
        idTimeout = setTimeout( () => {
            if( logOutput )
                console.error("Renderer process timeout. Terminating process.");

            terminated = true;
            smcatProc.kill();
            dotProc.kill();

            if( options.onDone && typeof options.onDone === "function" )
                options.onDone(null);

        }, options.timeoutMs)
    }

    return [smcatProc, dotProc];
}

function renderSMCatFcn(smcatStr, options) {
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
            if( logOutput )
                console.error(`smcat stderr: ${str}`);

            errbuf = Buffer.concat([errbuf, data]);
        }
    });

    proc.stdin.write(Buffer.from(smcatStr));
    proc.stdin.end();

    proc.on('close', (code) => {
        if( idTimeout ) {
            clearTimeout(idTimeout);
            idTimeout = null;
        } 

        if( code !== 0 && logOutput )
            console.log(`smcat renderer process exited with error code ${code}.`);

        if( ondataFcn && typeof ondataFcn === "function" && !terminated )
            ondataFcn({ 
                data: code === 0 ? buf.toString('utf8') : null, 
                code: code,
                err:  code !== 0 ? errbuf.toString('utf8') : null
            });

    });

    // Start timeout
    if( timeoutMs ) {
        idTimeout = setTimeout( () => {
            if( logOutput )
                console.error("Renderer process timeout. Terminating process.");

            terminated = true;
            proc.kill();

            if( ondataFcn && typeof ondataFcn === "function" )
                ondataFcn(null);

        }, timeoutMs)
    }

    return proc;
}

function renderFcn(smcatStr, ondataFcn, timeoutMs, logOutput) {

    var buf = Buffer.alloc(0);
    var errbuf = Buffer.alloc(0);
    var idTimeout;
    var terminated = false;

    var defOptions = {
        onDone: undefined,
        timeoutMs: 20000,
        logOutput: false,
        renderer: 'smcat'
    };

    if( !smcatStr ) return null;

    // Check input format
    if( ondataFcn && typeof ondataFcn === "object" ) {
        Object.assign(defOptions, ondataFcn);
    } else {
        Object.assign(defOptions, {
            onDone: ondataFcn,
            timeoutMs: timeoutMs,
            logOutput: logOutput
        });
    }

    switch( defOptions.renderer.toLowerCase() ) {
        case 'smcat':
            return renderSMCatFcn(smcatStr, defOptions);
        case 'dot':
            return renderDotFcn(smcatStr, defOptions);
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

function renderPostProcessingFcn(smcatStr, ondataFcn, timeoutMs, logOutput) {
    // This outputs a corrected svg
    var oldCallback = ondataFcn;
    var options = {}

    if( !smcatStr ) return null;
    if( ondataFcn ){
        if(typeof ondataFcn === "object") {
            Object.assign(options, ondataFcn);
        } else if( typeof ondataFcn === "function ") {
            options = {
                onDone: ondataFcn,
                timeoutMs: timeoutMs,
                logOutput: logOutput
            };
        }
    } else {
        return null;
    }

    var oldCallback = options.onDone;

    options.onDone = (output) => {

        // Modify output!
        if( !!output && output.code === 0 ) 
            output.data = postprocessSVG(output.data);

        oldCallback(output);
    }

    return renderFcn(smcatStr, options);
}

module.exports = {
    renderRaw: renderFcn,
    render: renderPostProcessingFcn
};