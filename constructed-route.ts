import { Component } from "./component";
import { Route } from "./route";

export class ConstructedRoute {
	path: RegExp;
	openStartPath: RegExp;
	component: typeof Component;
	renderedComponent?: Component;
	parent: ConstructedRoute;
	parents: ConstructedRoute[];
	params: string[];
	clientRoute: Route;

	renderedRoot?: Node;
	renderedChildNode?: Node;
}
