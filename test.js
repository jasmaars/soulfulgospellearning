// Simple working templating system - let's get the basics right first
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

    // New, recursive function to process the template
    function processTemplate(template, data) {
        let html = template;

        // First, replace all simple placeholders
        const placeholders = html.match(/{{([^{}]+)}}/g) || [];
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            const value = getNestedValue(data, key);
            html = html.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value !== undefined ? String(value) : '');
        });

        // Use a temporary div to work with the DOM elements
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // The core recursive function to handle all repetitions
        function processRepeats(contextElement, contextData) {
            // Find all repeat elements at the current nesting level
            const repeatElements = contextElement.querySelectorAll('[ts-repeat]');

            repeatElements.forEach(repeatElement => {
                const repeatKey = repeatElement.getAttribute('ts-repeat');
                const repeatData = getNestedValue(contextData, repeatKey) || [];

                if (!Array.isArray(repeatData)) {
                    // If the data is not an array, remove the element
                    repeatElement.remove();
                    return;
                }

                const originalTemplate = repeatElement.outerHTML;
                let repeatedHtml = '';

                repeatData.forEach(itemData => {
                    // Create a new div to hold the single item's template for processing
                    const itemDiv = document.createElement('div');
                    itemDiv.innerHTML = originalTemplate.replace(/\s*ts-repeat="[^"]+"/g, '');

                    // Replace placeholders within this specific item's template
                    const itemPlaceholders = itemDiv.innerHTML.match(/{{([^{}]+)}}/g) || [];
                    itemPlaceholders.forEach(placeholder => {
                        const key = placeholder.slice(2, -2).trim();
                        const value = getNestedValue(itemData, key);
                        itemDiv.innerHTML = itemDiv.innerHTML.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value !== undefined ? String(value) : '');
                    });

                    // Recursively process any nested repeats inside this item
                    processRepeats(itemDiv, itemData);

                    repeatedHtml += itemDiv.innerHTML;
                });

                // Replace the original ts-repeat element with the generated HTML
                repeatElement.outerHTML = repeatedHtml;
            });
        }

        // Start the recursive process from the top-level element
        processRepeats(tempDiv, data);

        return tempDiv.innerHTML;
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
