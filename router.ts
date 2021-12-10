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

	async update() {
		const path = this.activePath;

		if (this.renderedPath == path) {
			return;
		}

		const updatedRoute = this.getActiveRoute();

		if (!updatedRoute) {
			throw new Error(`invalid route '${path}'`);
		}

		const updatedParams = this.getActiveParams(path, updatedRoute);

		const matchingRoutePath = this.renderedRoute ? this.getMatchingRoutePath(updatedRoute, updatedParams) : [];

		const elementLayers: Node[] = [];

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

		for (let l = 0; l < updatedRoute.parents.length; l++) {
			const layer = updatedRoute.parents[l];
			const parentLayer = updatedRoute.parents[l - 1];
			const params = updatedParams[l];

			layer.clientRoute.path = layer.clientRoute.matchingPath;

			for (let key in params) {
				layer.clientRoute.path = layer.clientRoute.path.replace(`:${key}`, params[key]);
			}

			if (this.renderedRoute && l == matchingRoutePath.length && layer == this.renderedRoute.parents[l]) {
				layer.renderedComponent.params = params;
				layer.renderedComponent.activeRoute = layer.clientRoute;
				layer.renderedComponent.parent = parentLayer?.renderedComponent;

				layer.renderedComponent.onparameterchange(params).then(() => {
					layer.renderedComponent.update(elementLayers[l + 1]);
				});
			} else if (l < matchingRoutePath.length) {
				const nextLayer = updatedRoute.parents[l + 1];

				layer.renderedComponent.params = params;
				layer.renderedComponent.activeRoute = layer.clientRoute;
				layer.renderedComponent.parent = parentLayer?.renderedComponent;

				if (this.renderedRoute && nextLayer && layer == this.renderedRoute.parents[l] && nextLayer != this.renderedRoute.parents[l + 1]) {
					layer.renderedComponent.onparameterchange(params).then(() => {
						layer.renderedComponent.update(elementLayers[l + 1]);
					});
				} else if (!nextLayer) {
					layer.renderedComponent.childNode = null;
					layer.renderedComponent.child = null;

					layer.renderedComponent.onparameterchange(params).then(() => {
						layer.renderedComponent.update(null);
					});
				} else {
					layer.renderedComponent.onchildparameterchange(params, layer.clientRoute, layer.renderedComponent);
				}
			} else {
				layer.renderedComponent = new layer.component();
				layer.renderedComponent.params = params;
				layer.renderedComponent.activeRoute = layer.clientRoute;
				layer.renderedComponent.parent = parentLayer?.renderedComponent;

				if (parentLayer) {
					parentLayer.renderedComponent.child = layer.renderedComponent;
					parentLayer.renderedComponent.childNode = elementLayers[l];
				}

				requestAnimationFrame(async () => {
					layer.loader = new Promise(async done => {
						await parentLayer?.loader;

						done(await layer.renderedComponent.onload())
					});

					layer.loader.then(() => {
						layer.renderedComponent.childNode = elementLayers[l + 1];

						const node = layer.renderedComponent.render(elementLayers[l + 1]);
						layer.renderedComponent.rootNode = node;

						if (elementLayers[l].parentNode) {
							elementLayers[l].parentNode.replaceChild(node, elementLayers[l]);
						}

						if (parentLayer) {
							parentLayer.renderedComponent.childNode = node;
						}
						
						elementLayers[l] = node;
					}).catch(error => {
						layer.renderedComponent.childNode = elementLayers[l + 1];

						const node = layer.renderedComponent.renderError(error);
						layer.renderedComponent.rootNode = node;

						if (elementLayers[l].parentNode) {
							elementLayers[l].parentNode.replaceChild(node, elementLayers[l]);
						}

						if (parentLayer) {
							parentLayer.renderedComponent.childNode = node;
						}
						
						elementLayers[l] = node;
					});
				});
			}
		}

		if (!this.renderedRoute) {
			this.rootNode.appendChild(elementLayers[0]);
		}

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