[[![npm version](http://badge.acryps.com/npm/vldom)](http://badge.acryps.com/go/npm/vldom)

<img src="logo.svg" height="50">

# vldom TypeScript Frontend Component System

Simple component system with integrated routing.

## Setup
You'll need to enable jsx in your tsconfig
<pre>{
	"compileOnSave": false,
	"compilerOptions": {
		<b>"jsx": "react",
		"jsxFactory": "this.createElement",</b>
		....
	}
}</pre>

Compile your client with `tsc` and `vldom compile`!
```
tsc && vldom compile
```

## Usage
Create a component by extending the component class

```
export class ExampleComponent extends Component {
	constructor() {
		super();
	}

	render() {
		return <section>
			Example Component!
		</section>;
	}
}

new ExampleComponent().host(document.body);
```

Let's extends this by creating a recursive component

```
export class ExampleRecursiveComponent extends Component {
	constructor(private index: number) {
		super();
	}

	render() {
		return <section>
			Component {this.index}

			{index > 0 && new ExampleRecursiveComponent(index - 1)}
		</section>;
	}
}

new ExampleRecursiveComponent(10).host(document.body);
```

## Router
vldom has a built-in router
```
const router = new Router(PageComponent, {
	"/a": AComponent,
	"/b": BComponent
});

class PageComponent extends Component {
	render(child) {
		return <main>
			<nav>App</nav>

			{child}
		</main>;
	}
}

class AComponent extends Component {
	render() {
		return <p>A!</p>;
	}
}

class BComponent extends Component {
	render() {
		return <p>B!</p>;
	}
}

router.host(document.body);

onhashchange = () => router.update();
```

## Directives
You can create custom directives (attribute handlers).

```
Component.directives["epic-link"] = (element, value, tag, attributes, content) => {
	element.onclick = () => {
		location.href = value;
	}
}

export class ExampleComponent extends Component {
	constructor() {
		super();
	}

	render() {
		return <section>
			Test <a epic-link="http://github.com/">Link</a>
		</section>;
	}
}

new ExampleComponent().host(document.body);
```