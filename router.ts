import { Component } from "./component";

type RouteGroup = Component | {
	component: Component,
	children?: {
		[key: string]: RouteGroup
	}
}

export class ConstructedRoute {
	path: RegExp;
	openStartPath: RegExp;
	component: Component;
	parent: ConstructedRoute;
	parents: ConstructedRoute[];
	params: string[];
	clientRoute: Route;
	renderedRoot?: Node;
}

/*

	ROUTING CONCEPT:

	routes:
		/a -> AComponent
			/b/:c -> BComponent
				/d/:e -> DComponent

	actions:
		/a -> AComponent

		/a/b/1 -> AComponent{
			BComponent(1)
		}

		/a/b/1/d/2 -> AComponent{ 
			BComponent(1) {
				DComponent(2)
			}
		}

	re-renders:
		/a -> /a/b/1
			AComponent: re-render(BComponent)
			BComponent: render()

		/a/b/1 -> /a/b/2
			AComponent: no reload, onchildparamchange()
			BComponent: onparamchange(), no render

		/a/b/1 -> /a/b/1/d/2
			AComponent: no reload
			BComponent: render(DComponent)
			DComponent: render()

		/a/b/1/d/2 -> /a/b/1/d/3
			AComponent: no reload, onchildparamchange()
			BComponent: no reload, onchildparamchange()
			DComponent: onparamchange(), no render

		/a/b/1/d/3 -> /a/b/2
			AComponent: no reload, onchildparamchange()
			BComponent: onparamchange(), render()

*/
export class Router {
	rootNode: Node;

	private renderedPath: string;
	private renderedRoute: ConstructedRoute;
	private renderedParams: any[];

	private constructedRoutes: ConstructedRoute[] = [];

	static routes: {
		[ key: string ]: RouteGroup;

		default?: Component
	} = {};

	get activePath() {
		return location.hash.replace("#", "");
	}

	private getActiveRoute() {
		const path = this.activePath;

		for (let route of this.constructedRoutes) {
			if (route.path.test(path)) {
				return route;
			}
		}

		// return default route (or null)
		return this.constructedRoutes.find(r => r.path.source == "/^default$/");
	}

	private getActiveParams(path: string, activeRoute: ConstructedRoute) {
		const items: { [key: string]: string }[] = [];

		let route = activeRoute;

		while (route) {
			const item = {};

			const matches = path.match(route.openStartPath).slice(1);

			for (let i = 0; i < route.params.length; i++) {
				item[route.params[i]] = matches[i];
			}

			items.push(item);

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
		const updatedParams = this.getActiveParams(path, updatedRoute);

		const matchingRoutePath = this.getMatchingRoutePath(updatedRoute, updatedParams);

		const updatedSubRoutes = updatedRoute.parents.slice(matchingRoutePath.length);
		const lastCommonRoute = updatedRoute.parents[matchingRoutePath.length - 1];

		if (lastCommonRoute) {
			lastCommonRoute.component.update(updatedSubRoutes[0].component);
		} else {
			while (this.rootNode.hasChildNodes()) {
				this.rootNode.removeChild(this.rootNode.firstChild);
			}
			
			Component.renderingComponent = updatedSubRoutes[0].component;
			this.rootNode.appendChild(updatedSubRoutes[0].component.render());
		}

		for (let route of matchingRoutePath) {
			await route.component.onchildparamchange(updatedParams, updatedRoute.clientRoute, updatedRoute.component);
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

	constructRoutes(root, routes = Router.routes, parent: ConstructedRoute = null) {
		for (let path in routes) {
			const route = routes[path];
			const matchExpression = `${root}${path}`.split("/").join("\\/").replace(/:[a-zA-Z0-9]+/g, "(.[^\\/]+)")

			const constructedRoute = {
				path: new RegExp(`^${matchExpression}$`),
				openStartPath: new RegExp(`${matchExpression}$`),
				component: route instanceof Component ? route : route.component,
				parent: parent,
				params: path.match(/:[a-zA-Z0-9]+/g),
				parents: [],
				clientRoute: new Route()
			}

			constructedRoute.clientRoute.path = path;
			constructedRoute.clientRoute.parent = parent && parent.clientRoute;

			this.constructedRoutes.push(constructedRoute);

			if (!(route instanceof Component) && route.children) {
				this.constructRoutes(`${root}${path}`, route.children, constructedRoute);
			}
		}

		for (let route of this.constructedRoutes) {
			let item = route;

			while (item) {
				route.parents.unshift(route);

				item = item.parent;
			}
		}
	}

	host(root: Node) {
		this.constructRoutes("");

		this.rootNode = root;

		this.update();
	}
}

export class Route {
	path: string;
	parent?: Route;
	
	get fullPath() {
		return this.parent ? `${this.parent.fullPath}${this.path}` : this.path;
	}
}