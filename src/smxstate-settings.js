const path              = require('path');
const { getRenderers }  = require('../src/smcat-render');
const assert            = require('assert');

var RED = {};

function get(property) {
    let vals = RED.settings.get('smxstate');
    if( vals && vals.settings && vals.settings.hasOwnProperty(property) )
        return vals.settings[property];
    else return null;
}

async function set(property,value) {
    let vals = RED.settings.get('smxstate') || {};
    let settings = vals.settings || {};
    Object.assign( settings, { [property]: value });
    vals.settings = settings;

    return await RED.settings.set('smxstate', vals);
}

async function init(pRED) {
    RED = pRED;

    let settings = {
        renderTimeoutMs: 20000,
        renderer: 'smcat'
    }
    let vals = RED.settings.get('smxstate') || {};
    let savedSettings = vals.settings;

    // Check if values exist, if not, set defaults
    if( savedSettings )
        Object.assign(settings, savedSettings);

    // Set available renderers
    settings.availableRenderers = await getRenderers();

    try {
        assert.deepEqual(savedSettings, settings)
    } catch(err) {
        let newVals = Object.assign(vals, { settings });
        await RED.settings.set('smxstate', newVals);
    }
}

module.exports = {
    get, set, init
};