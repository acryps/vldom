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
	child: Node;
	
	async onload() {}
	async onunload() {}
	async onchange(params) {}
	async onchildchange(params, route: Route, component: Component) {}
	
	render(child?: Node): Node {
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
	
	update(child?: Node) {
		if (arguments.length == 0) {
			child = this.child;
		} else {
			this.child = child;
		}

		if (child?.parentElement) {
			child.parentElement.removeChild(child);
		}

		const element = this.render(child);
		
		if (this.rootNode.parentNode) {
			this.rootNode.parentNode.replaceChild(element, this.rootNode);
		}

		if (this.parent) {
			this.parent.child = element;
		}
		
		this.rootNode = element;
		
		return element;
	}

	async reload() {
		await this.onload();
		await this.update();
	}

	// this method is used as a dummy before compilation with 'vldom compile'
	static createElement(tag, attributes, ...contents) {
		throw "cannot create element from uncompiled source";
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

	static accessor(get: Function, set: Function) {
		return {
			get() {
				return get()
			},
			set(value) {
				set(value);
			}
		}
	}

	private addToElement(item, element: Node) {
		if (item instanceof Node) {
			element.appendChild(item);
		} else if (Array.isArray(item)) {
			for (let child of item) {
				this.addToElement(child, element);
			}
		} else if (item instanceof Component) {
			const placeholder = document.createComment(item.constructor.name);

			element.appendChild(placeholder);

			item.parent = this;

			item.onload().then(() => {
				const child = item.render();
				item.rootNode = child;

				element.replaceChild(child, placeholder);
			});
		} else if (item !== false && item !== undefined && item !== null) {
			element.appendChild(document.createTextNode(item));
		}
	}

	async host(parent: Node) {
		await this.onload();

		const root = this.render();
		this.rootNode = root;
		this.parent = null;

		parent.appendChild(root);
	}
}