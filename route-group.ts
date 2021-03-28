import { Component } from "./component";
export type RouteGroup = typeof Component | {
	component: typeof Component;
	children?: {
		[key: string]: RouteGroup;
	};
};
