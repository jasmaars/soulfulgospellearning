// Enhanced templating system with nested ts-repeat support for submenus and hierarchical data
(function(window) {
    'use strict';

    const ts = {};
    const registeredComponents = {};
    const componentTemplates = {};

    /**
     * Safely retrieves a nested value from an object using a dot-notation path.
     */
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

    /**
     * Enhanced template processor that handles nested ts-repeat elements
     */
    function processTemplate(template, data) {
        // Create a temporary DOM element to work with the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = template;

        // Process ts-repeat elements recursively (deepest first for nested support)
        processRepeats(tempDiv, data);

        // Process regular placeholders in the entire template
        let finalHtml = tempDiv.innerHTML;
        finalHtml = processSimplePlaceholders(finalHtml, data);

        return finalHtml;
    }

    /**
     * Recursively process ts-repeat elements, handling nested repeats
     */
    function processRepeats(container, data) {
        // Find all ts-repeat elements at the current level
        const repeatElements = Array.from(container.querySelectorAll('[ts-repeat]'));
        
        // Process from deepest nested to shallowest to handle nesting correctly
        const elementsByDepth = repeatElements
            .map(el => ({ element: el, depth: getElementDepth(el, container) }))
            .sort((a, b) => b.depth - a.depth); // Deepest first

        elementsByDepth.forEach(({ element }) => {
            // Skip if this element has already been processed (removed from DOM)
            if (!element.parentNode) return;

            const arrayPath = element.getAttribute('ts-repeat');
            const collection = getNestedValue(data, arrayPath);

            if (!Array.isArray(collection)) {
                console.warn(`Collection at path '${arrayPath}' is not an array or doesn't exist`);
                element.remove();
                return;
            }

            // Get the template HTML of the repeating element (without the ts-repeat attribute)
            const itemTemplate = element.outerHTML.replace(/\s*ts-repeat="[^"]*"/g, '');
            
            // Generate HTML for all items in the collection
            const itemsHtml = collection.map(item => {
                // Create a temporary container for this item
                const itemDiv = document.createElement('div');
                itemDiv.innerHTML = itemTemplate;

                // Recursively process any nested ts-repeat elements within this item
                processRepeats(itemDiv, item);

                // Process placeholders for this item
                let processedHtml = itemDiv.innerHTML;
                processedHtml = processSimplePlaceholders(processedHtml, item);
                
                return processedHtml;
            }).join('');

            // Replace the ts-repeat element with the generated items
            element.outerHTML = itemsHtml;
        });
    }

    /**
     * Calculate the depth of an element within a container (for nested processing)
     */
    function getElementDepth(element, container) {
        let depth = 0;
        let current = element;
        while (current && current !== container) {
            depth++;
            current = current.parentElement;
        }
        return depth;
    }

    /**
     * Process simple {{placeholder}} replacements
     */
    function processSimplePlaceholders(html, data) {
        const placeholders = html.match(/{{([^{}]+)}}/g) || [];
        
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            const value = getNestedValue(data, key);
            html = html.replace(placeholder, value !== undefined ? String(value) : '');
        });

        return html;
    }

    /**
     * Fetches JSON from URL
     */
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

    /**
     * Fetches text from URL
     */
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

    /**
     * Enhanced render method with nested collection support
     */
    ts.render = function(selector, data, processFn) {
        const processedData = processFn ? processFn(data) : data;
        const elements = document.querySelectorAll(selector);

        elements.forEach(element => {
            const template = element.innerHTML;
            const renderedHtml = processTemplate(template, processedData);
            element.innerHTML = renderedHtml;
        });
    };

    /**
     * Register a component
     */
    ts.registerComponent = function(componentName, templateUrl) {
        if (!componentName || !templateUrl) {
            console.error('Component name and template URL are required.');
            return;
        }
        registeredComponents[componentName] = templateUrl;
    };

    /**
     * Include HTML files
     */
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

    /**
     * Initialize components with enhanced templating
     */
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
                // Fetch and cache template
                if (!componentTemplates[componentName]) {
                    const templateHtml = await ts.gethttpText(templateUrl);
                    componentTemplates[componentName] = templateHtml;
                }
                const templateHtml = componentTemplates[componentName];

                // Fetch data if URL provided
                let data = {};
                if (dataUrl) {
                    data = await ts.gethttpObject(dataUrl);
                }

                // Process template with enhanced system
                const renderedHtml = processTemplate(templateHtml, data);
                element.innerHTML = renderedHtml;

            } catch (error) {
                console.error(`Error rendering component '${componentName}':`, error);
            }
        }
    }

    // Attach to global scope
    window.ts = ts;

    // Initialize on page load
    window.onload = function() {
        setTimeout(initComponents, 0);
    };

})(window);
