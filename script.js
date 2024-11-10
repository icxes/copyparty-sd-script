if (localStorage.getItem('sdImageProomptKey') === null) { localStorage.setItem('sdImageProomptKey', 'copyparty') };
if (localStorage.getItem('toggleProomptState') === null) { localStorage.setItem('toggleProomptState', 'show') };
if (localStorage.getItem('toggleKeyInputState') === null) { localStorage.setItem('toggleKeyInputState', 'show') };

const paths = []; // paths to run script on, checks if full url contains whatever you put here
const keyToFind = localStorage.getItem('sdImageProomptKey') // what key/property to look for in the image data (default "copyparty") (use "parameters" to get full generation info)
const logging = false;

document.body.insertAdjacentHTML('afterbegin', '<div id="sd-proompt-container" style="position: fixed; bottom: 2.5rem; left: 50%; transform: translateX(-50%); background-color: white; color: black; padding: 10px 20px; border-radius: 5px; font-size: 20px; font-family: monospace; z-index: 9999; box-shadow: rgba(0, 0, 0, 0.2) 0px 2px 10px; max-width: 100%; overflow-wrap: break-word; display: none;"></div>')
document.body.insertAdjacentHTML('afterbegin', '<div id="sd-key-container" style="position: fixed; top: 1rem; left: 1rem; background-color: white; color: black; padding: 10px 20px; border-radius: 5px; font-size: 20px; font-family: monospace; z-index: 9999; box-shadow: rgba(0, 0, 0, 0.2) 0px 2px 10px; max-width: 20%; overflow-wrap: break-word; display: none;">key (hide me with shift+z): <input type="text" id="sd-key-input" style="width:100px;"></div>')
const proomptContainer = document.getElementById('sd-proompt-container');
const keyInputContainer = document.getElementById('sd-key-container');
const keyInputField = document.getElementById('sd-key-input');
keyInputField.value = localStorage.getItem('sdImageProomptKey');

document.addEventListener('keypress', e => {
    if (document.getElementById('bbox-overlay').style.display !== 'none' && document.getElementById('bbox-overlay').style.display !== '') {
        if (e.key === 'z') {
            if (localStorage.getItem('toggleProomptState') === 'show') {
                localStorage.setItem('toggleProomptState', 'hide'); 
            } else {
                localStorage.setItem('toggleProomptState', 'show'); 
            }
        }
    }
    if (e.key === 'Z') {
        if (localStorage.getItem('toggleKeyInputState') === 'show') {
            localStorage.setItem('toggleKeyInputState', 'hide'); 
        } else {
            localStorage.setItem('toggleKeyInputState', 'show'); 
        }
    }
    updateProomptContainer();
})

keyInputField.addEventListener('keypress', e => {
	if (e.key === 'Enter') {
		localStorage.setItem('sdImageProomptKey', keyInputField.value);
		location.reload();
	}
})

function log(message, data = null) {
    if (!logging) return;
    const logMessage = `[SD Proompt Displayer] ${message}`;
    if (data) {
        console.log(logMessage, data);
    } else {
        console.log(logMessage);
    }
}

// updates prompt container div (and key input)
function updateProomptContainer() {
    const overlay = document.getElementById('bbox-overlay');
    if (overlay && overlay.style.display !== 'none' && localStorage.getItem('toggleProomptState') === 'show') {
        proomptContainer.style.display = 'block';
    } else {
        proomptContainer.style.display = 'none';
    }
    if (localStorage.getItem('toggleKeyInputState') === 'show') {
        keyInputContainer.style.display = 'block';
    } else {
        keyInputContainer.style.display = 'none';
    }

    if (proomptContainer.innerText === '') proomptContainer.style.display = 'none';
}

// reads png metadata given a url
async function readPNGProperties(imageUrl) {
    log(`READ: trying to read image: ${imageUrl}`);

    const response = await fetch(imageUrl);
    log(`READ: fetched image data at ${imageUrl}`);

    const arrayBuffer = await response.blob().then(blob => blob.arrayBuffer());
    log(`READ: got array buffer, size: ${arrayBuffer.byteLength} bytes`);

    const view = new DataView(arrayBuffer);

    // check if given image is PNG by looking at it's magic number/file signature
    // no point continuing if the image is not a PNG since it won't have the metadata 
    // we're looking for
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) {
        if (view.getUint8(i) !== pngSignature[i]) {
            throw new Error('image is not png');
        }
    }

    let offset = 8;

    while (offset < view.byteLength) {
        const length = view.getUint32(offset, false);
        offset += 4;

        const typeBytes = new Uint8Array(arrayBuffer, offset, 4);
        const type = String.fromCharCode(...typeBytes);
        offset += 4;

        // log(`READ: reading chunk: type=${type}, length=${length}`);

        if (type === 'tEXt') {
            let keyEnd = offset;
            while (view.getUint8(keyEnd) !== 0 && keyEnd < offset + length) {
                keyEnd++;
            }

            const keyBytes = new Uint8Array(arrayBuffer, offset, keyEnd - offset);
            const key = String.fromCharCode(...keyBytes);
            log(`READ: found tEXt chunk with key: ${key}`);

            if (key === keyToFind) {
                const valueBytes = new Uint8Array(arrayBuffer, keyEnd + 1,
                    offset + length - (keyEnd + 1));
                const value = String.fromCharCode(...valueBytes);
                log(`READ: found ${keyToFind} property in tEXt chunk`);
                return value;
            }
        }

        offset += length + 4;
    }

    log(`READ: key '${keyToFind}' not found`);
    return null;
}

