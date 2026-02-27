(function () {
    const originalLocation = window.location;
    const spoofedLocation = {};
    const props = ['hash', 'host', 'hostname', 'href', 'origin', 'pathname', 'port', 'protocol', 'search'];

    props.forEach(prop => {
        Object.defineProperty(spoofedLocation, prop, {
            get: function () {
                if (prop === 'hostname') return 'localhost';
                if (prop === 'port') return '8000';
                if (prop === 'host') return 'localhost:8000';
                if (prop === 'origin') return 'http://localhost:8000';
                if (prop === 'href') return originalLocation.href.replace(originalLocation.host, 'localhost:8000').replace(originalLocation.protocol, 'http:');
                return originalLocation[prop];
            },
            configurable: true
        });
    });

    ['assign', 'reload', 'replace', 'toString'].forEach(method => {
        spoofedLocation[method] = originalLocation[method].bind(originalLocation);
    });

    try {
        Object.defineProperty(window, 'location', {
            get: function () { return spoofedLocation; },
            configurable: true
        });
    } catch (e) {
        try {
            Object.defineProperty(document, 'location', {
                get: function () { return spoofedLocation; },
                configurable: true
            });
        } catch (e2) { }
    }

    try {
        Object.defineProperty(document, 'domain', {
            get: function () { return 'localhost'; },
            configurable: true
        });
    } catch (e) { }
})();

window.onbeforeunload = function () {
    setTimeout(function () {
        window.stop();
    }, 1);
};

const originalWindowOpen = window.open;
window.open = function () {
    return null;
};

window.confirm = function () {
    return false;
};

window.alert = function (message) {
};

const currentDomain = window.location.hostname;

function isSameDomain(url) {
    if (!url) return true;
    try {
        if (url.startsWith('/') || !url.includes('://')) {
            return true;
        }

        const urlObj = new URL(url);
        return urlObj.hostname === currentDomain;
    } catch (e) {
        return false;
    }
}

const originalFetch = window.fetch;
window.fetch = function (resource, options) {
    const url = typeof resource === 'string' ? resource : resource.url;

    if (isSameDomain(url)) {
        return originalFetch.apply(this, arguments);
    } else {
        console.log("BLOCKED REQUEST:", url);
        return new Promise((resolve, reject) => {
            reject(new Error("REQUEST BLOCKED"));
        });
    }
};

const originalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function () {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;

    xhr.open = function (method, url, ...rest) {
        xhr._blockedUrl = !isSameDomain(url) ? url : null;
        return originalOpen.apply(this, [method, url, ...rest]);
    };

    const originalSend = xhr.send;
    xhr.send = function (body) {
        if (xhr._blockedUrl) {
            console.log("BLOCKED REQUEST:", xhr._blockedUrl);
            Object.defineProperty(this, 'status', { value: 0 });
            Object.defineProperty(this, 'statusText', { value: 'Error' });

            setTimeout(() => {
                const errorEvent = new Event('error');
                this.dispatchEvent(errorEvent);
            }, 0);

            return;
        }
        return originalSend.apply(this, arguments);
    };

    return xhr;
};

const originalImage = window.Image;
window.Image = function () {
    const img = new originalImage();
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');

    Object.defineProperty(img, 'src', {
        set: function (value) {
            if (isSameDomain(value)) {
                originalSrcDescriptor.set.call(this, value);
            } else {
                console.log("BLOCKED IMAGE:", value);
            }
        },
        get: function () {
            return originalSrcDescriptor.get.call(this);
        }
    });

    return img;
};

const originalCreateElement = document.createElement;
document.createElement = function (tagName) {
    const element = originalCreateElement.call(document, tagName);

    if (tagName.toLowerCase() === 'script') {
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');

        Object.defineProperty(element, 'src', {
            set: function (value) {
                const gdSdkUrl = "https://html5.api.gamedistribution.com/main.min.js";
                if (value === gdSdkUrl || (typeof value === 'string' && value.includes('gamedistribution.com/main.min.js'))) {
                    console.log("REDIRECTING GD SDK TO STUB");
                    const gdSdkStub = `
                        (function() {
                            console.log("ULTIMATE EXHAUSTIVE GD SDK STUB LOADED");
                            
                            const listeners = {};

                            const createStub = (name) => {
                                const stub = function(...args) {
                                    console.log("GD SDK CALL:", name, args);
                                    const promise = Promise.resolve(stub);
                                    return new Proxy(promise, handler(name + "()"));
                                };
                                
                                const handler = (path) => ({
                                    get: (target, prop) => {
                                        if (prop === 'then') return target.then.bind(target);
                                        if (prop === 'on') return (n, c) => {
                                            if (!listeners[n]) listeners[n] = [];
                                            listeners[n].push(c);
                                            console.log("GD SDK ON:", n);
                                        };
                                        if (prop === 'emit') return (n, d) => {
                                            if (listeners[n]) listeners[n].forEach(fn => fn(d));
                                        };
                                        
                                        const newPath = path + "." + String(prop);
                                        console.log("GD SDK ACCESS:", newPath);
                                        return createStub(newPath);
                                    },
                                    apply: (target, thisArg, args) => {
                                        console.log("GD SDK CALL:", path, args);
                                        return createStub(path + "()");
                                    },
                                    construct: (target, args) => {
                                        console.log("GD SDK CONSTRUCT:", path, args);
                                        return createStub(path);
                                    }
                                });

                                return new Proxy(stub, handler(name));
                            };

                            window.gdsdk = createStub("gdsdk");
                            
                            // Static properties for common expectations
                            window.gdsdk.items = [];
                            window.gdsdk.store = createStub("gdsdk.store");

                            // Signal that the SDK is "ready"
                            setTimeout(() => {
                                document.dispatchEvent(new CustomEvent('gamedistribution_ready'));
                                if (listeners['SDK_READY']) {
                                    listeners['SDK_READY'].forEach(fn => fn());
                                }
                                console.log("SENT ULTIMATE ready signals");
                            }, 100);
                        })();
                    `;
                    const gdSdkDataUrl = "data:application/javascript," + encodeURIComponent(gdSdkStub);
                    originalSrcDescriptor.set.call(this, gdSdkDataUrl);
                } else if (isSameDomain(value)) {
                    originalSrcDescriptor.set.call(this, value);
                } else {
                    console.log("BLOCKED SCRIPT:", value);
                }
            },
            get: function () {
                return originalSrcDescriptor.get.call(this);
            }
        });
    }

    if (tagName.toLowerCase() === 'iframe') {
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');

        Object.defineProperty(element, 'src', {
            set: function (value) {
                if (isSameDomain(value)) {
                    originalSrcDescriptor.set.call(this, value);
                } else {
                    console.log("BLOCKED IFRAME:", value);
                }
            },
            get: function () {
                return originalSrcDescriptor.get.call(this);
            }
        });
    }

    return element;
};

const originalSendBeacon = navigator.sendBeacon;
navigator.sendBeacon = function (url, data) {
    if (isSameDomain(url)) {
        return originalSendBeacon.call(this, url, data);
    } else {
        console.log("BLOCKED REQUEST:", url);
        return false;
    }
};

const originalWebSocket = window.WebSocket;
window.WebSocket = function (url, protocols) {
    if (isSameDomain(url)) {
        return new originalWebSocket(url, protocols);
    } else {
        console.log("Blocked connection:", url);
        return {
            send: function () { },
            close: function () { },
            addEventListener: function () { }
        };
    }
};

console.log("GDAB is running!");

console.log("GDAB, by syncintellect @ github, and maintained by q8j-dev in conjuction with endlessguyin @ github!");