// Fixed templating system that properly handles nested ts-repeat
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

    function processTemplate(template, data) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = template;
        processRepeats(tempDiv, data);
        let finalHtml = tempDiv.innerHTML;
        finalHtml = processSimplePlaceholders(finalHtml, data);
        return finalHtml;
    }

    function processRepeats(container, data) {
        // Find only the TOP-LEVEL ts-repeat elements (not nested ones)
        const topLevelRepeats = [];
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    if (node.hasAttribute && node.hasAttribute('ts-repeat')) {
                        // Check if this node is nested inside another ts-repeat
                        let parent = node.parentElement;
                        while (parent && parent !== container) {
                            if (parent.hasAttribute && parent.hasAttribute('ts-repeat')) {
                                return NodeFilter.FILTER_SKIP; // Skip nested ts-repeat
                            }
                            parent = parent.parentElement;
                        }
                        return NodeFilter.FILTER_ACCEPT; // Accept top-level ts-repeat
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            topLevelRepeats.push(node);
        }

        // Process each top-level repeat
        topLevelRepeats.forEach(element => {
            if (!element.parentNode) return; // Skip if already processed

            const arrayPath = element.getAttribute('ts-repeat');
            const collection = getNestedValue(data, arrayPath);

            if (!Array.isArray(collection)) {
                console.warn(`Collection at path '${arrayPath}' is not an array or doesn't exist`);
                element.remove();
                return;
            }

            const itemTemplate = element.outerHTML.replace(/\s*ts-repeat="[^"]*"/g, '');
            
            const itemsHtml = collection.map(item => {
                const itemDiv = document.createElement('div');
                itemDiv.innerHTML = itemTemplate;

                // Recursively process nested repeats with the individual item data
                processRepeats(itemDiv, item);

                let processedHtml = itemDiv.innerHTML;
                processedHtml = processSimplePlaceholders(processedHtml, item);
                
                return processedHtml;
            }).join('');

            element.outerHTML = itemsHtml;
        });
    }

    function processSimplePlaceholders(html, data) {
        const placeholders = html.match(/{{([^{}]+)}}/g) || [];
        
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            const value = getNestedValue(data, key);
            html = html.replace(placeholder, value !== undefined ? String(value) : '');
        });

        return html;
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
