import { Component } from "./component";
import { ConstructedRoute } from "./constructed-route";
import { RouteableRouteGroup, RouteGroup } from "./route-group";
import { Route } from "./route";

export class Router {
	static global: Router;

	rootNode: Node;

	private renderedPath: string;
	private renderedRoute: ConstructedRoute;
	private renderedParams: any[];

	private constructedRoutes: ConstructedRoute[] = [];

	private root;
	private routes;

	private routeReloader: Promise<void>;

	constructor(
		root: RouteableRouteGroup | typeof Component, 
		routes?: {
			[ key: string ]: RouteGroup;
		}
	) {
		if (routes) {
			this.root = root;
			this.routes = routes;
		} else {
			if (typeof root == "function") {
				this.root = root; 
			} else {
				this.root = root.component;
				this.routes = root.children;
			}
		}
	}

	get activePath() {
		return location.hash.replace("#", "");
	}

	set activePath(value: string) {
		location.hash = `#${value}`;
	}

	navigate(path: string, relative?: Component) {
		this.activePath = this.absolute(path, relative);

		this.update();
	}

	absolute(path: string, relative?: Component) {
		if (path[0] == "/") {
			return path;
		} else if (relative) {
			return this.resolve(`${relative.activeRoute.fullPath}/${path}`);
		} else {
			return this.resolve(`${this.activePath}/${path}`);
		}
	}

	resolve(path: string) {
		const resolved = [];

		for (let component of path.split("/")) {
			if (component && component != ".") {
				if (component == "..") {
					resolved.pop();
				} else {
					resolved.push(component);
				}
			}
		}

		return `/${resolved.join("/")}`;
	}

	getRoute(path: string) {
		for (let route of this.constructedRoutes) {
			if (route.path.test(path)) {
				return route;
			}
		}

		return null;
	}

	getActiveRoute() {
		return this.getRoute(this.activePath);
	}

	getActiveParams(path: string, activeRoute: ConstructedRoute) {
		const items: { [key: string]: string }[] = [];

		let route = activeRoute;

		while (route) {
			const item = {};

			const matches = path.match(route.openStartPath).slice(1);

			for (let i = 0; i < route.params.length; i++) {
				item[route.params[i]] = matches[i];
			}

			items.unshift(item);

			path = path.replace(route.openStartPath, "");
			route = route.parent;
		}

		return items;
	}

	updatingTo;

	async update() {
		if (this.updatingTo) {
			if (this.activePath != this.updatingTo) {
				requestAnimationFrame(() => this.update());
			}
			
			return
		}

		this.updatingTo = this.activePath;

		await this.dispatchUpdate();

		this.updatingTo = false;
	}

