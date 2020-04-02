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

function renderFcn(smcatStr, ondataFcn, timeoutMs, logOutput) {

    var buf = Buffer.alloc(0);
    var errbuf = Buffer.alloc(0);
    var idTimeout;
    var terminated = false;

    if( !smcatStr ) return null;

    const proc = spawn('node',[smcatPath, '-o', '-']);

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
    var fcnCallback;
    var oldCallback = ondataFcn;
    
    if( ondataFcn && typeof ondataFcn === "function" ) {
        fcnCallback = (output) => {

            // Modify output!
            if( !!output && output.code === 0 ) 
                output.data = postprocessSVG(output.data);

            oldCallback(output);
        }
    }

    if( arguments.length > 1 ) arguments[1] = fcnCallback;

    return renderFcn(...arguments);
}

module.exports = {
    renderRaw: renderFcn,
    render: renderPostProcessingFcn
};