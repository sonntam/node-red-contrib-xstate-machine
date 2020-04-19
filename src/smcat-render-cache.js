const fs            = require('fs')
const util          = require('util');
const crypto        = require('crypto');
const path          = require('path');

async function getCache(RED) {
    let settings = RED.settings.get('smxstate');

    if( settings && settings.hasOwnProperty('cache') && Array.isArray(settings.cache) ) {
        return settings.cache;
    } else {
        await setCache(RED,[]);
        return [];
    }
}

async function setCache(RED, cache) {
    await RED.settings.set('smxstate', { cache: cache });
}

function getCacheEntryIdxFromHash(cache, hash) {
    return cache.findIndex( (el) => el.hash === hash);
}

function getCacheEntryIdx(cache, input) {
    
    // Get hash for input
    let hash = getInputHash(input);
    
    // Find in cache
    return getCacheEntryIdxFromHash(cache, hash);
}

function getCacheEntry(cache, input) {
    // Try to get from cache
    let cacheHitIdx = getCacheEntryIdx(cache, input);

    return cache[cacheHitIdx];
}

function getCacheEntryFromHash(cache, hash) {
    // Try to get from cache
    let cacheHitIdx = getCacheEntryIdxFromHash(cache, hash);

    return cache[cacheHitIdx];
}

function removeCacheEntry(cache, entry) {
    if( entry.hasOwnProperty('hash') ) {
        let idx = getCacheEntryIdxFromHash(cache, entry.hash);
        if( idx >= 0 && idx < cache.length )
            cache.splice(idx, 1);
    }

    return cache;
}

function addCacheEntry(cache, hash, file, ttl) {
    // Write new cache entry
    cache.push({
        expire: Date.now() + ttl*1000,
        file: file,
        hash: hash
    });
    
    return cache;
}

function getInputHash(input) {
    return crypto.createHash('md5').update(input).digest('hex'); 
}

async function ensureDirectory(directory) {  
    try {
        await fs.promises.stat(directory);
    } catch( err ) {
        await fs.promises.mkdir(directory, { recursive: true });
    }
}

async function removeCachedFile(RED, cacheEntry) {
    try {
        let cacheFile = path.join(RED.settings.userDir, 'smxstate', cacheEntry.file);
        await fs.promises.stat(cacheFile);
        await fs.promises.unlink(cacheFile);
    } catch(err) {
        // Do nothing
    }
}

async function cacheRendering(RED, smcatStr, data, ttl) {
    let cache = await getCache(RED);
    let hash = getInputHash(smcatStr);
    let cacheHit = getCacheEntryFromHash(cache, hash);

    if( cacheHit ) {
        // Remove
        await setCache(RED, removeCacheEntry(cache, cacheHit));

        // Remove cached file if it exists
        await removeCachedFile(RED, cacheHit);
    }
    
    let file = `${hash}.json`;
    let filedir = path.join(RED.settings.userDir, 'smxstate');
    let cacheFile = path.join(filedir, file);

    try {
        // Ensure the target dir exists
        await ensureDirectory(filedir);
        // Write cached file
        await fs.promises.writeFile(cacheFile, JSON.stringify(data));
    } catch(err) {
        console.error(`Error writing smxstate cache file ${cacheFile}: ${err}`);
        return false;
    }

    // Update cache
    await setCache(RED, addCacheEntry(cache, hash, file, ttl) );

    return true;
}



async function getCachedRendering(RED, smcatStr) {
    // Try to get from cache
    let cache = await getCache(RED);
    let cacheHit = getCacheEntry(cache, smcatStr);

    if( cacheHit ) {
        // Check if the cached file exists
        try {
            let cacheFile = '';
            if( cacheHit.hasOwnProperty('file') ) {
                    cacheFile = path.join( RED.settings.userDir, 'smxstate',  cacheHit.file );
                if( !await util.promisify(fs.exists)(cacheFile) ) {
                    throw('cache file missing');
                }
            } else throw('file property missing');

            if( cacheHit.hasOwnProperty('expire') && Date.now() < cacheHit.expire ) {
                // Read from file and return
                let content = JSON.parse(await fs.promises.readFile(cacheFile, 'utf8'));

                if( content ) return content;
                else throw(`invalid cache entry data in file ${cacheFile}`);

            } else throw('cache entry is expired');

        } catch(err) {
            // Invalid cache entry, remove from cache
            console.log(`Invalid smxstate cache entry: ${err}. Deleting from cache...`);
            await setCache(RED, removeCacheEntry(cache, cacheHit));
            // Remove cached file if it exists
            await removeCachedFile(RED, cacheHit);
        }
    }

    return null;
}

module.exports = {
    getCachedRendering, cacheRendering
}