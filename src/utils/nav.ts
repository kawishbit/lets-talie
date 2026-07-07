export function navClass(active: boolean) {
	return [
		"px-3 py-1.5 rounded-full text-sm transition-colors",
		active ? "bg-ink text-canvas" : "hover:bg-(--color-surface)",
	];
}