	async dispatchUpdate() {
		const path = this.activePath;

		if (this.renderedPath == path) {
			return;
		}

		// get new route
		const updatedRoute = this.getActiveRoute();

		if (!updatedRoute) {
			throw new Error(`invalid route '${path}'`);
		}

		// get new parameters
		const updatedParams = this.getActiveParams(path, updatedRoute);
		const elementLayers: Node[] = [];

		// create loader placeholders
		for (let l = 0; l < updatedRoute.parents.length; l++) {
			const layer = updatedRoute.parents[l];

			if (!updatedRoute.parents[l].renderedComponent) {
				layer.renderedComponent = new layer.component();
				layer.renderedComponent.params = updatedParams[l];
				layer.renderedComponent.activeRoute = layer.clientRoute;
				layer.renderedComponent.parent = updatedRoute.parents[l - 1]?.renderedComponent;
			}

			elementLayers.push(layer.renderedComponent.renderLoader());
		}

		// add root placeholder (will be replaced after the root component has been loaded)
		if (!this.renderedRoute) {
			this.rootNode.appendChild(elementLayers[0]);
		}

		// destroy unused routes
		if (this.renderedRoute) {
			for (let l = updatedRoute.parents.length; l < this.renderedRoute.parents.length; l++) {
				await this.renderedRoute.parents[l].renderedComponent.unload();
			}
		}

		// update each layer of the new routing tree
		for (let l = 0; l < updatedRoute.parents.length; l++) {
			const layer = updatedRoute.parents[l];
			const parentLayer = updatedRoute.parents[l - 1];
			const params = updatedParams[l];

			// update path
			layer.clientRoute.path = layer.clientRoute.matchingPath;

			for (let key in params) {
				layer.clientRoute.path = layer.clientRoute.path.replace(`:${key}`, params[key]);
			}

			const oldLayer = this.renderedRoute?.parents[l];
			const oldParams = this.renderedParams ? this.renderedParams[l] : null;

			// check if the layers component has changed
			if (oldLayer?.component == layer.component) {
				// check if the parameters have changed
				if (JSON.stringify(params) == JSON.stringify(oldParams)) {
					// check if this layer is the last before any new layers
					if (updatedRoute.parents[l + 1] && this.renderedRoute?.parents[l + 1] != updatedRoute.parents[l + 1]) {
						// update the layer using a placeholder
						layer.renderedComponent.update(elementLayers[l + 1]);
					} else {
						// notifiy about the clients changes
						layer.renderedComponent.onchildchange(params, layer.clientRoute, layer.renderedComponent);

						// check if this is now the top layer and remove the child if nescessary
						if (!updatedRoute.parents[l + 1]) {
							layer.renderedComponent.update(null);
						}
					}
				} else {
					// assign new parameters
					layer.renderedComponent.params = params;

					parentLayer?.renderedComponent.update(elementLayers[l]);

					// call parameter change handler and reload the component
					await layer.renderedComponent.onparameterchange(params);
					await layer.renderedComponent.onload();

					// update the components contents
					layer.renderedComponent.update(elementLayers[l + 1]);

					elementLayers[l].parentNode.replaceChild(layer.renderedComponent.rootNode, elementLayers[l]);
				}
			} else {
				// create a new instance of the layers component
				const instance = new layer.component();
				instance.params = params;
				instance.parent = parentLayer?.renderedComponent;
				instance.activeRoute = layer.clientRoute;

				layer.renderedComponent = instance;

				// await loader
				await instance.onload();

				// render component
				instance.rootNode = instance.render(elementLayers[l + 1]);

				await oldLayer?.renderedComponent.unload();

				// replace placeholder with new node
				elementLayers[l].parentNode?.replaceChild(instance.rootNode, elementLayers[l]);
				elementLayers[l] = instance.rootNode;
			}
		}

		// update routes
		this.renderedPath = path;
		this.renderedRoute = updatedRoute;
		this.renderedParams = updatedParams;
	}

	getMatchingRoutePath(updatedRoute: ConstructedRoute, updatedParams) {
		const unchangedRoutes: ConstructedRoute[] = [];

		for (let i = 0; i < updatedRoute.parents.length; i++) {
			if (this.renderedRoute.parents[i] && this.renderedRoute.parents[i] == updatedRoute.parents[i]) {
				for (let key in updatedParams[i]) {
					if (this.renderedParams[i][key] != updatedParams[i][key]) {
						return unchangedRoutes;
					}
				}

				unchangedRoutes.push(updatedRoute.parents[i]);
			} else {
				return unchangedRoutes;
			}
		}

		return unchangedRoutes;
	}

	constructRoutes(root, routes = this.routes, parent: ConstructedRoute = null) {
		for (let path in routes) {
			const route = routes[path];

			const constructedRoute = {
				path: new RegExp(`^${`${root}${path}`.split("/").join("\\/").replace(/:[a-zA-Z0-9]+/g, "(.[^\\/]+)")}$`),
				openStartPath: new RegExp(`${`${path}`.split("/").join("\\/").replace(/:[a-zA-Z0-9]+/g, "(.[^\\/]+)")}$`),
				component: typeof route == "function" ? route : (route as any).component,
				parent: parent,
				params: (path.match(/:[a-zA-Z0-9]+/g) || []).map(key => key.replace(":", "")),
				parents: [],
				clientRoute: new Route()
			}

			constructedRoute.clientRoute.matchingPath = path;
			constructedRoute.clientRoute.parent = parent && parent.clientRoute;

			this.constructedRoutes.push(constructedRoute);

			if (!(typeof route == "function") && (route as any).children) {
				this.constructRoutes(`${root}${path}`, (route as any).children, constructedRoute);
			}
		}

		if (routes == this.routes) {
			for (let route of this.constructedRoutes) {
				let item = route;

				while (item) {
					route.parents.unshift(item);

					item = item.parent;
				}
			}
		}
	}

	host(root: Node) {
		Router.global = this;

		this.routes = {
			"": {
				component: this.root,
				children: this.routes
			}
		};
		
		this.constructRoutes("");
		this.rootNode = root;

		this.update();
	}
}