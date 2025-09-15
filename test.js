// Simplified templating system with proper nested repeat handling
(function(window) {
    'use strict';

    const ts = {};
    const registeredComponents = {};
    const componentTemplates = {};

    function getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || typeof current !== 'object' || !(part in current)) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }

    function processSimplePlaceholders(html, data) {
        const placeholders = html.match(/{{([^{}]+)}}/g) || [];
        
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            const value = getNestedValue(data, key);
            html = html.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value !== undefined ? String(value) : '');
        });

        return html;
    }

    function processTemplate(template, data) {
        // First, replace all simple placeholders to prevent image loading issues
        let html = processSimplePlaceholders(template, data);
        
        // Then process repeats
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        processRepeats(tempDiv, data);
        
        return tempDiv.innerHTML;
    }

    function processRepeats(container, data) {
        let changed = true;
        
        // Keep processing until no more changes (handles nested repeats)
        while (changed) {
            changed = false;
            const repeatElements = container.querySelectorAll('[ts-repeat]');
            
            if (repeatElements.length === 0) break;
            
            // Process one level at a time
            for (const element of repeatElements) {
                // Skip if this element is inside another ts-repeat element
                if (hasRepeatAncestor(element, container)) {
                    continue;
                }
                
                const arrayPath = element.getAttribute('ts-repeat');
                const collection = getNestedValue(data, arrayPath);

                if (!Array.isArray(collection)) {
                    console.warn(`Collection at path '${arrayPath}' is not an array or doesn't exist`);
                    element.remove();
                    changed = true;
                    break;
                }

                // Get the template without the ts-repeat attribute
                const itemTemplate = element.outerHTML.replace(/\s*ts-repeat="[^"]*"/g, '');
                
                // Generate HTML for each item
                const itemsHtml = collection.map(item => {
                    // Process placeholders for this item first
                    let itemHtml = processSimplePlaceholders(itemTemplate, item);
                    
                    // If there are nested ts-repeat elements, we'll process them in the next iteration
                    return itemHtml;
                }).join('');

                // Replace the ts-repeat element with the generated items
                element.outerHTML = itemsHtml;
                changed = true;
                break; // Process one element at a time to avoid conflicts
            }
        }
    }

    function hasRepeatAncestor(element, container) {
        let parent = element.parentElement;
        while (parent && parent !== container) {
            if (parent.hasAttribute && parent.hasAttribute('ts-repeat')) {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    }

    ts.gethttpObject = function(url) {
        return new Promise((resolve, reject) => {
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => resolve(data))
                .catch(error => {
                    console.error('Failed to fetch JSON file:', error);
                    reject(error);
                });
        });
    };

    ts.gethttpText = function(url) {
        return new Promise((resolve, reject) => {
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.text();
                })
                .then(text => resolve(text))
                .catch(error => {
                    console.error('Failed to fetch text file:', error);
                    reject(error);
                });
        });
    };

    ts.render = function(selector, data, processFn) {
        const processedData = processFn ? processFn(data) : data;
        const elements = document.querySelectorAll(selector);

        elements.forEach(element => {
            const template = element.innerHTML;
            const renderedHtml = processTemplate(template, processedData);
            element.innerHTML = renderedHtml;
        });
    };

    ts.registerComponent = function(componentName, templateUrl) {
        if (!componentName || !templateUrl) {
            console.error('Component name and template URL are required.');
            return;
        }
        registeredComponents[componentName] = templateUrl;
    };

    ts.includeHTML = async function() {
        const elements = document.querySelectorAll('[ts-include-html]');
        const fetchPromises = [];

        elements.forEach(element => {
            const url = element.getAttribute('ts-include-html');
            if (url) {
                const fetchPromise = fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to fetch HTML from ${url}. Status: ${response.status}`);
                        }
                        return response.text();
                    })
                    .then(html => {
                        element.innerHTML = html;
                    })
                    .catch(error => {
                        console.error('Error including HTML:', error);
                        return Promise.resolve();
                    });
                fetchPromises.push(fetchPromise);
            }
        });

        await Promise.all(fetchPromises);
    };

    async function initComponents() {
        const componentElements = document.querySelectorAll('[ts-component]');

        for (const element of componentElements) {
            const componentName = element.getAttribute('ts-component');
            const dataUrl = element.getAttribute('data-url');

            const templateUrl = registeredComponents[componentName];
            if (!templateUrl) {
                console.error(`Component '${componentName}' is not registered.`);
                continue;
            }

            try {
                if (!componentTemplates[componentName]) {
                    const templateHtml = await ts.gethttpText(templateUrl);
                    componentTemplates[componentName] = templateHtml;
                }
                const templateHtml = componentTemplates[componentName];

                let data = {};
                if (dataUrl) {
                    data = await ts.gethttpObject(dataUrl);
                }

                const renderedHtml = processTemplate(templateHtml, data);
                element.innerHTML = renderedHtml;

            } catch (error) {
                console.error(`Error rendering component '${componentName}':`, error);
            }
        }
    }

    window.ts = ts;

    window.onload = function() {
        setTimeout(initComponents, 0);
    };

})(window);
