import { Component } from "./component";
import { Route } from "./route";

export class ConstructedRoute {
	path: RegExp;
	openStartPath: RegExp;
	component: typeof Component;
	parent: ConstructedRoute;
	parents: ConstructedRoute[];
	params: string[];
	clientRoute: Route;
	loader?: Promise<any>;

	renderedComponent?: Component;
}