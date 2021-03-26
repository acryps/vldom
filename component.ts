import { Route } from "./route";

export class Component {
	static directives: { 
		[ key: string ]: (element: Node, value, tag: string, attributes, ...content) => void
	} = {};
	
	private timers = {
		intervals: [],
		timeouts: []
	};
	
	activeRoute: Route;
	params: any;
	parent?: Component;
	rootNode: Node;

	static renderingComponent: Component;
	
	async onload() {}
	async onunload() {}
	async onparamchange(params) {}
	async onchildparamchange(params, route: Route, component: Component) {}
	
	render(): Node {
		return document.createTextNode(this.constructor.name);
	}
	
	createTimeout(handler: Function, time: number) {
		const timer = setTimeout(() => {
			this.timers.timeouts.splice(this.timers.timeouts.indexOf(timer), 1);
			
			handler();
		}, time);
		
		this.timers.timeouts.push(timer);
	}
	
	createInterval(handler: Function, time: number, runOnStart = false) {
		if (runOnStart) {
			handler();
		}
		
		const timer = setTimeout(() => {
			handler();
		}, time);
		
		this.timers.intervals.push(timer);
	}
	
	clearTimers() {
		for (let timer of this.timers.timeouts) {
			clearTimeout(timer);
		}
		
		this.timers.timeouts = [];
		
		for (let timer of this.timers.intervals) {
			clearInterval(timer);
		}
		
		this.timers.intervals = [];
	}
	
	update() {
		Component.renderingComponent = this;
		const element = this.render();
		
		this.rootNode.parentNode.replaceChild(
			this.rootNode,
			element
		);
		
		this.rootNode = element;
		
		return element;
	}

	static createElement(tag, attributes, ...contents) {
		return Component.renderingComponent.createElement(tag, attributes, ...contents);
	}
	
	createElement(tag, attributes, ...contents) {
		const element = document.createElement(tag);
		element.hostingComponent = this;

		for (let item of contents) {
			this.addToElement(item, element);
		}
		
		for (let key in attributes) {
			const value = attributes[key];
			
			if (key in Component.directives) {
				Component.directives[key](element, value, tag, attributes, ...contents);
			} else {
				element.setAttribute(key, value);
			}
		}

		return element;
	}

	private addToElement(item, element) {
		if (item instanceof Node) {
			element.appendChild(item);
		} else if (Array.isArray(item)) {
			for (let child of item) {
				this.addToElement(child, element);
			}
		} else if (item instanceof Component) {
			Component.renderingComponent = item;

			const component = item.render();
			component.hostingComponent.parent = this;
			component.hostingComponent.rootNode = component;

			element.appendChild(item.render());

			Component.renderingComponent = this;
		} else if (item !== false) {
			element.appendChild(document.createTextNode(item));
		}
	}

	host(parent: HTMLElement) {
		Component.renderingComponent = this;

		const root = this.render();
		this.rootNode = root;
		this.parent = null;

		parent.appendChild(root);
	}
}