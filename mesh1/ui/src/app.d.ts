// ui/src/app.d.ts
// See https://svelte.dev/docs/kit/types#app.d.ts

import type { TypedRheoCell } from '../../protocols/example1/typed-mesh';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			cell: TypedRheoCell;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export { };