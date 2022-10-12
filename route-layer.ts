import { Component } from "./component";

export class RouteLayer {
    component: typeof Component;
    rendered?: Component;
    parameters: any;
    route: string;
    placeholder?: Node;
}