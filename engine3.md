# ENGINE3

when updating:
1. build routing stack from location, including parameters. each entry is a RouteLayer
2. loop thru routing stack
    2.1. keep the currently rendered component if the existing layer has the same route string
    2.2. re-load and re-render the current layer if the layer changed. re-render the parent when done
    2.3. after 2.2 hit (detached) | there is no existing stack, load component, render component, attach component (by replacing a placeholder)
3. if the stack is shorter, remove any removed components, by re-rendering their parents
4. store the stored stack with the new stack

when a new route is pushed, while the current is still rendering:
stop current rendering
flush currently rendered stack. save what happened, remove any layers that were not rendered fully
re-start rendering

class RouteLayer {
    component: typeof Component;
    rendered?: Component;
    parameters: any;
    route: string;
    placeholder?: Node;
}

class Router {
    renderedStack: RouteLayer[];

    renderAborter: () => void;

    update() {
        if (this.renderAborter) {
            this.renderAborter();
        }

        this.render(this.location);
    }

    async render(location) {
        const stack = this.buildRoutingStack(location);

        let detached = false;
        let rendering = true;

        let layerIndex = 0;

        // create abort function
        // this will be called when a new `update()` call occurred while this render was going on 
        this.renderAborter = () => {
            // set the finished renderers as the rendered stack
            // -1 because the current element is not rendered yet
            this.renderedStack = stack.slice(0, layerIndex - 1);

            // will prevent returning `onload`s from continuing to render
            this.rendering = false;
        };

        for (; layerIndex < stack.length; layerIndex++) {
            const layer = stack[layerIndex];
            const parent = stack[layerIndex - 1];
            const child = stack[layerIndex + 1];

            const existing = this.renderedStack[layerIndex];

            if (!detached && layer.route == existing.route) {
                // nothing has to be changed about the current layer
                // `.update()` might be called if this layers child changed
                layer.rendered = existing.rendered;

                // check if the layers child from the rendered stack was removed
                if (this.renderedStack[layerIndex + 1] && !child) {
                    const staleLayer = this.renderedStack[layerIndex + 1];
                    staleLayer.destroy();

                    // re render layer and set its child to null
                    layer.rendered.update(null);
                }
            } else {
                // route changed, renewed or any of its parents changed

                // create new component - if the component was not already created by parent (to create the placeholder)
                if (!layer.rendered) {
                    layer.rendered = new layer.component();
                    layer.rendered.params = layer.parameters;
                }

                // destroy existing component
                if (existing) {
                    existing.rendered.destroy();
                }

                // create placeholder and update parent if the parent was unchanged
                if (!layer.placeholder) {
                    layer.placeholder = component.renderLoader();
                    parent.rendered.update(layer.placeholder);
                }

                await component.onload();

                if (!rendering) {
                    return;
                }

                // create placeholder for child
                if (child) {
                    // already create child, as the loader is rendered on the instance itself
                    child.rendered = new child.component();
                    child.rendered.params = child.parameters;

                    child.placeholder = child.renderLoader();
                }

                // render new component, pass child placeholder as child node
                const node = layer.rendered.render(child?.placeholder);
                layer.placeholder.parentNode.replaceChild(node, layer.placeholder);

                parent?.rendered.onchildchange();

                detached = true;
            }
        }

        // remove current renderer abort
        delete this.renderAborter;

        // update the rendered stack
        this.renderedStack = stack;
    }
}