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
        // Use a temporary div to work with the DOM elements
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = template;

        // First, replace all simple placeholders
        const placeholders = tempDiv.innerHTML.match(/{{([^{}]+)}}/g) || [];
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            const value = getNestedValue(data, key);
            if (value !== undefined) {
                tempDiv.innerHTML = tempDiv.innerHTML.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
            }
        });

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

                const parent = repeatElement.parentNode;
                if (!parent) return; // Safety check

                const originalTemplate = repeatElement.outerHTML;
                const fragment = document.createDocumentFragment();

                repeatData.forEach(itemData => {
                    const itemDiv = document.createElement('div');
                    itemDiv.innerHTML = originalTemplate;
                    const newRepeatElement = itemDiv.firstElementChild;
                    
                    if (newRepeatElement) {
                        newRepeatElement.removeAttribute('ts-repeat'); // Remove the attribute on the copy
                        
                        // Replace placeholders within this specific item's template
                        const itemPlaceholders = newRepeatElement.innerHTML.match(/{{([^{}]+)}}/g) || [];
                        itemPlaceholders.forEach(placeholder => {
                            const key = placeholder.slice(2, -2).trim();
                            const value = getNestedValue(itemData, key);
                            if (value !== undefined) {
                                newRepeatElement.innerHTML = newRepeatElement.innerHTML.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
                            }
                        });
                        
                        // Recursively process any nested repeats inside this item
                        processRepeats(newRepeatElement, itemData);
                        
                        fragment.appendChild(newRepeatElement);
                    }
                });

                // Replace the original ts-repeat element with the generated fragment
                parent.insertBefore(fragment, repeatElement);
                repeatElement.remove();
            });
        }

        // Start the recursive process from the top-level element
        processRepeats(tempDiv, data);

        // --- NEW CODE ADDED HERE ---
        // Find all elements with ts-src and move the value to src
        const elementsWithDataSrc = tempDiv.querySelectorAll('[ts-src]');
        elementsWithDataSrc.forEach(element => {
            const srcValue = element.getAttribute('ts-src');
            if (srcValue) {
                element.src = srcValue;
                element.removeAttribute('ts-src');
            }
        });
        // --- END OF NEW CODE ---
        
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
