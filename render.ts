import { RouteLayer } from './route-layer';

export class Render {
	detached = false;
	rendering = true;

	layerIndex = 0;

	constructor(
		private root: Node,
		private renderedStack: RouteLayer[],
		public stack: RouteLayer[]
	) {}

	abort() {
		// will prevent returning `onload`s from continuing to render
		this.rendering = false;

		// set the finished renderers as the rendered stack
		// -1 because the current element is not rendered yet
		return this.stack.slice(0, this.layerIndex - 1);
	}

	async render() {
		// loop thur all layers from the new routing stack
		// the `detached` flat is set once a layer changed
		// all following layers will be reloaded
		for (; this.layerIndex < this.stack.length; this.layerIndex++) {
			const layer = this.stack[this.layerIndex];
			const child = this.stack[this.layerIndex + 1];

			const existing = this.renderedStack && this.renderedStack[this.layerIndex];

			if (!this.detached && layer.route.path == existing?.route.path) {
				// nothing has to be changed about the current layer
				// `.update()` might be called if this layers child changed
				layer.rendered = existing.rendered;

				// check if the layers child from the rendered stack was removed
				if (this.renderedStack[this.layerIndex + 1] && !child) {
					// unload the now stale container
					const staleLayer = this.renderedStack[this.layerIndex + 1];
					staleLayer.rendered.unload();

					// re render layer and set its child to null
					layer.rendered.update(null);
				}
			} else {
				// route changed, renewed or any of its parents changed
				const parent = this.stack[this.layerIndex - 1];

				// create new component - if the component was not already created by parent (to create the placeholder)
				if (!layer.rendered) {
					layer.rendered = new layer.component();
					layer.rendered.route = layer.route;
					layer.rendered.params = layer.parameters;
				}

				// destroy existing component
				if (existing) {
					existing.rendered.unload();
				}

				// create placeholder and update parent if the parent was unchanged
				if (!layer.placeholder) {
					layer.placeholder = layer.rendered.renderLoader();

					parent?.rendered.update(layer.placeholder);
				}

				await layer.rendered.onload();

				// the data loaded by `onload` should be ignored and the whole render should be stopped when `abort` was called
				if (!this.rendering) {
					return;
				}

				// create placeholder for child
				if (child) {
					// already create child, as the loader is rendered on the instance itself
					child.rendered = new child.component();
					child.rendered.route = child.route;
					child.rendered.params = child.parameters;

					// create the placeholder
					// will be a HTML comment by default, but a component might implement a custom loader element
					child.placeholder = child.rendered.renderLoader();
				}

				// render new component, pass child placeholder as child node (if present)
				layer.rendered.rootNode = layer.rendered.render(child?.placeholder);

				if (this.layerIndex) {
					// if not a root child, replace this layers placeholder with the new node
					layer.placeholder.parentNode.replaceChild(layer.rendered.rootNode, layer.placeholder);
				} else if (existing) {
					// replace the current root node with the new root node
					this.root.replaceChild(existing.rendered.rootNode, layer.rendered.rootNode);
				} else {
					// there is no existing root node - append this new root node
					this.root.appendChild(layer.rendered.rootNode);
				}

				// execute on child change
				parent?.rendered.onchildchange(layer.parameters, layer.route, layer.rendered);

				// will mark any following components as dirty -> they will be re-created
				this.detached = true;
			}
		}
	}
}