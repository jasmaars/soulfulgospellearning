// Debug version to help identify the nested repeat issue
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
        console.log('Processing template with data:', data);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = template;

        processRepeats(tempDiv, data, 0); // Added depth tracking

        let finalHtml = tempDiv.innerHTML;
        finalHtml = processSimplePlaceholders(finalHtml, data);

        return finalHtml;
    }

    function processRepeats(container, data, depth = 0) {
        const indent = '  '.repeat(depth);
        console.log(`${indent}Processing repeats at depth ${depth} with data:`, data);
        
        const repeatElements = Array.from(container.querySelectorAll('[ts-repeat]'));
        
        const elementsByDepth = repeatElements
            .map(el => ({ element: el, depth: getElementDepth(el, container) }))
            .sort((a, b) => b.depth - a.depth);

        elementsByDepth.forEach(({ element }) => {
            if (!element.parentNode) return;

            const arrayPath = element.getAttribute('ts-repeat');
            console.log(`${indent}Looking for collection at path: "${arrayPath}"`);
            console.log(`${indent}Available data keys:`, Object.keys(data || {}));
            
            const collection = getNestedValue(data, arrayPath);
            console.log(`${indent}Collection found:`, collection);

            if (!Array.isArray(collection)) {
                console.warn(`${indent}Collection at path '${arrayPath}' is not an array or doesn't exist. Data:`, data);
                element.remove();
                return;
            }

            const itemTemplate = element.outerHTML.replace(/\s*ts-repeat="[^"]*"/g, '');
            
            const itemsHtml = collection.map((item, index) => {
                console.log(`${indent}Processing item ${index}:`, item);
                
                const itemDiv = document.createElement('div');
                itemDiv.innerHTML = itemTemplate;

                // Recursively process nested repeats with the individual item data
                processRepeats(itemDiv, item, depth + 1);

                let processedHtml = itemDiv.innerHTML;
                processedHtml = processSimplePlaceholders(processedHtml, item);
                
                return processedHtml;
            }).join('');

            element.outerHTML = itemsHtml;
        });
    }

    function getElementDepth(element, container) {
        let depth = 0;
        let current = element;
        while (current && current !== container) {
            depth++;
            current = current.parentElement;
        }
        return depth;
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

    // Rest of your existing methods...
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

                console.log('Component data loaded:', data);
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
