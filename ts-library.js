// A simple, modern templating library.
// Designed to be easy to understand and use, similar to w3.js, but with modern features.

// The library is wrapped in an Immediately Invoked Function Expression (IIFE) to
// prevent global namespace pollution and create a private scope.
(function(window) {
    'use strict';

    // The main object that will contain all of our library's methods.
    // It is attached to the global 'window' object, so it can be accessed
    // anywhere in the code via `ts.methodName()`.
    const ts = {};

    // A private object to store registered components.
    const registeredComponents = {};
    const componentTemplates = {};

    /**
     * Safely retrieves a nested value from an object using a dot-notation path.
     * @param {Object} obj - The object to search within.
     * @param {string} path - The dot-notation path to the desired value (e.g., 'user.address.city').
     * @returns {*} - The value at the specified path, or `undefined` if not found.
     */
    function getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            // If any part of the path is null, undefined, or not an object, stop and return undefined.
            if (current === null || typeof current !== 'object' || !(part in current)) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }

    /**
     * Fetches a JSON object from a given URL using the modern Fetch API.
     * This method is asynchronous and returns a Promise.
     * @param {string} url - The URL of the JSON file to fetch.
     * @returns {Promise<Object>} - A Promise that resolves with the parsed JSON object.
     * It rejects with an error if the fetch fails or the
     * response is not valid JSON.
     */
    ts.gethttpObject = function(url) {
        // Return a new Promise to handle the asynchronous operation.
        return new Promise((resolve, reject) => {
            fetch(url)
                .then(response => {
                    // Check if the network response was successful (status code 200-299).
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    // Attempt to parse the response as JSON.
                    return response.json();
                })
                .then(data => {
                    // If parsing is successful, resolve the Promise with the data.
                    resolve(data);
                })
                .catch(error => {
                    // If any error occurs during the fetch or parsing, reject the Promise.
                    console.error('Failed to fetch JSON file:', error);
                    reject(error);
                });
        });
    };

    /**
     * Fetches a plain text string from a given URL.
     * This method is asynchronous and returns a Promise.
     * @param {string} url - The URL of the text file to fetch.
     * @returns {Promise<string>} - A Promise that resolves with the text content.
     * It rejects with an error if the fetch fails.
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
                .then(text => {
                    resolve(text);
                })
                .catch(error => {
                    console.error('Failed to fetch text file:', error);
                    reject(error);
                });
        });
    };

    /**
     * Finds all elements with the "ts-include-html" attribute and loads the
     * specified HTML file into them.
     * @returns {Promise<void>} - A Promise that resolves when all includes are complete.
     */
    ts.includeHTML = async function() {
        const elements = document.querySelectorAll('[ts-include-html]');
        const fetchPromises = [];

        // Iterate over each element found.
        elements.forEach(element => {
            const url = element.getAttribute('ts-include-html');
            if (url) {
                // For each element, push a fetch promise to an array.
                const fetchPromise = fetch(url)
                    .then(response => {
                        // Check for a successful response.
                        if (!response.ok) {
                            throw new Error(`Failed to fetch HTML from ${url}. Status: ${response.status}`);
                        }
                        return response.text();
                    })
                    .then(html => {
                        // Set the innerHTML of the element with the fetched content.
                        element.innerHTML = html;
                    })
                    .catch(error => {
                        console.error('Error including HTML:', error);
                        // Still resolve to allow other includes to complete.
                        return Promise.resolve();
                    });
                fetchPromises.push(fetchPromise);
            }
        });

        // Wait for all fetch promises to complete.
        await Promise.all(fetchPromises);
    };

    /**
     * Renders a data object into an HTML template by replacing placeholders.
     * Placeholders are defined by double curly braces, e.g., {{key}} or {{user.name}}.
     * @param {string} selector - The CSS selector for the HTML element(s) to render into.
     * @param {Object} data - The data object to be used for rendering.
     * @param {function(Object): Object} [processFn] - An optional function to process the data before rendering.
     */
    ts.render = function(selector, data, processFn) {
        // Process the data if a function is provided.
        const processedData = processFn ? processFn(data) : data;

        // Find all elements that match the given selector.
        const elements = document.querySelectorAll(selector);

        // Iterate over each element found.
        elements.forEach(element => {
            // Get the current HTML content of the element.
            let html = element.innerHTML;

            // Find all placeholders in the HTML using a regular expression.
            const placeholders = html.match(/{{([^{}]+)}}/g) || [];

            // Replace each placeholder with the corresponding value from the data object.
            placeholders.forEach(placeholder => {
                // Extract the key path from the placeholder, e.g., 'user.name'.
                const key = placeholder.slice(2, -2);
                // Get the nested value using the helper function.
                const value = getNestedValue(processedData, key);
                // Replace the placeholder. If the value is undefined, use an empty string.
                html = html.replace(placeholder, value !== undefined ? String(value) : '');
            });

            // Update the element's innerHTML with the rendered content.
            element.innerHTML = html;
        });
    };

    /**
     * Renders a collection of data objects into a template and appends the results
     * to a container.
     * @param {string} containerSelector - The CSS selector for the container element.
     * @param {Array<Object>} data - An array of data objects to be rendered.
     * @param {string} templateSelector - The CSS selector for the template element.
     * @param {function(Object): Object} [processFn] - An optional function to process each data item before rendering.
     */
    ts.renderCollection = function(containerSelector, data, templateSelector, processFn) {
        const container = document.querySelector(containerSelector);
        const templateElement = document.querySelector(templateSelector);

        if (!container || !templateElement) {
            console.error('Container or template element not found for rendering collection.');
            return;
        }

        // Store the original HTML of the template element.
        const originalTemplateHTML = templateElement.innerHTML;
        // Clear the container to make way for the rendered items.
        container.innerHTML = '';

        // Iterate over each item in the data array.
        data.forEach(item => {
            // Process the data item if a function is provided.
            const processedItem = processFn ? processFn(item) : item;

            // Create a temporary element to hold the template HTML.
            const tempElement = document.createElement('div');
            tempElement.innerHTML = originalTemplateHTML;

            // Find all placeholders in the template's HTML.
            const placeholders = tempElement.innerHTML.match(/{{([^{}]+)}}/g) || [];

            // Replace each placeholder with the corresponding value from the current item.
            let renderedHtml = tempElement.innerHTML;
            placeholders.forEach(placeholder => {
                const key = placeholder.slice(2, -2);
                const value = getNestedValue(processedItem, key);
                renderedHtml = renderedHtml.replace(placeholder, value !== undefined ? String(value) : '');
            });

            // Append the rendered HTML to the container.
            container.innerHTML += renderedHtml;
        });
    };

    /**
     * Registers a new component with a name and its HTML template URL.
     * @param {string} componentName - The name of the component (e.g., 'product-card').
     * @param {string} templateUrl - The URL to the component's HTML template file.
     */
    ts.registerComponent = function(componentName, templateUrl) {
        if (!componentName || !templateUrl) {
            console.error('Component name and template URL are required to register a component.');
            return;
        }
        registeredComponents[componentName] = templateUrl;
    };

    /**
     * A self-executing function that runs on page load to automatically render all components.
     * This function finds all elements with a 'ts-component' attribute, fetches their data and template,
     * and renders the final HTML.
     */
    async function initComponents() {
        const componentElements = document.querySelectorAll('[ts-component]');

        for (const element of componentElements) {
            const componentName = element.getAttribute('ts-component');
            const dataUrl = element.getAttribute('data-url');
            const collectionUrl = element.getAttribute('collection-url');

            const templateUrl = registeredComponents[componentName];
            if (!templateUrl) {
                console.error(`Component '${componentName}' is not registered.`);
                continue;
            }

            try {
                // Fetch the template HTML once and cache it.
                if (!componentTemplates[componentName]) {
                    const templateHtml = await ts.gethttpText(templateUrl);
                    componentTemplates[componentName] = templateHtml;
                }
                const templateHtml = componentTemplates[componentName];

                // If a collection URL is specified, fetch the collection data.
                if (collectionUrl) {
                    const collectionData = await ts.gethttpObject(collectionUrl);
                    let finalHtml = '';
                    collectionData.forEach(item => {
                        let renderedItem = templateHtml;
                        const placeholders = renderedItem.match(/{{([^{}]+)}}/g) || [];
                        placeholders.forEach(placeholder => {
                            const key = placeholder.slice(2, -2);
                            const value = getNestedValue(item, key);
                            renderedItem = renderedItem.replace(placeholder, value !== undefined ? String(value) : '');
                        });
                        finalHtml += renderedItem;
                    });
                    element.innerHTML = finalHtml;
                } else if (dataUrl) {
                    // If a single data URL is specified, fetch the single data object.
                    const data = await ts.gethttpObject(dataUrl);
                    let renderedHtml = templateHtml;
                    const placeholders = renderedHtml.match(/{{([^{}]+)}}/g) || [];
                    placeholders.forEach(placeholder => {
                        const key = placeholder.slice(2, -2);
                        const value = getNestedValue(data, key);
                        renderedHtml = renderedHtml.replace(placeholder, value !== undefined ? String(value) : '');
                    });
                    element.innerHTML = renderedHtml;
                } else {
                    // If no data URL is specified, just render the template as-is.
                    element.innerHTML = templateHtml;
                }
            } catch (error) {
                console.error(`Error rendering component '${componentName}':`, error);
            }
        }
    }

    // Attach the 'ts' object to the global window object.
    window.ts = ts;

    // We'll run this function on a timeout to ensure all components are registered first.
    // This is a simple solution to ensure synchronous registration and asynchronous rendering.
    window.onload = function() {
        setTimeout(initComponents, 0);
    }

    // --- Example Usage ---
    // You can uncomment the code below to test the functions.
    //
    // HTML file:
    // <body>
    //   <div ts-component="header-component"></div>
    //   <div ts-component="blog-post" data-url="/data/post.json"></div>
    //   <div ts-component="product-list" collection-url="/data/products.json"></div>
    // </body>
    //
    // JavaScript file:
    // ts.registerComponent('header-component', '/templates/header.html');
    // ts.registerComponent('blog-post', '/templates/post.html');
    // ts.registerComponent('product-list', '/templates/product-card.html');

})(window);
