import { Route } from "./route";
import { Router } from "./router";
import { RouteableRouteGroup, RouteGroup } from "./route-group";

export class Component {
	static directives: { 
		[ key: string ]: (element: Node, value, tag: string, attributes, ...content) => void
	} = {};
	
	private timers = {
		intervals: [],
		timeouts: []
	};
	
	route: Route;
	router: Router;

	params: any;
	parent?: Component;
	rootNode: Node;

	child?: Component;
	childNode: Node;
	
	onload(): Promise<void> | void {}
	onunload(): Promise<void> | void {}

	onparameterchange(params): Promise<void> | void {}
	onchildchange(params, route: Route, component: Component): Promise<void> | void {}

	renderLoader() {
		return document.createComment(`* ${this.constructor.name} *`);
	}

	renderError(error: Error) {
		console.error(error);
		
		return this.createElement("section", null, 
			this.createElement("b", null, error.message),
			this.createElement("pre", null, error.stack)
		);
	}
	
	render(child?: Node): Node {
		return this.createElement(
			"component", { 
				"type": this.constructor.name 
			}, 
			"< ", this.constructor.name,
			`(${Object.keys(this.params).map(key => `${key}: ${JSON.stringify(this.params[key])}`).join(", ")})`, 
			"{", child, "}", 
			" >"
		);
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
			child = this.childNode;
		} else {
			this.childNode = child;
		}

		if (child?.parentElement) {
			child.parentElement.removeChild(child);
		}

		const element = this.render(child);
		
		if (this.rootNode?.parentNode) {
			this.rootNode.parentNode.replaceChild(element, this.rootNode);
		}

		if (this.parent) {
			this.parent.childNode = element;
		}
		
		this.rootNode = element;
		
		return element;
	}

	async reload() {
		await this.onload();

		if (this.child) {
			await this.child.reload();
		}

		await this.update();
	}

	async unload() {
		// stop all timers
		for (let interval of this.timers.intervals) {
			clearInterval(interval);
		}

		for (let timeout of this.timers.timeouts) {
			clearTimeout(timeout);
		}

		await this.onunload();
	}

	// this method is used as a dummy before compilation with 'vldom compile'
	// if you use parcel, the attribute list will contain a __self, which can be used to get the current component too (yay)
	static createElement(tag, attributes, ...contents) {
		if (attributes.__self) {
			return attributes.__self.createElement(tag, attributes, ...contents);
		}

		throw "cannot create element from uncompiled source";
	}
	
	createElement(tag, attributes, ...contents) {
		const element = document.createElement(tag);
		element.hostingComponent = this;

		for (let item of contents) {
			this.addToElement(item, element);
		}
		
		for (let key in attributes) {
			if (key[0] != '_') {
				const value = attributes[key];
				
				if (key in Component.directives) {
					Component.directives[key](element, value, tag, attributes, contents);
				} else if (value !== null) {
					element.setAttribute(key, value);
				}
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
			const placeholder = item.renderLoader();

			element.appendChild(placeholder);

			item.parent = this;

			(async () => {
				await item.onload();

				const child = item.render();
				item.rootNode = child;

				element.replaceChild(child, placeholder);
			})();
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

	navigate(path: string) {
		Router.global.navigate(path, this);

		return document.createComment(path);
	}

	remove() {
		this.rootNode?.parentElement?.removeChild(this.rootNode);
	}

	static updating(handler: (index?: number) => string | number, interval) {
		const element = document.createTextNode(`${handler(0)}`);
		let i = 0;

		setInterval(() => {
			element.textContent = `${handler(++i)}`;
		}, interval);

		return element;
	}

	static route(path: string, component: RouteGroup) {
		const tree: RouteableRouteGroup = {
			component: this,
			children: {
				[path]: component
			},

			route(path: string, component: RouteGroup): RouteableRouteGroup {
				tree.children[path] = component;

				return tree;
			}
		}

		return tree;
	}

	updateParameters(parameters) {
        for (let key in parameters) {
            if (parameters[key] === null) {
                delete this.params[key];
            } else {
                this.params[key] = `${parameters[key]}`;
            }
        }

        let path = this.route.matchingPath;

        for (let key in this.params) {
            path = path.replace(`:${key}`, this.params[key]);
        }

        this.router.activePath = this.router.updatingTo = this.router.storedPath.replace(this.route.fullPath, `${this.route.parent?.fullPath || ''}${path}`);
        this.route.path = path;
    }
}