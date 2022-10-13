import { Component } from './component';
import { ConstructedRoute } from './constructed-route';
import { RouteableRouteGroup, RouteGroup } from './route-group';
import { Route } from './route';
import { RouteLayer } from './route-layer';
import { Render } from './render';

export class Router {
	static global: Router;
	
	static parameterNameMatcher = /:[a-zA-Z0-9]+/g;
	static parameterMatcher = '([^/]+)';

	rootNode: Node;

	onerror(error: Error, component?: Component) {
		console.log(`Error occurred in component`, component, error);
	}

	private constructedRoutes: ConstructedRoute[] = [];

	private root: typeof Component;
	private routes: { [ key: string ]: RouteGroup; };

	private renderedStack: RouteLayer[];
	private activeRender: Render;

	constructor(
		root: RouteableRouteGroup | typeof Component, 
		routes?: { [ key: string ]: RouteGroup; }
	) {
		if (routes) {
			this.root = root as typeof Component;
			this.routes = routes;
		} else {
			if (typeof root == 'function') {
				this.root = root; 
			} else {
				this.root = root.component;
				this.routes = root.children;
			}
		}
	}

	get activePath() {
		return location.hash.replace('#', '');
	}

	set activePath(value: string) {
		location.hash = `#${value}`;
	}

	navigate(path: string, relative?: Component) {
		this.activePath = this.absolute(path, relative);
	}

	absolute(path: string, relative?: Component) {
		if (path[0] == '/') {
			return path;
		} else if (relative) {
			return this.resolve(`${relative.route.fullPath}/${path}`);
		} else {
			return this.resolve(`${this.activePath}/${path}`);
		}
	}

	resolve(path: string) {
		const resolved = [];

		for (let component of path.split('/')) {
			if (component && component != '.') {
				if (component == '..') {
					resolved.pop();
				} else {
					resolved.push(component);
				}
			}
		}

		return `/${resolved.join('/')}`;
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

			path = path.replace(route.openStartPath, '');
			route = route.parent;
		}

		return items;
	}

	async update() {
		// abort the current renderer if there is a render in progress
		// the renderer returns a list of completed layers in the routing stack, which can be used as the base for this new render
		if (this.activeRender) {
			this.renderedStack = this.activeRender.abort();
		}

		this.activeRender = new Render(this.rootNode, this.renderedStack, this.buildRouteStack());

		// this method might take some time as it will load all the components (`onload`)
		await this.activeRender.render();

		// overwrite the currently active stack and reset the renderer
		this.renderedStack = this.activeRender.stack;
		this.activeRender = null;
	}

	buildRouteStack() {
		const path = this.activePath;
		const route = this.getRoute(path);
		const parameters = this.getActiveParams(path, route);

		const stack = [];

		for (let layerIndex = 0; layerIndex < route.parents.length; layerIndex++) {
			// clone the routes original client route
			const clientRoute = new Route();
			clientRoute.path = clientRoute.matchingPath = route.parents[layerIndex].clientRoute.matchingPath;
			clientRoute.child = route.parents[layerIndex + 1]?.clientRoute;
			clientRoute.parent = stack[layerIndex - 1]?.route;
			clientRoute.component = route.parents[layerIndex].component;

			// insert the active parameters into the client routes path
			for (let key in parameters[layerIndex]) {
				clientRoute.path = clientRoute.path.replace(`:${key}`, parameters[layerIndex][key]);
			}

			stack.push({
				component: route.parents[layerIndex].component,
				parameters: parameters[layerIndex],
				route: clientRoute
			});
		}

		return stack;
	}

	constructRoutes(root, routes = this.routes, parent: ConstructedRoute = null) {
		for (let path in routes) {
			const route = routes[path];

			const constructedRoute = {
				path: new RegExp(`^${`${root}${path}`.split('/').join('\\/').replace(Router.parameterNameMatcher, Router.parameterMatcher)}$`),
				openStartPath: new RegExp(`${`${path}`.split('/').join('\\/').replace(Router.parameterNameMatcher, Router.parameterMatcher)}$`),
				component: typeof route == 'function' ? route : (route as any).component,
				parent: parent,
				params: (path.match(Router.parameterNameMatcher) || []).map(key => key.replace(':', '')),
				parents: [],
				clientRoute: new Route()
			}

			constructedRoute.clientRoute.matchingPath = path;
			constructedRoute.clientRoute.parent = parent && parent.clientRoute;
			constructedRoute.clientRoute.component = constructedRoute.component;

			this.constructedRoutes.push(constructedRoute);

			if (!(typeof route == 'function') && (route as any).children) {
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
			'': {
				component: this.root,
				children: this.routes
			}
		};
		
		this.constructRoutes('');
		this.rootNode = root;

		this.update();
	}
}