async function analyzeVisibleImage() {

    const overlay = document.getElementById('bbox-overlay');
    if (!overlay || overlay.style.display === 'none') {
        log('ANALYZE: image container/bbox not visible, aborting');
        return;
    }

    const visibleImageDiv = overlay.getElementsByClassName('full-image vis')[0];
    if (!visibleImageDiv) {
        log('ANALYZE: no visible image div found in view');
        return;
    }
    log(`ANALYZE: found visible image div: ${visibleImageDiv.id}`);

    const img = visibleImageDiv.getElementsByTagName('figure')[0].getElementsByTagName('img')[0];
    if (!img || !img.src) {
        log('ANALYZE: no image found in view');
        return;
    }
    log(`ANALYZE: found image element with src: ${img.src}`);

    try {
        const imageData = await readPNGProperties(img.src);
        if (imageData) {
            log('ANALYZE: found image data:', imageData);
            // format the JSON nicely for display
            if (typeof imageData === 'object') {
                proomptContainer.textContent = JSON.stringify(imageData, null, 2)
                    .replace(/\n/g, ' ')
                    .replace(/\s+/g, ' ');
            } else {
                proomptContainer.textContent = imageData;
            }
        } else {
            log('ANALYZE: no metadata found in image');
            proomptContainer.textContent = `key ${keyToFind} not found in image metadata`;
        }
    } catch (error) {
        log('ANALYZE: error analyzing image:', error);
        proomptContainer.textContent = `Error: ${error.message}`;
    }
    updateProomptContainer();
}

// initializes the observers for the DOM changes to figure out when to actually run the rest of the code
function initializeObservers() {
    log('OBSERVERS: init');
    const overlay = document.getElementById('bbox-overlay');

    // observer for page content changes (going back and forth in page history, etc)
    new MutationObserver((mutations, observer) => {
        proomptContainer.style.display = 'none';
        keyInputContainer.style.display = 'none';
        proomptContainer.textContent = '';

        overlayObserver.disconnect();
        sliderObserver.disconnect();
        observer.disconnect();

        runInit();
    }).observe(document.getElementById('ggrid'), { childList: true, subtree: true });


    // observer for the overlay triggered when clicking on images/videos in grid mode
    const overlayObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                const overlay = mutation.target;
                log('OBSERVERS: overlay visibility changed:', {
                    display: overlay.style.display,
                    hasVisibleClass: overlay.classList.contains('visible')
                });

                updateProomptContainer();

                if (overlay.style.display !== 'none' && overlay.classList.contains('visible')) {
                    log('OBSERVERS: overlay is visible, checking for visible image');
                    analyzeVisibleImage();
                }
            }
        }
    });

    // observer for the change triggered when moving from image to image in image view
    const sliderObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const div = mutation.target;
                if (div.classList.contains('full-image')) {
                    log(`OBSERVERS: class changed on ${div.id}:`, {
                        classList: Array.from(div.classList),
                        hasVis: div.classList.contains('vis')
                    });

                    if (div.classList.contains('vis')) {
                        log(`OBSERVERS: image div ${div.id} is visible`);
                        analyzeVisibleImage();
                    }
                }
            }
        }
    });

    if (overlay) {
        log('OBSERVERS: setting up overlay observer');
        overlayObserver.observe(overlay, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        const slider = document.getElementById('bbox-slider');
        if (slider) {
            log('OBSERVERS: found slider, setting up observer');
            sliderObserver.observe(slider, {
                attributes: true,
                attributeFilter: ['class'],
                subtree: true
            });
        } else {
            log('OBSERVERS: no slider found');
        }
        // initial check only if overlay is visible
        if (overlay.style.display !== 'none') {
            log('Overlay is initially visible, performing check...');
            analyzeVisibleImage();
        } else {
            log('Overlay is initially hidden, waiting...');
        }
    } else {
        log('OBSERVERS: no overlay found');
    }
}

function checkPath() {
    let isBadPath = true;
    let currentPath = window.location.pathname;

    paths.forEach(path => {
        if (!isBadPath) return;
        isBadPath = currentPath.includes(path) ? false : true;
    });

    if (isBadPath) {
        log('path ' + currentPath + ' does not include any of: ' + paths.join(', '));
        return false;
    }

    updateProomptContainer();
    return true;
}

// tldr; copyparty loads the overlay the first time you trigger it instead of at page load
// and the script probably shouldn't run before the overlay exists
function runInit() {
    function checkAndInitialize() {
        const overlay = document.getElementById('bbox-overlay');
        if (overlay && overlay.style.display !== '' && checkPath()) {
            log('INIT: overlay found and visible, initializing observers');
            initializeObservers();
            return true;
        }
        return false;
    }

    // set up init check
    if (!checkAndInitialize()) {
        log('INIT: waiting for overlay to become visible');
        const initObserver = new MutationObserver((mutations, observer) => {
            if (checkAndInitialize()) {
                log('INIT: initialization complete, removing init observer');
                observer.disconnect();
            }
        });

        // observe the body for changes
        initObserver.observe(document.body, {
            attributes: true,
        });
    }
}

runInit();
