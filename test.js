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

    function processTemplate(template, data) {
        let html = template;

        // First, replace all simple placeholders
        const placeholders = html.match(/{{([^{}]+)}}/g) || [];
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            const value = getNestedValue(data, key);
            html = html.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value !== undefined ? String(value) : '');
        });

        // Then handle ts-repeat elements
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Process only first-level ts-repeat elements (pages)
        const pagesRepeats = tempDiv.querySelectorAll('li[ts-repeat="pages"]');
        pagesRepeats.forEach(pageElement => {
            const pages = data.pages || [];
            if (!Array.isArray(pages)) {
                pageElement.remove();
                return;
            }

            let pageHtml = '';
            pages.forEach(page => {
                let pageTemplate = pageElement.outerHTML.replace(/\s*ts-repeat="pages"/g, '');
                
                // Replace page-level placeholders
                pageTemplate = pageTemplate.replace(/{{pageName}}/g, page.pageName || '');
                pageTemplate = pageTemplate.replace(/{{pageUrl}}/g, page.pageUrl || '');

                // Handle submenu
                if (page.submenu && Array.isArray(page.submenu) && page.submenu.length > 0) {
                    // Find submenu template within this page
                    const submenuMatch = pageTemplate.match(/<li\s+ts-repeat="submenu"[^>]*>.*?<\/li>/s);
                    if (submenuMatch) {
                        const submenuTemplate = submenuMatch[0].replace(/\s*ts-repeat="submenu"/g, '');
                        
                        let submenuHtml = '';
                        page.submenu.forEach(submenuItem => {
                            let submenuItemHtml = submenuTemplate;
                            submenuItemHtml = submenuItemHtml.replace(/{{name}}/g, submenuItem.name || '');
                            submenuItemHtml = submenuItemHtml.replace(/{{url}}/g, submenuItem.url || '');
                            
                            // Handle nested submenu (third level)
                            if (submenuItem.submenu && Array.isArray(submenuItem.submenu) && submenuItem.submenu.length > 0) {
                                const nestedSubmenuMatch = submenuItemHtml.match(/<li\s+ts-repeat="submenu"[^>]*>.*?<\/li>/s);
                                if (nestedSubmenuMatch) {
                                    const nestedTemplate = nestedSubmenuMatch[0].replace(/\s*ts-repeat="submenu"/g, '');
                                    
                                    let nestedHtml = '';
                                    submenuItem.submenu.forEach(nestedItem => {
                                        let nestedItemHtml = nestedTemplate;
                                        nestedItemHtml = nestedItemHtml.replace(/{{name}}/g, nestedItem.name || '');
                                        nestedItemHtml = nestedItemHtml.replace(/{{url}}/g, nestedItem.url || '');
                                        nestedHtml += nestedItemHtml;
                                    });
                                    
                                    submenuItemHtml = submenuItemHtml.replace(/<li\s+ts-repeat="submenu"[^>]*>.*?<\/li>/s, nestedHtml);
                                }
                            } else {
                                // Remove empty nested submenu
                                submenuItemHtml = submenuItemHtml.replace(/<ul[^>]*>[\s\S]*?<li\s+ts-repeat="submenu"[^>]*>.*?<\/li>[\s\S]*?<\/ul>/s, '');
                            }
                            
                            submenuHtml += submenuItemHtml;
                        });
                        
                        pageTemplate = pageTemplate.replace(/<li\s+ts-repeat="submenu"[^>]*>.*?<\/li>/s, submenuHtml);
                    }
                } else {
                    // Remove empty submenu ul
                    pageTemplate = pageTemplate.replace(/<ul[^>]*>[\s\S]*?<li\s+ts-repeat="submenu"[^>]*>.*?<\/li>[\s\S]*?<\/ul>/s, '');
                }

                pageHtml += pageTemplate;
            });

            pageElement.outerHTML = pageHtml;
        });

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
