import { RouteLayer } from "./route-layer";

export class Render {
    detached = false;
    rendering = true;

    layerIndex = 0;

    constructor(
        private renderedStack: RouteLayer[],
        private stack: RouteLayer[]
    ) {}

    abort() {
        // will prevent returning `onload`s from continuing to render
        this.rendering = false;

        // set the finished renderers as the rendered stack
        // -1 because the current element is not rendered yet
        return this.stack.slice(0, layerIndex - 1);
    }

    async render() {
        for (; this.layerIndex < this.stack.length; this.layerIndex++) {
            const layer = this.stack[this.layerIndex];
            const parent = this.stack[this.layerIndex - 1];
            const child = this.stack[this.layerIndex + 1];

            const existing = this.renderedStack[this.layerIndex];

            if (!this.detached && layer.route == existing.route) {
                // nothing has to be changed about the current layer
                // `.update()` might be called if this layers child changed
                layer.rendered = existing.rendered;

                // check if the layers child from the rendered stack was removed
                if (this.renderedStack[this.layerIndex + 1] && !child) {
                    const staleLayer = this.renderedStack[this.layerIndex + 1];
                    staleLayer.rendered.unload();

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
                    existing.rendered.unload();
                }

                // create placeholder and update parent if the parent was unchanged
                if (!layer.placeholder) {
                    layer.placeholder = layer.rendered.renderLoader();
                    parent.rendered.update(layer.placeholder);
                }

                await layer.rendered.onload();

                if (!this.rendering) {
                    return;
                }

                // create placeholder for child
                if (child) {
                    // already create child, as the loader is rendered on the instance itself
                    child.rendered = new child.component();
                    child.rendered.params = child.parameters;

                    child.placeholder = child.rendered.renderLoader();
                }

                // render new component, pass child placeholder as child node
                const node = layer.rendered.render(child?.placeholder);
                layer.placeholder.parentNode.replaceChild(node, layer.placeholder);

                parent?.rendered.onchildchange(layer.parameters, layer.route, layer.rendered);

                this.detached = true;
            }
        }
    }
}