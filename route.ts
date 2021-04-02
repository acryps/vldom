export class Route {
	path: string;
	matchingPath: string;
	parent?: Route;
	
	get fullPath() {
		return this.parent ? `${this.parent.fullPath}${this.path}` : this.path;
	}
}